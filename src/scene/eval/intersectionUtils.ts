import { distance } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import type { GeometryObjectRef } from "../points";

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function circleLineStabilitySignature(
  circleId: string,
  lineId: string,
  _la: Vec2,
  _lb: Vec2,
  _center: Vec2,
  _radius: number
): string {
  // Keep branch continuity stable across drags. Geometry snapshots in the key
  // caused frequent cache misses and root flips ("teleporting") while parents moved.
  return `cli:${circleId}:${lineId}`;
}

function circleLinePairKey(circleId: string, lineId: string): string {
  return `${circleId}:${lineId}`;
}

function objectRefKey(ref: GeometryObjectRef): string {
  return `${ref.type}:${ref.id}`;
}

export function genericIntersectionPairKey(a: GeometryObjectRef, b: GeometryObjectRef): string {
  const ak = objectRefKey(a);
  const bk = objectRefKey(b);
  return ak <= bk ? `${ak}|${bk}` : `${bk}|${ak}`;
}

export function circleLinePairAssignmentKey(circleId: string, lineId: string): string {
  return circleLinePairKey(circleId, lineId);
}

export function genericIntersectionSignature(a: GeometryObjectRef, b: GeometryObjectRef): string {
  return `gix:${genericIntersectionPairKey(a, b)}`;
}

function sameObjectRef(a: GeometryObjectRef, b: GeometryObjectRef): boolean {
  return a.type === b.type && a.id === b.id;
}

export function sameObjectPair(
  a1: GeometryObjectRef,
  b1: GeometryObjectRef,
  a2: GeometryObjectRef,
  b2: GeometryObjectRef
): boolean {
  return (sameObjectRef(a1, a2) && sameObjectRef(b1, b2)) || (sameObjectRef(a1, b2) && sameObjectRef(b1, a2));
}

export function lineLikeContainsPoint(lineLike: { a: Vec2; b: Vec2; finite: boolean }, p: Vec2): boolean {
  if (!lineLike.finite) return true;
  return pointWithinSegmentDomain(p, lineLike.a, lineLike.b);
}

export function pointWithinSegmentDomain(p: Vec2, a: Vec2, b: Vec2): boolean {
  const EPS = 1e-6;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dd = dx * dx + dy * dy;
  if (dd <= EPS * EPS) return distance(p, a) <= EPS;
  const ux = p.x - a.x;
  const uy = p.y - a.y;
  const u = (ux * dx + uy * dy) / dd;
  return u >= -EPS && u <= 1 + EPS;
}
