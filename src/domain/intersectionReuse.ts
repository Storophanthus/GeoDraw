import { distance, lineCircleIntersectionBranches } from "../geo/geometry";
import type { Vec2 } from "../geo/vec2";
import {
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  nextLabelFromIndex,
  type GeometryObjectRef,
  type SceneModel,
  type ScenePoint,
  type ShowLabelMode,
} from "../scene/points";

export type SceneCreationStateLike = {
  scene: SceneModel;
  pointDefaults: ScenePoint["style"];
};

export function getLineCircleRefs(
  objA: GeometryObjectRef,
  objB: GeometryObjectRef
): { lineId: string; circleId: string } | null {
  if (objA.type === "line" && objB.type === "circle") {
    return { lineId: objA.id, circleId: objB.id };
  }
  if (objA.type === "circle" && objB.type === "line") {
    return { lineId: objB.id, circleId: objA.id };
  }
  return null;
}

export function createStableLineCircleIntersectionPoint(
  id: string,
  lineId: string,
  circleId: string,
  preferredWorld: Vec2,
  state: SceneCreationStateLike
): ScenePoint | null {
  const line = state.scene.lines.find((item) => item.id === lineId);
  const circle = state.scene.circles.find((item) => item.id === circleId);
  if (!line || !circle) return null;

  const anchors = getLineWorldAnchors(line, state.scene);
  const a = anchors?.a ?? null;
  const b = anchors?.b ?? null;
  const geom = getCircleWorldGeometry(circle, state.scene);
  if (!a || !b || !geom) return null;
  const center = geom.center;
  const radius = geom.radius;
  const branches = lineCircleIntersectionBranches(a, b, center, radius);
  if (branches.length === 0) return null;

  let branchIndex: 0 | 1 = 0;
  if (branches.length >= 2) {
    const d0 = distance(branches[0].point, preferredWorld);
    const d1 = distance(branches[1].point, preferredWorld);
    branchIndex = d1 < d0 ? 1 : 0;
  }

  let excludePointId: string | undefined;
  const endpointCandidates: Array<{ id: string; world: Vec2 }> = [];
  const aOnCircle = Math.abs(distance(a, center) - radius) <= 1e-6;
  const bOnCircle = Math.abs(distance(b, center) - radius) <= 1e-6;
  const endpointIds = getLineEndpointPointIds(line);
  if (aOnCircle && endpointIds[0]) endpointCandidates.push({ id: endpointIds[0], world: a });
  if (bOnCircle && endpointIds[1]) endpointCandidates.push({ id: endpointIds[1], world: b });

  if (branches.length >= 2 && endpointCandidates.length === 1) {
    const endpoint = endpointCandidates[0];
    const chosen = branches[branchIndex].point;
    const other = branches[branchIndex === 0 ? 1 : 0].point;
    const ROOT_EPS = 1e-6;
    if (distance(chosen, endpoint.world) > ROOT_EPS && distance(other, endpoint.world) <= ROOT_EPS) {
      excludePointId = endpoint.id;
    }
  }

  const used = new Set(state.scene.points.map((point) => point.name));
  let idx = 0;
  let name = nextLabelFromIndex(idx);
  while (used.has(name)) {
    idx += 1;
    name = nextLabelFromIndex(idx);
  }

  return {
    id,
    kind: "circleLineIntersectionPoint",
    name,
    captionTex: name,
    visible: true,
    showLabel: "name" as ShowLabelMode,
    locked: true,
    auxiliary: true,
    circleId,
    lineId,
    branchIndex,
    excludePointId,
    style: {
      ...state.pointDefaults,
      labelOffsetPx: { ...state.pointDefaults.labelOffsetPx },
    },
  };
}

