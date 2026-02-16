import type { Vec2 } from "../../geo/vec2";
import type {
  CircleCircleIntersectionPoint,
  CircleSegmentIntersectionPoint,
  CircleCenterPoint,
  CircleLineIntersectionPoint,
  GeometryObjectRef,
  IntersectionPoint,
  MidpointFromPoints,
  MidpointFromSegment,
  PointByDilation,
  PointByReflection,
  PointByRotation,
  PointByTranslation,
  PointOnCircle,
  PointOnLine,
  PointOnSegment,
  SceneModel,
  ScenePoint,
  LineLikeIntersectionPoint,
} from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { AngleExpressionEvalResult } from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";
import {
  evalCircleCircleIntersectionPoint,
  evalCircleSegmentIntersectionPoint,
  evalCircleLineIntersectionPoint,
  evalGenericIntersectionPoint,
  evalLineLikeIntersectionPoint,
} from "./pointIntersectionEvaluators";
import {
  evalCircleCenterPointPoint,
  evalPointByDilationPoint,
  evalPointByReflectionPoint,
  evalMidpointPointsPoint,
  evalMidpointSegmentPoint,
  evalPointByRotationPoint,
  evalPointByTranslationPoint,
  evalPointOnCirclePoint,
  evalPointOnLinePoint,
  evalPointOnSegmentPoint,
} from "./pointKindEvaluators";

export type PointEvalDispatchOps = {
  getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  resolveLineAnchorsById: (lineId: string, scene: SceneModel, ctx: SceneEvalContext) => { a: Vec2; b: Vec2 } | null;
  getCircleWorldGeometryById: (
    circleId: string,
    scene: SceneModel,
    ctx: SceneEvalContext
  ) => { center: Vec2; radius: number } | null;
  evaluateAngleExpressionDegreesWithCtx: (
    scene: SceneModel,
    exprRaw: string,
    ctx: SceneEvalContext
  ) => AngleExpressionEvalResult;
  evaluateNumberExpressionWithCtx: (
    scene: SceneModel,
    exprRaw: string,
    ctx: SceneEvalContext
  ) => NumberExpressionEvalResult;
  resolveCircleLinePairAssignments: (
    scene: SceneModel,
    ctx: SceneEvalContext,
    circleId: string,
    lineId: string,
    branches: Array<{ point: Vec2; t: number }>,
    stabilitySignature: string
  ) => Map<string, Vec2 | null>;
  rememberStableCircleLinePoint: (pointId: string, signature: string, value: Vec2) => void;
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
    points: Vec2[]
  ) => Map<string, Vec2 | null>;
  rememberStableGenericIntersectionPoint: (
    pointId: string,
    a: GeometryObjectRef,
    b: GeometryObjectRef,
    value: Vec2
  ) => void;
};

export function evalPointUnchecked(
  point: ScenePoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  if (point.kind === "free") return point.position;

  if (point.kind === "midpointPoints") return evalMidpointPoints(point, scene, ctx, ops);
  if (point.kind === "midpointSegment") return evalMidpointSegment(point, scene, ctx, ops);
  if (point.kind === "pointOnLine") return evalPointOnLine(point, scene, ctx, ops);
  if (point.kind === "pointOnSegment") return evalPointOnSegment(point, scene, ctx, ops);
  if (point.kind === "pointOnCircle") return evalPointOnCircle(point, scene, ctx, ops);
  if (point.kind === "pointByRotation") return evalPointByRotation(point, scene, ctx, ops);
  if (point.kind === "pointByTranslation") return evalPointByTranslation(point, scene, ctx, ops);
  if (point.kind === "pointByDilation") return evalPointByDilation(point, scene, ctx, ops);
  if (point.kind === "pointByReflection") return evalPointByReflection(point, scene, ctx, ops);
  if (point.kind === "circleCenter") return evalCircleCenterPoint(point, scene, ctx, ops);
  if (point.kind === "circleLineIntersectionPoint") return evalCircleLineIntersection(point, scene, ctx, ops);
  if (point.kind === "circleSegmentIntersectionPoint") return evalCircleSegmentIntersection(point, scene, ctx, ops);
  if (point.kind === "circleCircleIntersectionPoint") return evalCircleCircleIntersection(point, scene, ctx, ops);
  if (point.kind === "lineLikeIntersectionPoint") return evalLineLikeIntersection(point, scene, ctx, ops);
  return evalGenericIntersection(point, scene, ctx, ops);
}

