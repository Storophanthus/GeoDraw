import { add, mul, sub } from "../../geo/geometry";
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
