import { useSyncExternalStore } from "react";
import { camera as cameraMath } from "../view/camera";
import { getNumberValue, type SceneNumberDefinition } from "../scene/points";
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
  TransformableObjectRef,
} from "./slices/storeTypes";
import { createUiActions } from "./slices/uiActions";
import { createSceneRenameActions } from "./slices/sceneRenameActions";
import { createStoreRuntime } from "./slices/storeRuntime";
import { geoStoreHelpers } from "./geoStoreHelpers";
import { isNameUnique } from "../scene/pointBasics";
import { rebuildRightAngleProvenance, registerSegmentPair } from "../domain/rightAngleProvenance";
import type { Command } from "../CommandParser";
import { planAliasRedefine, type CommandAliasTarget } from "../domain/redefinePlanner";

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
  TransformableObjectRef,
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

function edgeKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`;
}

function isAliasTargetAlive(scene: GeoState["scene"], target: CommandAliasTarget): boolean {
  if (target.type === "point") return scene.points.some((p) => p.id === target.id);
  if (target.type === "segment") return scene.segments.some((s) => s.id === target.id);
  if (target.type === "line") return scene.lines.some((l) => l.id === target.id);
  if (target.type === "circle") return scene.circles.some((c) => c.id === target.id);
  if (target.type === "polygon") return scene.polygons.some((pg) => pg.id === target.id);
  return scene.angles.some((a) => a.id === target.id);
}

function pruneStaleCommandAliases(scene: GeoState["scene"]): void {
  for (const [name, target] of commandBarObjectAliases.entries()) {
    if (!isAliasTargetAlive(scene, target)) {
      commandBarObjectAliases.delete(name);
    }
  }
}

function applyAssignedPointLabel(pointId: string, label: string): void {
  setState((prev) => {
    const point = prev.scene.points.find((p) => p.id === pointId);
    if (!point) return prev;
    if (point.name === label && point.captionTex === label) return prev;
    return {
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((p) => (p.id === pointId ? { ...p, name: label, captionTex: label } : p)),
      },
    };
  });
}

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
    pruneStaleCommandAliases(scene);
    const out: Record<string, number> = {};
    for (let i = 0; i < scene.numbers.length; i += 1) {
      const n = scene.numbers[i];
      const v = getNumberValue(n.id, scene);
      if (typeof v === "number" && Number.isFinite(v)) out[n.name] = v;
    }
    return out;
  },
  setScalarVar(
    name: string,
    value: number,
    exprRaw?: string
  ): { ok: true; mode: "created" | "updated" } | { ok: false; error: string } {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: "Scalar name is empty" };
    if (!Number.isFinite(value)) return { ok: false as const, error: "Scalar value must be finite" };
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    const existingNumber = state.scene.numbers.find((n) => n.name === trimmed);
    const nextDefinition = chooseCommandScalarNumberDefinition({
      scene: state.scene,
      targetName: trimmed,
      fallbackValue: value,
      exprRaw,
      existingNumberId: existingNumber?.id,
    });
    if (!nextDefinition.ok) return nextDefinition;
    if (existingNumber) {
      setState((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          numbers: prev.scene.numbers.map((n) =>
            n.id === existingNumber.id ? { ...n, definition: nextDefinition.definition } : n
          ),
        },
      }));
      return { ok: true as const, mode: "updated" };
    }
    if (!isNameUnique(trimmed, state.scene.points.map((p) => p.name))) {
      return { ok: false as const, error: `Name already used: ${trimmed}` };
    }
    if (commandBarObjectAliases.has(trimmed)) return { ok: false as const, error: `Name already used: ${trimmed}` };
    const id = actions.createNumber(nextDefinition.definition, trimmed);
    if (!id) return { ok: false as const, error: `Name already used: ${trimmed}` };
    return { ok: true as const, mode: "created" };
  },
  setPointXY(name: string, x: number, y: number): { ok: true; mode: "created" | "updated"; id: string } | { ok: false; error: string } {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: "Point name is empty" };
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false as const, error: "Point coordinates must be finite" };
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(runtime.getState().scene);
    return Object.fromEntries(commandBarObjectAliases.entries());
  },
  applyObjectAssignment(
    name: string,
    cmd: Command
  ): { ok: true; mode: "created" | "updated"; objectType: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string } | { ok: false; error: string } {
    const label = name.trim();
    if (!label) return { ok: false as const, error: "Assignment name is empty" };
    const scene = runtime.getState().scene;
    pruneStaleCommandAliases(scene);
    const existing = commandBarObjectAliases.get(label);
    if (!existing) {
      if (cmd.type === "CreatePointXY") {
        const out = commandBarApi.setPointXY(label, cmd.x, cmd.y);
        if (out.ok) applyAssignedPointLabel(out.id, label);
        return out.ok
          ? { ok: true as const, mode: out.mode, objectType: "point" as const, id: out.id }
          : { ok: false as const, error: out.error };
      }
      if (cmd.type === "CreateLineByPoints") {
        const id = commandBarApi.createLineThroughPointsWithLabel(cmd.aId, cmd.bId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "line", id };
      }
      if (cmd.type === "CreateLineXY") {
        const id = commandBarApi.createLineXYWithLabel(cmd.x1, cmd.y1, cmd.x2, cmd.y2, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "line", id };
      }
      if (cmd.type === "CreatePerpendicularLine") {
        const id = commandBarApi.createPerpendicularLineWithLabel(cmd.throughId, cmd.base, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "line", id };
      }
      if (cmd.type === "CreateParallelLine") {
        const id = commandBarApi.createParallelLineWithLabel(cmd.throughId, cmd.base, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "line", id };
      }
      if (cmd.type === "CreateAngleBisector") {
        const id = commandBarApi.createAngleBisectorWithLabel(cmd.aId, cmd.bId, cmd.cId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "line", id };
      }
      if (cmd.type === "CreateSegmentByPoints") {
        const id = commandBarApi.createSegmentThroughPointsWithLabel(cmd.aId, cmd.bId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "segment", id };
      }
      if (cmd.type === "CreatePolygonByPoints") {
        const id = commandBarApi.createPolygonWithLabel(cmd.pointIds, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "polygon", id };
      }
      if (cmd.type === "CreateRegularPolygonFromEdge") {
        const id = commandBarApi.createRegularPolygonWithLabel(cmd.aId, cmd.bId, cmd.sides, cmd.direction, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "polygon", id };
      }
      if (cmd.type === "CreateCircleCenterThrough") {
        const id = commandBarApi.createCircleCenterThroughWithLabel(cmd.centerId, cmd.throughId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "circle", id };
      }
      if (cmd.type === "CreateCircleCenterRadius") {
        const id = commandBarApi.createCircleCenterRadiusWithLabel(cmd.centerId, cmd.r, label, cmd.rExpr);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "circle", id };
      }
      if (cmd.type === "CreateCircleThreePoint") {
        const id = commandBarApi.createCircleThreePointWithLabel(cmd.aId, cmd.bId, cmd.cId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "circle", id };
      }
      if (cmd.type === "CreateAngle") {
        const id = commandBarApi.createAngleWithLabel(cmd.aId, cmd.bId, cmd.cId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "angle", id };
      }
      if (cmd.type === "CreateSector") {
        const id = commandBarApi.createSectorWithLabel(cmd.centerId, cmd.startId, cmd.endId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "angle", id };
      }
      if (cmd.type === "CreateAngleFixed") {
        const id = commandBarApi.createAngleFixedWithLabel(cmd.vertexId, cmd.basePointId, cmd.angleExpr, cmd.direction, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "angle", id };
      }
      if (cmd.type === "CreateMidpointByPoints") {
        const id = commandBarApi.createMidpointByPointsWithLabel(cmd.aId, cmd.bId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        applyAssignedPointLabel(id, label);
        return { ok: true as const, mode: "created", objectType: "point", id };
      }
      if (cmd.type === "CreateMidpointBySegment") {
        const id = commandBarApi.createMidpointBySegmentWithLabel(cmd.segId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        applyAssignedPointLabel(id, label);
        return { ok: true as const, mode: "created", objectType: "point", id };
      }
      if (cmd.type === "CreateTriangleCenterPoint") {
        const id = commandBarApi.createTriangleCenterPointWithLabel(cmd.centerKind, cmd.aId, cmd.bId, cmd.cId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        applyAssignedPointLabel(id, label);
        return { ok: true as const, mode: "created", objectType: "point", id };
      }
      if (cmd.type === "CreatePointByTranslation") {
        const id = commandBarApi.createPointByTranslationWithLabel(cmd.pointId, cmd.fromId, cmd.toId, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        applyAssignedPointLabel(id, label);
        return { ok: true as const, mode: "created", objectType: "point", id };
      }
      if (cmd.type === "CreatePointByRotation") {
        const id = commandBarApi.createPointByRotationWithLabel(cmd.pointId, cmd.centerId, cmd.angleDeg, cmd.angleExpr, cmd.direction, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        applyAssignedPointLabel(id, label);
        return { ok: true as const, mode: "created", objectType: "point", id };
      }
      if (cmd.type === "CreatePointByDilation") {
        const id = commandBarApi.createPointByDilationWithLabel(cmd.pointId, cmd.centerId, cmd.factorExpr, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        applyAssignedPointLabel(id, label);
        return { ok: true as const, mode: "created", objectType: "point", id };
      }
      if (cmd.type === "CreatePointByReflection") {
        const id = commandBarApi.createPointByReflectionWithLabel(cmd.pointId, cmd.axis, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        applyAssignedPointLabel(id, label);
        return { ok: true as const, mode: "created", objectType: "point", id };
      }
      if (cmd.type === "CreateCircleXYR") {
        const centerId = actions.createFreePoint({ x: cmd.x, y: cmd.y });
        const id = commandBarApi.createCircleCenterRadiusWithLabel(centerId, cmd.r, label);
        if (!id) return { ok: false as const, error: `Name already used: ${label}` };
        return { ok: true as const, mode: "created", objectType: "circle", id };
      }
      return { ok: false as const, error: `Unsupported assignment target for ${label}` };
    }

    const redefinePlan = planAliasRedefine(scene, label, existing, cmd);
    if (!redefinePlan.ok) return { ok: false as const, error: redefinePlan.error };

    if (existing.type === "point") {
      if (cmd.type !== "CreatePointXY") return { ok: false as const, error: `Cannot redefine point ${label} with this command` };
      let updated = false;
      setState((prev) => {
        const point = prev.scene.points.find((p) => p.id === existing.id);
        if (!point || point.kind !== "free" || point.locked) return prev;
        updated = true;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: prev.scene.points.map((p) => (p.id === point.id ? { ...p, position: { x: cmd.x, y: cmd.y } } : p)),
          },
          selectedObject: { type: "point", id: point.id },
          recentCreatedObject: { type: "point", id: point.id },
        };
      });
      return updated
        ? { ok: true as const, mode: "updated", objectType: "point", id: existing.id }
        : { ok: false as const, error: `Cannot redefine point ${label}` };
    }

    if (existing.type === "line") {
      let updated = false;
      setState((prev) => {
        const oldLine = prev.scene.lines.find((l) => l.id === existing.id);
        if (!oldLine) return prev;
        const hasPoint = (id: string) => prev.scene.points.some((p) => p.id === id);
        const hasBase = (base: { type: "line" | "segment"; id: string }) =>
          base.type === "line" ? prev.scene.lines.some((l) => l.id === base.id) : prev.scene.segments.some((s) => s.id === base.id);
        let nextLine: typeof oldLine | null = null;
        if (cmd.type === "CreateLineByPoints" && hasPoint(cmd.aId) && hasPoint(cmd.bId)) {
          nextLine = { id: oldLine.id, kind: "twoPoint", aId: cmd.aId, bId: cmd.bId, visible: oldLine.visible, style: { ...oldLine.style } };
        } else if (cmd.type === "CreatePerpendicularLine" && hasPoint(cmd.throughId) && hasBase(cmd.base)) {
          nextLine = {
            id: oldLine.id,
            kind: "perpendicular",
            throughId: cmd.throughId,
            base: cmd.base,
            visible: oldLine.visible,
            style: { ...oldLine.style },
          };
        } else if (cmd.type === "CreateParallelLine" && hasPoint(cmd.throughId) && hasBase(cmd.base)) {
          nextLine = { id: oldLine.id, kind: "parallel", throughId: cmd.throughId, base: cmd.base, visible: oldLine.visible, style: { ...oldLine.style } };
        } else if (cmd.type === "CreateAngleBisector" && hasPoint(cmd.aId) && hasPoint(cmd.bId) && hasPoint(cmd.cId)) {
          nextLine = {
            id: oldLine.id,
            kind: "angleBisector",
            aId: cmd.aId,
            bId: cmd.bId,
            cId: cmd.cId,
            visible: oldLine.visible,
            style: { ...oldLine.style },
          };
        } else {
          return prev;
        }
        updated = true;
        return {
          ...prev,
          scene: { ...prev.scene, lines: prev.scene.lines.map((l) => (l.id === oldLine.id ? nextLine! : l)) },
          selectedObject: { type: "line", id: oldLine.id },
          recentCreatedObject: { type: "line", id: oldLine.id },
        };
      });
      if (!updated) return { ok: false as const, error: `Cannot redefine line ${label} with this command` };
      rebuildRightAngleProvenance(runtime.getState().scene);
      return { ok: true as const, mode: "updated", objectType: "line", id: existing.id };
    }

    if (existing.type === "segment") {
      if (cmd.type !== "CreateSegmentByPoints") return { ok: false as const, error: `Cannot redefine segment ${label} with this command` };
      let updated = false;
      setState((prev) => {
        const oldSeg = prev.scene.segments.find((s) => s.id === existing.id);
        if (!oldSeg) return prev;
        if (
          (Array.isArray(oldSeg.ownedByPolygonIds) && oldSeg.ownedByPolygonIds.length > 0) ||
          (Array.isArray(oldSeg.ownedBySectorIds) && oldSeg.ownedBySectorIds.length > 0)
        ) {
          return prev;
        }
        const hasA = prev.scene.points.some((p) => p.id === cmd.aId);
        const hasB = prev.scene.points.some((p) => p.id === cmd.bId);
        if (!hasA || !hasB) return prev;
        updated = true;
        return {
          ...prev,
          scene: { ...prev.scene, segments: prev.scene.segments.map((s) => (s.id === oldSeg.id ? { ...oldSeg, aId: cmd.aId, bId: cmd.bId } : s)) },
          selectedObject: { type: "segment", id: oldSeg.id },
          recentCreatedObject: { type: "segment", id: oldSeg.id },
        };
      });
      return updated
        ? { ok: true as const, mode: "updated", objectType: "segment", id: existing.id }
        : { ok: false as const, error: `Cannot redefine segment ${label}` };
    }

    if (existing.type === "circle") {
      let updated = false;
      setState((prev) => {
        const oldCircle = prev.scene.circles.find((c) => c.id === existing.id);
        if (!oldCircle) return prev;
        const hasPoint = (id: string) => prev.scene.points.some((p) => p.id === id);
        let nextCircle: typeof oldCircle | null = null;
        if (cmd.type === "CreateCircleCenterThrough" && hasPoint(cmd.centerId) && hasPoint(cmd.throughId)) {
          nextCircle = {
            id: oldCircle.id,
            kind: "twoPoint",
            centerId: cmd.centerId,
            throughId: cmd.throughId,
            visible: oldCircle.visible,
            style: { ...oldCircle.style },
          };
        } else if (cmd.type === "CreateCircleCenterRadius" && hasPoint(cmd.centerId) && cmd.r > 0) {
          nextCircle = {
            id: oldCircle.id,
            kind: "fixedRadius",
            centerId: cmd.centerId,
            radius: cmd.r,
            radiusExpr: cmd.rExpr ?? String(cmd.r),
            visible: oldCircle.visible,
            style: { ...oldCircle.style },
          };
        } else if (cmd.type === "CreateCircleThreePoint" && hasPoint(cmd.aId) && hasPoint(cmd.bId) && hasPoint(cmd.cId)) {
          nextCircle = {
            id: oldCircle.id,
            kind: "threePoint",
            aId: cmd.aId,
            bId: cmd.bId,
            cId: cmd.cId,
            visible: oldCircle.visible,
            style: { ...oldCircle.style },
          };
        } else {
          return prev;
        }
        updated = true;
        return {
          ...prev,
          scene: { ...prev.scene, circles: prev.scene.circles.map((c) => (c.id === oldCircle.id ? nextCircle! : c)) },
          selectedObject: { type: "circle", id: oldCircle.id },
          recentCreatedObject: { type: "circle", id: oldCircle.id },
        };
      });
      return updated
        ? { ok: true as const, mode: "updated", objectType: "circle", id: existing.id }
        : { ok: false as const, error: `Cannot redefine circle ${label} with this command` };
    }

    if (existing.type === "polygon") {
      if (cmd.type !== "CreatePolygonByPoints") return { ok: false as const, error: `Cannot redefine polygon ${label} with this command` };
      let updated = false;
      let createdEdges: Array<{ id: string; aId: string; bId: string }> = [];
      setState((prev) => {
        createdEdges = [];
        const oldPolygon = prev.scene.polygons.find((pg) => pg.id === existing.id);
        if (!oldPolygon) return prev;
        const unique = Array.from(new Set(cmd.pointIds));
        if (unique.length < 3) return prev;
        if (unique.some((id) => !prev.scene.points.some((p) => p.id === id))) return prev;
        const polygonId = oldPolygon.id;
        const nextEdgeKeys = new Set<string>();
        for (let i = 0; i < unique.length; i += 1) {
          const aId = unique[i];
          const bId = unique[(i + 1) % unique.length];
          if (aId === bId) continue;
          nextEdgeKeys.add(edgeKey(aId, bId));
        }
        const currentEdgeIndexByKey = new Map<string, number>();
        const newSegments = [...prev.scene.segments];
        for (let i = 0; i < newSegments.length; i += 1) {
          const seg = newSegments[i];
          currentEdgeIndexByKey.set(edgeKey(seg.aId, seg.bId), i);
        }
        let nextSegmentId = prev.nextSegmentId;
        for (let i = 0; i < unique.length; i += 1) {
          const aId = unique[i];
          const bId = unique[(i + 1) % unique.length];
          if (aId === bId) continue;
          const key = edgeKey(aId, bId);
          const existingIdx = currentEdgeIndexByKey.get(key);
          if (existingIdx !== undefined) {
            const seg = newSegments[existingIdx];
            if (Array.isArray(seg.ownedByPolygonIds) && !seg.ownedByPolygonIds.includes(polygonId)) {
              newSegments[existingIdx] = {
                ...seg,
                ownedByPolygonIds: [...seg.ownedByPolygonIds, polygonId],
              };
            }
            continue;
          }
          const segId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          newSegments.push({
            id: segId,
            aId,
            bId,
            ownedByPolygonIds: [polygonId],
            visible: true,
            showLabel: false,
            style: { ...prev.segmentDefaults },
          });
          currentEdgeIndexByKey.set(key, newSegments.length - 1);
          createdEdges.push({ id: segId, aId, bId });
        }
        const filteredSegments: typeof newSegments = [];
        for (let i = 0; i < newSegments.length; i += 1) {
          const seg = newSegments[i];
          if (!Array.isArray(seg.ownedByPolygonIds) || !seg.ownedByPolygonIds.includes(polygonId)) {
            filteredSegments.push(seg);
            continue;
          }
          const segKey = edgeKey(seg.aId, seg.bId);
          if (nextEdgeKeys.has(segKey)) {
            filteredSegments.push(seg);
            continue;
          }
          const nextOwners = seg.ownedByPolygonIds.filter((owner) => owner !== polygonId);
          if (nextOwners.length > 0) {
            filteredSegments.push({ ...seg, ownedByPolygonIds: nextOwners });
          }
        }
        updated = true;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: filteredSegments.map((seg) =>
              Array.isArray(seg.ownedByPolygonIds) && seg.ownedByPolygonIds.length === 0
                ? { ...seg, ownedByPolygonIds: undefined }
                : seg
            ),
            polygons: prev.scene.polygons.map((pg) => (pg.id === oldPolygon.id ? { ...oldPolygon, pointIds: unique } : pg)),
          },
          selectedObject: { type: "polygon", id: oldPolygon.id },
          recentCreatedObject: { type: "polygon", id: oldPolygon.id },
          nextSegmentId,
        };
      });
      for (let i = 0; i < createdEdges.length; i += 1) {
        const edge = createdEdges[i];
        registerSegmentPair(edge.id, edge.aId, edge.bId);
      }
      return updated
        ? { ok: true as const, mode: "updated", objectType: "polygon", id: existing.id }
        : { ok: false as const, error: `Cannot redefine polygon ${label}` };
    }

    if (existing.type === "angle") {
      let updated = false;
      let createdEdges: Array<{ id: string; aId: string; bId: string }> = [];
      setState((prev) => {
        createdEdges = [];
        const oldAngle = prev.scene.angles.find((a) => a.id === existing.id);
        if (!oldAngle) return prev;
        const hasPoint = (id: string) => prev.scene.points.some((p) => p.id === id);
        let nextAngle: typeof oldAngle | null = null;
        let nextSectorTriple: { centerId: string; startId: string; endId: string } | null = null;
        if (cmd.type === "CreateAngle" && hasPoint(cmd.aId) && hasPoint(cmd.bId) && hasPoint(cmd.cId)) {
          nextAngle = { ...oldAngle, kind: "angle", aId: cmd.aId, bId: cmd.bId, cId: cmd.cId };
        } else if (cmd.type === "CreateSector" && hasPoint(cmd.centerId) && hasPoint(cmd.startId) && hasPoint(cmd.endId)) {
          nextAngle = { ...oldAngle, kind: "sector", aId: cmd.startId, bId: cmd.centerId, cId: cmd.endId };
          nextSectorTriple = { centerId: cmd.centerId, startId: cmd.startId, endId: cmd.endId };
        } else {
          return prev;
        }
        const angleId = oldAngle.id;
        const edgeIndexByKey = new Map<string, number>();
        const edgeKeyFor = (aId: string, bId: string) => (aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`);
        const newSegments = [...prev.scene.segments];
        for (let i = 0; i < newSegments.length; i += 1) {
          const seg = newSegments[i];
          edgeIndexByKey.set(edgeKeyFor(seg.aId, seg.bId), i);
        }
        let nextSegmentId = prev.nextSegmentId;
        const removeSectorOwner = (seg: typeof newSegments[number]) => {
          if (!Array.isArray(seg.ownedBySectorIds) || !seg.ownedBySectorIds.includes(angleId)) return seg;
          const remaining = seg.ownedBySectorIds.filter((id) => id !== angleId);
          if (remaining.length === 0) {
            return { ...seg, ownedBySectorIds: undefined };
          }
          return { ...seg, ownedBySectorIds: remaining };
        };
        // If old object was sector, remove current ownership from all segments first.
        if (oldAngle.kind === "sector") {
          for (let i = 0; i < newSegments.length; i += 1) {
            newSegments[i] = removeSectorOwner(newSegments[i]);
          }
        }
        // If redefining to sector, add ownership to the new radial sides (create if absent).
        if (nextSectorTriple) {
          const radialPairs: Array<[string, string]> = [
            [nextSectorTriple.centerId, nextSectorTriple.startId],
            [nextSectorTriple.centerId, nextSectorTriple.endId],
          ];
          for (let i = 0; i < radialPairs.length; i += 1) {
            const [aId, bId] = radialPairs[i];
            const key = edgeKeyFor(aId, bId);
            const existingIdx = edgeIndexByKey.get(key);
            if (existingIdx !== undefined) {
              const seg = newSegments[existingIdx];
              if (Array.isArray(seg.ownedBySectorIds)) {
                if (!seg.ownedBySectorIds.includes(angleId)) {
                  newSegments[existingIdx] = { ...seg, ownedBySectorIds: [...seg.ownedBySectorIds, angleId] };
                }
              } else {
                newSegments[existingIdx] = { ...seg, ownedBySectorIds: [angleId] };
              }
              continue;
            }
            const segId = `s_${nextSegmentId}`;
            nextSegmentId += 1;
            newSegments.push({
              id: segId,
              aId,
              bId,
              ownedBySectorIds: [angleId],
              visible: true,
              showLabel: false,
              style: { ...prev.segmentDefaults },
            });
            edgeIndexByKey.set(key, newSegments.length - 1);
            createdEdges.push({ id: segId, aId, bId });
          }
        }
        // Drop segments that have no owners left (sector + polygon) only if they were ownership-generated.
        const filteredSegments = newSegments.filter((seg) => {
          const hadOwnership =
            Array.isArray(seg.ownedBySectorIds) ||
            Array.isArray(seg.ownedByPolygonIds);
          if (!hadOwnership) return true;
          const hasSectorOwners = Array.isArray(seg.ownedBySectorIds) && seg.ownedBySectorIds.length > 0;
          const hasPolygonOwners = Array.isArray(seg.ownedByPolygonIds) && seg.ownedByPolygonIds.length > 0;
          return hasSectorOwners || hasPolygonOwners;
        });
        updated = true;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: filteredSegments,
            angles: prev.scene.angles.map((a) => (a.id === oldAngle.id ? nextAngle! : a)),
          },
          selectedObject: { type: "angle", id: oldAngle.id },
          recentCreatedObject: { type: "angle", id: oldAngle.id },
          nextSegmentId,
        };
      });
      for (let i = 0; i < createdEdges.length; i += 1) {
        const edge = createdEdges[i];
        registerSegmentPair(edge.id, edge.aId, edge.bId);
      }
      return updated
        ? { ok: true as const, mode: "updated", objectType: "angle", id: existing.id }
        : { ok: false as const, error: `Cannot redefine angle ${label} with this command` };
    }

    return { ok: false as const, error: `Cannot redefine alias ${label}` };
  },
  createPointXYWithLabel(x: number, y: number, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const pointId = actions.createMidpointFromPoints(aId, bId);
    if (!pointId) return null;
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === pointId ? { ...point, name, captionTex: name } : point
        ),
      },
    }));
    commandBarObjectAliases.set(name, { type: "point", id: pointId });
    return pointId;
  },
  createMidpointBySegmentWithLabel(segId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const pointId = actions.createMidpointFromSegment(segId);
    if (!pointId) return null;
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === pointId ? { ...point, name, captionTex: name } : point
        ),
      },
    }));
    commandBarObjectAliases.set(name, { type: "point", id: pointId });
    return pointId;
  },
  createTriangleCenterPointWithLabel(
    centerKind: "incenter" | "orthocenter" | "centroid",
    aId: string,
    bId: string,
    cId: string,
    label: string
  ): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const pointId = actions.createTriangleCenterPoint(centerKind, aId, bId, cId);
    if (!pointId) return null;
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === pointId ? { ...point, name, captionTex: name } : point
        ),
      },
    }));
    commandBarObjectAliases.set(name, { type: "point", id: pointId });
    return pointId;
  },
  createPointByTranslationWithLabel(pointId: string, fromId: string, toId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const createdId = actions.createPointByTranslation(pointId, fromId, toId);
    if (!createdId) return null;
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === createdId ? { ...point, name, captionTex: name } : point
        ),
      },
    }));
    commandBarObjectAliases.set(name, { type: "point", id: createdId });
    return createdId;
  },
  createPointByRotationWithLabel(
    pointId: string,
    centerId: string,
    angleDeg: number,
    angleExpr: string,
    direction: "CCW" | "CW",
    label: string
  ): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const createdId = actions.createPointByRotation(centerId, pointId, angleDeg, direction, angleExpr);
    if (!createdId) return null;
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === createdId ? { ...point, name, captionTex: name } : point
        ),
      },
    }));
    commandBarObjectAliases.set(name, { type: "point", id: createdId });
    return createdId;
  },
  createPointByDilationWithLabel(pointId: string, centerId: string, factorExpr: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const createdId = actions.createPointByDilation(pointId, centerId, factorExpr);
    if (!createdId) return null;
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === createdId ? { ...point, name, captionTex: name } : point
        ),
      },
    }));
    commandBarObjectAliases.set(name, { type: "point", id: createdId });
    return createdId;
  },
  createPointByReflectionWithLabel(
    pointId: string,
    axis: { type: "line" | "segment"; id: string },
    label: string
  ): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const createdId = actions.createPointByReflection(pointId, axis);
    if (!createdId) return null;
    setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        points: prev.scene.points.map((point) =>
          point.id === createdId ? { ...point, name, captionTex: name } : point
        ),
      },
    }));
    commandBarObjectAliases.set(name, { type: "point", id: createdId });
    return createdId;
  },
  createCircleCenterThroughWithLabel(centerId: string, throughId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const polygonId = actions.createPolygon(pointIds);
    if (!polygonId) return null;
    commandBarObjectAliases.set(name, { type: "polygon", id: polygonId });
    return polygonId;
  },
  createRegularPolygonWithLabel(
    aId: string,
    bId: string,
    sides: number,
    direction: "CCW" | "CW",
    label: string
  ): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const polygonId = actions.createRegularPolygon(aId, bId, sides, direction);
    if (!polygonId) return null;
    commandBarObjectAliases.set(name, { type: "polygon", id: polygonId });
    return polygonId;
  },
  createAngleWithLabel(aId: string, bId: string, cId: string, label: string): string | null {
    const name = label.trim();
    if (!name) return null;
    const state = runtime.getState();
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
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
    pruneStaleCommandAliases(state.scene);
    if (commandBarObjectAliases.has(name)) return null;
    if (!isNameUnique(name, state.scene.numbers.map((n) => n.name))) return null;
    if (!isNameUnique(name, state.scene.points.map((p) => p.name))) return null;
    const angleId = actions.createSector(centerId, startId, endId);
    if (!angleId) return null;
    commandBarObjectAliases.set(name, { type: "angle", id: angleId });
    return angleId;
  },
};

