import { useSyncExternalStore } from "react";
import { camera as cameraMath } from "../view/camera";
import { getNumberValue } from "../scene/points";
import {
  type SetStateOptions,
} from "./slices/historySlice";
import { createInitialGeoState } from "./slices";
import { createHistoryActions } from "./slices/historyActions";
import { createInteractionActions } from "./slices/interactionActions";
import { createSceneCreationActions } from "./slices/sceneCreationActions";
import { createSceneCoreActions } from "./slices/sceneCoreActions";
import { createSceneLineAngleActions } from "./slices/sceneLineAngleActions";
import { createSceneMutationActions } from "./slices/sceneMutationActions";
import { normalizeSceneIntegrity } from "../domain/sceneIntegrity";
import {
  createStableLineCircleIntersectionPoint,
  findExistingIntersectionPointId,
  getLineCircleRefs,
  resolveIntersectionBranchIndex,
} from "../domain/intersectionReuse";
import {
  isValidNumberDefinition,
  nextAvailableNumberName,
  numberPrefixForDefinition,
} from "../domain/numberDefinitions";
import { restoreGeoStateFromSnapshot } from "./slices/historyRestore";
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
import { createSceneRenameActions } from "./slices/sceneRenameActions";
import { createStoreRuntime } from "./slices/storeRuntime";
import { geoStoreHelpers } from "./geoStoreHelpers";
import { isNameUnique } from "../scene/pointBasics";
import { rebuildRightAngleProvenance } from "../domain/rightAngleProvenance";

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
rebuildRightAngleProvenance(initialState.scene);
const runtime = createStoreRuntime({
  initialState,
  normalizeScene: normalizeSceneIntegrity,
});
const setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void = runtime.setState;
const commandBarObjectAliases = new Map<
  string,
  { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }
>();

const actions: GeoActions = {
  ...createInteractionActions({
    getState: runtime.getState,
    setState,
    cameraMath,
  }),
  ...createUiActions({
    setState,
  }),
  ...createHistoryActions({
    setState,
    undoStack: runtime.history.undoStack,
    redoStack: runtime.history.redoStack,
    getLastHistoryActionKey: runtime.history.getLastHistoryActionKey,
    setLastHistoryActionKey: runtime.history.setLastHistoryActionKey,
    getIsRestoringHistory: runtime.history.getIsRestoringHistory,
    setIsRestoringHistory: runtime.history.setIsRestoringHistory,
    restoreFromSnapshot: restoreGeoStateFromSnapshot,
    onSceneRestored: rebuildRightAngleProvenance,
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
    resolveIntersectionBranchIndex,
    isValidNumberDefinition,
    numberPrefixForDefinition,
    nextAvailableNumberName,
  }),
  ...createSceneMutationActions({
    setState,
  }),
  ...createSceneRenameActions({
    setState,
  }),
};

