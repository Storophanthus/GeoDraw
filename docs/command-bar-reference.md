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
- `Line(x1,y1,x2,y2)`
- `Line(A,B)`
- `Segment(A,B)`
- `Circle(x,y,r)`
- `Circle(O,A)`
- `Circle(O,r)`
- `Distance(A,B)` (returns number, creates nothing)

## Assignments
- Scalar:
  - `n_1 = 2.5`
  - `r = Distance(A,B)`
- Object:
  - `P = Point(1,2)`
  - `l = Line(A,B)`
  - `s = Segment(A,B)`
  - `c = Circle(O,r)`

## Fail-Closed Rules
- Invalid syntax/functions/symbols are rejected.
- Disallowed tokens are rejected.
- No scene mutation happens on parse/eval failure.
