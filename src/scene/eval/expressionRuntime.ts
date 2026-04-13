import {
  buildAngleSymbolTable,
  buildNumberSymbolTable,
  evaluateAngleExpressionDegreesWithSymbols,
  evaluateNumberExpressionWithSymbols,
  type AngleExpressionEvalResult,
} from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { computeOrientedAngleRad } from "./angleMath";

type AngleRuntimeAngle = {
  id: string;
  aId: string;
  bId: string;
  cId: string;
  labelText: string;
};

type AnglePointNames = { aName: string; bName: string; cName: string };

export function evaluateAngleExpressionWithRuntime(
  exprRaw: string,
  runtime: {
    angles: AngleRuntimeAngle[];
    numbers: Array<{ id: string; name: string }>;
    getAngleValueDeg: (angleId: string) => number | null;
    getAnglePointNames: (angleId: string) => AnglePointNames | null;
    getNumberValue: (numberId: string) => number | null;
    resolvePointArg?: (argExprRaw: string) => { ok: true; value: { x: number; y: number } } | { ok: false; error: string };
  }
): AngleExpressionEvalResult {
  const symbols = buildAngleSymbolTable({
    angles: runtime.angles,
    numbers: runtime.numbers,
    getAngleValueDeg: runtime.getAngleValueDeg,
    getAnglePointNames: runtime.getAnglePointNames,
    getNumberValue: runtime.getNumberValue,
  });
  const expanded = expandInlineAngleCalls(exprRaw, runtime.resolvePointArg);
  if (!expanded.ok) return expanded;
  return evaluateAngleExpressionDegreesWithSymbols(expanded.expr, symbols);
}

export function evaluateNumberExpressionWithRuntime(
  exprRaw: string,
  runtime: {
    numbers: Array<{ id: string; name: string }>;
    getNumberValue: (numberId: string) => number | null;
    excludeNumberId?: string;
  }
): NumberExpressionEvalResult {
  const symbols = buildNumberSymbolTable({
    numbers: runtime.numbers,
    getNumberValue: runtime.getNumberValue,
    excludeNumberId: runtime.excludeNumberId,
  });
  return evaluateNumberExpressionWithSymbols(exprRaw, symbols);
}

function expandInlineAngleCalls(
  exprRaw: string,
  resolvePointArg?: (argExprRaw: string) => { ok: true; value: { x: number; y: number } } | { ok: false; error: string }
): { ok: true; expr: string } | { ok: false; error: string } {
  let out = "";
  let i = 0;
  while (i < exprRaw.length) {
    const ch = exprRaw[i];
    if (!/[A-Za-z_]/.test(ch)) {
      out += ch;
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < exprRaw.length && /[A-Za-z0-9_]/.test(exprRaw[j] ?? "")) j += 1;
    const name = exprRaw.slice(i, j);
    let k = j;
    while (k < exprRaw.length && /\s/.test(exprRaw[k] ?? "")) k += 1;
    if ((name !== "Angle" && name !== "angle") || exprRaw[k] !== "(") {
      out += exprRaw.slice(i, j);
      i = j;
      continue;
    }
    if (!resolvePointArg) return { ok: false, error: "Angle(...) is not supported in this context" };

    let depth = 0;
    let end = -1;
    for (let p = k; p < exprRaw.length; p += 1) {
      const cur = exprRaw[p];
      if (cur === "(") depth += 1;
      else if (cur === ")") {
        depth -= 1;
        if (depth === 0) {
          end = p;
          break;
        }
      }
    }
    if (end === -1) return { ok: false, error: "Angle(...) is missing a closing ')'" };
    const argsRaw = exprRaw.slice(k + 1, end);
    const args = splitCallArgs(argsRaw);
    if (!args || args.length !== 3) return { ok: false, error: "Angle(...) expects 3 point arguments" };
    const a = resolvePointArg(args[0]);
    if (!a.ok) return a;
    const b = resolvePointArg(args[1]);
    if (!b.ok) return b;
    const c = resolvePointArg(args[2]);
    if (!c.ok) return c;
    const theta = computeOrientedAngleRad(a.value, b.value, c.value);
    if (theta === null) return { ok: false, error: "Angle(...) is undefined for coincident points" };
    out += formatAngleValue((theta * 180) / Math.PI);
    i = end + 1;
  }
  return { ok: true, expr: out };
}

function splitCallArgs(raw: string): string[] | null {
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
  return args.some((arg) => arg.length === 0) ? null : args;
}

function formatAngleValue(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) < 1e-12) return "0";
  return String(Number.parseFloat(value.toPrecision(12)));
}
