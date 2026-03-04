# Deep research report on `\tkzGetSecondPoint` selection in `tkz-euclide` intersections

## Executive summary

The macro `\tkzGetSecondPoint` in `tkz-euclide` does **not** compute or “choose” an intersection point itself; it merely **copies the coordinate stored in** `tkzSecondPointResult` into a user-named TikZ coordinate. citeturn40view0 The **actual selection** of *which* geometric intersection becomes “first” vs “second” occurs earlier, inside the intersection macros—primarily `\tkzInterLC` (line–circle) and `\tkzInterCC` (circle–circle)—which (a) compute two candidate points and then (b) may **swap** them based on options such as `near`, `common=…`, and the internal angle-ordering rule. citeturn33view0turn30view0turn30view2

For **line–circle**, the default behaviour (when `near`, `common`, and `next to` are not used) is to assign `tkzFirstPointResult` to the point that yields the **smaller oriented angle** (counterclockwise) in the package’s angle convention; the documentation states this explicitly, and the code implements it by computing an oriented angle and swapping if it is ≥ 180°. citeturn30view1turn33view0turn36view0 When the line passes through the circle centre (a special case), the documentation recommends using `near` because “you cannot compare the angles”; the code has a dedicated numerical branch for “line through centre” and the ordering can become sensitive to the **order of the line’s defining points**. citeturn30view1turn33view0

For **circle–circle**, the default ordering is also angle-based, but the documentation describes it as choosing the point that forms the **clockwise** angle between centres at the intersection point; the code again implements this via `\tkzFindAngle(...)` and a `<180°` test, and swapping the circle argument order can flip which intersection becomes “first” vs “second”. citeturn30view2turn33view0turn36view0

Edge cases are important: tangency yields *two equal points* (first and second coincide); disjoint circles/lines can produce an error or invalid points unless you guard with `\tkzTestInterLC` / `\tkzTestInterCC` and `\iftkzFlagLC` / `\iftkzFlagCC`; and concentric circles (distance between centres = 0) can trigger division-by-zero in the circle–circle computation. citeturn30view0turn30view2turn33view0

## Version and primary sources

This report targets the current CTAN release **`tkz-euclide` 5.13c (2026‑01‑25)**. citeturn37view0turn38view0 The package is maintained by entity["people","Alain Matthes","latex package author"]. citeturn37view0turn28view0

Primary sources used:

- CTAN catalogue entry for versioning and canonical links. citeturn37view0  
- Official manual (`tkz-euclide.pdf`), especially the “Intersections” chapter describing point-order rules and the `near/common` semantics. citeturn28view0turn30view0turn30view1turn30view2turn30view3  
- Package source files (raw distribution):
  - `tkz-obj-eu-points.tex` for `\tkzGetSecondPoint`, `\tkzGetPoints`, etc. citeturn40view0  
  - `tkz-tools-eu-intersections.tex` for `\tkzInterLC`, `\tkzInterCC`, ordering rules, and intersection computations. citeturn33view0  
  - `tkz-tools-eu-angles.tex` for `\tkzFindAngle` semantics (oriented/counterclockwise normalisation). citeturn36view0  
  - `tkz-euclide.sty` for module load paths and the `lua/mini` option routing. citeturn38view0  

Secondary sources (for user-facing behaviour reports and historical context):

- TeX Stack Exchange discussion where the package author recommends using `common=...` and `near` to stabilise selection. citeturn31view0  
- TeX Stack Exchange thread explicitly asking “order of intersections” for `\tkzInterLC` and mentioning `\tkzInterCC` ordering sensitivity. citeturn32view0  

## Code path and data model for intersection results

### The `tkz-euclide` “result registers”

The package uses a predictable naming convention for computed intermediate points:

- Single-point results are stored in a TikZ coordinate named `tkzPointResult`.
- Two-point results (like intersections) are stored as `tkzFirstPointResult` and `tkzSecondPointResult`. citeturn40view0turn33view0  

The getter macros are extremely thin wrappers:

- `\tkzGetPoints{P}{Q}` copies `tkzFirstPointResult` to `(P)` and `tkzSecondPointResult` to `(Q)`. citeturn40view0  
- `\tkzGetSecondPoint{Q}` is defined as:

