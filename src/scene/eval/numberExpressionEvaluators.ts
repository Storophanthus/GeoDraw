import type { AngleExpressionEvalResult } from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";
import {
  evaluateAngleExpressionWithRuntime,
  evaluateNumberExpressionWithRuntime,
} from "./expressionRuntime";

export function evaluateAngleExpressionDegreesWithCtxInScene(
  exprRaw: string,
  sceneData: {
    points: Array<{ id: string; name: string }>;
    angles: Array<{
      id: string;
      aId: string;
      bId: string;
      cId: string;
      labelText: string;
    }>;
    numbers: Array<{ id: string; name: string }>;
  },
  ops: {
    getAngleValueDeg: (angleId: string) => number | null;
    getAnglePointNames: (angleId: string) => { aName: string; bName: string; cName: string } | null;
    getNumberValue: (numberId: string) => number | null;
    getPointWorldById: (pointId: string) => { x: number; y: number } | null;
  }
): AngleExpressionEvalResult {
  return evaluateAngleExpressionWithRuntime(exprRaw, {
    angles: sceneData.angles,
    numbers: sceneData.numbers,
    getAngleValueDeg: ops.getAngleValueDeg,
    getAnglePointNames: ops.getAnglePointNames,
    getNumberValue: ops.getNumberValue,
    resolvePointArg: (argExprRaw) => {
      const token = stripOuterParens(argExprRaw.trim());
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
        return { ok: false, error: "Angle(...) expects point identifiers" };
      }
      const point = sceneData.points.find((p) => p.name === token) ?? sceneData.points.find((p) => p.id === token);
      if (!point) return { ok: false, error: `Unknown point: ${token}` };
      const world = ops.getPointWorldById(point.id);
      if (!world) return { ok: false, error: `Unknown point geometry: ${token}` };
      return { ok: true, value: world };
    },
  });
}

export function evaluateNumberExpressionWithCtxInScene(
  exprRaw: string,
  sceneData: {
    numbers: Array<{ id: string; name: string }>;
  },
  ops: {
    getNumberValue: (numberId: string) => number | null;
    excludeNumberId?: string;
  }
): NumberExpressionEvalResult {
  return evaluateNumberExpressionWithRuntime(exprRaw, {
    numbers: sceneData.numbers,
    getNumberValue: ops.getNumberValue,
    excludeNumberId: ops.excludeNumberId,
  });
}

function stripOuterParens(raw: string): string {
  let s = raw.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}
