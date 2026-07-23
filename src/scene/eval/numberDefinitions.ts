import type { Vec2 } from "../../geo/vec2";
import type { SceneNumberDefinition } from "../points";

type SegmentRef = { aId: string; bId: string };
type AngleRef = { aId: string; bId: string; cId: string };

type EvalNumberDefinitionOps = {
  getPointWorldById: (id: string) => Vec2 | null;
  getSegmentById: (id: string) => SegmentRef | null;
  getPolygonPointIdsById: (id: string) => string[] | null;
  getCircleRadiusById: (id: string) => number | null;
  getAngleById: (id: string) => AngleRef | null;
  evaluateNumberExpression: (expr: string, excludeNumberId?: string) => number | null;
  evalNumberById: (id: string) => number | null;
  computeOrientedAngleRad: (a: Vec2, b: Vec2, c: Vec2) => number | null;
  distance: (a: Vec2, b: Vec2) => number;
};

export function evalNumberDefinitionWithOps(
  def: SceneNumberDefinition,
  ops: EvalNumberDefinitionOps,
  selfNumberId?: string
): number | null {
  if (def.kind === "constant") {
    return Number.isFinite(def.value) ? def.value : null;
  }

  if (def.kind === "slider") {
    if (!Number.isFinite(def.value) || !Number.isFinite(def.min) || !Number.isFinite(def.max) || !Number.isFinite(def.step)) {
      return null;
    }
    if (def.step <= 0) return null;
    const lo = Math.min(def.min, def.max);
    const hi = Math.max(def.min, def.max);
    const clamped = Math.min(hi, Math.max(lo, def.value));
    return clamped;
  }

  if (def.kind === "distancePoints") {
    const a = ops.getPointWorldById(def.aId);
    const b = ops.getPointWorldById(def.bId);
    if (!a || !b) return null;
    return ops.distance(a, b);
  }

  if (def.kind === "segmentLength") {
    const seg = ops.getSegmentById(def.segId);
    if (!seg) return null;
    const a = ops.getPointWorldById(seg.aId);
    const b = ops.getPointWorldById(seg.bId);
    if (!a || !b) return null;
    return ops.distance(a, b);
  }

  if (def.kind === "circleRadius" || def.kind === "circleArea") {
    const r = ops.getCircleRadiusById(def.circleId);
    if (r === null) return null;
    if (def.kind === "circleRadius") return r;
    return Math.PI * r * r;
  }

  if (def.kind === "polygonPerimeter" || def.kind === "polygonArea") {
    const pointIds = ops.getPolygonPointIdsById(def.polygonId);
    if (!pointIds || pointIds.length < 3) return null;
    const vertices: Vec2[] = [];
    for (const pointId of pointIds) {
      const world = ops.getPointWorldById(pointId);
      if (!world) return null;
      vertices.push(world);
    }
    if (def.kind === "polygonPerimeter") return polygonPerimeter(vertices, ops.distance);
    return polygonArea(vertices);
  }

  if (def.kind === "angleDegrees") {
    const angle = ops.getAngleById(def.angleId);
    if (!angle) return null;
    const a = ops.getPointWorldById(angle.aId);
    const b = ops.getPointWorldById(angle.bId);
    const c = ops.getPointWorldById(angle.cId);
    if (!a || !b || !c) return null;
    const theta = ops.computeOrientedAngleRad(a, b, c);
    if (theta === null) return null;
    return (theta * 180) / Math.PI;
  }

  if (def.kind === "expression") {
    return ops.evaluateNumberExpression(def.expr, selfNumberId);
  }

  const num = ops.evalNumberById(def.numeratorId);
  const den = ops.evalNumberById(def.denominatorId);
  if (num === null || den === null) return null;
  if (Math.abs(den) <= 1e-12) return null;
  return num / den;
}

function polygonPerimeter(vertices: Vec2[], distance: (a: Vec2, b: Vec2) => number): number {
  let total = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    total += distance(vertices[i], vertices[(i + 1) % vertices.length]);
  }
  return total;
}

function polygonArea(vertices: Vec2[]): number {
  let twiceArea = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}