```latex
\def\tkzGetSecondPoint#1{\coordinate (#1) at (tkzSecondPointResult);}
```

citeturn40view0  

Therefore, **any “selection logic” attributed to `\tkzGetSecondPoint` is actually the logic that determines what is stored in `tkzSecondPointResult`** by the preceding intersection macro. citeturn40view0turn33view0

### Where the ordering is decided

The ordering is set by `\tkzInterLC` and `\tkzInterCC`, which:

1. Compute two geometrically valid candidate points into `tkzFirstPointResult` and `tkzSecondPointResult`.
2. Optionally **swap** these two by aliasing with `\pgfnodealias{...}{...}` based on options and angle/distance tests. citeturn33view0turn36view0  

### The oriented-angle primitive that underpins ordering

The macro `\tkzFindAngle(A,B,C)` computes an oriented (counterclockwise) angle at vertex `B` from ray `BA` to ray `BC` by:

- measuring slope angles with `\pgfmathanglebetweenpoints`,
- normalising them via `\tkzNormalizeAngle`,
- and returning the difference “second minus first”. citeturn36view0  

That is, in `tkz-euclide`’s convention, `\tkzFindAngle(A,B,C)` yields an angle in degrees in `[0,360)` representing the **counterclockwise rotation** from direction `B→A` to direction `B→C`. citeturn36view0turn30view1  

This matters because both `\tkzInterLC` and `\tkzInterCC` use a `< 180°` test on such an angle to decide whether to swap “first” and “second”. citeturn33view0turn30view1turn30view2  

## Selection logic for line–circle intersections

### Computation of the two intersection points

The public macro is `\tkzInterLC[<options>](A,B)(O,C)` (or radius forms). The manual states that it defines the intersection points of line `(AB)` with the circle centred at `O` and radius `r`, and that it can error if no intersection exists. citeturn30view0

In source, `\tkzInterLC` delegates computation to an internal routine `\tkzInterLCR`, which takes a centre and a numeric radius (dimension). citeturn33view0 The core geometric computation has two branches:

- **Branch for “line passes through centre” (approximate test):** it checks whether the perpendicular distance from centre to line is less than `0.05pt`. If so, it constructs one intersection by taking the direction vector of the line and intersecting the circle border in that direction, then reflects it through the centre to get the opposite point. citeturn33view0turn30view1  
- **General branch:** it projects the centre `O` onto the line to get the foot `H`, uses `acos(d/r)` to get a rotation angle (where `d = |OH|`), constructs a base point on the circle along the `O→H` direction, then rotates that base point around `O` by `±angle` to obtain two intersections. citeturn33view0  

The comments in the source include a classic “ray–sphere intersection” derivation (quadratic discriminant) as a conceptual reference, though the actual 2D implementation uses projection + rotation. citeturn33view0

### How `\tkzInterLC` assigns “first” vs “second”

After `\tkzInterLCR` has produced the two candidates, `\tkzInterLC` may swap them based on keys. The manual summarises the main rules:

- `common=<pt>`: `<pt>` is the common point; `tkzFirstPoint` yields the other point. citeturn30view0  
- `near`: `tkzFirstPoint` is the closest point to the **first point of the line**. citeturn30view0turn30view1  
- If neither `common` nor `near` is used, then `tkzFirstPoint` corresponds to the “smallest angle” criterion involving the other point and the circle centre. citeturn30view0turn30view1  

The source implements these rules (and one more distance-based key) in this priority order:

1. **`near` key (highest priority):** compare distances from the *first line point* (`A` in `(A,B)`) to each intersection; if the first is not strictly closer, swap; thus `tkzFirstPointResult` becomes the nearer one. citeturn33view0turn30view1  
2. Else if **`common=<pt>`** is set: check whether the current `tkzSecondPointResult` is within a tolerance of the declared common point; if not, swap. The net effect is:  
   - `tkzSecondPointResult` becomes the common point,  
   - `tkzFirstPointResult` becomes “the other one”, matching the documentation statement. citeturn33view0turn30view0  
