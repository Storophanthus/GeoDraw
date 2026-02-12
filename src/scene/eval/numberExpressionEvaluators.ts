import type { AngleExpressionEvalResult } from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";
import {
  evaluateAngleExpressionWithRuntime,
  evaluateNumberExpressionWithRuntime,
} from "./expressionRuntime";

export function evaluateAngleExpressionDegreesWithCtxInScene(
  exprRaw: string,
  sceneData: {
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
  }
): AngleExpressionEvalResult {
  return evaluateAngleExpressionWithRuntime(exprRaw, {
    angles: sceneData.angles,
    numbers: sceneData.numbers,
    getAngleValueDeg: ops.getAngleValueDeg,
    getAnglePointNames: ops.getAnglePointNames,
    getNumberValue: ops.getNumberValue,
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
