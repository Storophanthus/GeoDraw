# tkz-euclide Contract

Exporter contract:
- Exporter must be fail-closed.
- It may only emit macros that are either:
  1. in the cheat-sheet below, or
  2. verified in the tkz-euclide manual.
- No silent fallback.
- No invented macro names.
- No invented option keys.

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
