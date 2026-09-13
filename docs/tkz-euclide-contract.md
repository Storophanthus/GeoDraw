# tkz-euclide Contract

Exporter contract:
- Exporter must be fail-closed.
- It may only emit macros that are either:
  1. in the cheat-sheet below, or
  2. verified in the tkz-euclide manual.
- No silent fallback.
- No invented macro names.
- No invented option keys.

## Preview label translation

Point-label precision adjustments are added after automatic placement. Keep the
original anchor/compass direction and marker clearance fixed while accumulating
`pointLabelNudgesPx`; changing scene offsets would re-run placement and can jump
across the marker. Convert canvas pixels using the export coordinate scale and
captured density, invert screen y, and emit ordinary TikZ `xshift`/`yshift`.
These shifts also work for legacy `\tkzLabelPoint`: verified in TeX Live 2025
`tkz-base/tkz-obj-points.tex`, where its option list is forwarded directly to
`\node[label style,#1]`. No construction/intersection macro changes are involved.

Label-only regeneration must preserve the latest exported sizing parameters,
including an absent `figureTreatmentMode`. Legacy launch captures can have
treatment dropdown metadata that differs from this mode; substituting `canvas` for an
absent mode removes the legacy stroke calibration and increases widths by 2.4.
Only explicit treatment selection may change the calibration; sizing edits
change their individual multipliers. Copy label
fields explicitly, since label-edit objects can carry stale capture metadata.

## Preview sizing and stroke weight

The PDF dialog identifies its captured export mode beside the TikZ Code title.
"Round appearance values to 2 decimals" rounds visual settings and label
offsets; defining coordinates remain precise in both modes. A visible note
beside the control explains this distinction, including its importance for
tangencies and intersections in Geometric Construction mode.

Editing TikZ scale changes coordinate spacing; Global scale wraps the whole
figure. Both retain the captured `figureTreatmentMode` and factor. Clearing
Canvas at 100% previously enabled the legacy `0.5/1.2` line multiplier, so a
single 1 -> 0.95 scale edit changed 0.92 pt strokes to 0.38 pt. The preview's
`figureTreatmentCustomized` flag now carries the Custom indicator separately
from its calibration. Undo/redo preserves both. Explicit treatment selection
and canvas reset clear the flag and may intentionally change visual weight.

`applyPreviewSizingEdits` updates only the requested field. Unedited scale
values keep their full precision, including during formatting changes. Saved
Custom defaults retain their base treatment and reciprocal scale pair; the
Export panel keeps that treatment when manual multipliers differ from one.
The canvas-match notice describes proportions, not a switch to legacy metrics.

Regression: `preview-scale-preserve-line-weight.json` and its test reproduce
the old multiplier, check both drawing backends and output modes, compile
before/after at 0.95, cover close-up/legacy captures, and retain manually edited
strokes. Manual check: open PDF, change TikZ scale from 1 to 0.95, then Global
scale to 0.95; internal line-width declarations must stay unchanged. Undo/redo
must restore code, fields, and treatment indication together. The Lines
control must still change stroke width; resetting restores captured sizing.

## Preview code edits and label halo

Measured point labels use `anchor=base west` with their captured browser
baseline included in `yshift`. Do not use the baseline offset as `text height`:
a canvas name's middle-baseline offset can be shorter than the TeX glyph.
That under-reports standalone bounds and crops labels at the top of a figure
(the reported E case). Keep TeX's natural height/depth and all saved offsets.
Headless labels without matching measurements retain native anchor fallback.
Explicit user crop/view bounds still clip normally. Regression:
`point-label-natural-bounds.test.ts` checks glyph bounds inside compiled TeX;
`point-label-canvas-origin.test.ts` verifies unchanged physical baselines.

Sizing controls and label nudges/reset must merge their generated changes with
the code editor's manual changes. Compare with the last generated baseline,
never replace the editor wholesale. Non-overlapping changes (e.g. a manual
`gdLabelText` width and a point-scale change) combine; conflicting edits to a
dimension or command keep the code, sizing and label state unchanged and show
a message. Do not splice individual digits of competing dimension values.
This is a conservative text merge, not a semantic TeX editor; substantial
rewrites or insertions in the same location can require manual adjustment.
Undo/redo must retain the matching generated baseline and parameters as well
as the edited text, so the next nudge does not replay an undone movement.

Visual Exact halo widths use `plainLabelHaloScale = 0.4` after canvas-pixel
conversion and before user/treatment multipliers. Apply this to point, object,
angle, free-text and rich-text labels; retain per-point width and global halo
visibility choices. Canvas styling and the already-thin reconstructible
`0.42pt` contour are unchanged. Repeated `gdLabelText` presets remain editable.

## User Cheat-Sheet (verbatim)

