# GeoDraw Handoff (Stability Contract)

## Branch / Baseline
- Active branch: `feat/core-redefine-engine`
- Keep commits small and scoped.
- Do not bundle unrelated files in feature commits.
- Architecture map reference: `docs/architecture-snapshot.md`
- Feature implementation protocol (must follow): see `docs/architecture-snapshot.md` section
  "Feature Implementation Protocol (For Future Changes)".

## Feature Start Protocol (Mandatory)
- Re-open `docs/codex/CONTRACT.md` before touching code.
- Re-open this file (`docs/handoff.md`) and confirm current active work.
- Define expected module touch-set first; avoid ad-hoc edits outside that set.
- For multi-cycle features:
  - checkpoint commit at stable milestones,
  - update this handoff with `Done / Next / Risks`,
  - resume from handoff state, not memory.
- Tool-Command parity (mandatory):
  - Any newly added UI construction tool must ship with a Command Bar counterpart in the same feature cycle.
  - Required minimum:
    - parser support in `src/CommandParser.ts`
    - command execution wiring (store/API) + user feedback in `src/CommandBar.tsx`
    - docs update (`docs/command-bar-reference.md` + this handoff)
    - regression tests for parser/behavior.

## Done (Current Truth)
- 2026-02-16 stability + UX batch:
  - Assignment label propagation for created points is enforced in command assignment flow:
    - assigned point aliases now overwrite point `name` and `captionTex` to assignment label.
    - anchor: `src/state/geoStore.ts` (`applyAssignedPointLabel` usage in object assignment paths).
  - Grid-snap duplicate point regression fixed for line/segment continuation click flow:
    - reuses snapped existing point IDs instead of creating duplicate free points at same snapped world.
    - regression: `src/scene/__tests__/grid-snap-point-reuse.test.ts`.
  - Perpendicular tool now resolves polygon edges as segments (both click orders):
    - hit-test priority changed so polygon boundary clicks resolve to edge segment first.
    - files: `src/engine/hitTest.ts`, `src/view/canvasInteractionHelpers.ts`.
    - regression: `src/scene/__tests__/perp-line-polygon-edge.test.ts`.
  - Polygon tool now renders translucent in-progress fill preview (GeoGebra-like):
    - file: `src/view/previews/pendingPreview.ts`.
    - regression: `src/scene/__tests__/polygon-preview-fill.test.ts`.
  - Polygon border rendering now respects owned-segment visibility:
    - hiding polygon-owned segments hides corresponding polygon border edges while preserving fill.
    - file: `src/view/renderers/polygons.ts`.
    - regression: `src/scene/__tests__/polygon-owned-segment-visibility.test.ts`.
  - Validation:
    - `npm run test:scene`
    - `npm run test:command`
    - `npm run test:export`
    - `npm run build`
- Camera/zoom stability batch completed (commit `0e2c62a`):
  - Expanded camera zoom bounds in `src/view/camera.ts` for better infinite-zoom behavior (`1e-30..1e30`).
  - Added viewport/LOD guards for huge/offscreen circles in:
    - `src/view/snapEngine.ts`
    - `src/engine/hitTest.ts`
  - Added deterministic snap operation budget per frame:
    - bounded pairwise snap loops in `findBestSnap(...)`
    - fixed budget wiring in `src/view/CanvasView.tsx`
  - Added recovery hotkey: `Shift+F` triggers Fit View.
  - Fit View action moved to top actions (next to Undo/Redo), not in left tool groups.
  - Added regression/perf gate:
    - `scripts/zoom-stress.ts`
    - `npm run test:zoom`
- Sector status:
  - Sector endpoint/tool-flow detachment bug is considered fixed for current reported cases.
  - Do not reopen sector endpoint detachment without a new reproducible JSON.
- Correctness track (intersection semantics) advanced:
  - `intersectionPoint` now supports optional `branchIndex` and evaluation honors it for two-root generic intersections.
  - Generic intersection creation records deterministic `branchIndex` when two roots exist.
  - Existing generic intersection reuse now respects `branchIndex` (not just `preferredWorld` proximity).
  - Snapshot export includes `intersectionPoint.definition.branchIndex`.
  - Restore path backfills missing `branchIndex` where deterministically resolvable.
  - Added regression test: branch index must override misleading preferred seed for generic two-root intersections.
  - Added mixed-scene regression coverage to enforce branch persistence (`0/1`) under drag for:
    - segment-circle generic two-root intersections
    - circle-circle generic two-root intersections
- Debug visibility track added:
  - Export panel has `Include evaluated world coords (debug)` for Model JSON.
  - New export path emits `debugPointWorld` with runtime-evaluated coordinates per point.
- `PropertiesPanel` is already decomposed and **not** a monolith now:
  - `src/ui/PropertiesPanel.tsx` (~373 lines, orchestration/composition)
  - `src/ui/ToolInfoSection.tsx`
  - `src/ui/PointPropertiesSection.tsx`
  - `src/ui/ObjectStyleSections.tsx`
  - `src/ui/NumbersSection.tsx`
- `App.tsx` and `CanvasView` decomposition work is in place (controller/shell + extracted interaction/render helpers).
- `geoStore` has action/domain extraction in place (scene/interaction/ui/history actions, domain helpers).
- `scene` eval decomposition is in place under `src/scene/eval/*` with consolidation pass done.
- All recent refactor checkpoints were validated with:
  - `npm run build`
  - `npm run test:export`
- Tangent-line feature wiring is now integrated end-to-end:
  - New line kind: `tangent` (model + eval + integrity + dependency graph)
  - Tool id: `tangent_line` under `LINES` group
  - Interaction flow supports point→circle and circle→point selection
  - Pending preview draws tangent candidates (RAF-driven render path)
  - Construction descriptions include tangent language
  - Export handles tangent lines deterministically via computed tangent helper point + `\\tkzDrawLine`
  - Regression fixture added: `src/export/__fixtures__/tangent-line-through-point.json`
- Process guardrails added:
  - PR checklist template: `.github/pull_request_template.md`
  - Handoff enforcement script: `scripts/check-handoff-update.mjs`
  - CI workflow: `.github/workflows/guardrails.yml`
  - npm command: `npm run check:handoff`
- Command Bar references upgrade added:
  - New parser: `src/CommandParser.ts` (pure parser/evaluator, no store side effects).
  - New UI: `src/CommandBar.tsx` fixed at bottom of workspace.
  - Supported constructors:
    - `Point(x,y)`
    - `Line(x1,y1,x2,y2)` and `Line(A,B)`
    - `Segment(A,B)`
    - `Circle(x,y,r)`, `Circle(O,A)`, `Circle(O,r)`
    - `Distance(A,B)` (evaluation only; creates nothing)
  - Label resolution rules:
    - exact label match
    - unknown => `Unknown point: <id>`
    - non-point => `Not a point: <id>`
    - ambiguous => `Ambiguous identifier: <id>`
  - Expression eval supports safe allowlist functions/constants and `ans` chaining.
  - Input safety guards:
    - max length cap
    - disallowed token filter (`import`, `createUnit`, `unit`, `range`, `ones`, `zeros`, `matrix`)
    - AST allowlist validation for symbols/functions/operators.
  - Feedback:
    - success/error status text
    - expression result display
    - history up/down (last 20)
    - Esc clears input.
- Command Bar Phase 2 assignments added:
  - Assignment syntax:
    - scalar: `n_1 = 2.023242`
    - named objects: `B = Point(...)`, `l = Line(...)`, `s = Segment(...)`, `c_1 = Circle(...)`
  - Parser remains pure and now returns deterministic assignment intents:
    - `assignScalar`
    - `assignObject`
  - Scalar assignments now create visible scene `Number` objects (constants) via store API.
  - Scalar lookup for command evaluation is derived from current scene numbers (`getScalarVars`), not hidden-only state.
  - Named non-point object aliases added in store:
    - `commandObjectAliases` map + `getCommandObjectAliases`
  - Label/name conflict policy enforced (Phase 2):
    - no overwrite for scalar names
    - no overwrite for existing point labels
    - no overwrite for tracked command object aliases
  - `Circle(O, X)` resolution priority is deterministic:
    - if `X` is a point label => center-through circle
    - else if `X` is a scalar name => center-radius circle
    - else error
  - Snapshot semantics are explicit:
    - scalar vars are evaluated at command execution time
    - existing objects do not auto-update on scalar reassignment
- Command Bar Phase 3 (minimal dynamic dependency step):
  - `Circle(O, rExpr)` from Command Bar now preserves the radius expression string (`rExpr`) through parse/execute.
  - Creation path now calls fixed-radius circle creation with the original expression when available, not only frozen numeric text.
  - Practical effect: circles created from scalar names/expressions can update when referenced scene numbers change.
