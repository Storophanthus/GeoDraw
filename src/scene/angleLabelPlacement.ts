import type { Vec2 } from "../geo/vec2";
import { computeOrientedAngleRad } from "./eval/angleMath";

export const ANGLE_LABEL_MIN_DIST = 0.26;
export const ANGLE_LABEL_MAX_DIST = 0.36;
export const RIGHT_ANGLE_LABEL_MAX_DIST = 0.3;

const ANGLE_LABEL_RADIUS_OFFSET = 0.4;
const NON_RIGHT_ANGLE_LABEL_DIST_SCALE = 0.2;
const RIGHT_ANGLE_LABEL_DIST_SCALE = 0.18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function angleBisectorRad(a: Vec2, b: Vec2, c: Vec2): number | null {
  const theta = computeOrientedAngleRad(a, b, c);
  if (theta === null || !Number.isFinite(theta)) return null;
  const start = Math.atan2(a.y - b.y, a.x - b.x);
  return start + theta * 0.5;
}

export function angleLabelWorldFromPolar(vertex: Vec2, angleRad: number, dist: number): Vec2 {
  return {
    x: vertex.x + Math.cos(angleRad) * dist,
    y: vertex.y + Math.sin(angleRad) * dist,
  };
}

export function clampAngleLabelDist(dist: number, rightLike: boolean): number {
  const max = rightLike ? RIGHT_ANGLE_LABEL_MAX_DIST : ANGLE_LABEL_MAX_DIST;
  return clamp(dist, ANGLE_LABEL_MIN_DIST, max);
}

export function defaultAngleLabelDist(arcRadius: number, rightLike: boolean): number {
  const base = Math.max(ANGLE_LABEL_MIN_DIST, arcRadius - ANGLE_LABEL_RADIUS_OFFSET);
  const scale = rightLike ? RIGHT_ANGLE_LABEL_DIST_SCALE : NON_RIGHT_ANGLE_LABEL_DIST_SCALE;
  return clampAngleLabelDist(base * scale, rightLike);
}

export function shortestAngleDiffRad(from: number, to: number): number {
  let delta = from - to;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  return delta;
}
