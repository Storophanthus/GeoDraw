import type { Vec2 } from "../../geo/vec2";

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