- Command Bar math usability upgrade:
  - Added constant aliases: `Pi`, `PI` (in addition to `pi`).
  - Added trig aliases: `Sin`, `Cos`, `Tan` (in addition to lowercase).
  - Added concise user reference doc: `docs/command-bar-reference.md`.
- Command Bar parity expansion (homework #2 complete):
  - Added tool-command counterparts:
    - `Midpoint(A,B)` and `Midpoint(s)`
    - `Perpendicular(P,l)`
    - `Parallel(P,l)`
    - `Tangent(P,c)` (non-assignable; may create 2 lines)
    - `AngleBisector(A,B,C)`
    - `Angle(A,B,C)`
    - `AngleFixed(V,A,expr[,CW|CCW])`
    - `Sector(O,A,B)`
    - `Circle3P(A,B,C)` (`CircleThreePoint` alias)
  - Parser now resolves point aliases through command alias table as fallback.
  - Added parser tests for new commands and assignment guard on tangent multi-create.
- Regular Polygon tool + command parity (new):
  - New tool id: `regular_polygon` in SHAPES group.
  - Tool flow: click point A, click point B, create regular `n`-gon from edge `AB` (deterministic CCW build).
  - New tool setting in state/UI: `regularPolygonTool.sides` (integer clamped to `[3,64]`), editable from Properties panel tool info.
  - New core creation action: `createRegularPolygon(aId,bId,sides)` (atomic, fail-closed, no partial writes).
  - Vertex generation is dependency-safe:
    - creates derived vertices as `pointByRotation` chain (`radiusMode:"keep"`) so dragging base points updates polygon.
  - Polygon edges are auto-created as owned segments (`ownedByPolygonIds`) using the same ownership semantics as standard polygon creation.
  - Command Bar support:
    - `RegularPolygon(A,B,n)` -> `CreateRegularPolygonFromEdge`
    - assignment form supported: `rp = RegularPolygon(A,B,n)`.
  - Preview/highlight support added for pending regular polygon construction.
- Command redefine/edit (homework #3 slice 1):
  - Assignment redefinition is enabled for:
    - existing constant numbers (`n = ...` updates value in place),
    - existing free points (`A = Point(...)` or point-expression assignment updates coordinates in place).
  - Parser no longer blocks same-name assignments at parse-time; execution layer enforces fail-closed updates.
  - Non-free points and non-constant numbers reject redefinition explicitly.
  - Parser regression tests updated for same-name assignment semantics.
- Command redefine core planner (homework #5 checkpoint):
  - Added `src/domain/redefinePlanner.ts` as the validate-first redefine core for alias-targeted assignments.
  - `commandBarApi.applyObjectAssignment(...)` now performs planner preflight before any mutate path.
  - Added point-alias redefine support for free-point aliases; non-free point aliases remain fail-closed.
  - Added redefine regression coverage:
    - free point alias updates in place
    - non-free point alias redefine rejects with no mutation.
- Export now auto-emits optional TikZ pattern libraries only when needed:
  - no pattern styles => no `\\usetikzlibrary{patterns}` line emitted
  - classic pattern styles (`pattern=...`, `pattern color=...`) => emits exactly `\\usetikzlibrary{patterns}`
  - meta pattern styles (`pattern={...}`) => emits exactly `\\usetikzlibrary{patterns,patterns.meta}`
  - deterministic: single line, stable ordering, no duplicates
- Properties panel now exposes fill pattern controls for current fill-capable objects:
  - Circle style: `Fill Pattern`, `Pattern Color`
  - Angle/Sector style: `Fill Pattern`, `Pattern Color`
  - Backed by typed style fields: `pattern`, `patternColor`
  - Export picks these up automatically (`pattern=...`, `pattern color=...`) and injects required TikZ library lines.
- Angle mark cosmetics upgraded with deterministic right-angle detection:
  - Right-angle detection uses `isRightAngle` (dot-product EPS in `src/scene/eval/angleMath.ts`).
  - UI is conditional:
    - right angles: `RightSquare`, `RightArcDot`, `None`
    - non-right angles: `Vanilla`, `Arc+|`, `Arc+||`, `Arc+|||`, `Double`, `Triple`, `None`
  - Export mapping:
    - non-right -> `\\tkzMarkAngle[arc=l|ll|lll,...]` (+ optional `mark`, `mksize`, `mkcolor`, `mkpos`)
    - right square -> `\\tkzMarkRightAngles[...]`
    - right arc-dot -> `\\tkzMarkRightAngles[german,...]`
  - Added export regression fixtures for all mark variants.
- Right-angle provenance fallback hardened for imported/saved scenes:
  - `isRightExact` is now resolved from provenance when field is missing (not forced to `false`).
  - Covers intersection-vertex case where angle rays lie on a perpendicular line and its base segment.
  - Added regression fixture: `src/export/__fixtures__/angle-right-exact-intersection-vertex.json`.
- Current right-angle fallback policy:
  - provenance first (exact construction relation),
  - then deterministic numeric fallback at high precision (`eps=1e-16`) for unresolved legacy/imported cases.
- Performance optimization and handoff integrity fixes (Completed):
  - `rightAngleProvenance.ts` now uses `Map`/`Set` for O(1) lookups (linear scan removed).
  - `SceneEvalContext` now caches resolved line anchors and circle geometry per-tick.
  - Geometry adapters (`resolveLineAnchors`, `getCircleWorldGeometry`) use this cache to eliminate redundant ops.
  - Verified benchmarks: ~0.47ms/tick on dense 52-node scene.
  - `APPROX_RIGHT_EPS` reverted to `1e-2` (visual/practical hints) to fix strictness regression.
  - `FileControls.tsx` now enforces structural validation on import (fail-closed).
  - `historyActions.ts` `loadSnapshot` fixed to prevent double-undo entry creation.
- Semantic intersection hardening (checkpoint):
  - Added `resolveIntersectionBranchIndexInScene(scene, objA, objB, preferredWorld)` in `src/domain/intersectionReuse.ts`.
  - `normalizeSceneIntegrity` now backfills missing `intersectionPoint.branchIndex` for two-root generic intersections.
  - Export branch inference now prefers explicit `intersectionPoint.branchIndex` when present (line-circle and circle-circle), using `preferredWorld` only as fallback.
  - Added regression: `testNormalizeBackfillsMissingGenericBranchIndex` in `src/scene/__tests__/intersection-ownership-regression.test.ts`.
- Semantic intersections (checkpoint 3):
  - New point kind: `circleSegmentIntersectionPoint` for deterministic segment-circle intersections.
  - `createIntersectionPoint` now emits `circleSegmentIntersectionPoint` for `(segment,circle)` object pairs.
  - Eval pipeline supports the new kind (`pointEvalDispatch` + pair assignment resolution).
  - Integrity/dependency layers now track the new kind:
    - `normalizeSceneIntegrity` validates circle/segment refs and exclude-point refs.
    - `geometryGraph` dependency edges include circle+segment parents.
  - Export supports the new semantic kind directly (mapped to `InterLC` with segment endpoints as line anchors).
  - Model snapshot export supports new definition kind:
    - `circleSegmentIntersectionPoint` in `constructionSnapshot`.
  - Added export regression fixture:
    - `src/export/__fixtures__/circle-segment-intersection-semantic.json`.
- Semantic intersections (checkpoint 4):
  - New point kind: `circleCircleIntersectionPoint` for deterministic circle-circle intersections.
  - `createIntersectionPoint` now emits this semantic kind for `(circle,circle)` object pairs.
  - Eval pipeline supports the new kind (`pointEvalDispatch` + generic pair assignment resolution by explicit circle IDs).
  - Integrity/dependency layers now track the new kind:
    - `normalizeSceneIntegrity` validates both circle refs + exclude-point refs.
    - `geometryGraph` dependency edges include both circles.
  - Export supports the new semantic kind directly (mapped to `InterCC` with explicit `branchIndex` semantics).
  - Snapshot export + diagnostics/test fixture hydration support the new kind.
  - Added export regression fixture:
    - `src/export/__fixtures__/circle-circle-intersection-semantic.json`.
- Semantic intersections (checkpoint 5):
  - New point kind: `lineLikeIntersectionPoint` for deterministic intersections between:
    - line-line
    - line-segment
    - segment-segment
  - `createIntersectionPoint` now emits this semantic kind for line-like pairs instead of generic `intersectionPoint`.
  - Eval pipeline supports the new kind via generic pair assignment with explicit line-like refs.
  - Integrity/dependency/export/snapshot/diagnostics support added.
  - Added export regression fixture:
    - `src/export/__fixtures__/line-like-intersection-semantic.json`.
- Semantic branch indexing generalized for generic intersections:
  - `intersectionPoint.branchIndex` now supports non-binary indices (`number`), not just `0|1`.
  - `resolveIntersectionBranchIndexInScene` now selects nearest branch across **all** resolved roots.
  - Generic assignment now handles `N` roots deterministically (not truncated to first two roots).
  - Scene normalization/restore now treat any non-negative integer `branchIndex` as explicit.
  - Snapshot/test hydration updated to preserve non-binary branch indices.
- Export hardening aligned with generalized branch indexing:
  - Export branch inference now treats any non-negative integer `intersectionPoint.branchIndex` as explicit (not only `0|1`).
  - `preferredWorld` remains fallback-only when explicit branch index is absent.
- Scene regression coverage (semantic kinds):
  - Added semantic drag/persistence tests in `src/scene/__tests__/intersection-ownership-regression.test.ts`:
    - `testCircleSegmentSemanticBranchPersistenceUnderDrag`
    - `testCircleCircleSemanticBranchPersistenceUnderDrag`
    - `testLineLikeSemanticIntersectionTracksGeometryUnderDrag`
  - Note: `npm run test:scene` remains blocked in this sandbox due `tsx` IPC `EPERM`, but code compiles and export harness remains green.


## Active Work (Open)
- UX consistency update:
  - Grid lattice magnetism now follows Grid visibility: when `Grid` is off, free-point grid snapping is disabled even if `Snap` remains checked.
- Intersection semantics hardening (completed this pass):
  - Runtime branch selection no longer uses nearest-`preferredWorld` heuristics in generic intersection assignment.
  - Export fallback for legacy generic intersections no longer uses `preferredWorld` root distance; explicit branch is used when present, deterministic root `0` otherwise.
  - Export path now normalizes scene integrity before emitting TikZ, so missing legacy branch indices are backfilled once before export.
  - Regression fixture `regression-line-coverage-j-o.json` was upgraded to semantic intersection kinds (`lineLikeIntersectionPoint`, `circleSegmentIntersectionPoint`, `circleCircleIntersectionPoint`) with explicit branch indices.
- Active homework focus (correctness-first):
  1. Validate on dense construction scenes and guard against regressions.
  2. Regular polygon follow-up: optional orientation toggle (CW/CCW) if needed.
- Performance track is secondary and must not alter intersection semantics.
- Performance follow-up now is measurement/tuning only:
  - run `npm run test:zoom` and dense-scene checks
  - do not reopen zoom architecture items from commit `0e2c62a` unless there is a new reproducible regression.
- Closed decision (do not reopen unless concrete failing file is provided):
  - Legacy migration/backfill for pre-branchIndex snapshots is already implemented and active.
  - Implementation locations:
    - `src/domain/sceneIntegrity.ts` (normalization backfill)
    - `src/state/slices/historyRestore.ts` (restore/load backfill)
  - Policy: do not re-discuss or re-scope this item without a reproducible failing scene file.
- Command Bar Phase 2 candidates:
  - optional overwrite semantics (`set`, `:=`, `let`, `del`) if desired.
  - parametric dependencies (Phase 3) where objects depend on scalars dynamically.
  - Redefine/edit next slices:
    - in-place redefine for line/segment/circle/angle aliases with dependency preservation rules.
- Tool-Command parity backlog (homework):
  - Optional/non-goal parity:
    - `move`, `copyStyle`, `export_clip` (UI workflow tools; no strict command mapping required).

## Risks / Notes
- `preferredWorld` is a branch seed for `intersectionPoint`, not guaranteed solved world coordinate.
- For geometric truth/debugging, use runtime-evaluated positions (or export JSON with `debugPointWorld`).
- `mathjs` bundle size impact should be monitored (parser currently uses strict guards to keep scope safe).
- `Circle(x,y,r)` currently constructs a center point and then uses existing fixed-radius-circle creation, which is deterministic and compatible with current scene model.
- In current model `Circle(O,r)` maps directly to fixed-radius circle creation (`createCircleFixedRadius`), no synthetic through-point needed.
- Command Bar name collisions now span three namespaces:
  - point labels
  - scalar vars
  - command object aliases
  This is intentional to keep deterministic, fail-closed behavior.
- Pattern-library auto-emission only affects export header lines; drawing semantics are unchanged.
- Future polygon fill can reuse the same `pattern`/`patternColor` style contract to stay consistent across object classes.

## Historical (Do Not Reopen Automatically)
- Items below are historical progress logs and rationale.
- Do **not** treat them as pending tasks unless explicitly re-added under **Active Work**.
- In particular, do not reopen resolved items like:
  - “PropertiesPanel is monolithic”
  - old `I_C` label anchor discussion
  - angle preview/copy-style regressions already marked fixed
  - Fit View placement (already moved to top actions near Undo/Redo)
  - camera zoom culling/snap-budget/hotkey batch from commit `0e2c62a`
  - sector endpoint detachment bug unless a new reproducible file is provided

## Intersection Do-Not-Break Checklist (Read First)

Before changing any intersection-related logic (creation, evaluation, export), read:

- `docs/regression-log.md`

Mandatory invariants to preserve:

- Creation/evaluation branch ordering must stay identical (no alternate sorting).
- No root stealing between sibling intersections on same pair in non-degenerate regimes.
- `excludePointId` stabilization semantics must remain enforced.
- Undefined handling must be deterministic (no arbitrary jumps).
- Tangency is a degeneracy case only (see "Future-Proof Note: Tangent Tool Compatibility" in `docs/regression-log.md`).

Required validation after such changes:

- `npm run build`
- `npm run test:export`
- `npm run test:scene`

## Architecture Refactor Status (Current)
- `handleToolClick` extraction is already done (`src/tools/toolClick.ts`).
- Store slice scaffolding exists:
  - `src/state/slices/storeTypes.ts`
  - `src/state/slices/sceneSlice.ts`
  - `src/state/slices/interactionSlice.ts`
  - `src/state/slices/uiSlice.ts`
  - `src/state/slices/historySlice.ts`
  - `src/state/slices/index.ts`
- Action modules extracted and wired into `geoStore`:
  - `src/state/slices/interactionActions.ts`
  - `src/state/slices/uiActions.ts`
  - `src/state/slices/historyActions.ts`
  - `src/state/slices/sceneCoreActions.ts`
  - `src/state/slices/sceneLineAngleActions.ts`
  - `src/state/slices/sceneCreationActions.ts`
  - `src/state/slices/sceneMutationActions.ts`
- New domain service introduced:
  - `src/domain/geometryGraph.ts` for dependency graph + cascade deletion planning.
- New headless engine boundary introduced:
  - `src/engine/evaluateScene.ts`
  - `src/engine/hitTest.ts`
  - `src/engine/construct.ts`
  - `src/engine/index.ts`
- `geoStore.ts` now composes these actions instead of owning those methods inline.
- Extracted scene-core methods:
  - `createFreePoint`
  - `createMidpointFromPoints`
  - `createMidpointFromSegment`
  - `createSegment`
  - `createLine`
- Extracted line/angle creation methods:
  - `createPerpendicularLine`
  - `createParallelLine`
  - `createAngleBisectorLine`
  - `createAngle`
  - `createAngleFixed`
- Extracted circle/point/intersection/number creation methods:
  - `createCircle`
  - `createCircleThreePoint`
  - `createCircleFixedRadius`
  - `createPointOnLine`
  - `createPointOnSegment`
  - `createPointOnCircle`
  - `createIntersectionPoint`
  - `createNumber`
- Extracted mutation/update/copy/delete methods:
  - `movePointTo`
  - `movePointLabelBy`
  - `moveAngleLabelTo`
  - `updateSelectedPointStyle`, `updateSelectedPointFields`
  - `updateSelectedSegmentStyle`, `updateSelectedSegmentFields`
  - `updateSelectedLineStyle`, `updateSelectedLineFields`
  - `updateSelectedCircleStyle`, `updateSelectedCircleFields`
  - `updateSelectedAngleStyle`, `updateSelectedAngleFields`
  - `setCopyStyleSource`, `applyCopyStyleTo`, `clearCopyStyle`
  - `deleteSelectedObject`
- `deleteSelectedObject` now delegates cascade planning + application to domain graph helpers:
  - `collectCascadeDelete(scene, selected)`
  - `applyDeletion(scene, deletedSet)`
- Engine hit-test primitives now own canvas object hit logic:
  - `hitTestPointId`
  - `hitTestSegmentId`
  - `hitTestLineId`
  - `hitTestCircleId`
  - `hitTestAngleId`
  - `resolveVisibleAngles`
- `CanvasView` now delegates hover/click object hit testing to `src/engine/hitTest.ts` (local duplicated hit-test functions removed).
- `CanvasView` interaction orchestration (slice 1) extracted into:
  - `src/view/pointerInteraction.ts`
  - `decideMovePointerDown(...)` (move-tool pointer-down decision tree)
  - `computeCanvasCursor(...)` (cursor policy for move/copyStyle/targetable tools)
  - `CanvasView` now calls these helpers instead of inlining equivalent branching logic.
- `CanvasView` interaction orchestration (slice 2) extracted into:
  - `src/view/pointerDragInteraction.ts`
  - `applyBufferedDragUpdate(...)` (mode-specific drag application for pan / drag-point / drag-label / drag-angle-label)
  - `bufferDragForMode(...)` (mode-specific drag-buffer updates from pointermove)
  - `resetDragBuffers(...)`
  - `CanvasView` now delegates drag mode branching to these helpers.
- `CanvasView` interaction orchestration (slice 3) extracted into:
  - `src/view/pointerEventController.ts`
  - `createPointerHandlers(...)` now owns `onDown`, `onMove`, `finish` orchestration with explicit injected deps.
  - `CanvasView` now provides:
    - hit-test/hit-resolve callbacks
    - drag buffers/refs and scheduling callbacks
    - tool-click construction callback (`constructFromClick` path)
    - cursor/hover world state callbacks
- `CanvasView` event lifecycle extraction (slice 4):
  - `src/view/pointerEventController.ts`
    - `createCanvasAuxHandlers(...)` now owns `onWheel`/`onLeave`.
  - `src/view/canvasEventLifecycle.ts`
    - `bindCanvasEventLifecycle(...)` centralizes pointer/wheel listener attach-detach.
  - `CanvasView` no longer manually registers/removes each canvas event listener inline.
- `CanvasView` construction-click adapter extraction (slice 5):
  - `src/view/constructClickAdapter.ts`
  - `runConstructClickAdapter(...)` now owns `constructFromClick` payload assembly:
    - hit-object/top-hit + snap computation
    - click-hit payload normalization
    - IO bundle merge with camera/vp/angleFixedTool
  - `CanvasView` now delegates tool-click release construction wiring to this adapter.
- `CanvasView` helper-factory extraction (slice 6):
  - `src/view/canvasInteractionHelpers.ts`
    - `createReadScreen(canvas)`
    - `createHoveredHitResolver(...)`
    - `createDragBufferAccess(...)`
  - These were moved out of the large `CanvasView` effect body to reduce orchestration noise.
- `CanvasView` typed dependency-bundle cleanup (slice 7):
  - `src/view/constructClickAdapter.ts`
    - exports `ConstructClickIo` type (derived from `constructFromClick` signature).
  - `CanvasView` now builds:
    - `hitTolerances` memo bundle
    - `constructClickIo` memo bundle
  - Reduces large inline object plumbing and simplifies effect dependency surface.
- `CanvasView` label overlay prep extraction (slice 8):
  - `src/view/labelOverlays.ts`
    - `createPointLabelOverlays(...)`
    - `createAngleLabelOverlays(...)`
    - `buildAngleLabelTex(...)`
    - `getAngleTextRenderSize(...)`
  - `CanvasView` now consumes these helpers instead of inlining KaTeX overlay prep.
- `CanvasView` angle resolution extraction (slice 9):
  - `src/view/angleResolution.ts`
    - `resolveAngles(scene)` now owns angle point resolution + oriented-angle evaluation.
  - `CanvasView` now memoizes via `useMemo(() => resolveAngles(scene), [scene])`.
- `CanvasView` label layer extraction (slice 10):
  - `src/view/CanvasLabelsLayer.tsx`
  - `CanvasView` now delegates label DOM rendering for:
    - point caption overlays
    - angle label overlays
  - DOM output/props preserved.
- `CanvasView` render-pass orchestration extraction (slice 11):
  - `src/view/renderFrame.ts`
  - `renderCanvasFrame(...)` now owns frame draw order:
    - grid -> circles/lines/segments/angles
    - pending preview
    - points
    - interaction highlights
    - hover snap visual accents
  - `CanvasView` now delegates draw callback internals to this helper.
- `CanvasView` interaction-effect extraction (slice 12):
  - `src/view/useCanvasInteractionController.ts`
  - Moved the large pointer/wheel/listener orchestration effect out of `CanvasView` into a dedicated hook.
  - Hook owns:
    - hover-hit resolver wiring
    - cursor policy application on interaction changes
    - drag buffering + RAF flush scheduling
    - pointer handlers / wheel handlers integration
    - lifecycle bind/unbind + cleanup of pending RAF
  - `CanvasView` now supplies refs/state/actions to this hook.
- Scene expression parser extraction (slice 13):
  - `src/scene/eval/numericExpression.ts`
    - `parseNumericExpression(...)`
    - `NumberExpressionEvalResult`
  - `src/scene/points.ts` now imports parser from `scene/eval` instead of owning parser internals inline.
  - `NumberExpressionEvalResult` remains exported through `points.ts` to preserve API surface.
- Scene expression wrappers/symbol tables extraction (slice 14):
  - `src/scene/eval/expressionEval.ts`
    - `buildAngleSymbolTable(...)`
    - `buildNumberSymbolTable(...)`
    - `evaluateAngleExpressionDegreesWithSymbols(...)`
    - `evaluateNumberExpressionWithSymbols(...)`
    - `AngleExpressionEvalResult`
  - `src/scene/points.ts` now uses these helpers inside its existing context-aware wrappers:
    - `evaluateAngleExpressionDegreesWithCtx(...)`
    - `evaluateNumberExpressionWithCtx(...)`
  - Public exports preserved through `points.ts` (`AngleExpressionEvalResult`, `NumberExpressionEvalResult`).
- Scene number-definition branch extraction (slice 15):
  - `src/scene/eval/numberDefinitions.ts`
    - `evalNumberDefinitionWithOps(...)`
  - `src/scene/points.ts`
  - `evalNumberDefinition(...)` now delegates to `evalNumberDefinitionWithOps(...)`
  - context/cache-aware callbacks are injected from `points.ts` (no behavior change).
- Scene eval-context management extraction (slice 16):
  - `src/scene/eval/evalContext.ts`
    - `SceneEvalStats`
    - generic `SceneEvalContext<...>`
    - `buildSceneEvalContext(...)`
    - `getOrCreateSceneEvalContext(...)`
    - `beginSceneEvalTick(...)`
    - `endSceneEvalTick(...)`
    - `updateImplicitEvalStats(...)`
    - debug helpers (`isEvalDebugEnabled`, `formatEvalStats`)
  - `src/scene/points.ts`
    - now uses eval-context helpers for tick/context lifecycle and implicit stats updates
    - preserves public API by re-exporting `SceneEvalStats`
    - local context-map/index-map ownership unchanged (behavior-preserving split).
- Scene geometry-resolve extraction (slice 17):
  - `src/scene/eval/geometryResolve.ts`
    - `resolveLineAnchorsWithOps(...)`
    - `resolveLineLikeRefAnchorsWithOps(...)`
    - `getCircleWorldGeometryWithOps(...)`
    - `asLineLikeWithOps(...)`
    - `asCircleWithOps(...)`
  - `src/scene/points.ts`
    - `resolveLineAnchors`, `getCircleWorldGeometryWithCtx`, `asLineLike`, `asCircle` now delegate to injected-op helpers.
    - behavior preserved (including line recursion guard and fixed-radius expression evaluation).
- Properties panel decomposition start (UI monolith mitigation step 1):
  - Added `src/ui/NumbersSection.tsx`
  - `src/ui/PropertiesPanel.tsx` now delegates full Numbers block rendering/handlers to `NumbersSection`.
  - No behavior change; just structural extraction.
- Properties panel decomposition (UI monolith mitigation step 2):
  - Added `src/ui/ObjectStyleSections.tsx`
    - Owns selected object style editors for Segment / Line / Circle / Angle.
    - Includes segment marking + arrow marking sub-panels and all existing handlers.
  - Added `src/ui/PointPropertiesSection.tsx`
    - Owns selected point detail/editor UI (name, caption, visibility, label mode, lock/auxiliary, point style).
  - `src/ui/PropertiesPanel.tsx`
    - reduced to orchestration/composition for:
      - tool info blocks
      - object selection wiring
    - default-style toggle
    - composing `PointPropertiesSection`, `ObjectStyleSections`, `NumbersSection`
    - line count reduced substantially (~1415 -> ~442) with behavior preserved.
- Store/domain decomposition (scene integrity extraction):
  - Added `src/domain/sceneIntegrity.ts`
    - `normalizeSceneIntegrity(scene)` moved out of `geoStore`.
    - Includes object-reference liveness filtering and iterative dependency cleanup for:
      - points/segments/lines/circles/angles
      - circle/line intersection point validity
      - number-definition integrity (including ratio references).
  - `src/state/geoStore.ts`
    - now imports `normalizeSceneIntegrity` from domain layer.
    - reduced store-local orchestration size (~631 -> ~508 lines in this step).
  - Behavior preserved; `build` + export fixture suite remain green.
- Store/domain decomposition (intersection + number/history helper extraction):
  - Added `src/domain/intersectionReuse.ts`
    - moved stable intersection helper cluster out of store wiring:
      - `getLineCircleRefs(...)`
      - `findExistingIntersectionPointId(...)`
      - `createStableLineCircleIntersectionPoint(...)`
    - logic preserved (branch-order, `excludePointId`, target-root reuse behavior unchanged).
  - Added `src/domain/numberDefinitions.ts`
    - moved numeric-definition helper functions:
      - `isValidNumberDefinition(...)`
      - `numberPrefixForDefinition(...)`
      - `nextAvailableNumberName(...)`
  - Added `src/state/slices/historyRestore.ts`
    - `restoreGeoStateFromSnapshot(...)` extracted from `geoStore`.
  - `src/state/geoStore.ts`
    - now primarily composes slices + imports pure helpers.
    - reduced further (~508 -> ~235 lines in this step).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Store decomposition (rename action extraction):
  - Added `src/state/slices/sceneRenameActions.ts`
    - moved `renameSelectedPoint(...)` out of `geoStore`.
    - validation/uniqueness/error behavior preserved.
  - `src/state/geoStore.ts`
    - now composes rename action via `createSceneRenameActions(...)`.
    - reduced further (~235 -> ~190 lines in this step).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Store runtime extraction (state/listener/history plumbing):
  - Added `src/state/slices/storeRuntime.ts`
    - `createStoreRuntime(...)` now owns:
      - mutable store state
      - listener subscription/emit
      - `setState(...)` pipeline with scene normalization + history bookkeeping
      - history runtime fields (`undoStack`, `redoStack`, action key, restoring flag)
  - `src/state/geoStore.ts`
    - now composes runtime via `createStoreRuntime(...)`
    - passes runtime hooks/stacks to action slices
    - reduced further (~190 -> ~135 lines in this step).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- UI decomposition (Properties tool-info extraction):
  - Added `src/ui/ToolInfoSection.tsx`
    - moved tool-specific info/config panels from `PropertiesPanel`:
      - Copy Style info
      - Fixed Angle tool info
      - Fixed Radius Circle tool info
  - `src/ui/PropertiesPanel.tsx` now composes `ToolInfoSection` + object editors.
  - Behavior preserved.
- Scene decomposition (`points.ts` slice: intersection utility extraction):
  - Added `src/scene/eval/intersectionUtils.ts` with pure helpers:
    - `clamp(...)`
    - `circleLineStabilitySignature(...)`
    - `genericIntersectionPairKey(...)`
    - `genericIntersectionSignature(...)`
    - `sameObjectPair(...)`
    - `lineLikeContainsPoint(...)`
    - `pointWithinSegmentDomain(...)`
    - `circleLinePairAssignmentKey(...)`
  - `src/scene/points.ts` now imports and uses these utilities; duplicate local implementations removed.
  - No algorithmic change intended; this is structural extraction only.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: intersection assignment extraction):
  - Added `src/scene/eval/intersectionAssignments.ts`:
    - `assignCircleLinePairPoints(...)`
    - `assignGenericIntersectionPairPoints(...)`
  - `src/scene/points.ts` now delegates both pair-assignment algorithms to this module
    via callback ops (excluded point lookup + stable-point memory access).
  - Kept deterministic ownership rules and stability behavior unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: object intersection query extraction):
  - Added `src/scene/eval/intersectionQueries.ts`:
    - `objectIntersectionsWithOps(...)`
  - Moved line-line / line-circle / circle-circle query branching from
    `points.ts` into the new module.
  - `points.ts` now provides adapter callbacks (asLineLike/asCircle + stats counters),
    preserving existing behavior.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point geometry helper extraction):
  - Added `src/scene/eval/pointGeometryEval.ts`:
    - `evalMidpoint(...)`
    - `evalPointOnLine(...)`
    - `evalPointOnSegment(...)`
    - `evalPointOnCircle(...)`
    - `evalPointByRotation(...)`
  - `points.ts` now delegates pure geometry computations for these point kinds.
  - Behavior unchanged (only orchestration remains in `points.ts`).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: shared geometry-resolve ops builder):
  - In `src/scene/points.ts`, consolidated duplicated resolver-op closures into:
    - `buildGeometryResolveOps(scene, ctx)`
  - Reused by:
    - `asLineLike(...)`
    - `resolveLineAnchors(...)`
    - `asCircle(...)`
    - `getCircleWorldGeometryWithCtx(...)`
  - Structural refactor only; no algorithm changes.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point-kind evaluator split):
  - Split monolithic `evalPointUnchecked(...)` into dedicated helpers:
    - `evalMidpointPointsPoint(...)`
    - `evalMidpointSegmentPoint(...)`
    - `evalPointOnLinePoint(...)`
    - `evalPointOnSegmentPoint(...)`
    - `evalPointOnCirclePoint(...)`
    - `evalPointByRotationPoint(...)`
    - `evalCircleLineIntersectionPoint(...)`
    - `evalGenericIntersectionPoint(...)`
  - Dispatcher remains in `evalPointUnchecked(...)`; behavior is unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: stable-point memory extraction):
  - Added `src/scene/eval/stablePointMemory.ts`:
    - `getPreviousStablePoint(...)`
    - `rememberStablePoint(...)`
  - `points.ts` now delegates stable intersection memory reads/writes to this module.
  - This is structural only; stability signatures/selection behavior unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: angle math extraction):
  - Added `src/scene/eval/angleMath.ts`:
    - `computeConvexAngleRad(...)`
    - `computeOrientedAngleRad(...)`
  - `points.ts` now imports/re-exports these math helpers; local implementations removed.
  - Structural extraction only; formulas unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: expression runtime extraction):
  - Added `src/scene/eval/expressionRuntime.ts`:
    - `evaluateAngleExpressionWithRuntime(...)`
    - `evaluateNumberExpressionWithRuntime(...)`
  - `points.ts` now delegates symbol-table orchestration to this module from:
    - `evaluateAngleExpressionDegreesWithCtx(...)`
    - `evaluateNumberExpressionWithCtx(...)`
  - All callbacks and math remain unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: number runtime extraction):
  - Added `src/scene/eval/numberRuntime.ts`:
    - `evalNumberByIdWithRuntime(...)`
  - `points.ts` `evalNumberById(...)` now delegates cache/in-progress orchestration to this helper.
  - Number definition math/evaluation callbacks unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: scene geometry access extraction):
  - Added `src/scene/eval/sceneGeometryAccess.ts`:
    - `asLineLikeInScene(...)`
    - `resolveLineAnchorsInScene(...)`
    - `asCircleInScene(...)`
    - `getCircleWorldGeometryInScene(...)`
  - `points.ts` now delegates geometry-resolve wrappers to this module.
  - Behavior unchanged; this is adapter centralization.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: number-definition scene wiring extraction):
  - Added `src/scene/eval/numberSceneEval.ts`:
    - `evalNumberDefinitionInScene(...)`
  - `points.ts` now delegates number-definition callback wiring to this helper.
  - Core number math and expression semantics unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point basic helpers extraction):
  - Added `src/scene/pointBasics.ts`:
    - `nextLabelFromIndex(...)`
    - `isNameUnique(...)`
    - `isValidPointName(...)`
    - `isPointDraggable(...)`
    - `movePoint(...)`
  - `points.ts` now re-exports these to preserve existing import paths.
  - Structural extraction only; behavior preserved.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: eval-context builder extraction):
  - Added `src/scene/eval/sceneContextBuilder.ts`:
    - `buildSceneEvalContextForScene(...)`
    - exported scene `SceneEvalContext` alias
  - `points.ts` now delegates context map/tick construction to this helper.
  - Behavior unchanged; context lifecycle API remains the same.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: intersection pair-resolution orchestration extraction):
  - Added `src/scene/eval/intersectionPairResolution.ts`:
    - `resolveCircleLinePairAssignmentsInScene(...)`
    - `resolveGenericIntersectionPairAssignmentsInScene(...)`
  - `points.ts` now delegates pair-candidate scan/caching orchestration to this module.
  - Branch ownership and stable-point rules unchanged (still delegated to existing assignment helpers).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: geometry-resolve runtime wiring extraction):
  - Added `src/scene/eval/geometryResolveRuntime.ts`:
    - `buildGeometryResolveOpsRuntime(...)`
  - `points.ts` `buildGeometryResolveOps(...)` now delegates to this helper.
  - No geometry algorithm change (same callbacks/data sources).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point-runtime orchestration extraction):
  - Added `src/scene/eval/pointRuntime.ts`:
    - `evalPointByIdWithRuntime(...)`
  - `points.ts` `evalPoint(...)` now delegates point cache/in-progress orchestration to this helper.
  - Point-kind evaluation and intersection behavior unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: non-intersection point-kind evaluators extraction):
  - Added `src/scene/eval/pointKindEvaluators.ts`:
    - `evalMidpointPointsPoint(...)`
    - `evalMidpointSegmentPoint(...)`
    - `evalPointOnLinePoint(...)`
    - `evalPointOnSegmentPoint(...)`
    - `evalPointOnCirclePoint(...)`
    - `evalPointByRotationPoint(...)`
  - `points.ts` now delegates these non-intersection point kind evaluators to the module.
  - Circle-line and generic intersection evaluators remain in `points.ts` (unchanged logic).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Label hit-testing extracted from `CanvasView` into:
  - `src/view/labelHit.ts`
  - `hitTestPointLabel`
  - `hitTestAngleLabelHandle`
  - `hitTestPointLabelFromDom`
