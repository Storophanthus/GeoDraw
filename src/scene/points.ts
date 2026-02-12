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
  segmentMark?: {
    enabled: boolean;
    mark: "none" | "|" | "||" | "|||" | "s" | "s|" | "s||" | "x" | "o" | "oo" | "z";
    pos: number;
    sizePt: number;
    color?: string;
    lineWidthPt?: number;
  };
  segmentArrowMark?: {
    enabled: boolean;
    mode: "end" | "mid";
    direction: "->" | "<-" | "<->";
    pos?: number;
    distribution?: "single" | "multi";
    startPos?: number;
    endPos?: number;
    step?: number;
    sizeScale?: number;
    color?: string;
    lineWidthPt?: number;
  };
};

export type CircleStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeDash: "solid" | "dashed" | "dotted";
  strokeOpacity: number;
  fillColor?: string;
  fillOpacity?: number;
};

export type AngleMarkStyle = "arc" | "right" | "none";

export type AngleStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  textColor: string;
  textSize: number;
  fillEnabled: boolean;
  fillColor: string;
  fillOpacity: number;
  markStyle: AngleMarkStyle;
  arcRadius: number;
  labelText: string;
  labelPosWorld: Vec2;
  showLabel: boolean;
  showValue: boolean;
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

export type PointByRotation = {
  id: string;
  kind: "pointByRotation";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  centerId: string;
  pointId: string;
  angleDeg?: number;
  angleExpr?: string;
  direction: "CCW" | "CW";
  radiusMode: "keep";
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
  | PointByRotation
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

export type SceneLineParallel = {
  id: string;
  kind: "parallel";
  throughId: string;
  base: LineLikeObjectRef;
  visible: boolean;
  style: LineStyle;
};

export type SceneLineAngleBisector = {
  id: string;
  kind: "angleBisector";
  aId: string;
  bId: string;
  cId: string;
  visible: boolean;
  style: LineStyle;
};

export type SceneLine = SceneLineTwoPoint | SceneLinePerpendicular | SceneLineParallel | SceneLineAngleBisector;

export type SceneCircleTwoPoint = {
  id: string;
  kind?: "twoPoint";
  centerId: string;
  throughId: string;
  visible: boolean;
  style: CircleStyle;
};

export type SceneCircleThreePoint = {
  id: string;
  kind: "threePoint";
  aId: string;
  bId: string;
  cId: string;
  visible: boolean;
  style: CircleStyle;
};

export type SceneCircleFixedRadius = {
  id: string;
  kind: "fixedRadius";
  centerId: string;
  radius: number;
  radiusExpr?: string;
  visible: boolean;
  style: CircleStyle;
};

export type SceneCircle = SceneCircleTwoPoint | SceneCircleThreePoint | SceneCircleFixedRadius;

export type SceneAngle = {
  id: string;
  aId: string;
  bId: string;
  cId: string;
  visible: boolean;
  style: AngleStyle;
};

export type SceneNumberConstant = {
  kind: "constant";
  value: number;
};

export type SceneNumberDistancePoints = {
  kind: "distancePoints";
  aId: string;
  bId: string;
};

export type SceneNumberSegmentLength = {
  kind: "segmentLength";
  segId: string;
};

export type SceneNumberCircleRadius = {
  kind: "circleRadius";
  circleId: string;
};

export type SceneNumberCircleArea = {
  kind: "circleArea";
  circleId: string;
};

export type SceneNumberAngleDegrees = {
  kind: "angleDegrees";
  angleId: string;
};

export type SceneNumberRatio = {
  kind: "ratio";
  numeratorId: string;
  denominatorId: string;
};

export type SceneNumberExpression = {
  kind: "expression";
  expr: string;
};

export type SceneNumberDefinition =
  | SceneNumberConstant
  | SceneNumberDistancePoints
  | SceneNumberSegmentLength
  | SceneNumberCircleRadius
  | SceneNumberCircleArea
  | SceneNumberAngleDegrees
  | SceneNumberRatio
  | SceneNumberExpression;

export type SceneNumber = {
  id: string;
  name: string;
  visible: boolean;
  definition: SceneNumberDefinition;
};

export type SceneModel = {
  points: ScenePoint[];
  segments: SceneSegment[];
  lines: SceneLine[];
  circles: SceneCircle[];
  angles: SceneAngle[];
  numbers: SceneNumber[];
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
  angleById: Map<string, SceneAngle>;
  numberById: Map<string, SceneNumber>;
  numberCache: Map<string, number>;
  numberInProgress: Set<string>;
  lineInProgress: Set<string>;
  circleLinePairAssignments: Map<string, Map<string, Vec2 | null>>;
  genericIntersectionPairAssignments: Map<string, Map<string, Vec2 | null>>;
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
  const angleById = new Map<string, SceneAngle>();
  for (const angle of scene.angles) angleById.set(angle.id, angle);
  const numberById = new Map<string, SceneNumber>();
  for (const num of scene.numbers) numberById.set(num.id, num);
  return {
    tick: ++sceneEvalTick,
    startedAt: performance.now(),
    pointCache: new Map<string, Vec2 | null>(),
    inProgress: new Set<string>(),
    pointById,
    lineById,
    segmentById,
    circleById,
    angleById,
    numberById,
    numberCache: new Map<string, number>(),
    numberInProgress: new Set<string>(),
    lineInProgress: new Set<string>(),
    circleLinePairAssignments: new Map<string, Map<string, Vec2 | null>>(),
    genericIntersectionPairAssignments: new Map<string, Map<string, Vec2 | null>>(),
    stats: {
      tick: sceneEvalTick,
      dirtyNodes: scene.points.length + scene.numbers.length,
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
    const geom = getCircleWorldGeometryWithCtx(circle, scene, ctx);
    if (!geom) return null;
    const { center, radius } = geom;
    ctx.stats.allocationsEstimate += 1;
    return {
      x: center.x + Math.cos(point.t) * radius,
      y: center.y + Math.sin(point.t) * radius,
    };
  }

  if (point.kind === "pointByRotation") {
    const center = getPointWorldById(point.centerId, scene, ctx);
    const base = getPointWorldById(point.pointId, scene, ctx);
    if (!center || !base) return null;
    const vx = base.x - center.x;
    const vy = base.y - center.y;
    const len = Math.hypot(vx, vy);
    if (len <= 1e-12) return null;
    const expr = point.angleExpr ?? String(point.angleDeg ?? "");
    const exprEval = evaluateAngleExpressionDegreesWithCtx(scene, expr, ctx);
    if (!exprEval.ok) return null;
    const sign = point.direction === "CCW" ? 1 : -1;
    const theta = (exprEval.valueDeg * Math.PI) / 180;
    const c = Math.cos(sign * theta);
    const s = Math.sin(sign * theta);
    ctx.stats.allocationsEstimate += 1;
    return {
      x: center.x + vx * c - vy * s,
      y: center.y + vx * s + vy * c,
    };
  }

  if (point.kind === "circleLineIntersectionPoint") {
    const circle = ctx.circleById.get(point.circleId);
    const line = ctx.lineById.get(point.lineId);
    if (!circle || !line) return null;
    const geom = getCircleWorldGeometryWithCtx(circle, scene, ctx);
    const anchors = resolveLineAnchors(line, scene, ctx);
    if (!geom || !anchors) return null;
    const la = anchors.a;
    const lb = anchors.b;
    const center = geom.center;
    const r = geom.radius;
    const stabilitySignature = circleLineStabilitySignature(point.circleId, point.lineId, la, lb, center, r);
    ctx.stats.circleLineCalls += 1;
    const branches = lineCircleIntersectionBranches(la, lb, center, r);
    if (branches.length === 0) return null;

    const pairResolved = resolveCircleLinePairAssignments(
      scene,
      ctx,
      point.circleId,
      point.lineId,
      branches,
      stabilitySignature
    );
    if (!pairResolved.has(point.id)) return null;
    const chosen = pairResolved.get(point.id) ?? null;
    if (!chosen) return null;
    rememberStableCircleLinePoint(point.id, stabilitySignature, chosen);
    return chosen;
  }

  const intersections = objectIntersections(point.objA, point.objB, scene, ctx);
  if (intersections.length === 0) return null;
  const pairResolved = resolveGenericIntersectionPairAssignments(
    scene,
    ctx,
    point.objA,
    point.objB,
    intersections
  );
  if (!pairResolved.has(point.id)) return null;
  const chosen = pairResolved.get(point.id) ?? null;
  if (!chosen) return null;
  rememberStableGenericIntersectionPoint(point.id, point.objA, point.objB, chosen);
  return chosen;
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
    if (line.kind !== "perpendicular" && line.kind !== "parallel" && line.kind !== "angleBisector") {
      const a = getPointWorldById(line.aId, scene, ctx);
      const b = getPointWorldById(line.bId, scene, ctx);
      if (!a || !b) return null;
      return { a, b };
    }

    if (line.kind === "angleBisector") {
      const a = getPointWorldById(line.aId, scene, ctx);
      const b = getPointWorldById(line.bId, scene, ctx);
      const c = getPointWorldById(line.cId, scene, ctx);
      if (!a || !b || !c) return null;
      const ba = { x: a.x - b.x, y: a.y - b.y };
      const bc = { x: c.x - b.x, y: c.y - b.y };
      const baLen = Math.hypot(ba.x, ba.y);
      const bcLen = Math.hypot(bc.x, bc.y);
      if (baLen <= 1e-12 || bcLen <= 1e-12) return null;
      const u = { x: ba.x / baLen, y: ba.y / baLen };
      const v = { x: bc.x / bcLen, y: bc.y / bcLen };
      const bis = { x: u.x + v.x, y: u.y + v.y };
      const bisLen = Math.hypot(bis.x, bis.y);
      // Degenerate straight angle: no unique internal bisector direction.
      if (bisLen <= 1e-12) return null;
      return {
        a: b,
        b: {
          x: b.x + bis.x,
          y: b.y + bis.y,
        },
      };
    }

    const through = getPointWorldById(line.throughId, scene, ctx);
    if (!through) return null;
    const base = resolveLineLikeRefAnchors(line.base, scene, ctx);
    if (!base) return null;
    const dx = base.b.x - base.a.x;
    const dy = base.b.y - base.a.y;
    if (dx * dx + dy * dy <= 1e-12) return null;
    if (line.kind === "parallel") {
      return {
        a: through,
        b: {
          x: through.x + dx,
          y: through.y + dy,
        },
      };
    }
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
  return getCircleWorldGeometryWithCtx(circle, scene, ctx);
}

function getCircleWorldGeometryWithCtx(
  circle: SceneCircle,
  scene: SceneModel,
  ctx: SceneEvalContext
): { center: Vec2; radius: number } | null {
  if (circle.kind === "threePoint") {
    const a = getPointWorldById(circle.aId, scene, ctx);
    const b = getPointWorldById(circle.bId, scene, ctx);
    const c = getPointWorldById(circle.cId, scene, ctx);
    if (!a || !b || !c) return null;
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) <= 1e-12) return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    const center = {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    };
    const radius = distance(center, a);
    if (!Number.isFinite(radius) || radius <= 1e-12) return null;
    return { center, radius };
  }

  const center = getPointWorldById(circle.centerId, scene, ctx);
  if (!center) return null;
  if (circle.kind === "fixedRadius") {
    let radius = circle.radius;
    if (circle.radiusExpr && circle.radiusExpr.trim().length > 0) {
      const evaluated = evaluateNumberExpressionWithCtx(scene, circle.radiusExpr.trim(), ctx);
      if (!evaluated.ok || !Number.isFinite(evaluated.value) || evaluated.value <= 1e-12) return null;
      radius = evaluated.value;
    }
    if (!Number.isFinite(radius) || radius <= 1e-12) return null;
    return { center, radius };
  }
  const through = getPointWorldById(circle.throughId, scene, ctx);
  if (!through) return null;
  const radius = distance(center, through);
  if (!Number.isFinite(radius) || radius <= 1e-12) return null;
  return { center, radius };
}

