# GeoDraw Architecture Snapshot

Last updated: 2026-02-12  
Branch baseline: `refactor/stage2-app-decomposition`

## Purpose
This snapshot is the stable map for context resets.  
If in doubt, follow this file over chat memory.

## High-Level Module Map

### UI Composition
- `src/App.tsx`
- `src/ui/WorkspaceShell.tsx`
- `src/ui/useAppShellController.ts`
- `src/ui/ObjectBrowser.tsx`
- `src/ui/PropertiesPanel.tsx`
- `src/ui/ToolInfoSection.tsx`
- `src/ui/PointPropertiesSection.tsx`
- `src/ui/ObjectStyleSections.tsx`
- `src/ui/NumbersSection.tsx`

Responsibility:
- Layout, panel composition, and UI state orchestration.
- No geometry math.

### Canvas / Interaction Layer
- `src/view/CanvasView.tsx`
- `src/view/useCanvasInteractionController.ts`
- `src/view/pointerInteraction.ts`
- `src/view/pointerDragInteraction.ts`
- `src/view/pointerEventController.ts`
- `src/view/canvasEventLifecycle.ts`
- `src/view/renderFrame.ts`
- `src/view/interactionHighlights.ts`
- `src/view/labelOverlays.ts`
- `src/view/CanvasLabelsLayer.tsx`
- `src/view/constructClickAdapter.ts`

Responsibility:
- Pointer event flow, drag/pan/hover behavior, draw pipeline orchestration.
- Delegates hit-test and construction intent to engine/store actions.

### State Store (Composed)
- `src/state/geoStore.ts`
- `src/state/slices/*`
  - `sceneCoreActions.ts`
  - `sceneLineAngleActions.ts`
  - `sceneCreationActions.ts`
  - `sceneMutationActions.ts`
  - `interactionActions.ts`
  - `uiActions.ts`
  - `historyActions.ts`

Responsibility:
- App state container + action wiring.
- Should delegate domain-heavy logic to `src/domain/*` and evaluation to `src/scene/*`.

### Domain Helpers
- `src/domain/geometryGraph.ts`
- `src/domain/sceneIntegrity.ts`
- `src/domain/intersectionReuse.ts`
- `src/domain/numberDefinitions.ts`

Responsibility:
- Dependency graph, cascade deletion planning/application, scene integrity normalization, reusable construction helpers.

### Geometry Scene + Evaluation
- `src/scene/points.ts` (public facade + model types)
- `src/scene/eval/*`
  - context/runtime: `evalContext.ts`, `sceneContextBuilder.ts`, `pointRuntime.ts`, `numberRuntime.ts`
  - dispatch/evaluators: `pointEvalDispatch.ts`, `pointKindEvaluators.ts`, `pointIntersectionEvaluators.ts`, `numberEvaluators.ts`, `numberExpressionEvaluators.ts`
  - geometry adapters/access: `geometryAdapters.ts`, `sceneGeometryAccess.ts`, `geometryResolve*.ts`
  - intersections/stability: `intersectionQueries.ts`, `intersectionPairResolution.ts`, `intersectionAssignments.ts`, `intersectionStabilityAdapters.ts`, `stablePointMemory.ts`, `intersectionUtils.ts`
  - math/expression: `angleMath.ts`, `expressionEval.ts`, `expressionRuntime.ts`, `numericExpression.ts`, `numberDefinitions.ts`, `numberSceneEval.ts`

Responsibility:
- Deterministic world evaluation and dependency-safe computations.
- Stable intersection branch behavior and memoized evaluation pipeline.

### Engine Boundary
- `src/engine/index.ts`
- `src/engine/evaluateScene.ts`
- `src/engine/hitTest.ts`
- `src/engine/construct.ts`

Responsibility:
- Headless API boundary for evaluation/hit-test/construction.
- UI should consume these boundaries instead of embedding geometry logic.

### Export
- `src/export/tikz.ts`
- `src/export/tkzWhitelist.ts`
- fixtures: `src/export/__fixtures__/*`
- test harness: `scripts/test-export.mjs`, `scripts/compile-tex.mjs`

Responsibility:
- Fail-closed TikZ/tkz-euclide export.
- No invented macro names/options.

## Boundary Rules (Non-Negotiable)
- UI modules must not implement geometry math.
- `CanvasView` should orchestrate, not own construction semantics.
- `geoStore.ts` should compose actions, not re-grow into a god-file.
- `src/scene/points.ts` should remain facade/types + thin orchestration.
- Exporter must stay fail-closed and deterministic.

## Feature Implementation Protocol (For Future Changes)
When adding/modifying a feature, follow this order and file placement policy:

1. Data model first
- Add/extend types in `src/scene/points.ts` (types/facade only).
- Do not add heavy evaluator logic directly in `points.ts`.

2. Evaluation logic second
- Add pure evaluation code in `src/scene/eval/*`:
  - point/number/circle logic in evaluator modules
  - intersection behavior in intersection modules
  - reuse adapters/runtime helpers instead of inlining in facade files

3. Store wiring third
- Add actions in `src/state/slices/*` by concern:
  - creation actions -> `sceneCreationActions.ts`
  - mutation/update actions -> `sceneMutationActions.ts`
  - line/angle constructors -> `sceneLineAngleActions.ts`
- Keep `src/state/geoStore.ts` as composition/wiring only.

4. Canvas interaction fourth
- Put pointer/tool flow in `src/view/*` helpers/hooks.
- `CanvasView.tsx` should call helpers, not accumulate new large switch blocks.

5. UI/editor fifth
- Put panel/editor UI in `src/ui/*` section components.
- Do not re-inline sections back into `App.tsx` or `PropertiesPanel.tsx`.

6. Export mapping last (fail-closed)
- Implement exporter mapping in `src/export/tikz.ts` only with whitelisted macros/options.
- If unsupported mapping: throw explicit error (never silent fallback).

### “No New God File” Rule
Before merging, verify:
- No large feature-specific logic was appended directly into:
  - `src/App.tsx`
  - `src/view/CanvasView.tsx`
  - `src/state/geoStore.ts`
  - `src/scene/points.ts`
  - `src/ui/PropertiesPanel.tsx`
- If a change needs > ~120 lines in one of these files, split into a dedicated module first.

### Required Checklist Per Feature
1. Add/update fixture/regression test relevant to the feature.
2. Run:
   - `npm run build`
   - `npm run test:export`
3. Update docs if behavior/contracts changed:
   - `docs/handoff.md`
   - `docs/architecture-snapshot.md`
   - `docs/tkz-euclide-contract.md` (if export-related)

## Regression Safety Gates
- Always run after geometry/export changes:
  - `npm run build`
  - `npm run test:export`
- For dependency/deletion changes also run:
  - `node --import tsx src/scene/__tests__/geometry-graph-delete-regression.test.ts`

## Current Known Stable Invariants
- Circle-line “other intersection” does not collapse to excluded point.
- Segment intersections remain finite-domain filtered.
- Point identities are not merged by proximity.
- Directed angle behavior is consistent between preview/final/export.
- `PropertiesPanel` is already decomposed (not a monolith).