- Angle draw math helpers extracted from `CanvasView` into:
  - `src/view/angleRender.ts`
  - `drawAngleArcPreview`
  - `drawAngleSector`
  - `drawRightAngleMark`
- Snap highlight rendering extracted from `CanvasView` into:
  - `src/view/snapHighlight.ts`
  - `highlightSnapObject`
- Stroke/point/segment overlay rendering helpers extracted from `CanvasView`:
  - `src/view/strokeStyle.ts` (`applyStrokeDash`)
  - `src/view/pointRender.ts` (`drawPointSymbol`)
  - `src/view/segmentOverlayRender.ts` (`drawSegmentMarkOverlay`, `drawSegmentArrowOverlay`)
- Full object render passes extracted from `CanvasView` into `src/view/renderers/*`:
  - `circles.ts` (`drawCircles`)
  - `lines.ts` (`drawLines`)
  - `segments.ts` (`drawSegments`)
  - `angles.ts` (`drawAngles`)
  - `points.ts` (`drawPoints`)
  - `types.ts` (`DrawableObjectSelection`)
  - `index.ts` barrel
- Pending tool preview rendering extracted from `CanvasView`:
  - `src/view/previews/pendingPreview.ts` (`drawPendingPreview`)
  - Includes 3-point circumcircle helper and per-tool preview logic.
