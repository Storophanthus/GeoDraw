import type { Vec2 } from "../geo/vec2";
import {
  add,
  circleCircleIntersections,
  distance,
  lineCircleIntersectionBranches,
  lineCircleIntersections,
  lineLineIntersection,
  mul,
  sub,
} from "../geo/geometry";

export type PointShape =
  | "circle"
  | "x"
  | "plus"
  | "cross"
  | "diamond"
  | "square"
  | "triUp"
  | "triDown"
  | "dot";

export type PointStyle = {
  shape: PointShape;
  sizePx: number;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  labelFontPx: number;
  labelHaloWidthPx: number;
  labelHaloColor: string;
  labelColor: string;
  labelOffsetPx: Vec2;
};

export type LineStyle = {
  strokeColor: string;
  strokeWidth: number;
  dash: "solid" | "dashed";
  opacity: number;
};

export type CircleStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeDash: "solid" | "dashed";
  strokeOpacity: number;
  fillColor?: string;
  fillOpacity?: number;
};

export type ShowLabelMode = "none" | "name" | "caption";

export type FreePoint = {
  id: string;
  kind: "free";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  position: Vec2;
  style: PointStyle;
};

export type MidpointFromPoints = {
  id: string;
  kind: "midpointPoints";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  aId: string;
  bId: string;
  style: PointStyle;
};

export type MidpointFromSegment = {
  id: string;
  kind: "midpointSegment";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  segId: string;
  style: PointStyle;
};

export type PointOnLine = {
  id: string;
  kind: "pointOnLine";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  lineId: string;
  s: number;
  style: PointStyle;
};

export type PointOnSegment = {
  id: string;
  kind: "pointOnSegment";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  segId: string;
  u: number;
  style: PointStyle;
};

export type PointOnCircle = {
  id: string;
  kind: "pointOnCircle";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  circleId: string;
  t: number;
  style: PointStyle;
};

export type GeometryObjectRef =
  | { type: "line"; id: string }
  | { type: "segment"; id: string }
  | { type: "circle"; id: string };

export type IntersectionPoint = {
  id: string;
  kind: "intersectionPoint";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  objA: GeometryObjectRef;
  objB: GeometryObjectRef;
  preferredWorld: Vec2;
  style: PointStyle;
};

export type CircleLineIntersectionPoint = {
  id: string;
  kind: "circleLineIntersectionPoint";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  circleId: string;
  lineId: string;
  branchIndex: 0 | 1;
  excludePointId?: string;
  style: PointStyle;
};

export type ScenePoint =
  | FreePoint
  | MidpointFromPoints
  | MidpointFromSegment
  | PointOnLine
  | PointOnSegment
  | PointOnCircle
  | IntersectionPoint
  | CircleLineIntersectionPoint;

export type SceneSegment = {
  id: string;
  aId: string;
  bId: string;
  visible: boolean;
  showLabel: boolean;
  style: LineStyle;
};

export type SceneLine = {
  id: string;
  aId: string;
  bId: string;
  visible: boolean;
  style: LineStyle;
};

export type SceneCircle = {
  id: string;
  centerId: string;
  throughId: string;
  visible: boolean;
  style: CircleStyle;
};

export type SceneModel = {
  points: ScenePoint[];
  segments: SceneSegment[];
  lines: SceneLine[];
  circles: SceneCircle[];
};

export function nextLabelFromIndex(index: number): string {
  const letterIndex = index % 26;
  const cycle = Math.floor(index / 26);
  const letter = String.fromCharCode(65 + letterIndex);
  if (cycle === 0) return letter;
  return `${letter}_${cycle}`;
}

export function isNameUnique(
  name: string,
  existingNames: Iterable<string>,
  ignoreName?: string
): boolean {
  for (const existing of existingNames) {
    if (existing === ignoreName) continue;
    if (existing === name) return false;
  }
  return true;
}

export function isValidPointName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

