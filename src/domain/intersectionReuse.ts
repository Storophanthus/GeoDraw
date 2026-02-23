import {
  circleCircleIntersections,
  distance,
  lineCircleIntersectionBranches,
  lineCircleIntersections,
  lineLineIntersection,
} from "../geo/geometry";
import type { Vec2 } from "../geo/vec2";
import {
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  nextLabelFromIndex,
  computeOrientedAngleRad,
  type GeometryObjectRef,
  type SceneModel,
  type ScenePoint,
  type ShowLabelMode,
} from "../scene/points";

export type SceneCreationStateLike = {
  scene: SceneModel;
  pointDefaults: ScenePoint["style"];
};

type LineLikeGeom = { a: Vec2; b: Vec2; finite: boolean };
type CircleGeom = { center: Vec2; radius: number };
type SectorArcGeom = { center: Vec2; radius: number; start: number; sweep: number };

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

export function getSegmentCircleRefs(
  objA: GeometryObjectRef,
  objB: GeometryObjectRef
): { segId: string; circleId: string } | null {
  if (objA.type === "segment" && objB.type === "circle") {
    return { segId: objA.id, circleId: objB.id };
  }
  if (objA.type === "circle" && objB.type === "segment") {
    return { segId: objB.id, circleId: objA.id };
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

  const excludePointId =
    branches.length >= 2
      ? resolveLineCircleExcludePointId(state.scene, line, center, radius, branches, branchIndex)
      : undefined;

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
  const genericBranch = lineCircle ? null : resolveIntersectionBranchIndex(state, objA, objB, preferredWorld);

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

    if (!lineCircle && point.kind === "circleSegmentIntersectionPoint") {
      if (
        (objA.type === "segment" && objB.type === "circle" && point.segId === objA.id && point.circleId === objB.id) ||
        (objA.type === "circle" && objB.type === "segment" && point.segId === objB.id && point.circleId === objA.id)
      ) {
        return point.id;
      }
    }
    if (!lineCircle && point.kind === "circleCircleIntersectionPoint") {
      if (
        objA.type === "circle" &&
        objB.type === "circle" &&
        ((point.circleAId === objA.id && point.circleBId === objB.id) ||
          (point.circleAId === objB.id && point.circleBId === objA.id))
      ) {
        return point.id;
      }
    }
    if (!lineCircle && point.kind === "lineLikeIntersectionPoint") {
      if (sameObjectPair(point.objA, point.objB, objA, objB)) return point.id;
    }

    if (lineCircle && point.kind === "circleLineIntersectionPoint") {
      if (point.lineId === lineCircle.lineId && point.circleId === lineCircle.circleId) {
        return point.id;
      }
      continue;
    }

    if (point.kind === "intersectionPoint" && sameObjectPair(point.objA, point.objB, objA, objB)) {
      if (genericBranch !== null) {
        if (point.branchIndex === genericBranch) return point.id;
        continue;
      }
      return point.id;
    }
  }
  return null;
}

export function resolveIntersectionBranchIndex(
  state: SceneCreationStateLike,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  preferredWorld: Vec2
): number | null {
  return resolveIntersectionBranchIndexInScene(state.scene, objA, objB, preferredWorld);
}

