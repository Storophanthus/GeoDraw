import { useSyncExternalStore } from "react";
import type { Vec2 } from "../geo/vec2";
import {
  type CircleStyle,
  type LineLikeObjectRef,
  getLineWorldAnchors,
  getPointWorldPos,
  isNameUnique,
  isValidPointName,
  nextLabelFromIndex,
  type GeometryObjectRef,
  type LineStyle,
  type PointStyle,
  type SceneModel,
  type ScenePoint,
  type ShowLabelMode,
} from "../scene/points";
import {
  distance,
  lineCircleIntersectionBranches,
  projectPointToCircle,
  projectPointToLine,
  projectPointToSegment,
} from "../geo/geometry";
import type { Camera, Viewport } from "../view/camera";
import { camera as cameraMath } from "../view/camera";

export type ActiveTool =
  | "move"
  | "point"
  | "copyStyle"
  | "midpoint"
  | "segment"
  | "line2p"
  | "circle_cp"
  | "perp_line"
  | "parallel_line";

export type SelectedObject =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line"; id: string }
  | { type: "circle"; id: string }
  | null;

export type HoveredHit =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line2p"; id: string }
  | { type: "circle"; id: string }
  | null;

export type PendingSelection =
  | {
      tool: "perp_line" | "parallel_line";
      step: 2;
      first:
        | { type: "point"; id: string }
        | { type: "lineLike"; ref: LineLikeObjectRef };
    }
  | {
      tool: "segment" | "line2p" | "circle_cp" | "midpoint";
      step: 2;
      first: { type: "point"; id: string };
    }
  | null;

type GeoState = {
  camera: Camera;
  activeTool: ActiveTool;
  scene: SceneModel;
  selectedObject: SelectedObject;
  recentCreatedObject: SelectedObject;
  hoveredHit: HoveredHit;
  cursorWorld: Vec2 | null;
  pendingSelection: PendingSelection;
  nextPointId: number;
  nextSegmentId: number;
  nextLineId: number;
  nextCircleId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  copyStyle: {
    source: SelectedObject;
    pointStyle: PointStyle | null;
    lineStyle: LineStyle | null;
    circleStyle: CircleStyle | null;
    showLabel: ShowLabelMode | null;
  };
  canUndo: boolean;
  canRedo: boolean;
};

type RenameResult = { ok: true; name: string } | { ok: false; error: string };

type GeoActions = {
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedObject: (selected: SelectedObject) => void;
  setHoveredHit: (hit: HoveredHit) => void;
  setCursorWorld: (world: Vec2 | null) => void;
  setPendingSelection: (next: PendingSelection) => void;
  clearPendingSelection: () => void;
  panByScreenDelta: (delta: Vec2) => void;
  zoomAtScreenPoint: (vp: Viewport, pScreen: Vec2, zoomFactor: number) => void;

  createFreePoint: (world: Vec2) => string;
  createMidpointFromPoints: (aId: string, bId: string) => string | null;
  createMidpointFromSegment: (segId: string) => string | null;
  createSegment: (aId: string, bId: string) => string | null;
  createLine: (aId: string, bId: string) => string | null;
  createPerpendicularLine: (throughId: string, base: LineLikeObjectRef) => string | null;
  createParallelLine: (throughId: string, base: LineLikeObjectRef) => string | null;
  createCircle: (centerId: string, throughId: string) => string | null;
  createPointOnLine: (lineId: string, s: number) => string | null;
  createPointOnSegment: (segId: string, u: number) => string | null;
  createPointOnCircle: (circleId: string, t: number) => string | null;
  createIntersectionPoint: (objA: GeometryObjectRef, objB: GeometryObjectRef, preferredWorld: Vec2) => string | null;

  movePointTo: (id: string, world: Vec2) => void;
  movePointLabelBy: (id: string, deltaPx: Vec2) => void;

  setPointDefaults: (next: Partial<PointStyle>) => void;
  updateSelectedPointStyle: (next: Partial<PointStyle>) => void;
  updateSelectedPointFields: (
    next: Partial<Pick<ScenePoint, "captionTex" | "visible" | "showLabel" | "locked" | "auxiliary">>
  ) => void;
  updateSelectedSegmentStyle: (next: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (next: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (next: Partial<CircleStyle>) => void;
  updateSelectedSegmentFields: (next: Partial<Pick<SceneModel["segments"][number], "visible" | "showLabel">>) => void;
  updateSelectedLineFields: (next: Partial<Pick<SceneModel["lines"][number], "visible">>) => void;
  updateSelectedCircleFields: (next: Partial<Pick<SceneModel["circles"][number], "visible">>) => void;

  renameSelectedPoint: (nextNameRaw: string) => RenameResult;
  deleteSelectedObject: () => void;
  setCopyStyleSource: (obj: Exclude<SelectedObject, null>) => void;
  applyCopyStyleTo: (obj: Exclude<SelectedObject, null>) => void;
  clearCopyStyle: () => void;
  undo: () => void;
  redo: () => void;
};

export type GeoStore = GeoState & GeoActions;

const defaultPointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.4,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 18,
  labelHaloWidthPx: 3.5,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const defaultSegStyle: LineStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 2,
  dash: "solid",
  opacity: 1,
};

const defaultLineStyle: LineStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.6,
  dash: "solid",
  opacity: 1,
};

const defaultCircleStyle: CircleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.6,
  strokeDash: "solid",
  strokeOpacity: 1,
  fillOpacity: 0,
};

const initialState: GeoState = {
  camera: { pos: { x: 0, y: 0 }, zoom: 80 },
  activeTool: "move",
  scene: {
    points: [],
    segments: [],
    lines: [],
    circles: [],
  },
  selectedObject: null,
  recentCreatedObject: null,
  hoveredHit: null,
  cursorWorld: null,
  pendingSelection: null,
  nextPointId: 1,
  nextSegmentId: 1,
  nextLineId: 1,
  nextCircleId: 1,
  pointDefaults: defaultPointStyle,
  segmentDefaults: defaultSegStyle,
  lineDefaults: defaultLineStyle,
  circleDefaults: defaultCircleStyle,
  copyStyle: {
    source: null,
    pointStyle: null,
    lineStyle: null,
    circleStyle: null,
    showLabel: null,
  },
  canUndo: false,
  canRedo: false,
};

