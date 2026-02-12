import { circleCircleIntersections, lineCircleIntersections, lineLineIntersection } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import { lineLikeContainsPoint } from "./intersectionUtils";

type GeometryObjectRef = { type: "line" | "segment" | "circle"; id: string };

type LineLike = { a: Vec2; b: Vec2; finite: boolean };
type CircleGeom = { center: Vec2; radius: number };

export function objectIntersectionsWithOps(
  a: GeometryObjectRef,
  b: GeometryObjectRef,
  ops: {
    asLineLike: (ref: GeometryObjectRef) => LineLike | null;
    asCircle: (ref: GeometryObjectRef) => CircleGeom | null;
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
  return [];
}
