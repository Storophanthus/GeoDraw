import type { Vec2 } from "../../geo/vec2";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { SceneModel, ScenePoint } from "../points";

export function evalPointByIdWithRuntime<TPoint>(
  pointId: string,
  runtime: {
    getCache: (id: string) => Vec2 | null | undefined;
    setCache: (id: string, value: Vec2 | null) => void;
    isInProgress: (id: string) => boolean;
    addInProgress: (id: string) => void;
    removeInProgress: (id: string) => void;
    getPointById: (id: string) => TPoint | null;
    evalPointUnchecked: (point: TPoint) => Vec2 | null;
    onCacheHit: () => void;
    onNodeEval: () => void;
  }
): Vec2 | null {
  const cached = runtime.getCache(pointId);
  if (cached !== undefined) {
    runtime.onCacheHit();
    return cached;
  }
  if (runtime.isInProgress(pointId)) {
    // Cycle guard: return transient null without caching, otherwise we may
    // incorrectly freeze a valid downstream point as null for this tick.
    return null;
  }
  const point = runtime.getPointById(pointId);
  if (!point) {
    runtime.setCache(pointId, null);
    return null;
  }
  runtime.addInProgress(pointId);
  runtime.onNodeEval();
  const computed = runtime.evalPointUnchecked(point);
  if (computed !== null) {
    runtime.setCache(pointId, computed);
  }
  runtime.removeInProgress(pointId);
  return computed;
}

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
