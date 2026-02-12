import type { Vec2 } from "../../geo/vec2";

export const RIGHT_ANGLE_EPS = 1e-6;

export function computeConvexAngleRad(a: Vec2, b: Vec2, c: Vec2): number | null {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const baLen = Math.hypot(bax, bay);
  const bcLen = Math.hypot(bcx, bcy);
  if (baLen <= 1e-12 || bcLen <= 1e-12) return null;
  const dot = (bax * bcx + bay * bcy) / (baLen * bcLen);
  const clamped = Math.max(-1, Math.min(1, dot));
  return Math.acos(clamped);
}

export function computeOrientedAngleRad(a: Vec2, b: Vec2, c: Vec2): number | null {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const baLen = Math.hypot(bax, bay);
  const bcLen = Math.hypot(bcx, bcy);
  if (baLen <= 1e-12 || bcLen <= 1e-12) return null;
  const start = Math.atan2(bay, bax);
  const end = Math.atan2(bcy, bcx);
  let delta = end - start;
  while (delta < 0) delta += Math.PI * 2;
  while (delta >= Math.PI * 2) delta -= Math.PI * 2;
  return delta;
}

export function isRightAngle(a: Vec2, b: Vec2, c: Vec2, eps: number = RIGHT_ANGLE_EPS): boolean {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const baLen = Math.hypot(bax, bay);
  const bcLen = Math.hypot(bcx, bcy);
  if (baLen <= 1e-12 || bcLen <= 1e-12) return false;
  const dot = bax * bcx + bay * bcy;
  return Math.abs(dot) <= eps * baLen * bcLen;
}
