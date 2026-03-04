import { all, create, type MathNode } from "mathjs";
import {
  type ScalarDistanceArg as DistanceArg,
  evaluateScalarDistanceArgs,
} from "./scene/eval/scalarDistance";
import {
  evaluateRegisteredScalarFunctionCall,
  type ScalarFunctionRuntimeAdapters,
} from "./scene/eval/scalarFunctionRegistry";
import { evaluateScalarObjectMeasureArg } from "./scene/eval/scalarObjectMeasure";
import { evaluateScalarExpressionWithRuntime } from "./scene/eval/scalarExpressionRuntime";

const math = create(all, { number: "number", matrix: "Array", predictable: true });
const MAX_INPUT_LENGTH = 300;
const DISALLOWED_TOKEN_RE = /\b(import|createUnit|unit|range|ones|zeros|matrix)\b/i;
const IDENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export type Symbol =
  | { kind: "point"; id: string; label: string }
  | { kind: "other"; id: string; label: string; type: string };

export type ParseContext = {
  symbolsByLabel: Map<string, Symbol[]>;
  pointWorldById?: Map<string, { x: number; y: number }>;
  lineWorldAnchorsById?: Map<string, { a: { x: number; y: number }; b: { x: number; y: number } }>;
  segmentWorldAnchorsById?: Map<string, { a: { x: number; y: number }; b: { x: number; y: number } }>;
  circleWorldGeometryById?: Map<string, { center: { x: number; y: number }; radius: number }>;
  polygonPointIdsById?: Map<string, string[]>;
  scalarsByName: Map<string, number>;
  objectAliases: Map<string, { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }>;
  objectNames: Set<string>;
  ans?: number;
};

export type Command =
  | { type: "CreatePointXY"; x: number; y: number }
  | { type: "CreateMidpointByPoints"; aId: string; bId: string }
  | { type: "CreateMidpointBySegment"; segId: string }
  | { type: "CreateTriangleCenterPoint"; centerKind: "incenter" | "orthocenter" | "centroid"; aId: string; bId: string; cId: string }
  | { type: "CreatePointByTranslation"; pointId: string; fromId: string; toId: string }
  | { type: "CreatePointByRotation"; pointId: string; centerId: string; angleDeg: number; angleExpr: string; direction: "CCW" | "CW" }
  | { type: "CreatePointByDilation"; pointId: string; centerId: string; factorExpr: string }
  | { type: "CreatePointByReflection"; pointId: string; axis: { type: "line" | "segment" | "point"; id: string } }
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
  | { type: "CreateRegularPolygonFromEdge"; aId: string; bId: string; sides: number; direction: "CCW" | "CW" }
  | { type: "CreateCircleThreePoint"; aId: string; bId: string; cId: string }
  | { type: "CreateCircleXYR"; x: number; y: number; r: number }
  | { type: "CreateCircleCenterRadius"; centerId: string; r: number; rExpr?: string }
  | { type: "CreateCircleCenterThrough"; centerId: string; throughId: string };

export type ParseResult =
  | { kind: "expr"; value: string; numeric?: number }
  | { kind: "cmd"; cmd: Command }
  | { kind: "assignScalar"; name: string; value: number; expr?: string }
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

function unwrapParenthesisNode(node: MathNode): MathNode {
  let current = node;
  for (;;) {
    const anyNode = current as unknown as { type?: string; content?: MathNode };
    if (anyNode.type !== "ParenthesisNode" || !anyNode.content) return current;
    current = anyNode.content;
  }
}

function buildParserScalarFunctionAdapters(ctx: ParseContext): ScalarFunctionRuntimeAdapters {
  return {
    resolveDistanceArg: (argExprRaw) => {
      let node: MathNode;
      try {
        node = math.parse(argExprRaw);
      } catch {
        return { ok: false, error: "Distance(...) arguments are invalid" };
      }
      return resolveDistanceArg(node, ctx);
    },
    evaluateMeasureArg: (fnName, argExprRaw) => evaluateMeasureArg(fnName, argExprRaw, ctx),
  };
}

