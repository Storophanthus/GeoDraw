import { all, create, type MathNode } from "mathjs";

const math = create(all, { number: "number", matrix: "Array", predictable: true });
const MAX_INPUT_LENGTH = 300;
const DISALLOWED_TOKEN_RE = /\b(import|createUnit|unit|range|ones|zeros|matrix)\b/i;
const ALLOWED_FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "Sin",
  "Cos",
  "Tan",
  "sqrt",
  "abs",
  "min",
  "max",
  "pow",
]);
const BASE_ALLOWED_SYMBOLS = new Set(["ans", "pi", "Pi", "PI", "e", "tau"]);
const IDENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export type Symbol =
  | { kind: "point"; id: string; label: string }
  | { kind: "other"; id: string; label: string; type: string };

export type ParseContext = {
  symbolsByLabel: Map<string, Symbol[]>;
  pointWorldById?: Map<string, { x: number; y: number }>;
  scalarsByName: Map<string, number>;
  objectAliases: Map<string, { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }>;
  objectNames: Set<string>;
  ans?: number;
};

export type Command =
  | { type: "CreatePointXY"; x: number; y: number }
  | { type: "CreateMidpointByPoints"; aId: string; bId: string }
  | { type: "CreateMidpointBySegment"; segId: string }
  | { type: "CreateLineXY"; x1: number; y1: number; x2: number; y2: number }
  | { type: "CreateLineByPoints"; aId: string; bId: string }
  | { type: "CreatePerpendicularLine"; throughId: string; base: { type: "line" | "segment"; id: string } }
  | { type: "CreateParallelLine"; throughId: string; base: { type: "line" | "segment"; id: string } }
  | { type: "CreateTangentLines"; throughId: string; circleId: string }
  | { type: "CreateAngleBisector"; aId: string; bId: string; cId: string }
  | { type: "CreateAngle"; aId: string; bId: string; cId: string }
  | { type: "CreateAngleFixed"; vertexId: string; basePointId: string; angleExpr: string; direction: "CCW" | "CW" }
  | { type: "CreateSector"; centerId: string; startId: string; endId: string }
  | { type: "CreateSegmentByPoints"; aId: string; bId: string }
  | { type: "CreatePolygonByPoints"; pointIds: string[] }
  | { type: "CreateCircleThreePoint"; aId: string; bId: string; cId: string }
  | { type: "CreateCircleXYR"; x: number; y: number; r: number }
  | { type: "CreateCircleCenterRadius"; centerId: string; r: number; rExpr?: string }
  | { type: "CreateCircleCenterThrough"; centerId: string; throughId: string };

export type ParseResult =
  | { kind: "expr"; value: string; numeric?: number }
  | { kind: "cmd"; cmd: Command }
  | { kind: "assignScalar"; name: string; value: number }
  | { kind: "assignObject"; name: string; cmd: Command }
  | { kind: "error"; message: string };

type ExprValue =
  | { kind: "scalar"; value: number }
  | { kind: "point"; x: number; y: number };

type EvalResult = { ok: true; value: number } | { ok: false; error: string };

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) < 1e-12) return "0";
  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}

function err(message: string): ParseResult {
  return { kind: "error", message };
}

function ensureSafeNode(node: MathNode, allowedSymbols: Set<string>): string | null {
  const queue: MathNode[] = [node];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    const anyNode = current as unknown as {
      type?: string;
      name?: string;
      fn?: { name?: string };
      op?: string;
      args?: MathNode[];
      content?: MathNode;
    };

    switch (anyNode.type) {
      case "ConstantNode":
      case "ParenthesisNode":
        break;
      case "SymbolNode":
        if (!anyNode.name || !allowedSymbols.has(anyNode.name)) {
          return `Unsupported symbol: ${anyNode.name ?? "unknown"}`;
        }
        break;
      case "FunctionNode": {
        const fnName = anyNode.fn?.name;
        if (!fnName || !ALLOWED_FUNCTIONS.has(fnName)) {
          return `Unsupported function: ${fnName ?? "unknown"}`;
        }
        break;
      }
      case "OperatorNode": {
        const op = anyNode.op;
        if (!["+", "-", "*", "/", "^"].includes(op ?? "")) {
          return `Unsupported operator: ${op ?? "unknown"}`;
        }
        break;
      }
      default:
        return `Unsupported expression node: ${anyNode.type ?? "unknown"}`;
    }

    const children = anyNode.args ?? [];
    for (let i = 0; i < children.length; i += 1) {
      if (children[i]) queue.push(children[i]);
    }
    if (anyNode.content) queue.push(anyNode.content);
  }
  return null;
}

