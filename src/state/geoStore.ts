import { useSyncExternalStore } from "react";
import type { Vec2 } from "../geo/vec2";
import {
  type AngleStyle,
  computeOrientedAngleRad,
  type CircleStyle,
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getNumberValue,
  type LineLikeObjectRef,
  getLineWorldAnchors,
  getPointWorldPos,
  isNameUnique,
  isValidPointName,
  nextLabelFromIndex,
  type GeometryObjectRef,
  type LineStyle,
  type SceneNumberDefinition,
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
  | "parallel_line"
  | "angle"
  | "angle_fixed";

export type SelectedObject =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line"; id: string }
  | { type: "circle"; id: string }
  | { type: "angle"; id: string }
  | { type: "number"; id: string }
  | null;

export type HoveredHit =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line2p"; id: string }
  | { type: "circle"; id: string }
  | { type: "angle"; id: string }
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
  | {
      tool: "angle";
      step: 2;
      first: { type: "point"; id: string };
    }
  | {
      tool: "angle";
      step: 3;
      first: { type: "point"; id: string };
      second: { type: "point"; id: string };
    }
  | {
      tool: "angle_fixed";
      step: 2;
      first: { type: "point"; id: string };
    }
  | {
      tool: "angle_fixed";
      step: 3;
      first: { type: "point"; id: string };
      second: { type: "point"; id: string };
    }
  | null;

export type AngleFixedDirection = "CCW" | "CW";

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
  nextAngleId: number;
  nextNumberId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  angleDefaults: AngleStyle;
  angleFixedTool: {
    angleExpr: string;
    direction: AngleFixedDirection;
  };
  copyStyle: {
    source: SelectedObject;
    pointStyle: PointStyle | null;
    lineStyle: LineStyle | null;
    circleStyle: CircleStyle | null;
    angleStyle: Partial<AngleStyle> | null;
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
  createAngle: (aId: string, bId: string, cId: string) => string | null;
  createAngleFixed: (
    vertexId: string,
    basePointId: string,
    angleExpr: string,
    direction: AngleFixedDirection
  ) => { pointId: string; lineId: string; angleId: string } | null;
  createCircle: (centerId: string, throughId: string) => string | null;
  createPointOnLine: (lineId: string, s: number) => string | null;
  createPointOnSegment: (segId: string, u: number) => string | null;
  createPointOnCircle: (circleId: string, t: number) => string | null;
  createIntersectionPoint: (objA: GeometryObjectRef, objB: GeometryObjectRef, preferredWorld: Vec2) => string | null;
  createNumber: (definition: SceneNumberDefinition, preferredName?: string) => string | null;

  movePointTo: (id: string, world: Vec2) => void;
  movePointLabelBy: (id: string, deltaPx: Vec2) => void;
  moveAngleLabelTo: (id: string, world: Vec2) => void;

  setPointDefaults: (next: Partial<PointStyle>) => void;
  setSegmentDefaults: (next: Partial<LineStyle>) => void;
  setLineDefaults: (next: Partial<LineStyle>) => void;
  setCircleDefaults: (next: Partial<CircleStyle>) => void;
  setAngleDefaults: (next: Partial<AngleStyle>) => void;
  setAngleFixedTool: (next: Partial<GeoState["angleFixedTool"]>) => void;
  updateSelectedPointStyle: (next: Partial<PointStyle>) => void;
  updateSelectedPointFields: (
    next: Partial<Pick<ScenePoint, "captionTex" | "visible" | "showLabel" | "locked" | "auxiliary">>
  ) => void;
  updateSelectedSegmentStyle: (next: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (next: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (next: Partial<CircleStyle>) => void;
  updateSelectedAngleStyle: (next: Partial<AngleStyle>) => void;
  updateSelectedSegmentFields: (next: Partial<Pick<SceneModel["segments"][number], "visible" | "showLabel">>) => void;
  updateSelectedLineFields: (next: Partial<Pick<SceneModel["lines"][number], "visible">>) => void;
  updateSelectedCircleFields: (next: Partial<Pick<SceneModel["circles"][number], "visible">>) => void;
  updateSelectedAngleFields: (next: Partial<Pick<SceneModel["angles"][number], "visible">>) => void;

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

const defaultAngleStyle: AngleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.8,
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 16,
  fillEnabled: false,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
  markStyle: "arc",
  arcRadius: 1.2,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: true,
  showValue: true,
};

const initialState: GeoState = {
  camera: { pos: { x: 0, y: 0 }, zoom: 80 },
  activeTool: "move",
  scene: {
    points: [],
    segments: [],
    lines: [],
    circles: [],
    angles: [],
    numbers: [],
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
  nextAngleId: 1,
  nextNumberId: 1,
  pointDefaults: defaultPointStyle,
  segmentDefaults: defaultSegStyle,
  lineDefaults: defaultLineStyle,
  circleDefaults: defaultCircleStyle,
  angleDefaults: defaultAngleStyle,
  angleFixedTool: {
    angleExpr: "30",
    direction: "CCW",
  },
  copyStyle: {
    source: null,
    pointStyle: null,
    lineStyle: null,
    circleStyle: null,
    angleStyle: null,
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
  nextAngleId: number;
  nextNumberId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  angleDefaults: AngleStyle;
  angleFixedTool: GeoState["angleFixedTool"];
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
  if (next.scene !== prev.scene) {
    const normalizedScene = normalizeSceneIntegrity(next.scene);
    if (normalizedScene !== next.scene) {
      next = { ...next, scene: normalizedScene };
    }
  }

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
              angleStyle: null,
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

  createAngle(aId, bId, cId) {
    if (aId === bId || bId === cId || aId === cId) return null;
    let id: string | null = null;
    setState((prev) => {
      const pa = prev.scene.points.find((p) => p.id === aId);
      const pb = prev.scene.points.find((p) => p.id === bId);
      const pc = prev.scene.points.find((p) => p.id === cId);
      if (!pa || !pb || !pc) return prev;
      const wa = getPointWorldPos(pa, prev.scene);
      const wb = getPointWorldPos(pb, prev.scene);
      const wc = getPointWorldPos(pc, prev.scene);
      if (!wa || !wb || !wc) return prev;
      const theta = computeOrientedAngleRad(wa, wb, wc);
      if (theta === null) return prev;
      const start = Math.atan2(wa.y - wb.y, wa.x - wb.x);
      const mid = start + theta * 0.5;
      const dir = { x: Math.cos(mid), y: Math.sin(mid) };
      const labelDist = Math.max(0.45, prev.angleDefaults.arcRadius * 1.25);
      const labelPosWorld = { x: wb.x + dir.x * labelDist, y: wb.y + dir.y * labelDist };

      id = `a_${prev.nextAngleId}`;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          angles: [
            ...prev.scene.angles,
            {
              id,
              aId,
              bId,
              cId,
              visible: true,
              style: {
                ...prev.angleDefaults,
                labelPosWorld,
              },
            },
          ],
        },
        selectedObject: { type: "angle", id },
        recentCreatedObject: { type: "angle", id },
        nextAngleId: prev.nextAngleId + 1,
      };
    });
    return id;
  },

  createAngleFixed(vertexId, basePointId, angleExpr, direction) {
    if (vertexId === basePointId) return null;
    const expr = angleExpr.trim();
    if (!expr) return null;
    let result: { pointId: string; lineId: string; angleId: string } | null = null;
    setState((prev) => {
      const pv = prev.scene.points.find((p) => p.id === vertexId);
      const pa = prev.scene.points.find((p) => p.id === basePointId);
      if (!pv || !pa) return prev;
      const wv = getPointWorldPos(pv, prev.scene);
      const wa = getPointWorldPos(pa, prev.scene);
      if (!wv || !wa) return prev;
      if (distance(wv, wa) <= 1e-12) return prev;
      const evalResult = evaluateAngleExpressionDegrees(prev.scene, expr);
      if (!evalResult.ok) return prev;

      const used = new Set(prev.scene.points.map((point) => point.name));
      let idx = 0;
      let name = nextLabelFromIndex(idx);
      while (used.has(name)) {
        idx += 1;
        name = nextLabelFromIndex(idx);
      }

      const pointId = `p_${prev.nextPointId}`;
      const lineId = `l_${prev.nextLineId}`;
      const angleId = `a_${prev.nextAngleId}`;

      const base = { x: wa.x - wv.x, y: wa.y - wv.y };
      const sign = direction === "CCW" ? 1 : -1;
      const theta = (evalResult.valueDeg * Math.PI) / 180;
      const c = Math.cos(sign * theta);
      const s = Math.sin(sign * theta);
      const rot = { x: base.x * c - base.y * s, y: base.x * s + base.y * c };
      const wc = { x: wv.x + rot.x, y: wv.y + rot.y };
      const oriented = computeOrientedAngleRad(wa, wv, wc);
      if (oriented === null) return prev;
      const start = Math.atan2(wa.y - wv.y, wa.x - wv.x);
      const mid = start + oriented * 0.5;
      const labelDist = Math.max(0.45, prev.angleDefaults.arcRadius * 1.25);
      const labelPosWorld = { x: wv.x + Math.cos(mid) * labelDist, y: wv.y + Math.sin(mid) * labelDist };

      result = { pointId, lineId, angleId };
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id: pointId,
              kind: "pointByRotation",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name",
              locked: false,
              auxiliary: false,
              centerId: vertexId,
              pointId: basePointId,
              angleDeg: evalResult.valueDeg,
              angleExpr: expr,
              direction,
              radiusMode: "keep",
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
          lines: [
            ...prev.scene.lines,
            {
              id: lineId,
              kind: "twoPoint",
              aId: vertexId,
              bId: pointId,
              visible: true,
              style: { ...prev.lineDefaults },
            },
          ],
          angles: [
            ...prev.scene.angles,
            {
              id: angleId,
              aId: basePointId,
              bId: vertexId,
              cId: pointId,
              visible: true,
              style: {
                ...prev.angleDefaults,
                labelPosWorld,
              },
            },
          ],
        },
        selectedObject: { type: "angle", id: angleId },
        recentCreatedObject: { type: "angle", id: angleId },
        nextPointId: prev.nextPointId + 1,
        nextLineId: prev.nextLineId + 1,
        nextAngleId: prev.nextAngleId + 1,
      };
    });
    return result;
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

  createNumber(definition, preferredName) {
    let createdId: string | null = null;
    setState((prev) => {
      if (!isValidNumberDefinition(definition, prev.scene)) return prev;
      const usedNames = new Set(prev.scene.numbers.map((n) => n.name));
      let name = preferredName?.trim() || `n_${prev.nextNumberId}`;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) name = `n_${prev.nextNumberId}`;
      let suffix = 1;
      while (usedNames.has(name)) {
        name = `${name}_${suffix}`;
        suffix += 1;
      }
      const id = `n_${prev.nextNumberId}`;
      createdId = id;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          numbers: [
            ...prev.scene.numbers,
            {
              id,
              name,
              visible: true,
              definition,
            },
          ],
        },
        selectedObject: { type: "number", id },
        recentCreatedObject: { type: "number", id },
        nextNumberId: prev.nextNumberId + 1,
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

  moveAngleLabelTo(id, world) {
    setState(
      (prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          angles: prev.scene.angles.map((angle) =>
            angle.id === id
              ? {
                  ...angle,
                  style: {
                    ...angle.style,
                    labelPosWorld: { x: world.x, y: world.y },
                  },
                }
              : angle
          ),
        },
      }),
      { history: "coalesce", actionKey: `moveAngleLabelTo:${id}` }
    );
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

  setSegmentDefaults(next) {
    setState((prev) => ({
      ...prev,
      segmentDefaults: {
        ...prev.segmentDefaults,
        ...next,
      },
    }));
  },

  setLineDefaults(next) {
    setState((prev) => ({
      ...prev,
      lineDefaults: {
        ...prev.lineDefaults,
        ...next,
      },
    }));
  },

  setCircleDefaults(next) {
    setState((prev) => ({
      ...prev,
      circleDefaults: {
        ...prev.circleDefaults,
        ...next,
      },
    }));
  },

  setAngleDefaults(next) {
    setState((prev) => ({
      ...prev,
      angleDefaults: {
        ...prev.angleDefaults,
        ...next,
      },
    }));
  },

  setAngleFixedTool(next) {
    setState((prev) => ({
      ...prev,
      angleFixedTool: {
        ...prev.angleFixedTool,
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

  updateSelectedAngleStyle(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "angle") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          angles: prev.scene.angles.map((angle) =>
            angle.id === prev.selectedObject!.id ? { ...angle, style: { ...angle.style, ...next } } : angle
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

  updateSelectedAngleFields(next) {
    setState((prev) => {
      if (!prev.selectedObject || prev.selectedObject.type !== "angle") return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          angles: prev.scene.angles.map((angle) =>
            angle.id === prev.selectedObject!.id ? { ...angle, ...next } : angle
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
          if (point.kind === "pointByRotation") {
            return point.centerId !== deletedPointId && point.pointId !== deletedPointId;
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
        const nextAngles = prev.scene.angles.filter(
          (angle) => angle.aId !== deletedPointId && angle.bId !== deletedPointId && angle.cId !== deletedPointId
        );

        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: nextPoints,
            segments: keptSegments,
            lines: keptLines,
            circles: keptCircles,
            angles: nextAngles,
          },
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle: isCopyStyleSourceAlive(prev.copyStyle.source, nextPoints, keptSegments, keptLines, keptCircles, nextAngles)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, circleStyle: null, angleStyle: null, showLabel: null },
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
          copyStyle: isCopyStyleSourceAlive(
            prev.copyStyle.source,
            nextPoints,
            keptSegments,
            keptLines,
            prev.scene.circles,
            prev.scene.angles
          )
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, circleStyle: null, angleStyle: null, showLabel: null },
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
          copyStyle: isCopyStyleSourceAlive(
            prev.copyStyle.source,
            nextPoints,
            prev.scene.segments,
            prev.scene.lines,
            nextCircles,
            prev.scene.angles
          )
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, circleStyle: null, angleStyle: null, showLabel: null },
        };
      }

      if (prev.selectedObject.type === "angle") {
        const keptAngles = prev.scene.angles.filter((angle) => angle.id !== prev.selectedObject!.id);
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles: keptAngles,
          },
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle:
            prev.copyStyle.source?.type === "angle" && prev.copyStyle.source.id === prev.selectedObject.id
              ? { source: null, pointStyle: null, lineStyle: null, circleStyle: null, angleStyle: null, showLabel: null }
              : prev.copyStyle,
        };
      }

      if (prev.selectedObject.type === "number") {
        const deletedId = prev.selectedObject.id;
        const keptNumbers = prev.scene.numbers.filter((num) => num.id !== deletedId);
        const keptSet = new Set(keptNumbers.map((num) => num.id));
        const filteredNumbers = keptNumbers.filter((num) => {
          if (num.definition.kind !== "ratio") return true;
          return keptSet.has(num.definition.numeratorId) && keptSet.has(num.definition.denominatorId);
        });
        return {
          ...prev,
          scene: {
            ...prev.scene,
            numbers: filteredNumbers,
          },
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle:
            prev.copyStyle.source?.type === "number" && prev.copyStyle.source.id === prev.selectedObject.id
              ? { source: null, pointStyle: null, lineStyle: null, circleStyle: null, angleStyle: null, showLabel: null }
              : prev.copyStyle,
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
            ? { source: null, pointStyle: null, lineStyle: null, circleStyle: null, angleStyle: null, showLabel: null }
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
            angleStyle: null,
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
            angleStyle: angleStyleFromLineStyle(segment.style),
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
            angleStyle: angleStyleFromCircleStyle(circle.style),
            showLabel: null,
          },
        };
      }

      if (obj.type === "angle") {
        const angle = prev.scene.angles.find((item) => item.id === obj.id);
        if (!angle) return prev;
        return {
          ...prev,
          copyStyle: {
            source: obj,
            pointStyle: null,
            lineStyle: {
              strokeColor: angle.style.strokeColor,
              strokeWidth: angle.style.strokeWidth,
              dash: "solid",
              opacity: angle.style.strokeOpacity,
            },
            circleStyle: {
              strokeColor: angle.style.strokeColor,
              strokeWidth: angle.style.strokeWidth,
              strokeDash: "solid",
              strokeOpacity: angle.style.strokeOpacity,
              fillColor: angle.style.fillColor,
              fillOpacity: angle.style.fillOpacity,
            },
            angleStyle: {
              ...angle.style,
              labelPosWorld: { ...angle.style.labelPosWorld },
            },
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
          angleStyle: angleStyleFromLineStyle(line.style),
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

      if (obj.type === "angle") {
        const sourceAngleStyle =
          prev.copyStyle.angleStyle ??
          (prev.copyStyle.lineStyle ? angleStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
          (prev.copyStyle.circleStyle ? angleStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
          (prev.copyStyle.pointStyle ? angleStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
        if (!sourceAngleStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles: prev.scene.angles.map((angle) =>
              angle.id === obj.id
                ? {
                    ...angle,
                    style: {
                      ...angle.style,
                      ...sourceAngleStyle,
                      labelPosWorld: { ...angle.style.labelPosWorld },
                    },
                  }
                : angle
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
        angleStyle: null,
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
  getNumberValueById(scene: SceneModel, numberId: string): number | null {
    return getNumberValue(numberId, scene);
  },
};

function isCopyStyleSourceAlive(
  source: SelectedObject,
  points: SceneModel["points"],
  segments: SceneModel["segments"],
  lines: SceneModel["lines"],
  circles: SceneModel["circles"],
  angles: SceneModel["angles"],
  numbers: SceneModel["numbers"] = []
): boolean {
  if (!source) return false;
  if (source.type === "point") return points.some((point) => point.id === source.id);
  if (source.type === "segment") return segments.some((segment) => segment.id === source.id);
  if (source.type === "circle") return circles.some((circle) => circle.id === source.id);
  if (source.type === "angle") return angles.some((angle) => angle.id === source.id);
  if (source.type === "number") return numbers.some((num) => num.id === source.id);
  return lines.some((line) => line.id === source.id);
}

function isValidNumberDefinition(def: SceneNumberDefinition, scene: SceneModel): boolean {
  if (def.kind === "constant") return Number.isFinite(def.value);
  if (def.kind === "distancePoints") {
    return scene.points.some((p) => p.id === def.aId) && scene.points.some((p) => p.id === def.bId);
  }
  if (def.kind === "segmentLength") {
    return scene.segments.some((s) => s.id === def.segId);
  }
  if (def.kind === "circleRadius" || def.kind === "circleArea") {
    return scene.circles.some((c) => c.id === def.circleId);
  }
  if (def.kind === "angleDegrees") {
    return scene.angles.some((a) => a.id === def.angleId);
  }
  if (def.kind === "expression") {
    return evaluateNumberExpression(scene, def.expr).ok;
  }
  return (
    scene.numbers.some((n) => n.id === def.numeratorId) &&
    scene.numbers.some((n) => n.id === def.denominatorId) &&
    def.numeratorId !== def.denominatorId
  );
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

function angleStyleFromLineStyle(style: LineStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.opacity,
  };
}

function angleStyleFromCircleStyle(style: CircleStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor ?? style.strokeColor,
    fillOpacity: style.fillOpacity ?? style.strokeOpacity,
  };
}

function angleStyleFromPointStyle(style: PointStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    textColor: style.labelColor,
    textSize: style.labelFontPx,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
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
    nextAngleId: prev.nextAngleId,
    nextNumberId: prev.nextNumberId,
    pointDefaults: prev.pointDefaults,
    segmentDefaults: prev.segmentDefaults,
    lineDefaults: prev.lineDefaults,
    circleDefaults: prev.circleDefaults,
    angleDefaults: prev.angleDefaults,
    angleFixedTool: prev.angleFixedTool,
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
    prev.nextAngleId !== next.nextAngleId ||
    prev.nextNumberId !== next.nextNumberId ||
    prev.pointDefaults !== next.pointDefaults ||
    prev.segmentDefaults !== next.segmentDefaults ||
    prev.lineDefaults !== next.lineDefaults ||
    prev.circleDefaults !== next.circleDefaults ||
    prev.angleDefaults !== next.angleDefaults
  );
}

function restoreFromSnapshot(prev: GeoState, snapshot: HistorySnapshot): GeoState {
  const normalizedScene = normalizeSceneIntegrity(snapshot.scene);
  return {
    ...prev,
    activeTool: snapshot.activeTool,
    scene: normalizedScene,
    selectedObject: snapshot.selectedObject,
    recentCreatedObject: snapshot.recentCreatedObject,
    pendingSelection: null,
    hoveredHit: null,
    cursorWorld: null,
    nextPointId: snapshot.nextPointId,
    nextSegmentId: snapshot.nextSegmentId,
    nextLineId: snapshot.nextLineId,
    nextCircleId: snapshot.nextCircleId,
    nextAngleId: snapshot.nextAngleId,
    nextNumberId: snapshot.nextNumberId,
    pointDefaults: snapshot.pointDefaults,
    segmentDefaults: snapshot.segmentDefaults,
    lineDefaults: snapshot.lineDefaults,
    circleDefaults: snapshot.circleDefaults,
    angleDefaults: snapshot.angleDefaults,
    angleFixedTool: snapshot.angleFixedTool,
    copyStyle: snapshot.copyStyle,
  };
}

function normalizeSceneIntegrity(scene: SceneModel): SceneModel {
  let points = scene.points;
  let segments = scene.segments;
  let lines = scene.lines;
  let circles = scene.circles;
  let angles = scene.angles;
  let numbers = scene.numbers;
  let changed = false;

  const sameIds = (a: Array<{ id: string }>, b: Array<{ id: string }>) =>
    a.length === b.length && a.every((item, idx) => item.id === b[idx].id);

  for (let pass = 0; pass < 6; pass += 1) {
    const pointIds = new Set(points.map((p) => p.id));

    const nextSegments = segments.filter((seg) => pointIds.has(seg.aId) && pointIds.has(seg.bId));
    const nextCircles = circles.filter((circle) => pointIds.has(circle.centerId) && pointIds.has(circle.throughId));
    const nextAngles = angles.filter((angle) => pointIds.has(angle.aId) && pointIds.has(angle.bId) && pointIds.has(angle.cId));

    const nextSegmentIds = new Set(nextSegments.map((s) => s.id));
    const nextLineIds = new Set(lines.map((l) => l.id));
    const nextCircleIds = new Set(nextCircles.map((c) => c.id));

    const nextLines = lines.filter((line) => {
      if (line.kind === "perpendicular" || line.kind === "parallel") {
        if (!pointIds.has(line.throughId)) return false;
        if (line.base.type === "segment") return nextSegmentIds.has(line.base.id);
        return nextLineIds.has(line.base.id);
      }
      return pointIds.has(line.aId) && pointIds.has(line.bId);
    });

    const nextLineIdsAfter = new Set(nextLines.map((l) => l.id));

    const nextPoints = points
      .map((point) => {
        if (point.kind === "circleLineIntersectionPoint" && point.excludePointId && !pointIds.has(point.excludePointId)) {
          return { ...point, excludePointId: undefined };
        }
        if (point.kind === "intersectionPoint" && point.excludePointId && !pointIds.has(point.excludePointId)) {
          return { ...point, excludePointId: undefined };
        }
        return point;
      })
      .filter((point) => {
        if (point.kind === "free") return true;
        if (point.kind === "midpointPoints") return pointIds.has(point.aId) && pointIds.has(point.bId);
        if (point.kind === "midpointSegment") return nextSegmentIds.has(point.segId);
        if (point.kind === "pointOnLine") return nextLineIdsAfter.has(point.lineId);
        if (point.kind === "pointOnSegment") return nextSegmentIds.has(point.segId);
        if (point.kind === "pointOnCircle") return nextCircleIds.has(point.circleId);
        if (point.kind === "pointByRotation") return pointIds.has(point.centerId) && pointIds.has(point.pointId);
        if (point.kind === "circleLineIntersectionPoint") {
          return nextCircleIds.has(point.circleId) && nextLineIdsAfter.has(point.lineId);
        }
        if (point.kind === "intersectionPoint") {
          return objectRefAlive(point.objA, nextLines, nextSegments, nextCircles) && objectRefAlive(point.objB, nextLines, nextSegments, nextCircles);
        }
        return true;
      });

    const nextPointIds = new Set(nextPoints.map((p) => p.id));
    const nextAngleIds = new Set(nextAngles.map((a) => a.id));
    const nextCircleIdsAfter = new Set(nextCircles.map((c) => c.id));
    const nextSegmentIdsAfter = new Set(nextSegments.map((s) => s.id));
    const numbersPreFiltered = numbers.filter((num) => {
      const def = num.definition;
      if (def.kind === "constant") return Number.isFinite(def.value);
      if (def.kind === "distancePoints") return nextPointIds.has(def.aId) && nextPointIds.has(def.bId);
      if (def.kind === "segmentLength") return nextSegmentIdsAfter.has(def.segId);
      if (def.kind === "circleRadius" || def.kind === "circleArea") return nextCircleIdsAfter.has(def.circleId);
      if (def.kind === "angleDegrees") return nextAngleIds.has(def.angleId);
      return true;
    });
    const numberIds = new Set(numbersPreFiltered.map((n) => n.id));
    const nextNumbers = numbersPreFiltered.filter((num) => {
      if (num.definition.kind !== "ratio") return true;
      return numberIds.has(num.definition.numeratorId) && numberIds.has(num.definition.denominatorId);
    });

    const anyChanged =
      !sameIds(nextPoints, points) ||
      !sameIds(nextSegments, segments) ||
      !sameIds(nextLines, lines) ||
      !sameIds(nextCircles, circles) ||
      !sameIds(nextAngles, angles) ||
      !sameIds(nextNumbers, numbers) ||
      nextPoints.some((point, idx) => point !== points[idx]);

    points = nextPoints;
    segments = nextSegments;
    lines = nextLines;
    circles = nextCircles;
    angles = nextAngles;
    numbers = nextNumbers;
    changed = changed || anyChanged;
    if (!anyChanged) break;
  }

  if (!changed) return scene;
  return { ...scene, points, segments, lines, circles, angles, numbers };
}
