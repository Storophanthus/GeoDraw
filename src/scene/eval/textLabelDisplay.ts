import type { SceneTextLabel } from "../points";

type NumberExpressionResult =
  | { ok: true; value: number }
  | { ok: false };

export function formatTextLabelNumber(value: number): string {
  if (!Number.isFinite(value)) return "undefined";
  if (Math.abs(value) < 1e-12) return "0";
  const rounded = value.toFixed(6).replace(/\.?0+$/, "");
  return rounded === "-0" ? "0" : rounded;
}

export function resolveTextLabelDisplayTextWithOps(
  label: SceneTextLabel,
  ops: {
    getNumberValue: (id: string) => number | null;
    evaluateNumberExpression: (expr: string) => NumberExpressionResult;
  }
): string {
  if (label.contentMode === "number" && typeof label.numberId === "string" && label.numberId.trim().length > 0) {
    const value = ops.getNumberValue(label.numberId);
    if (value !== null) return formatTextLabelNumber(value);
  }
  if (label.contentMode === "expression") {
    const expr = typeof label.expr === "string" ? label.expr.trim() : "";
    if (expr) {
      const evaluated = ops.evaluateNumberExpression(expr);
      if (evaluated.ok) return formatTextLabelNumber(evaluated.value);
      return "undefined";
    }
  }
  return label.text;
}