3. Else if **`next to=<pt>`** is set (present in code and used in the manual’s examples, but not listed in the `\tkzInterLC` option table on the intersections page): compare distances from `<pt>` to each intersection, and keep/swap so that `tkzFirstPointResult` is nearer. citeturn33view0turn35view0  
4. Else (default): compute an **oriented** angle via `\tkzFindAngle(tkzSecondPointResult, tkzFirstPointResult, O)` and if it is not `<180°`, swap. This corresponds to selecting the intersection that yields the smaller counterclockwise angle, as explained in the manual. citeturn33view0turn36view0turn30view1  

### Behavioural consequence for `\tkzGetSecondPoint`

Because `\tkzGetSecondPoint` returns whatever is in `tkzSecondPointResult`, its meaning is:

- Default: “the *other* intersection point” after the angle-based ordering. citeturn40view0turn33view0turn30view1  
- With `near`: “the farther intersection from the first line point”. citeturn33view0turn30view1  
- With `common=<pt>`: “the common point” (within tolerance). citeturn33view0turn30view0  
- With `next to=<pt>`: “the farther intersection from `<pt>`”. citeturn33view0turn35view0  

### A compact comparison table for line–circle selection

| `\tkzInterLC` options | What `tkzFirstPointResult` means | What `tkzSecondPointResult` (hence `\tkzGetSecondPoint`) means |
|---|---|---|
| none | point selected by `<180°` oriented-angle test | the other intersection citeturn33view0turn30view1 |
| `near` | closest intersection to the first line point | the other (farther) one citeturn33view0turn30view0turn30view1 |
| `common=<pt>` | the *other* intersection (not the common) | the common point (within tolerance) citeturn33view0turn30view0 |
| `next to=<pt>` | closest intersection to `<pt>` | the other (farther) one citeturn33view0turn35view0 |

### Mermaid flowchart for `\tkzInterLC` ordering

```mermaid
flowchart TD
  S([\\tkzInterLC called]) --> V[Resolve circle form: node / R / with nodes]
  V --> C[Compute raw intersections via \\tkzInterLCR\n-> tkzFirstPointResult, tkzSecondPointResult]
  C --> N{near?}
  N -- yes --> DN[Compare distances to first line point]
  DN --> SN{First < Second?}
  SN -- no --> SW1[Swap results]
  SN -- yes --> K1[Keep]
  SW1 --> E([\\tkzGetSecondPoint reads tkzSecondPointResult])
  K1 --> E
  N -- no --> CM{common set?}
  CM -- yes --> DC[Is Second within tolerance of common?]
  DC -- yes --> K2[Keep (Second=common)]
  DC -- no --> SW2[Swap (Second=common)]
  K2 --> E
  SW2 --> E
  CM -- no --> NT{next to set?}
  NT -- yes --> DNT[Compare distances to next-to point]
  DNT --> SNT{First < Second?}
  SNT -- no --> SW3[Swap]
  SNT -- yes --> K3[Keep]
  SW3 --> E
  K3 --> E
  NT -- no --> A[Compute ang = angle(Second, First, Center)]
  A --> SA{ang < 180°?}
  SA -- yes --> K4[Keep]
  SA -- no --> SW4[Swap]
  K4 --> E
  SW4 --> E
```

The flowchart matches the explicit branching structure in the source and the manual’s option descriptions. citeturn33view0turn30view0turn30view1turn36view0

## Selection logic for circle–circle intersections

### Computation of the two intersection points

The public macro is `\tkzInterCC[<options>](O,A)(O',A')` (and radius variants). The manual states that if two circles do not share a common point, the macro ends with an error “that is not handled”, and it explains the ordering using opposite-direction angles. citeturn30view2turn30view3

In source, `\tkzInterCC` delegates to `\tkzInterCCR`, which implements a well-known circle–circle intersection formula: compute the “radial centre” along the line between the two centres, compute the offset length `h`, then add/subtract a perpendicular offset to get the two intersection coordinates. citeturn33view0turn36view0 The source comments explicitly cite the public-domain C algorithm attributed to entity["people","Tim Voght","circle intersection code 2005"] and mention `hypot(dx,dy)` as suggested by entity["people","Keith Briggs","numerical methods author"]. citeturn33view0turn43view0

A notable implementation detail: the TeX code uses `sqrt(abs(...))` in the “height” computation (marked in-source as “abs !2024”), which reduces failures from tiny negative radicands caused by numerical error, but can also mask non-intersection cases if you do not guard with `\tkzTestInterCC`. citeturn33view0turn30view2

