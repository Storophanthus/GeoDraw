import type { Vec2 } from "../geo/vec2";
import {
  distance,
  lineCircleIntersectionBranches,
} from "../geo/geometry";
import type { NumberExpressionEvalResult } from "./eval/numericExpression";
import {
  buildAngleSymbolTable,
  buildNumberSymbolTable,
  evaluateAngleExpressionDegreesWithSymbols,
  evaluateNumberExpressionWithSymbols,
  type AngleExpressionEvalResult,
} from "./eval/expressionEval";
import {
  beginSceneEvalTick as beginSceneEvalTickCore,
  buildSceneEvalContext as buildSceneEvalContextCore,
  endSceneEvalTick as endSceneEvalTickCore,
  getOrCreateSceneEvalContext as getOrCreateSceneEvalContextCore,
  type SceneEvalContext as CoreSceneEvalContext,
  type SceneEvalStats,
  updateImplicitEvalStats,
} from "./eval/evalContext";
import { evalNumberDefinitionWithOps } from "./eval/numberDefinitions";
import {
  asCircleWithOps,
  asLineLikeWithOps,
  getCircleWorldGeometryWithOps,
  resolveLineAnchorsWithOps,
} from "./eval/geometryResolve";
import {
  circleLinePairAssignmentKey,
  circleLineStabilitySignature,
  genericIntersectionPairKey,
  genericIntersectionSignature,
  sameObjectPair,
} from "./eval/intersectionUtils";
import {
  assignCircleLinePairPoints,
  assignGenericIntersectionPairPoints,
  type CircleLineAssignmentPoint,
  type GenericAssignmentPoint,
} from "./eval/intersectionAssignments";
import { objectIntersectionsWithOps } from "./eval/intersectionQueries";
import {
  evalMidpoint,
  evalPointByRotation,
  evalPointOnCircle,
  evalPointOnLine,
  evalPointOnSegment,
} from "./eval/pointGeometryEval";
import { getPreviousStablePoint, rememberStablePoint } from "./eval/stablePointMemory";
import { computeOrientedAngleRad } from "./eval/angleMath";
export type { NumberExpressionEvalResult } from "./eval/numericExpression";
export type { AngleExpressionEvalResult } from "./eval/expressionEval";
export type { SceneEvalStats } from "./eval/evalContext";

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

type SceneEvalContext = CoreSceneEvalContext<
  ScenePoint,
  SceneLine,
  SceneSegment,
  SceneCircle,
  SceneAngle,
  SceneNumber
>;

const sceneEvalContexts = new WeakMap<SceneModel, SceneEvalContext>();
const sceneLastEvalStats = new WeakMap<SceneModel, SceneEvalStats>();
let sceneEvalTick = 0;

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
  const tick = ++sceneEvalTick;
  return buildSceneEvalContextCore({
    tick,
    startedAt: performance.now(),
    explicit,
    pointById,
    lineById,
    segmentById,
    circleById,
    angleById,
    numberById,
    dirtyNodes: scene.points.length + scene.numbers.length,
  });
}

function getOrCreateSceneEvalContext(scene: SceneModel): SceneEvalContext {
  return getOrCreateSceneEvalContextCore(scene, sceneEvalContexts, () => buildSceneEvalContext(scene, false));
}

export function beginSceneEvalTick(scene: SceneModel): void {
  beginSceneEvalTickCore(scene, sceneEvalContexts, () => buildSceneEvalContext(scene, true));
}

export function endSceneEvalTick(scene: SceneModel): SceneEvalStats | null {
  return endSceneEvalTickCore(scene, sceneEvalContexts, sceneLastEvalStats);
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
  updateImplicitEvalStats(scene, ctx, sceneLastEvalStats);
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

  if (point.kind === "midpointPoints") return evalMidpointPointsPoint(point, scene, ctx);
  if (point.kind === "midpointSegment") return evalMidpointSegmentPoint(point, scene, ctx);
  if (point.kind === "pointOnLine") return evalPointOnLinePoint(point, scene, ctx);
  if (point.kind === "pointOnSegment") return evalPointOnSegmentPoint(point, scene, ctx);
  if (point.kind === "pointOnCircle") return evalPointOnCirclePoint(point, scene, ctx);
  if (point.kind === "pointByRotation") return evalPointByRotationPoint(point, scene, ctx);
  if (point.kind === "circleLineIntersectionPoint") return evalCircleLineIntersectionPoint(point, scene, ctx);
  return evalGenericIntersectionPoint(point, scene, ctx);
}