function evaluateExpression(expr: string, ctx: ParseContext): EvalResult {
  if (expr.length > MAX_INPUT_LENGTH) return { ok: false, error: "Input is too long" };
  if (DISALLOWED_TOKEN_RE.test(expr)) return { ok: false, error: "Expression uses disallowed token" };

  let node: MathNode;
  try {
    node = math.parse(expr);
  } catch {
    return { ok: false, error: "Invalid expression syntax" };
  }

  const allowedSymbols = new Set<string>(BASE_ALLOWED_SYMBOLS);
  for (const key of ctx.scalarsByName.keys()) allowedSymbols.add(key);

  const safe = ensureSafeNode(node, allowedSymbols);
  if (safe) return { ok: false, error: safe };

  const scope: Record<string, number | ((...args: number[]) => number)> = {
    ans: ctx.ans ?? 0,
    pi: Math.PI,
    Pi: Math.PI,
    PI: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    Sin: Math.sin,
    Cos: Math.cos,
    Tan: Math.tan,
    sqrt: Math.sqrt,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  };

  for (const [name, value] of ctx.scalarsByName.entries()) {
    scope[name] = value;
  }

  let value: unknown;
  try {
    value = node.evaluate(scope);
  } catch {
    return { ok: false, error: "Expression evaluation failed" };
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: "Expression must evaluate to a finite number" };
  }
  return { ok: true, value };
}

function toScalarExprValue(value: number): ExprValue {
  return { kind: "scalar", value };
}

function toPointExprValue(x: number, y: number): ExprValue {
  return { kind: "point", x, y };
}

function exprPointByLabel(label: string, ctx: ParseContext): { ok: true; value: ExprValue } | { ok: false; error: string } {
  const resolved = resolvePointIdentifier(label, ctx);
  if (!resolved.ok) return { ok: false, error: resolved.message };
  const map = ctx.pointWorldById;
  if (!map) return { ok: false, error: `Point coordinate context is missing for: ${label}` };
  const w = map.get(resolved.id);
  if (!w) return { ok: false, error: `Point is missing: ${label}` };
  return { ok: true, value: toPointExprValue(w.x, w.y) };
}

