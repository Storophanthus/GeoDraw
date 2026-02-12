import type { Vec2 } from "../../geo/vec2";
import type { SceneEvalContext } from "./sceneContextBuilder";
import { evalNumberByIdWithRuntime } from "./numberRuntime";
import { evalNumberDefinitionInScene } from "./numberSceneEval";
import type { NumberExpressionEvalResult } from "./numericExpression";
import type { SceneModel, SceneNumberDefinition } from "../points";

export function evalNumberByIdWithCtxInScene(
  id: string,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
    getCircleWorldGeometryById: (
      circleId: string,
      scene: SceneModel,
      ctx: SceneEvalContext
    ) => { center: Vec2; radius: number } | null;
    evaluateNumberExpressionWithCtx: (
      scene: SceneModel,
      exprRaw: string,
      ctx: SceneEvalContext,
      excludeNumberId?: string
    ) => NumberExpressionEvalResult;
  }
): number | null {
  const evalNumberDefinition = (
    def: SceneNumberDefinition,
    currentScene: SceneModel,
    currentCtx: SceneEvalContext,
    selfNumberId?: string
  ): number | null =>
    evalNumberDefinitionInScene(
      def,
      {
        getPointWorldById: (pointId) => ops.getPointWorldById(pointId, currentScene, currentCtx),
        getSegmentById: (segmentId) => {
          const seg = currentCtx.segmentById.get(segmentId);
          return seg ? { aId: seg.aId, bId: seg.bId } : null;
        },
        getCircleRadiusById: (circleId) => {
          const geom = ops.getCircleWorldGeometryById(circleId, currentScene, currentCtx);
          return geom ? geom.radius : null;
        },
        getAngleById: (angleId) => {
          const angle = currentCtx.angleById.get(angleId);
          return angle ? { aId: angle.aId, bId: angle.bId, cId: angle.cId } : null;
        },
        evaluateNumberExpression: (expr, excludeNumberId) => {
          const result = ops.evaluateNumberExpressionWithCtx(currentScene, expr, currentCtx, excludeNumberId);
          return result.ok ? result.value : null;
        },
        evalNumberById: (numberId) =>
          evalNumberByIdWithCtxInScene(numberId, currentScene, currentCtx, ops),
      },
      selfNumberId
    );

  return evalNumberByIdWithRuntime<SceneNumberDefinition>(id, {
    hasCache: (numberId) => ctx.numberCache.has(numberId),
    getCache: (numberId) => ctx.numberCache.get(numberId),
    setCache: (numberId, value) => {
      ctx.numberCache.set(numberId, value);
    },
    isInProgress: (numberId) => ctx.numberInProgress.has(numberId),
    addInProgress: (numberId) => {
      ctx.numberInProgress.add(numberId);
    },
    removeInProgress: (numberId) => {
      ctx.numberInProgress.delete(numberId);
    },
    getDefinitionById: (numberId) => {
      const num = ctx.numberById.get(numberId);
      return num ? num.definition : null;
    },
    evalDefinition: (def, selfNumberId) => evalNumberDefinition(def, scene, ctx, selfNumberId),
    onCacheHit: () => {
      ctx.stats.cacheHits += 1;
    },
  });
}
