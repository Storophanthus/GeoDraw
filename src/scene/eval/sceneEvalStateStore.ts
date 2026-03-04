import type { SceneModel } from "../points";
import { getOrCreateSceneEvalContext as getOrCreateSceneEvalContextCore, type SceneEvalStats } from "./evalContext";
import { buildSceneEvalContextForScene, type SceneEvalContext } from "./sceneContextBuilder";

export type SceneEvalStateStore = {
  sceneEvalContexts: WeakMap<SceneModel, SceneEvalContext>;
  sceneLastEvalStats: WeakMap<SceneModel, SceneEvalStats>;
  buildSceneEvalContext: (scene: SceneModel, explicit: boolean) => SceneEvalContext;
  getOrCreateSceneEvalContext: (scene: SceneModel) => SceneEvalContext;
};

export function createSceneEvalStateStore(): SceneEvalStateStore {
  const sceneEvalContexts = new WeakMap<SceneModel, SceneEvalContext>();
  const sceneLastEvalStats = new WeakMap<SceneModel, SceneEvalStats>();
  let sceneEvalTick = 0;

  function buildSceneEvalContext(scene: SceneModel, explicit: boolean): SceneEvalContext {
    const tick = ++sceneEvalTick;
    return buildSceneEvalContextForScene(scene, explicit, tick, performance.now());
  }

  function getOrCreateSceneEvalContext(scene: SceneModel): SceneEvalContext {
    return getOrCreateSceneEvalContextCore(scene, sceneEvalContexts, () => buildSceneEvalContext(scene, false));
  }

  return {
    sceneEvalContexts,
    sceneLastEvalStats,
    buildSceneEvalContext,
    getOrCreateSceneEvalContext,
  };
}
