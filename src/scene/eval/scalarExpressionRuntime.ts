import { all, create, type MathNode } from "mathjs";
import type { NumberExpressionEvalResult } from "./numericExpression";
import {
  evaluateRegisteredScalarFunctionCall,
  type ScalarFunctionRuntimeAdapters,
} from "./scalarFunctionRegistry";

const math = create(all, { number: "number", matrix: "Array", predictable: true });
const MAX_INPUT_LENGTH = 300;
const DISALLOWED_TOKEN_RE = /\b(import|createUnit|unit|range|ones|zeros|matrix)\b/i;
type ScalarRuntimeEvalResult = NumberExpressionEvalResult;

export type ScalarExpressionRuntime = ScalarFunctionRuntimeAdapters & {
  ans?: number;
  getScalarValue: (name: string) => number | undefined;
};

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
    return evaluateRegisteredScalarFunctionCall({
      fnName,
      args,
      adapters: runtime,
      evalNumericArg: (arg) => evalScalarNode(arg, runtime),
    });
  }

  return { ok: false, error: `Unsupported expression node: ${anyNode.type ?? "unknown"}` };
}