let state: GeoState = initialState;
const listeners = new Set<() => void>();
const MAX_HISTORY = 200;

type HistorySnapshot = {
  activeTool: ActiveTool;
  scene: SceneModel;
  selectedObject: SelectedObject;
  recentCreatedObject: SelectedObject;
  nextPointId: number;
  nextSegmentId: number;
  nextLineId: number;
  nextCircleId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  copyStyle: GeoState["copyStyle"];
};

type SetStateOptions = {
  history?: "auto" | "push" | "coalesce" | "skip";
  actionKey?: string;
};

const undoStack: HistorySnapshot[] = [];
const redoStack: HistorySnapshot[] = [];
let lastHistoryActionKey: string | null = null;
let isRestoringHistory = false;

function emit() {
  for (const listener of listeners) listener();
}

function setState(updater: (prev: GeoState) => GeoState, options: SetStateOptions = { history: "auto" }) {
  const prev = state;
  let next = updater(prev);
  if (next === prev) return;

  const mode = options.history ?? "auto";
  const changed = hasHistoryDiff(prev, next);
  if (!isRestoringHistory && changed && mode !== "skip") {
    const snapshot = cloneHistorySnapshot(takeHistorySnapshot(prev));
    if (mode === "coalesce" && options.actionKey && lastHistoryActionKey === options.actionKey && undoStack.length > 0) {
      undoStack[undoStack.length - 1] = snapshot;
    } else {
      undoStack.push(snapshot);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
    }
    redoStack.length = 0;
    lastHistoryActionKey = options.actionKey ?? null;
  } else if (mode !== "coalesce") {
    lastHistoryActionKey = null;
  }

  next = {
    ...next,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
  state = next;
  emit();
}

const actions: GeoActions = {
  setActiveTool(tool) {
    setState((prev) => ({
      ...prev,
      activeTool: tool,
      pendingSelection: null,
      copyStyle:
        tool === "copyStyle"
          ? prev.copyStyle
          : {
              source: null,
              pointStyle: null,
              lineStyle: null,
              circleStyle: null,
              showLabel: null,
            },
    }));
  },

  setSelectedObject(selected) {
    if (isSameSelectedObject(state.selectedObject, selected)) return;
    setState((prev) => ({
      ...prev,
      selectedObject: selected,
      recentCreatedObject:
        prev.recentCreatedObject &&
        selected &&
        prev.recentCreatedObject.type === selected.type &&
        prev.recentCreatedObject.id === selected.id
          ? prev.recentCreatedObject
          : null,
    }));
  },

  setHoveredHit(hit) {
    if (isSameHoveredHit(state.hoveredHit, hit)) return;
    setState((prev) => ({ ...prev, hoveredHit: hit }));
  },

  setCursorWorld(world) {
    if (isSameWorld(state.cursorWorld, world)) return;
    setState((prev) => ({ ...prev, cursorWorld: world }));
  },

  setPendingSelection(next) {
    setState((prev) => ({ ...prev, pendingSelection: next }));
  },

  clearPendingSelection() {
    setState((prev) => ({ ...prev, pendingSelection: null }));
  },

  panByScreenDelta(delta) {
    setState((prev) => ({ ...prev, camera: cameraMath.panByScreenDelta(prev.camera, delta) }));
  },

  zoomAtScreenPoint(vp, pScreen, zoomFactor) {
    setState((prev) => ({
      ...prev,
      camera: cameraMath.zoomAtScreenPoint(prev.camera, vp, pScreen, zoomFactor),
    }));
  },

  createFreePoint(world) {
    let createdId = "";

    setState((prev) => {
      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }

      const id = `p_${prev.nextPointId}`;
      createdId = id;

      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id,
              kind: "free",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name" as ShowLabelMode,
              locked: false,
              auxiliary: false,
              position: world,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id },
        recentCreatedObject: { type: "point", id },
        nextPointId: prev.nextPointId + 1,
      };
    });

    return createdId;
  },

  createMidpointFromPoints(aId, bId) {
    if (aId === bId) return null;
    let createdId: string | null = null;

    setState((prev) => {
      const a = prev.scene.points.find((p) => p.id === aId);
      const b = prev.scene.points.find((p) => p.id === bId);
      if (!a || !b) return prev;

      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }

      const id = `p_${prev.nextPointId}`;
      createdId = id;

      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id,
              kind: "midpointPoints",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name" as ShowLabelMode,
              locked: true,
              auxiliary: true,
              aId,
              bId,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id },
        recentCreatedObject: { type: "point", id },
        nextPointId: prev.nextPointId + 1,
      };
    });

    return createdId;
  },

  createMidpointFromSegment(segId) {
    let createdId: string | null = null;
    setState((prev) => {
      const seg = prev.scene.segments.find((s) => s.id === segId);
      if (!seg) return prev;

      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }

      const id = `p_${prev.nextPointId}`;
      createdId = id;

      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id,
              kind: "midpointSegment",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name" as ShowLabelMode,
              locked: true,
              auxiliary: true,
              segId,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id },
        recentCreatedObject: { type: "point", id },
        nextPointId: prev.nextPointId + 1,
      };
    });
    return createdId;
  },

  createSegment(aId, bId) {
    if (aId === bId) return null;
    let id: string | null = null;
    setState((prev) => {
      const a = prev.scene.points.find((p) => p.id === aId);
      const b = prev.scene.points.find((p) => p.id === bId);
      if (!a || !b) return prev;
      id = `s_${prev.nextSegmentId}`;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          segments: [
            ...prev.scene.segments,
            {
              id,
              aId,
              bId,
              visible: true,
              showLabel: false,
              style: { ...prev.segmentDefaults },
            },
          ],
        },
        selectedObject: { type: "segment", id },
        recentCreatedObject: { type: "segment", id },
        nextSegmentId: prev.nextSegmentId + 1,
      };
    });
    return id;
  },

  createLine(aId, bId) {
    if (aId === bId) return null;
    let id: string | null = null;
    setState((prev) => {
      const a = prev.scene.points.find((p) => p.id === aId);
      const b = prev.scene.points.find((p) => p.id === bId);
      if (!a || !b) return prev;
      id = `l_${prev.nextLineId}`;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: [
            ...prev.scene.lines,
            {
              id,
              kind: "twoPoint",
              aId,
              bId,
              visible: true,
              style: { ...prev.lineDefaults },
            },
          ],
        },
        selectedObject: { type: "line", id },
        recentCreatedObject: { type: "line", id },
        nextLineId: prev.nextLineId + 1,
      };
    });
    return id;
  },

  createPerpendicularLine(throughId, base) {
    let id: string | null = null;
    setState((prev) => {
      const through = prev.scene.points.find((p) => p.id === throughId);
      if (!through) return prev;
      const baseValid =
        base.type === "line"
          ? prev.scene.lines.some((line) => line.id === base.id)
          : prev.scene.segments.some((seg) => seg.id === base.id);
      if (!baseValid) return prev;
      const tempLine: SceneModel["lines"][number] = {
        id: "__temp_perp__",
        kind: "perpendicular",
        throughId,
        base,
        visible: true,
        style: prev.lineDefaults,
      };
      const anchors = getLineWorldAnchors(tempLine, prev.scene);
      if (!anchors) return prev;
      id = `l_${prev.nextLineId}`;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: [
            ...prev.scene.lines,
            {
              id,
              kind: "perpendicular",
              throughId,
              base,
              visible: true,
              style: { ...prev.lineDefaults },
            },
          ],
        },
        selectedObject: { type: "line", id },
        recentCreatedObject: { type: "line", id },
        nextLineId: prev.nextLineId + 1,
      };
    });
    return id;
  },

  createParallelLine(throughId, base) {
    let id: string | null = null;
    setState((prev) => {
      const through = prev.scene.points.find((p) => p.id === throughId);
      if (!through) return prev;
      const baseValid =
        base.type === "line"
          ? prev.scene.lines.some((line) => line.id === base.id)
          : prev.scene.segments.some((seg) => seg.id === base.id);
      if (!baseValid) return prev;
      const tempLine: SceneModel["lines"][number] = {
        id: "__temp_parallel__",
        kind: "parallel",
        throughId,
        base,
        visible: true,
        style: prev.lineDefaults,
      };
      const anchors = getLineWorldAnchors(tempLine, prev.scene);
      if (!anchors) return prev;
      id = `l_${prev.nextLineId}`;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: [
            ...prev.scene.lines,
            {
              id,
              kind: "parallel",
              throughId,
              base,
              visible: true,
              style: { ...prev.lineDefaults },
            },
          ],
        },
        selectedObject: { type: "line", id },
        recentCreatedObject: { type: "line", id },
        nextLineId: prev.nextLineId + 1,
      };
    });
    return id;
  },

  createCircle(centerId, throughId) {
    if (centerId === throughId) return null;
    let id: string | null = null;
    setState((prev) => {
      const c = prev.scene.points.find((p) => p.id === centerId);
      const t = prev.scene.points.find((p) => p.id === throughId);
      if (!c || !t) return prev;
      id = `c_${prev.nextCircleId}`;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          circles: [
            ...prev.scene.circles,
            {
              id,
              centerId,
              throughId,
              visible: true,
              style: { ...prev.circleDefaults },
            },
          ],
        },
        selectedObject: { type: "circle", id },
        recentCreatedObject: { type: "circle", id },
        nextCircleId: prev.nextCircleId + 1,
      };
    });
    return id;
  },

  createPointOnLine(lineId, s) {
    let createdId: string | null = null;
    setState((prev) => {
      const line = prev.scene.lines.find((item) => item.id === lineId);
      if (!line) return prev;
      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }
      const id = `p_${prev.nextPointId}`;
      createdId = id;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id,
              kind: "pointOnLine",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name" as ShowLabelMode,
              locked: false,
              auxiliary: false,
              lineId,
              s,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id },
        recentCreatedObject: { type: "point", id },
        nextPointId: prev.nextPointId + 1,
      };
    });
    return createdId;
  },

  createPointOnSegment(segId, u) {
    let createdId: string | null = null;
    setState((prev) => {
      const seg = prev.scene.segments.find((item) => item.id === segId);
      if (!seg) return prev;
      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }
      const id = `p_${prev.nextPointId}`;
      createdId = id;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id,
              kind: "pointOnSegment",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name" as ShowLabelMode,
              locked: false,
              auxiliary: false,
              segId,
              u,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id },
        recentCreatedObject: { type: "point", id },
        nextPointId: prev.nextPointId + 1,
      };
    });
    return createdId;
  },

  createPointOnCircle(circleId, t) {
    let createdId: string | null = null;
    setState((prev) => {
      const circle = prev.scene.circles.find((item) => item.id === circleId);
      if (!circle) return prev;
      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }
      const id = `p_${prev.nextPointId}`;
      createdId = id;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id,
              kind: "pointOnCircle",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name" as ShowLabelMode,
              locked: false,
              auxiliary: false,
              circleId,
              t,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id },
        recentCreatedObject: { type: "point", id },
        nextPointId: prev.nextPointId + 1,
      };
    });
    return createdId;
  },

  createIntersectionPoint(objA, objB, preferredWorld) {
    let createdId: string | null = null;
    setState((prev) => {
      const existingId = findExistingIntersectionPointId(prev, objA, objB, preferredWorld);
      if (existingId) {
        createdId = existingId;
        return {
          ...prev,
          selectedObject: { type: "point", id: existingId },
        };
      }

      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }
      const id = `p_${prev.nextPointId}`;
      createdId = id;
      const lineCircle = getLineCircleRefs(objA, objB);
      const lineCirclePoint =
        lineCircle &&
        createStableLineCircleIntersectionPoint(id, lineCircle.lineId, lineCircle.circleId, preferredWorld, prev);
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            lineCirclePoint ?? {
              id,
              kind: "intersectionPoint",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name" as ShowLabelMode,
              locked: true,
              auxiliary: true,
              objA,
              objB,
              preferredWorld,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id },
        recentCreatedObject: { type: "point", id },
        nextPointId: prev.nextPointId + 1,
      };
    });
    return createdId;
  },

  movePointTo(id, world) {
    setState((prev) => {
      const nextPoints = prev.scene.points.map((point) => {
        if (point.id !== id) return point;
        if (point.locked) return point;
        if (point.kind === "free") return { ...point, position: world };

        if (point.kind === "pointOnLine") {
          const line = prev.scene.lines.find((item) => item.id === point.lineId);
          if (!line) return point;
          const anchors = getLineWorldAnchors(line, prev.scene);
          if (!anchors) return point;
          const pr = projectPointToLine(world, anchors.a, anchors.b);
          return { ...point, s: pr.s };
        }

        if (point.kind === "pointOnSegment") {
          const seg = prev.scene.segments.find((item) => item.id === point.segId);
          if (!seg) return point;
          const a = geoStoreHelpers.getPointWorldById(prev.scene, seg.aId);
          const b = geoStoreHelpers.getPointWorldById(prev.scene, seg.bId);
          if (!a || !b) return point;
          const pr = projectPointToSegment(world, a, b);
          return { ...point, u: pr.u };
        }

        if (point.kind === "pointOnCircle") {
          const circle = prev.scene.circles.find((item) => item.id === point.circleId);
          if (!circle) return point;
          const center = geoStoreHelpers.getPointWorldById(prev.scene, circle.centerId);
          const through = geoStoreHelpers.getPointWorldById(prev.scene, circle.throughId);
          if (!center || !through) return point;
          const r = Math.hypot(through.x - center.x, through.y - center.y);
          const pr = projectPointToCircle(world, center, r);
          return { ...point, t: pr.t };
        }

        return point;
      });
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: nextPoints,
        },
      };
    }, { history: "coalesce", actionKey: `movePointTo:${id}` });
  },

  movePointLabelBy(id, deltaPx) {
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === id
            ? {
                ...point,
                style: {
                  ...point.style,
                  labelOffsetPx: {
                    x: point.style.labelOffsetPx.x + deltaPx.x,
                    y: point.style.labelOffsetPx.y + deltaPx.y,
                  },
                },
              }
            : point
        ),
      },
    }), { history: "coalesce", actionKey: `movePointLabelBy:${id}` });
  },

  setPointDefaults(next) {
    setState((prev) => ({
      ...prev,
      pointDefaults: {
        ...prev.pointDefaults,
        ...next,
      },
    }));
  },

  updateSelectedPointStyle(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "point") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: prev.scene.points.map((point) =>
            point.id === prev.selectedObject!.id
              ? {
                  ...point,
                  style: {
                    ...point.style,
                    ...next,
                  },
                }
              : point
          ),
        },
      };
    });
  },

  updateSelectedPointFields(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "point") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: prev.scene.points.map((point) =>
            point.id === prev.selectedObject!.id
              ? {
                  ...point,
                  ...next,
                }
              : point
          ),
        },
      };
    });
  },

  updateSelectedSegmentStyle(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "segment") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          segments: prev.scene.segments.map((seg) =>
            seg.id === prev.selectedObject!.id ? { ...seg, style: { ...seg.style, ...next } } : seg
          ),
        },
      };
    });
  },

  updateSelectedLineStyle(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "line") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: prev.scene.lines.map((line) =>
            line.id === prev.selectedObject!.id ? { ...line, style: { ...line.style, ...next } } : line
          ),
        },
      };
    });
  },

  updateSelectedCircleStyle(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "circle") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          circles: prev.scene.circles.map((circle) =>
            circle.id === prev.selectedObject!.id ? { ...circle, style: { ...circle.style, ...next } } : circle
          ),
        },
      };
    });
  },

  updateSelectedSegmentFields(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "segment") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          segments: prev.scene.segments.map((seg) =>
            seg.id === prev.selectedObject!.id ? { ...seg, ...next } : seg
          ),
        },
      };
    });
  },

  updateSelectedLineFields(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "line") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: prev.scene.lines.map((line) =>
            line.id === prev.selectedObject!.id ? { ...line, ...next } : line
          ),
        },
      };
    });
  },

  updateSelectedCircleFields(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "circle") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          circles: prev.scene.circles.map((circle) =>
            circle.id === prev.selectedObject!.id ? { ...circle, ...next } : circle
          ),
        },
      };
    });
  },

  renameSelectedPoint(nextNameRaw) {
    const nextName = nextNameRaw.trim();
    if (!nextName) return { ok: false, error: "Name cannot be empty." };
    if (!isValidPointName(nextName)) {
      return { ok: false, error: "Name must match /^[A-Za-z][A-Za-z0-9_]*$/." };
    }

    let result: RenameResult = { ok: true, name: nextName };

    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "point") {
        result = { ok: false, error: "No point selected." };
        return prev;
      }

      const selected = prev.scene.points.find((point) => point.id === prev.selectedObject!.id);
      if (!selected) {
        result = { ok: false, error: "Selected point was not found." };
        return { ...prev, selectedObject: null };
      }

      const unique = isNameUnique(
        nextName,
        prev.scene.points.map((point) => point.name),
        selected.name
      );
      if (!unique) {
        result = { ok: false, error: `Point \"${nextName}\" already exists.` };
        return prev;
      }

      result = { ok: true, name: nextName };
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: prev.scene.points.map((point) =>
            point.id === selected.id ? { ...point, name: nextName } : point
          ),
        },
      };
    });

    return result;
  },

  deleteSelectedObject() {
    setState((prev) => {
      if (!prev.selectedObject) return prev;

      if (prev.selectedObject.type === "point") {
        const deletedPointId = prev.selectedObject.id;
        const keptSegments = prev.scene.segments.filter(
          (seg) => seg.aId !== deletedPointId && seg.bId !== deletedPointId
        );
        const directKeptLines = prev.scene.lines.filter((line) => !lineReferencesPoint(line, deletedPointId));
        const removedLineIds = new Set(
          prev.scene.lines.filter((line) => lineReferencesPoint(line, deletedPointId)).map((line) => line.id)
        );
        const keptLines = directKeptLines.filter((line) => {
          if (line.kind !== "perpendicular" && line.kind !== "parallel") return true;
          if (!line.base) return true;
          if (line.base.type === "line" && removedLineIds.has(line.base.id)) return false;
          return true;
        });
        const keptCircles = prev.scene.circles.filter(
          (circle) => circle.centerId !== deletedPointId && circle.throughId !== deletedPointId
        );
        const deletedCircleIds = new Set(
          prev.scene.circles
            .filter((circle) => circle.centerId === deletedPointId || circle.throughId === deletedPointId)
            .map((circle) => circle.id)
        );
        const deletedSegmentIds = new Set(
          prev.scene.segments
            .filter((seg) => seg.aId === deletedPointId || seg.bId === deletedPointId)
            .map((seg) => seg.id)
        );
        const nextPoints = prev.scene.points.filter((point) => {
          if (point.id === deletedPointId) return false;
          if (point.kind === "midpointPoints") {
            return point.aId !== deletedPointId && point.bId !== deletedPointId;
          }
          if (point.kind === "midpointSegment") {
            return !deletedSegmentIds.has(point.segId);
          }
          if (point.kind === "pointOnLine") {
            return keptLines.some((line) => line.id === point.lineId);
          }
          if (point.kind === "pointOnSegment") {
            return keptSegments.some((seg) => seg.id === point.segId);
          }
          if (point.kind === "pointOnCircle") {
            return !deletedCircleIds.has(point.circleId);
          }
          if (point.kind === "intersectionPoint") {
            return (
              objectRefAlive(point.objA, keptLines, keptSegments, keptCircles) &&
              objectRefAlive(point.objB, keptLines, keptSegments, keptCircles)
            );
          }
          if (point.kind === "circleLineIntersectionPoint") {
            return (
              keptLines.some((line) => line.id === point.lineId) &&
              keptCircles.some((circle) => circle.id === point.circleId)
            );
          }
          return true;
        });

        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: nextPoints,
            segments: keptSegments,
            lines: keptLines,
            circles: keptCircles,
          },
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle: isCopyStyleSourceAlive(prev.copyStyle.source, nextPoints, keptSegments, keptLines, keptCircles)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, circleStyle: null, showLabel: null },
        };
      }

      if (prev.selectedObject.type === "segment") {
        const segId = prev.selectedObject.id;
        const nextPoints = prev.scene.points.filter(
          (point) =>
            (point.kind !== "midpointSegment" || point.segId !== segId) &&
            (point.kind !== "pointOnSegment" || point.segId !== segId) &&
            (point.kind !== "intersectionPoint" ||
              (point.objA.type !== "segment" || point.objA.id !== segId) &&
                (point.objB.type !== "segment" || point.objB.id !== segId))
        );
        const keptSegments = prev.scene.segments.filter((seg) => seg.id !== segId);
        const keptLines = prev.scene.lines.filter((line) => {
          if ((line.kind === "perpendicular" || line.kind === "parallel") && line.base.type === "segment" && line.base.id === segId) {
            return false;
          }
          return true;
        });
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: keptSegments,
            lines: keptLines,
            points: nextPoints,
          },
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle: isCopyStyleSourceAlive(prev.copyStyle.source, nextPoints, keptSegments, keptLines, prev.scene.circles)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, circleStyle: null, showLabel: null },
        };
      }

      if (prev.selectedObject.type === "circle") {
        const circleId = prev.selectedObject.id;
        const nextCircles = prev.scene.circles.filter((circle) => circle.id !== circleId);
        const nextPoints = prev.scene.points.filter(
          (point) =>
            (point.kind !== "pointOnCircle" || point.circleId !== circleId) &&
            (point.kind !== "intersectionPoint" ||
              (point.objA.type !== "circle" || point.objA.id !== circleId) &&
                (point.objB.type !== "circle" || point.objB.id !== circleId)) &&
            (point.kind !== "circleLineIntersectionPoint" || point.circleId !== circleId)
        );
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: nextCircles,
            points: nextPoints,
          },
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle: isCopyStyleSourceAlive(prev.copyStyle.source, nextPoints, prev.scene.segments, prev.scene.lines, nextCircles)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, circleStyle: null, showLabel: null },
        };
      }

      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: prev.scene.lines.filter((line) => {
            if (line.id === prev.selectedObject!.id) return false;
            if (
              (line.kind === "perpendicular" || line.kind === "parallel") &&
              line.base.type === "line" &&
              line.base.id === prev.selectedObject!.id
            ) {
              return false;
            }
            return true;
          }),
          points: prev.scene.points.filter(
            (point) =>
              point.kind !== "pointOnLine" ||
              point.lineId !== prev.selectedObject!.id
          ).filter(
            (point) =>
              point.kind !== "intersectionPoint" ||
              (point.objA.type !== "line" || point.objA.id !== prev.selectedObject!.id) &&
                (point.objB.type !== "line" || point.objB.id !== prev.selectedObject!.id)
          ).filter(
            (point) =>
              point.kind !== "circleLineIntersectionPoint" || point.lineId !== prev.selectedObject!.id
          ),
        },
        selectedObject: null,
        recentCreatedObject: null,
        copyStyle:
          prev.copyStyle.source?.type === "line" && prev.copyStyle.source.id === prev.selectedObject.id
            ? { source: null, pointStyle: null, lineStyle: null, circleStyle: null, showLabel: null }
            : prev.copyStyle,
      };
    });
  },

  setCopyStyleSource(obj) {
    setState((prev) => {
      if (obj.type === "point") {
        const point = prev.scene.points.find((item) => item.id === obj.id);
        if (!point) return prev;
        return {
          ...prev,
          copyStyle: {
            source: obj,
            pointStyle: {
              ...point.style,
              labelOffsetPx: { ...point.style.labelOffsetPx },
            },
            lineStyle: null,
            circleStyle: null,
            showLabel: point.showLabel,
          },
        };
      }

      if (obj.type === "segment") {
        const segment = prev.scene.segments.find((item) => item.id === obj.id);
        if (!segment) return prev;
        return {
          ...prev,
          copyStyle: {
            source: obj,
            pointStyle: null,
            lineStyle: { ...segment.style },
            circleStyle: circleStyleFromLineStyle(segment.style),
            showLabel: null,
          },
        };
      }

      if (obj.type === "circle") {
        const circle = prev.scene.circles.find((item) => item.id === obj.id);
        if (!circle) return prev;
        return {
          ...prev,
          copyStyle: {
            source: obj,
            pointStyle: null,
            lineStyle: lineStyleFromCircleStyle(circle.style),
            circleStyle: { ...circle.style },
            showLabel: null,
          },
        };
      }

      const line = prev.scene.lines.find((item) => item.id === obj.id);
      if (!line) return prev;
      return {
        ...prev,
        copyStyle: {
          source: obj,
          pointStyle: null,
          lineStyle: { ...line.style },
          circleStyle: circleStyleFromLineStyle(line.style),
          showLabel: null,
        },
      };
    });
  },

  applyCopyStyleTo(obj) {
    setState((prev) => {
      if (obj.type === "point") {
        const sourcePointStyle =
          prev.copyStyle.pointStyle ??
          (prev.copyStyle.lineStyle ? pointStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
          (prev.copyStyle.circleStyle ? pointStyleFromCircleStyle(prev.copyStyle.circleStyle) : null);
        if (!sourcePointStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: prev.scene.points.map((point) =>
              point.id !== obj.id
                ? point
                : {
                    ...point,
                    showLabel: prev.copyStyle.showLabel ?? point.showLabel,
                    style: {
                      ...point.style,
                      ...sourcePointStyle,
                      labelOffsetPx: { ...point.style.labelOffsetPx },
                    },
                  }
            ),
          },
        };
      }

      if (obj.type === "segment") {
        const sourceLineStyle =
          prev.copyStyle.lineStyle ??
          (prev.copyStyle.circleStyle ? lineStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
          (prev.copyStyle.pointStyle ? lineStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
        if (!sourceLineStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: prev.scene.segments.map((segment) =>
              segment.id === obj.id ? { ...segment, style: { ...segment.style, ...sourceLineStyle } } : segment
            ),
          },
        };
      }

      if (obj.type === "circle") {
        const sourceCircleStyle =
          prev.copyStyle.circleStyle ??
          (prev.copyStyle.lineStyle ? circleStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
          (prev.copyStyle.pointStyle ? circleStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
        if (!sourceCircleStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: prev.scene.circles.map((circle) =>
              circle.id === obj.id ? { ...circle, style: { ...circle.style, ...sourceCircleStyle } } : circle
            ),
          },
        };
      }

      const sourceLineStyle =
        prev.copyStyle.lineStyle ??
        (prev.copyStyle.circleStyle ? lineStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
        (prev.copyStyle.pointStyle ? lineStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
      if (!sourceLineStyle) return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: prev.scene.lines.map((line) =>
            line.id === obj.id ? { ...line, style: { ...line.style, ...sourceLineStyle } } : line
          ),
        },
      };
    });
  },

  clearCopyStyle() {
    setState((prev) => ({
      ...prev,
      copyStyle: {
        source: null,
        pointStyle: null,
        lineStyle: null,
        circleStyle: null,
        showLabel: null,
      },
    }));
  },

  undo() {
    if (undoStack.length === 0) return;
    setState(
      (prev) => {
        const snapshot = undoStack.pop();
        if (!snapshot) return prev;
        redoStack.push(cloneHistorySnapshot(takeHistorySnapshot(prev)));
        if (redoStack.length > MAX_HISTORY) redoStack.shift();
        lastHistoryActionKey = null;
        isRestoringHistory = true;
        const restored = restoreFromSnapshot(prev, snapshot);
        isRestoringHistory = false;
        return restored;
      },
      { history: "skip" }
    );
  },

  redo() {
    if (redoStack.length === 0) return;
    setState(
      (prev) => {
        const snapshot = redoStack.pop();
        if (!snapshot) return prev;
        undoStack.push(cloneHistorySnapshot(takeHistorySnapshot(prev)));
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        lastHistoryActionKey = null;
        isRestoringHistory = true;
        const restored = restoreFromSnapshot(prev, snapshot);
        isRestoringHistory = false;
        return restored;
      },
      { history: "skip" }
    );
  },
};

function getStore(): GeoStore {
  return { ...state, ...actions };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGeoStore<T>(selector: (store: GeoStore) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getStore()), () => selector(getStore()));
}

