import type { Vec2 } from "./vec2";

const EPS = 1e-9;

export function projectPointToLine(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; s: number; distance: number } {
  const d = sub(b, a);
  const dd = dot(d, d);
  const s = dd <= EPS ? 0 : dot(sub(p, a), d) / dd;
  const point = add(a, mul(d, s));
  return { point, s, distance: length(sub(p, point)) };
}

export function projectPointToSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2
): { point: Vec2; u: number; distance: number } {
  const d = sub(b, a);
  const dd = dot(d, d);
  const uRaw = dd <= EPS ? 0 : dot(sub(p, a), d) / dd;
  const u = clamp(uRaw, 0, 1);
  const point = add(a, mul(d, u));
  return { point, u, distance: length(sub(p, point)) };
}

export function projectPointToCircle(
  p: Vec2,
  center: Vec2,
  radius: number
): { point: Vec2; t: number; distanceToBoundary: number } {
  const v = sub(p, center);
  const t = Math.atan2(v.y, v.x);
  const point = {
    x: center.x + Math.cos(t) * radius,
    y: center.y + Math.sin(t) * radius,
  };
  return { point, t, distanceToBoundary: Math.abs(length(v) - radius) };
}

export function lineLineIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const denom = cross(r, s);
  if (Math.abs(denom) <= EPS) return null;

  const t = cross(sub(b1, a1), s) / denom;
  return add(a1, mul(r, t));
}

export function lineCircleIntersections(
  a: Vec2,
  b: Vec2,
  center: Vec2,
  radius: number
): Vec2[] {
  return lineCircleIntersectionBranches(a, b, center, radius).map((branch) => branch.point);
}

export type LineCircleIntersectionBranch = {
  t: number;
  point: Vec2;
};

export function lineCircleIntersectionBranches(
  a: Vec2,
  b: Vec2,
  center: Vec2,
  radius: number
): LineCircleIntersectionBranch[] {
  const d = sub(b, a);
  const f = sub(a, center);

  const A = dot(d, d);
  const B = 2 * dot(f, d);
  const C = dot(f, f) - radius * radius;

  if (A <= EPS) return [];

  const disc = B * B - 4 * A * C;
  if (disc < -EPS) return [];

  if (Math.abs(disc) <= EPS) {
    const t = -B / (2 * A);
    return [{ t, point: add(a, mul(d, t)) }];
  }

  const sqrtDisc = Math.sqrt(Math.max(0, disc));
  const tA = (-B - sqrtDisc) / (2 * A);
  const tB = (-B + sqrtDisc) / (2 * A);
  const t1 = Math.min(tA, tB);
  const t2 = Math.max(tA, tB);
  return [
    { t: t1, point: add(a, mul(d, t1)) },
    { t: t2, point: add(a, mul(d, t2)) },
  ];
}

export function circleCircleIntersections(c1: Vec2, r1: number, c2: Vec2, r2: number): Vec2[] {
  const d = length(sub(c2, c1));

  if (d <= EPS) return [];
  if (d > r1 + r2 + EPS) return [];
  if (d < Math.abs(r1 - r2) - EPS) return [];

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  if (hSq < -EPS) return [];

  const mid = {
    x: c1.x + (a * (c2.x - c1.x)) / d,
    y: c1.y + (a * (c2.y - c1.y)) / d,
  };

  if (Math.abs(hSq) <= EPS) return [mid];

  const h = Math.sqrt(Math.max(0, hSq));
  const rx = (-(c2.y - c1.y) * h) / d;
  const ry = ((c2.x - c1.x) * h) / d;

  return [
    { x: mid.x + rx, y: mid.y + ry },
    { x: mid.x - rx, y: mid.y - ry },
  ];
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