function evalPointExpressionNode(node: MathNode, ctx: ParseContext): { ok: true; value: ExprValue } | { ok: false; error: string } {
  const anyNode = node as unknown as {
    type?: string;
    value?: number;
    name?: string;
    op?: string;
    args?: MathNode[];
    content?: MathNode;
  };

  if (anyNode.type === "ParenthesisNode" && anyNode.content) return evalPointExpressionNode(anyNode.content, ctx);

  if (anyNode.type === "ConstantNode") {
    const numeric = evaluateExpression(node.toString(), ctx);
    if (!numeric.ok) return { ok: false, error: numeric.error };
    return { ok: true, value: toScalarExprValue(numeric.value) };
  }

  if (anyNode.type === "SymbolNode") {
    if (!anyNode.name) return { ok: false, error: "Unsupported symbol: unknown" };
    if (ctx.scalarsByName.has(anyNode.name)) return { ok: true, value: toScalarExprValue(ctx.scalarsByName.get(anyNode.name) as number) };
    if (anyNode.name === "ans") return { ok: true, value: toScalarExprValue(ctx.ans ?? 0) };
    if (anyNode.name === "pi" || anyNode.name === "Pi" || anyNode.name === "PI") {
      return { ok: true, value: toScalarExprValue(Math.PI) };
    }
    if (anyNode.name === "e") return { ok: true, value: toScalarExprValue(Math.E) };
    if (anyNode.name === "tau") return { ok: true, value: toScalarExprValue(Math.PI * 2) };
    return exprPointByLabel(anyNode.name, ctx);
  }

  if (anyNode.type === "OperatorNode") {
    const op = anyNode.op ?? "";
    const args = anyNode.args ?? [];
    if (op === "-" && args.length === 1) {
      const v = evalPointExpressionNode(args[0], ctx);
      if (!v.ok) return v;
      if (v.value.kind === "scalar") return { ok: true, value: toScalarExprValue(-v.value.value) };
      return { ok: true, value: toPointExprValue(-v.value.x, -v.value.y) };
    }
    if (args.length !== 2) return { ok: false, error: `Unsupported operator arity: ${op}` };
    const left = evalPointExpressionNode(args[0], ctx);
    if (!left.ok) return left;
    const right = evalPointExpressionNode(args[1], ctx);
    if (!right.ok) return right;

    if (op === "+" || op === "-") {
      if (left.value.kind === "point" && right.value.kind === "point") {
        return {
          ok: true,
          value: toPointExprValue(
            op === "+" ? left.value.x + right.value.x : left.value.x - right.value.x,
            op === "+" ? left.value.y + right.value.y : left.value.y - right.value.y
          ),
        };
      }
      if (left.value.kind === "scalar" && right.value.kind === "scalar") {
        return { ok: true, value: toScalarExprValue(op === "+" ? left.value.value + right.value.value : left.value.value - right.value.value) };
      }
      return { ok: false, error: `Unsupported ${op} between point and scalar` };
    }

    if (op === "*") {
      if (left.value.kind === "scalar" && right.value.kind === "scalar") {
        return { ok: true, value: toScalarExprValue(left.value.value * right.value.value) };
      }
      if (left.value.kind === "scalar" && right.value.kind === "point") {
        return { ok: true, value: toPointExprValue(left.value.value * right.value.x, left.value.value * right.value.y) };
      }
      if (left.value.kind === "point" && right.value.kind === "scalar") {
        return { ok: true, value: toPointExprValue(left.value.x * right.value.value, left.value.y * right.value.value) };
      }
      return { ok: false, error: "Unsupported * between two points" };
    }

    if (op === "/") {
      if (right.value.kind !== "scalar" || Math.abs(right.value.value) <= 1e-12) return { ok: false, error: "Division requires non-zero scalar divisor" };
      if (left.value.kind === "scalar") return { ok: true, value: toScalarExprValue(left.value.value / right.value.value) };
      return { ok: true, value: toPointExprValue(left.value.x / right.value.value, left.value.y / right.value.value) };
    }

    if (op === "^") {
      if (left.value.kind !== "scalar" || right.value.kind !== "scalar") return { ok: false, error: "Exponentiation only supports scalars" };
      const powered = left.value.value ** right.value.value;
      if (!Number.isFinite(powered)) return { ok: false, error: "Exponentiation result is not finite" };
      return { ok: true, value: toScalarExprValue(powered) };
    }

    return { ok: false, error: `Unsupported operator: ${op}` };
  }

  return { ok: false, error: `Unsupported expression node: ${anyNode.type ?? "unknown"}` };
}

function evaluatePointOrScalarExpression(expr: string, ctx: ParseContext): { ok: true; value: ExprValue } | { ok: false; error: string } {
  if (expr.length > MAX_INPUT_LENGTH) return { ok: false, error: "Input is too long" };
  if (DISALLOWED_TOKEN_RE.test(expr)) return { ok: false, error: "Expression uses disallowed token" };
  let node: MathNode;
  try {
    node = math.parse(expr);
  } catch {
    return { ok: false, error: "Invalid expression syntax" };
  }
  return evalPointExpressionNode(node, ctx);
}

function splitArgs(raw: string): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth < 0) return null;
    } else if (ch === "," && depth === 0) {
      args.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) return null;
  args.push(raw.slice(start).trim());
  if (args.some((arg) => arg.length === 0)) return null;
  return args;
}