export function resolveIntersectionBranchIndexInScene(
  scene: SceneModel,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  preferredWorld: Vec2
): number | null {
  const intersections = resolveObjectIntersections(scene, objA, objB);
  if (intersections.length < 2) return null;
  let best = 0;
  let bestD = distance(intersections[0], preferredWorld);
  for (let i = 1; i < intersections.length; i += 1) {
    const d = distance(intersections[i], preferredWorld);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
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
  const excludePointId = resolveLineCircleExcludePointId(state.scene, line, center, radius, branches, branchIndex);

  return { world: chosen, excludePointId };
}

function resolveLineCircleExcludePointId(
  scene: SceneModel,
  line: SceneModel["lines"][number],
  center: Vec2,
  radius: number,
  branches: Array<{ point: Vec2; t: number }>,
  branchIndex: 0 | 1
): string | undefined {
  if (branches.length < 2) return undefined;
  const ROOT_EPS = 1e-6;
  const chosen = branches[branchIndex].point;
  const other = branches[branchIndex === 0 ? 1 : 0].point;

  // First preference: explicit line endpoint that lies on the circle.
  const endpointCandidates: Array<{ id: string; world: Vec2 }> = [];
  const a = branches[0].t <= branches[1].t ? branches[0].point : branches[0].point; // placeholder no-op for local naming clarity
  void a;
  const anchors = getLineWorldAnchors(line, scene);
  const la = anchors?.a ?? null;
  const lb = anchors?.b ?? null;
  if (la && lb) {
    const aOnCircle = Math.abs(distance(la, center) - radius) <= ROOT_EPS;
    const bOnCircle = Math.abs(distance(lb, center) - radius) <= ROOT_EPS;
    const endpointIds = getLineEndpointPointIds(line);
    if (aOnCircle && endpointIds[0]) endpointCandidates.push({ id: endpointIds[0], world: la });
    if (bOnCircle && endpointIds[1]) endpointCandidates.push({ id: endpointIds[1], world: lb });
    if (endpointCandidates.length === 1) {
      const endpoint = endpointCandidates[0];
      if (distance(chosen, endpoint.world) > ROOT_EPS && distance(other, endpoint.world) <= ROOT_EPS) {
        return endpoint.id;
      }
    }
  }

  // Fallback: any existing point already occupying the opposite root (e.g. the known first intersection I).
  for (const point of scene.points) {
    const world = getPointWorldPos(point, scene);
    if (!world) continue;
    if (distance(chosen, world) <= ROOT_EPS) continue;
    if (distance(other, world) <= ROOT_EPS) return point.id;
  }
  return undefined;
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
  if (line.kind === "circleCircleTangent") return [null, null];
  if (line.kind === "angleBisector") return [line.bId, null];
  return [line.aId, line.bId];
}

function resolveObjectIntersections(
  scene: SceneModel,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef
): Vec2[] {
  const la = asLineLike(scene, objA);
  const lb = asLineLike(scene, objB);
  if (la && lb) {
    const p = lineLineIntersection(la.a, la.b, lb.a, lb.b);
    if (!p) return [];
    if (!lineLikeContainsPoint(la, p) || !lineLikeContainsPoint(lb, p)) return [];
    return [p];
  }

  const ca = asCircle(scene, objA);
  const cb = asCircle(scene, objB);
  const sa = asSectorArc(scene, objA);
  const sb = asSectorArc(scene, objB);
  if (la && cb) {
    return lineCircleIntersections(la.a, la.b, cb.center, cb.radius).filter((p) => lineLikeContainsPoint(la, p));
  }
  if (lb && ca) {
    return lineCircleIntersections(lb.a, lb.b, ca.center, ca.radius).filter((p) => lineLikeContainsPoint(lb, p));
  }
  if (la && sb) {
    return lineSectorBoundaryIntersections(la, sb);
  }
  if (lb && sa) {
    return lineSectorBoundaryIntersections(lb, sa);
  }
  if (ca && cb) return circleCircleIntersections(ca.center, ca.radius, cb.center, cb.radius);
  return [];
}

function asLineLike(scene: SceneModel, ref: GeometryObjectRef): LineLikeGeom | null {
  if (ref.type === "line") {
    const line = scene.lines.find((item) => item.id === ref.id);
    if (!line) return null;
    const anchors = getLineWorldAnchors(line, scene);
    if (!anchors) return null;
    return { a: anchors.a, b: anchors.b, finite: false };
  }
  if (ref.type === "segment") {
    const seg = scene.segments.find((item) => item.id === ref.id);
    if (!seg) return null;
    const aPoint = scene.points.find((item) => item.id === seg.aId);
    const bPoint = scene.points.find((item) => item.id === seg.bId);
    if (!aPoint || !bPoint) return null;
    const a = getPointWorldPos(aPoint, scene);
    const b = getPointWorldPos(bPoint, scene);
    if (!a || !b) return null;
    return { a, b, finite: true };
  }
  return null;
}

function asCircle(scene: SceneModel, ref: GeometryObjectRef): CircleGeom | null {
  if (ref.type !== "circle") return null;
  const circle = scene.circles.find((item) => item.id === ref.id);
  if (!circle) return null;
  return getCircleWorldGeometry(circle, scene);
}

function asSectorArc(scene: SceneModel, ref: GeometryObjectRef): SectorArcGeom | null {
  if (ref.type !== "angle") return null;
  const angle = scene.angles.find((item) => item.id === ref.id);
  if (!angle || angle.kind !== "sector") return null;
  const aPoint = scene.points.find((item) => item.id === angle.aId);
  const bPoint = scene.points.find((item) => item.id === angle.bId);
  const cPoint = scene.points.find((item) => item.id === angle.cId);
  if (!aPoint || !bPoint || !cPoint) return null;
  const a = getPointWorldPos(aPoint, scene);
  const b = getPointWorldPos(bPoint, scene);
  const c = getPointWorldPos(cPoint, scene);
  if (!a || !b || !c) return null;
  const radius = distance(a, b);
  if (!Number.isFinite(radius) || radius <= 1e-12) return null;
  const sweep = computeOrientedAngleRad(a, b, c);
  if (sweep === null) return null;
  return {
    center: b,
    radius,
    start: Math.atan2(a.y - b.y, a.x - b.x),
    sweep,
  };
}

function lineLikeContainsPoint(lineLike: LineLikeGeom, p: Vec2): boolean {
  if (!lineLike.finite) return true;
  return pointWithinSegmentDomain(p, lineLike.a, lineLike.b);
}

function pointWithinSegmentDomain(p: Vec2, a: Vec2, b: Vec2): boolean {
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

function pointOnSectorArc(p: Vec2, arc: SectorArcGeom): boolean {
  const full = Math.PI * 2;
  const normalize = (v: number) => {
    let out = v % full;
    if (out < 0) out += full;
    return out;
  };
  const theta = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  const d = normalize(theta - arc.start);
  const sweep = normalize(arc.sweep);
  const eps = 1e-6;
  return d <= sweep + eps;
}

function lineSectorBoundaryIntersections(line: LineLikeGeom, sector: SectorArcGeom): Vec2[] {
  const out: Vec2[] = [];
  const pushUnique = (p: Vec2) => {
    const eps = 1e-6;
    for (const q of out) {
      if (distance(p, q) <= eps) return;
    }
    out.push(p);
  };

  const arcHits = lineCircleIntersections(line.a, line.b, sector.center, sector.radius);
  for (const p of arcHits) {
    if (!lineLikeContainsPoint(line, p) || !pointOnSectorArc(p, sector)) continue;
    pushUnique(p);
  }

  const startPoint = {
    x: sector.center.x + sector.radius * Math.cos(sector.start),
    y: sector.center.y + sector.radius * Math.sin(sector.start),
  };
  const endAngle = sector.start + sector.sweep;
  const endPoint = {
    x: sector.center.x + sector.radius * Math.cos(endAngle),
    y: sector.center.y + sector.radius * Math.sin(endAngle),
  };

  const sideStartHit = lineLineIntersection(line.a, line.b, sector.center, startPoint);
  if (sideStartHit && lineLikeContainsPoint(line, sideStartHit) && pointWithinSegmentDomain(sideStartHit, sector.center, startPoint)) {
    pushUnique(sideStartHit);
  }

  const sideEndHit = lineLineIntersection(line.a, line.b, sector.center, endPoint);
  if (sideEndHit && lineLikeContainsPoint(line, sideEndHit) && pointWithinSegmentDomain(sideEndHit, sector.center, endPoint)) {
    pushUnique(sideEndHit);
  }

  return out;
}
