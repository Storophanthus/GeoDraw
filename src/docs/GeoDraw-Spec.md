# GeoDraw Spec (Source of Truth)

## Layout (GeoGebra-like)
- Left vertical toolbar (icon-only buttons + hover tooltips)
- Center: canvas only (no controls overlaying canvas)
- Right sidebar: Algebra list + Properties for selected object

## Tools (initial)
- Move/Select (default)
- Point
- (placeholders): Line, Segment, Circle, Intersection

## Interaction Rules
- Move tool:
  - pointer down on point => drag point (unless locked)
  - pointer down on empty canvas => pan camera
  - wheel => zoom-at-cursor
- Point tool:
  - click empty => create point
  - click near existing point => select it
- Delete:
  - Delete/Backspace removes selected object

## Point Object Model
- id: stable internal id
- name: string (unique, TikZ-safe identifier)
- captionTex: string (TeX label text, e.g. `X_1`, `X^{\prime}`; user types without `$`)
- visible: boolean (Show Object)
- showLabel: "none" | "name" | "caption" (Show Label dropdown)
- locked: boolean (Fix Object)
- auxiliary: boolean (Auxiliary Object)
- style:
  - shape: enum ("circle","dot","x","plus","cross","diamond","square","triUp","triDown","triLeft","triRight",...)
  - sizePx: number
  - strokeColor: string
  - strokeWidth: number
  - fillColor: string
  - fillOpacity: number (0..1)

## Naming Rule (GeoGebra-like)
- Default point names: A..Z, then A_1..Z_1, A_2...
- Must reuse earliest available:
  - If A,B,C exist and B is deleted, the next auto-name must be B.

## Rendering Rules
- If visible=false: do not draw object.
- Points render with fill + stroke (outline).
- Labels:
  - showLabel=none => no label
  - showLabel=name => draw `name`
  - showLabel=caption => draw `captionTex` (plain text for now; later KaTeX overlay)
- Canvas labels must not intercept pointer events (if HTML overlay, use pointer-events:none).

## Snapping (later milestone)
Priority:
1) existing points
2) intersections (line-line, line-circle, circle-circle)
3) on-object projection (circle boundary / line / segment)
4) grid (optional)

Intersection points must be dependent:
- store parents + preferredWorld position
- on recompute choose intersection closest to preferredWorld