function evalMidpointPointsPoint(point: MidpointFromPoints, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  const pa = getPointWorldById(point.aId, scene, ctx);
  const pb = getPointWorldById(point.bId, scene, ctx);
  if (!pa || !pb) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalMidpoint(pa, pb);
}

function evalMidpointSegmentPoint(point: MidpointFromSegment, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  const seg = ctx.segmentById.get(point.segId);
  if (!seg) return null;
  const pa = getPointWorldById(seg.aId, scene, ctx);
  const pb = getPointWorldById(seg.bId, scene, ctx);
  if (!pa || !pb) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalMidpoint(pa, pb);
}

function evalPointOnLinePoint(point: PointOnLine, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  const line = ctx.lineById.get(point.lineId);
  if (!line) return null;
  const anchors = resolveLineAnchors(line, scene, ctx);
  if (!anchors) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointOnLine(anchors, point.s);
}

function evalPointOnSegmentPoint(point: PointOnSegment, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  const seg = ctx.segmentById.get(point.segId);
  if (!seg) return null;
  const a = getPointWorldById(seg.aId, scene, ctx);
  const b = getPointWorldById(seg.bId, scene, ctx);
  if (!a || !b) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointOnSegment(a, b, point.u);
}

function evalPointOnCirclePoint(point: PointOnCircle, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  const circle = ctx.circleById.get(point.circleId);
  if (!circle) return null;
  const geom = getCircleWorldGeometryWithCtx(circle, scene, ctx);
  if (!geom) return null;
  const { center, radius } = geom;
  ctx.stats.allocationsEstimate += 1;
  return evalPointOnCircle(center, radius, point.t);
}

function evalPointByRotationPoint(point: PointByRotation, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  const center = getPointWorldById(point.centerId, scene, ctx);
  const base = getPointWorldById(point.pointId, scene, ctx);
  if (!center || !base) return null;
  const expr = point.angleExpr ?? String(point.angleDeg ?? "");
  const exprEval = evaluateAngleExpressionDegreesWithCtx(scene, expr, ctx);
  if (!exprEval.ok) return null;
  ctx.stats.allocationsEstimate += 1;
  return evalPointByRotation(center, base, exprEval.valueDeg, point.direction);
}

