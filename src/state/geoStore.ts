import { useSyncExternalStore } from "react";
import type { Vec2 } from "../geo/vec2";
import {
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
import { projectPointToCircle, projectPointToLine, projectPointToSegment } from "../geo/geometry";
import type { Camera, Viewport } from "../view/camera";
import { camera as cameraMath } from "../view/camera";

export type ActiveTool =
  | "move"
  | "point"
  | "copyStyle"
  | "midpoint"
  | "segment"
  | "line2p"
  | "circle";

export type SelectedObject =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line"; id: string }
  | { type: "circle"; id: string }
  | null;

type GeoState = {
  camera: Camera;
  activeTool: ActiveTool;
  scene: SceneModel;
  selectedObject: SelectedObject;
  cursorWorld: Vec2 | null;
  pendingConstruction:
    | { tool: "segment"; aPointId: string }
    | { tool: "line2p"; aPointId: string }
    | { tool: "circle"; aPointId: string }
    | { tool: "midpoint"; aPointId: string }
    | null;
  nextPointId: number;
  nextSegmentId: number;
  nextLineId: number;
  nextCircleId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: LineStyle;
  copyStyle: {
    source: SelectedObject;
    pointStyle: PointStyle | null;
    lineStyle: LineStyle | null;
    showLabel: ShowLabelMode | null;
  };
};

type RenameResult = { ok: true; name: string } | { ok: false; error: string };

type GeoActions = {
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedObject: (selected: SelectedObject) => void;
  setCursorWorld: (world: Vec2 | null) => void;
  setPendingConstruction: (next: GeoState["pendingConstruction"]) => void;
  clearPendingConstruction: () => void;
  panByScreenDelta: (delta: Vec2) => void;
  zoomAtScreenPoint: (vp: Viewport, pScreen: Vec2, zoomFactor: number) => void;

  createFreePoint: (world: Vec2) => string;
  createMidpointFromPoints: (aId: string, bId: string) => string | null;
  createMidpointFromSegment: (segId: string) => string | null;
  createSegment: (aId: string, bId: string) => string | null;
  createLine: (aId: string, bId: string) => string | null;
  createCircle: (centerId: string, radiusPointId: string) => string | null;
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

  renameSelectedPoint: (nextNameRaw: string) => RenameResult;
  deleteSelectedObject: () => void;
  setCopyStyleSource: (obj: Exclude<SelectedObject, null>) => void;
  applyCopyStyleTo: (obj: Exclude<SelectedObject, null>) => void;
  clearCopyStyle: () => void;
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
  cursorWorld: null,
  pendingConstruction: null,
  nextPointId: 1,
  nextSegmentId: 1,
  nextLineId: 1,
  nextCircleId: 1,
  pointDefaults: defaultPointStyle,
  segmentDefaults: defaultSegStyle,
  lineDefaults: defaultLineStyle,
  circleDefaults: defaultLineStyle,
  copyStyle: {
    source: null,
    pointStyle: null,
    lineStyle: null,
    showLabel: null,
  },
};

let state: GeoState = initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(updater: (prev: GeoState) => GeoState) {
  state = updater(state);
  emit();
}

const actions: GeoActions = {
  setActiveTool(tool) {
    setState((prev) => ({
      ...prev,
      activeTool: tool,
      pendingConstruction: null,
      copyStyle:
        tool === "copyStyle"
          ? prev.copyStyle
          : {
              source: null,
              pointStyle: null,
              lineStyle: null,
              showLabel: null,
            },
    }));
  },

  setSelectedObject(selected) {
    setState((prev) => ({ ...prev, selectedObject: selected }));
  },

  setCursorWorld(world) {
    setState((prev) => ({ ...prev, cursorWorld: world }));
  },

  setPendingConstruction(next) {
    setState((prev) => ({ ...prev, pendingConstruction: next }));
  },

  clearPendingConstruction() {
    setState((prev) => ({ ...prev, pendingConstruction: null }));
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
              aId,
              bId,
              visible: true,
              style: { ...prev.lineDefaults },
            },
          ],
        },
        selectedObject: { type: "line", id },
        nextLineId: prev.nextLineId + 1,
      };
    });
    return id;
  },

  createCircle(centerId, radiusPointId) {
    if (centerId === radiusPointId) return null;
    let id: string | null = null;
    setState((prev) => {
      const c = prev.scene.points.find((p) => p.id === centerId);
      const r = prev.scene.points.find((p) => p.id === radiusPointId);
      if (!c || !r) return prev;
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
              radiusPointId,
              visible: true,
              style: { ...prev.circleDefaults },
            },
          ],
        },
        selectedObject: { type: "circle", id },
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
        nextPointId: prev.nextPointId + 1,
      };
    });
    return createdId;
  },

  createIntersectionPoint(objA, objB, preferredWorld) {
    let createdId: string | null = null;
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
          const a = geoStoreHelpers.getPointWorldById(prev.scene, line.aId);
          const b = geoStoreHelpers.getPointWorldById(prev.scene, line.bId);
          if (!a || !b) return point;
          const pr = projectPointToLine(world, a, b);
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
          const radiusPoint = geoStoreHelpers.getPointWorldById(prev.scene, circle.radiusPointId);
          if (!center || !radiusPoint) return point;
          const r = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y);
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
    });
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
    }));
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
        const keptLines = prev.scene.lines.filter(
          (line) => line.aId !== deletedPointId && line.bId !== deletedPointId
        );
        const keptCircles = prev.scene.circles.filter(
          (circle) => circle.centerId !== deletedPointId && circle.radiusPointId !== deletedPointId
        );
        const deletedCircleIds = new Set(
          prev.scene.circles
            .filter((circle) => circle.centerId === deletedPointId || circle.radiusPointId === deletedPointId)
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
          copyStyle: isCopyStyleSourceAlive(prev.copyStyle.source, nextPoints, keptSegments, keptLines, keptCircles)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, showLabel: null },
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
        const keptLines = prev.scene.lines;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: keptSegments,
            points: nextPoints,
          },
          selectedObject: null,
          copyStyle: isCopyStyleSourceAlive(prev.copyStyle.source, nextPoints, keptSegments, keptLines, prev.scene.circles)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, showLabel: null },
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
                (point.objB.type !== "circle" || point.objB.id !== circleId))
        );
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: nextCircles,
            points: nextPoints,
          },
          selectedObject: null,
          copyStyle: isCopyStyleSourceAlive(prev.copyStyle.source, nextPoints, prev.scene.segments, prev.scene.lines, nextCircles)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, showLabel: null },
        };
      }

      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: prev.scene.lines.filter((line) => line.id !== prev.selectedObject!.id),
          points: prev.scene.points.filter(
            (point) =>
              point.kind !== "pointOnLine" ||
              point.lineId !== prev.selectedObject!.id
          ).filter(
            (point) =>
              point.kind !== "intersectionPoint" ||
              (point.objA.type !== "line" || point.objA.id !== prev.selectedObject!.id) &&
                (point.objB.type !== "line" || point.objB.id !== prev.selectedObject!.id)
          ),
        },
        selectedObject: null,
        copyStyle:
          prev.copyStyle.source?.type === "line" && prev.copyStyle.source.id === prev.selectedObject.id
            ? { source: null, pointStyle: null, lineStyle: null, showLabel: null }
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
            lineStyle: { ...circle.style },
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
          showLabel: null,
        },
      };
    });
  },

  applyCopyStyleTo(obj) {
    setState((prev) => {
      if (obj.type === "point") {
        if (!prev.copyStyle.pointStyle) return prev;
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
                      ...prev.copyStyle.pointStyle!,
                      labelOffsetPx: { ...point.style.labelOffsetPx },
                    },
                  }
            ),
          },
        };
      }

      if (obj.type === "segment") {
        if (!prev.copyStyle.lineStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: prev.scene.segments.map((segment) =>
              segment.id === obj.id ? { ...segment, style: { ...prev.copyStyle.lineStyle! } } : segment
            ),
          },
        };
      }

      if (obj.type === "circle") {
        if (!prev.copyStyle.lineStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: prev.scene.circles.map((circle) =>
              circle.id === obj.id ? { ...circle, style: { ...prev.copyStyle.lineStyle! } } : circle
            ),
          },
        };
      }

      if (!prev.copyStyle.lineStyle) return prev;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          lines: prev.scene.lines.map((line) =>
            line.id === obj.id ? { ...line, style: { ...prev.copyStyle.lineStyle! } } : line
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
        showLabel: null,
      },
    }));
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
