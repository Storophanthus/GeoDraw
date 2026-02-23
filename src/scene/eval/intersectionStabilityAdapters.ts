import type { Vec2 } from "../../geo/vec2";
import type { GeometryObjectRef, SceneModel } from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import { resolveCircleLinePairAssignmentsInScene, resolveGenericIntersectionPairAssignmentsInScene } from "./intersectionPairResolution";
import { genericIntersectionSignature } from "./intersectionUtils";
import { getPreviousStablePoint, rememberStablePoint } from "./stablePointMemory";

export function resolveCircleLinePairAssignmentsWithCtx(
  scene: SceneModel,
  ctx: SceneEvalContext,
  circleId: string,
  lineId: string,
  branches: Array<{ point: Vec2; t: number }>,
  stabilitySignature: string,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Map<string, Vec2 | null> {
  return resolveCircleLinePairAssignmentsInScene(scene.points, circleId, lineId, branches, {
    getCached: (key) => ctx.circleLinePairAssignments.get(key),
    setCached: (key, value) => {
      ctx.circleLinePairAssignments.set(key, value);
    },
    getExcludedPointWorld: (pointId) => ops.getPointWorldById(pointId, scene, ctx),
    getCachedPointWorld: (pointId) => ctx.pointCache.get(pointId) ?? null,
    getPreviousStablePoint: (pointId) => getPreviousStableCircleLinePoint(pointId, stabilitySignature),
    rememberStablePoint: (pointId, value) => rememberStableCircleLinePoint(pointId, stabilitySignature, value),
  });
}

export function resolveGenericIntersectionPairAssignmentsWithCtx(
  scene: SceneModel,
  ctx: SceneEvalContext,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  intersections: Vec2[],
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Map<string, Vec2 | null> {
  return resolveGenericIntersectionPairAssignmentsInScene(scene.points, objA, objB, intersections, {
    getCached: (key) => ctx.genericIntersectionPairAssignments.get(key),
    setCached: (key, value) => {
      ctx.genericIntersectionPairAssignments.set(key, value);
    },
    getExcludedPointWorld: (pointId) => ops.getPointWorldById(pointId, scene, ctx),
    getPreviousStablePoint: (pointId) => getPreviousStableGenericIntersectionPoint(pointId, objA, objB),
    rememberStablePoint: (pointId, value) => rememberStableGenericIntersectionPoint(pointId, objA, objB, value),
  });
}

export function getPreviousStableGenericIntersectionPoint(
  pointId: string,
  a: GeometryObjectRef,
  b: GeometryObjectRef
): Vec2 | null {
  return getPreviousStablePoint(pointId, genericIntersectionSignature(a, b));
}

export function rememberStableGenericIntersectionPoint(
  pointId: string,
  a: GeometryObjectRef,
  b: GeometryObjectRef,
  value: Vec2
): void {
  rememberStablePoint(pointId, genericIntersectionSignature(a, b), value);
}

export function getPreviousStableCircleLinePoint(pointId: string, signature: string): Vec2 | null {
  return getPreviousStablePoint(pointId, signature);
}

export function rememberStableCircleLinePoint(pointId: string, signature: string, value: Vec2): void {
  rememberStablePoint(pointId, signature, value);
}
