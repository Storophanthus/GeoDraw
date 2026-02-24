import { all, create, type MathNode } from "mathjs";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { evaluateScalarDistanceArgs, type ScalarDistanceArg } from "./scalarDistance";

const math = create(all, { number: "number", matrix: "Array", predictable: true });
const MAX_INPUT_LENGTH = 300;
const DISALLOWED_TOKEN_RE = /\b(import|createUnit|unit|range|ones|zeros|matrix)\b/i;
type ScalarRuntimeEvalResult = NumberExpressionEvalResult;
type MeasureFunctionName = "Area" | "Perimeter";

export type ScalarExpressionRuntime = {
  ans?: number;
  getScalarValue: (name: string) => number | undefined;
  resolveDistanceArg?: (argExprRaw: string) => { ok: true; value: ScalarDistanceArg } | { ok: false; error: string };
  evaluateMeasureArg?: (fnName: MeasureFunctionName, argExprRaw: string) => ScalarRuntimeEvalResult;
};

type ScalarFunctionSpec =
  | {
      mode: "raw";
      eval: (args: MathNode[], runtime: ScalarExpressionRuntime) => ScalarRuntimeEvalResult;
    }
  | {
      mode: "numeric";
      minArgs: number;
      maxArgs: number | null;
      eval: (values: number[]) => number;
    };

function fixedNumericFn(arity: number, evalFn: (values: number[]) => number): ScalarFunctionSpec {
  return { mode: "numeric", minArgs: arity, maxArgs: arity, eval: evalFn };
}

function variadicNumericFn(minArgs: number, evalFn: (values: number[]) => number): ScalarFunctionSpec {
  return { mode: "numeric", minArgs, maxArgs: null, eval: evalFn };
}

function rawFn(evalFn: (args: MathNode[], runtime: ScalarExpressionRuntime) => ScalarRuntimeEvalResult): ScalarFunctionSpec {
  return { mode: "raw", eval: evalFn };
}

const SHARED_NUMERIC_SPECS = {
  sin: fixedNumericFn(1, (values) => Math.sin(values[0] ?? 0)),
  cos: fixedNumericFn(1, (values) => Math.cos(values[0] ?? 0)),
  tan: fixedNumericFn(1, (values) => Math.tan(values[0] ?? 0)),
  sqrt: fixedNumericFn(1, (values) => Math.sqrt(values[0] ?? 0)),
  abs: fixedNumericFn(1, (values) => Math.abs(values[0] ?? 0)),
  min: variadicNumericFn(1, (values) => Math.min(...values)),
  max: variadicNumericFn(1, (values) => Math.max(...values)),
  pow: fixedNumericFn(2, (values) => Math.pow(values[0] ?? 0, values[1] ?? 0)),
} as const;

const FUNCTION_REGISTRY = new Map<string, ScalarFunctionSpec>([
  [
    "Distance",
    rawFn((args, runtime) => {
      if (!runtime.resolveDistanceArg) return { ok: false, error: "Distance(...) is not supported in this context" };
      if (args.length !== 2) return { ok: false, error: "Distance(...) expects 2 arguments" };
      const left = runtime.resolveDistanceArg(args[0].toString());
      if (!left.ok) return left;
      const right = runtime.resolveDistanceArg(args[1].toString());
      if (!right.ok) return right;
      return evaluateScalarDistanceArgs(left.value, right.value);
    }),
  ],
  [
    "Area",
    rawFn((args, runtime) => {
      if (!runtime.evaluateMeasureArg) return { ok: false, error: "Area(...) is not supported in this context" };
      if (args.length !== 1) return { ok: false, error: "Area(...) expects 1 argument" };
      return runtime.evaluateMeasureArg("Area", args[0].toString());
    }),
  ],
  [
    "Perimeter",
    rawFn((args, runtime) => {
      if (!runtime.evaluateMeasureArg) return { ok: false, error: "Perimeter(...) is not supported in this context" };
      if (args.length !== 1) return { ok: false, error: "Perimeter(...) expects 1 argument" };
      return runtime.evaluateMeasureArg("Perimeter", args[0].toString());
    }),
  ],
  ["sin", SHARED_NUMERIC_SPECS.sin],
  ["Sin", SHARED_NUMERIC_SPECS.sin],
  ["cos", SHARED_NUMERIC_SPECS.cos],
  ["Cos", SHARED_NUMERIC_SPECS.cos],
  ["tan", SHARED_NUMERIC_SPECS.tan],
  ["Tan", SHARED_NUMERIC_SPECS.tan],
  ["sqrt", SHARED_NUMERIC_SPECS.sqrt],
  ["abs", SHARED_NUMERIC_SPECS.abs],
  ["min", SHARED_NUMERIC_SPECS.min],
  ["max", SHARED_NUMERIC_SPECS.max],
  ["pow", SHARED_NUMERIC_SPECS.pow],
]);