export const geoStoreHelpers = {
  getPointWorldById(scene: SceneModel, pointId: string): Vec2 | null {
    const point = scene.points.find((p) => p.id === pointId);
    if (!point) return null;
    return getPointWorldPos(point, scene);
  },
  getLineWorldAnchorsById(scene: SceneModel, lineId: string): { a: Vec2; b: Vec2 } | null {
    const line = scene.lines.find((item) => item.id === lineId);
    if (!line) return null;
    return getLineWorldAnchors(line, scene);
  },
};

function isCopyStyleSourceAlive(
  source: SelectedObject,
  points: SceneModel["points"],
  segments: SceneModel["segments"],
  lines: SceneModel["lines"],
  circles: SceneModel["circles"]
): boolean {
  if (!source) return false;
  if (source.type === "point") return points.some((point) => point.id === source.id);
  if (source.type === "segment") return segments.some((segment) => segment.id === source.id);
  if (source.type === "circle") return circles.some((circle) => circle.id === source.id);
  return lines.some((line) => line.id === source.id);
}

function objectRefAlive(
  obj: GeometryObjectRef,
  lines: SceneModel["lines"],
  segments: SceneModel["segments"],
  circles: SceneModel["circles"]
): boolean {
  if (obj.type === "line") return lines.some((line) => line.id === obj.id);
  if (obj.type === "segment") return segments.some((segment) => segment.id === obj.id);
  return circles.some((circle) => circle.id === obj.id);
}

