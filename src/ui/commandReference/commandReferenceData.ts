export type CommandCategory =
  | "Points"
  | "Lines"
  | "Circles & Ellipses"
  | "Polygons"
  | "Angles & Sectors"
  | "Transformations"
  | "Measure";

export type CommandSpec = {
  name: string;
  signature: string;
  description: string;
  example: string;
  category: CommandCategory;
  variants?: string[];
  note?: string;
};

export type FunctionCategory = "Measure" | "Math" | "Constants";

export type FunctionSpec = {
  name: string;
  signature: string;
  description: string;
  example: string;
  category: FunctionCategory;
};

export const ASSIGNMENT_INTRO: readonly string[] = [
  "Name a result to reuse it later — e.g. M = Midpoint(A,B) creates point M.",
  "Assign a number to store it — e.g. r = Distance(A,B) saves the distance as r.",
];

export const COMMAND_SPECS: readonly CommandSpec[] = [
  {
    name: "Point",
    signature: "Point(x,y)",
    description: "A free point at the given coordinates.",
    example: "Point(1,2)",
    category: "Points",
  },
  {
    name: "Midpoint",
    signature: "Midpoint(A,B)",
    description: "The point exactly halfway between A and B.",
    example: "Midpoint(A,B)",
    category: "Points",
    variants: ["Midpoint(s)"],
    note: "Midpoint(s) finds the halfway point of an existing named segment.",
  },
  {
    name: "Incenter",
    signature: "Incenter(A,B,C)",
    description: "Center of the circle inscribed in triangle ABC, where the angle bisectors meet.",
    example: "Incenter(A,B,C)",
    category: "Points",
  },
  {
    name: "Orthocenter",
    signature: "Orthocenter(A,B,C)",
    description: "Point where the three altitudes of triangle ABC meet.",
    example: "Orthocenter(A,B,C)",
    category: "Points",
    variants: ["Ortho(A,B,C)"],
  },
  {
    name: "Centroid",
    signature: "Centroid(A,B,C)",
    description: "Center of mass of triangle ABC, where the medians meet.",
    example: "Centroid(A,B,C)",
    category: "Points",
  },
  {
    name: "Circumcenter",
    signature: "Circumcenter(A,B,C)",
    description: "Center of the circle passing through all three vertices of triangle ABC.",
    example: "Circumcenter(A,B,C)",
    category: "Points",
  },
  {
    name: "Incircle",
    signature: "Incircle(A,B,C)",
    description: "The circle inscribed inside triangle ABC, tangent to all three sides.",
    example: "Incircle(A,B,C)",
    category: "Circles & Ellipses",
  },
  {
    name: "Circle",
    signature: "Circle(x,y,r)",
    description: "A circle at the given center with the given radius.",
    example: "Circle(0,0,5)",
    category: "Circles & Ellipses",
    variants: ["Circle(O,A)", "Circle(O,r_1)"],
    note: "Circle(O,A) passes through point A. Circle(O,r_1) uses a named number as the radius.",
  },
  {
    name: "Circle3P",
    signature: "Circle3P(A,B,C)",
    description: "The unique circle passing through three points.",
    example: "Circle3P(A,B,C)",
    category: "Circles & Ellipses",
    variants: ["CircleThreePoint(A,B,C)"],
  },
  {
    name: "Ellipse",
    signature: "Ellipse(F1,F2,P)",
    description: "The ellipse with foci F1 and F2 that passes through point P.",
    example: "Ellipse(F1,F2,P)",
    category: "Circles & Ellipses",
  },
  {
    name: "Line",
    signature: "Line(A,B)",
    description: "The infinite line through points A and B.",
    example: "Line(A,B)",
    category: "Lines",
    variants: ["Line(0,0,4,3)"],
  },
  {
    name: "Segment",
    signature: "Segment(A,B)",
    description: "The line segment connecting A and B.",
    example: "Segment(A,B)",
    category: "Lines",
  },
  {
    name: "Perpendicular",
    signature: "Perpendicular(P,l)",
    description: "A line through P, perpendicular to an existing line or segment l.",
    example: "Perpendicular(P,l)",
    category: "Lines",
  },
  {
    name: "PerpBisector",
    signature: "PerpBisector(A,B)",
    description: "The line perpendicular to segment AB, passing through its midpoint.",
    example: "PerpBisector(A,B)",
    category: "Lines",
    variants: ["PerpendicularBisector(A,B)"],
  },
  {
    name: "Parallel",
    signature: "Parallel(P,l)",
    description: "A line through P, parallel to an existing line or segment l.",
    example: "Parallel(P,l)",
    category: "Lines",
  },
  {
    name: "Tangent",
    signature: "Tangent(P,c)",
    description: "The tangent line(s) from point P to circle c.",
    example: "Tangent(P,c)",
    category: "Lines",
    note: "May create one or two lines depending on where P sits. Cannot be assigned to a name.",
  },
  {
    name: "AngleBisector",
    signature: "AngleBisector(A,B,C)",
    description: "The line that bisects the angle at vertex B.",
    example: "AngleBisector(A,B,C)",
    category: "Angles & Sectors",
  },
  {
    name: "Angle",
    signature: "Angle(A,B,C)",
    description: "An angle marker at vertex B, between rays BA and BC.",
    example: "Angle(A,B,C)",
    category: "Angles & Sectors",
    variants: ["MarkedAngle(A,B,C)"],
    note: "Assign it to a name (e.g. t=Angle(A,B,C)) to get the numeric measure in degrees instead of a marker.",
  },
  {
    name: "AngleFixed",
    signature: "AngleFixed(V,A,expr[,CW|CCW])",
    description: "An angle of a specific size at vertex V, measured from base point A. Counter-clockwise by default.",
    example: "AngleFixed(V,A,30)",
    category: "Angles & Sectors",
  },
  {
    name: "Sector",
    signature: "Sector(O,A,B)",
    description: "A circular sector (pie-slice) centered at O, from A to B.",
    example: "Sector(O,A,B)",
    category: "Angles & Sectors",
  },
  {
    name: "Polygon",
    signature: "Polygon(A,B,C,...)",
    description: "A closed polygon through the given points, in order.",
    example: "Polygon(A,B,C,D)",
    category: "Polygons",
  },
  {
    name: "RegularPolygon",
    signature: "RegularPolygon(A,B,n[,CW|CCW])",
    description: "A regular n-sided polygon built outward from edge A–B.",
    example: "RegularPolygon(A,B,6)",
    category: "Polygons",
  },
  {
    name: "Translate",
    signature: "Translate(P,A,B)",
    description: "Moves P by the same vector that takes A to B.",
    example: "Translate(P,A,B)",
    category: "Transformations",
  },
  {
    name: "Rotate",
    signature: "Rotate(P,O,expr[,CW|CCW])",
    description: "Rotates P around center O by the given angle in degrees. Counter-clockwise by default.",
    example: "Rotate(P,O,30)",
    category: "Transformations",
  },
  {
    name: "Dilate",
    signature: "Dilate(P,O,k)",
    description: "Scales P from center O by factor k (a homothety).",
    example: "Dilate(P,O,2)",
    category: "Transformations",
    variants: ["Homothety(P,O,2)"],
  },
  {
    name: "Reflect",
    signature: "Reflect(P,A,B)",
    description: "Reflects P across the line through A and B.",
    example: "Reflect(P,A,B)",
    category: "Transformations",
    variants: ["Reflect(P,l)", "Reflect(P,O)"],
    note: "l is a named line or segment; O is a point to reflect through.",
  },
  {
    name: "Orthoproject",
    signature: "Orthoproject(X,A,B)",
    description: "The foot of the perpendicular from X onto the line through A and B.",
    example: "Orthoproject(X,A,B)",
    category: "Transformations",
    variants: ["OrthoProject(X,A,B)", "OrthogonalProjection(X,A,B)"],
  },
  {
    name: "Distance",
    signature: "Distance(A,B)",
    description: "The distance between two points, or between a point and a line/segment. Shows a number, creates nothing.",
    example: "Distance(A,B)",
    category: "Measure",
    variants: ["Distance(A,l)", "Distance(l,A)", "Distance(A,s)", "Distance(s,A)"],
  },
];

