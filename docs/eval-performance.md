# Evaluation Performance Counters

GeoDraw now exposes per-recompute evaluation counters in `src/scene/points.ts`.

## Counters

- `totalNodeEvalCalls`: number of point-node evaluations executed in the tick
- `cacheHits`: memoization hits inside the tick
- `circleCircleCalls`: circle-circle intersection operations
- `circleLineCalls`: circle-line intersection operations
- `lineLineCalls`: line-line intersection operations
- `allocationsEstimate`: estimated hot-path point allocations
- `ms`: tick duration in milliseconds

## Debug logging

Enable one-line per-tick logging:

```bash
GEODRAW_EVAL_DEBUG=1 npm run dev
```

Log format:

```text
tick=X dirtyNodes=Y evalCalls=Z cacheHits=... circleCircle=... circleLine=... lineLine=... alloc=... ms=T
```

## Perf regression test

Run:

```bash
npm run test:perf
```

The test builds a synthetic 3-circle scene with 30+ intersections and asserts evaluation stays near-linear (no recursive explosion).
