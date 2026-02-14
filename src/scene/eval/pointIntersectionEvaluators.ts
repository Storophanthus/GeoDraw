import { lineCircleIntersectionBranches } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import type {
  CircleCircleIntersectionPoint,
  CircleSegmentIntersectionPoint,
  CircleLineIntersectionPoint,
  GeometryObjectRef,
  IntersectionPoint,
  LineLikeIntersectionPoint,
  SceneModel,
} from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import { circleLineStabilitySignature, genericIntersectionSignature } from "./intersectionUtils";

export function evalCircleLineIntersectionPoint(
  point: CircleLineIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getCircleWorldGeometryWithCtx: (
      circleId: string,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => { center: Vec2; radius: number } | null;
    resolveLineAnchors: (
      lineId: string,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => { a: Vec2; b: Vec2 } | null;
    resolveCircleLinePairAssignments: (
      scene: SceneModel,
      ctx: SceneEvalContext,
      circleId: string,
      lineId: string,
      branches: Array<{ point: Vec2; t: number }>,
      stabilitySignature: string
    ) => Map<string, Vec2 | null>;
    rememberStablePoint: (pointId: string, signature: string, value: Vec2) => void;
  }
): Vec2 | null {
  const geom = ops.getCircleWorldGeometryWithCtx(point.circleId, scene, ctx);
  const anchors = ops.resolveLineAnchors(point.lineId, scene, ctx);
  if (!geom || !anchors) return null;
  const la = anchors.a;
  const lb = anchors.b;
  const center = geom.center;
  const r = geom.radius;
  const stabilitySignature = circleLineStabilitySignature(point.circleId, point.lineId, la, lb, center, r);
  ctx.stats.circleLineCalls += 1;
  const branches = lineCircleIntersectionBranches(la, lb, center, r);
  if (branches.length === 0) return null;

  const pairResolved = ops.resolveCircleLinePairAssignments(
    scene,
    ctx,
    point.circleId,
    point.lineId,
    branches,
    stabilitySignature
  );
  if (!pairResolved.has(point.id)) return null;
  const chosen = pairResolved.get(point.id) ?? null;
  if (!chosen) return null;
  ops.rememberStablePoint(point.id, stabilitySignature, chosen);
  return chosen;
}

export function evalGenericIntersectionPoint(
  point: IntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    objectIntersections: (
      a: GeometryObjectRef,
      b: GeometryObjectRef,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => Vec2[];
    resolveGenericIntersectionPairAssignments: (
      scene: SceneModel,
      ctx: SceneEvalContext,
      objA: GeometryObjectRef,
      objB: GeometryObjectRef,
      intersections: Vec2[]
    ) => Map<string, Vec2 | null>;
    rememberStablePoint: (pointId: string, signature: string, value: Vec2) => void;
  }
): Vec2 | null {
  const intersections = ops.objectIntersections(point.objA, point.objB, scene, ctx);
  if (intersections.length === 0) return null;
  const pairResolved = ops.resolveGenericIntersectionPairAssignments(
    scene,
    ctx,
    point.objA,
    point.objB,
    intersections
  );
  if (!pairResolved.has(point.id)) return null;
  const chosen = pairResolved.get(point.id) ?? null;
  if (!chosen) return null;
  ops.rememberStablePoint(point.id, genericIntersectionSignature(point.objA, point.objB), chosen);
  return chosen;
}

export function evalCircleSegmentIntersectionPoint(
  point: CircleSegmentIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    objectIntersections: (
      a: GeometryObjectRef,
      b: GeometryObjectRef,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => Vec2[];
    resolveGenericIntersectionPairAssignments: (
      scene: SceneModel,
      ctx: SceneEvalContext,
      objA: GeometryObjectRef,
      objB: GeometryObjectRef,
      intersections: Vec2[]
    ) => Map<string, Vec2 | null>;
    rememberStablePoint: (pointId: string, signature: string, value: Vec2) => void;
  }
): Vec2 | null {
  const objA: GeometryObjectRef = { type: "segment", id: point.segId };
  const objB: GeometryObjectRef = { type: "circle", id: point.circleId };
  const intersections = ops.objectIntersections(objA, objB, scene, ctx);
  if (intersections.length === 0) return null;
  const pairResolved = ops.resolveGenericIntersectionPairAssignments(scene, ctx, objA, objB, intersections);
  if (!pairResolved.has(point.id)) return null;
  const chosen = pairResolved.get(point.id) ?? null;
  if (!chosen) return null;
  ops.rememberStablePoint(point.id, genericIntersectionSignature(objA, objB), chosen);
  return chosen;
}

export function evalCircleCircleIntersectionPoint(
  point: CircleCircleIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    objectIntersections: (
      a: GeometryObjectRef,
      b: GeometryObjectRef,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => Vec2[];
    resolveGenericIntersectionPairAssignments: (
      scene: SceneModel,
      ctx: SceneEvalContext,
      objA: GeometryObjectRef,
      objB: GeometryObjectRef,
      intersections: Vec2[]
    ) => Map<string, Vec2 | null>;
    rememberStablePoint: (pointId: string, signature: string, value: Vec2) => void;
  }
): Vec2 | null {
  const objA: GeometryObjectRef = { type: "circle", id: point.circleAId };
  const objB: GeometryObjectRef = { type: "circle", id: point.circleBId };
  const intersections = ops.objectIntersections(objA, objB, scene, ctx);
  if (intersections.length === 0) return null;
  const pairResolved = ops.resolveGenericIntersectionPairAssignments(scene, ctx, objA, objB, intersections);
  if (!pairResolved.has(point.id)) return null;
  const chosen = pairResolved.get(point.id) ?? null;
  if (!chosen) return null;
  ops.rememberStablePoint(point.id, genericIntersectionSignature(objA, objB), chosen);
  return chosen;
}

export function evalLineLikeIntersectionPoint(
  point: LineLikeIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    objectIntersections: (
      a: GeometryObjectRef,
      b: GeometryObjectRef,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => Vec2[];
    resolveGenericIntersectionPairAssignments: (
      scene: SceneModel,
      ctx: SceneEvalContext,
      objA: GeometryObjectRef,
      objB: GeometryObjectRef,
      intersections: Vec2[]
    ) => Map<string, Vec2 | null>;
    rememberStablePoint: (pointId: string, signature: string, value: Vec2) => void;
  }
): Vec2 | null {
  const intersections = ops.objectIntersections(point.objA, point.objB, scene, ctx);
  if (intersections.length === 0) return null;
  const pairResolved = ops.resolveGenericIntersectionPairAssignments(scene, ctx, point.objA, point.objB, intersections);
  if (!pairResolved.has(point.id)) return null;
  const chosen = pairResolved.get(point.id) ?? null;
  if (!chosen) return null;
  ops.rememberStablePoint(point.id, genericIntersectionSignature(point.objA, point.objB), chosen);
  return chosen;
}
