import type { SceneModel } from "../points";
import type { AngleExpressionEvalResult } from "./expressionEval";
import { beginSceneEvalTick as beginSceneEvalTickCore, endSceneEvalTick as endSceneEvalTickCore, type SceneEvalStats } from "./evalContext";
import type { NumberExpressionEvalResult } from "./numericExpression";
import type { SceneEvalContext } from "./sceneContextBuilder";

export function beginSceneEvalTickInScenePublic(
  scene: SceneModel,
  deps: {
    sceneEvalContexts: WeakMap<SceneModel, SceneEvalContext>;
    buildSceneEvalContext: (scene: SceneModel, explicit: boolean) => SceneEvalContext;
  }
): void {
  beginSceneEvalTickCore(scene, deps.sceneEvalContexts, () => deps.buildSceneEvalContext(scene, true));
}

export function endSceneEvalTickInScenePublic(
  scene: SceneModel,
  deps: {
    sceneEvalContexts: WeakMap<SceneModel, SceneEvalContext>;
    sceneLastEvalStats: WeakMap<SceneModel, SceneEvalStats>;
  }
): SceneEvalStats | null {
  return endSceneEvalTickCore(scene, deps.sceneEvalContexts, deps.sceneLastEvalStats);
}

export function getLastSceneEvalStatsInScenePublic(
  scene: SceneModel,
  sceneLastEvalStats: WeakMap<SceneModel, SceneEvalStats>
): SceneEvalStats | null {
  return sceneLastEvalStats.get(scene) ?? null;
}

export function evaluateAngleExpressionDegreesInScenePublic(
  scene: SceneModel,
  exprRaw: string,
  deps: {
    getOrCreateSceneEvalContext: (scene: SceneModel) => SceneEvalContext;
    evaluateAngleExpressionDegreesWithCtx: (
      scene: SceneModel,
      exprRaw: string,
      ctx: SceneEvalContext
    ) => AngleExpressionEvalResult;
  }
): AngleExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty angle expression." };
  const ctx = deps.getOrCreateSceneEvalContext(scene);
  return deps.evaluateAngleExpressionDegreesWithCtx(scene, expr, ctx);
}

export function evaluateNumberExpressionInScenePublic(
  scene: SceneModel,
  exprRaw: string,
  deps: {
    getOrCreateSceneEvalContext: (scene: SceneModel) => SceneEvalContext;
    evaluateNumberExpressionWithCtx: (
      scene: SceneModel,
      exprRaw: string,
      ctx: SceneEvalContext
    ) => NumberExpressionEvalResult;
  }
): NumberExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty number expression." };
  const ctx = deps.getOrCreateSceneEvalContext(scene);
  return deps.evaluateNumberExpressionWithCtx(scene, expr, ctx);
}
