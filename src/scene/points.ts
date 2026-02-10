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
  dash: "solid" | "dashed" | "dotted";
  opacity: number;
};

export type CircleStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeDash: "solid" | "dashed" | "dotted";
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

export type LineLikeObjectRef = { type: "line"; id: string } | { type: "segment"; id: string };

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
  excludePointId?: string;
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

export type SceneLineTwoPoint = {
  id: string;
  kind?: "twoPoint";
  aId: string;
  bId: string;
  visible: boolean;
  style: LineStyle;
};

export type SceneLinePerpendicular = {
  id: string;
  kind: "perpendicular";
  throughId: string;
  base: LineLikeObjectRef;
  visible: boolean;
  style: LineStyle;
};

export type SceneLine = SceneLineTwoPoint | SceneLinePerpendicular;

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

export type SceneEvalStats = {
  tick: number;
  dirtyNodes: number;
  totalNodeEvalCalls: number;
  cacheHits: number;
  circleCircleCalls: number;
  circleLineCalls: number;
  lineLineCalls: number;
  allocationsEstimate: number;
  ms: number;
};

type SceneEvalContext = {
  tick: number;
  startedAt: number;
  pointCache: Map<string, Vec2 | null>;
  inProgress: Set<string>;
  pointById: Map<string, ScenePoint>;
  lineById: Map<string, SceneLine>;
  segmentById: Map<string, SceneSegment>;
  circleById: Map<string, SceneCircle>;
  lineInProgress: Set<string>;
  stats: SceneEvalStats;
  explicit: boolean;
};

const sceneEvalContexts = new WeakMap<SceneModel, SceneEvalContext>();
const sceneLastEvalStats = new WeakMap<SceneModel, SceneEvalStats>();
const lastResolvedPointWorld = new Map<string, { value: Vec2; signature: string }>();
let sceneEvalTick = 0;

function isEvalDebugEnabled(): boolean {
  const globalFlag = (globalThis as { __GEODRAW_EVAL_DEBUG__?: unknown }).__GEODRAW_EVAL_DEBUG__;
  if (globalFlag === true || globalFlag === "1") return true;
  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (maybeProcess?.env?.GEODRAW_EVAL_DEBUG === "1") return true;
  return false;
}

function formatEvalStats(stats: SceneEvalStats): string {
  return `tick=${stats.tick} dirtyNodes=${stats.dirtyNodes} evalCalls=${stats.totalNodeEvalCalls} cacheHits=${stats.cacheHits} circleCircle=${stats.circleCircleCalls} circleLine=${stats.circleLineCalls} lineLine=${stats.lineLineCalls} alloc=${stats.allocationsEstimate} ms=${stats.ms.toFixed(
    2
  )}`;
}

function buildSceneEvalContext(scene: SceneModel, explicit: boolean): SceneEvalContext {
  const pointById = new Map<string, ScenePoint>();
  for (const point of scene.points) pointById.set(point.id, point);
  const lineById = new Map<string, SceneLine>();
  for (const line of scene.lines) lineById.set(line.id, line);
  const segmentById = new Map<string, SceneSegment>();
  for (const seg of scene.segments) segmentById.set(seg.id, seg);
  const circleById = new Map<string, SceneCircle>();
  for (const circle of scene.circles) circleById.set(circle.id, circle);
  return {
    tick: ++sceneEvalTick,
    startedAt: performance.now(),
    pointCache: new Map<string, Vec2 | null>(),
    inProgress: new Set<string>(),
    pointById,
    lineById,
    segmentById,
    circleById,
    lineInProgress: new Set<string>(),
    stats: {
      tick: sceneEvalTick,
      dirtyNodes: scene.points.length,
      totalNodeEvalCalls: 0,
      cacheHits: 0,
      circleCircleCalls: 0,
      circleLineCalls: 0,
      lineLineCalls: 0,
      allocationsEstimate: 0,
      ms: 0,
    },
    explicit,
  };
}