function evalMidpointPoints(
  point: MidpointFromPoints,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalMidpointPointsPoint(point, scene, ctx, { getPointWorldById: ops.getPointWorldById });
}

function evalMidpointSegment(
  point: MidpointFromSegment,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalMidpointSegmentPoint(point, scene, ctx, { getPointWorldById: ops.getPointWorldById });
}

function evalPointOnLine(
  point: PointOnLine,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalPointOnLinePoint(point, scene, ctx, {
    resolveLineAnchors: ops.resolveLineAnchorsById,
  });
}

function evalPointOnSegment(
  point: PointOnSegment,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalPointOnSegmentPoint(point, scene, ctx, { getPointWorldById: ops.getPointWorldById });
}

function evalPointOnCircle(
  point: PointOnCircle,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalPointOnCirclePoint(point, scene, ctx, {
    getCircleWorldGeometryWithCtx: ops.getCircleWorldGeometryById,
  });
}

function evalPointByRotation(
  point: PointByRotation,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalPointByRotationPoint(point, scene, ctx, {
    getPointWorldById: ops.getPointWorldById,
    evaluateAngleExpressionDegreesWithCtx: ops.evaluateAngleExpressionDegreesWithCtx,
  });
}

function evalPointByTranslation(
  point: PointByTranslation,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalPointByTranslationPoint(point, scene, ctx, {
    getPointWorldById: ops.getPointWorldById,
  });
}

function evalPointByDilation(
  point: PointByDilation,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalPointByDilationPoint(point, scene, ctx, {
    getPointWorldById: ops.getPointWorldById,
    evaluateNumberExpressionWithCtx: ops.evaluateNumberExpressionWithCtx,
  });
}

function evalPointByReflection(
  point: PointByReflection,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalPointByReflectionPoint(point, scene, ctx, {
    getPointWorldById: ops.getPointWorldById,
    resolveLineAnchorsById: ops.resolveLineAnchorsById,
  });
}

function evalCircleCenterPoint(
  point: CircleCenterPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalCircleCenterPointPoint(point, scene, ctx, {
    getCircleWorldGeometryWithCtx: ops.getCircleWorldGeometryById,
  });
}

function evalCircleLineIntersection(
  point: CircleLineIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalCircleLineIntersectionPoint(point, scene, ctx, {
    getCircleWorldGeometryWithCtx: ops.getCircleWorldGeometryById,
    resolveLineAnchors: ops.resolveLineAnchorsById,
    resolveCircleLinePairAssignments: ops.resolveCircleLinePairAssignments,
    rememberStablePoint: ops.rememberStableCircleLinePoint,
  });
}

function evalGenericIntersection(
  point: IntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalGenericIntersectionPoint(point, scene, ctx, {
    objectIntersections: ops.objectIntersections,
    resolveGenericIntersectionPairAssignments: ops.resolveGenericIntersectionPairAssignments,
    rememberStablePoint: (pointId, _signature, value) =>
      ops.rememberStableGenericIntersectionPoint(pointId, point.objA, point.objB, value),
  });
}

function evalCircleSegmentIntersection(
  point: CircleSegmentIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalCircleSegmentIntersectionPoint(point, scene, ctx, {
    objectIntersections: ops.objectIntersections,
    resolveGenericIntersectionPairAssignments: ops.resolveGenericIntersectionPairAssignments,
    rememberStablePoint: (pointId, _signature, value) =>
      ops.rememberStableGenericIntersectionPoint(pointId, { type: "segment", id: point.segId }, { type: "circle", id: point.circleId }, value),
  });
}

function evalCircleCircleIntersection(
  point: CircleCircleIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalCircleCircleIntersectionPoint(point, scene, ctx, {
    objectIntersections: ops.objectIntersections,
    resolveGenericIntersectionPairAssignments: ops.resolveGenericIntersectionPairAssignments,
    rememberStablePoint: (pointId, _signature, value) =>
      ops.rememberStableGenericIntersectionPoint(pointId, { type: "circle", id: point.circleAId }, { type: "circle", id: point.circleBId }, value),
  });
}

function evalLineLikeIntersection(
  point: LineLikeIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: PointEvalDispatchOps
): Vec2 | null {
  return evalLineLikeIntersectionPoint(point, scene, ctx, {
    objectIntersections: ops.objectIntersections,
    resolveGenericIntersectionPairAssignments: ops.resolveGenericIntersectionPairAssignments,
    rememberStablePoint: (pointId, _signature, value) =>
      ops.rememberStableGenericIntersectionPoint(pointId, point.objA, point.objB, value),
  });
}
