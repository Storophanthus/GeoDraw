import { distance } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import { computeOrientedAngleRad } from "./angleMath";
import type { GeometryObjectRef, LineLikeObjectRef, SceneAngle, SceneCircle, SceneLine } from "../points";

type SegmentRef = { aId: string; bId: string };

type GeometryResolveOps = {
  getPointWorldById: (id: string) => Vec2 | null;
  getLineById: (id: string) => SceneLine | null;
  getSegmentById: (id: string) => SegmentRef | null;
  getCircleById: (id: string) => SceneCircle | null;
  getAngleById: (id: string) => SceneAngle | null;
  evaluateCircleRadiusExpr: (expr: string) => number | null;
  lineInProgress: Set<string>;
};

export function resolveLineAnchorsWithOps(
  line: SceneLine,
  ops: GeometryResolveOps
): { a: Vec2; b: Vec2 } | null {
  if (ops.lineInProgress.has(line.id)) return null;
  ops.lineInProgress.add(line.id);
  try {
    if (line.kind === "tangent") {
      const through = ops.getPointWorldById(line.throughId);
      const circle = ops.getCircleById(line.circleId);
      if (!through || !circle) return null;
      const geom = getCircleWorldGeometryWithOps(circle, ops);
      if (!geom) return null;
      const vx = through.x - geom.center.x;
      const vy = through.y - geom.center.y;
      const d2 = vx * vx + vy * vy;
      const r2 = geom.radius * geom.radius;
      if (d2 <= 1e-12) return null;
      const eps = 1e-10;
      if (d2 < r2 - eps) return null;
      const k = r2 / d2;
      const perp = { x: -vy, y: vx };
      if (Math.abs(d2 - r2) <= eps) {
        return {
          a: through,
          b: {
            x: through.x + perp.x,
            y: through.y + perp.y,
          },
        };
      }
      const h = (geom.radius * Math.sqrt(Math.max(0, d2 - r2))) / d2;
      const sign = line.branchIndex === 0 ? 1 : -1;
      const tx = geom.center.x + k * vx + sign * h * perp.x;
      const ty = geom.center.y + k * vy + sign * h * perp.y;
      return {
        a: through,
        b: { x: tx, y: ty },
      };
    }

    if (line.kind !== "perpendicular" && line.kind !== "parallel" && line.kind !== "angleBisector") {
      const a = ops.getPointWorldById(line.aId);
      const b = ops.getPointWorldById(line.bId);
      if (!a || !b) return null;
      return { a, b };
    }

    if (line.kind === "angleBisector") {
      const a = ops.getPointWorldById(line.aId);
      const b = ops.getPointWorldById(line.bId);
      const c = ops.getPointWorldById(line.cId);
      if (!a || !b || !c) return null;
      const ba = { x: a.x - b.x, y: a.y - b.y };
      const bc = { x: c.x - b.x, y: c.y - b.y };
      const baLen = Math.hypot(ba.x, ba.y);
      const bcLen = Math.hypot(bc.x, bc.y);
      if (baLen <= 1e-12 || bcLen <= 1e-12) return null;
      const u = { x: ba.x / baLen, y: ba.y / baLen };
      const v = { x: bc.x / bcLen, y: bc.y / bcLen };
      const bis = { x: u.x + v.x, y: u.y + v.y };
      const bisLen = Math.hypot(bis.x, bis.y);
      if (bisLen <= 1e-12) return null;
      return {
        a: b,
        b: {
          x: b.x + bis.x,
          y: b.y + bis.y,
        },
      };
    }

    const through = ops.getPointWorldById(line.throughId);
    if (!through) return null;
    const base = resolveLineLikeRefAnchorsWithOps(line.base, ops);
    if (!base) return null;
    const dx = base.b.x - base.a.x;
    const dy = base.b.y - base.a.y;
    if (dx * dx + dy * dy <= 1e-12) return null;
    if (line.kind === "parallel") {
      return {
        a: through,
        b: {
          x: through.x + dx,
          y: through.y + dy,
        },
      };
    }
    return {
      a: through,
      b: {
        x: through.x - dy,
        y: through.y + dx,
      },
    };
  } finally {
    ops.lineInProgress.delete(line.id);
  }
}

