import type { NumberExpressionEvalResult } from "./numericExpression";

export type ScalarMeasureFunctionName = "Area" | "Perimeter";

export type ScalarMeasureCircleRef = { id: string; labelText?: string };
export type ScalarMeasurePolygonRef = { id: string; pointIds: string[]; labelText?: string };
export type ScalarMeasureVec2 = { x: number; y: number };

export function evaluateScalarObjectMeasureArg(
  fnName: ScalarMeasureFunctionName,
  raw: string,
  deps: {
    circles: ScalarMeasureCircleRef[];
    polygons: ScalarMeasurePolygonRef[];
    getCircleRadius: (circleId: string) => number | null;
    getPolygonVertices: (polygonId: string, pointIds: string[]) => ScalarMeasureVec2[] | null;
  }
): NumberExpressionEvalResult {
  const token = stripOuterParens(raw.trim());
  if (!IDENT_RE.test(token)) {
    return { ok: false, error: `${fnName}(...) expects a circle/polygon identifier` };
  }

  const circle =
    deps.circles.find((c) => c.id === token) ??
    deps.circles.find((c) => (c.labelText?.trim() || "") === token);
  if (circle) {
    const radius = deps.getCircleRadius(circle.id);
    if (typeof radius !== "number" || !Number.isFinite(radius) || !(radius >= 0)) {
      return { ok: false, error: `Unknown circle geometry: ${token}` };
    }
    const value = fnName === "Area" ? Math.PI * radius * radius : 2 * Math.PI * radius;
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: `${fnName} result is not finite` };
  }

  const polygon =
    deps.polygons.find((p) => p.id === token) ??
    deps.polygons.find((p) => (p.labelText?.trim() || "") === token);
  if (polygon) {
    if (polygon.pointIds.length < 3) return { ok: false, error: `Invalid polygon: ${token}` };
    const verts = deps.getPolygonVertices(polygon.id, polygon.pointIds);
    if (!verts || verts.length < 3) return { ok: false, error: `Unknown polygon geometry: ${token}` };
    const value = fnName === "Area" ? polygonAreaAbs(verts) : polygonPerimeter(verts);
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: `${fnName} result is not finite` };
  }

  return { ok: false, error: `Unknown object in ${fnName}(...): ${token}` };
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function polygonAreaAbs(verts: ScalarMeasureVec2[]): number {
  let twiceArea = 0;
  for (let i = 0; i < verts.length; i += 1) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    twiceArea += a.x * b.y - a.y * b.x;
  }
  return Math.abs(twiceArea) * 0.5;
}

function polygonPerimeter(verts: ScalarMeasureVec2[]): number {
  let sum = 0;
  for (let i = 0; i < verts.length; i += 1) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

function findMatchingParenIndex(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

function stripOuterParens(text: string): string {
  let s = text.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    const close = findMatchingParenIndex(s, 0);
    if (close !== s.length - 1) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}
