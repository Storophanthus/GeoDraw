import type { Vec2 } from "../../geo/vec2";
import type { SceneModel } from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { evalNumberByIdInSceneWithOps } from "./sceneNumberAccess";
import { createSceneIntersectionFacadeWithCtx } from "./sceneIntersectionFacade";
import { evaluateNumberExpressionWithCtxInSceneModel } from "./sceneExpressionFacade";

type SceneNumberExpressionFacadeDeps = {
  getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
};

function createSceneIntersectionFacadeForNumberEval(
  scene: SceneModel,
  ctx: SceneEvalContext,
  deps: SceneNumberExpressionFacadeDeps
) {
  return createSceneIntersectionFacadeWithCtx(scene, ctx, {
    getPointWorldById: deps.getPointWorldById,
    evaluateNumberExpressionWithCtx: (s, exprRaw, c, excludeNumberId) =>
      evaluateNumberExpressionWithCtxUsingFacades(s, exprRaw, c, deps, excludeNumberId),
  });
}

function createSceneGeometryBridgeResolvers(
  scene: SceneModel,
  ctx: SceneEvalContext,
  deps: SceneNumberExpressionFacadeDeps
): {
  resolveLineAnchorsById: (lineId: string, scene: SceneModel, ctx: SceneEvalContext) => { a: Vec2; b: Vec2 } | null;
  getCircleWorldGeometryById: (
    circleId: string,
    scene: SceneModel,
    ctx: SceneEvalContext
  ) => { center: Vec2; radius: number } | null;
} {
  let intersectionFacade: ReturnType<typeof createSceneIntersectionFacadeWithCtx> | null = null;
  const getIntersectionFacade = () => {
    if (intersectionFacade) return intersectionFacade;
    intersectionFacade = createSceneIntersectionFacadeForNumberEval(scene, ctx, deps);
    return intersectionFacade;
  };

  return {
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
  };
}

export function evalNumberByIdWithSceneFacades(
  id: string,
  scene: SceneModel,
  ctx: SceneEvalContext,
  deps: SceneNumberExpressionFacadeDeps
): number | null {
  const geometryBridge = createSceneGeometryBridgeResolvers(scene, ctx, deps);
  return evalNumberByIdInSceneWithOps(id, scene, ctx, {
    getPointWorldById: deps.getPointWorldById,
    getCircleWorldGeometryById: geometryBridge.getCircleWorldGeometryById,
    evaluateNumberExpressionWithCtx: (s, exprRaw, c, excludeNumberId) =>
      evaluateNumberExpressionWithCtxUsingFacades(s, exprRaw, c, deps, excludeNumberId),
  });
}

export function evaluateNumberExpressionWithCtxUsingFacades(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext,
  deps: SceneNumberExpressionFacadeDeps,
  excludeNumberId?: string
): NumberExpressionEvalResult {
  const geometryBridge = createSceneGeometryBridgeResolvers(scene, ctx, deps);
  return evaluateNumberExpressionWithCtxInSceneModel(
    scene,
    exprRaw,
    ctx,
    {
      getPointWorldById: deps.getPointWorldById,
      evalNumberById: (numberId, s, c) => evalNumberByIdWithSceneFacades(numberId, s, c, deps),
      resolveLineAnchorsById: geometryBridge.resolveLineAnchorsById,
      getCircleWorldGeometryById: geometryBridge.getCircleWorldGeometryById,
    },
    excludeNumberId
  );
}
