import { useSyncExternalStore } from "react";
import type { Vec2 } from "../geo/vec2";
import {
  evaluateNumberExpression,
  getCircleWorldGeometry,
  getNumberValue,
  getLineWorldAnchors,
  getPointWorldPos,
  isNameUnique,
  isValidPointName,
  nextLabelFromIndex,
  type GeometryObjectRef,
  type SceneNumberDefinition,
  type SceneModel,
  type ScenePoint,
  type ShowLabelMode,
} from "../scene/points";
import {
  distance,
  lineCircleIntersectionBranches,
} from "../geo/geometry";
import { camera as cameraMath } from "../view/camera";
import {
  cloneHistorySnapshot,
  hasHistoryDiff,
  MAX_HISTORY,
  type HistorySnapshot,
  type SetStateOptions,
  takeHistorySnapshot,
} from "./slices/historySlice";
import { createInitialGeoState } from "./slices";
import { createHistoryActions } from "./slices/historyActions";
import { createInteractionActions } from "./slices/interactionActions";
import { createSceneCreationActions } from "./slices/sceneCreationActions";
import { createSceneCoreActions } from "./slices/sceneCoreActions";
import { createSceneLineAngleActions } from "./slices/sceneLineAngleActions";
import { createSceneMutationActions } from "./slices/sceneMutationActions";
import type {
  ActiveTool,
  AngleFixedDirection,
  GeoActions,
  GeoState,
  GeoStore,
  HoveredHit,
  PendingSelection,
  RenameResult,
  SelectedObject,
} from "./slices/storeTypes";
import { createUiActions } from "./slices/uiActions";

export type {
  ActiveTool,
  AngleFixedDirection,
  GeoActions,
  GeoState,
  GeoStore,
  HoveredHit,
  PendingSelection,
  RenameResult,
  SelectedObject,
};
const initialState: GeoState = createInitialGeoState();

let state: GeoState = initialState;
const listeners = new Set<() => void>();

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
  ...createInteractionActions({
    getState: () => state,
    setState,
    cameraMath,
  }),
  ...createUiActions({
    setState,
  }),
  ...createHistoryActions({
    setState,
    undoStack,
    redoStack,
    getLastHistoryActionKey: () => lastHistoryActionKey,
    setLastHistoryActionKey: (key) => {
      lastHistoryActionKey = key;
    },
    getIsRestoringHistory: () => isRestoringHistory,
    setIsRestoringHistory: (value) => {
      isRestoringHistory = value;
    },
    restoreFromSnapshot,
  }),
  ...createSceneCoreActions({
    setState,
  }),
  ...createSceneLineAngleActions({
    setState,
  }),
  ...createSceneCreationActions({
    setState,
    findExistingIntersectionPointId,
    getLineCircleRefs,
    createStableLineCircleIntersectionPoint,
    isValidNumberDefinition,
    numberPrefixForDefinition,
    nextAvailableNumberName,
  }),
  ...createSceneMutationActions({
    setState,
  }),

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
  getCircleWorldGeometryById(scene: SceneModel, circleId: string): { center: Vec2; radius: number } | null {
    const circle = scene.circles.find((item) => item.id === circleId);
    if (!circle) return null;
    return getCircleWorldGeometry(circle, scene);
  },
  getNumberValueById(scene: SceneModel, numberId: string): number | null {
    return getNumberValue(numberId, scene);
  },
};

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

function numberPrefixForDefinition(def: SceneNumberDefinition): string {
  if (def.kind === "distancePoints" || def.kind === "segmentLength") return "l";
  if (def.kind === "circleRadius") return "r";
  if (def.kind === "circleArea") return "Area";
  if (def.kind === "angleDegrees") return "ang";
  return "n";
}

function nextAvailableNumberName(usedNames: Set<string>, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}_(\\d+)$`);
  const usedIndices = new Set<number>();
  for (const name of usedNames) {
    const m = name.match(re);
    if (!m) continue;
    const idx = Number(m[1]);
    if (Number.isInteger(idx) && idx > 0) usedIndices.add(idx);
  }
  let i = 1;
  while (usedIndices.has(i)) i += 1;
  return `${prefix}_${i}`;
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
  const geom = getCircleWorldGeometry(circle, state.scene);
  if (!a || !b || !geom) return null;
  const center = geom.center;
  const radius = geom.radius;
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
  const geom = getCircleWorldGeometry(circle, state.scene);
  if (!a || !b || !geom) return null;
  const center = geom.center;
  const radius = geom.radius;
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
  if (line.kind === "angleBisector") return [line.bId, null];
  return [line.aId, line.bId];
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
    circleFixedTool: snapshot.circleFixedTool,
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
    const nextCircles = circles.filter((circle) => {
      if (circle.kind === "threePoint") {
        return pointIds.has(circle.aId) && pointIds.has(circle.bId) && pointIds.has(circle.cId);
      }
      if (!pointIds.has(circle.centerId)) return false;
      if (circle.kind === "fixedRadius") return Number.isFinite(circle.radius) && circle.radius > 0;
      return pointIds.has(circle.throughId);
    });
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
      if (line.kind === "angleBisector") {
        return pointIds.has(line.aId) && pointIds.has(line.bId) && pointIds.has(line.cId);
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
