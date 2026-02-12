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
  - `branchIndex` semantics must match evaluation semantics exactly:
    - `branchIndex=0` means first root from `lineCircleIntersectionBranches(...)`
    - `branchIndex=1` means second root from `lineCircleIntersectionBranches(...)`
    - Never reinterpret branch order using x/y sorting or any alternative ordering.
- Main code:
  - `src/state/geoStore.ts`
    - `createStableLineCircleIntersectionPoint(...)`
  - `src/scene/points.ts`
    - `evalPoint(...)` for `circleLineIntersectionPoint`

### 2b) Duplicate line-circle root creation (`L then M` on same root)

- Symptom:
  - Clicking near one line-circle intersection creates a point on the opposite/same already-used root.
  - Re-clicking nearby creates another point on same root (e.g., `L` then `M`), instead of selecting/reusing existing one.
- Root cause:
  - Existing-point reuse checked only proximity to click world, not resolved target root for that construction.
  - Branch identity could drift when creation/evaluation ordering differed.
- Non-negotiable rules:
  - On creation, resolve intended target root first (using same branch semantics as runtime eval).
  - Reuse existing `circleLineIntersectionPoint` on that target root (within epsilon) instead of creating duplicates.
  - If an `excludePointId`-stabilized root is selected, reuse matching `excludePointId` branch when present.
- Main code:
  - `src/state/geoStore.ts`
    - `findExistingIntersectionPointId(...)`
    - `resolveLineCircleTarget(...)`

### 2c) Multi-point branch stealing on same intersection pair

- Symptom:
  - Existing intersection point teleports when another intersection point on the same pair is added/updated.
  - Seen on both line-circle and circle-circle pairs with two valid roots.
- Root cause:
  - Points were resolved independently, allowing sibling points to steal each other's root assignment.
- Non-negotiable rules:
  - Resolve all points for one object pair together per eval tick (pair-level ownership).
  - Assignment priority must be deterministic:
    1) `excludePointId` constraints
    2) nearest to previous resolved world
    3) deterministic fallback
  - In 2-root regime, two distinct dependent points on the same pair must stay on distinct roots unless tangent/degenerate.
- Main code:
  - `src/scene/points.ts`
    - `resolveCircleLinePairAssignments(...)`
    - `resolveGenericIntersectionPairAssignments(...)`

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

### 6) TikZ label placement/halo stability (do not retune casually)

- Symptom:
  - Labels overlap/intersect vertices, or look drastically off after exporter tweaks.
  - Halo circles become huge/tiny and break diagram readability.
- Root cause:
  - Mixing label geometry, font sizing, and halo rendering changes without preserving clearance invariants.
- Non-negotiable rules:
  - Treat `pointLabelOptionsToTikz(...)` + `computeLabelPlacementMap(...)` + `computeLabelBubbleRadiusPx(...)` as guarded.
  - Do **not** retune these constants unless absolutely required and reviewed.
  - Any change to these functions requires explicit warning + revalidation on real scenes.
  - Keep placement deterministic per-point (no global `xshift=yshift` fallback).
- Required validation before merge:
  - `npm run build`
  - `npm run test:export`
  - Manual visual check on at least one dense scene with 10+ labels.
- Main code:
  - `src/export/tikz.ts`

## Verification Commands

Run after geometry/export changes:

```bash
npm run build
npm run test:perf
npm run test:scene
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

## Mandatory Intersection Checklist (before merge)

- No branch-order drift:
  - creation + evaluation both use `lineCircleIntersectionBranches` order.
- No duplicate root creation:
  - repeated click near same line-circle root must select existing point, not add a new one.
- No wrong-root first creation:
  - click-nearest root is the one created/selected on first try.

If any of the above fails, treat as release-blocking regression.

## Future-Proof Note: Tangent Tool Compatibility

When tangent constructions are added later, they must be modeled as a strict degeneracy case and must not relax the stability rules above.

Rules:

- Tangency is `discriminant ~= 0` (line-circle or circle-circle), i.e. one world intersection point with multiplicity.
- In tangent state only, two intersection identities may coincide at the same world point.
- Outside tangent state (two-root regime), branch separation remains strict:
  - no root stealing between sibling intersection points
  - `excludePointId` constraints remain enforced
  - `branchIndex` / branch ordering semantics remain unchanged.
- If intersection regime changes continuously during drag, use epsilon hysteresis around tangent threshold to avoid flicker/teleport near the boundary.
- Prefer introducing an explicit tangent construction type (do not fake tangent behavior via ad-hoc branch switching in generic intersection code).

Why this is compatible with the "correct behavior" contract:

- The current contract already allows coincidence only in true degeneracy.
- Non-degenerate branch ownership stays deterministic and identity-stable.
- Undefined handling remains deterministic (no arbitrary jump to unrelated roots).

## Related Files

- `docs/eval-performance.md`
- `src/scene/__tests__/eval-perf.test.ts`
- `scripts/scene-diagnostics.ts`