function splitAssignment(raw: string): { left: string; right: string } | null {
  let depth = 0;
  let eqIndex = -1;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth < 0) return null;
    } else if (ch === "=" && depth === 0) {
      if (eqIndex !== -1) return null;
      eqIndex = i;
    }
  }
  if (depth !== 0 || eqIndex === -1) return null;
  return {
    left: raw.slice(0, eqIndex).trim(),
    right: raw.slice(eqIndex + 1).trim(),
  };
}

function asIdentifier(value: string): string | null {
  return IDENT_RE.test(value) ? value : null;
}

function resolvePointIdentifier(label: string, ctx: ParseContext): { ok: true; id: string } | { ok: false; message: string } {
  const symbols = ctx.symbolsByLabel.get(label);
  if (symbols && symbols.length > 0) {
    if (symbols.length > 1) return { ok: false, message: `Ambiguous identifier: ${label}` };
    if (symbols[0].kind !== "point") return { ok: false, message: `Not a point: ${label}` };
    return { ok: true, id: symbols[0].id };
  }
  const alias = ctx.objectAliases.get(label);
  if (alias?.type === "point") return { ok: true, id: alias.id };
  if (alias) return { ok: false, message: `Not a point: ${label}` };
  return { ok: false, message: `Unknown point: ${label}` };
}

function resolveObjectAlias(
  label: string,
  ctx: ParseContext,
  expected: "line" | "segment" | "circle"
): { ok: true; id: string } | { ok: false; message: string } {
  const alias = ctx.objectAliases.get(label);
  if (!alias) return { ok: false, message: `Unknown ${expected}: ${label}` };
  if (alias.type !== expected) return { ok: false, message: `Not a ${expected}: ${label}` };
  return { ok: true, id: alias.id };
}

function resolveScalarIdentifier(label: string, ctx: ParseContext): { ok: true; value: number } | { ok: false; message: string } {
  const value = ctx.scalarsByName.get(label);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, message: `Unknown scalar: ${label}` };
  }
  return { ok: true, value };
}

function parseDistanceNumeric(args: string[], ctx: ParseContext): EvalResult {
  if (args.length !== 2) return { ok: false, error: "Distance(A, B) expects 2 point labels" };
  const aLabel = asIdentifier(args[0]);
  const bLabel = asIdentifier(args[1]);
  if (!aLabel || !bLabel) return { ok: false, error: "Distance(A, B) expects point labels" };
  const a = resolvePointIdentifier(aLabel, ctx);
  if (!a.ok) return { ok: false, error: a.message };
  const b = resolvePointIdentifier(bLabel, ctx);
  if (!b.ok) return { ok: false, error: b.message };

  const pMap = ctx.pointWorldById;
  if (!pMap) return { ok: false, error: "Distance requires point coordinates in context" };
  const pa = pMap.get(a.id);
  const pb = pMap.get(b.id);
  if (!pa || !pb) return { ok: false, error: "Distance point is missing" };

  const dx = pa.x - pb.x;
  const dy = pa.y - pb.y;
  return { ok: true, value: Math.sqrt(dx * dx + dy * dy) };
}

function parseDistanceResult(args: string[], ctx: ParseContext): ParseResult {
  const d = parseDistanceNumeric(args, ctx);
  if (!d.ok) return err(d.error);
  return { kind: "expr", value: formatNumber(d.value), numeric: d.value };
}

