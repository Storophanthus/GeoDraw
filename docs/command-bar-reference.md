# Command Bar Reference

## Expressions
- Examples:
  - `5*5`
  - `Pi`
  - `sin(pi/6)`
  - `Sin(Pi/6)`
- Supported constants:
  - `pi`, `Pi`, `PI`, `e`, `tau`, `ans`
- Supported functions:
  - `sin`, `cos`, `tan`
  - `Sin`, `Cos`, `Tan`
  - `sqrt`, `abs`, `min`, `max`, `pow`

Notes:
- Trigonometric functions use radians.
- `ans` is the last numeric expression result.

## Constructors
- `Point(x,y)`
- `Midpoint(A,B)`
- `Midpoint(s)` where `s` is a named segment alias (from assignment)
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
- `Circle(x,y,r)`
- `Circle3P(A,B,C)` (alias: `CircleThreePoint(A,B,C)`)
- `Circle(O,A)`
- `Circle(O,r)`
- `Distance(A,B)` (returns number, creates nothing)

## Assignments
- Scalar:
  - `n_1 = 2.5`
  - `r = Distance(A,B)`
- Object:
  - `P = Point(1,2)`
  - `M = Midpoint(A,B)`
  - `l = Line(A,B)`
  - `p = Perpendicular(A,l)`
  - `q = Parallel(B,l)`
  - `b = AngleBisector(A,B,C)`
  - `ang = Angle(A,B,C)`
  - `af = AngleFixed(B,A,30,CW)`
  - `sec = Sector(O,A,B)`
  - `s = Segment(A,B)`
  - `c3 = Circle3P(A,B,C)`
  - `c = Circle(O,r)`

Redefine behavior (current):
- `name = <numeric expr>`:
  - if `name` is an existing constant number, it is updated in-place.
  - if `name` is new, a new constant number is created.
- `name = <point expr>` or `name = Point(...)`:
  - if `name` is an existing free point, its coordinates are updated in-place.
  - if `name` is new, a new point is created.
- Non-free points and non-constant numbers are fail-closed (error).

Notes:
- `Tangent(P,c)` can create one or two tangent lines, so assignment is intentionally rejected.
- Alias-based commands (`Midpoint(s)`, `Perpendicular`, `Parallel`, `Tangent`) require the referenced object to have a command alias from a prior assignment.

## Fail-Closed Rules
- Invalid syntax/functions/symbols are rejected.
- Disallowed tokens are rejected.
- No scene mutation happens on parse/eval failure.