function chooseCommandScalarNumberDefinition(params: {
  scene: GeoState["scene"];
  targetName: string;
  fallbackValue: number;
  exprRaw?: string;
  existingNumberId?: string;
}): { ok: true; definition: SceneNumberDefinition } | { ok: false; error: string } {
  const expr = (params.exprRaw ?? "").trim();
  const fallback: SceneNumberDefinition = { kind: "constant", value: params.fallbackValue };
  if (!expr) return { ok: true, definition: fallback };

  // Prevent immediate self-reference recursion when reassigning an existing number by name.
  if (
    params.existingNumberId &&
    new RegExp(`\\b${params.targetName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`).test(expr)
  ) {
    return { ok: false, error: `Self-referential scalar assignment is not supported: ${params.targetName}` };
  }

  const exprDef: SceneNumberDefinition = { kind: "expression", expr };
  if (isValidNumberDefinition(exprDef, params.scene)) return { ok: true, definition: exprDef };
  return { ok: true, definition: fallback };
}

export function getGeoStore(): GeoStore {
  return { ...runtime.getState(), ...actions };
}

export function useGeoStore<T>(selector: (store: GeoStore) => T): T {
  return useSyncExternalStore(runtime.subscribe, () => selector(getGeoStore()), () => selector(getGeoStore()));
}

export { geoStoreHelpers };