function evalCircleLineIntersectionPoint(
  point: CircleLineIntersectionPoint,
  scene: SceneModel,
  ctx: SceneEvalContext
): Vec2 | null {
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

function evalGenericIntersectionPoint(point: IntersectionPoint, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
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
  return objectIntersectionsWithOps(a, b, {
    asLineLike: (ref) => asLineLike(ref, scene, ctx),
    asCircle: (ref) => asCircle(ref, scene, ctx),
    onLineLineCall: () => {
      ctx.stats.lineLineCalls += 1;
    },
    onCircleLineCall: () => {
      ctx.stats.circleLineCalls += 1;
    },
    onCircleCircleCall: () => {
      ctx.stats.circleCircleCalls += 1;
    },
    onAllocation: (count) => {
      ctx.stats.allocationsEstimate += count;
    },
  });
}

function asLineLike(
  ref: GeometryObjectRef,
  scene: SceneModel,
  ctx: SceneEvalContext
): { a: Vec2; b: Vec2; finite: boolean } | null {
  return asLineLikeWithOps(ref, buildGeometryResolveOps(scene, ctx));
}

function resolveLineAnchors(
  line: SceneLine,
  scene: SceneModel,
  ctx: SceneEvalContext
): { a: Vec2; b: Vec2 } | null {
  return resolveLineAnchorsWithOps(line, buildGeometryResolveOps(scene, ctx));
}

export function getLineWorldAnchors(line: SceneLine, scene: SceneModel): { a: Vec2; b: Vec2 } | null {
  const ctx = getOrCreateSceneEvalContext(scene);
  const value = resolveLineAnchors(line, scene, ctx);
  updateImplicitEvalStats(scene, ctx, sceneLastEvalStats);
  return value;
}

function asCircle(
  ref: GeometryObjectRef,
  scene: SceneModel,
  ctx: SceneEvalContext
): { center: Vec2; radius: number } | null {
  return asCircleWithOps(ref, buildGeometryResolveOps(scene, ctx));
}

function getCircleWorldGeometryWithCtx(
  circle: SceneCircle,
  scene: SceneModel,
  ctx: SceneEvalContext
): { center: Vec2; radius: number } | null {
  return getCircleWorldGeometryWithOps(circle, buildGeometryResolveOps(scene, ctx));
}

function buildGeometryResolveOps(scene: SceneModel, ctx: SceneEvalContext) {
  return {
    getPointWorldById: (id: string) => getPointWorldById(id, scene, ctx),
    getLineById: (id: string) => ctx.lineById.get(id) ?? null,
    getSegmentById: (id: string) => {
      const seg = ctx.segmentById.get(id);
      return seg ? { aId: seg.aId, bId: seg.bId } : null;
    },
    getCircleById: (id: string) => ctx.circleById.get(id) ?? null,
    evaluateCircleRadiusExpr: (expr: string) => {
      const evaluated = evaluateNumberExpressionWithCtx(scene, expr, ctx);
      return evaluated.ok ? evaluated.value : null;
    },
    lineInProgress: ctx.lineInProgress,
  } as const;
}

export function getCircleWorldGeometry(circle: SceneCircle, scene: SceneModel): { center: Vec2; radius: number } | null {
  const ctx = getOrCreateSceneEvalContext(scene);
  const value = getCircleWorldGeometryWithCtx(circle, scene, ctx);
  updateImplicitEvalStats(scene, ctx, sceneLastEvalStats);
  return value;
}

function resolveCircleLinePairAssignments(
  scene: SceneModel,
  ctx: SceneEvalContext,
  circleId: string,
  lineId: string,
  branches: Array<{ point: Vec2; t: number }>,
  stabilitySignature: string
): Map<string, Vec2 | null> {
  const key = circleLinePairAssignmentKey(circleId, lineId);
  const cached = ctx.circleLinePairAssignments.get(key);
  if (cached) return cached;

  const pairPoints: CircleLineAssignmentPoint[] = [];
  for (const item of scene.points) {
    if (item.kind !== "circleLineIntersectionPoint") continue;
    if (item.circleId !== circleId || item.lineId !== lineId) continue;
    pairPoints.push(item);
  }
  const out = assignCircleLinePairPoints(pairPoints, branches, {
    getExcludedPointWorld: (pointId) => getPointWorldById(pointId, scene, ctx),
    getPreviousStablePoint: (pointId) => getPreviousStableCircleLinePoint(pointId, stabilitySignature),
    rememberStablePoint: (pointId, value) => rememberStableCircleLinePoint(pointId, stabilitySignature, value),
  });
  ctx.circleLinePairAssignments.set(key, out);
  return out;
}

function getPreviousStableGenericIntersectionPoint(
  pointId: string,
  a: GeometryObjectRef,
  b: GeometryObjectRef
): Vec2 | null {
  return getPreviousStablePoint(pointId, genericIntersectionSignature(a, b));
}

function rememberStableGenericIntersectionPoint(
  pointId: string,
  a: GeometryObjectRef,
  b: GeometryObjectRef,
  value: Vec2
): void {
  rememberStablePoint(pointId, genericIntersectionSignature(a, b), value);
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

  const pairPoints: GenericAssignmentPoint[] = [];
  for (const item of scene.points) {
    if (item.kind !== "intersectionPoint") continue;
    if (!sameObjectPair(item.objA, item.objB, objA, objB)) continue;
    pairPoints.push(item);
  }
  const out = assignGenericIntersectionPairPoints(pairPoints, intersections, {
    getExcludedPointWorld: (pointId) => getPointWorldById(pointId, scene, ctx),
    getPreviousStablePoint: (pointId) => getPreviousStableGenericIntersectionPoint(pointId, objA, objB),
    rememberStablePoint: (pointId, value) => rememberStableGenericIntersectionPoint(pointId, objA, objB, value),
  });
  ctx.genericIntersectionPairAssignments.set(key, out);
  return out;
}

function getPreviousStableCircleLinePoint(pointId: string, signature: string): Vec2 | null {
  return getPreviousStablePoint(pointId, signature);
}

function rememberStableCircleLinePoint(pointId: string, signature: string, value: Vec2): void {
  rememberStablePoint(pointId, signature, value);
}

export function getNumberValue(numOrId: SceneNumber | string, scene: SceneModel): number | null {
  const id = typeof numOrId === "string" ? numOrId : numOrId.id;
  const ctx = getOrCreateSceneEvalContext(scene);
  const value = evalNumberById(id, scene, ctx);
  updateImplicitEvalStats(scene, ctx, sceneLastEvalStats);
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
  return evalNumberDefinitionWithOps(
    def,
    {
      getPointWorldById: (id) => getPointWorldById(id, scene, ctx),
      getSegmentById: (id) => {
        const seg = ctx.segmentById.get(id);
        return seg ? { aId: seg.aId, bId: seg.bId } : null;
      },
      getCircleRadiusById: (id) => {
        const circle = ctx.circleById.get(id);
        if (!circle) return null;
        const geom = getCircleWorldGeometryWithCtx(circle, scene, ctx);
        return geom ? geom.radius : null;
      },
      getAngleById: (id) => {
        const angle = ctx.angleById.get(id);
        return angle ? { aId: angle.aId, bId: angle.bId, cId: angle.cId } : null;
      },
      evaluateNumberExpression: (expr, excludeNumberId) => {
        const result = evaluateNumberExpressionWithCtx(scene, expr, ctx, excludeNumberId);
        return result.ok ? result.value : null;
      },
      evalNumberById: (id) => evalNumberById(id, scene, ctx),
      computeOrientedAngleRad,
      distance,
    },
    selfNumberId
  );
}

export { computeConvexAngleRad, computeOrientedAngleRad } from "./eval/angleMath";

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
  const symbols = buildAngleSymbolTable({
    angles: scene.angles.map((angle) => ({
      id: angle.id,
      aId: angle.aId,
      bId: angle.bId,
      cId: angle.cId,
      labelText: angle.style.labelText,
    })),
    numbers: scene.numbers.map((num) => ({ id: num.id, name: num.name })),
    getAngleValueDeg: (angleId) => {
      const angle = ctx.angleById.get(angleId);
      if (!angle) return null;
      const a = getPointWorldById(angle.aId, scene, ctx);
      const b = getPointWorldById(angle.bId, scene, ctx);
      const c = getPointWorldById(angle.cId, scene, ctx);
      if (!a || !b || !c) return null;
      const theta = computeOrientedAngleRad(a, b, c);
      if (theta === null) return null;
      return (theta * 180) / Math.PI;
    },
    getAnglePointNames: (angleId) => {
      const angle = ctx.angleById.get(angleId);
      if (!angle) return null;
      const pa = ctx.pointById.get(angle.aId);
      const pb = ctx.pointById.get(angle.bId);
      const pc = ctx.pointById.get(angle.cId);
      if (!pa || !pb || !pc) return null;
      return { aName: pa.name, bName: pb.name, cName: pc.name };
    },
    getNumberValue: (numberId) => evalNumberById(numberId, scene, ctx),
  });
  return evaluateAngleExpressionDegreesWithSymbols(exprRaw, symbols);
}

function evaluateNumberExpressionWithCtx(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext,
  excludeNumberId?: string
): NumberExpressionEvalResult {
  const symbols = buildNumberSymbolTable({
    numbers: scene.numbers.map((num) => ({ id: num.id, name: num.name })),
    getNumberValue: (numberId) => evalNumberById(numberId, scene, ctx),
    excludeNumberId,
  });
  return evaluateNumberExpressionWithSymbols(exprRaw, symbols);
}
