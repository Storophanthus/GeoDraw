import { parseCommandInput, type ParseContext } from "../../CommandParser";

function mustExpr(input: string, ctx: ParseContext, expected: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "expr") throw new Error(`Expected expr for '${input}', got ${JSON.stringify(out)}`);
  if (out.value !== expected) throw new Error(`Expected '${expected}' for '${input}', got '${out.value}'`);
}

function mustCmd(input: string, ctx: ParseContext, type: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "cmd") throw new Error(`Expected cmd for '${input}', got ${JSON.stringify(out)}`);
  if (out.cmd.type !== type) throw new Error(`Expected cmd type '${type}', got '${out.cmd.type}'`);
  return out.cmd;
}

function mustAssignScalar(input: string, ctx: ParseContext, name: string, value: number) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "assignScalar") throw new Error(`Expected assignScalar for '${input}', got ${JSON.stringify(out)}`);
  if (out.name !== name) throw new Error(`Expected assignScalar name '${name}', got '${out.name}'`);
  if (Math.abs(out.value - value) > 1e-9) throw new Error(`Expected assignScalar value '${value}', got '${out.value}'`);
}

function mustAssignObject(input: string, ctx: ParseContext, name: string, type: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "assignObject") throw new Error(`Expected assignObject for '${input}', got ${JSON.stringify(out)}`);
  if (out.name !== name) throw new Error(`Expected assignObject name '${name}', got '${out.name}'`);
  if (out.cmd.type !== type) throw new Error(`Expected assignObject cmd type '${type}', got '${out.cmd.type}'`);
  return out.cmd;
}

function mustError(input: string, ctx: ParseContext, contains?: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "error") throw new Error(`Expected error for '${input}', got ${JSON.stringify(out)}`);
  if (contains && !out.message.includes(contains)) {
    throw new Error(`Expected error containing '${contains}', got '${out.message}'`);
  }
}

const baseCtx: ParseContext = {
  ans: 0,
  symbolsByLabel: new Map([
    ["A", [{ kind: "point", id: "pA", label: "A" }]],
    ["B", [{ kind: "point", id: "pB", label: "B" }]],
    ["O", [{ kind: "point", id: "pO", label: "O" }]],
  ]),
  pointWorldById: new Map([
    ["pA", { x: 0, y: 0 }],
    ["pB", { x: 3, y: 4 }],
    ["pO", { x: 1, y: 1 }],
  ]),
  scalarsByName: new Map(),
  objectNames: new Set(),
};

mustExpr("5*5", baseCtx, "25");
mustExpr("1+2*3", baseCtx, "7");

mustCmd("Point(1,2)", baseCtx, "CreatePointXY");
mustCmd("Line(0,0,3,4)", baseCtx, "CreateLineXY");
mustCmd("Circle(0,0,5)", baseCtx, "CreateCircleXYR");
mustError("Circle(0,0,-1)", baseCtx, "Circle radius must be > 0");

const lineAB = mustCmd("Line(A,B)", baseCtx, "CreateLineByPoints");
if (lineAB.type !== "CreateLineByPoints" || lineAB.aId !== "pA" || lineAB.bId !== "pB") {
  throw new Error("Line(A,B) IDs mismatch");
}

const segAB = mustCmd("Segment(A,B)", baseCtx, "CreateSegmentByPoints");
if (segAB.type !== "CreateSegmentByPoints" || segAB.aId !== "pA" || segAB.bId !== "pB") {
  throw new Error("Segment(A,B) IDs mismatch");
}

const circleOA = mustCmd("Circle(O,A)", baseCtx, "CreateCircleCenterThrough");
if (circleOA.type !== "CreateCircleCenterThrough" || circleOA.centerId !== "pO" || circleOA.throughId !== "pA") {
  throw new Error("Circle(O,A) mismatch");
}

const circleOR = mustCmd("Circle(O,5)", baseCtx, "CreateCircleCenterRadius");
if (circleOR.type !== "CreateCircleCenterRadius" || circleOR.centerId !== "pO" || circleOR.r !== 5) {
  throw new Error("Circle(O,5) mismatch");
}

mustExpr("Distance(A,B)", baseCtx, "5");

mustAssignScalar("n_1 = 2.023242", baseCtx, "n_1", 2.023242);
mustAssignScalar("r = 5*5", baseCtx, "r", 25);
mustAssignScalar("r = Distance(A,B)", baseCtx, "r", 5);

const assignPoint = mustAssignObject("P = Point(1,2)", baseCtx, "P", "CreatePointXY");
if (assignPoint.type !== "CreatePointXY" || assignPoint.x !== 1 || assignPoint.y !== 2) {
  throw new Error("P = Point(1,2) mismatch");
}

const assignLine = mustAssignObject("l = Line(A,B)", baseCtx, "l", "CreateLineByPoints");
if (assignLine.type !== "CreateLineByPoints" || assignLine.aId !== "pA" || assignLine.bId !== "pB") {
  throw new Error("l = Line(A,B) mismatch");
}

const withScalarR: ParseContext = {
  ...baseCtx,
  scalarsByName: new Map([["r", 5]]),
};
const assignCircleThrough = mustAssignObject("c_1 = Circle(O,A)", withScalarR, "c_1", "CreateCircleCenterThrough");
if (assignCircleThrough.type !== "CreateCircleCenterThrough") throw new Error("c_1=Circle(O,A) type mismatch");
const assignCircleRadius = mustAssignObject("c_2 = Circle(O,r)", withScalarR, "c_2", "CreateCircleCenterRadius");
if (assignCircleRadius.type !== "CreateCircleCenterRadius" || assignCircleRadius.r !== 5) {
  throw new Error("c_2=Circle(O,r) mismatch");
}

mustError("Line(A,Z)", baseCtx, "Unknown point: Z");

const ambiguousCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([
    [
      "A",
      [
        { kind: "point", id: "pA", label: "A" },
        { kind: "point", id: "pA2", label: "A" },
      ],
    ],
    ["B", [{ kind: "point", id: "pB", label: "B" }]],
  ]),
};
mustError("Line(A,B)", ambiguousCtx, "Ambiguous identifier: A");

const nonPointCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([
    ["X", [{ kind: "other", id: "n1", label: "X", type: "number" }]],
    ["A", [{ kind: "point", id: "pA", label: "A" }]],
    ["B", [{ kind: "point", id: "pB", label: "B" }]],
  ]),
};
mustError("Line(X,A)", nonPointCtx, "Not a point: X");
mustError("import('x')", baseCtx, "disallowed token");

const overwriteScalarCtx: ParseContext = {
  ...baseCtx,
  scalarsByName: new Map([["n_1", 10]]),
};
mustError("n_1 = 3", overwriteScalarCtx, "Name already used: n_1");

const overwritePointCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([["B", [{ kind: "point", id: "pB", label: "B" }]]]),
};
mustError("B = Point(1,2)", overwritePointCtx, "Name already used: B");

const unknownScalarCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([["O", [{ kind: "point", id: "pO", label: "O" }]]]),
};
mustError("Circle(O,r)", unknownScalarCtx, "Unknown scalar: r");

const usedAliasCtx: ParseContext = {
  ...baseCtx,
  objectNames: new Set(["l"]),
};
mustError("l = Line(A,B)", usedAliasCtx, "Name already used: l");

console.log("command-parser tests: OK");
