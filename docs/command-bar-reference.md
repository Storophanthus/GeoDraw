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
  - `Perimeter(A,B,C)`
  - `Inradius(A,B,C)`
  - `Circumradius(A,B,C)`
  - `Perimeter(c_1)`
- Supported constants:
  - `pi`, `Pi`, `PI`, `e`, `tau`, `ans`
- Supported functions:
  - `Distance`
  - `Area`, `Perimeter`
  - `Inradius`, `Circumradius`
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
- Geometry scalar functions are case-sensitive (`Distance`, `Area`, `Perimeter`, `Inradius`, `Circumradius`).
- `Perimeter(x)` with 1 argument accepts a circle/polygon alias; `Perimeter(A,B,C)` returns triangle perimeter.
- `Area(x)` expects 1 circle/polygon argument.

## Constructors
- `Point(x,y)`
- `Midpoint(A,B)`
- `Midpoint(s)` where `s` is a named segment alias (from assignment)
- `Incenter(A,B,C)`
- `Incircle(A,B,C)`
- `Orthocenter(A,B,C)` (alias: `Ortho(A,B,C)`)
- `Centroid(A,B,C)`
- `Circumcenter(A,B,C)`
- `Translate(P,A,B)`
- `Rotate(P,O,expr[,CW|CCW])`
- `Dilate(P,O,k)`
- `Homothety(P,O,k)` (same point construction as `Dilate`)
- `Inversion(P,c)` or `Invert(P,c)` inverts point `P` in named circle `c`
- `Reflect(P,l|s|O)` where `l/s` are named line/segment aliases, `O` is a point
- `Reflect(P,A,B)`, `Reflect(P,Line(A,B))`, or `Reflect(P,Segment(A,B))` reflects across the line through `A` and `B`
- `Orthoproject(X,A,B)` projects point `X` onto the line through `A` and `B`
- `Line(x1,y1,x2,y2)`
- `Line(A,B)`
- `Perpendicular(P,l)` where `l` is a named line/segment alias
- `PerpBisector(A,B)` (alias: `PerpendicularBisector(A,B)`)
- `Parallel(P,l)` where `l` is a named line/segment alias
- `Tangent(P,c)` where `c` is a named circle alias
- `AngleBisector(A,B,C)`
- `Angle(A,B,C)` returns the angle measure in degrees
- `MarkedAngle(A,B,C)` creates an angle object
- `AngleFixed(V,A,expr[,CW|CCW])`
- `Sector(O,A,B)`
- `Segment(A,B)`
- `Polygon(A,B,C,...)`
- `RegularPolygon(A,B,n[,CW|CCW])`
- `Circle(x,y,r)`
- `Circle3P(A,B,C)` (alias: `CircleThreePoint(A,B,C)`)
- `Circle(O,A)`
- `Circle(O,r)`
- `Circle(O,96*sqrt(5))`
- `Ellipse(F1,F2,P)` the ellipse with foci `F1`, `F2` passing through `P`
- `Distance(...)` (returns number, creates nothing)
  - common forms: `Distance(A,B)`, `Distance(A,l)`, `Distance(l,A)`, `Distance(A,s)`, `Distance(s,A)`

## Named transformation maps

Transformation nouns define reusable point maps:

- `f = Translation(A,B)`
- `f = Rotation(O,expr[,CW|CCW])`
- `f = Homothety(O,k)` (also `Dilation(O,k)`)
- `f = Reflection(l|s|O)`, `Reflection(A,B)`, or `Reflection(Line(A,B))`
- `f = Inversion(c)`

Apply a map with either `Q = f(P)` or `Q = Apply(f,P)`.

- `h = Compose(f,g)` defines `h = f ∘ g`: `g` is applied first, then `f`.
- `fi = Inverse(f)` defines the inverse map.
- `Compose(f,g,k)` supports more than two maps, using the same mathematical order.
- Reflection and circle inversion are self-inverse. Translation reverses its vector, rotation reverses direction, and homothety replaces `k` by `1/k`.
- A homothety with factor `0` can be defined but cannot be inverted.
- Composed intermediate image points are kept as hidden live dependencies, so the final point continues to follow changes to source points, centers, circles, and scalar expressions.

## Assignments
- Scalar:
  - `n_1 = 2.5`
  - `r = Distance(A,B)`
- Object:
  - `P = Point(1,2)`
  - `M = Midpoint(A,B)`
  - `I = Incenter(A,B,C)`
  - `ic = Incircle(A,B,C)`
  - `H = Orthocenter(A,B,C)`
  - `G = Centroid(A,B,C)`
  - `O = Circumcenter(A,B,C)`
  - `T = Translate(A,B,C)`
  - `R = Rotate(A,O,30,CW)`
  - `D = Dilate(A,O,2)`
  - `D2 = Homothety(A,O,2)`
  - `J = Inversion(A,c)`
  - `Q = Reflect(A,l)`
  - `Q2 = Reflect(A,Segment(B,C))`
  - `H = Orthoproject(X,A,B)`
  - `l = Line(A,B)`
  - `p = Perpendicular(A,l)`
  - `pb = PerpBisector(A,B)`
  - `q = Parallel(B,l)`
  - `b = AngleBisector(A,B,C)`
  - `t = Angle(A,B,C)`
  - `ang = MarkedAngle(A,B,C)`
  - `af = AngleFixed(B,A,30,CW)`
  - `sec = Sector(O,A,B)`
  - `s = Segment(A,B)`
  - `poly = Polygon(A,B,C,D)`
  - `rp = RegularPolygon(A,B,6)`
  - `c3 = Circle3P(A,B,C)`
  - `cRad = Circle(O,96*sqrt(5))`
  - `c = Circle(O,r_1)` (`r_1` can come from "Store Radius")
  - `el = Ellipse(F1,F2,P)`

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