- Stage #2 App decomposition started:
  - Left toolbar extracted from `src/App.tsx` into `src/ui/ToolPalette.tsx`.
  - `ToolPalette` owns:
    - tool registry/group definitions
    - flyout state (`openFlyoutGroup`, `groupLastSelected`)
    - long-press + context-menu behavior
    - outside-click and Escape flyout close behavior
  - `App.tsx` now delegates toolbar rendering to `ToolPalette` and no longer contains duplicate toolbar icon/helper code.
  - Export tab UI extracted from `src/App.tsx` into `src/ui/ExportPanel.tsx`.
  - `ExportPanel` refactored to be store-driven + self-contained state (scene/camera from store, local export controls/actions).
  - Export panel is always mounted and uses `visible` prop to preserve state across tab switches.
  - Properties tab UI extracted from `src/App.tsx` into `src/ui/PropertiesPanel.tsx`.
  - `PropertiesPanel` then refactored to be store-driven (`useGeoStore` + local panel state/effects), removing a large prop surface from `App.tsx`.
  - `PropertiesPanel` is always mounted and uses `visible` prop.
  - Construction-description logic moved out of `App.tsx` into selector module:
    - `src/state/selectors/constructionDescription.ts`
    - `selectConstructionDescription(selectedObject, scene)`
  - `App.tsx` no longer owns construction-description helper functions.
  - Right sidebar shell/tabs wrapper extracted from `src/App.tsx` into `src/ui/RightSidebar.tsx`.
    - `RightSidebar` now owns right-tab local state (`algebra` / `export`) and renders:
      - tab switcher
      - object browser section
      - `ExportPanel` + `PropertiesPanel` visibility wiring
      - right-sidebar collapse/expand controls
  - `App.tsx` now composes high-level layout only (left palette, canvas, right sidebar, resizers, history buttons).
  - Top-canvas history controls extracted from `src/App.tsx` into `src/ui/HistoryControls.tsx`.
  - Sidebar resize drag lifecycle extracted from `App.tsx` into reusable hook:
    - `src/ui/useSidebarResize.ts`
    - owns pointermove/pointerup listeners, clamping, and startResize handlers.
  - Global keyboard shortcuts extracted from `App.tsx` into reusable hook:
    - `src/ui/useGlobalCanvasHotkeys.ts`
    - owns Escape copy-style cancel, undo/redo shortcuts, delete/backspace delete.
  - App shell/resizer markup extracted from `App.tsx` into:
    - `src/ui/WorkspaceShell.tsx`
    - owns composition layout for left palette, canvas/history, resize handles, right sidebar.
  - Direct `App.tsx` store wiring grouped into app-shell controller hook:
    - `src/ui/useAppShellController.ts`
    - owns:
      - store selectors/actions used by shell
      - left/right sidebar local widths + collapsed state
      - global hotkeys hook wiring
      - sidebar resize hook wiring
    - `App.tsx` now reduced to:
      - `const shell = useAppShellController()`
      - `<WorkspaceShell {...shell} />`
  - `App.tsx` now primarily wires store actions and composes shell components.
  - Behavior unchanged; structural extraction/refactor only.