```tex
tkz-euclide essentials

Defining multiple points 
	\tkzDefPoints{0/0/B, 6/0/C, 2/4/A}

Defining line perpendicular to AB and through C
	\tkzDefLine[perpendicular=through C](A,B) \tkzGetPoint{c}

Taking a point on ray AB and name it D
	\tkzDefPointBy[homothety=center A ratio 0.5](B) \tkzGetPoint{D}

Make a projection of A onto line BC
	\tkzDefPointBy[projection=onto B--C](A) \tkzGetPoint{A'}

Make A Line Parallel line AB through point P
     \tkzDefLine[parallel=through P](A,B) \tkzGetPoint{pAB}

Rotate clockwise
 	\tkzDefPointBy[rotation=center B angle -60](P) \tkzGetPoint{D}

Circle by Diameter (getting the center)
	\tkzDefCircle[diameter](D,C) \tkzGetPoint{o}

Circle by Radius (getting the center)
	\tkzDefCircle[R](O,1.73) \tkzGetPoint{X}

Circle by three points A,B,C
	\tkzDefCircle[circum](A,B,C)\tkzGetPoint{cen}

Draw circle of center O and Point A on the circle
	\tkzDrawCircle(O,A)

Draw circle and get a point h on its tangent line on A
	\tkzDrawCircle(O,A)  \tkzDefLine[tangent at=A](O)\tkzGetPoint{h}

Getting tangent point from circle with center O and radius OA to point P
	\tkzDefLine[tangent from = P](O,A) \tkzGetPoints{R}{S}

Intersect line BX and line BC and get a point there called P
	 \tkzInterLL(B,X)(M,C) \tkzGetPoint{P}

Intersect Line AB with Circle OA and name the two intersection points X and E
	\tkzInterLC(A,B)(O,A) \tkzGetPoints{X}{E}

Intersect Line AB with Circle of center o and pass theough D ,  and get only specific point separately 
	\tkzInterLC(B,A)(o,D) \tkzGetSecondPoint{E}
	 \tkzInterLC(B,C)(o,D) \tkzGetFirstPoint{F}

Getting Incentre of ABC, useful to draw angle bisectors (other options: ortho, circum, centroid)
	\tkzDefTriangleCenter[in](A,B,C) \tkzGetPoint{I}

Getting points on the sides of ABC that connect to the (centroid,in,orthic,circum)
	\tkzDefTriangleCenter[centroid](A,B,C)
	\tkzGetPoint{M}
	\tkzDefSpcTriangle[medial,name=M](A,B,C){_A,_B,_C}
	\tkzDrawSegments[dashed,new](A,M_A B,M_B C,M_C)

Drawing Arc with center A from C’ to C
	\tkzDrawArc(A,C')(C)
```

## How To Verify A Macro/Option

1. Search the tkz-euclide manual PDF for the exact macro and option key.
2. Verify the exact syntax and getter (`\tkzGetPoint` vs `\tkzGetPoints`).
3. Compile a minimal TeX example using only that macro/option.
4. Only then add/update exporter logic.

If verification fails, exporter must throw instead of guessing.

## PerpendicularLine

GeoDraw `PerpendicularLine(through=P, base=AB)` maps to:

```tex
\tkzDefLine[perpendicular=through P](A,B) \tkzGetPoint{Q}
\tkzDrawLine[add=5 and 5](P,Q)
```

Notes:
- `\tkzDefLine` returns a point on the constructed perpendicular via `\tkzGetPoint`.
- The base must be represented by two points `(A,B)` from a line or segment.
- Exporter must not invent option keys; only `perpendicular=through <Point>` is allowed.

## Angle

GeoDraw `Angle(A,B,C)` maps to tkz-euclide angle macros with vertex at `B`:

```tex
\tkzMarkAngle[arc=l|ll|lll,mark=<none|\\||\\|\\||\\|\\|\\|>,mksize=<s>,mkcolor=<c>,mkpos=<p>,<tikz opts>,size=<r>](A,B,C)
\tkzFillAngle[fill=<color>,fill opacity=<o>,size=<r>](A,B,C)
\tkzMarkRightAngles[<tikz opts>,size=<r>](A,B,C)
\tkzMarkRightAngles[german,<tikz opts>,size=<r>](A,B,C)
\tkzLabelAngle[dist=<d>,angle=<deg>,<tikz text opts>](A,B,C){<label>}
```

