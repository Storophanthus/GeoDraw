import type { MathNode } from "mathjs";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { evaluateScalarDistanceArgs, type ScalarDistanceArg } from "./scalarDistance";
import type { ScalarMeasureFunctionName } from "./scalarObjectMeasure";
import { computeOrientedAngleRad } from "./angleMath";
import {
  evalTriangleCircumradius,
  evalTriangleInradius,
  evalTrianglePerimeter,
} from "./pointGeometryEval";

type ScalarPointArg = { x: number; y: number };
type TriangleMetricName = "Perimeter" | "Inradius" | "Circumradius";

export type ScalarFunctionRuntimeAdapters = {
  resolveDistanceArg?: (argExprRaw: string) => { ok: true; value: ScalarDistanceArg } | { ok: false; error: string };
  resolvePointArg?: (argExprRaw: string) => { ok: true; value: ScalarPointArg } | { ok: false; error: string };
  evaluateMeasureArg?: (fnName: ScalarMeasureFunctionName, argExprRaw: string) => NumberExpressionEvalResult;
};

export type ScalarFunctionSpec =
  | {
      mode: "raw";
      eval: (args: MathNode[], adapters: ScalarFunctionRuntimeAdapters) => NumberExpressionEvalResult;
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

function rawFn(evalFn: (args: MathNode[], adapters: ScalarFunctionRuntimeAdapters) => NumberExpressionEvalResult): ScalarFunctionSpec {
  return { mode: "raw", eval: evalFn };
}

function evaluateTriangleMetricByPoints(
  fnName: TriangleMetricName,
  args: MathNode[],
  adapters: ScalarFunctionRuntimeAdapters
): NumberExpressionEvalResult {
  if (!adapters.resolvePointArg) return { ok: false, error: `${fnName}(...) is not supported in this context` };
  if (args.length !== 3) return { ok: false, error: `${fnName}(...) expects 3 point arguments` };
  const a = adapters.resolvePointArg(args[0].toString());
  if (!a.ok) return a;
  const b = adapters.resolvePointArg(args[1].toString());
  if (!b.ok) return b;
  const c = adapters.resolvePointArg(args[2].toString());
  if (!c.ok) return c;

  if (fnName === "Perimeter") {
    const value = evalTrianglePerimeter(a.value, b.value, c.value);
    if (value === null) return { ok: false, error: "Perimeter(...) arguments are invalid" };
    return { ok: true, value };
  }
  if (fnName === "Inradius") {
    const value = evalTriangleInradius(a.value, b.value, c.value);
    if (value === null) return { ok: false, error: "Inradius(...) is undefined for collinear points" };
    return { ok: true, value };
  }
  const value = evalTriangleCircumradius(a.value, b.value, c.value);
  if (value === null) return { ok: false, error: "Circumradius(...) is undefined for collinear points" };
  return { ok: true, value };
}

function evaluateAngleByPoints(
  args: MathNode[],
  adapters: ScalarFunctionRuntimeAdapters
): NumberExpressionEvalResult {
  if (!adapters.resolvePointArg) return { ok: false, error: "Angle(...) is not supported in this context" };
  if (args.length !== 3) return { ok: false, error: "Angle(...) expects 3 point arguments" };
  const a = adapters.resolvePointArg(args[0].toString());
  if (!a.ok) return a;
  const b = adapters.resolvePointArg(args[1].toString());
  if (!b.ok) return b;
  const c = adapters.resolvePointArg(args[2].toString());
  if (!c.ok) return c;
  const theta = computeOrientedAngleRad(a.value, b.value, c.value);
  if (theta === null) return { ok: false, error: "Angle(...) is undefined for coincident points" };
  return { ok: true, value: (theta * 180) / Math.PI };
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const SHARED_NUMERIC_SPECS = {
  sin: fixedNumericFn(1, (values) => Math.sin(values[0] ?? 0)),
  cos: fixedNumericFn(1, (values) => Math.cos(values[0] ?? 0)),
  tan: fixedNumericFn(1, (values) => Math.tan(values[0] ?? 0)),
  sind: fixedNumericFn(1, (values) => Math.sin((values[0] ?? 0) * DEG_TO_RAD)),
  cosd: fixedNumericFn(1, (values) => Math.cos((values[0] ?? 0) * DEG_TO_RAD)),
  tand: fixedNumericFn(1, (values) => Math.tan((values[0] ?? 0) * DEG_TO_RAD)),
  asin: fixedNumericFn(1, (values) => Math.asin(values[0] ?? 0)),
  acos: fixedNumericFn(1, (values) => Math.acos(values[0] ?? 0)),
  atan: fixedNumericFn(1, (values) => Math.atan(values[0] ?? 0)),
  atan2: fixedNumericFn(2, (values) => Math.atan2(values[0] ?? 0, values[1] ?? 0)),
  asind: fixedNumericFn(1, (values) => Math.asin(values[0] ?? 0) * RAD_TO_DEG),
  acosd: fixedNumericFn(1, (values) => Math.acos(values[0] ?? 0) * RAD_TO_DEG),
  atand: fixedNumericFn(1, (values) => Math.atan(values[0] ?? 0) * RAD_TO_DEG),
  atan2d: fixedNumericFn(2, (values) => Math.atan2(values[0] ?? 0, values[1] ?? 0) * RAD_TO_DEG),
  sqrt: fixedNumericFn(1, (values) => Math.sqrt(values[0] ?? 0)),
  abs: fixedNumericFn(1, (values) => Math.abs(values[0] ?? 0)),
  min: variadicNumericFn(1, (values) => Math.min(...values)),
  max: variadicNumericFn(1, (values) => Math.max(...values)),
  pow: fixedNumericFn(2, (values) => Math.pow(values[0] ?? 0, values[1] ?? 0)),
} as const;

const FUNCTION_REGISTRY = new Map<string, ScalarFunctionSpec>([
  [
    "Distance",
    rawFn((args, adapters) => {
      if (!adapters.resolveDistanceArg) return { ok: false, error: "Distance(...) is not supported in this context" };
      if (args.length !== 2) return { ok: false, error: "Distance(...) expects 2 arguments" };
      const left = adapters.resolveDistanceArg(args[0].toString());
      if (!left.ok) return left;
      const right = adapters.resolveDistanceArg(args[1].toString());
      if (!right.ok) return right;
      return evaluateScalarDistanceArgs(left.value, right.value);
    }),
  ],
  [
    "Area",
    rawFn((args, adapters) => {
      if (!adapters.evaluateMeasureArg) return { ok: false, error: "Area(...) is not supported in this context" };
      if (args.length !== 1) return { ok: false, error: "Area(...) expects 1 argument" };
      return adapters.evaluateMeasureArg("Area", args[0].toString());
    }),
  ],
  [
    "Perimeter",
    rawFn((args, adapters) => {
      if (args.length === 1) {
        if (!adapters.evaluateMeasureArg) return { ok: false, error: "Perimeter(...) is not supported in this context" };
        return adapters.evaluateMeasureArg("Perimeter", args[0].toString());
      }
      return evaluateTriangleMetricByPoints("Perimeter", args, adapters);
    }),
  ],
  [
    "Inradius",
    rawFn((args, adapters) => evaluateTriangleMetricByPoints("Inradius", args, adapters)),
  ],
  [
    "Circumradius",
    rawFn((args, adapters) => evaluateTriangleMetricByPoints("Circumradius", args, adapters)),
  ],
  ["Angle", rawFn((args, adapters) => evaluateAngleByPoints(args, adapters))],
  ["angle", rawFn((args, adapters) => evaluateAngleByPoints(args, adapters))],
  ["sin", SHARED_NUMERIC_SPECS.sin],
  ["Sin", SHARED_NUMERIC_SPECS.sin],
  ["cos", SHARED_NUMERIC_SPECS.cos],
  ["Cos", SHARED_NUMERIC_SPECS.cos],
  ["tan", SHARED_NUMERIC_SPECS.tan],
  ["Tan", SHARED_NUMERIC_SPECS.tan],
  ["sind", SHARED_NUMERIC_SPECS.sind],
  ["Sind", SHARED_NUMERIC_SPECS.sind],
  ["cosd", SHARED_NUMERIC_SPECS.cosd],
  ["Cosd", SHARED_NUMERIC_SPECS.cosd],
  ["tand", SHARED_NUMERIC_SPECS.tand],
  ["Tand", SHARED_NUMERIC_SPECS.tand],
  ["asin", SHARED_NUMERIC_SPECS.asin],
  ["Asin", SHARED_NUMERIC_SPECS.asin],
  ["acos", SHARED_NUMERIC_SPECS.acos],
  ["Acos", SHARED_NUMERIC_SPECS.acos],
  ["atan", SHARED_NUMERIC_SPECS.atan],
  ["Atan", SHARED_NUMERIC_SPECS.atan],
  ["atan2", SHARED_NUMERIC_SPECS.atan2],
  ["Atan2", SHARED_NUMERIC_SPECS.atan2],
  ["asind", SHARED_NUMERIC_SPECS.asind],
  ["Asind", SHARED_NUMERIC_SPECS.asind],
  ["acosd", SHARED_NUMERIC_SPECS.acosd],
  ["Acosd", SHARED_NUMERIC_SPECS.acosd],
  ["atand", SHARED_NUMERIC_SPECS.atand],
  ["Atand", SHARED_NUMERIC_SPECS.atand],
  ["atan2d", SHARED_NUMERIC_SPECS.atan2d],
  ["Atan2d", SHARED_NUMERIC_SPECS.atan2d],
  ["sqrt", SHARED_NUMERIC_SPECS.sqrt],
  ["abs", SHARED_NUMERIC_SPECS.abs],
  ["min", SHARED_NUMERIC_SPECS.min],
  ["max", SHARED_NUMERIC_SPECS.max],
  ["pow", SHARED_NUMERIC_SPECS.pow],
]);

export function getScalarFunctionSpec(fnName: string): ScalarFunctionSpec | undefined {
  return FUNCTION_REGISTRY.get(fnName);
}

export function listRegisteredScalarFunctionNames(): string[] {
  return [...FUNCTION_REGISTRY.keys()].sort((a, b) => a.localeCompare(b));
}

export function evaluateRegisteredScalarFunctionCall(params: {
  fnName: string;
  args: MathNode[];
  adapters: ScalarFunctionRuntimeAdapters;
  evalNumericArg: (arg: MathNode) => NumberExpressionEvalResult;
}): NumberExpressionEvalResult {
  const spec = FUNCTION_REGISTRY.get(params.fnName);
  if (!spec) return { ok: false, error: `Unsupported function: ${params.fnName || "unknown"}` };
  if (spec.mode === "raw") return spec.eval(params.args, params.adapters);

  if (params.args.length < spec.minArgs || (spec.maxArgs !== null && params.args.length > spec.maxArgs)) {
    return { ok: false, error: `Unsupported function: ${params.fnName || "unknown"}` };
  }
  const values: number[] = [];
  for (const arg of params.args) {
    const value = params.evalNumericArg(arg);
    if (!value.ok) return value;
    values.push(value.value);
  }
  const out = spec.eval(values);
  if (!Number.isFinite(out)) return { ok: false, error: `Function ${params.fnName} result is not finite` };
  return { ok: true, value: out };
}
