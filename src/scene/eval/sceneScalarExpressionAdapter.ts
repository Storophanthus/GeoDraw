import type { Vec2 } from "../../geo/vec2";
import { buildNumberSymbolTable } from "./expressionEval";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { evaluateScalarExpressionWithRuntime } from "./scalarExpressionRuntime";
import type { ScalarDistanceArg } from "./scalarDistance";

type SceneNumberLike = { id: string; name: string };
type ScenePointLike = { id: string; name: string };
type SceneLineLikeMeta = { id: string; labelText?: string };
type SceneSegmentLikeMeta = { id: string; aId: string; bId: string; labelText?: string };
type SceneCircleLikeMeta = { id: string; labelText?: string };
type ScenePolygonLikeMeta = { id: string; pointIds: string[]; labelText?: string };

export function evaluateSceneScalarNumberExpression(params: {
  exprRaw: string;
  numbers: SceneNumberLike[];
  points: ScenePointLike[];
  lines: SceneLineLikeMeta[];
  segments: SceneSegmentLikeMeta[];
  circles: SceneCircleLikeMeta[];
  polygons: ScenePolygonLikeMeta[];
  excludeNumberId?: string;
  getNumberValue: (numberId: string) => number | null;
  getPointWorldById: (pointId: string) => Vec2 | null;
  resolveLineAnchors: (lineId: string) => { a: Vec2; b: Vec2 } | null;
  getCircleWorldGeometry: (circleId: string) => { center: Vec2; radius: number } | null;
}): NumberExpressionEvalResult {
  const scalarSymbols = buildNumberSymbolTable({
    numbers: params.numbers,
    getNumberValue: params.getNumberValue,
    excludeNumberId: params.excludeNumberId,
  });
  return evaluateScalarExpressionWithRuntime(params.exprRaw, {
    getScalarValue: (name) => scalarSymbols.get(name),
    resolveDistanceArg: (argExprRaw) =>
      resolveSceneDistanceArg(argExprRaw, {
        points: params.points,
        lines: params.lines,
        segments: params.segments,
        getPointWorldById: params.getPointWorldById,
        resolveLineAnchors: params.resolveLineAnchors,
      }),
    evaluateAreaArg: (argExprRaw) =>
      evaluateSceneMeasureArg("Area", argExprRaw, {
        circles: params.circles,
        polygons: params.polygons,
        getCircleWorldGeometry: params.getCircleWorldGeometry,
        getPointWorldById: params.getPointWorldById,
      }),
    evaluatePerimeterArg: (argExprRaw) =>
      evaluateSceneMeasureArg("Perimeter", argExprRaw, {
        circles: params.circles,
        polygons: params.polygons,
        getCircleWorldGeometry: params.getCircleWorldGeometry,
        getPointWorldById: params.getPointWorldById,
      }),
  });
}

function resolveSceneDistanceArg(
  raw: string,
  deps: {
    points: ScenePointLike[];
    lines: SceneLineLikeMeta[];
    segments: SceneSegmentLikeMeta[];
    getPointWorldById: (pointId: string) => Vec2 | null;
    resolveLineAnchors: (lineId: string) => { a: Vec2; b: Vec2 } | null;
  }
): { ok: true; value: ScalarDistanceArg } | { ok: false; error: string } {
  const token = stripOuterParens(raw.trim());
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
    return { ok: false, error: "Distance(...) in numeric expressions expects point/line/segment identifiers" };
  }

  const point = deps.points.find((p) => p.name === token) ?? deps.points.find((p) => p.id === token);
  if (point) {
    const world = deps.getPointWorldById(point.id);
    if (!world) return { ok: false, error: `Unknown point geometry: ${token}` };
    return { ok: true, value: { kind: "point", x: world.x, y: world.y } };
  }

  const line = deps.lines.find((l) => l.id === token) ?? deps.lines.find((l) => (l.labelText?.trim() || "") === token);
  if (line) {
    const anchors = deps.resolveLineAnchors(line.id);
    if (!anchors) return { ok: false, error: `Unknown line geometry: ${token}` };
    return { ok: true, value: { kind: "lineLike", a: anchors.a, b: anchors.b, finite: false } };
  }

  const seg =
    deps.segments.find((s) => s.id === token) ??
    deps.segments.find((s) => (s.labelText?.trim() || "") === token);
  if (seg) {
    const a = deps.getPointWorldById(seg.aId);
    const b = deps.getPointWorldById(seg.bId);
    if (!a || !b) return { ok: false, error: `Unknown segment geometry: ${token}` };
    return { ok: true, value: { kind: "lineLike", a, b, finite: true } };
  }

  return { ok: false, error: `Unknown object in Distance(...): ${token}` };
}

function evaluateSceneMeasureArg(
  fnName: "Area" | "Perimeter",
  raw: string,
  deps: {
    circles: SceneCircleLikeMeta[];
    polygons: ScenePolygonLikeMeta[];
    getCircleWorldGeometry: (circleId: string) => { center: Vec2; radius: number } | null;
    getPointWorldById: (pointId: string) => Vec2 | null;
  }
): NumberExpressionEvalResult {
  const token = stripOuterParens(raw.trim());
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
    return { ok: false, error: `${fnName}(...) expects a circle/polygon identifier` };
  }

  const circle = deps.circles.find((c) => c.id === token) ?? deps.circles.find((c) => (c.labelText?.trim() || "") === token);
  if (circle) {
    const geom = deps.getCircleWorldGeometry(circle.id);
    if (!geom || !Number.isFinite(geom.radius) || !(geom.radius >= 0)) {
      return { ok: false, error: `Unknown circle geometry: ${token}` };
    }
    const value = fnName === "Area" ? Math.PI * geom.radius * geom.radius : 2 * Math.PI * geom.radius;
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: `${fnName} result is not finite` };
  }

  const polygon =
    deps.polygons.find((p) => p.id === token) ?? deps.polygons.find((p) => (p.labelText?.trim() || "") === token);
  if (polygon) {
    if (polygon.pointIds.length < 3) return { ok: false, error: `Invalid polygon: ${token}` };
    const verts: Vec2[] = [];
    for (const pointId of polygon.pointIds) {
      const w = deps.getPointWorldById(pointId);
      if (!w) return { ok: false, error: `Unknown polygon geometry: ${token}` };
      verts.push(w);
    }
    const value = fnName === "Area" ? polygonAreaAbs(verts) : polygonPerimeter(verts);
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: `${fnName} result is not finite` };
  }

  return { ok: false, error: `Unknown object in ${fnName}(...): ${token}` };
}

function polygonAreaAbs(verts: Vec2[]): number {
  let twiceArea = 0;
  for (let i = 0; i < verts.length; i += 1) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    twiceArea += a.x * b.y - a.y * b.x;
  }
  return Math.abs(twiceArea) * 0.5;
}

function polygonPerimeter(verts: Vec2[]): number {
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
