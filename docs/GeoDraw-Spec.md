# GeoDraw Spec (Source of Truth)

## Layout (GeoGebra-like)

* Left vertical toolbar (icon-only buttons + hover tooltips; grouped by category)
* Center: canvas only (no controls overlaying the canvas)
* Right sidebar: Algebra list + Properties panel for selected object
* Top-right of canvas: Undo / Redo small icons

## Tool Categories

* **POINTS**: Move/Select, Point, Midpoint, Copy Style
* **LINES**: Segment, Line (2 points)
* **CIRCLES**: Circle (center + through point)
* **INTERSECTIONS** (later): Intersection point tool (line-line, line-circle, circle-circle)

## Interaction Rules

### Move tool

* pointer down on draggable point => drag it (unless locked)
* pointer down on empty canvas => pan camera
* wheel => zoom-at-cursor
* hover point => cursor `pointer`; hover empty => `grab`; dragging/panning => `grabbing`

### Multi-step construction tools (Segment / Line2P / CircleCP / Midpoint-two-points)

* When hovering a valid target for the current step: cursor changes to `pointer`
* After selecting the first object: it stays highlighted (“glow”) until tool completes or Esc cancels
* Rubber-band preview after first click:

  * Segment: preview segment to cursor
  * Line2P: preview infinite line clipped to viewport
  * CircleCP: preview circle centered at first point with radius to cursor
* Esc cancels pending step

### Point tool

* click empty => create free point
* click near existing point => select it
* click near an object (circle/line/segment) => create a **constrained point** on that object (PointOnCircle / PointOnLine / PointOnSegment) rather than a free point

### Delete

* Delete/Backspace removes selected object
* Deleting a parent point deletes dependent objects referencing it (simple consistent policy)

## Undo/Redo

* Undo: Cmd/Ctrl+Z
* Redo: Cmd+Shift+Z and Ctrl+Y
* History includes construction changes only:

  * create/delete objects, move points (commit on drag end), rename/caption/style changes
* History excludes view/UI state:

  * camera pan/zoom, grid toggle, hover state, active tool

## Data Model

### Document state

* Stores only construction objects and naming allocator state (not UI).
* All geometry is evaluated from stored definitions + dependencies.

### Object base fields (all types)

* id: stable internal id
* visible: boolean
* auxiliary: boolean (optional)
* style: type-specific but based on shared Stroke/Fill/Label styles where applicable

## Points: Three Types

### A) FreePoint

* draggable freely in the plane
* affects dependent objects
* stores world position

### B) ConstrainedPoint (Magnet point)

* draggable only along a locus (line / segment / circle; ellipse/arc later)
* remains on its locus if parents move/resize
* recommended representation:

  * On circle: store `circleId` + `theta` (angle parameter)
  * On line: store `lineId` + `t` (line parameter)
  * On segment: store `segmentId` + `u` in [0,1] (clamped)
* dragging updates parameter (theta/t/u), not free coordinates

### C) DependentPoint (Fixed / Dynamic)

* not draggable
* position computed from other objects
* examples:

  * Midpoint of two points: depends on (A,B)
  * Midpoint of segment: depends on segment endpoints
  * Intersections: depends on parent objects with stable branch selection

## Point fields (common)

* id: stable internal id
* name: string (unique, TikZ-safe identifier)
* captionTex: string (TeX label text, e.g. `X_1`, `X^{\prime}`; user types without `$`)
* visible: boolean (Show Object)
* showLabel: "none" | "name" | "caption" (Show Label)
* locked: boolean (Fix Object; prevents dragging free/constrained points)
* auxiliary: boolean
* style:

  * shape: enum ("circle","dot","x","plus","cross","diamond","square","triUp","triDown","triLeft","triRight",...)
  * sizePx: number (default small)
  * strokeColor, strokeWidth, strokeOpacity
  * fillColor, fillOpacity
  * labelFontPx (default larger), labelColor
  * labelHaloColor (default white), labelHaloWidthPx
  * labelOffsetPx

## Naming Rule (GeoGebra-like)

* Default point names: A..Z, then A_1..Z_1, A_2...
* Must reuse earliest available:

  * If A,B,C exist and B is deleted, the next auto-name must be B.

## Lines / Segments / Circles

### Shared cosmetics (StrokeStyle)

* strokeColor
* strokeWidth
* strokeDash (e.g., [] or [6,4])
* strokeOpacity (0..1)

### Fill cosmetics (later)

* fillColor
* fillOpacity
  Applies to circles/polygons/arcs when supported.

### Line (2 points)

* infinite line through points A and B
* rendered clipped to viewport
* hit-test uses distance point-to-infinite-line (screen px)

### Segment

* finite segment between A and B
* hit-test uses point-to-segment distance (screen px)

### Circle (center + through point) [CircleCP]

* defined by center O and point X on circle
* radius updates dynamically with X
* hit-test uses distance to circle boundary (screen px tolerance)

## Snapping (later milestone, but creation must already respect constraints)

Priority:

1. existing points
2. intersections (line-line, line-circle, circle-circle)
3. on-object projection (circle boundary / line / segment)
4. grid (optional)

## Intersection Points (stability requirement)

* Intersection points must be dependent objects.
* Must **not** “teleport” between two solutions:

  * For line–circle intersections: store sorted parameter branchIndex (t1/t2) OR store preferredWorld and choose closest consistently.
  * For circle–circle: same principle (stable branch selection).
* If intersection disappears: mark undefined/hidden (do not jump to another unrelated position).

## Copy Style

* Tool behavior:

  * First click selects source object (stores cosmetic style only)
  * Subsequent clicks apply style to targets repeatedly
  * Shift-click sets a new source without leaving tool
  * Esc clears source/exits
* Applies only cosmetic fields relevant to the target type.
