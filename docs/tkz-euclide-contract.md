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
\tkzMarkAngle[<tikz opts>,size=<r>](A,B,C)
\tkzFillAngle[fill=<color>,fill opacity=<o>,size=<r>](A,B,C)
\tkzMarkRightAngles[<tikz opts>,size=<r>](A,B,C)
\tkzLabelAngle[dist=<d>,angle=<deg>,<tikz text opts>](A,B,C){<label>}
```

Notes:
- `\tkzMarkRightAngles` (plural) is the public macro in tkz-euclide 5.x.
- Label placement uses `dist` + `angle`, derived from `labelPosWorld` relative to vertex `B`.
- Exporter is fail-closed: if any required macro is missing from whitelist, export throws.

## AngleFixed (deg)

GeoDraw `AngleFixed(B, A, deg, direction)` creates a rotated point `C` from base ray `BA`:

```tex
% CCW
\tkzDefPointBy[rotation=center B angle 30](A) \tkzGetPoint{C}

% CW
\tkzDefPointBy[rotation=center B angle -30](A) \tkzGetPoint{C}
```

Then draw the resulting direction using GeoDraw's line/ray strategy (currently line through `B,C`).

Fail-closed rules:
- Missing macro:
  - `Unsupported construction: AngleFixed (missing tkz macro: <name>)`
- If signed clockwise rotation is unsupported by backend:
  - `Unsupported AngleFixed option: direction=CW (no tkz mapping)`
