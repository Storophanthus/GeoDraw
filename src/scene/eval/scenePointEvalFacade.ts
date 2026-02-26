import type { Vec2 } from "../../geo/vec2";
import type { SceneModel, ScenePoint } from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { AngleExpressionEvalResult } from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { rememberStableGenericIntersectionPoint, rememberStableCircleLinePoint } from "./intersectionStabilityAdapters";
import { evalPointUnchecked as evalPointUncheckedDispatch } from "./pointEvalDispatch";
import { createSceneIntersectionFacadeWithCtx } from "./sceneIntersectionFacade";

type ScenePointEvalFacadeDeps = {
  getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  evaluateAngleExpressionDegreesWithCtx: (
    scene: SceneModel,
    exprRaw: string,
    ctx: SceneEvalContext
  ) => AngleExpressionEvalResult;
  evaluateNumberExpressionWithCtx: (
    scene: SceneModel,
    exprRaw: string,
    ctx: SceneEvalContext,
    excludeNumberId?: string
  ) => NumberExpressionEvalResult;
};

export function createSceneIntersectionFacadeInPointEval(
  scene: SceneModel,
  ctx: SceneEvalContext,
  deps: Pick<ScenePointEvalFacadeDeps, "getPointWorldById" | "evaluateNumberExpressionWithCtx">
) {
  return createSceneIntersectionFacadeWithCtx(scene, ctx, {
    getPointWorldById: deps.getPointWorldById,
    evaluateNumberExpressionWithCtx: deps.evaluateNumberExpressionWithCtx,
  });
}

export function evalPointUncheckedInSceneWithFacades(
  point: ScenePoint,
  scene: SceneModel,
  ctx: SceneEvalContext,
  deps: ScenePointEvalFacadeDeps
): Vec2 | null {
  let intersectionFacade: ReturnType<typeof createSceneIntersectionFacadeWithCtx> | null = null;
  const getIntersectionFacade = () => {
    if (intersectionFacade) return intersectionFacade;
    intersectionFacade = createSceneIntersectionFacadeInPointEval(scene, ctx, {
      getPointWorldById: deps.getPointWorldById,
      evaluateNumberExpressionWithCtx: deps.evaluateNumberExpressionWithCtx,
    });
    return intersectionFacade;
  };

  return evalPointUncheckedDispatch(point, scene, ctx, {
    getPointWorldById: deps.getPointWorldById,
    resolveLineAnchorsById: (lineId, _scene, c) => {
      const line = c.lineById.get(lineId);
      if (!line) return null;
      return getIntersectionFacade().getSceneGeometryFacade().resolveLineAnchors(line);
    },
    getCircleWorldGeometryById: (circleId, _scene, c) => {
      const circle = c.circleById.get(circleId);
      if (!circle) return null;
      return getIntersectionFacade().getSceneGeometryFacade().getCircleWorldGeometry(circle);
    },
    evaluateAngleExpressionDegreesWithCtx: deps.evaluateAngleExpressionDegreesWithCtx,
    evaluateNumberExpressionWithCtx: deps.evaluateNumberExpressionWithCtx,
    resolveCircleLinePairAssignments: (_scene, _ctx, circleId, lineId, branches, stabilitySignature) =>
      getIntersectionFacade().resolveCircleLinePairAssignments(circleId, lineId, branches, stabilitySignature),
    rememberStableCircleLinePoint,
    objectIntersections: (a, b, _scene, _ctx) => getIntersectionFacade().objectIntersections(a, b),
    resolveGenericIntersectionPairAssignments: (_scene, _ctx, objA, objB, intersections) =>
      getIntersectionFacade().resolveGenericIntersectionPairAssignments(objA, objB, intersections),
    rememberStableGenericIntersectionPoint,
  });
}
