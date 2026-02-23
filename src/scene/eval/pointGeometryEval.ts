import { add, lineLineIntersection, mul, sub } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import { clamp } from "./intersectionUtils";

export function evalMidpoint(pa: Vec2, pb: Vec2): Vec2 {
  return { x: (pa.x + pb.x) * 0.5, y: (pa.y + pb.y) * 0.5 };
}

export function evalPointOnLine(anchors: { a: Vec2; b: Vec2 }, s: number): Vec2 {
  return add(anchors.a, mul(sub(anchors.b, anchors.a), s));
}

export function evalPointOnSegment(a: Vec2, b: Vec2, u: number): Vec2 {
  return add(a, mul(sub(b, a), clamp(u, 0, 1)));
}

export function evalPointOnCircle(center: Vec2, radius: number, t: number): Vec2 {
  return {
    x: center.x + Math.cos(t) * radius,
    y: center.y + Math.sin(t) * radius,
  };
}

export function evalPointByRotation(center: Vec2, base: Vec2, angleDeg: number, direction: "CCW" | "CW"): Vec2 | null {
  const vx = base.x - center.x;
  const vy = base.y - center.y;
  const len = Math.hypot(vx, vy);
  if (len <= 1e-12) return null;
  const sign = direction === "CCW" ? 1 : -1;
  const theta = (angleDeg * Math.PI) / 180;
  const c = Math.cos(sign * theta);
  const s = Math.sin(sign * theta);
  return {
    x: center.x + vx * c - vy * s,
    y: center.y + vx * s + vy * c,
  };
}

export function evalPointByTranslation(point: Vec2, from: Vec2, to: Vec2): Vec2 {
  return add(point, sub(to, from));
}

export function evalPointByTranslationVector(point: Vec2, vector: Vec2): Vec2 {
  return add(point, vector);
}

export function evalPointByDilation(point: Vec2, center: Vec2, factor: number): Vec2 | null {
  if (!Number.isFinite(factor)) return null;
  return add(center, mul(sub(point, center), factor));
}

export function evalPointByReflection(point: Vec2, axisA: Vec2, axisB: Vec2): Vec2 | null {
  const dx = axisB.x - axisA.x;
  const dy = axisB.y - axisA.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return null;
  const tx = point.x - axisA.x;
  const ty = point.y - axisA.y;
  const t = (tx * dx + ty * dy) / lenSq;
  const projX = axisA.x + t * dx;
  const projY = axisA.y + t * dy;
  return { x: 2 * projX - point.x, y: 2 * projY - point.y };
}

function triangleArea2(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function evalTriangleCentroid(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

export function evalTriangleIncenter(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  if (Math.abs(triangleArea2(a, b, c)) <= 1e-12) return null;
  const wa = Math.hypot(c.x - b.x, c.y - b.y);
  const wb = Math.hypot(c.x - a.x, c.y - a.y);
  const wc = Math.hypot(b.x - a.x, b.y - a.y);
  const sum = wa + wb + wc;
  if (!(sum > 1e-12) || !Number.isFinite(sum)) return null;
  return {
    x: (wa * a.x + wb * b.x + wc * c.x) / sum,
    y: (wa * a.y + wb * b.y + wc * c.y) / sum,
  };
}

export function evalTriangleOrthocenter(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  if (Math.abs(triangleArea2(a, b, c)) <= 1e-12) return null;
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const ac = { x: c.x - a.x, y: c.y - a.y };
  if (Math.hypot(bc.x, bc.y) <= 1e-12 || Math.hypot(ac.x, ac.y) <= 1e-12) return null;
  const altA2 = { x: a.x - bc.y, y: a.y + bc.x };
  const altB2 = { x: b.x - ac.y, y: b.y + ac.x };
  return lineLineIntersection(a, altA2, b, altB2);
}