function getOrCreateSceneEvalContext(scene: SceneModel): SceneEvalContext {
  const existing = sceneEvalContexts.get(scene);
  if (existing) return existing;
  const next = buildSceneEvalContext(scene, false);
  sceneEvalContexts.set(scene, next);
  return next;
}

export function beginSceneEvalTick(scene: SceneModel): void {
  sceneEvalContexts.set(scene, buildSceneEvalContext(scene, true));
}

export function endSceneEvalTick(scene: SceneModel): SceneEvalStats | null {
  const ctx = sceneEvalContexts.get(scene);
  if (!ctx) return null;
  ctx.stats.ms = performance.now() - ctx.startedAt;
  const snapshot = { ...ctx.stats };
  sceneLastEvalStats.set(scene, snapshot);
  sceneEvalContexts.delete(scene);
  if (isEvalDebugEnabled()) {
    console.log(formatEvalStats(snapshot));
  }
  return snapshot;
}

export function getLastSceneEvalStats(scene: SceneModel): SceneEvalStats | null {
  return sceneLastEvalStats.get(scene) ?? null;
}

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
  void visited;
  const ctx = getOrCreateSceneEvalContext(scene);
  const value = evalPoint(point.id, scene, ctx);
  if (!ctx.explicit) {
    ctx.stats.ms = performance.now() - ctx.startedAt;
    sceneLastEvalStats.set(scene, { ...ctx.stats });
  }
  return value;
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

function evalPoint(pointId: string, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  const cached = ctx.pointCache.get(pointId);
  if (cached !== undefined) {
    ctx.stats.cacheHits += 1;
    return cached;
  }
  if (ctx.inProgress.has(pointId)) {
    // Cycle guard: return transient null without caching, otherwise we may
    // incorrectly freeze a valid downstream point as null for this tick.
    return null;
  }
  const point = ctx.pointById.get(pointId);
  if (!point) {
    ctx.pointCache.set(pointId, null);
    return null;
  }
  ctx.inProgress.add(pointId);
  ctx.stats.totalNodeEvalCalls += 1;
  const computed = evalPointUnchecked(point, scene, ctx);
  if (computed !== null) {
    ctx.pointCache.set(pointId, computed);
  }
  ctx.inProgress.delete(pointId);
  return computed;
}

