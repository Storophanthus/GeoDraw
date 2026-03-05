# Command Bar Reference

## Expressions
- Examples:
  - `5*5`
  - `Pi`
  - `sin(pi/6)`
  - `Sin(Pi/6)`
  - `atan2(4,3)`
  - `asin(1)`
  - `sind(30)`
  - `atan2d(4,3)`
- Supported constants:
  - `pi`, `Pi`, `PI`, `e`, `tau`, `ans`
- Supported functions:
  - `sin`, `cos`, `tan`
  - `Sin`, `Cos`, `Tan`
  - `sind`, `cosd`, `tand`
  - `Sind`, `Cosd`, `Tand`
  - `asin`, `acos`, `atan`, `atan2`
  - `Asin`, `Acos`, `Atan`, `Atan2`
  - `asind`, `acosd`, `atand`, `atan2d`
  - `Asind`, `Acosd`, `Atand`, `Atan2d`
  - `sqrt`, `abs`, `min`, `max`, `pow`

Notes:
- Trigonometric functions use radians.
- Degree helpers are available via `*d` suffix (e.g. `sind`, `atan2d`).
- `atan2(y,x)` uses the standard `(y, x)` argument order.
- `atan2d(y,x)` uses the same `(y, x)` argument order and returns degrees.
- `ans` is the last numeric expression result.

## Constructors
- `Point(x,y)`
- `Midpoint(A,B)`
- `Midpoint(s)` where `s` is a named segment alias (from assignment)
- `Incenter(A,B,C)`
- `Orthocenter(A,B,C)` (alias: `Ortho(A,B,C)`)
- `Centroid(A,B,C)`
- `Translate(P,A,B)`
- `Rotate(P,O,expr[,CW|CCW])`
- `Dilate(P,O,k)`
- `Reflect(P,l|s|O)` where `l/s` are named line/segment aliases, `O` is a point
- `Line(x1,y1,x2,y2)`
- `Line(A,B)`
- `Perpendicular(P,l)` where `l` is a named line/segment alias
- `Parallel(P,l)` where `l` is a named line/segment alias
- `Tangent(P,c)` where `c` is a named circle alias
- `AngleBisector(A,B,C)`
- `Angle(A,B,C)`
- `AngleFixed(V,A,expr[,CW|CCW])`
- `Sector(O,A,B)`
- `Segment(A,B)`
- `Polygon(A,B,C,...)`
- `RegularPolygon(A,B,n[,CW|CCW])`
- `Circle(x,y,r)`
- `Circle3P(A,B,C)` (alias: `CircleThreePoint(A,B,C)`)
- `Circle(O,A)`
- `Circle(O,r)`
- `Distance(...)` (returns number, creates nothing)
  - common forms: `Distance(A,B)`, `Distance(A,l)`, `Distance(l,A)`, `Distance(A,s)`, `Distance(s,A)`

## Assignments
- Scalar:
  - `n_1 = 2.5`
  - `r = Distance(A,B)`
- Object:
  - `P = Point(1,2)`
  - `M = Midpoint(A,B)`
  - `I = Incenter(A,B,C)`
  - `H = Orthocenter(A,B,C)`
  - `G = Centroid(A,B,C)`
  - `T = Translate(A,B,C)`
  - `R = Rotate(A,O,30,CW)`
  - `D = Dilate(A,O,2)`
  - `Q = Reflect(A,l)`
  - `l = Line(A,B)`
  - `p = Perpendicular(A,l)`
  - `q = Parallel(B,l)`
  - `b = AngleBisector(A,B,C)`
  - `ang = Angle(A,B,C)`
  - `af = AngleFixed(B,A,30,CW)`
  - `sec = Sector(O,A,B)`
  - `s = Segment(A,B)`
  - `poly = Polygon(A,B,C,D)`
  - `rp = RegularPolygon(A,B,6)`
  - `c3 = Circle3P(A,B,C)`
  - `c = Circle(O,r_1)` (`r_1` can come from "Store Radius")

Redefine behavior (current):
- `name = <numeric expr>`:
  - if `name` is an existing constant number, it is updated in-place.
  - if `name` is new, a new constant number is created.
- `name = <point expr>` or `name = Point(...)`:
  - if `name` is an existing free point, its coordinates are updated in-place.
  - if `name` is new, a new point is created.
- Non-free points and non-constant numbers are fail-closed (error).
- Existing object aliases can be redefined only with compatible constructor types (fail-closed otherwise).

Notes:
- `Tangent(P,c)` can create one or two tangent lines, so assignment is intentionally rejected.
- Alias-based commands (`Midpoint(s)`, `Perpendicular`, `Parallel`, `Tangent`) require the referenced object to have a command alias from a prior assignment.

## Fail-Closed Rules
- Invalid syntax/functions/symbols are rejected.
- Disallowed tokens are rejected.
- No scene mutation happens on parse/eval failure.
