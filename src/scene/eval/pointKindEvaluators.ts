import type { Vec2 } from "../../geo/vec2";
import {
  evalMidpoint,
  evalPointByRotation,
  evalPointOnCircle,
  evalPointOnLine,
  evalPointOnSegment,
} from "./pointGeometryEval";
import type {
  CircleCenterPoint,
  MidpointFromPoints,
  MidpointFromSegment,
  PointByRotation,
  PointOnCircle,
  PointOnLine,
  PointOnSegment,
  SceneModel,
} from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { AngleExpressionEvalResult } from "./expressionEval";

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