### How `\tkzInterCC` assigns “first” vs “second”

The manual’s ordering statement for circle–circle is: if the intersections are `A` and `B`, the directed angles `O,A,O'` and `O,B,O'` are in opposite directions, and `tkzFirstPoint` is assigned to the point that forms the **clockwise** angle. citeturn30view2turn30view3

The source realises this by computing an oriented angle with `\tkzFindAngle(O, P, O')` at the intersection point `P` and swapping if the result is not `<180°`. citeturn33view0turn36view0 Because `\tkzFindAngle` is counterclockwise by definition, the “clockwise” phrasing in the manual corresponds to selecting the intersection for which the **counterclockwise** angle from ray `P→O` to ray `P→O'` is the **smaller** one (i.e. the minor angle, <180°), since the other intersection yields the major complement (>180°). citeturn36view0turn30view2turn33view0

The only explicit point-selection option documented and implemented in `\tkzInterCC` is:

- `common=<pt>`: `<pt>` is the known common intersection; `tkzFirstPoint` yields the other one, and the code enforces this by swapping unless `tkzSecondPointResult` is within a small tolerance of `common`. citeturn30view2turn33view0

### Behavioural consequence for `\tkzGetSecondPoint`

For circle–circle intersections:

- Default: `\tkzGetSecondPoint` returns “the other intersection” after angle-based ordering. citeturn40view0turn33view0turn30view2  
- With `common=<pt>`: `\tkzGetSecondPoint` returns the common point (within tolerance), while `\tkzGetFirstPoint` returns the other one. citeturn33view0turn30view2  
- Changing the *order* of the two circle arguments can flip which geometric intersection is first/second, because the angle test is not symmetric in `(circle1, circle2)`. citeturn33view0turn30view2turn32view0  

## Edge cases, numerical stability, and reproducibility tests

### Edge cases and failure modes

**Tangent intersections (one real point).**  
Both line–circle and circle–circle computations still produce two “results”, but in tangency the geometry has a double root: the two computed points coincide (or are extremely close). This means `\tkzGetFirstPoint` and `\tkzGetSecondPoint` can give identical coordinates (or small numerical differences), which can break downstream constructions that assume distinct points. The manual hints at “only one point: no problem to choose”, and examples on TeX Stack Exchange report “nearby” points due to rounding. citeturn31view0turn30view0turn30view2

**Line through centre (line–circle special case).**  
The manual states “you cannot compare the angles” and recommends `near`, because ordering becomes sensitive; the code has a specific numerical branch triggered by a `0.05pt` distance threshold from the centre to the line. Swapping the line’s defining points `(A,B)` → `(B,A)` can flip which physical intersection ends up as `tkzSecondPointResult`, hence flip the output of `\tkzGetSecondPoint`. citeturn30view1turn33view0

**No intersection (disjoint line–circle).**  
The manual says an error will be reported in the `.log` file if there is no intersection, and it provides `\tkzTestInterLC` + `\iftkzFlagLC` to guard. In code, `\tkzTestInterLC` checks whether the centre-to-line distance exceeds the radius and sets a boolean flag accordingly; `\tkzInterLC` itself does not appear to hard-stop before calling `acos`, so invalid configurations can surface as arithmetic errors if you do not test first. citeturn30view0turn30view1turn33view0

**No intersection or degenerate intersection (circle–circle).**  
The manual warns that if circles have no common point, the macro errors “that is not handled”, and suggests guarding via `\tkzTestInterCC` + `\iftkzFlagCC`. The source’s “abs in sqrt” reduces some numerical failures but does not replace logical solvability checks; it can even yield meaningless “intersection” coordinates if used on disjoint circles without prior testing. citeturn30view2turn33view0

**Concentric / coincident circles.**  
The circle–circle computation divides by the centre distance `d`; if centres coincide (`d=0`), this is a division-by-zero situation. `\tkzTestInterCC` checks only inequalities corresponding to “non-empty intersection” and can return true for coincident circles (intersection = entire circle), but `\tkzInterCC` still cannot produce two discrete points in that case. You should add an explicit “centres distinct” check if there is any risk of `O = O'`. citeturn33view0turn30view2