export const FUNCTION_SPECS: readonly FunctionSpec[] = [
  {
    name: "Distance",
    signature: "Distance(A,B)",
    description: "Distance between two points, or a point and a line/segment — usable inside any expression, e.g. Distance(A,B)+Distance(B,C).",
    example: "Distance(A,B)",
    category: "Measure",
  },
  {
    name: "Area",
    signature: "Area(x)",
    description: "Area of a circle or polygon (pass its name).",
    example: "Area(poly)",
    category: "Measure",
  },
  {
    name: "Perimeter",
    signature: "Perimeter(A,B,C)",
    description: "Perimeter of triangle ABC. With one argument, e.g. Perimeter(poly), gives the perimeter of a circle or polygon instead.",
    example: "Perimeter(A,B,C)",
    category: "Measure",
  },
  {
    name: "Inradius",
    signature: "Inradius(A,B,C)",
    description: "Radius of the inscribed circle of triangle ABC.",
    example: "Inradius(A,B,C)",
    category: "Measure",
  },
  {
    name: "Circumradius",
    signature: "Circumradius(A,B,C)",
    description: "Radius of the circumscribed circle of triangle ABC.",
    example: "Circumradius(A,B,C)",
    category: "Measure",
  },
  {
    name: "Angle",
    signature: "Angle(A,B,C)",
    description: "The angle at vertex B, in degrees — usable inside any expression, e.g. 2*Angle(A,B,C).",
    example: "Angle(A,B,C)",
    category: "Measure",
  },
  { name: "sin", signature: "sin(x)", description: "Sine of x, in radians.", example: "sin(pi/6)", category: "Math" },
  { name: "cos", signature: "cos(x)", description: "Cosine of x, in radians.", example: "cos(pi/3)", category: "Math" },
  { name: "tan", signature: "tan(x)", description: "Tangent of x, in radians.", example: "tan(pi/4)", category: "Math" },
  { name: "sind", signature: "sind(x)", description: "Sine of x, in degrees.", example: "sind(30)", category: "Math" },
  { name: "cosd", signature: "cosd(x)", description: "Cosine of x, in degrees.", example: "cosd(60)", category: "Math" },
  { name: "tand", signature: "tand(x)", description: "Tangent of x, in degrees.", example: "tand(45)", category: "Math" },
  { name: "asin", signature: "asin(x)", description: "Arcsine of x, returned in radians.", example: "asin(1)", category: "Math" },
  { name: "acos", signature: "acos(x)", description: "Arccosine of x, returned in radians.", example: "acos(0)", category: "Math" },
  { name: "atan", signature: "atan(x)", description: "Arctangent of x, returned in radians.", example: "atan(1)", category: "Math" },
  {
    name: "atan2",
    signature: "atan2(y,x)",
    description: "Two-argument arctangent, returned in radians.",
    example: "atan2(4,3)",
    category: "Math",
  },
  { name: "asind", signature: "asind(x)", description: "Arcsine of x, returned in degrees.", example: "asind(1)", category: "Math" },
  { name: "acosd", signature: "acosd(x)", description: "Arccosine of x, returned in degrees.", example: "acosd(0)", category: "Math" },
  { name: "atand", signature: "atand(x)", description: "Arctangent of x, returned in degrees.", example: "atand(1)", category: "Math" },
  {
    name: "atan2d",
    signature: "atan2d(y,x)",
    description: "Two-argument arctangent, returned in degrees.",
    example: "atan2d(4,3)",
    category: "Math",
  },
  { name: "sqrt", signature: "sqrt(x)", description: "Square root of x.", example: "sqrt(2)", category: "Math" },
  { name: "abs", signature: "abs(x)", description: "Absolute value of x.", example: "abs(-5)", category: "Math" },
  { name: "min", signature: "min(a,b,...)", description: "Smallest of the given values.", example: "min(2,7,3)", category: "Math" },
  { name: "max", signature: "max(a,b,...)", description: "Largest of the given values.", example: "max(2,7,3)", category: "Math" },
  { name: "pow", signature: "pow(x,y)", description: "x raised to the power y.", example: "pow(2,10)", category: "Math" },
  { name: "pi", signature: "pi", description: "The constant π ≈ 3.14159.", example: "pi", category: "Constants" },
  { name: "e", signature: "e", description: "Euler's number ≈ 2.71828.", example: "e", category: "Constants" },
  { name: "tau", signature: "tau", description: "The constant τ = 2π ≈ 6.28319.", example: "tau", category: "Constants" },
  { name: "ans", signature: "ans", description: "The result of your last calculation.", example: "ans", category: "Constants" },
];
