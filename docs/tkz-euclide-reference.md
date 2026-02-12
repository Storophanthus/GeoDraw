# tkz-euclide Reference (GeoDraw Exporter)

This project enforces a generated tkz-euclide macro whitelist derived from TeXLive package sources.

- Source location is discovered via: `kpsewhich tkz-euclide.sty`
- Whitelist file is generated to: `docs/tkz-euclide-macros.json`
- Update command: `npm run update:tkz-macros`

Do not invent macro names or option keys.
If exporter logic needs a macro, it must exist in the generated whitelist.

## Angle snippets

```tex
% Mark convex angle ABC
\tkzMarkAngle[size=1.2](A,B,C)

% Fill convex angle ABC
\tkzFillAngle[fill=blue!30,fill opacity=0.3,size=1.2](A,B,C)

% Right-angle marker at B
\tkzMarkRightAngles[size=0.35](A,B,C)

% Label by distance + absolute direction from B
\tkzLabelAngle[dist=1.4,angle=42](A,B,C){$1.571\ \mathrm{rad}$}
```

## AngleFixed (deg) snippets

```tex
% Fixed angle point from base ray BA, CCW 30 deg
\tkzDefPointBy[rotation=center B angle 30](A) \tkzGetPoint{C}
\tkzDrawLine[add=5 and 5](B,C)

% Fixed angle point from base ray BA, CW 30 deg
\tkzDefPointBy[rotation=center B angle -30](A) \tkzGetPoint{Cw}

% Internal angle bisector of angle ABC (line through vertex B)
\tkzDefTriangleCenter[in](A,B,C) \tkzGetPoint{I}
\tkzDrawLine(B,I)
\tkzDrawLine[add=5 and 5](B,Cw)
```

## Segment mark snippets

```tex
% Tick mark at 30% along segment
\tkzMarkSegment[mark=||,pos=0.3,size=5.5pt,color=teal,line width=1pt](D,E)

% End-arrow overlay on segment
\draw[color=teal,line width=1.2pt,-{Stealth[scale=1]}] ($(D)!0.94!(E)$) -- (E);

% Mid-arrow overlay on segment (no segment redraw)
\path[
  postaction=decorate,
  decoration={markings,mark=at position 0.4 with {\arrow[color=teal,line width=1.2pt]{>};\arrowreversed[color=teal,line width=1.2pt]{>}}}
] (D) -- (E);

% Multi-arrow overlay
\path[
  postaction=decorate,
  decoration={markings,mark=between positions 0.45 and 0.55 step 0.05 with {\arrow[color=teal,line width=1.2pt]{>}}}
] (D) -- (E);

% Fixed-radius circle (center O, radius 3.5)
\tkzDefPoints{0/0/O}
\tkzDefCircle[R](O,3.5) \tkzGetPoint{X}
\tkzDrawCircle(O,X)

% Circular sector AOB (center O)
\tkzFillSector[fill=blue!20,fill opacity=0.25](O,A)(B)
\tkzDrawSector[color=blue,line width=1pt](O,A)(B)
```

## User Cheat-Sheet (verbatim)

```tex
tkz-euclide essentials

Defining multiple points 
	\tkzDefPoints{0/0/B, 6/0/C, 2/4/A}

Defining line perpendicular to AB and through C
	\tkzDefLine[perpendicular=through C](A,B) \tkzGetPoint{c}

Perpendicular line through P to AB (GeoDraw PerpendicularLine mapping)
	\tkzDefLine[perpendicular=through P](A,B) \tkzGetPoint{q}
	\tkzDrawLine[add=5 and 5](P,q)

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
