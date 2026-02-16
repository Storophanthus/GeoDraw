import type { Vec2 } from "../../geo/vec2";
import {
  evalPointByDilation,
  evalPointByReflection,
  evalMidpoint,
  evalPointByRotation,
  evalPointByTranslation,
  evalPointByTranslationVector,
  evalPointOnCircle,
  evalPointOnLine,
  evalPointOnSegment,
} from "./pointGeometryEval";
import type {
  CircleCenterPoint,
  MidpointFromPoints,
  MidpointFromSegment,
  PointByDilation,
  PointByReflection,
  PointByRotation,
  PointByTranslation,
  PointOnCircle,
  PointOnLine,
  PointOnSegment,
  SceneVector,
  SceneModel,
  LineLikeObjectRef,
} from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { AngleExpressionEvalResult } from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";

export function evalMidpointPointsPoint(
  point: MidpointFromPoints,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  const pa = ops.getPointWorldById(point.aId, scene, ctx);
  const pb = ops.getPointWorldById(point.bId, scene, ctx);
  if (!pa || !pb) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalMidpoint(pa, pb);
}

export function evalMidpointSegmentPoint(
  point: MidpointFromSegment,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  const seg = ctx.segmentById.get(point.segId);
  if (!seg) return null;
  const pa = ops.getPointWorldById(seg.aId, scene, ctx);
  const pb = ops.getPointWorldById(seg.bId, scene, ctx);
  if (!pa || !pb) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalMidpoint(pa, pb);
}

export function evalPointOnLinePoint(
  point: PointOnLine,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    resolveLineAnchors: (lineId: string, scene: SceneModel, ctx: SceneEvalContext) => { a: Vec2; b: Vec2 } | null;
  }
): Vec2 | null {
  const anchors = ops.resolveLineAnchors(point.lineId, scene, ctx);
  if (!anchors) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointOnLine(anchors, point.s);
}

export function evalPointOnSegmentPoint(
  point: PointOnSegment,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  const seg = ctx.segmentById.get(point.segId);
  if (!seg) return null;
  const a = ops.getPointWorldById(seg.aId, scene, ctx);
  const b = ops.getPointWorldById(seg.bId, scene, ctx);
  if (!a || !b) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointOnSegment(a, b, point.u);
}

export function evalPointOnCirclePoint(
  point: PointOnCircle,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getCircleWorldGeometryWithCtx: (
      circleId: string,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => { center: Vec2; radius: number } | null;
  }
): Vec2 | null {
  const geom = ops.getCircleWorldGeometryWithCtx(point.circleId, scene, ctx);
  if (!geom) return null;
  const { center, radius } = geom;
  ctx.stats.allocationsEstimate += 1;
  return evalPointOnCircle(center, radius, point.t);
}

export function evalPointByRotationPoint(
  point: PointByRotation,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
    evaluateAngleExpressionDegreesWithCtx: (
      scene: SceneModel,
      exprRaw: string,
      ctx: SceneEvalContext
    ) => AngleExpressionEvalResult;
  }
): Vec2 | null {
  const center = ops.getPointWorldById(point.centerId, scene, ctx);
  const base = ops.getPointWorldById(point.pointId, scene, ctx);
  if (!center || !base) return null;
  const expr = point.angleExpr ?? String(point.angleDeg ?? "");
  const exprEval = ops.evaluateAngleExpressionDegreesWithCtx(scene, expr, ctx);
  if (!exprEval.ok) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointByRotation(center, base, exprEval.valueDeg, point.direction);
}

export function evalPointByTranslationPoint(
  point: PointByTranslation,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  const base = ops.getPointWorldById(point.pointId, scene, ctx);
  if (!base) return null;
  if (point.vectorId) {
    const delta = resolveVectorDelta(point.vectorId, scene, ctx, {
      getPointWorldById: ops.getPointWorldById,
    });
    if (!delta) return null;
    ctx.stats.allocationsEstimate += 1;
    return evalPointByTranslationVector(base, delta);
  }
  const from = ops.getPointWorldById(point.fromId, scene, ctx);
  const to = ops.getPointWorldById(point.toId, scene, ctx);
  if (!from || !to) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointByTranslation(base, from, to);
}

function resolveVectorDelta(
  vectorId: string,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  const vector = ctx.vectorById.get(vectorId);
  if (!vector) return null;
  return vectorDeltaFromDefinition(vector, scene, ctx, ops);
}

function vectorDeltaFromDefinition(
  vector: SceneVector,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  if (vector.kind === "freeVector") {
    if (!Number.isFinite(vector.dx) || !Number.isFinite(vector.dy)) return null;
    return { x: vector.dx, y: vector.dy };
  }
  const from = ops.getPointWorldById(vector.fromId, scene, ctx);
  const to = ops.getPointWorldById(vector.toId, scene, ctx);
  if (!from || !to) return null;
  return { x: to.x - from.x, y: to.y - from.y };
}

export function evalPointByDilationPoint(
  point: PointByDilation,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
    evaluateNumberExpressionWithCtx: (
      scene: SceneModel,
      exprRaw: string,
      ctx: SceneEvalContext
    ) => NumberExpressionEvalResult;
  }
): Vec2 | null {
  const base = ops.getPointWorldById(point.pointId, scene, ctx);
  const center = ops.getPointWorldById(point.centerId, scene, ctx);
  if (!base || !center) return null;
  const expr = point.factorExpr?.trim() || (typeof point.factor === "number" ? String(point.factor) : "");
  if (!expr) return null;
  const factorEval = ops.evaluateNumberExpressionWithCtx(scene, expr, ctx);
  if (!factorEval.ok) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointByDilation(base, center, factorEval.value);
}

function resolveLineLikeAxis(
  axis: LineLikeObjectRef,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
    resolveLineAnchorsById: (lineId: string, scene: SceneModel, ctx: SceneEvalContext) => { a: Vec2; b: Vec2 } | null;
  }
): { a: Vec2; b: Vec2 } | null {
  if (axis.type === "line") {
    return ops.resolveLineAnchorsById(axis.id, scene, ctx);
  }
  const seg = ctx.segmentById.get(axis.id);
  if (!seg) return null;
  const a = ops.getPointWorldById(seg.aId, scene, ctx);
  const b = ops.getPointWorldById(seg.bId, scene, ctx);
  if (!a || !b) return null;
  return { a, b };
}

export function evalPointByReflectionPoint(
  point: PointByReflection,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
    resolveLineAnchorsById: (lineId: string, scene: SceneModel, ctx: SceneEvalContext) => { a: Vec2; b: Vec2 } | null;
  }
): Vec2 | null {
  const base = ops.getPointWorldById(point.pointId, scene, ctx);
  if (!base) return null;
  const axis = resolveLineLikeAxis(point.axis, scene, ctx, ops);
  if (!axis) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointByReflection(base, axis.a, axis.b);
}

export function evalCircleCenterPointPoint(
  point: CircleCenterPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getCircleWorldGeometryWithCtx: (
      circleId: string,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => { center: Vec2; radius: number } | null;
  }
): Vec2 | null {
  const geom = ops.getCircleWorldGeometryWithCtx(point.circleId, scene, ctx);
  if (!geom) return null;
  return geom.center;
}