function evalPointUnchecked(point: ScenePoint, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  if (point.kind === "free") return point.position;

  if (point.kind === "midpointPoints") {
    const pa = getPointWorldById(point.aId, scene, ctx);
    const pb = getPointWorldById(point.bId, scene, ctx);
    if (!pa || !pb) return null;
    ctx.stats.allocationsEstimate += 1;
    return { x: (pa.x + pb.x) * 0.5, y: (pa.y + pb.y) * 0.5 };
  }

  if (point.kind === "midpointSegment") {
    const seg = ctx.segmentById.get(point.segId);
    if (!seg) return null;
    const pa = getPointWorldById(seg.aId, scene, ctx);
    const pb = getPointWorldById(seg.bId, scene, ctx);
    if (!pa || !pb) return null;
    ctx.stats.allocationsEstimate += 1;
    return { x: (pa.x + pb.x) * 0.5, y: (pa.y + pb.y) * 0.5 };
  }

  if (point.kind === "pointOnLine") {
    const line = ctx.lineById.get(point.lineId);
    if (!line) return null;
    const anchors = resolveLineAnchors(line, scene, ctx);
    if (!anchors) return null;
    ctx.stats.allocationsEstimate += 1;
    return add(anchors.a, mul(sub(anchors.b, anchors.a), point.s));
  }

  if (point.kind === "pointOnSegment") {
    const seg = ctx.segmentById.get(point.segId);
    if (!seg) return null;
    const a = getPointWorldById(seg.aId, scene, ctx);
    const b = getPointWorldById(seg.bId, scene, ctx);
    if (!a || !b) return null;
    ctx.stats.allocationsEstimate += 1;
    return add(a, mul(sub(b, a), clamp(point.u, 0, 1)));
  }

  if (point.kind === "pointOnCircle") {
    const circle = ctx.circleById.get(point.circleId);
    if (!circle) return null;
    const center = getPointWorldById(circle.centerId, scene, ctx);
    const through = getPointWorldById(circle.throughId, scene, ctx);
    if (!center || !through) return null;
    const radius = distance(center, through);
    ctx.stats.allocationsEstimate += 1;
    return {
      x: center.x + Math.cos(point.t) * radius,
      y: center.y + Math.sin(point.t) * radius,
    };
  }

  if (point.kind === "circleLineIntersectionPoint") {
    const circle = ctx.circleById.get(point.circleId);
    const line = ctx.lineById.get(point.lineId);
    if (!circle || !line) return null;
    const center = getPointWorldById(circle.centerId, scene, ctx);
    const through = getPointWorldById(circle.throughId, scene, ctx);
    const anchors = resolveLineAnchors(line, scene, ctx);
    if (!center || !through || !anchors) return null;
    const la = anchors.a;
    const lb = anchors.b;
    const r = distance(center, through);
    const stabilitySignature = circleLineStabilitySignature(point.circleId, point.lineId, la, lb, center, r);
    ctx.stats.circleLineCalls += 1;
    const branches = lineCircleIntersectionBranches(la, lb, center, r);
    if (branches.length === 0) return null;

    if (point.excludePointId) {
      const excluded = getPointWorldById(point.excludePointId, scene, ctx);
      if (excluded) {
        const ROOT_EPS = 1e-6;
        let chosenOther: Vec2 | null = null;
        let excludedHits = 0;
        for (let i = 0; i < branches.length; i += 1) {
          const p = branches[i].point;
          if (distance(p, excluded) <= ROOT_EPS) {
            excludedHits += 1;
            continue;
          }
          chosenOther = p;
          break;
        }
        if (chosenOther) {
          rememberStableCircleLinePoint(point.id, stabilitySignature, chosenOther);
          return chosenOther;
        }
        if (branches.length === 1 || excludedHits === branches.length) return null;
      }
    }

    if (branches.length === 1) {
      rememberStableCircleLinePoint(point.id, stabilitySignature, branches[0].point);
      return branches[0].point;
    }
    // IMPORTANT: branchIndex semantics must match creation-time semantics.
    // lineCircleIntersectionBranches returns roots ordered by line parameter t (t1 <= t2),
    // so we must use that exact ordering here too (not x/y ordering).
    const root0 = branches[0].point;
    const root1 = branches[1].point;
    let chosen = point.branchIndex === 1 ? root1 : root0;
    let other = point.branchIndex === 1 ? root0 : root1;
    const prevWorld = getPreviousStableCircleLinePoint(point.id, stabilitySignature);
    if (prevWorld) {
      const d0 = distance(root0, prevWorld);
      const d1 = distance(root1, prevWorld);
      if (Math.abs(d0 - d1) > 1e-9) {
        chosen = d0 <= d1 ? root0 : root1;
        other = chosen === root0 ? root1 : root0;
      }
    }
    const ROOT_EPS = 1e-6;

    for (const item of scene.points) {
      if (item.id === point.id || item.kind !== "circleLineIntersectionPoint") continue;
      if (item.circleId !== point.circleId || item.lineId !== point.lineId) continue;
      const siblingWorld = evalPoint(item.id, scene, ctx);
      if (!siblingWorld) continue;
      const siblingNearChosen = distance(siblingWorld, chosen) <= ROOT_EPS;
      const siblingNearOther = distance(siblingWorld, other) <= ROOT_EPS;
      if (siblingNearChosen && !siblingNearOther) {
        rememberStableCircleLinePoint(point.id, stabilitySignature, other);
        return other;
      }
    }
    rememberStableCircleLinePoint(point.id, stabilitySignature, chosen);
    return chosen;
  }

  const intersections = objectIntersections(point.objA, point.objB, scene, ctx);
  if (intersections.length === 0) return null;
  if (point.excludePointId) {
    const excluded = getPointWorldById(point.excludePointId, scene, ctx);
    if (excluded) {
      const ROOT_EPS = 1e-6;
      let candidateCount = 0;
      let candidateA: Vec2 | null = null;
      let candidateB: Vec2 | null = null;
      for (let i = 0; i < intersections.length; i += 1) {
        const candidate = intersections[i];
        if (distance(candidate, excluded) <= ROOT_EPS) continue;
        if (candidateCount === 0) candidateA = candidate;
        else if (candidateCount === 1) candidateB = candidate;
        candidateCount += 1;
      }
      if (candidateCount === 1 && candidateA) return candidateA;
      if (candidateCount >= 2 && candidateA && candidateB) {
        return chooseClosestToPreferredPair(candidateA, candidateB, point.preferredWorld);
      }
      if (intersections.length === 1) return null;
    }
  }
  return chooseStableIntersection(intersections, point.preferredWorld, scene, point.id, ctx);
}