- Verified after each extraction:
  - `npm run build` passes
  - `npm run test:export` passes (22 fixtures)
  - `node --import tsx src/scene/__tests__/geometry-graph-delete-regression.test.ts` passes
  - `node --import tsx src/scene/__tests__/engine-boundary.test.ts` passes

## Architectural Effectiveness Snapshot (Homework)
- Runtime/user effectiveness is good (features working, acceptable performance after recent fixes).
- Developer effectiveness is still constrained by monolith structure:
  - `src/App.tsx` remains very large (~2.6k lines) and still mixes composition with significant UI state wiring.
  - `src/scene/points.ts` remains very large (~1.6k lines), mixing model types and evaluation logic.
- Interpretation:
  - Product is usable.
  - Delivery speed/risk for new features is still limited by structural coupling.
- This is expected technical debt, and confirms continuing the refactor roadmap below.

## Next Refactor Chunk (Do Next)
1. Keep helper functions (`normalizeSceneIntegrity`, intersection helpers) in `geoStore` for now unless needed.
2. Introduce headless engine API boundary module(s):
   - `evaluateScene(scene)` ✅ initial facade
   - `hitTest(scene, camera, pointer)` ✅ initial facade
   - `construct(scene, toolIntent)` ✅ initial facade
3. Gradually move pure evaluation/hit-test logic out of monolith files into engine modules.
   - `CanvasView` click-release top-object hit-test now uses `engine/hitTestTopObject`.
   - `CanvasView` hover/click hit tests now use engine primitives (`hitTestPointId/SegmentId/LineId/CircleId/AngleId`).
   - `CanvasView` selection/highlight draw extraction completed:
     - `src/view/interactionHighlights.ts`
     - owns `drawInteractionHighlights(...)` + internal `drawHitHighlight(...)`
     - behavior preserved; `CanvasView` now delegates this draw pass.
   - Next major stage (`scene`): extract generic/circle-line intersection assignment helpers from `src/scene/points.ts` into `src/scene/eval/intersections.ts` (pair-assignment logic), preserving stability behavior.
   - Recent `scene` extractions completed (behavior-preserving, validated):
     - `src/scene/eval/expressionRuntime.ts`
     - `src/scene/eval/numberSceneEval.ts`
     - `src/scene/pointBasics.ts` (with re-exports from `points.ts` for API stability)
     - `src/scene/eval/sceneContextBuilder.ts`
     - `src/scene/eval/intersectionPairResolution.ts`
     - `src/scene/eval/geometryResolveRuntime.ts`
     - `src/scene/eval/pointRuntime.ts`
     - `src/scene/eval/pointKindEvaluators.ts`
     - `src/scene/eval/pointIntersectionEvaluators.ts`
     - `src/scene/eval/pointEvalDispatch.ts`
     - `src/scene/eval/numberExpressionEvaluators.ts`
     - `src/scene/eval/geometryAdapters.ts`
     - `src/scene/eval/numberEvaluators.ts`
     - `src/scene/eval/intersectionStabilityAdapters.ts`
     - `src/scene/eval/pointValueRuntime.ts` (later consolidated back into `src/scene/eval/pointRuntime.ts`)
   - `src/scene/points.ts` now primarily orchestrates runtime wiring/delegation; next step is continuing to peel remaining orchestration pieces into `src/scene/eval/*`.
   - Next major stage (`ui`): continue `PropertiesPanel` split by extracting tool-info blocks (Angle Fixed / Circle Fixed) and selected-object editors into dedicated subcomponents.