export const commandBarApi = {
  getScalarVars(): Record<string, number> {
    const scene = runtime.getState().scene;
    const out: Record<string, number> = {};
    for (let i = 0; i < scene.numbers.length; i += 1) {
      const n = scene.numbers[i];
      const v = getNumberValue(n.id, scene);
      if (typeof v === "number" && Number.isFinite(v)) out[n.name] = v;
    }
    return out;
  },
  setScalarVar(name: string, value: number): { ok: true; mode: "created" | "updated" } | { ok: false; error: string } {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: "Scalar name is empty" };
    if (!Number.isFinite(value)) return { ok: false as const, error: "Scalar value must be finite" };
    const state = runtime.getState();
    const existingNumber = state.scene.numbers.find((n) => n.name === trimmed);
    if (existingNumber) {
      if (existingNumber.definition.kind !== "constant") {
        return { ok: false as const, error: `Cannot redefine non-constant number: ${trimmed}` };
      }
      setState((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          numbers: prev.scene.numbers.map((n) =>
            n.id === existingNumber.id ? { ...n, definition: { kind: "constant", value } } : n
          ),
        },
      }));
      return { ok: true as const, mode: "updated" };
    }
    if (!isNameUnique(trimmed, state.scene.points.map((p) => p.name))) {
      return { ok: false as const, error: `Name already used: ${trimmed}` };
    }
    if (commandBarObjectAliases.has(trimmed)) return { ok: false as const, error: `Name already used: ${trimmed}` };
    const id = actions.createNumber({ kind: "constant", value }, trimmed);
    if (!id) return { ok: false as const, error: `Name already used: ${trimmed}` };
    return { ok: true as const, mode: "created" };
  },
  setPointXY(name: string, x: number, y: number): { ok: true; mode: "created" | "updated"; id: string } | { ok: false; error: string } {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: "Point name is empty" };
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false as const, error: "Point coordinates must be finite" };
    const state = runtime.getState();
    const existingPoints = state.scene.points.filter((p) => p.name === trimmed);
    if (existingPoints.length > 1) return { ok: false as const, error: `Ambiguous point name: ${trimmed}` };
    if (existingPoints.length === 1) {
      const point = existingPoints[0];
      if (point.kind !== "free" || point.locked) {
        return { ok: false as const, error: `Cannot redefine non-free point: ${trimmed}` };
      }
      setState((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          points: prev.scene.points.map((p) => (p.id === point.id ? { ...p, position: { x, y } } : p)),
        },
        selectedObject: { type: "point", id: point.id },
        recentCreatedObject: { type: "point", id: point.id },
      }));
      return { ok: true as const, mode: "updated", id: point.id };
    }
    const created = commandBarApi.createPointXYWithLabel(x, y, trimmed);
    if (!created) return { ok: false as const, error: `Name already used: ${trimmed}` };
    return { ok: true as const, mode: "created", id: created };
  },
  getCommandObjectAliases(): Record<string, { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }> {
    return Object.fromEntries(commandBarObjectAliases.entries());
  },
  createPointXYWithLabel(x: number, y: number, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    let id: string | null = null;
    setState((prev) => {
      const pointId = `p_${prev.nextPointId}`;
      id = pointId;
      return {
        ...prev,
        scene: {
          ...prev.scene,
          points: [
            ...prev.scene.points,
            {
              id: pointId,
              kind: "free",
              name,
              captionTex: name,
              visible: true,
              showLabel: "name",
              locked: false,
              auxiliary: false,
              position: { x, y },
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            },
          ],
        },
        selectedObject: { type: "point", id: pointId },
        recentCreatedObject: { type: "point", id: pointId },
        nextPointId: prev.nextPointId + 1,
      };
    });
    return id;
  },
  createLineThroughPointsWithLabel(aId: string, bId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const lineId = actions.createLine(aId, bId);
    if (!lineId) return null;
    commandBarObjectAliases.set(name, { type: "line", id: lineId });
    return lineId;
  },
  createPerpendicularLineWithLabel(
    throughId: string,
    base: { type: "line" | "segment"; id: string },
    label: string
  ): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const lineId = actions.createPerpendicularLine(throughId, base);
    if (!lineId) return null;
    commandBarObjectAliases.set(name, { type: "line", id: lineId });
    return lineId;
  },
  createParallelLineWithLabel(
    throughId: string,
    base: { type: "line" | "segment"; id: string },
    label: string
  ): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const lineId = actions.createParallelLine(throughId, base);
    if (!lineId) return null;
    commandBarObjectAliases.set(name, { type: "line", id: lineId });
    return lineId;
  },
  createAngleBisectorWithLabel(aId: string, bId: string, cId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const lineId = actions.createAngleBisectorLine(aId, bId, cId);
    if (!lineId) return null;
    commandBarObjectAliases.set(name, { type: "line", id: lineId });
    return lineId;
  },
  createLineXYWithLabel(x1: number, y1: number, x2: number, y2: number, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const aId = actions.createFreePoint({ x: x1, y: y1 });
    const bId = actions.createFreePoint({ x: x2, y: y2 });
    const lineId = actions.createLine(aId, bId);
    if (!lineId) return null;
    commandBarObjectAliases.set(name, { type: "line", id: lineId });
    return lineId;
  },
  createSegmentThroughPointsWithLabel(aId: string, bId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const segId = actions.createSegment(aId, bId);
    if (!segId) return null;
    commandBarObjectAliases.set(name, { type: "segment", id: segId });
    return segId;
  },
  createMidpointByPointsWithLabel(aId: string, bId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const pointId = actions.createMidpointFromPoints(aId, bId);
    if (!pointId) return null;
    commandBarObjectAliases.set(name, { type: "point", id: pointId });
    return pointId;
  },
  createMidpointBySegmentWithLabel(segId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const pointId = actions.createMidpointFromSegment(segId);
    if (!pointId) return null;
    commandBarObjectAliases.set(name, { type: "point", id: pointId });
    return pointId;
  },
  createCircleCenterThroughWithLabel(centerId: string, throughId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const circleId = actions.createCircle(centerId, throughId);
    if (!circleId) return null;
    commandBarObjectAliases.set(name, { type: "circle", id: circleId });
    return circleId;
  },
  createCircleThreePointWithLabel(aId: string, bId: string, cId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const circleId = actions.createCircleThreePoint(aId, bId, cId);
    if (!circleId) return null;
    commandBarObjectAliases.set(name, { type: "circle", id: circleId });
    return circleId;
  },
  createCircleCenterRadiusWithLabel(centerId: string, r: number, label: string, rExpr?: string): string | null {
    const name = label.trim();
    if (!name || !Number.isFinite(r) || r <= 0) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const expr = rExpr && rExpr.trim() ? rExpr.trim() : String(r);
    const circleId = actions.createCircleFixedRadius(centerId, expr);
    if (!circleId) return null;
    commandBarObjectAliases.set(name, { type: "circle", id: circleId });
    return circleId;
  },
  createPolygonWithLabel(pointIds: string[], label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const polygonId = actions.createPolygon(pointIds);
    if (!polygonId) return null;
    commandBarObjectAliases.set(name, { type: "polygon", id: polygonId });
    return polygonId;
  },
  createAngleWithLabel(aId: string, bId: string, cId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const angleId = actions.createAngle(aId, bId, cId);
    if (!angleId) return null;
    commandBarObjectAliases.set(name, { type: "angle", id: angleId });
    return angleId;
  },
  createAngleFixedWithLabel(
    vertexId: string,
    basePointId: string,
    angleExpr: string,
    direction: "CCW" | "CW",
    label: string
  ): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const created = actions.createAngleFixed(vertexId, basePointId, angleExpr, direction);
    if (!created) return null;
    commandBarObjectAliases.set(name, { type: "angle", id: created.angleId });
    return created.angleId;
  },
  createSectorWithLabel(centerId: string, startId: string, endId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const angleId = actions.createSector(centerId, startId, endId);
    if (!angleId) return null;
    commandBarObjectAliases.set(name, { type: "angle", id: angleId });
    return angleId;
  },
};

export function getGeoStore(): GeoStore {
  return { ...runtime.getState(), ...actions };
}

export function useGeoStore<T>(selector: (store: GeoStore) => T): T {
  return useSyncExternalStore(runtime.subscribe, () => selector(getGeoStore()), () => selector(getGeoStore()));
}

export { geoStoreHelpers };