function getPointWorldById(pointId: string, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPoint(pointId, scene, ctx);
}

function objectIntersections(
  a: GeometryObjectRef,
  b: GeometryObjectRef,
  scene: SceneModel,
  ctx: SceneEvalContext
): Vec2[] {
  const la = asLineLike(a, scene, ctx);
  const lb = asLineLike(b, scene, ctx);
  if (la && lb) {
    ctx.stats.lineLineCalls += 1;
    const p = lineLineIntersection(la.a, la.b, lb.a, lb.b);
    if (!p) return [];
    if (!lineLikeContainsPoint(la, p)) return [];
    if (!lineLikeContainsPoint(lb, p)) return [];
    ctx.stats.allocationsEstimate += 1;
    return [p];
  }

  const circleA = asCircle(a, scene, ctx);
  const circleB = asCircle(b, scene, ctx);

  if (la && circleB) {
    ctx.stats.circleLineCalls += 1;
    return lineCircleIntersections(la.a, la.b, circleB.center, circleB.radius).filter((p) =>
      lineLikeContainsPoint(la, p)
    );
  }
  if (lb && circleA) {
    ctx.stats.circleLineCalls += 1;
    return lineCircleIntersections(lb.a, lb.b, circleA.center, circleA.radius).filter((p) =>
      lineLikeContainsPoint(lb, p)
    );
  }
  if (circleA && circleB) {
    ctx.stats.circleCircleCalls += 1;
    return circleCircleIntersections(circleA.center, circleA.radius, circleB.center, circleB.radius);
  }
  return [];
}

function asLineLike(
  ref: GeometryObjectRef,
  scene: SceneModel,
  ctx: SceneEvalContext
): { a: Vec2; b: Vec2; finite: boolean } | null {
  if (ref.type === "line") {
    const line = ctx.lineById.get(ref.id);
    if (!line) return null;
    const anchors = resolveLineAnchors(line, scene, ctx);
    if (!anchors) return null;
    return { a: anchors.a, b: anchors.b, finite: false };
  }

  if (ref.type === "segment") {
    const seg = ctx.segmentById.get(ref.id);
    if (!seg) return null;
    const a = getPointWorldById(seg.aId, scene, ctx);
    const b = getPointWorldById(seg.bId, scene, ctx);
    if (!a || !b) return null;
    return { a, b, finite: true };
  }

  return null;
}

function resolveLineAnchors(
  line: SceneLine,
  scene: SceneModel,
  ctx: SceneEvalContext
): { a: Vec2; b: Vec2 } | null {
  if (ctx.lineInProgress.has(line.id)) return null;
  ctx.lineInProgress.add(line.id);
  try {
    if (line.kind !== "perpendicular") {
      const a = getPointWorldById(line.aId, scene, ctx);
      const b = getPointWorldById(line.bId, scene, ctx);
      if (!a || !b) return null;
      return { a, b };
    }

    const through = getPointWorldById(line.throughId, scene, ctx);
    if (!through) return null;
    const base = resolveLineLikeRefAnchors(line.base, scene, ctx);
    if (!base) return null;
    const dx = base.b.x - base.a.x;
    const dy = base.b.y - base.a.y;
    if (dx * dx + dy * dy <= 1e-12) return null;
    return {
      a: through,
      b: {
        x: through.x - dy,
        y: through.y + dx,
      },
    };
  } finally {
    ctx.lineInProgress.delete(line.id);
  }
}