export function getCircleWorldGeometry(circle: SceneCircle, scene: SceneModel): { center: Vec2; radius: number } | null {
  const ctx = getOrCreateSceneEvalContext(scene);
  const value = getCircleWorldGeometryWithCtx(circle, scene, ctx);
  if (!ctx.explicit) {
    ctx.stats.ms = performance.now() - ctx.startedAt;
    sceneLastEvalStats.set(scene, { ...ctx.stats });
  }
  return value;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function circleLineStabilitySignature(
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

function genericIntersectionPairKey(a: GeometryObjectRef, b: GeometryObjectRef): string {
  const ak = objectRefKey(a);
  const bk = objectRefKey(b);
  return ak <= bk ? `${ak}|${bk}` : `${bk}|${ak}`;
}

function resolveCircleLinePairAssignments(
  scene: SceneModel,
  ctx: SceneEvalContext,
  circleId: string,
  lineId: string,
  branches: Array<{ point: Vec2; t: number }>,
  stabilitySignature: string
): Map<string, Vec2 | null> {
  const key = circleLinePairKey(circleId, lineId);
  const cached = ctx.circleLinePairAssignments.get(key);
  if (cached) return cached;

  const out = new Map<string, Vec2 | null>();
  const pairPoints: CircleLineIntersectionPoint[] = [];
  for (const item of scene.points) {
    if (item.kind !== "circleLineIntersectionPoint") continue;
    if (item.circleId !== circleId || item.lineId !== lineId) continue;
    pairPoints.push(item);
  }
  if (pairPoints.length === 0) {
    ctx.circleLinePairAssignments.set(key, out);
    return out;
  }

  if (branches.length === 0) {
    for (const item of pairPoints) out.set(item.id, null);
    ctx.circleLinePairAssignments.set(key, out);
    return out;
  }

  const ROOT_EPS = 1e-6;
  if (branches.length === 1) {
    const root = branches[0].point;
    for (const item of pairPoints) {
      let result: Vec2 | null = root;
      if (item.excludePointId) {
        const excluded = getPointWorldById(item.excludePointId, scene, ctx);
        if (excluded && distance(excluded, root) <= ROOT_EPS) {
          result = null;
        }
      }
      if (result) rememberStableCircleLinePoint(item.id, stabilitySignature, result);
      out.set(item.id, result);
    }
    ctx.circleLinePairAssignments.set(key, out);
    return out;
  }

  const root0 = branches[0].point;
  const root1 = branches[1].point;
  type AssignmentRequest = {
    point: CircleLineIntersectionPoint;
    candidates: [0 | 1, 0 | 1];
    forced: boolean;
    hasPrev: boolean;
    order: number;
  };
  const requests: AssignmentRequest[] = [];
  for (let i = 0; i < pairPoints.length; i += 1) {
    const item = pairPoints[i];
    let forcedCandidate: 0 | 1 | null = null;
    if (item.excludePointId) {
      const excluded = getPointWorldById(item.excludePointId, scene, ctx);
      if (excluded) {
        const d0 = distance(root0, excluded);
        const d1 = distance(root1, excluded);
        if (d0 <= ROOT_EPS && d1 > ROOT_EPS) forcedCandidate = 1;
        else if (d1 <= ROOT_EPS && d0 > ROOT_EPS) forcedCandidate = 0;
        else if (d0 <= ROOT_EPS && d1 <= ROOT_EPS) {
          out.set(item.id, null);
          continue;
        }
      }
    }

    const prev = getPreviousStableCircleLinePoint(item.id, stabilitySignature);
    let primary: 0 | 1 = item.branchIndex === 1 ? 1 : 0;
    if (forcedCandidate !== null) {
      primary = forcedCandidate;
    } else if (prev) {
      const d0 = distance(root0, prev);
      const d1 = distance(root1, prev);
      if (Math.abs(d0 - d1) > 1e-9) primary = d0 <= d1 ? 0 : 1;
    }
    const secondary: 0 | 1 = primary === 0 ? 1 : 0;
    requests.push({
      point: item,
      candidates: [primary, secondary],
      forced: forcedCandidate !== null,
      hasPrev: prev !== null,
      order: i,
    });
  }

  requests.sort((a, b) => {
    if (a.forced !== b.forced) return a.forced ? -1 : 1;
    if (a.hasPrev !== b.hasPrev) return a.hasPrev ? -1 : 1;
    return a.order - b.order;
  });

  const used = new Set<0 | 1>();
  for (const req of requests) {
    let chosenIdx: 0 | 1 | null = null;
    if (!used.has(req.candidates[0])) {
      chosenIdx = req.candidates[0];
    } else if (!used.has(req.candidates[1])) {
      chosenIdx = req.candidates[1];
    } else {
      // More than two points may legitimately exist on the same pair.
      // Keep deterministic fallback to primary candidate.
      chosenIdx = req.candidates[0];
    }
    if (!used.has(chosenIdx)) used.add(chosenIdx);
    out.set(req.point.id, chosenIdx === 0 ? root0 : root1);
  }

  ctx.circleLinePairAssignments.set(key, out);
  return out;
}

function genericIntersectionSignature(a: GeometryObjectRef, b: GeometryObjectRef): string {
  return `gix:${genericIntersectionPairKey(a, b)}`;
}

function getPreviousStableGenericIntersectionPoint(
  pointId: string,
  a: GeometryObjectRef,
  b: GeometryObjectRef
): Vec2 | null {
  return getPreviousStableCircleLinePoint(pointId, genericIntersectionSignature(a, b));
}

function rememberStableGenericIntersectionPoint(
  pointId: string,
  a: GeometryObjectRef,
  b: GeometryObjectRef,
  value: Vec2
): void {
  rememberStableCircleLinePoint(pointId, genericIntersectionSignature(a, b), value);
}

function sameObjectRef(a: GeometryObjectRef, b: GeometryObjectRef): boolean {
  return a.type === b.type && a.id === b.id;
}

function sameObjectPair(a1: GeometryObjectRef, b1: GeometryObjectRef, a2: GeometryObjectRef, b2: GeometryObjectRef): boolean {
  return (sameObjectRef(a1, a2) && sameObjectRef(b1, b2)) || (sameObjectRef(a1, b2) && sameObjectRef(b1, a2));
}

function resolveGenericIntersectionPairAssignments(
  scene: SceneModel,
  ctx: SceneEvalContext,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  intersections: Vec2[]
): Map<string, Vec2 | null> {
  const key = genericIntersectionPairKey(objA, objB);
  const cached = ctx.genericIntersectionPairAssignments.get(key);
  if (cached) return cached;

  const out = new Map<string, Vec2 | null>();
  const pairPoints: IntersectionPoint[] = [];
  for (const item of scene.points) {
    if (item.kind !== "intersectionPoint") continue;
    if (!sameObjectPair(item.objA, item.objB, objA, objB)) continue;
    pairPoints.push(item);
  }
  if (pairPoints.length === 0) {
    ctx.genericIntersectionPairAssignments.set(key, out);
    return out;
  }

  if (intersections.length === 0) {
    for (const item of pairPoints) out.set(item.id, null);
    ctx.genericIntersectionPairAssignments.set(key, out);
    return out;
  }

  const ROOT_EPS = 1e-6;
  if (intersections.length === 1) {
    const root = intersections[0];
    for (const item of pairPoints) {
      let result: Vec2 | null = root;
      if (item.excludePointId) {
        const excluded = getPointWorldById(item.excludePointId, scene, ctx);
        if (excluded && distance(excluded, root) <= ROOT_EPS) {
          result = null;
        }
      }
      out.set(item.id, result);
      if (result) rememberStableGenericIntersectionPoint(item.id, objA, objB, result);
    }
    ctx.genericIntersectionPairAssignments.set(key, out);
    return out;
  }

  // Two-root ownership assignment.
  const root0 = intersections[0];
  const root1 = intersections[1];
  type AssignmentRequest = {
    point: IntersectionPoint;
    candidates: [0 | 1, 0 | 1];
    forced: boolean;
    hasPrev: boolean;
    order: number;
  };
  const requests: AssignmentRequest[] = [];
  for (let i = 0; i < pairPoints.length; i += 1) {
    const item = pairPoints[i];
    let forcedCandidate: 0 | 1 | null = null;
    if (item.excludePointId) {
      const excluded = getPointWorldById(item.excludePointId, scene, ctx);
      if (excluded) {
        const d0 = distance(root0, excluded);
        const d1 = distance(root1, excluded);
        if (d0 <= ROOT_EPS && d1 > ROOT_EPS) forcedCandidate = 1;
        else if (d1 <= ROOT_EPS && d0 > ROOT_EPS) forcedCandidate = 0;
        else if (d0 <= ROOT_EPS && d1 <= ROOT_EPS) {
          out.set(item.id, null);
          continue;
        }
      }
    }
    let primary: 0 | 1;
    const prev = getPreviousStableGenericIntersectionPoint(item.id, objA, objB);
    if (forcedCandidate !== null) {
      primary = forcedCandidate;
    } else if (prev) {
      const d0 = distance(root0, prev);
      const d1 = distance(root1, prev);
      primary = d0 <= d1 ? 0 : 1;
    } else {
      primary = distance(root0, item.preferredWorld) <= distance(root1, item.preferredWorld) ? 0 : 1;
    }
    const secondary: 0 | 1 = primary === 0 ? 1 : 0;
    requests.push({
      point: item,
      candidates: [primary, secondary],
      forced: forcedCandidate !== null,
      hasPrev: prev !== null,
      order: i,
    });
  }

  requests.sort((a, b) => {
    if (a.forced !== b.forced) return a.forced ? -1 : 1;
    if (a.hasPrev !== b.hasPrev) return a.hasPrev ? -1 : 1;
    return a.order - b.order;
  });

  const used = new Set<0 | 1>();
  for (const req of requests) {
    let chosenIdx: 0 | 1;
    if (!used.has(req.candidates[0])) chosenIdx = req.candidates[0];
    else if (!used.has(req.candidates[1])) chosenIdx = req.candidates[1];
    else chosenIdx = req.candidates[0];
    if (!used.has(chosenIdx)) used.add(chosenIdx);
    const chosen = chosenIdx === 0 ? root0 : root1;
    out.set(req.point.id, chosen);
    rememberStableGenericIntersectionPoint(req.point.id, objA, objB, chosen);
  }

  ctx.genericIntersectionPairAssignments.set(key, out);
  return out;
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

export function getNumberValue(numOrId: SceneNumber | string, scene: SceneModel): number | null {
  const id = typeof numOrId === "string" ? numOrId : numOrId.id;
  const ctx = getOrCreateSceneEvalContext(scene);
  const value = evalNumberById(id, scene, ctx);
  if (!ctx.explicit) {
    ctx.stats.ms = performance.now() - ctx.startedAt;
    sceneLastEvalStats.set(scene, { ...ctx.stats });
  }
  return value;
}

function evalNumberById(id: string, scene: SceneModel, ctx: SceneEvalContext): number | null {
  if (ctx.numberCache.has(id)) {
    ctx.stats.cacheHits += 1;
    return ctx.numberCache.get(id)!;
  }
  if (ctx.numberInProgress.has(id)) return null;
  const num = ctx.numberById.get(id);
  if (!num) return null;
  ctx.numberInProgress.add(id);
  const value = evalNumberDefinition(num.definition, scene, ctx, id);
  ctx.numberInProgress.delete(id);
  // Do not memoize transient nulls: they can happen during recursive evaluation
  // (e.g. angleExpr -> number -> circleRadius -> point depending on the same expr).
  // Caching null would incorrectly keep the number undefined for the whole scene tick.
  if (value !== null) {
    ctx.numberCache.set(id, value);
  }
  return value;
}

function evalNumberDefinition(
  def: SceneNumberDefinition,
  scene: SceneModel,
  ctx: SceneEvalContext,
  selfNumberId?: string
): number | null {
  if (def.kind === "constant") {
    return Number.isFinite(def.value) ? def.value : null;
  }
  if (def.kind === "distancePoints") {
    const a = getPointWorldById(def.aId, scene, ctx);
    const b = getPointWorldById(def.bId, scene, ctx);
    if (!a || !b) return null;
    return distance(a, b);
  }
  if (def.kind === "segmentLength") {
    const seg = ctx.segmentById.get(def.segId);
    if (!seg) return null;
    const a = getPointWorldById(seg.aId, scene, ctx);
    const b = getPointWorldById(seg.bId, scene, ctx);
    if (!a || !b) return null;
    return distance(a, b);
  }
  if (def.kind === "circleRadius" || def.kind === "circleArea") {
    const circle = ctx.circleById.get(def.circleId);
    if (!circle) return null;
    const geom = getCircleWorldGeometryWithCtx(circle, scene, ctx);
    if (!geom) return null;
    const r = geom.radius;
    if (def.kind === "circleRadius") return r;
    return Math.PI * r * r;
  }
  if (def.kind === "angleDegrees") {
    const angle = ctx.angleById.get(def.angleId);
    if (!angle) return null;
    const a = getPointWorldById(angle.aId, scene, ctx);
    const b = getPointWorldById(angle.bId, scene, ctx);
    const c = getPointWorldById(angle.cId, scene, ctx);
    if (!a || !b || !c) return null;
    const theta = computeOrientedAngleRad(a, b, c);
    if (theta === null) return null;
    return (theta * 180) / Math.PI;
  }
  if (def.kind === "expression") {
    const result = evaluateNumberExpressionWithCtx(scene, def.expr, ctx, selfNumberId);
    return result.ok ? result.value : null;
  }
  const num = evalNumberById(def.numeratorId, scene, ctx);
  const den = evalNumberById(def.denominatorId, scene, ctx);
  if (num === null || den === null) return null;
  if (Math.abs(den) <= 1e-12) return null;
  return num / den;
}

export function computeConvexAngleRad(a: Vec2, b: Vec2, c: Vec2): number | null {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const baLen = Math.hypot(bax, bay);
  const bcLen = Math.hypot(bcx, bcy);
  if (baLen <= 1e-12 || bcLen <= 1e-12) return null;
  const dot = (bax * bcx + bay * bcy) / (baLen * bcLen);
  const clamped = Math.max(-1, Math.min(1, dot));
  return Math.acos(clamped);
}

export function computeOrientedAngleRad(a: Vec2, b: Vec2, c: Vec2): number | null {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const baLen = Math.hypot(bax, bay);
  const bcLen = Math.hypot(bcx, bcy);
  if (baLen <= 1e-12 || bcLen <= 1e-12) return null;
  const start = Math.atan2(bay, bax);
  const end = Math.atan2(bcy, bcx);
  let delta = end - start;
  while (delta < 0) delta += Math.PI * 2;
  while (delta >= Math.PI * 2) delta -= Math.PI * 2;
  return delta;
}

export type AngleExpressionEvalResult = { ok: true; valueDeg: number } | { ok: false; error: string };
export type NumberExpressionEvalResult = { ok: true; value: number } | { ok: false; error: string };

export function evaluateAngleExpressionDegrees(scene: SceneModel, exprRaw: string): AngleExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty angle expression." };
  const ctx = getOrCreateSceneEvalContext(scene);
  return evaluateAngleExpressionDegreesWithCtx(scene, expr, ctx);
}

export function evaluateNumberExpression(scene: SceneModel, exprRaw: string): NumberExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty number expression." };
  const ctx = getOrCreateSceneEvalContext(scene);
  return evaluateNumberExpressionWithCtx(scene, expr, ctx);
}

function evaluateAngleExpressionDegreesWithCtx(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext
): AngleExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty angle expression." };
  const symbols = buildAngleSymbolTable(scene, ctx);
  const parsed = parseNumericExpression(expr, symbols);
  if (!parsed.ok) return parsed;
  if (!Number.isFinite(parsed.value)) return { ok: false, error: "Angle expression is not finite." };
  if (parsed.value < 0 || parsed.value > 360) {
    return { ok: false, error: "Angle expression must evaluate to [0, 360] degrees." };
  }
  return { ok: true, valueDeg: parsed.value };
}