function parseCommand(name: string, args: string[], ctx: ParseContext): ParseResult {
  const evalArg = (raw: string): number | null => {
    const out = evaluateExpression(raw, ctx);
    return out.ok ? out.value : null;
  };

  if (name === "Point") {
    if (args.length !== 2) return err("Point(x, y) expects 2 arguments");
    const x = evalArg(args[0]);
    const y = evalArg(args[1]);
    if (x === null || y === null) return err("Point arguments must be finite numbers");
    return { kind: "cmd", cmd: { type: "CreatePointXY", x, y } };
  }

  if (name === "Midpoint") {
    if (args.length === 2) {
      const aLabel = asIdentifier(args[0]);
      const bLabel = asIdentifier(args[1]);
      if (!aLabel || !bLabel) return err("Midpoint(A, B) expects point labels");
      const a = resolvePointIdentifier(aLabel, ctx);
      if (!a.ok) return err(a.message);
      const b = resolvePointIdentifier(bLabel, ctx);
      if (!b.ok) return err(b.message);
      return { kind: "cmd", cmd: { type: "CreateMidpointByPoints", aId: a.id, bId: b.id } };
    }
    if (args.length === 1) {
      const segLabel = asIdentifier(args[0]);
      if (!segLabel) return err("Midpoint(s) expects a segment alias");
      const seg = resolveObjectAlias(segLabel, ctx, "segment");
      if (!seg.ok) return err(seg.message);
      return { kind: "cmd", cmd: { type: "CreateMidpointBySegment", segId: seg.id } };
    }
    return err("Midpoint expects Midpoint(A,B) or Midpoint(s)");
  }

  if (name === "Line") {
    if (args.length === 2) {
      const aLabel = asIdentifier(args[0]);
      const bLabel = asIdentifier(args[1]);
      if (!aLabel || !bLabel) return err("Line(A, B) expects point labels");
      const a = resolvePointIdentifier(aLabel, ctx);
      if (!a.ok) return err(a.message);
      const b = resolvePointIdentifier(bLabel, ctx);
      if (!b.ok) return err(b.message);
      return { kind: "cmd", cmd: { type: "CreateLineByPoints", aId: a.id, bId: b.id } };
    }
    if (args.length === 4) {
      const x1 = evalArg(args[0]);
      const y1 = evalArg(args[1]);
      const x2 = evalArg(args[2]);
      const y2 = evalArg(args[3]);
      if (x1 === null || y1 === null || x2 === null || y2 === null) return err("Line arguments must be finite numbers");
      return { kind: "cmd", cmd: { type: "CreateLineXY", x1, y1, x2, y2 } };
    }
    return err("Line expects either Line(A,B) or Line(x1,y1,x2,y2)");
  }

  if (name === "Perpendicular") {
    if (args.length !== 2) return err("Perpendicular(P, l) expects 2 arguments");
    const throughLabel = asIdentifier(args[0]);
    const baseLabel = asIdentifier(args[1]);
    if (!throughLabel || !baseLabel) return err("Perpendicular(P, l) expects point and line/segment aliases");
    const through = resolvePointIdentifier(throughLabel, ctx);
    if (!through.ok) return err(through.message);
    const baseAlias = ctx.objectAliases.get(baseLabel);
    if (!baseAlias) return err(`Unknown line/segment: ${baseLabel}`);
    if (baseAlias.type !== "line" && baseAlias.type !== "segment") return err(`Not a line/segment: ${baseLabel}`);
    return {
      kind: "cmd",
      cmd: { type: "CreatePerpendicularLine", throughId: through.id, base: { type: baseAlias.type, id: baseAlias.id } },
    };
  }

  if (name === "Parallel") {
    if (args.length !== 2) return err("Parallel(P, l) expects 2 arguments");
    const throughLabel = asIdentifier(args[0]);
    const baseLabel = asIdentifier(args[1]);
    if (!throughLabel || !baseLabel) return err("Parallel(P, l) expects point and line/segment aliases");
    const through = resolvePointIdentifier(throughLabel, ctx);
    if (!through.ok) return err(through.message);
    const baseAlias = ctx.objectAliases.get(baseLabel);
    if (!baseAlias) return err(`Unknown line/segment: ${baseLabel}`);
    if (baseAlias.type !== "line" && baseAlias.type !== "segment") return err(`Not a line/segment: ${baseLabel}`);
    return {
      kind: "cmd",
      cmd: { type: "CreateParallelLine", throughId: through.id, base: { type: baseAlias.type, id: baseAlias.id } },
    };
  }

  if (name === "Tangent") {
    if (args.length !== 2) return err("Tangent(P, c) expects 2 arguments");
    const throughLabel = asIdentifier(args[0]);
    const circleLabel = asIdentifier(args[1]);
    if (!throughLabel || !circleLabel) return err("Tangent(P, c) expects point and circle aliases");
    const through = resolvePointIdentifier(throughLabel, ctx);
    if (!through.ok) return err(through.message);
    const circle = resolveObjectAlias(circleLabel, ctx, "circle");
    if (!circle.ok) return err(circle.message);
    return { kind: "cmd", cmd: { type: "CreateTangentLines", throughId: through.id, circleId: circle.id } };
  }

  if (name === "AngleBisector") {
    if (args.length !== 3) return err("AngleBisector(A,B,C) expects 3 point labels");
    const aLabel = asIdentifier(args[0]);
    const bLabel = asIdentifier(args[1]);
    const cLabel = asIdentifier(args[2]);
    if (!aLabel || !bLabel || !cLabel) return err("AngleBisector(A,B,C) expects point labels");
    const a = resolvePointIdentifier(aLabel, ctx);
    if (!a.ok) return err(a.message);
    const b = resolvePointIdentifier(bLabel, ctx);
    if (!b.ok) return err(b.message);
    const c = resolvePointIdentifier(cLabel, ctx);
    if (!c.ok) return err(c.message);
    return { kind: "cmd", cmd: { type: "CreateAngleBisector", aId: a.id, bId: b.id, cId: c.id } };
  }

  if (name === "Angle") {
    if (args.length !== 3) return err("Angle(A,B,C) expects 3 point labels");
    const aLabel = asIdentifier(args[0]);
    const bLabel = asIdentifier(args[1]);
    const cLabel = asIdentifier(args[2]);
    if (!aLabel || !bLabel || !cLabel) return err("Angle(A,B,C) expects point labels");
    const a = resolvePointIdentifier(aLabel, ctx);
    if (!a.ok) return err(a.message);
    const b = resolvePointIdentifier(bLabel, ctx);
    if (!b.ok) return err(b.message);
    const c = resolvePointIdentifier(cLabel, ctx);
    if (!c.ok) return err(c.message);
    return { kind: "cmd", cmd: { type: "CreateAngle", aId: a.id, bId: b.id, cId: c.id } };
  }

  if (name === "AngleFixed") {
    if (args.length !== 3 && args.length !== 4) return err("AngleFixed(V,A,expr[,CW|CCW]) expects 3 or 4 arguments");
    const vLabel = asIdentifier(args[0]);
    const aLabel = asIdentifier(args[1]);
    if (!vLabel || !aLabel) return err("AngleFixed(V,A,expr[,CW|CCW]) expects point labels for first two arguments");
    const vertex = resolvePointIdentifier(vLabel, ctx);
    if (!vertex.ok) return err(vertex.message);
    const basePoint = resolvePointIdentifier(aLabel, ctx);
    if (!basePoint.ok) return err(basePoint.message);
    const dirRaw = args.length === 4 ? args[3].trim() : "CCW";
    const direction = dirRaw === "CW" ? "CW" : dirRaw === "CCW" ? "CCW" : null;
    if (!direction) return err("AngleFixed direction must be CW or CCW");
    const angleEval = evaluateExpression(args[2], ctx);
    if (!angleEval.ok) return err("AngleFixed expression must evaluate to a finite number");
    return {
      kind: "cmd",
      cmd: { type: "CreateAngleFixed", vertexId: vertex.id, basePointId: basePoint.id, angleExpr: args[2].trim(), direction },
    };
  }

  if (name === "Sector") {
    if (args.length !== 3) return err("Sector(O,A,B) expects 3 point labels");
    const centerLabel = asIdentifier(args[0]);
    const startLabel = asIdentifier(args[1]);
    const endLabel = asIdentifier(args[2]);
    if (!centerLabel || !startLabel || !endLabel) return err("Sector(O,A,B) expects point labels");
    const center = resolvePointIdentifier(centerLabel, ctx);
    if (!center.ok) return err(center.message);
    const start = resolvePointIdentifier(startLabel, ctx);
    if (!start.ok) return err(start.message);
    const end = resolvePointIdentifier(endLabel, ctx);
    if (!end.ok) return err(end.message);
    return { kind: "cmd", cmd: { type: "CreateSector", centerId: center.id, startId: start.id, endId: end.id } };
  }

  if (name === "Segment") {
    if (args.length !== 2) return err("Segment(A, B) expects 2 point labels");
    const aLabel = asIdentifier(args[0]);
    const bLabel = asIdentifier(args[1]);
    if (!aLabel || !bLabel) return err("Segment(A, B) expects point labels");
    const a = resolvePointIdentifier(aLabel, ctx);
    if (!a.ok) return err(a.message);
    const b = resolvePointIdentifier(bLabel, ctx);
    if (!b.ok) return err(b.message);
    return { kind: "cmd", cmd: { type: "CreateSegmentByPoints", aId: a.id, bId: b.id } };
  }

  if (name === "Polygon") {
    if (args.length < 3) return err("Polygon(A, B, C, ...) expects at least 3 point labels");
    const pointIds: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < args.length; i += 1) {
      const label = asIdentifier(args[i]);
      if (!label) return err("Polygon(A, B, C, ...) expects point labels");
      const resolved = resolvePointIdentifier(label, ctx);
      if (!resolved.ok) return err(resolved.message);
      if (seen.has(resolved.id)) continue;
      seen.add(resolved.id);
      pointIds.push(resolved.id);
    }
    if (pointIds.length < 3) return err("Polygon requires at least 3 distinct points");
    return { kind: "cmd", cmd: { type: "CreatePolygonByPoints", pointIds } };
  }

  if (name === "Circle") {
    if (args.length === 3) {
      const x = evalArg(args[0]);
      const y = evalArg(args[1]);
      const r = evalArg(args[2]);
      if (x === null || y === null || r === null) return err("Circle arguments must be finite numbers");
      if (!(r > 0)) return err("Circle radius must be > 0");
      return { kind: "cmd", cmd: { type: "CreateCircleXYR", x, y, r } };
    }

    if (args.length === 2) {
      const centerLabel = asIdentifier(args[0]);
      if (!centerLabel) return err("Circle(center, ...) expects a point label as first argument");
      const center = resolvePointIdentifier(centerLabel, ctx);
      if (!center.ok) return err(center.message);

      const secondIdent = asIdentifier(args[1]);
      if (secondIdent) {
        const secondSymbols = ctx.symbolsByLabel.get(secondIdent);
        if (secondSymbols && secondSymbols.length > 0) {
          const through = resolvePointIdentifier(secondIdent, ctx);
          if (!through.ok) return err(through.message);
          return { kind: "cmd", cmd: { type: "CreateCircleCenterThrough", centerId: center.id, throughId: through.id } };
        }
        const scalar = resolveScalarIdentifier(secondIdent, ctx);
        if (!scalar.ok) return err(scalar.message);
        if (!(scalar.value > 0)) return err("Circle radius must be > 0");
        return {
          kind: "cmd",
          cmd: { type: "CreateCircleCenterRadius", centerId: center.id, r: scalar.value, rExpr: secondIdent },
        };
      }

      const rEval = evaluateExpression(args[1], ctx);
      if (!rEval.ok) return err("Circle radius must be a finite number");
      if (!(rEval.value > 0)) return err("Circle radius must be > 0");
      return {
        kind: "cmd",
        cmd: { type: "CreateCircleCenterRadius", centerId: center.id, r: rEval.value, rExpr: args[1].trim() },
      };
    }

    return err("Circle expects Circle(x,y,r), Circle(O,A), or Circle(O,r)");
  }

  if (name === "Circle3P" || name === "CircleThreePoint") {
    if (args.length !== 3) return err(`${name}(A,B,C) expects 3 point labels`);
    const aLabel = asIdentifier(args[0]);
    const bLabel = asIdentifier(args[1]);
    const cLabel = asIdentifier(args[2]);
    if (!aLabel || !bLabel || !cLabel) return err(`${name}(A,B,C) expects point labels`);
    const a = resolvePointIdentifier(aLabel, ctx);
    if (!a.ok) return err(a.message);
    const b = resolvePointIdentifier(bLabel, ctx);
    if (!b.ok) return err(b.message);
    const c = resolvePointIdentifier(cLabel, ctx);
    if (!c.ok) return err(c.message);
    return { kind: "cmd", cmd: { type: "CreateCircleThreePoint", aId: a.id, bId: b.id, cId: c.id } };
  }

  if (name === "Distance") {
    return parseDistanceResult(args, ctx);
  }

  return err(`Unknown command: ${name}`);
}

