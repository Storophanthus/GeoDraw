import {
  buildAngleSymbolTable,
  buildNumberSymbolTable,
  evaluateAngleExpressionDegreesWithSymbols,
  evaluateNumberExpressionWithSymbols,
  type AngleExpressionEvalResult,
} from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";

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
  }
): AngleExpressionEvalResult {
  const symbols = buildAngleSymbolTable({
    angles: runtime.angles,
    numbers: runtime.numbers,
    getAngleValueDeg: runtime.getAngleValueDeg,
    getAnglePointNames: runtime.getAnglePointNames,
    getNumberValue: runtime.getNumberValue,
  });
  return evaluateAngleExpressionDegreesWithSymbols(exprRaw, symbols);
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