function circleStyleFromLineStyle(style: LineStyle): CircleStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: style.dash,
    strokeOpacity: style.opacity,
  };
}

function lineStyleFromCircleStyle(style: CircleStyle): LineStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: style.strokeDash,
    opacity: style.strokeOpacity,
  };
}

function lineStyleFromPointStyle(style: PointStyle): LineStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: "solid",
    opacity: style.strokeOpacity,
  };
}

function circleStyleFromPointStyle(style: PointStyle): CircleStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: "solid",
    strokeOpacity: style.strokeOpacity,
  };
}

function pointStyleFromLineStyle(style: LineStyle): Partial<PointStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.opacity,
    fillColor: style.strokeColor,
    fillOpacity: style.opacity,
  };
}

function pointStyleFromCircleStyle(style: CircleStyle): Partial<PointStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor ?? style.strokeColor,
    fillOpacity: style.fillOpacity ?? style.strokeOpacity,
  };
}

function getLineCircleRefs(
  objA: GeometryObjectRef,
  objB: GeometryObjectRef
): { lineId: string; circleId: string } | null {
  if (objA.type === "line" && objB.type === "circle") {
    return { lineId: objA.id, circleId: objB.id };
  }
  if (objA.type === "circle" && objB.type === "line") {
    return { lineId: objB.id, circleId: objA.id };
  }
  return null;
}