export function evaluateScalarExpressionWithRuntime(
  exprRaw: string,
  runtime: ScalarExpressionRuntime
): ScalarRuntimeEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty number expression." };
  if (expr.length > MAX_INPUT_LENGTH) return { ok: false, error: "Input is too long" };
  if (DISALLOWED_TOKEN_RE.test(expr)) return { ok: false, error: "Expression uses disallowed token" };

  let node: MathNode;
  try {
    node = math.parse(expr);
  } catch {
    return { ok: false, error: "Invalid expression syntax" };
  }
  return evalScalarNode(node, runtime);
}

function evalScalarNode(
  node: MathNode,
  runtime: ScalarExpressionRuntime
): ScalarRuntimeEvalResult {
  const anyNode = node as unknown as {
    type?: string;
    name?: string;
    fn?: { name?: string };
    op?: string;
    args?: MathNode[];
    content?: MathNode;
  };

  if (anyNode.type === "ParenthesisNode" && anyNode.content) return evalScalarNode(anyNode.content, runtime);

  if (anyNode.type === "ConstantNode") {
    const value = Number(node.toString());
    if (!Number.isFinite(value)) return { ok: false, error: "Expression must evaluate to a finite number" };
    return { ok: true, value };
  }

  if (anyNode.type === "SymbolNode") {
    const name = anyNode.name ?? "";
    if (!name) return { ok: false, error: "Unsupported symbol: unknown" };
    if (name === "ans") return { ok: true, value: runtime.ans ?? 0 };
    if (name === "pi" || name === "Pi" || name === "PI") return { ok: true, value: Math.PI };
    if (name === "e") return { ok: true, value: Math.E };
    if (name === "tau") return { ok: true, value: Math.PI * 2 };
    const v = runtime.getScalarValue(name);
    if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: `Unknown symbol: ${name}` };
    return { ok: true, value: v };
  }

  if (anyNode.type === "OperatorNode") {
    const op = anyNode.op ?? "";
    const args = anyNode.args ?? [];
    if ((op === "+" || op === "-") && args.length === 1) {
      const inner = evalScalarNode(args[0], runtime);
      if (!inner.ok) return inner;
      return { ok: true, value: op === "-" ? -inner.value : inner.value };
    }
    if (args.length !== 2) return { ok: false, error: `Unsupported operator arity: ${op || "unknown"}` };
    const left = evalScalarNode(args[0], runtime);
    if (!left.ok) return left;
    const right = evalScalarNode(args[1], runtime);
    if (!right.ok) return right;
    switch (op) {
      case "+":
        return { ok: true, value: left.value + right.value };
      case "-":
        return { ok: true, value: left.value - right.value };
      case "*":
        return { ok: true, value: left.value * right.value };
      case "/":
        if (Math.abs(right.value) <= 1e-12) return { ok: false, error: "Division by zero." };
        return { ok: true, value: left.value / right.value };
      case "^": {
        const out = left.value ** right.value;
        if (!Number.isFinite(out)) return { ok: false, error: "Exponentiation result is not finite" };
        return { ok: true, value: out };
      }
      default:
        return { ok: false, error: `Unsupported operator: ${op || "unknown"}` };
    }
  }

  if (anyNode.type === "FunctionNode") {
    const fnName = anyNode.fn?.name ?? "";
    const args = anyNode.args ?? [];
    const spec = FUNCTION_REGISTRY.get(fnName);
    if (!spec) return { ok: false, error: `Unsupported function: ${fnName || "unknown"}` };
    if (spec.mode === "raw") return spec.eval(args, runtime);

    if (args.length < spec.minArgs || (spec.maxArgs !== null && args.length > spec.maxArgs)) {
      return { ok: false, error: `Unsupported function: ${fnName || "unknown"}` };
    }
    const values: number[] = [];
    for (const arg of args) {
      const value = evalScalarNode(arg, runtime);
      if (!value.ok) return value;
      values.push(value.value);
    }
    const out = spec.eval(values);
    if (!Number.isFinite(out)) return { ok: false, error: `Function ${fnName} result is not finite` };
    return { ok: true, value: out };
  }

  return { ok: false, error: `Unsupported expression node: ${anyNode.type ?? "unknown"}` };
}