function evaluateNumberExpressionWithCtx(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext,
  excludeNumberId?: string
): NumberExpressionEvalResult {
  const expr = exprRaw.trim();
  if (!expr) return { ok: false, error: "Empty number expression." };
  const symbols = buildNumberSymbolTable(scene, ctx, excludeNumberId);
  const parsed = parseNumericExpression(expr, symbols);
  if (!parsed.ok) return parsed;
  if (!Number.isFinite(parsed.value)) return { ok: false, error: "Number expression is not finite." };
  return { ok: true, value: parsed.value };
}

function buildAngleSymbolTable(scene: SceneModel, ctx: SceneEvalContext): Map<string, number> {
  const map = new Map<string, number>();
  const angles = [...scene.angles].sort((a, b) => a.id.localeCompare(b.id));
  for (const angle of angles) {
    const a = getPointWorldById(angle.aId, scene, ctx);
    const b = getPointWorldById(angle.bId, scene, ctx);
    const c = getPointWorldById(angle.cId, scene, ctx);
    if (!a || !b || !c) continue;
    const theta = computeOrientedAngleRad(a, b, c);
    if (theta === null) continue;
    const deg = (theta * 180) / Math.PI;

    registerAngleSymbol(map, angle.id, deg);
    registerAngleSymbol(map, `angle_${angle.id}`, deg);

    const pa = ctx.pointById.get(angle.aId);
    const pb = ctx.pointById.get(angle.bId);
    const pc = ctx.pointById.get(angle.cId);
    if (pa && pb && pc) {
      registerAngleSymbol(map, `${pa.name}${pb.name}${pc.name}`, deg);
    }

    const label = angle.style.labelText.trim();
    if (label) {
      const normalized = normalizeAngleLabelSymbol(label);
      if (normalized) {
        registerAngleSymbol(map, normalized, deg);
        registerAngleSymbol(map, normalized.toLowerCase(), deg);
      }
    }
  }

  // Optional convenience constants.
  registerAngleSymbol(map, "pi", 180);
  registerAngleSymbol(map, "tau", 360);
  const numbers = [...scene.numbers].sort((a, b) => a.id.localeCompare(b.id));
  for (const num of numbers) {
    const value = evalNumberById(num.id, scene, ctx);
    if (value === null || !Number.isFinite(value)) continue;
    registerAngleSymbol(map, num.id, value);
    registerAngleSymbol(map, `num_${num.id}`, value);
    registerAngleSymbol(map, num.name, value);
    registerAngleSymbol(map, num.name.toLowerCase(), value);
  }
  return map;
}