function createStableLineCircleIntersectionPoint(
  id: string,
  lineId: string,
  circleId: string,
  preferredWorld: Vec2,
  state: GeoState
): ScenePoint | null {
  const line = state.scene.lines.find((item) => item.id === lineId);
  const circle = state.scene.circles.find((item) => item.id === circleId);
  if (!line || !circle) return null;

  const anchors = getLineWorldAnchors(line, state.scene);
  const a = anchors?.a ?? null;
  const b = anchors?.b ?? null;
  const center = geoStoreHelpers.getPointWorldById(state.scene, circle.centerId);
  const through = geoStoreHelpers.getPointWorldById(state.scene, circle.throughId);
  if (!a || !b || !center || !through) return null;

  const radius = distance(center, through);
  const branches = lineCircleIntersectionBranches(a, b, center, radius);
  if (branches.length === 0) return null;

  let branchIndex: 0 | 1 = 0;
  if (branches.length >= 2) {
    const d0 = distance(branches[0].point, preferredWorld);
    const d1 = distance(branches[1].point, preferredWorld);
    branchIndex = d1 < d0 ? 1 : 0;
  }

  // Keep user intent: choose the branch nearest to click location without
  // auto-flipping to the other root based on existing points.

  let excludePointId: string | undefined;
  const endpointCandidates: Array<{ id: string; world: Vec2 }> = [];
  const aOnCircle = Math.abs(distance(a, center) - radius) <= 1e-6;
  const bOnCircle = Math.abs(distance(b, center) - radius) <= 1e-6;
  const endpointIds = getLineEndpointPointIds(line);
  if (aOnCircle && endpointIds[0]) endpointCandidates.push({ id: endpointIds[0], world: a });
  if (bOnCircle && endpointIds[1]) endpointCandidates.push({ id: endpointIds[1], world: b });

  if (branches.length >= 2 && endpointCandidates.length === 1) {
    const endpoint = endpointCandidates[0];
    const chosen = branches[branchIndex].point;
    const other = branches[branchIndex === 0 ? 1 : 0].point;
    const ROOT_EPS = 1e-6;
    // If user picked the non-endpoint branch, stabilize by explicitly excluding endpoint intersection.
    if (distance(chosen, endpoint.world) > ROOT_EPS && distance(other, endpoint.world) <= ROOT_EPS) {
      excludePointId = endpoint.id;
    }
  }

  const used = new Set(state.scene.points.map((point) => point.name));
  let idx = 0;
  let name = nextLabelFromIndex(idx);
  while (used.has(name)) {
    idx += 1;
    name = nextLabelFromIndex(idx);
  }

  return {
    id,
    kind: "circleLineIntersectionPoint",
    name,
    captionTex: name,
    visible: true,
    showLabel: "name" as ShowLabelMode,
    locked: true,
    auxiliary: true,
    circleId,
    lineId,
    branchIndex,
    excludePointId,
    style: {
      ...state.pointDefaults,
      labelOffsetPx: { ...state.pointDefaults.labelOffsetPx },
    },
  };
}

