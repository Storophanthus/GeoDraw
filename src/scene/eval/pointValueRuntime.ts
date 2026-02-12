import type { Vec2 } from "../../geo/vec2";
import { evalPointByIdWithRuntime } from "./pointRuntime";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { SceneModel, ScenePoint } from "../points";

export function evalPointWithCtxInScene(
  pointId: string,
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    evalPointUnchecked: (point: ScenePoint, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  return evalPointByIdWithRuntime(pointId, {
    getCache: (id) => ctx.pointCache.get(id),
    setCache: (id, value) => {
      ctx.pointCache.set(id, value);
    },
    isInProgress: (id) => ctx.inProgress.has(id),
    addInProgress: (id) => {
      ctx.inProgress.add(id);
    },
    removeInProgress: (id) => {
      ctx.inProgress.delete(id);
    },
    getPointById: (id) => ctx.pointById.get(id) ?? null,
    evalPointUnchecked: (point) => ops.evalPointUnchecked(point, scene, ctx),
    onCacheHit: () => {
      ctx.stats.cacheHits += 1;
    },
    onNodeEval: () => {
      ctx.stats.totalNodeEvalCalls += 1;
    },
  });
}