### Behaviour differences between line–circle and circle–circle selection

- Line–circle has **`near`** and **`next to`** distance-based ordering options; circle–circle does not. citeturn33view0turn30view0turn35view0  
- Circle–circle’s default ordering depends on the **order of circle arguments** more obviously (swap circles → flip which point satisfies the `<180°` rule), whereas line–circle’s default ordering is comparatively stable unless the line passes through the centre (or the geometry is symmetrical/tangent). citeturn33view0turn30view1turn30view2turn32view0  
- Tolerances differ: the “line through centre” test uses `0.05pt`, `common` uses `1pt` in line–circle vs `0.05pt` in circle–circle (per source). citeturn33view0  

### Minimal reproducible LaTeX examples and expected outputs

The following MWEs are designed to be compiled with `lualatex` or `pdflatex`. They print the resulting coordinates to the log using `\tkzGetPointCoord` (values are in **cm**). citeturn40view0

#### Test harness helper (reuse across MWEs)

```latex
% After you have defined points P, Q:
\tkzGetPointCoord(P){P}
\tkzGetPointCoord(Q){Q}
\typeout{P=(\Px,\Py)  Q=(\Qx,\Qy)}
```

`tkz-euclide` defines `\tkzGetPointCoord` so that `\Px`/`\Py` etc expand to numerical coordinates in cm. citeturn40view0

#### Line–circle ordering (default vs `near`)

Geometry: circle centre `(0,0)` radius `1`; line `y=0.5` intersects at `(±0.866025..., 0.5)`.

```latex
\documentclass{standalone}
\usepackage{tkz-euclide}
\begin{document}
\begin{tikzpicture}
  \tkzDefPoint(0,0){O}
  \tkzDefPoint(1,0){C} % radius 1
  \tkzDefPoint(-2,0.5){A}
  \tkzDefPoint( 2,0.5){B}

  % Default ordering
  \tkzInterLC(A,B)(O,C) \tkzGetPoints{P}{Q}
  \tkzGetPointCoord(P){P}\tkzGetPointCoord(Q){Q}
  \typeout{Default: P=(\Px,\Py) Q=(\Qx,\Qy)}

  % 'near' ordering (closest to A)
  \tkzInterLC[near](A,B)(O,C) \tkzGetPoints{Pn}{Qn}
  \tkzGetPointCoord(Pn){Pn}\tkzGetPointCoord(Qn){Qn}
  \typeout{Near:    Pn=(\Pnx,\Pny) Qn=(\Qnx,\Qny)}
\end{tikzpicture}
\end{document}
```

**Expected** (up to minor formatting/rounding by PGF math):

- Default: `P ≈ ( +0.8660254 , 0.5 )` and `Q ≈ ( −0.8660254 , 0.5 )`.  
- With `near`: `Pn ≈ ( −0.8660254 , 0.5 )` and `Qn ≈ ( +0.8660254 , 0.5 )`.  

This matches the manual’s explanation that ordering is angle-based by default and distance-to-first-line-point under `near`, and it follows the source’s swap logic. citeturn30view0turn30view1turn33view0turn36view0

#### Line through centre sensitivity (why `near` matters)

Geometry: circle centre `(0,0)` radius `1`; line is the x-axis. Intersections are `(-1,0)` and `(1,0)`.

```latex
\documentclass{standalone}
\usepackage{tkz-euclide}
\begin{document}
\begin{tikzpicture}
  \tkzDefPoint(0,0){O}
  \tkzDefPoint(1,0){C} % radius 1
  \tkzDefPoint(-2,0){A}
  \tkzDefPoint( 2,0){B}

  \tkzInterLC(A,B)(O,C) \tkzGetPoints{P}{Q}
  \tkzInterLC(B,A)(O,C) \tkzGetPoints{Pr}{Qr}

  \tkzGetPointCoord(P){P}\tkzGetPointCoord(Q){Q}
  \tkzGetPointCoord(Pr){Pr}\tkzGetPointCoord(Qr){Qr}
  \typeout{AB:  P=(\Px,\Py) Q=(\Qx,\Qy)}
  \typeout{BA: Pr=(\Prx,\Pry) Qr=(\Qrx,\Qry)}
\end{tikzpicture}
\end{document}
```