4. Keep behavior identical (no geometry semantics change in same commit).
5. Re-run:
   - `npm run build`
   - `npm run test:export`

## Refactor Roadmap (Incremental, Low-Risk)
1. Finish geoStore action extraction (mutation/update block) into dedicated slice module(s).
2. Introduce headless engine boundary module(s):
   - `evaluateScene(scene)`
   - `hitTest(scene, camera, pointer)`
   - `construct(scene, toolIntent)`
3. Move pure geometry/evaluation out of `src/scene/points.ts` into smaller engine-focused modules (types separate from evaluators).
4. Reduce `App.tsx` to composition + panel orchestration only (no geometry/tool logic).
5. Keep all steps regression-locked with `npm run build` and `npm run test:export`.
6. For deletion graph changes, also run:
   - `node --import tsx src/scene/__tests__/geometry-graph-delete-regression.test.ts`

## Label Export Note (Recent Fix)
- In match-canvas export mode, label anchor direction must derive from raw user label offset, not post-processed spread/clearance shift.
- Caption labels (`showLabel: "caption"`) use top-left overlay semantics; anchor direction requires center-biased mapping to avoid wrong quadrant.
- Do not reintroduce `xshift/yshift` in match-canvas mode.
- Status: the earlier `I_C` caption-side mismatch was handled; do not reopen this unless there is a fresh reproducible JSON + exported TeX mismatch.