function evaluateExpression(expr: string, ctx: ParseContext): EvalResult {
  const scalarFunctionAdapters = buildParserScalarFunctionAdapters(ctx);
  return evaluateScalarExpressionWithRuntime(expr, {
    ans: ctx.ans,
    getScalarValue: (name) => ctx.scalarsByName.get(name),
    ...scalarFunctionAdapters,
  });
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
    fn?: { name?: string };
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

  if (anyNode.type === "FunctionNode") {
    const fnName = anyNode.fn?.name ?? "";
    const args = anyNode.args ?? [];
    const scalarCall = evaluateRegisteredScalarFunctionCall({
      fnName,
      args,
      adapters: buildParserScalarFunctionAdapters(ctx),
      evalNumericArg: (argNode) => {
        const arg = evalPointExpressionNode(argNode, ctx);
        if (!arg.ok) return { ok: false, error: arg.error };
        if (arg.value.kind !== "scalar") {
          return { ok: false, error: `Function ${fnName || "unknown"} only supports scalar arguments` };
        }
        return { ok: true, value: arg.value.value };
      },
    });
    if (!scalarCall.ok) return { ok: false, error: scalarCall.error };
    return { ok: true, value: toScalarExprValue(scalarCall.value) };
  }

  return { ok: false, error: `Unsupported expression node: ${anyNode.type ?? "unknown"}` };
}

