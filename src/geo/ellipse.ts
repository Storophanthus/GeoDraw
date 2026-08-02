import type { Vec2 } from "./vec2";

export type EllipseGeometry = {
  center: Vec2;
  focusA: Vec2;
  focusB: Vec2;
  through: Vec2;
  semiMajor: number;
  semiMinor: number;
  focalDistance: number;
  rotationRad: number;
};

export type EllipseProjection = {
  point: Vec2;
  t: number;
  distance: number;
};

export function ellipseGeometryFromFociPoint(
  focusA: Vec2,
  focusB: Vec2,
  through: Vec2
): EllipseGeometry | null {
  const dx = focusB.x - focusA.x;
  const dy = focusB.y - focusA.y;
  const focusDistance = Math.hypot(dx, dy);
  if (!Number.isFinite(focusDistance) || focusDistance <= 1e-12) return null;

  const semiMajor =
    (Math.hypot(through.x - focusA.x, through.y - focusA.y) +
      Math.hypot(through.x - focusB.x, through.y - focusB.y)) /
    2;
  const focalDistance = focusDistance / 2;
  if (!Number.isFinite(semiMajor) || semiMajor <= focalDistance + 1e-9) return null;

  const semiMinorSq = semiMajor * semiMajor - focalDistance * focalDistance;
  if (!Number.isFinite(semiMinorSq) || semiMinorSq <= 1e-18) return null;

  return {
    center: {
      x: (focusA.x + focusB.x) / 2,
      y: (focusA.y + focusB.y) / 2,
    },
    focusA,
    focusB,
    through,
    semiMajor,
    semiMinor: Math.sqrt(semiMinorSq),
    focalDistance,
    rotationRad: Math.atan2(dy, dx),
  };
}

export function pointOnEllipse(geometry: EllipseGeometry, t: number): Vec2 {
  const localX = geometry.semiMajor * Math.cos(t);
  const localY = geometry.semiMinor * Math.sin(t);
  const cos = Math.cos(geometry.rotationRad);
  const sin = Math.sin(geometry.rotationRad);
  return {
    x: geometry.center.x + localX * cos - localY * sin,
    y: geometry.center.y + localX * sin + localY * cos,
  };
}

export function projectPointToEllipse(world: Vec2, geometry: EllipseGeometry): EllipseProjection {
  const cos = Math.cos(geometry.rotationRad);
  const sin = Math.sin(geometry.rotationRad);
  const dx = world.x - geometry.center.x;
  const dy = world.y - geometry.center.y;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const a = geometry.semiMajor;
  const b = geometry.semiMinor;

  // The normalized polar angle is already close for a cursor near the boundary.
  // Newton refinement makes the projection perpendicular to the ellipse while
  // retaining a stable parametric angle for constrained-point recomputation.
  let t = Math.atan2(localY / b, localX / a);
  if (!Number.isFinite(t)) t = 0;
  for (let i = 0; i < 12; i += 1) {
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);
    const f = (b * b - a * a) * sinT * cosT + a * localX * sinT - b * localY * cosT;
    const derivative =
      (b * b - a * a) * (cosT * cosT - sinT * sinT) +
      a * localX * cosT +
      b * localY * sinT;
    if (!Number.isFinite(derivative) || Math.abs(derivative) <= 1e-14) break;
    const delta = f / derivative;
    if (!Number.isFinite(delta)) break;
    t -= delta;
    if (Math.abs(delta) <= 1e-12) break;
  }

  const point = pointOnEllipse(geometry, t);
  return {
    point,
    t,
    distance: Math.hypot(point.x - world.x, point.y - world.y),
  };
}
