import type { Vec2 } from "../../geo/vec2";
import type { SceneModel, SceneNumber } from "../points";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { evalNumberByIdWithCtxInScene } from "./numberEvaluators";

export function evalNumberByIdInSceneWithOps(
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
  return evalNumberByIdWithCtxInScene(id, scene, ctx, ops);
}

export function getNumberValueInScene(
  numOrId: SceneNumber | string,
  scene: SceneModel,
  ops: {
    getOrCreateSceneEvalContext: (scene: SceneModel) => SceneEvalContext;
    evalNumberById: (id: string, scene: SceneModel, ctx: SceneEvalContext) => number | null;
    updateImplicitEvalStats: (scene: SceneModel, ctx: SceneEvalContext) => void;
  }
): number | null {
  const id = typeof numOrId === "string" ? numOrId : numOrId.id;
  const ctx = ops.getOrCreateSceneEvalContext(scene);
  const value = ops.evalNumberById(id, scene, ctx);
  ops.updateImplicitEvalStats(scene, ctx);
  return value;
}
