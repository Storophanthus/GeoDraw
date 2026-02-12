# GeoDraw Handoff (Stability Contract)

## Branch / Baseline
- Active branch: `refactor/stage2-app-decomposition`
- Keep commits small and scoped.
- Do not bundle unrelated files in feature commits.

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
