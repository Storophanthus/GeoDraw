import type { Vec2 } from "../../geo/vec2";
import type { SceneNumberDefinition } from "../points";

type SegmentRef = { aId: string; bId: string };
type AngleRef = { aId: string; bId: string; cId: string };

type EvalNumberDefinitionOps = {
  getPointWorldById: (id: string) => Vec2 | null;
  getSegmentById: (id: string) => SegmentRef | null;
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
