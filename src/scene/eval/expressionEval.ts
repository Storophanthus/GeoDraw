import { parseNumericExpression, type NumberExpressionEvalResult } from "./numericExpression";

export type AngleExpressionEvalResult = { ok: true; valueDeg: number } | { ok: false; error: string };

type SymbolNumber = { id: string; name: string };

type AngleSymbolSource = {
  angles: Array<{ id: string; aId: string; bId: string; cId: string; labelText: string }>;
  numbers: SymbolNumber[];
  getAngleValueDeg: (angleId: string) => number | null;
  getAnglePointNames: (angleId: string) => { aName: string; bName: string; cName: string } | null;
  getNumberValue: (numberId: string) => number | null;
};

type NumberSymbolSource = {
  numbers: SymbolNumber[];
  getNumberValue: (numberId: string) => number | null;
  excludeNumberId?: string;
};

function registerSymbol(map: Map<string, number>, key: string, value: number): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
  if (map.has(key)) return;
  map.set(key, value);
}

function normalizeAngleLabelSymbol(labelRaw: string): string | null {
  let s = labelRaw.trim();
  if (s.startsWith("$") && s.endsWith("$") && s.length >= 2) s = s.slice(1, -1).trim();
  if (/^\\[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s.slice(1);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s;
  return null;
}

export function buildAngleSymbolTable(source: AngleSymbolSource): Map<string, number> {
  const map = new Map<string, number>();
  const angles = [...source.angles].sort((a, b) => a.id.localeCompare(b.id));
  for (const angle of angles) {
    const deg = source.getAngleValueDeg(angle.id);
    if (deg === null || !Number.isFinite(deg)) continue;

    registerSymbol(map, angle.id, deg);
    registerSymbol(map, `angle_${angle.id}`, deg);

    const names = source.getAnglePointNames(angle.id);
    if (names) {
      registerSymbol(map, `${names.aName}${names.bName}${names.cName}`, deg);
    }

    const label = angle.labelText.trim();
    if (label) {
      const normalized = normalizeAngleLabelSymbol(label);
      if (normalized) {
        registerSymbol(map, normalized, deg);
        registerSymbol(map, normalized.toLowerCase(), deg);
      }
    }
  }

  registerSymbol(map, "pi", 180);
  registerSymbol(map, "tau", 360);

  const numbers = [...source.numbers].sort((a, b) => a.id.localeCompare(b.id));
  for (const num of numbers) {
    const value = source.getNumberValue(num.id);
    if (value === null || !Number.isFinite(value)) continue;
    registerSymbol(map, num.id, value);
    registerSymbol(map, `num_${num.id}`, value);
    registerSymbol(map, num.name, value);
    registerSymbol(map, num.name.toLowerCase(), value);
  }

  return map;
}

export function buildNumberSymbolTable(source: NumberSymbolSource): Map<string, number> {
  const map = new Map<string, number>();
  const numbers = [...source.numbers].sort((a, b) => a.id.localeCompare(b.id));
  for (const num of numbers) {
    if (source.excludeNumberId && num.id === source.excludeNumberId) continue;
    const value = source.getNumberValue(num.id);
    if (value === null || !Number.isFinite(value)) continue;
    registerSymbol(map, num.id, value);
    registerSymbol(map, `num_${num.id}`, value);
    registerSymbol(map, num.name, value);
    registerSymbol(map, num.name.toLowerCase(), value);
  }
  registerSymbol(map, "pi", Math.PI);
  registerSymbol(map, "tau", Math.PI * 2);
  return map;
}

export function evaluateAngleExpressionDegreesWithSymbols(
  exprRaw: string,
  symbols: Map<string, number>
): AngleExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty angle expression." };
  const parsed = parseNumericExpression(expr, symbols);
  if (!parsed.ok) return parsed;
  if (!Number.isFinite(parsed.value)) return { ok: false, error: "Angle expression is not finite." };
  if (parsed.value < 0 || parsed.value > 360) {
    return { ok: false, error: "Angle expression must evaluate to [0, 360] degrees." };
  }
  return { ok: true, valueDeg: parsed.value };
}

export function evaluateNumberExpressionWithSymbols(
  exprRaw: string,
  symbols: Map<string, number>
): NumberExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty number expression." };
  const parsed = parseNumericExpression(expr, symbols);
  if (!parsed.ok) return parsed;
  if (!Number.isFinite(parsed.value)) return { ok: false, error: "Number expression is not finite." };
  return { ok: true, value: parsed.value };
}
