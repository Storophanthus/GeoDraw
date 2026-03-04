import type { Vec2 } from "../../geo/vec2";

export type SceneEvalStats = {
  tick: number;
  dirtyNodes: number;
  totalNodeEvalCalls: number;
  cacheHits: number;
  circleCircleCalls: number;
  circleLineCalls: number;
  lineLineCalls: number;
  allocationsEstimate: number;
  ms: number;
};

export type SceneEvalContext<TPoint, TVector, TLine, TSegment, TCircle, TAngle, TNumber> = {
  tick: number;
  startedAt: number;
  pointCache: Map<string, Vec2 | null>;
  inProgress: Set<string>;
  pointById: Map<string, TPoint>;
  vectorById: Map<string, TVector>;
  lineById: Map<string, TLine>;
  segmentById: Map<string, TSegment>;
  circleById: Map<string, TCircle>;
  angleById: Map<string, TAngle>;
  numberById: Map<string, TNumber>;
  numberCache: Map<string, number>;
  numberInProgress: Set<string>;
  lineInProgress: Set<string>;
  circleLinePairAssignments: Map<string, Map<string, Vec2 | null>>;
  genericIntersectionPairAssignments: Map<string, Map<string, Vec2 | null>>;
  resolvedLineCache: Map<string, { a: Vec2; b: Vec2 } | null>;
  circleGeometryCache: Map<string, { center: Vec2; radius: number } | null>;
  stats: SceneEvalStats;
  explicit: boolean;
};

type BuildContextArgs<TPoint, TVector, TLine, TSegment, TCircle, TAngle, TNumber> = {
  tick: number;
  startedAt: number;
  explicit: boolean;
  pointById: Map<string, TPoint>;
  vectorById: Map<string, TVector>;
  lineById: Map<string, TLine>;
  segmentById: Map<string, TSegment>;
  circleById: Map<string, TCircle>;
  angleById: Map<string, TAngle>;
  numberById: Map<string, TNumber>;
  dirtyNodes: number;
};

export function buildSceneEvalContext<TPoint, TVector, TLine, TSegment, TCircle, TAngle, TNumber>(
  args: BuildContextArgs<TPoint, TVector, TLine, TSegment, TCircle, TAngle, TNumber>
): SceneEvalContext<TPoint, TVector, TLine, TSegment, TCircle, TAngle, TNumber> {
  const { tick, startedAt, explicit, pointById, vectorById, lineById, segmentById, circleById, angleById, numberById, dirtyNodes } =
    args;
  return {
    tick,
    startedAt,
    pointCache: new Map<string, Vec2 | null>(),
    inProgress: new Set<string>(),
    pointById,
    vectorById,
    lineById,
    segmentById,
    circleById,
    angleById,
    numberById,
    numberCache: new Map<string, number>(),
    numberInProgress: new Set<string>(),
    lineInProgress: new Set<string>(),
    circleLinePairAssignments: new Map<string, Map<string, Vec2 | null>>(),
    genericIntersectionPairAssignments: new Map<string, Map<string, Vec2 | null>>(),
    resolvedLineCache: new Map<string, { a: Vec2; b: Vec2 } | null>(),
    circleGeometryCache: new Map<string, { center: Vec2; radius: number } | null>(),
    stats: {
      tick,
      dirtyNodes,
      totalNodeEvalCalls: 0,
      cacheHits: 0,
      circleCircleCalls: 0,
      circleLineCalls: 0,
      lineLineCalls: 0,
      allocationsEstimate: 0,
      ms: 0,
    },
    explicit,
  };
}

export function isEvalDebugEnabled(): boolean {
  const globalFlag = (globalThis as { __GEODRAW_EVAL_DEBUG__?: unknown }).__GEODRAW_EVAL_DEBUG__;
  if (globalFlag === true || globalFlag === "1") return true;
  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (maybeProcess?.env?.GEODRAW_EVAL_DEBUG === "1") return true;
  return false;
}

export function formatEvalStats(stats: SceneEvalStats): string {
  return `tick=${stats.tick} dirtyNodes=${stats.dirtyNodes} evalCalls=${stats.totalNodeEvalCalls} cacheHits=${stats.cacheHits} circleCircle=${stats.circleCircleCalls} circleLine=${stats.circleLineCalls} lineLine=${stats.lineLineCalls} alloc=${stats.allocationsEstimate} ms=${stats.ms.toFixed(
    2
  )}`;
}

export function getOrCreateSceneEvalContext<TScene extends object, TContext>(
  scene: TScene,
  contexts: WeakMap<TScene, TContext>,
  build: () => TContext
): TContext {
  const existing = contexts.get(scene);
  if (existing) return existing;
  const next = build();
  contexts.set(scene, next);
  return next;
}

export function beginSceneEvalTick<TScene extends object, TContext>(
  scene: TScene,
  contexts: WeakMap<TScene, TContext>,
  build: () => TContext
): void {
  contexts.set(scene, build());
}

export function endSceneEvalTick<TScene extends object, TStats extends SceneEvalStats>(
  scene: TScene,
  contexts: WeakMap<TScene, { stats: TStats; startedAt: number }>,
  lastStats: WeakMap<TScene, TStats>
): TStats | null {
  const ctx = contexts.get(scene);
  if (!ctx) return null;
  ctx.stats.ms = performance.now() - ctx.startedAt;
  const snapshot = { ...ctx.stats };
  lastStats.set(scene, snapshot);
  contexts.delete(scene);
  if (isEvalDebugEnabled()) {
    console.log(formatEvalStats(snapshot));
  }
  return snapshot;
}

export function updateImplicitEvalStats<TScene extends object, TStats extends SceneEvalStats>(
  scene: TScene,
  ctx: { stats: TStats; startedAt: number; explicit: boolean },
  lastStats: WeakMap<TScene, TStats>
): void {
  if (ctx.explicit) return;
  ctx.stats.ms = performance.now() - ctx.startedAt;
  lastStats.set(scene, { ...ctx.stats });
}