function isSameSelectedObject(a: SelectedObject, b: SelectedObject): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id;
}

function isSameHoveredHit(a: HoveredHit, b: HoveredHit): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id;
}

function isSameWorld(a: Vec2 | null, b: Vec2 | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

function findExistingIntersectionPointId(
  state: GeoState,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  preferredWorld: Vec2
): string | null {
  const EPS = 1e-6;
  const lineCircle = getLineCircleRefs(objA, objB);

  if (lineCircle) {
    const target = resolveLineCircleTarget(state, lineCircle.lineId, lineCircle.circleId, preferredWorld);
    if (target) {
      const ROOT_EPS = 1e-5;
      for (const point of state.scene.points) {
        if (point.kind !== "circleLineIntersectionPoint") continue;
        if (point.lineId !== lineCircle.lineId || point.circleId !== lineCircle.circleId) continue;
        const world = getPointWorldPos(point, state.scene);
        if (world && distance(world, target.world) <= ROOT_EPS) return point.id;
        if (target.excludePointId && point.excludePointId === target.excludePointId) return point.id;
      }
    }
  }

  for (const point of state.scene.points) {
    const world = getPointWorldPos(point, state.scene);
    if (!world) continue;
    if (distance(world, preferredWorld) > EPS) continue;

    if (lineCircle && point.kind === "circleLineIntersectionPoint") {
      if (point.lineId === lineCircle.lineId && point.circleId === lineCircle.circleId) {
        return point.id;
      }
      continue;
    }

    if (point.kind === "intersectionPoint" && sameObjectPair(point.objA, point.objB, objA, objB)) {
      return point.id;
    }
  }
  return null;
}

function resolveLineCircleTarget(
  state: GeoState,
  lineId: string,
  circleId: string,
  preferredWorld: Vec2
): { world: Vec2; excludePointId?: string } | null {
  const line = state.scene.lines.find((item) => item.id === lineId);
  const circle = state.scene.circles.find((item) => item.id === circleId);
  if (!line || !circle) return null;

  const anchors = getLineWorldAnchors(line, state.scene);
  const a = anchors?.a ?? null;
  const b = anchors?.b ?? null;
  const center = geoStoreHelpers.getPointWorldById(state.scene, circle.centerId);
  const through = geoStoreHelpers.getPointWorldById(state.scene, circle.throughId);
  if (!a || !b || !center || !through) return null;

  const radius = distance(center, through);
  const branches = lineCircleIntersectionBranches(a, b, center, radius);
  if (branches.length === 0) return null;

  if (branches.length === 1) return { world: branches[0].point };

  const d0 = distance(branches[0].point, preferredWorld);
  const d1 = distance(branches[1].point, preferredWorld);
  const branchIndex: 0 | 1 = d1 < d0 ? 1 : 0;
  const chosen = branches[branchIndex].point;
  const other = branches[branchIndex === 0 ? 1 : 0].point;

  const endpointCandidates: Array<{ id: string; world: Vec2 }> = [];
  const aOnCircle = Math.abs(distance(a, center) - radius) <= 1e-6;
  const bOnCircle = Math.abs(distance(b, center) - radius) <= 1e-6;
  const endpointIds = getLineEndpointPointIds(line);
  if (aOnCircle && endpointIds[0]) endpointCandidates.push({ id: endpointIds[0], world: a });
  if (bOnCircle && endpointIds[1]) endpointCandidates.push({ id: endpointIds[1], world: b });

  let excludePointId: string | undefined;
  if (endpointCandidates.length === 1) {
    const endpoint = endpointCandidates[0];
    const ROOT_EPS = 1e-6;
    if (distance(chosen, endpoint.world) > ROOT_EPS && distance(other, endpoint.world) <= ROOT_EPS) {
      excludePointId = endpoint.id;
    }
  }

  return { world: chosen, excludePointId };
}

function sameObjectPair(
  a1: GeometryObjectRef,
  b1: GeometryObjectRef,
  a2: GeometryObjectRef,
  b2: GeometryObjectRef
): boolean {
  return (sameObjectRef(a1, a2) && sameObjectRef(b1, b2)) || (sameObjectRef(a1, b2) && sameObjectRef(b1, a2));
}

function sameObjectRef(a: GeometryObjectRef, b: GeometryObjectRef): boolean {
  return a.type === b.type && a.id === b.id;
}

function getLineEndpointPointIds(line: SceneModel["lines"][number]): [string | null, string | null] {
  if (line.kind === "perpendicular" || line.kind === "parallel") return [line.throughId, null];
  return [line.aId, line.bId];
}

function lineReferencesPoint(line: SceneModel["lines"][number], pointId: string): boolean {
  if (line.kind === "perpendicular" || line.kind === "parallel") return line.throughId === pointId;
  return line.aId === pointId || line.bId === pointId;
}

function takeHistorySnapshot(prev: GeoState): HistorySnapshot {
  return {
    activeTool: prev.activeTool,
    scene: prev.scene,
    selectedObject: prev.selectedObject,
    recentCreatedObject: prev.recentCreatedObject,
    nextPointId: prev.nextPointId,
    nextSegmentId: prev.nextSegmentId,
    nextLineId: prev.nextLineId,
    nextCircleId: prev.nextCircleId,
    pointDefaults: prev.pointDefaults,
    segmentDefaults: prev.segmentDefaults,
    lineDefaults: prev.lineDefaults,
    circleDefaults: prev.circleDefaults,
    copyStyle: prev.copyStyle,
  };
}

function cloneHistorySnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return structuredClone(snapshot);
}

