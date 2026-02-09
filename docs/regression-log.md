# GeoDraw Regression Log (Non-Negotiable)

Purpose: keep a durable record of high-risk bugs that must not reappear after refactors, context resets, or feature work.

## Usage

- Before changing geometry evaluation, snapping, or exporter logic: read this file.
- After any relevant change: run listed verification commands.
- If a fix requires changing one of the guarded functions below, update this document in the same commit.

## Guarded Regressions

### 1) Canvas missing dependent/intersection points

- Symptom:
  - Points exist in object list but disappear on canvas.
  - Midpoints depending on intersection points become undefined unexpectedly.
- Root cause:
  - Recursive point evaluation cached transient `null` while a dependency was still `inProgress`.
  - Branch-occupancy logic evaluated unrelated dependent points, creating recursive poisoning.
- Non-negotiable rules:
  - Do **not** cache `null` for in-progress cycle guards.
  - In intersection branch occupancy checks, only consider intersection-type points:
    - `intersectionPoint`
    - `circleLineIntersectionPoint`
- Main code:
  - `src/scene/points.ts`
    - `evalPoint(...)`
    - `chooseStableIntersection(...)`

### 2) Wrong line-circle root chosen on first click

- Symptom:
  - Clicking near one intersection creates the opposite intersection first.
- Root cause:
  - Creation-time branch selection was auto-flipped by root occupancy heuristics.
- Non-negotiable rule:
  - Creation branch must follow click-nearest root (`preferredWorld`) deterministically.
  - Do not auto-flip based on occupancy in creation path.
- Main code:
  - `src/state/geoStore.ts`
    - `createStableLineCircleIntersectionPoint(...)`

### 3) Drag slowdown / freeze in dense intersection scenes

- Symptom:
  - Severe lag with many intersections.
- Root cause:
  - Repeated recursive evaluations per tick.
  - Pointermove flood causing too many updates.
- Non-negotiable rules:
  - Per eval tick, each point node should evaluate at most once.
  - Drag updates must be rAF-coalesced.
  - Avoid no-op store emits.
- Main code:
  - `src/scene/points.ts`
    - `beginSceneEvalTick(...)`
    - `endSceneEvalTick(...)`
    - memoized point resolution
  - `src/view/CanvasView.tsx`
    - drag/pan rAF coalescing
  - `src/state/geoStore.ts`
    - guards for unchanged `hoveredHit` / `cursorWorld` / selection

### 4) Exporter emits non-compilable output for undefined points

- Symptom:
  - Exported TikZ fails to compile due to impossible intersections in current configuration.
- Root cause:
  - Export proceeded even when visible points were undefined.
- Non-negotiable rule:
  - Fail closed: if visible point world is undefined, throw clear export error.
- Main code:
  - `src/export/tikz.ts`
    - guard before IR/render output

### 5) `tkzDefPointOnCircle` syntax mismatch by manual assumptions

- Symptom:
  - TeX errors around point-on-circle definition.
- Root cause:
  - Emitting unsupported macro form for installed `tkz-euclide`.
- Non-negotiable rule:
  - Use syntax verified against installed package/manual.
  - Current verified form (TeX Live 2025, tkz-euclide 5.12c):
    - `\tkzDefPointOnCircle[through = center O angle DEG point A]`
    - `\tkzGetPoint{P}`
- Main code:
  - `src/export/tikz.ts`

## Verification Commands

Run after geometry/export changes:

```bash
npm run build
npm run test:perf
npm run test:export
```

For scene-specific debugging:

```bash
npm run diag:scene -- /path/to/scene.json
```

This reports:
- undefined points
- coincident groups
- duplicate construction signatures

## Related Files

- `docs/eval-performance.md`
- `src/scene/__tests__/eval-perf.test.ts`
- `scripts/scene-diagnostics.ts`
