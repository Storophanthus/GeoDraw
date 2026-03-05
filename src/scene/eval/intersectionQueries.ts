import { circleCircleIntersections, lineCircleIntersections, lineLineIntersection } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import type { GeometryObjectRef } from "../points";
import { lineLikeContainsPoint } from "./intersectionUtils";

type LineLike = { a: Vec2; b: Vec2; finite: boolean };
type CircleGeom = { center: Vec2; radius: number };
type SectorArcGeom = { center: Vec2; radius: number; start: number; sweep: number };

export function objectIntersectionsWithOps(
  a: GeometryObjectRef,
  b: GeometryObjectRef,
  ops: {
    asLineLike: (ref: GeometryObjectRef) => LineLike | null;
    asCircle: (ref: GeometryObjectRef) => CircleGeom | null;
    asSectorArc: (ref: GeometryObjectRef) => SectorArcGeom | null;
    onLineLineCall: () => void;
    onCircleLineCall: () => void;
    onCircleCircleCall: () => void;
    onAllocation: (count: number) => void;
  }
): Vec2[] {
  const la = ops.asLineLike(a);
  const lb = ops.asLineLike(b);
  if (la && lb) {
    ops.onLineLineCall();
    const p = lineLineIntersection(la.a, la.b, lb.a, lb.b);
    if (!p) return [];
    if (!lineLikeContainsPoint(la, p)) return [];
    if (!lineLikeContainsPoint(lb, p)) return [];
    ops.onAllocation(1);
    return [p];
  }

  const circleA = ops.asCircle(a);
  const circleB = ops.asCircle(b);
  const sectorArcA = ops.asSectorArc(a);
  const sectorArcB = ops.asSectorArc(b);

  if (la && circleB) {
    ops.onCircleLineCall();
    return lineCircleIntersections(la.a, la.b, circleB.center, circleB.radius).filter((p) =>
      lineLikeContainsPoint(la, p)
    );
  }
  if (lb && circleA) {
    ops.onCircleLineCall();
    return lineCircleIntersections(lb.a, lb.b, circleA.center, circleA.radius).filter((p) =>
      lineLikeContainsPoint(lb, p)
    );
  }
  if (circleA && circleB) {
    ops.onCircleCircleCall();
    return circleCircleIntersections(circleA.center, circleA.radius, circleB.center, circleB.radius);
  }
  if (la && sectorArcB) {
    ops.onCircleLineCall();
    return lineSectorArcIntersections(la, sectorArcB);
  }
  if (lb && sectorArcA) {
    ops.onCircleLineCall();
    return lineSectorArcIntersections(lb, sectorArcA);
  }
  return [];
}

function pointOnSectorArc(p: Vec2, arc: SectorArcGeom): boolean {
  const theta = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  const full = Math.PI * 2;
  const normalize = (v: number) => {
    let out = v % full;
    if (out < 0) out += full;
    return out;
  };
  const d = normalize(theta - arc.start);
  const sweep = normalize(arc.sweep);
  const eps = 1e-6;
  return d <= sweep + eps;
}

function lineSectorArcIntersections(line: LineLike, sector: SectorArcGeom): Vec2[] {
  const out: Vec2[] = [];
  const pushUnique = (p: Vec2) => {
    const eps = 1e-6;
    for (const q of out) {
      if (Math.hypot(p.x - q.x, p.y - q.y) <= eps) return;
    }
    out.push(p);
  };

  const arcHits = lineCircleIntersections(line.a, line.b, sector.center, sector.radius);
  for (const p of arcHits) {
    if (!lineLikeContainsPoint(line, p) || !pointOnSectorArc(p, sector)) continue;
    pushUnique(p);
  }

  return out;
}