function buildNumberSymbolTable(scene: SceneModel, ctx: SceneEvalContext, excludeNumberId?: string): Map<string, number> {
  const map = new Map<string, number>();
  const numbers = [...scene.numbers].sort((a, b) => a.id.localeCompare(b.id));
  for (const num of numbers) {
    if (excludeNumberId && num.id === excludeNumberId) continue;
    const value = evalNumberById(num.id, scene, ctx);
    if (value === null || !Number.isFinite(value)) continue;
    registerAngleSymbol(map, num.id, value);
    registerAngleSymbol(map, `num_${num.id}`, value);
    registerAngleSymbol(map, num.name, value);
    registerAngleSymbol(map, num.name.toLowerCase(), value);
  }
  registerAngleSymbol(map, "pi", Math.PI);
  registerAngleSymbol(map, "tau", Math.PI * 2);
  return map;
}

function registerAngleSymbol(map: Map<string, number>, key: string, valueDeg: number): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
  if (map.has(key)) return;
  map.set(key, valueDeg);
}

function normalizeAngleLabelSymbol(labelRaw: string): string | null {
  let s = labelRaw.trim();
  if (s.startsWith("$") && s.endsWith("$") && s.length >= 2) s = s.slice(1, -1).trim();
  if (/^\\[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s.slice(1);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s;
  return null;
}

function parseNumericExpression(expr: string, symbols: Map<string, number>): NumberExpressionEvalResult {
  type Token =
    | { kind: "num"; v: number }
    | { kind: "id"; v: string }
    | { kind: "op"; v: "+" | "-" | "*" | "/" | "^" | "(" | ")" };
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[0-9._]/.test(expr[j])) j += 1;
      const raw = expr.slice(i, j).replace(/_/g, "");
      const v = Number(raw);
      if (!Number.isFinite(v)) return { ok: false, error: `Invalid number: ${raw}` };
      tokens.push({ kind: "num", v });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j += 1;
      tokens.push({ kind: "id", v: expr.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^" || ch === "(" || ch === ")") {
      tokens.push({ kind: "op", v: ch });
      i += 1;
      continue;
    }
    return { ok: false, error: `Unexpected token: ${ch}` };
  }

  let p = 0;
  const peek = (): Token | null => (p < tokens.length ? tokens[p] : null);
  const take = (): Token | null => (p < tokens.length ? tokens[p++] : null);

  const parsePrimary = (): NumberExpressionEvalResult => {
    const t = take();
    if (!t) return { ok: false, error: "Unexpected end of expression." };
    if (t.kind === "num") return { ok: true, value: t.v };
    if (t.kind === "id") {
      const v = symbols.get(t.v) ?? symbols.get(t.v.toLowerCase());
      if (v === undefined) return { ok: false, error: `Unknown symbol: ${t.v}` };
      return { ok: true, value: v };
    }
    if (t.kind === "op" && t.v === "(") {
      const inner = parseExpr();
      if (!inner.ok) return inner;
      const close = take();
      if (!close || close.kind !== "op" || close.v !== ")") return { ok: false, error: "Missing closing ')'." };
      return inner;
    }
    if (t.kind === "op" && (t.v === "+" || t.v === "-")) {
      const inner = parsePrimary();
      if (!inner.ok) return inner;
      return { ok: true, value: t.v === "-" ? -inner.value : inner.value };
    }
    return { ok: false, error: "Expected number, symbol, or parenthesized expression." };
  };

  const parsePower = (): NumberExpressionEvalResult => {
    let left = parsePrimary();
    if (!left.ok) return left;
    const t = peek();
    if (t && t.kind === "op" && t.v === "^") {
      take();
      const right = parsePower();
      if (!right.ok) return right;
      left = { ok: true, value: Math.pow(left.value, right.value) };
    }
    return left;
  };

  const parseTerm = (): NumberExpressionEvalResult => {
    let left = parsePower();
    if (!left.ok) return left;
    while (true) {
      const t = peek();
      if (!t || t.kind !== "op" || (t.v !== "*" && t.v !== "/")) break;
      take();
      const right = parsePower();
      if (!right.ok) return right;
      if (t.v === "*") {
        left = { ok: true, value: left.value * right.value };
      } else {
        if (Math.abs(right.value) <= 1e-12) return { ok: false, error: "Division by zero." };
        left = { ok: true, value: left.value / right.value };
      }
    }
    return left;
  };

  const parseExpr = (): NumberExpressionEvalResult => {
    let left = parseTerm();
    if (!left.ok) return left;
    while (true) {
      const t = peek();
      if (!t || t.kind !== "op" || (t.v !== "+" && t.v !== "-")) break;
      take();
      const right = parseTerm();
      if (!right.ok) return right;
      left = { ok: true, value: t.v === "+" ? left.value + right.value : left.value - right.value };
    }
    return left;
  };

  const out = parseExpr();
  if (!out.ok) return out;
  if (p !== tokens.length) return { ok: false, error: "Unexpected trailing tokens." };
  return out;
}