## Non-Negotiable Invariants

### Geometry and dependencies
- Constrained points must remain constrained after parent updates.
  - `pointOnCircle` must stay on its circle.
  - `pointOnLine` / `pointOnSegment` must stay on their locus.
- Segment intersections are finite-domain filtered (no infinite-line leakage).
- Intersection identity is never merged by proximity.
- Intersection selection is stable and deterministic.

### Angle behavior
- Directed angle convention is required.
- `computeOrientedAngleRad(A,B,C)` drives value/label meaning.
- Preview arc, final arc, fill sector, and hit-testing must use the same orientation convention.
- Angle label dragging updates `labelPosWorld` in world coordinates.

### Performance and eval
- Recompute must avoid eval explosion (memoized / one-pass per tick behavior).
- Pointer-move heavy interactions should be rAF-coalesced where applicable.

### Export policy
- Exporter is fail-closed.
- No invented tkz-euclide macro names or option keys.
- If unsupported mapping is requested, throw explicit error.
- Keep deterministic output order and stable naming.

### UI/UX policies already requested
- Circle tools live in `CIRCLES` group, not `LINES`.
- Perpendicular and Parallel line tools exist and are interactive with preview.
- Angle tool exists as its own group.
- Right sidebar tabs are `Algebra`/`Export` structure as currently implemented.
- “Make this default for this object” should work for point/segment/line/circle/angle.

## Locked Invariants (Previously Fixed; Must Stay Fixed)
- Circle-line “other intersection” must not collapse to excluded point.
- Segment logic must stay finite-domain in snapping/intersections (no infinite-line leakage).
- Dependent/intersection points must not disappear from canvas while still present in model/export.

## Resolved History (Reopen Only With Fresh Repro)
- Angle preview direction/value mismatch vs final created angle.
- Copy Style applying to angles.
- Caption label anchor quadrant mismatch in TikZ export (historic `I_C` case).

## Pre-merge Checklist (Every Feature)
1. `npm run build`
2. `npm run test:export`
3. Manually test the touched interaction (tool flow + drag updates + selection)
4. Verify no unrelated files are staged
5. Commit with narrow scope

## Regression Gate (Mandatory Before Commit)
- If any geometry interaction, snapping, intersection, or exporter logic was touched:
  - Run `npm run build && npm run test:export`
  - Verify Locked Invariants above with at least one manual repro scene.
- Do not merge if any Locked Invariant behavior changes without adding/updating a regression test and documenting why.

## Safe Feature Workflow (Micro-milestones)
For each new feature, split into:
1. Data model + store action
2. Canvas interaction + preview
3. Rendering + hit-test
4. Export mapping (fail-closed)
5. Fixture/test regression

## Context Reset Recovery Template
When starting a new chat, provide:
- Current branch + latest commit hash
- This file (`docs/handoff.md`)
- Exact acceptance tests for the current task
- Explicit “do not regress” list from this file

## Commands
- Build: `npm run build`
- Export regressions: `npm run test:export`
- Status check: `git status --short`

## Latest Done (Angle Real Perpendicular)
- Added deterministic right-angle provenance module: `src/domain/rightAngleProvenance.ts`.
  - Maintains O(1) pair index for `(point,point) -> line/segment`.
  - Maintains O(1) perpendicular adjacency between line-like refs.
  - Exposes `isRightExactByProvenance(scene, aId, bId, cId)`.
- Angle creation now stores `isRightExact` on created angles (from provenance, not numeric epsilon).
  - `createAngle(...)` sets `isRightExact` and defaults mark style to `rightSquare` when exact and default style was `arc`.
  - `createSector(...)` and `createAngleFixed(...)` set `isRightExact: false`.
- Provenance lifecycle wired:
  - Register line/segment pair indices on `createLine` / `createSegment`.
  - Register perpendicular relation on `createPerpendicularLine`.
  - Rebuild provenance on delete cascade (`deleteSelectedObject`) and on undo/redo restore.
  - Initial store boot also rebuilds provenance from scene.
- UI gating now uses `angle.isRightExact` (not numeric dot-product):
  - Right-only mark options shown only for exact-right angles.
- Renderer / hit-test / hover highlight right-angle behavior now keys off `angle.isRightExact`.
- Exporter fail-closed right-angle gating:
  - Right-angle marks emitted only when `isRightExact=true`.
  - Otherwise throws: `Unsupported construction: RightAngleMark on non-right angle`.
- New regression fixtures:
  - `src/export/__fixtures__/angle-right-exact-from-perp-tool.json`
  - `src/export/__fixtures__/angle-right-approx-only.json` (expected fail-closed)

## Next
- If needed later: add optional `isRightApprox` (numeric hint only) strictly for UI hints, never for export/certification.
- Keep provenance manager as the only source of truth for “real right angle”.

## Risks / Constraints
- “Real perpendicular” is provenance-based only. Visually perpendicular free-point angles are intentionally not certified.
- Pair-index relies on explicit constructions (`line/segment` endpoints or constrained point-on-line/segment).

## Latest Done (Sector Arc Intersections)
- Added sector as a valid `GeometryObjectRef` (`{ type: "angle", id }`) for intersection workflows.
- Implemented boundary-only sector support in intersection evaluation:
  - supported now: `line/segment ∩ sector-arc`
  - explicitly not supported: sector interior intersections.
- Wired sector-arc into runtime geometry adapters/resolvers:
  - `asSectorArcWithOps` / `asSectorArcWithCtx` / `asSectorArcInScene`
  - intersection query path now filters line-circle roots by sector sweep.
- Wired sector-arc into snap intersection candidates:
  - point tool can now create intersection points between line-like objects and sector arcs.
- Added dependency/integrity support for intersection points referencing sectors:
  - graph key mapping for `GeometryObjectRef.type === "angle"`
  - integrity liveness check for sector refs.
- Added scene regression coverage:
  - `testLineSectorArcIntersectionTracksBoundary` in `src/scene/__tests__/intersection-ownership-regression.test.ts`.

## Sector Intersection Notes
- Sector intersection semantics are boundary-only and currently arc-focused.
- Radial-edge boundary intersections (with BA/BC rays/segments) are not included in this phase.
- Sector tool endpoint constraint fix:
  - Step-3 no longer creates `pointByRotation` for the third sector point.
  - It now creates a `pointOnCircle` constrained to a hidden auxiliary two-point circle `(center=startVertex, through=sectorStartPoint)`.
  - This keeps the endpoint draggable on the locus and preserves radius coupling when the start point moves.

## Latest Done (Polygon Tool + Command Parity)
- Added first-class `ScenePolygon` support to scene model/state:
  - `scene.polygons` added to `SceneModel`, state slice defaults, history snapshots, restore path, and integrity normalization.
  - New polygon defaults (`polygonDefaults`) and ids (`nextPolygonId`).
- Added polygon creation/action surface:
  - `createPolygon(pointIds)` in scene core actions.
  - Polygon creation now auto-creates missing edge segments for each consecutive pair (including closing edge), reusing existing segments order-insensitively to avoid duplicates.
  - Edge segment creation is atomic with polygon creation (single history action) and registers right-angle provenance segment pair index for new edges.
  - polygon selection/hover/copy-style/delete graph support in domain/store.
- Added canvas integration:
  - Tool id: `polygon`
  - Pending polygon preview (polyline rubber-band).
  - Polygon renderer + hit-test support.
  - Object browser lists polygons (under Circles/Polygons tab).
- Added properties/style editing parity:
  - Polygon style controls in properties panel (stroke/fill/pattern/pattern-color) via `ObjectStyleSections`.
  - “Make this default for this object” now supports polygons.
