# GeoDraw Handoff (Stability Contract)

## Branch / Baseline
- Active branch: `refactor/stage2-app-decomposition`
- Keep commits small and scoped.
- Do not bundle unrelated files in feature commits.

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
   - Next major stage: continue `CanvasView` interaction orchestration extraction (slice 2):
     - extract drag-update scheduling and mode-specific drag application (`pan`, `drag-point`, `drag-label`, `drag-angle-label`) into dedicated controller helper(s)
     - keep behavior identical and regression-locked.
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