Notes:
- `\tkzMarkRightAngles` (plural) is the public macro in tkz-euclide 5.x.
- Right-angle styles:
  - `RightSquare` -> `\tkzMarkRightAngles[...]`
  - `RightArcDot` -> `\tkzMarkRightAngles[german,...]`
    - The inner dot sits halfway from the vertex to the arc on the internal
      bisector (`size/2` in TeXLive's `tkz-draw-eu-angles.tex`). Canvas and
      plain TikZ use the same arc-based placement; square-marker size and
      stroke width do not determine the dot's center.
- Right-angle marks are fail-closed gated by `angle.isRightExact === true` (construction provenance).
  - If a right-only mark style is requested on a non-right angle, exporter throws:
    `Unsupported construction: RightAngleMark on non-right angle`
- Non-right styles:
  - Vanilla arc -> `arc=l, mark=none`
  - Double arc -> `arc=ll`
  - Triple arc -> `arc=lll`
  - Arc bars -> `mark=|` / `mark=||` / `mark=|||`
- Label placement uses `dist` + `angle`, derived from `labelPosWorld` relative to vertex `B`.
- Exporter is fail-closed: if any required macro is missing from whitelist, export throws.

## AngleFixed (deg)

GeoDraw `AngleFixed(B, A, deg, direction)` creates a rotated point `C` from base ray `BA`:

```tex
% CCW
\tkzDefPointBy[rotation=center B angle 30](A) \tkzGetPoint{C}

% CW
\tkzDefPointBy[rotation=center B angle -30](A) \tkzGetPoint{C}

Internal angle bisector of angle ABC:
\tkzDefTriangleCenter[in](A,B,C) \tkzGetPoint{I}
\tkzDrawLine(B,I)
```

Then draw the resulting direction using GeoDraw's line/ray strategy (currently line through `B,C`).

Fail-closed rules:
- Missing macro:
  - `Unsupported construction: AngleFixed (missing tkz macro: <name>)`
- If signed clockwise rotation is unsupported by backend:
  - `Unsupported AngleFixed option: direction=CW (no tkz mapping)`

## CircleFixedRadius

GeoDraw fixed-radius circle `Circle(center=O, radius=r)` maps to:

```tex
\tkzDefCircle[R](O,r) \tkzGetPoint{X}
\tkzDrawCircle(O,X)
```

Exporter rule:
- Radius is exported in scene world units under the same global unit transform used for point coordinates.
- If required macro is missing from whitelist, exporter fails closed:
  - `Unsupported construction: CircleFixedRadius (missing tkz macro: <name>)`

## CircularSector

GeoDraw sector `Sector(A,O,B)` (center at `O`) maps to:

```tex
\tkzFillSector[fill=<color>,fill opacity=<o>](O,A)(B)
\tkzDrawSector[color=<color>,line width=<w>pt](O,A)(B)
```

Notes:
- `A` and `B` define the sector rays from center `O`.
- Exporter is fail-closed via macro whitelist checks (`tkzFillSector`, `tkzDrawSector`).

## SegmentMark

GeoDraw segment cosmetic `segmentMark` maps to:

```tex
\tkzMarkSegment[mark=||,pos=0.3,size=5.5pt,color=<color>,line width=1pt](A,B)
```

Supported mark tokens:
- `|`
- `||`
- `|||`
- `s`
- `s|`
- `s||`
- `x`
- `o`
- `oo`
- `z`

Fail-closed rules:
- Unknown mark token:
  - `Unsupported SegmentMark: mark=<value>`
- Invalid `pos`:
  - `Unsupported SegmentMark: pos`

## SegmentArrowMark

End-arrow overlay (supported):

```tex
\draw[color=<color>,line width=<w>pt,-{<tip>[scale=<s>]}] ($(A)!<t>!(B)$) -- (B);
```

Mid-arrow policy:
- Exported with TikZ decorations overlay:

```tex
\path[
  postaction=decorate,
  decoration={markings,mark=at position <pos> with {\arrow[color=<color>,line width=<w>pt]{<tip>}}}
] (A) -- (B);
```

Direction mapping:
- `->`: forward arrow in path direction.
- `<-`: reverse arrow (`\arrowreversed`).
- `<->`: separated forward + reverse heads around each mark position (true bidirectional look).
- `>-<`: separated inward heads around each mark position.

Tip mapping:
- `Stealth`
- `Latex`
- `Triangle`

Distribution:
- `single`: one logical mark position.
- `multi`: expanded into repeated `mark=at position ...` entries (not `mark=between`) for deterministic paired-direction handling.

Example paired-direction mark expansion:

```tex
\path[
  postaction=decorate,
  decoration={markings,
    mark=at position <p1> with {\arrowreversed[...]{Latex}},
    mark=at position <p2> with {\arrow[...]{Latex}}
  }
] (A) -- (B);
```

Notes:
- Exporter injects `\usetikzlibrary{decorations.markings,arrows.meta}` when arrow overlays are present.

## Circle / Arc ArrowMark

Circle and arc overlays use the same `PathArrowMark` semantics as segment mid-arrows:
- directions: `->`, `<-`, `<->`, `>-<`
- tips: `Stealth`, `Latex`, `Triangle`
- distributions: `single` / `multi`

Circle overlay path form:

```tex
\path[postaction=decorate,decoration={markings,...}]
  (<through-point>) arc[start angle=<a0>,end angle=<a0-360>,radius=<r>];
```

Arc overlay path form (sector/non-sector angle):

```tex
\path[postaction=decorate,decoration={markings,...}]
  (<start-point-or-coord>) arc[start angle=<a0>,end angle=<a1>,radius=<r>];
```

Notes:
- Sector overlays must anchor to the named sector start point (for example `(A)`) instead of raw numeric coordinates.
  This avoids known `tkzDrawSector` + `decorations.markings` frame-shift behavior under `\tkzClip`.
