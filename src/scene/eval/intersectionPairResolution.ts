import { distance } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import type {
  CircleCircleIntersectionPoint,
  CircleSegmentIntersectionPoint,
  CircleLineIntersectionPoint,
  GeometryObjectRef,
  IntersectionPoint,
  LineLikeIntersectionPoint,
  ScenePoint,
} from "../points";
import {
  assignCircleLinePairPoints,
  assignGenericIntersectionPairPoints,
  type CircleLineAssignmentPoint,
  type GenericAssignmentPoint,
} from "./intersectionAssignments";
import { circleLinePairAssignmentKey, genericIntersectionPairKey, sameObjectPair } from "./intersectionUtils";

const ROOT_EPS = 1e-6;

export function resolveCircleLinePairAssignmentsInScene(
  scenePoints: ScenePoint[],
  circleId: string,
  lineId: string,
  branches: Array<{ point: Vec2; t: number }>,
  ops: {
    getCached: (key: string) => Map<string, Vec2 | null> | undefined;
    setCached: (key: string, value: Map<string, Vec2 | null>) => void;
    getExcludedPointWorld: (pointId: string) => Vec2 | null;
    getCachedPointWorld: (pointId: string) => Vec2 | null;
    getPreviousStablePoint: (pointId: string) => Vec2 | null;
    rememberStablePoint: (pointId: string, value: Vec2) => void;
  }
): Map<string, Vec2 | null> {
  const key = circleLinePairAssignmentKey(circleId, lineId);
  const cached = ops.getCached(key);
  if (cached) return cached;

  const pairPoints: CircleLineAssignmentPoint[] = [];
  for (const item of scenePoints) {
    if (item.kind !== "circleLineIntersectionPoint") continue;
    if (item.circleId !== circleId || item.lineId !== lineId) continue;
    pairPoints.push(item as CircleLineIntersectionPoint);
  }
  let occupiedByOtherPoints: [boolean, boolean] | undefined;
  if (branches.length === 2 && pairPoints.length > 0) {
    const pairIds = new Set(pairPoints.map((p) => p.id));
    occupiedByOtherPoints = [false, false];
    for (const item of scenePoints) {
      if (pairIds.has(item.id)) continue;
      const world = ops.getCachedPointWorld(item.id);
      if (!world) continue;
      if (!occupiedByOtherPoints[0] && distance(world, branches[0].point) <= ROOT_EPS) occupiedByOtherPoints[0] = true;
      if (!occupiedByOtherPoints[1] && distance(world, branches[1].point) <= ROOT_EPS) occupiedByOtherPoints[1] = true;
      if (occupiedByOtherPoints[0] && occupiedByOtherPoints[1]) break;
    }
  }
  const out = assignCircleLinePairPoints(pairPoints, branches, {
    getExcludedPointWorld: ops.getExcludedPointWorld,
    getPreviousStablePoint: ops.getPreviousStablePoint,
    rememberStablePoint: ops.rememberStablePoint,
    occupiedByOtherPoints,
  });
  ops.setCached(key, out);
  return out;
}

export function resolveGenericIntersectionPairAssignmentsInScene(
  scenePoints: ScenePoint[],
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  intersections: Vec2[],
  ops: {
    getCached: (key: string) => Map<string, Vec2 | null> | undefined;
    setCached: (key: string, value: Map<string, Vec2 | null>) => void;
    getExcludedPointWorld: (pointId: string) => Vec2 | null;
    getPreviousStablePoint: (pointId: string) => Vec2 | null;
    rememberStablePoint: (pointId: string, value: Vec2) => void;
  }
): Map<string, Vec2 | null> {
  const key = genericIntersectionPairKey(objA, objB);
  const cached = ops.getCached(key);
  if (cached) return cached;

  const pairPoints: GenericAssignmentPoint[] = [];
  for (const item of scenePoints) {
    if (item.kind === "intersectionPoint") {
      const ip = item as IntersectionPoint;
      if (!sameObjectPair(ip.objA, ip.objB, objA, objB)) continue;
      pairPoints.push(ip);
      continue;
    }
    if (item.kind === "lineLikeIntersectionPoint") {
      const ip = item as LineLikeIntersectionPoint;
      if (!sameObjectPair(ip.objA, ip.objB, objA, objB)) continue;
      pairPoints.push({
        id: ip.id,
      });
      continue;
    }
    if (item.kind === "circleSegmentIntersectionPoint") {
      const ip = item as CircleSegmentIntersectionPoint;
      if (!sameObjectPair({ type: "segment", id: ip.segId }, { type: "circle", id: ip.circleId }, objA, objB)) continue;
      pairPoints.push({
        id: ip.id,
        branchIndex: ip.branchIndex,
        excludePointId: ip.excludePointId,
      });
      continue;
    }
    if (item.kind === "circleCircleIntersectionPoint") {
      const ip = item as CircleCircleIntersectionPoint;
      if (!sameObjectPair({ type: "circle", id: ip.circleAId }, { type: "circle", id: ip.circleBId }, objA, objB)) continue;
      pairPoints.push({
        id: ip.id,
        branchIndex: ip.branchIndex,
        excludePointId: ip.excludePointId,
      });
    }
  }
  const out = assignGenericIntersectionPairPoints(pairPoints, intersections, {
    getExcludedPointWorld: ops.getExcludedPointWorld,
    getPreviousStablePoint: ops.getPreviousStablePoint,
    rememberStablePoint: ops.rememberStablePoint,
  });
  ops.setCached(key, out);
  return out;
}