export function findExistingIntersectionPointId(
  state: SceneCreationStateLike,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  preferredWorld: Vec2
): string | null {
  const EPS = 1e-6;
  const lineCircle = getLineCircleRefs(objA, objB);

  if (lineCircle) {
    const target = resolveLineCircleTarget(state, lineCircle.lineId, lineCircle.circleId, preferredWorld);
    if (target) {
      const ROOT_EPS = 1e-5;
      for (const point of state.scene.points) {
        if (point.kind !== "circleLineIntersectionPoint") continue;
        if (point.lineId !== lineCircle.lineId || point.circleId !== lineCircle.circleId) continue;
        const world = getPointWorldPos(point, state.scene);
        if (world && distance(world, target.world) <= ROOT_EPS) return point.id;
        if (target.excludePointId && point.excludePointId === target.excludePointId) return point.id;
      }
    }
  }

  for (const point of state.scene.points) {
    const world = getPointWorldPos(point, state.scene);
    if (!world) continue;
    if (distance(world, preferredWorld) > EPS) continue;

    if (lineCircle && point.kind === "circleLineIntersectionPoint") {
      if (point.lineId === lineCircle.lineId && point.circleId === lineCircle.circleId) {
        return point.id;
      }
      continue;
    }

    if (point.kind === "intersectionPoint" && sameObjectPair(point.objA, point.objB, objA, objB)) {
      return point.id;
    }
  }
  return null;
}

function resolveLineCircleTarget(
  state: SceneCreationStateLike,
  lineId: string,
  circleId: string,
  preferredWorld: Vec2
): { world: Vec2; excludePointId?: string } | null {
  const line = state.scene.lines.find((item) => item.id === lineId);
  const circle = state.scene.circles.find((item) => item.id === circleId);
  if (!line || !circle) return null;

  const anchors = getLineWorldAnchors(line, state.scene);
  const a = anchors?.a ?? null;
  const b = anchors?.b ?? null;
  const geom = getCircleWorldGeometry(circle, state.scene);
  if (!a || !b || !geom) return null;
  const center = geom.center;
  const radius = geom.radius;
  const branches = lineCircleIntersectionBranches(a, b, center, radius);
  if (branches.length === 0) return null;

  if (branches.length === 1) return { world: branches[0].point };

  const d0 = distance(branches[0].point, preferredWorld);
  const d1 = distance(branches[1].point, preferredWorld);
  const branchIndex: 0 | 1 = d1 < d0 ? 1 : 0;
  const chosen = branches[branchIndex].point;
  const other = branches[branchIndex === 0 ? 1 : 0].point;

  const endpointCandidates: Array<{ id: string; world: Vec2 }> = [];
  const aOnCircle = Math.abs(distance(a, center) - radius) <= 1e-6;
  const bOnCircle = Math.abs(distance(b, center) - radius) <= 1e-6;
  const endpointIds = getLineEndpointPointIds(line);
  if (aOnCircle && endpointIds[0]) endpointCandidates.push({ id: endpointIds[0], world: a });
  if (bOnCircle && endpointIds[1]) endpointCandidates.push({ id: endpointIds[1], world: b });

  let excludePointId: string | undefined;
  if (endpointCandidates.length === 1) {
    const endpoint = endpointCandidates[0];
    const ROOT_EPS = 1e-6;
    if (distance(chosen, endpoint.world) > ROOT_EPS && distance(other, endpoint.world) <= ROOT_EPS) {
      excludePointId = endpoint.id;
    }
  }

  return { world: chosen, excludePointId };
}

function sameObjectPair(
  a1: GeometryObjectRef,
  b1: GeometryObjectRef,
  a2: GeometryObjectRef,
  b2: GeometryObjectRef
): boolean {
  return (sameObjectRef(a1, a2) && sameObjectRef(b1, b2)) || (sameObjectRef(a1, b2) && sameObjectRef(b1, a2));
}

function sameObjectRef(a: GeometryObjectRef, b: GeometryObjectRef): boolean {
  return a.type === b.type && a.id === b.id;
}

function getLineEndpointPointIds(line: SceneModel["lines"][number]): [string | null, string | null] {
  if (line.kind === "perpendicular" || line.kind === "parallel" || line.kind === "tangent") return [line.throughId, null];
  if (line.kind === "angleBisector") return [line.bId, null];
  return [line.aId, line.bId];
}