export function getPointWorldPos(
  point: ScenePoint,
  scene: SceneModel,
  visited: Set<string> = new Set()
): Vec2 | null {
  if (visited.has(point.id)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(point.id);

  if (point.kind === "free") return point.position;

  if (point.kind === "midpointPoints") {
    const a = scene.points.find((item) => item.id === point.aId);
    const b = scene.points.find((item) => item.id === point.bId);
    if (!a || !b) return null;
    const pa = getPointWorldPos(a, scene, nextVisited);
    const pb = getPointWorldPos(b, scene, nextVisited);
    if (!pa || !pb) return null;
    return { x: (pa.x + pb.x) * 0.5, y: (pa.y + pb.y) * 0.5 };
  }

  if (point.kind === "midpointSegment") {
    const seg = scene.segments.find((item) => item.id === point.segId);
    if (!seg) return null;
    const a = scene.points.find((item) => item.id === seg.aId);
    const b = scene.points.find((item) => item.id === seg.bId);
    if (!a || !b) return null;
    const pa = getPointWorldPos(a, scene, nextVisited);
    const pb = getPointWorldPos(b, scene, nextVisited);
    if (!pa || !pb) return null;
    return { x: (pa.x + pb.x) * 0.5, y: (pa.y + pb.y) * 0.5 };
  }

  if (point.kind === "pointOnLine") {
    const line = scene.lines.find((item) => item.id === point.lineId);
    if (!line) return null;
    const a = getPointWorldById(line.aId, scene, nextVisited);
    const b = getPointWorldById(line.bId, scene, nextVisited);
    if (!a || !b) return null;
    return add(a, mul(sub(b, a), point.s));
  }

  if (point.kind === "pointOnSegment") {
    const seg = scene.segments.find((item) => item.id === point.segId);
    if (!seg) return null;
    const a = getPointWorldById(seg.aId, scene, nextVisited);
    const b = getPointWorldById(seg.bId, scene, nextVisited);
    if (!a || !b) return null;
    return add(a, mul(sub(b, a), clamp(point.u, 0, 1)));
  }

  if (point.kind === "pointOnCircle") {
    const circle = scene.circles.find((item) => item.id === point.circleId);
    if (!circle) return null;
    const center = getPointWorldById(circle.centerId, scene, nextVisited);
    const through = getPointWorldById(circle.throughId, scene, nextVisited);
    if (!center || !through) return null;
    const radius = distance(center, through);
    return {
      x: center.x + Math.cos(point.t) * radius,
      y: center.y + Math.sin(point.t) * radius,
    };
  }

  if (point.kind === "circleLineIntersectionPoint") {
    const circle = scene.circles.find((item) => item.id === point.circleId);
    const line = scene.lines.find((item) => item.id === point.lineId);
    if (!circle || !line) return null;
    const center = getPointWorldById(circle.centerId, scene, nextVisited);
    const through = getPointWorldById(circle.throughId, scene, nextVisited);
    const la = getPointWorldById(line.aId, scene, nextVisited);
    const lb = getPointWorldById(line.bId, scene, nextVisited);
    if (!center || !through || !la || !lb) return null;
    const r = distance(center, through);
    const branches = lineCircleIntersectionBranches(la, lb, center, r);
    if (branches.length === 0) return null;

    if (point.excludePointId) {
      const excluded = getPointWorldById(point.excludePointId, scene, nextVisited);
      if (excluded) {
        const ROOT_EPS = 1e-6;
        const candidates = branches.filter((branch) => distance(branch.point, excluded) > ROOT_EPS);
        if (candidates.length >= 1) return candidates[0].point;
        // Tangency / collapsed roots at excluded point -> undefined for \"other\" intersection.
        if (branches.length === 1 || branches.every((branch) => distance(branch.point, excluded) <= ROOT_EPS)) {
          return null;
        }
      }
    }

    if (branches.length === 1) return branches[0].point;
    return branches[point.branchIndex]?.point ?? branches[0].point;
  }

  const intersections = objectIntersections(point.objA, point.objB, scene);
  if (intersections.length === 0) return null;
  return chooseClosestToPreferred(intersections, point.preferredWorld);
}

export function isPointDraggable(point: ScenePoint): boolean {
  if (point.locked) return false;
  return (
    point.kind === "free" ||
    point.kind === "pointOnLine" ||
    point.kind === "pointOnSegment" ||
    point.kind === "pointOnCircle"
  );
}

export function movePoint(point: ScenePoint, world: Vec2): ScenePoint {
  if (point.kind !== "free") return point;
  if (point.locked) return point;
  return { ...point, position: world };
}

function getPointWorldById(pointId: string, scene: SceneModel, visited: Set<string>): Vec2 | null {
  const point = scene.points.find((item) => item.id === pointId);
  if (!point) return null;
  return getPointWorldPos(point, scene, visited);
}

function objectIntersections(a: GeometryObjectRef, b: GeometryObjectRef, scene: SceneModel): Vec2[] {
  const la = asLineLike(a, scene);
  const lb = asLineLike(b, scene);
  if (la && lb) {
    const p = lineLineIntersection(la.a, la.b, lb.a, lb.b);
    if (!p) return [];
    if (!lineLikeContainsPoint(la, p)) return [];
    if (!lineLikeContainsPoint(lb, p)) return [];
    return [p];
  }

  const circleA = asCircle(a, scene);
  const circleB = asCircle(b, scene);

  if (la && circleB) {
    return lineCircleIntersections(la.a, la.b, circleB.center, circleB.radius).filter((p) =>
      lineLikeContainsPoint(la, p)
    );
  }
  if (lb && circleA) {
    return lineCircleIntersections(lb.a, lb.b, circleA.center, circleA.radius).filter((p) =>
      lineLikeContainsPoint(lb, p)
    );
  }
  if (circleA && circleB) {
    return circleCircleIntersections(circleA.center, circleA.radius, circleB.center, circleB.radius);
  }
  return [];
}

function asLineLike(
  ref: GeometryObjectRef,
  scene: SceneModel
): { a: Vec2; b: Vec2; finite: boolean } | null {
  if (ref.type === "line") {
    const line = scene.lines.find((item) => item.id === ref.id);
    if (!line) return null;
    const a = getPointWorldById(line.aId, scene, new Set());
    const b = getPointWorldById(line.bId, scene, new Set());
    if (!a || !b) return null;
    return { a, b, finite: false };
  }

  if (ref.type === "segment") {
    const seg = scene.segments.find((item) => item.id === ref.id);
    if (!seg) return null;
    const a = getPointWorldById(seg.aId, scene, new Set());
    const b = getPointWorldById(seg.bId, scene, new Set());
    if (!a || !b) return null;
    return { a, b, finite: true };
  }

  return null;
}

function asCircle(
  ref: GeometryObjectRef,
  scene: SceneModel
): { center: Vec2; radius: number } | null {
  if (ref.type !== "circle") return null;
  const circle = scene.circles.find((item) => item.id === ref.id);
  if (!circle) return null;
  const center = getPointWorldById(circle.centerId, scene, new Set());
  const through = getPointWorldById(circle.throughId, scene, new Set());
  if (!center || !through) return null;
  return { center, radius: distance(center, through) };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function chooseClosestToPreferred(points: Vec2[], preferredWorld: Vec2): Vec2 {
  let best = points[0];
  let bestDist = distance(best, preferredWorld);
  for (let i = 1; i < points.length; i += 1) {
    const d = distance(points[i], preferredWorld);
    if (d < bestDist) {
      best = points[i];
      bestDist = d;
    }
  }
  return best;
}

function lineLikeContainsPoint(lineLike: { a: Vec2; b: Vec2; finite: boolean }, p: Vec2): boolean {
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
