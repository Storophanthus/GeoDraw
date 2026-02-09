# Architecture Audit vs GeoDraw Spec

## 1) Implemented Now (objects, tools, styles, dependencies)

### Geometry Object Model

#### Points (`src/scene/points.ts`)
- `FreePoint`
  - Stored: `position` + common point fields.
- `PointOnLine`
  - Stored: `lineId`, parameter `s`.
- `PointOnSegment`
  - Stored: `segId`, parameter `u` (clamped in evaluation/drag projection).
- `PointOnCircle`
  - Stored: `circleId`, parameter `t` (angle).
- `MidpointFromPoints`
  - Stored: `aId`, `bId`.
- `MidpointFromSegment`
  - Stored: `segId`.
- `IntersectionPoint` (generic)
  - Stored: `objA`, `objB`, `preferredWorld`.
- `CircleLineIntersectionPoint` (specialized)
  - Stored: `circleId`, `lineId`, `branchIndex`.

Common point fields currently present on all variants:
- `id`, `name`, `captionTex`, `visible`, `showLabel`, `locked?`, `auxiliary?`, `style`.

#### Curves/Shapes
- `SceneLine`: `id`, `aId`, `bId`, `visible`, `style`.
- `SceneSegment`: `id`, `aId`, `bId`, `visible`, `showLabel`, `style`.
- `SceneCircle`: `id`, `centerId`, `throughId`, `visible`, `style`.

### Evaluation Model
- World position for points is computed by `getPointWorldPos(...)` recursively from dependencies (`src/scene/points.ts`).
- Constrained points remain constrained because they store locus + parameter (`s/u/t`).
- Dependent points are computed, not directly stored as world coords.
- No explicit dependency graph cache; evaluation is on-demand by id lookup.

### Tools Implemented
- `move`, `point`, `midpoint`, `segment`, `line2p`, `circle_cp`, `copyStyle`.
- Tool groups in UI:
  - `MOVE`, `POINTS`, `LINES`, `CIRCLES`, `STYLES` (`src/App.tsx`).
- Multi-step tools use pending state with first selected point and preview rendering (`src/view/CanvasView.tsx`).

### Snapping / Magnet Behavior
- Snap candidates (`src/view/snapEngine.ts`):
  - existing points, intersections, on-line, on-segment, on-circle.
- Shared creation path in tool handling (`resolveOrCreatePointAtCursor` in `CanvasView`):
  - Creates constrained/dependent points from snap kind when available.
  - Falls back to free point otherwise.
- This now applies to non-point construction tools as well.

### Styles and Property Editing
- Point style: shape, size, stroke, fill, label styling fields.
- Line/segment style: `strokeColor`, `strokeWidth`, `dash`, `opacity`.
- Circle style: `strokeColor`, `strokeWidth`, `strokeDash`, `strokeOpacity`, optional fill.
- Sidebar property editing is point-focused (name/caption/visibility/showLabel/lock/auxiliary/style).
- Copy Style tool supports point and non-point cosmetic copy/apply.

### Dependency/Deletion Handling
- Deleting parents removes dependent references (lines/segments/circles/pointOn*/midpoints/intersections) in `geoStore.deleteSelectedObject`.

### Intersection Stability Status
- Line-circle: stable via sorted branch selector (`branchIndex`) for `CircleLineIntersectionPoint`.
- Generic intersections (`IntersectionPoint`) still choose nearest to `preferredWorld`.

---

## 2) Mismatches vs `docs/GeoDraw-Spec.md`

### High-priority mismatches
- Undo/Redo model from spec is not implemented (history stack, commit-on-drag-end, keyboard shortcuts).
- Document state separation is not implemented:
  - Current `GeoState` includes construction + UI/view state (camera, active tool, hover, pending selection), while spec says document should store construction only.

### Model/style mismatches
- Shared stroke style is not normalized across all shapes:
  - Line/segment use `dash`/`opacity`, circle uses `strokeDash`/`strokeOpacity`.
- Point taxonomy is structurally close but not explicit as spec categories:
  - Spec wants explicit `FreePoint | ConstrainedPoint | DependentPoint` categories.
  - Current code uses many concrete variants directly.

### Partial/forward mismatches
- Intersections tool category is marked “later” in spec; explicit intersection tool is still not present (intersection creation is snap-driven).
- Circle-circle stable branch selection (explicit selector) is not yet implemented; still generic `preferredWorld` behavior.
- Top-right Undo/Redo icons are missing.
- Shape property panels beyond points are limited in sidebar (selection exists, rich editing mostly not).

### Areas aligned with spec
- Circle tool is in `CIRCLES` group.
- Multi-step hover/cursor/pending highlight/rubber-band preview implemented.
- Point tool + other tools now create constrained points on loci when snapped.
- Move tool cursor states (`pointer`/`grab`/`grabbing`) implemented.
- Delete parent-dependency behavior is consistent.
- Line-circle intersection teleporting is mitigated via branch index point type.

---

## 3) Minimal Next Refactor Step for ConstrainedPoint

Goal: implement spec taxonomy without a large rewrite, while keeping existing behavior.

### Minimal step (single focused refactor)
- Introduce a thin typed wrapper for constrained points in `src/scene/points.ts`:
  - Add:
    - `type ConstrainedPoint = PointOnLine | PointOnSegment | PointOnCircle`
    - `type DependentPoint = MidpointFromPoints | MidpointFromSegment | IntersectionPoint | CircleLineIntersectionPoint`
    - `type ScenePoint = FreePoint | ConstrainedPoint | DependentPoint` (via aliases, not field migration yet).
- Add helper predicates:
  - `isConstrainedPoint(p)`, `isDependentPoint(p)`, `isFreePoint(p)`.
- Update only type-level usage sites (no behavior changes):
  - `isPointDraggable`, creation helpers, and sidebar guards can reference these predicates.

### Why this is minimal and useful
- No data migration.
- No evaluator rewrite.
- Preserves all current features.
- Creates the taxonomy surface required by the spec, enabling later incremental normalization (shared stroke style and cleaner curve/locus abstraction).

### Optional immediate follow-up (still small)
- Normalize style key names by adding adapters:
  - Keep current fields, expose internal helper `toStrokeStyle(...)` for line/segment/circle rendering and copy-style.