function evaluatePointOrScalarExpression(expr: string, ctx: ParseContext): { ok: true; value: ExprValue } | { ok: false; error: string } {
  const scalar = evaluateExpression(expr, ctx);
  if (scalar.ok) return { ok: true, value: toScalarExprValue(scalar.value) };
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

function resolveDistanceArg(node: MathNode, ctx: ParseContext): { ok: true; value: DistanceArg } | { ok: false; error: string } {
  const unwrapped = unwrapParenthesisNode(node);
  const anyNode = unwrapped as unknown as { type?: string; name?: string };
  if (anyNode.type === "SymbolNode" && anyNode.name) {
    const alias = ctx.objectAliases.get(anyNode.name);
    if (alias?.type === "line") {
      const anchors = ctx.lineWorldAnchorsById?.get(alias.id);
      if (!anchors) return { ok: false, error: `Distance requires line geometry in context: ${anyNode.name}` };
      return { ok: true, value: { kind: "lineLike", finite: false, a: anchors.a, b: anchors.b } };
    }
    if (alias?.type === "segment") {
      const anchors = ctx.segmentWorldAnchorsById?.get(alias.id);
      if (!anchors) return { ok: false, error: `Distance requires segment geometry in context: ${anyNode.name}` };
      return { ok: true, value: { kind: "lineLike", finite: true, a: anchors.a, b: anchors.b } };
    }
  }

  const pointOrScalar = evalPointExpressionNode(unwrapped, ctx);
  if (!pointOrScalar.ok) return { ok: false, error: pointOrScalar.error };
  if (pointOrScalar.value.kind !== "point") {
    return { ok: false, error: "Distance expects Point-Point or Point-Line/Segment arguments" };
  }
  return { ok: true, value: { kind: "point", x: pointOrScalar.value.x, y: pointOrScalar.value.y } };
}

function parseDistanceNumeric(args: string[], ctx: ParseContext): EvalResult {
  if (args.length !== 2) return { ok: false, error: "Distance(...) expects 2 arguments" };
  let leftNode: MathNode;
  let rightNode: MathNode;
  try {
    leftNode = math.parse(args[0]);
    rightNode = math.parse(args[1]);
  } catch {
    return { ok: false, error: "Distance(...) arguments are invalid" };
  }
  const left = resolveDistanceArg(leftNode, ctx);
  if (!left.ok) return { ok: false, error: left.error };
  const right = resolveDistanceArg(rightNode, ctx);
  if (!right.ok) return { ok: false, error: right.error };
  return evaluateScalarDistanceArgs(left.value, right.value);
}

function parseDistanceResult(args: string[], ctx: ParseContext): ParseResult {
  const d = parseDistanceNumeric(args, ctx);
  if (!d.ok) return err(d.error);
  return { kind: "expr", value: formatNumber(d.value), numeric: d.value };
}

function evaluateMeasureArg(fnName: "Area" | "Perimeter", raw: string, ctx: ParseContext): EvalResult {
  const circleAliasesById = new Map<string, string>();
  const polygonAliasesById = new Map<string, string>();
  for (const [label, ref] of ctx.objectAliases.entries()) {
    if (ref.type === "circle" && !circleAliasesById.has(ref.id)) circleAliasesById.set(ref.id, label);
    if (ref.type === "polygon" && !polygonAliasesById.has(ref.id)) polygonAliasesById.set(ref.id, label);
  }
  const circles =
    ctx.circleWorldGeometryById == null
      ? []
      : Array.from(ctx.circleWorldGeometryById.keys(), (id) => ({ id, labelText: circleAliasesById.get(id) }));
  const polygons =
    ctx.polygonPointIdsById == null
      ? []
      : Array.from(ctx.polygonPointIdsById.entries(), ([id, pointIds]) => ({
          id,
          pointIds,
          labelText: polygonAliasesById.get(id),
        }));
  return evaluateScalarObjectMeasureArg(fnName, raw, {
    circles,
    polygons,
    getCircleRadius: (circleId) => ctx.circleWorldGeometryById?.get(circleId)?.radius ?? null,
    getPolygonVertices: (_polygonId, pointIds) => {
      const pointMap = ctx.pointWorldById;
      if (!pointMap) return null;
      const verts: Array<{ x: number; y: number }> = [];
      for (const pointId of pointIds) {
        const w = pointMap.get(pointId);
        if (!w) return null;
        verts.push(w);
      }
      return verts;
    },
  });
}

function parseCommand(name: string, args: string[], ctx: ParseContext): ParseResult {
  const evalScalarArg = (raw: string): EvalResult => {
    const out = evaluatePointOrScalarExpression(raw, ctx);
    if (!out.ok) return { ok: false, error: out.error };
    if (out.value.kind !== "scalar") return { ok: false, error: "Expression must evaluate to a finite number" };
    if (!Number.isFinite(out.value.value)) return { ok: false, error: "Expression must evaluate to a finite number" };
    return { ok: true, value: out.value.value };
  };
  const evalArg = (raw: string): number | null => {
    const out = evalScalarArg(raw);
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

  if (name === "Incenter" || name === "Ortho" || name === "Orthocenter" || name === "Centroid") {
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
    const centerKind =
      name === "Incenter" ? "incenter" : name === "Centroid" ? "centroid" : "orthocenter";
    return {
      kind: "cmd",
      cmd: { type: "CreateTriangleCenterPoint", centerKind, aId: a.id, bId: b.id, cId: c.id },
    };
  }

  if (name === "Translate") {
    if (args.length !== 3) return err("Translate(P, A, B) expects 3 point labels");
    const pointLabel = asIdentifier(args[0]);
    const fromLabel = asIdentifier(args[1]);
    const toLabel = asIdentifier(args[2]);
    if (!pointLabel || !fromLabel || !toLabel) return err("Translate(P, A, B) expects point labels");
    const point = resolvePointIdentifier(pointLabel, ctx);
    if (!point.ok) return err(point.message);
    const from = resolvePointIdentifier(fromLabel, ctx);
    if (!from.ok) return err(from.message);
    const to = resolvePointIdentifier(toLabel, ctx);
    if (!to.ok) return err(to.message);
    return { kind: "cmd", cmd: { type: "CreatePointByTranslation", pointId: point.id, fromId: from.id, toId: to.id } };
  }

  if (name === "Rotate") {
    if (args.length !== 3 && args.length !== 4) return err("Rotate(P, O, expr[,CW|CCW]) expects 3 or 4 arguments");
    const pointLabel = asIdentifier(args[0]);
    const centerLabel = asIdentifier(args[1]);
    if (!pointLabel || !centerLabel) return err("Rotate(P, O, expr[,CW|CCW]) expects point labels for first two arguments");
    const point = resolvePointIdentifier(pointLabel, ctx);
    if (!point.ok) return err(point.message);
    const center = resolvePointIdentifier(centerLabel, ctx);
    if (!center.ok) return err(center.message);
    const dirRaw = args.length === 4 ? args[3].trim() : "CCW";
    const direction = dirRaw === "CW" ? "CW" : dirRaw === "CCW" ? "CCW" : null;
    if (!direction) return err("Rotate direction must be CW or CCW");
    const angleEval = evalScalarArg(args[2]);
    if (!angleEval.ok) return err("Rotate expression must evaluate to a finite number");
    return {
      kind: "cmd",
      cmd: {
        type: "CreatePointByRotation",
        pointId: point.id,
        centerId: center.id,
        angleDeg: angleEval.value,
        angleExpr: args[2].trim(),
        direction,
      },
    };
  }

  if (name === "Dilate") {
    if (args.length !== 3) return err("Dilate(P, O, k) expects 3 arguments");
    const pointLabel = asIdentifier(args[0]);
    const centerLabel = asIdentifier(args[1]);
    if (!pointLabel || !centerLabel) return err("Dilate(P, O, k) expects point labels for first two arguments");
    const point = resolvePointIdentifier(pointLabel, ctx);
    if (!point.ok) return err(point.message);
    const center = resolvePointIdentifier(centerLabel, ctx);
    if (!center.ok) return err(center.message);
    const factorEval = evalScalarArg(args[2]);
    if (!factorEval.ok) return err("Dilate factor must evaluate to a finite number");
    return {
      kind: "cmd",
      cmd: { type: "CreatePointByDilation", pointId: point.id, centerId: center.id, factorExpr: args[2].trim() },
    };
  }

  if (name === "Reflect") {
    if (args.length !== 2) return err("Reflect(P, l|O) expects 2 arguments");
    const pointLabel = asIdentifier(args[0]);
    const axisLabel = asIdentifier(args[1]);
    if (!pointLabel || !axisLabel) return err("Reflect(P, l|O) expects point and line/segment/point target");
    const point = resolvePointIdentifier(pointLabel, ctx);
    if (!point.ok) return err(point.message);
    const axisPoint = resolvePointIdentifier(axisLabel, ctx);
    if (axisPoint.ok) {
      return { kind: "cmd", cmd: { type: "CreatePointByReflection", pointId: point.id, axis: { type: "point", id: axisPoint.id } } };
    }
    const axisAlias = ctx.objectAliases.get(axisLabel);
    if (!axisAlias) return err(`Unknown reflection target: ${axisLabel}`);
    if (axisAlias.type !== "line" && axisAlias.type !== "segment") return err(`Not a line/segment: ${axisLabel}`);
    return { kind: "cmd", cmd: { type: "CreatePointByReflection", pointId: point.id, axis: { type: axisAlias.type, id: axisAlias.id } } };
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
    const angleEval = evalScalarArg(args[2]);
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

  if (name === "RegularPolygon") {
    if (args.length !== 3 && args.length !== 4) return err("RegularPolygon(A, B, n[,CW|CCW]) expects 3 or 4 arguments");
    const aLabel = asIdentifier(args[0]);
    const bLabel = asIdentifier(args[1]);
    if (!aLabel || !bLabel) return err("RegularPolygon(A, B, n) expects point labels for A and B");
    const a = resolvePointIdentifier(aLabel, ctx);
    if (!a.ok) return err(a.message);
    const b = resolvePointIdentifier(bLabel, ctx);
    if (!b.ok) return err(b.message);
    const nEval = evalScalarArg(args[2]);
    if (!nEval.ok) return err("RegularPolygon side count must be numeric");
    const sides = Math.round(nEval.value);
    if (Math.abs(sides - nEval.value) > 1e-9) return err("RegularPolygon side count must be an integer");
    if (sides < 3 || sides > 64) return err("RegularPolygon side count must be in [3, 64]");
    const dirRaw = args.length === 4 ? args[3].trim() : "CCW";
    const direction = dirRaw === "CW" ? "CW" : dirRaw === "CCW" ? "CCW" : null;
    if (!direction) return err("RegularPolygon direction must be CW or CCW");
    return { kind: "cmd", cmd: { type: "CreateRegularPolygonFromEdge", aId: a.id, bId: b.id, sides, direction } };
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
        const through = resolvePointIdentifier(secondIdent, ctx);
        if (through.ok) {
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

      const rEval = evalScalarArg(args[1]);
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
    const evaluated = evaluatePointOrScalarExpression(input, ctx);
    if (!evaluated.ok) return err(evaluated.error);
    if (evaluated.value.kind !== "scalar") return err("Expression must evaluate to a scalar value");
    return { kind: "expr", value: formatNumber(evaluated.value.value), numeric: evaluated.value.value };
  }
  const name = commandMatch[1];
  let asCommand: ParseResult;
  const args = splitArgs(commandMatch[2]);
  if (!args) {
    asCommand = err("Invalid command arguments");
  } else {
    asCommand = parseCommand(name, args, ctx);
  }
  if (asCommand.kind !== "error" || !asCommand.message.startsWith("Unknown command:")) {
    if (asCommand.kind !== "error") return asCommand;
    // Compound expressions can start with a function call and also end with ')',
    // which matches command-like regex greedily. Fall back to expression parsing.
    const evaluated = evaluatePointOrScalarExpression(input, ctx);
    if (evaluated.ok) {
      if (evaluated.value.kind !== "scalar") return err("Expression must evaluate to a scalar value");
      return { kind: "expr", value: formatNumber(evaluated.value.value), numeric: evaluated.value.value };
    }
    return asCommand;
  }
  const evaluated = evaluatePointOrScalarExpression(input, ctx);
  if (!evaluated.ok) return err(evaluated.error);
  if (evaluated.value.kind !== "scalar") return err("Expression must evaluate to a scalar value");
  return { kind: "expr", value: formatNumber(evaluated.value.value), numeric: evaluated.value.value };
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

    const commandMatch = assignment.right.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
    if (commandMatch) {
      const args = splitArgs(commandMatch[2]);
      const rhsCmd = args ? parseCommand(commandMatch[1], args, ctx) : err("Invalid command arguments");
      if (rhsCmd.kind !== "error") {
        if (rhsCmd.kind === "cmd") {
          if (rhsCmd.cmd.type === "CreateTangentLines") return err("Assignment is not supported for Tangent(P,c) because it may create multiple lines");
          return { kind: "assignObject", name: left, cmd: rhsCmd.cmd };
        }
        if (rhsCmd.kind === "expr") {
          if (typeof rhsCmd.numeric !== "number" || !Number.isFinite(rhsCmd.numeric)) {
            return err("Assignment right-hand side must evaluate to a finite number");
          }
          return { kind: "assignScalar", name: left, value: rhsCmd.numeric, expr: assignment.right.trim() };
        }
        return err("Unsupported assignment right-hand side");
      }
      // Fall through to expression parsing for compound expressions like:
      // d = Distance(A,B)^2 - Distance(B,C)*Distance(C,A)
      // which greedily match command-like regex but are not standalone commands.
      const rhsExprFallback = evaluatePointOrScalarExpression(assignment.right, ctx);
      if (rhsExprFallback.ok) {
        if (rhsExprFallback.value.kind === "point") {
          return { kind: "assignObject", name: left, cmd: { type: "CreatePointXY", x: rhsExprFallback.value.x, y: rhsExprFallback.value.y } };
        }
        return { kind: "assignScalar", name: left, value: rhsExprFallback.value.value, expr: assignment.right.trim() };
      }
      return rhsCmd;
    }

    const rhsExpr = evaluatePointOrScalarExpression(assignment.right, ctx);
    if (!rhsExpr.ok) return err(rhsExpr.error);
    if (rhsExpr.value.kind === "point") {
      return { kind: "assignObject", name: left, cmd: { type: "CreatePointXY", x: rhsExpr.value.x, y: rhsExpr.value.y } };
    }
    return { kind: "assignScalar", name: left, value: rhsExpr.value.value, expr: assignment.right.trim() };
  }

  return parseCommandLike(input, ctx);
}