function hasHistoryDiff(prev: GeoState, next: GeoState): boolean {
  return (
    prev.scene !== next.scene ||
    prev.nextPointId !== next.nextPointId ||
    prev.nextSegmentId !== next.nextSegmentId ||
    prev.nextLineId !== next.nextLineId ||
    prev.nextCircleId !== next.nextCircleId ||
    prev.pointDefaults !== next.pointDefaults ||
    prev.segmentDefaults !== next.segmentDefaults ||
    prev.lineDefaults !== next.lineDefaults ||
    prev.circleDefaults !== next.circleDefaults
  );
}

function restoreFromSnapshot(prev: GeoState, snapshot: HistorySnapshot): GeoState {
  return {
    ...prev,
    activeTool: snapshot.activeTool,
    scene: snapshot.scene,
    selectedObject: snapshot.selectedObject,
    recentCreatedObject: snapshot.recentCreatedObject,
    pendingSelection: null,
    hoveredHit: null,
    cursorWorld: null,
    nextPointId: snapshot.nextPointId,
    nextSegmentId: snapshot.nextSegmentId,
    nextLineId: snapshot.nextLineId,
    nextCircleId: snapshot.nextCircleId,
    pointDefaults: snapshot.pointDefaults,
    segmentDefaults: snapshot.segmentDefaults,
    lineDefaults: snapshot.lineDefaults,
    circleDefaults: snapshot.circleDefaults,
    copyStyle: snapshot.copyStyle,
  };
}