function parseCommandLike(input: string, ctx: ParseContext): ParseResult {
  const commandMatch = input.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
  if (!commandMatch) {
    const evaluated = evaluateExpression(input, ctx);
    if (!evaluated.ok) return err(evaluated.error);
    return { kind: "expr", value: formatNumber(evaluated.value), numeric: evaluated.value };
  }
  const name = commandMatch[1];
  const args = splitArgs(commandMatch[2]);
  if (!args) return err("Invalid command arguments");
  const asCommand = parseCommand(name, args, ctx);
  if (asCommand.kind !== "error" || !asCommand.message.startsWith("Unknown command:")) {
    return asCommand;
  }
  const evaluated = evaluateExpression(input, ctx);
  if (!evaluated.ok) return err(evaluated.error);
  return { kind: "expr", value: formatNumber(evaluated.value), numeric: evaluated.value };
}

function checkAssignmentNameAvailable(name: string, ctx: ParseContext): ParseResult | null {
  if (ctx.scalarsByName.has(name)) return err(`Name already used: ${name}`);
  if (ctx.objectNames.has(name)) return err(`Name already used: ${name}`);
  const existing = ctx.symbolsByLabel.get(name);
  if (existing && existing.length > 0) return err(`Name already used: ${name}`);
  return null;
}