**Expected:** the pair `{P,Q}` will be `{(-1,0),(1,0)}` but the **assignment to first vs second can flip** when swapping `(A,B)` to `(B,A)`. This matches the manual’s cautionary note and the code’s special “through-centre” branch. citeturn30view1turn33view0

To stabilise, use `near` (choose which endpoint should determine “first”):

```latex
\tkzInterLC[near](A,B)(O,C) \tkzGetPoints{P}{Q}
```

This aligns with the author’s guidance on TeX Stack Exchange and the manual. citeturn31view0turn30view1turn33view0

#### Circle–circle ordering and argument-order flip

Geometry: two unit circles with centres `(0,0)` and `(1,0)`. Intersections are `(0.5, ±0.866025...)`.

```latex
\documentclass{standalone}
\usepackage{tkz-euclide}
\begin{document}
\begin{tikzpicture}
  \tkzDefPoint(0,0){O1}
  \tkzDefPoint(1,0){O2}
  \tkzDefPoint(1,0){A1} % point on circle 1 (radius 1)
  \tkzDefPoint(2,0){A2} % point on circle 2 (radius 1)

  \tkzInterCC(O1,A1)(O2,A2) \tkzGetPoints{P}{Q}
  \tkzInterCC(O2,A2)(O1,A1) \tkzGetPoints{Pr}{Qr}

  \tkzGetPointCoord(P){P}\tkzGetPointCoord(Q){Q}
  \tkzGetPointCoord(Pr){Pr}\tkzGetPointCoord(Qr){Qr}
  \typeout{O1/O2: P=(\Px,\Py) Q=(\Qx,\Qy)}
  \typeout{O2/O1: Pr=(\Prx,\Pry) Qr=(\Qrx,\Qry)}
\end{tikzpicture}
\end{document}
```

**Expected:**

- With order `(O1, O2)`: `P ≈ (0.5, +0.8660254)` and `Q ≈ (0.5, −0.8660254)`.  
- With order `(O2, O1)`: the assignments flip (upper becomes second, lower becomes first).  

This is the direct consequence of the angle test being computed as `angle(O_first, intersection, O_second) < 180°` and is discussed both in the manual and in community questions about ordering. citeturn30view2turn30view3turn33view0turn32view0turn36view0

#### Guarding against non-intersection

The manual provides `\tkzTestInterLC` / `\tkzTestInterCC` tests and flags (`\iftkzFlagLC`, `\iftkzFlagCC`). citeturn30view0turn30view2 A robust pattern is:

```latex
\tkzTestInterLC(A,B)(O,C)
\iftkzFlagLC
  \tkzInterLC(A,B)(O,C)\tkzGetPoints{P}{Q}
\else
  \typeout{No line-circle intersection.}
\fi
```

and similarly for circle–circle:

```latex
\tkzTestInterCC(O1,A1)(O2,A2)
\iftkzFlagCC
  \tkzInterCC(O1,A1)(O2,A2)\tkzGetPoints{P}{Q}
\else
  \typeout{No circle-circle intersection (or degenerate).}
\fi
```

These tests correspond to the boolean flags set in the package’s intersection routines and are recommended by the manual. citeturn30view0turn30view2turn33view0turn38view0

### References to key sources and threads

- CTAN package page (version, canonical links). citeturn37view0  
- Official manual, “Intersections” chapter:
  - line–circle option table and ordering statement. citeturn30view0turn30view1  
  - circle–circle option table and ordering statement. citeturn30view2turn30view3  
  - example showing `next to=...` in actual usage. citeturn35view0  
- Source code:
  - `\tkzGetSecondPoint` definition. citeturn40view0  
  - `\tkzInterLC` and `\tkzInterCC` ordering logic and computations. citeturn33view0  
  - `\tkzFindAngle` oriented-angle semantics. citeturn36view0  
  - `tkz-euclide.sty` loading path for intersections modules and `lua/mini` routing. citeturn38view0  
- TeX Stack Exchange:
  - “Distinguish between `\tkzGetFirstPoint` and `\tkzGetSecondPoint`” (author suggests `common=...` and explains `near` for through-centre cases). citeturn31view0  
  - “The order of intersections … with `\tkzInterLC`” (community discussion of ordering sensitivity). citeturn32view0