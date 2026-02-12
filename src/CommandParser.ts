import { all, create, type MathNode } from "mathjs";

const math = create(all, { number: "number", matrix: "Array", predictable: true });
const MAX_INPUT_LENGTH = 300;
const DISALLOWED_TOKEN_RE = /\b(import|createUnit|unit|range|ones|zeros|matrix)\b/i;
const ALLOWED_FUNCTIONS = new Set(["sin", "cos", "tan", "sqrt", "abs", "min", "max", "pow"]);
const ALLOWED_SYMBOLS = new Set(["ans", "pi", "e", "tau"]);
const IDENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export type Symbol =
  | { kind: "point"; id: string; label: string }
  | { kind: "other"; id: string; label: string; type: string };

export type ParseContext = {
  symbolsByLabel: Map<string, Symbol[]>;
  pointWorldById?: Map<string, { x: number; y: number }>;
  ans?: number;
};

export type Command =
  | { type: "CreatePointXY"; x: number; y: number }
  | { type: "CreateLineXY"; x1: number; y1: number; x2: number; y2: number }
  | { type: "CreateLineByPoints"; aId: string; bId: string }
  | { type: "CreateSegmentByPoints"; aId: string; bId: string }
  | { type: "CreateCircleXYR"; x: number; y: number; r: number }
  | { type: "CreateCircleCenterRadius"; centerId: string; r: number }
  | { type: "CreateCircleCenterThrough"; centerId: string; throughId: string };

export type ParseResult =
  | { kind: "expr"; value: string; numeric?: number }
  | { kind: "cmd"; cmd: Command }
  | { kind: "error"; message: string };

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) < 1e-12) return "0";
  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}

function err(message: string): ParseResult {
  return { kind: "error", message };
}

function ensureSafeNode(node: MathNode): string | null {
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
        if (!anyNode.name || !ALLOWED_SYMBOLS.has(anyNode.name)) {
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

function evaluateExpression(expr: string, ans?: number): { ok: true; value: number } | { ok: false; error: string } {
  if (expr.length > MAX_INPUT_LENGTH) return { ok: false, error: "Input is too long" };
  if (DISALLOWED_TOKEN_RE.test(expr)) return { ok: false, error: "Expression uses disallowed token" };

  let node: MathNode;
  try {
    node = math.parse(expr);
  } catch {
    return { ok: false, error: "Invalid expression syntax" };
  }

  const safe = ensureSafeNode(node);
  if (safe) return { ok: false, error: safe };

  const scope = {
    ans: ans ?? 0,
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    sqrt: Math.sqrt,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  };

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

function asIdentifier(value: string): string | null {
  return IDENT_RE.test(value) ? value : null;
}

function resolvePointIdentifier(label: string, ctx: ParseContext): { ok: true; id: string } | { ok: false; message: string } {
  const symbols = ctx.symbolsByLabel.get(label);
  if (!symbols || symbols.length === 0) return { ok: false, message: `Unknown point: ${label}` };
  if (symbols.length > 1) return { ok: false, message: `Ambiguous identifier: ${label}` };
  if (symbols[0].kind !== "point") return { ok: false, message: `Not a point: ${label}` };
  return { ok: true, id: symbols[0].id };
}

function parseDistance(args: string[], ctx: ParseContext): ParseResult {
  if (args.length !== 2) return err("Distance(A, B) expects 2 point labels");
  const aLabel = asIdentifier(args[0]);
  const bLabel = asIdentifier(args[1]);
  if (!aLabel || !bLabel) return err("Distance(A, B) expects point labels");
  const a = resolvePointIdentifier(aLabel, ctx);
  if (!a.ok) return err(a.message);
  const b = resolvePointIdentifier(bLabel, ctx);
  if (!b.ok) return err(b.message);

  const pMap = ctx.pointWorldById;
  if (!pMap) return err("Distance requires point coordinates in context");
  const pa = pMap.get(a.id);
  const pb = pMap.get(b.id);
  if (!pa || !pb) return err("Distance point is missing");

  const dx = pa.x - pb.x;
  const dy = pa.y - pb.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return { kind: "expr", value: formatNumber(d), numeric: d };
}

function parseCommand(name: string, args: string[], ctx: ParseContext): ParseResult {
  const evalArg = (raw: string): number | null => {
    const out = evaluateExpression(raw, ctx.ans);
    return out.ok ? out.value : null;
  };

  if (name === "Point") {
    if (args.length !== 2) return err("Point(x, y) expects 2 arguments");
    const x = evalArg(args[0]);
    const y = evalArg(args[1]);
    if (x === null || y === null) return err("Point arguments must be finite numbers");
    return { kind: "cmd", cmd: { type: "CreatePointXY", x, y } };
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
      }

      const r = evalArg(args[1]);
      if (r === null) return err("Circle radius must be a finite number");
      if (!(r > 0)) return err("Circle radius must be > 0");
      return { kind: "cmd", cmd: { type: "CreateCircleCenterRadius", centerId: center.id, r } };
    }

    return err("Circle expects Circle(x,y,r), Circle(O,A), or Circle(O,r)");
  }

  if (name === "Distance") {
    return parseDistance(args, ctx);
  }

  return err(`Unknown command: ${name}`);
}

export function parseCommandInput(rawInput: string, ctx: ParseContext): ParseResult {
  const input = rawInput.trim();
  if (!input) return err("Input is empty");
  if (input.length > MAX_INPUT_LENGTH) return err("Input is too long");
  if (DISALLOWED_TOKEN_RE.test(input)) return err("Expression uses disallowed token");

  const commandMatch = input.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
  if (commandMatch) {
    const name = commandMatch[1];
    const args = splitArgs(commandMatch[2]);
    if (!args) return err("Invalid command arguments");
    return parseCommand(name, args, ctx);
  }

  const evaluated = evaluateExpression(input, ctx.ans);
  if (!evaluated.ok) return err(evaluated.error);
  return { kind: "expr", value: formatNumber(evaluated.value), numeric: evaluated.value };
}