export function parseCommandInput(rawInput: string, ctx: ParseContext): ParseResult {
  const input = rawInput.trim();
  if (!input) return err("Input is empty");
  if (input.length > MAX_INPUT_LENGTH) return err("Input is too long");
  if (DISALLOWED_TOKEN_RE.test(input)) return err("Expression uses disallowed token");

  const assignment = splitAssignment(input);
  if (assignment) {
    const left = asIdentifier(assignment.left);
    if (!left) return err("Invalid assignment target");
    const conflict = checkAssignmentNameAvailable(left, ctx);
    if (conflict) return conflict;

    const commandMatch = assignment.right.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
    if (commandMatch) {
      const args = splitArgs(commandMatch[2]);
      if (!args) return err("Invalid command arguments");
      const rhsCmd = parseCommand(commandMatch[1], args, ctx);
      if (rhsCmd.kind === "error") return rhsCmd;
      if (rhsCmd.kind === "cmd") {
        if (rhsCmd.cmd.type === "CreateTangentLines") return err("Assignment is not supported for Tangent(P,c) because it may create multiple lines");
        return { kind: "assignObject", name: left, cmd: rhsCmd.cmd };
      }
      if (rhsCmd.kind === "expr") {
        if (typeof rhsCmd.numeric !== "number" || !Number.isFinite(rhsCmd.numeric)) {
          return err("Assignment right-hand side must evaluate to a finite number");
        }
        return { kind: "assignScalar", name: left, value: rhsCmd.numeric };
      }
      return err("Unsupported assignment right-hand side");
    }

    const rhsExpr = evaluatePointOrScalarExpression(assignment.right, ctx);
    if (!rhsExpr.ok) return err(rhsExpr.error);
    if (rhsExpr.value.kind === "point") {
      return { kind: "assignObject", name: left, cmd: { type: "CreatePointXY", x: rhsExpr.value.x, y: rhsExpr.value.y } };
    }
    return { kind: "assignScalar", name: left, value: rhsExpr.value.value };
  }

  return parseCommandLike(input, ctx);
}