function resolveLineLikeRefAnchors(
  ref: LineLikeObjectRef,
  scene: SceneModel,
  ctx: SceneEvalContext
): { a: Vec2; b: Vec2 } | null {
  if (ref.type === "segment") {
    const seg = ctx.segmentById.get(ref.id);
    if (!seg) return null;
    const a = getPointWorldById(seg.aId, scene, ctx);
    const b = getPointWorldById(seg.bId, scene, ctx);
    if (!a || !b) return null;
    return { a, b };
  }
  const line = ctx.lineById.get(ref.id);
  if (!line) return null;
  return resolveLineAnchors(line, scene, ctx);
}

export function getLineWorldAnchors(line: SceneLine, scene: SceneModel): { a: Vec2; b: Vec2 } | null {
  const ctx = getOrCreateSceneEvalContext(scene);
  const value = resolveLineAnchors(line, scene, ctx);
  if (!ctx.explicit) {
    ctx.stats.ms = performance.now() - ctx.startedAt;
    sceneLastEvalStats.set(scene, { ...ctx.stats });
  }
  return value;
}

function asCircle(
  ref: GeometryObjectRef,
  scene: SceneModel,
  ctx: SceneEvalContext
): { center: Vec2; radius: number } | null {
  if (ref.type !== "circle") return null;
  const circle = ctx.circleById.get(ref.id);
  if (!circle) return null;
  const center = getPointWorldById(circle.centerId, scene, ctx);
  const through = getPointWorldById(circle.throughId, scene, ctx);
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

function chooseClosestToPreferredPair(a: Vec2, b: Vec2, preferredWorld: Vec2): Vec2 {
  return distance(a, preferredWorld) <= distance(b, preferredWorld) ? a : b;
}

function chooseStableIntersection(
  intersections: Vec2[],
  preferredWorld: Vec2,
  scene: SceneModel,
  selfPointId: string,
  ctx: SceneEvalContext
): Vec2 {
  if (intersections.length >= 2) {
    const ROOT_EPS = 1e-6;
    const occupied = [false, false];
    for (const scenePoint of scene.points) {
      if (scenePoint.id === selfPointId) continue;
      if (scenePoint.kind !== "intersectionPoint" && scenePoint.kind !== "circleLineIntersectionPoint") continue;
      const world = evalPoint(scenePoint.id, scene, ctx);
      if (!world) continue;
      if (!occupied[0] && distance(world, intersections[0]) <= ROOT_EPS) occupied[0] = true;
      if (!occupied[1] && distance(world, intersections[1]) <= ROOT_EPS) occupied[1] = true;
      if (occupied[0] && occupied[1]) break;
    }
    if (occupied[0] !== occupied[1]) {
      return occupied[0] ? intersections[1] : intersections[0];
    }
  }
  return chooseClosestToPreferred(intersections, preferredWorld);
}

function roundSig(value: number): string {
  return value.toFixed(6);
}

function circleLineStabilitySignature(
  circleId: string,
  lineId: string,
  la: Vec2,
  lb: Vec2,
  center: Vec2,
  radius: number
): string {
  return `cli:${circleId}:${lineId}:${roundSig(la.x)}:${roundSig(la.y)}:${roundSig(lb.x)}:${roundSig(
    lb.y
  )}:${roundSig(center.x)}:${roundSig(center.y)}:${roundSig(radius)}`;
}

function getPreviousStableCircleLinePoint(pointId: string, signature: string): Vec2 | null {
  const prev = lastResolvedPointWorld.get(pointId);
  if (!prev) return null;
  if (prev.signature !== signature) return null;
  return prev.value;
}

function rememberStableCircleLinePoint(pointId: string, signature: string, value: Vec2): void {
  lastResolvedPointWorld.set(pointId, { value, signature });
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