export function resolveLineLikeRefAnchorsWithOps(
  ref: LineLikeObjectRef,
  ops: GeometryResolveOps
): { a: Vec2; b: Vec2 } | null {
  if (ref.type === "segment") {
    const seg = ops.getSegmentById(ref.id);
    if (!seg) return null;
    const a = ops.getPointWorldById(seg.aId);
    const b = ops.getPointWorldById(seg.bId);
    if (!a || !b) return null;
    return { a, b };
  }
  const line = ops.getLineById(ref.id);
  if (!line) return null;
  return resolveLineAnchorsWithOps(line, ops);
}

export function getCircleWorldGeometryWithOps(
  circle: SceneCircle,
  ops: GeometryResolveOps
): { center: Vec2; radius: number } | null {
  if (circle.kind === "threePoint") {
    const a = ops.getPointWorldById(circle.aId);
    const b = ops.getPointWorldById(circle.bId);
    const c = ops.getPointWorldById(circle.cId);
    if (!a || !b || !c) return null;
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) <= 1e-12) return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    const center = {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    };
    const radius = distance(center, a);
    if (!Number.isFinite(radius) || radius <= 1e-12) return null;
    return { center, radius };
  }

  const center = ops.getPointWorldById(circle.centerId);
  if (!center) return null;
  if (circle.kind === "fixedRadius") {
    let radius = circle.radius;
    if (circle.radiusExpr && circle.radiusExpr.trim().length > 0) {
      const evaluated = ops.evaluateCircleRadiusExpr(circle.radiusExpr.trim());
      if (evaluated === null || !Number.isFinite(evaluated) || evaluated <= 1e-12) return null;
      radius = evaluated;
    }
    if (!Number.isFinite(radius) || radius <= 1e-12) return null;
    return { center, radius };
  }

  const through = ops.getPointWorldById(circle.throughId);
  if (!through) return null;
  const radius = distance(center, through);
  if (!Number.isFinite(radius) || radius <= 1e-12) return null;
  return { center, radius };
}

export function asLineLikeWithOps(
  ref: GeometryObjectRef,
  ops: GeometryResolveOps
): { a: Vec2; b: Vec2; finite: boolean } | null {
  if (ref.type === "line") {
    const line = ops.getLineById(ref.id);
    if (!line) return null;
    const anchors = resolveLineAnchorsWithOps(line, ops);
    if (!anchors) return null;
    return { a: anchors.a, b: anchors.b, finite: false };
  }

  if (ref.type === "segment") {
    const seg = ops.getSegmentById(ref.id);
    if (!seg) return null;
    const a = ops.getPointWorldById(seg.aId);
    const b = ops.getPointWorldById(seg.bId);
    if (!a || !b) return null;
    return { a, b, finite: true };
  }

  return null;
}

export function asCircleWithOps(
  ref: GeometryObjectRef,
  ops: GeometryResolveOps
): { center: Vec2; radius: number } | null {
  if (ref.type !== "circle") return null;
  const circle = ops.getCircleById(ref.id);
  if (!circle) return null;
  return getCircleWorldGeometryWithOps(circle, ops);
}

export function asSectorArcWithOps(
  ref: GeometryObjectRef,
  ops: GeometryResolveOps
): { center: Vec2; radius: number; start: number; sweep: number } | null {
  if (ref.type !== "angle") return null;
  const angle = ops.getAngleById(ref.id);
  if (!angle || angle.kind !== "sector") return null;
  const a = ops.getPointWorldById(angle.aId);
  const b = ops.getPointWorldById(angle.bId);
  const c = ops.getPointWorldById(angle.cId);
  if (!a || !b || !c) return null;
  const radius = distance(a, b);
  if (!Number.isFinite(radius) || radius <= 1e-12) return null;
  const sweep = computeOrientedAngleRad(a, b, c);
  if (sweep === null) return null;
  const start = Math.atan2(a.y - b.y, a.x - b.x);
  return { center: b, radius, start, sweep };
}