- Added TikZ export support for polygons:
  - Export emits deterministic raw TikZ closed path:
    - `\draw[<style>] (P1) -- (P2) -- ... -- cycle;`
  - Polygon style maps include stroke, fill opacity/color, pattern, pattern color.
  - Added regression fixture: `src/export/__fixtures__/polygon-basic.json`.
- Added Command Bar parity for polygon:
  - Parser command: `Polygon(A,B,C,...)` -> `CreatePolygonByPoints`.
  - Supports assignment form (`P = Polygon(A,B,C,...)`) through existing assignObject flow.
  - Command execution wiring for both direct and assigned polygon creation.
  - Added parser regression assertion in `src/scene/__tests__/command-parser.test.ts`.

## Next
- Add polygon construction descriptions with vertex list polishing in UI (currently basic id/name display).
- Optional: add dedicated polygon tab icon semantics and specialized polygon info panel.
- Optional: add polygon command docs entry in `docs/command-bar-reference.md`.

## Risks / Constraints
- Command alias labeling for polygons is command-level alias only (same behavior as line/segment/circle aliases), not scene object renaming.
- Polygon export uses raw `\draw[...] ... -- cycle;` (deterministic and compile-safe), not tkz-specific polygon macros.

## Latest Done (Command Redefine Slice 2: Aliased Objects)
- Added `commandBarApi.applyObjectAssignment(name, cmd)` as the single execution path for `assignObject` in the command bar.
- Extended command assignment behavior from create-only to create-or-update for command aliases:
  - If alias name does not exist: object is created with existing `*WithLabel` helpers.
  - If alias exists: object is updated in-place (same id) for supported types.
- Supported in-place redefine by alias:
  - `line`: `Line(A,B)`, `Perpendicular(...)`, `Parallel(...)`, `AngleBisector(...)`
  - `segment`: `Segment(A,B)`
  - `circle`: `Circle(O,A)`, `Circle(O,r)`, `Circle(A,B,C)`
  - `polygon`: `Polygon(A,B,C,...)`
  - `angle`: `Angle(A,B,C)` and `Sector(O,A,B)`
- Free-point and scalar redefine from slice 1 remain unchanged:
  - `P = Point(x,y)` updates existing free point `P` in place.
  - `n = <expr>` updates existing constant scalar `n`.
- Fail-closed behavior retained:
  - incompatible redefine command for an existing alias returns explicit error (no partial mutation).
- Right-angle provenance consistency retained:
  - line redefine path triggers provenance rebuild to keep exact-right metadata consistent.

## Next
- Add parser/store tests for alias redefine updates across line/segment/circle/polygon/angle to lock behavior.
- Expand object-browser text rendering to display command-style definitions for aliased objects.

## Risks / Constraints
- Alias redefine currently supports in-place updates only for explicitly implemented command/object pairs; unsupported pairs fail closed.
- Alias map is command-level metadata; manual scene renames outside command flow are not auto-synced into alias entries.

## Latest Done (Command Redefine Regression Tests)
- Added `src/scene/__tests__/command-redefine.test.ts`.
- Covers create-then-update in-place behavior for command aliases:
  - line, segment, circle, polygon, angle.
- Covers fail-closed incompatible redefine (`segment` alias with `Line(...)`) and verifies no mutation.
- Updated `npm run test:command` to run both parser and redefine tests.

## Next
- Add a small UI smoke test checklist for command redefine (alias id stability + dependency updates) for manual QA.

## Risks / Constraints
- Test suite runs against singleton store state in one process; keep test labels unique to avoid collisions.

## Latest Done (Object Browser: Alias Command Definitions)
- Object Browser command text now surfaces command-assignment form for aliased objects.
- For any object created/managed via Command Bar alias assignment, the browser shows:
  - `<alias> = <command>`
  - examples: `l = Line(A,B)`, `c = Circle(O,5)`, `poly = Polygon(A,B,C)`.
- Applied across browser rows for:
  - points, segments, lines, circles, polygons, angles.
- Non-aliased objects continue to show plain command form without alias prefix.

## Next
- Optional: show alias badge in object title row (not only in command text) if you want stronger visual differentiation.

## Risks / Constraints
- Alias display depends on command-level alias map; manual scene renames done outside command assignment do not create alias entries.

## Latest Done (Redefine Hardening: Fail-Closed + Dependency Safety)
- Hardened command alias redefine path in `geoStore`.
- Added stale-alias pruning:
  - command alias entries are now pruned when their target object no longer exists.
  - avoids dead alias collisions and allows deterministic re-creation with same alias after delete.
- Hardened in-place segment redefine:
  - segment aliases cannot redefine polygon-owned segments (`ownedByPolygonIds`), fail-closed.
- Fixed polygon alias redefine dependency behavior:
  - redefining `Polygon(...)` now updates polygon-owned edge membership deterministically.
  - creates missing owned edges, removes no-longer-used owned edges, preserves shared-owned edges.
  - new edges are registered in right-angle provenance segment pair index.
- Added regression coverage in `command-redefine.test.ts`:
  - stale alias recreate after deletion.
  - polygon-owned edge set correctness after polygon redefine.

## Next
- Add a tiny export smoke scenario for redefine-created polygon ownership transitions (no UI changes).

## Risks / Constraints
- Alias map remains command-level metadata; manual object renames still do not auto-remap aliases.

## Latest Done (Redefine Export Smoke Validation)
- Added `src/scene/__tests__/command-redefine-export.test.ts`.
- Test builds scene state via command alias create+redefine calls and verifies TikZ export reflects post-redefine state.
- Assertions include:
  - redefined polygon path emitted (and stale pre-redefine path absent),
  - redefined fixed-radius circle export emitted (`\tkzDefCircle[R](...)`).
- Updated `test:command` to include this export-smoke redefine test.

## Next
- Add one additional smoke for angle/sector redefine export mapping if needed.

## Risks / Constraints
- Export smoke test intentionally checks deterministic string signatures; it is not a full symbolic equivalence checker.

## Latest Done (Angle/Sector Redefine Export Smoke)
- Extended `command-redefine-export.test.ts` to cover angle alias redefine from `Angle(...)` to `Sector(...)`.
- Export assertions now verify post-redefine behavior for this case:
  - sector export macro present (`\tkzDrawSector`),
  - angle-mark macro absent (`\tkzMarkAngle`) in this smoke scene.

## Next
- Optional: add one smoke for `Sector -> Angle` redefine if bidirectional behavior is needed.

## Risks / Constraints
- Export smoke remains signature-based and intentionally minimal/deterministic.

## Latest Done (Sector-Owned Radial Segments)
- Sector construction now creates/reuses two owned radial segments:
  - `Segment(center,start)` and `Segment(center,end)`.
- Added `ownedBySectorIds` ownership metadata on `SceneSegment`.
- Sector ownership integrated into integrity/dependency/cascade systems:
  - `sceneIntegrity` now normalizes both polygon and sector ownership arrays.
  - dependency graph now includes segment -> sector ownership edges.
  - cascade delete now handles sector-owned segment multi-owner logic (same pattern as polygon owners).
- Command alias redefine integration:
  - `Sector -> Sector` updates radial ownership deterministically.
  - `Sector -> Angle` releases sector-owned radial ownership.
  - orphaned ownership-generated segments are removed when no owners remain.
- Added regression coverage:
  - `command-redefine.test.ts`: sector ownership creation + release checks.
  - `geometry-graph-delete-regression.test.ts`: delete sector cascades owned edge, shared-owner edge remains.

## Next
- Optional: expose sector radial sides in object browser as derived/owned edges if desired (UI-facing).

## Risks / Constraints
- Manual segments reused by sector become owner-tagged; deleting sector will only delete them when no remaining owners exist.

## Latest Done (Redefine Export Smoke: Bidirectional Angle/Sector)
- Extended `command-redefine-export.test.ts` to cover both directions:
  - `Angle -> Sector`
  - `Sector -> Angle`
- Export smoke now asserts sector macros and angle-mark macros are both represented when expected after redefine transitions.

## Next
- Optional: add a dedicated fixture-driven export case for mixed angle+sector redefine in one saved scene.

## Risks / Constraints
- Current smoke checks are deterministic string assertions; they intentionally do not prove full semantic equivalence.

  - Polygon ownership stress validation (closure for homework #1 lifecycle hardening):
    - Added `src/scene/__tests__/polygon-ownership-stress.test.ts`.
    - Covers high-churn polygon redefine cycles, shared-edge owner integrity, and delete cleanup.
    - Added to `npm run test:scene` so ownership lifecycle regressions are caught in routine scene tests.
  EOF

- Polygon ownership stress validation (closure for homework #1 lifecycle hardening):
  - Added `src/scene/__tests__/polygon-ownership-stress.test.ts`.
  - Covers high-churn polygon redefine cycles, shared-edge owner integrity,
  and delete cleanup.
  - Added to `npm run test:scene` so ownership lifecycle regressions are caught in routine scene tests.
