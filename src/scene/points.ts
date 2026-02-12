import type { Vec2 } from "../geo/vec2";
import type { NumberExpressionEvalResult } from "./eval/numericExpression";
import {
  type AngleExpressionEvalResult,
} from "./eval/expressionEval";
import {
  beginSceneEvalTick as beginSceneEvalTickCore,
  endSceneEvalTick as endSceneEvalTickCore,
  getOrCreateSceneEvalContext as getOrCreateSceneEvalContextCore,
  type SceneEvalStats,
  updateImplicitEvalStats,
} from "./eval/evalContext";
import {
  genericIntersectionSignature,
} from "./eval/intersectionUtils";
import { objectIntersectionsWithOps } from "./eval/intersectionQueries";
import { getPreviousStablePoint, rememberStablePoint } from "./eval/stablePointMemory";
import { computeOrientedAngleRad } from "./eval/angleMath";
import {
  evaluateAngleExpressionDegreesWithCtxInScene,
  evaluateNumberExpressionWithCtxInScene,
} from "./eval/numberExpressionEvaluators";
import { evalNumberByIdWithRuntime } from "./eval/numberRuntime";
import { evalNumberDefinitionInScene } from "./eval/numberSceneEval";
import {
  resolveCircleLinePairAssignmentsInScene,
  resolveGenericIntersectionPairAssignmentsInScene,
} from "./eval/intersectionPairResolution";
import {
  asCircleWithCtx,
  asLineLikeWithCtx,
  buildGeometryResolveOpsWithCtx,
  getCircleWorldGeometryWithCtxInScene,
  resolveLineAnchorsWithCtx,
} from "./eval/geometryAdapters";
import { evalPointByIdWithRuntime } from "./eval/pointRuntime";
import {
  evalPointUnchecked as evalPointUncheckedCore,
} from "./eval/pointEvalDispatch";
import {
  buildSceneEvalContextForScene,
  type SceneEvalContext,
} from "./eval/sceneContextBuilder";
export {
  isNameUnique,
  isPointDraggable,
  isValidPointName,
  movePoint,
  nextLabelFromIndex,
} from "./pointBasics";
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

const sceneEvalContexts = new WeakMap<SceneModel, SceneEvalContext>();
const sceneLastEvalStats = new WeakMap<SceneModel, SceneEvalStats>();
let sceneEvalTick = 0;

function buildSceneEvalContext(scene: SceneModel, explicit: boolean): SceneEvalContext {
  const tick = ++sceneEvalTick;
  return buildSceneEvalContextForScene(scene, explicit, tick, performance.now());
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

function evalPoint(pointId: string, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPointByIdWithRuntime(pointId, {
    getCache: (id) => ctx.pointCache.get(id),
    setCache: (id, value) => {
      ctx.pointCache.set(id, value);
    },
    isInProgress: (id) => ctx.inProgress.has(id),
    addInProgress: (id) => {
      ctx.inProgress.add(id);
    },
    removeInProgress: (id) => {
      ctx.inProgress.delete(id);
    },
    getPointById: (id) => ctx.pointById.get(id) ?? null,
    evalPointUnchecked: (point) => evalPointUnchecked(point, scene, ctx),
    onCacheHit: () => {
      ctx.stats.cacheHits += 1;
    },
    onNodeEval: () => {
      ctx.stats.totalNodeEvalCalls += 1;
    },
  });
}

function evalPointUnchecked(point: ScenePoint, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPointUncheckedCore(point, scene, ctx, {
    getPointWorldById,
    resolveLineAnchorsById: (lineId, s, c) => {
      const line = c.lineById.get(lineId);
      if (!line) return null;
      return resolveLineAnchors(line, s, c);
    },
    getCircleWorldGeometryById: (circleId, s, c) => {
      const circle = c.circleById.get(circleId);
      if (!circle) return null;
      return getCircleWorldGeometryWithCtx(circle, s, c);
    },
    evaluateAngleExpressionDegreesWithCtx,
    resolveCircleLinePairAssignments,
    rememberStableCircleLinePoint,
    objectIntersections,
    resolveGenericIntersectionPairAssignments,
    rememberStableGenericIntersectionPoint,
  });
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
  return asLineLikeWithCtx(ref, scene, ctx, buildGeometryResolveOps(scene, ctx));
}

function resolveLineAnchors(
  line: SceneLine,
  scene: SceneModel,
  ctx: SceneEvalContext
): { a: Vec2; b: Vec2 } | null {
  return resolveLineAnchorsWithCtx(line, scene, ctx, buildGeometryResolveOps(scene, ctx));
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
  return asCircleWithCtx(ref, scene, ctx, buildGeometryResolveOps(scene, ctx));
}

function getCircleWorldGeometryWithCtx(
  circle: SceneCircle,
  scene: SceneModel,
  ctx: SceneEvalContext
): { center: Vec2; radius: number } | null {
  return getCircleWorldGeometryWithCtxInScene(circle, scene, ctx, buildGeometryResolveOps(scene, ctx));
}

function buildGeometryResolveOps(scene: SceneModel, ctx: SceneEvalContext) {
  return buildGeometryResolveOpsWithCtx(scene, ctx, {
    getPointWorldById,
    evaluateNumberExpressionWithCtx,
  });
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
  return resolveCircleLinePairAssignmentsInScene(scene.points, circleId, lineId, branches, {
    getCached: (key) => ctx.circleLinePairAssignments.get(key),
    setCached: (key, value) => {
      ctx.circleLinePairAssignments.set(key, value);
    },
    getExcludedPointWorld: (pointId) => getPointWorldById(pointId, scene, ctx),
    getPreviousStablePoint: (pointId) => getPreviousStableCircleLinePoint(pointId, stabilitySignature),
    rememberStablePoint: (pointId, value) => rememberStableCircleLinePoint(pointId, stabilitySignature, value),
  });
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
  return resolveGenericIntersectionPairAssignmentsInScene(scene.points, objA, objB, intersections, {
    getCached: (key) => ctx.genericIntersectionPairAssignments.get(key),
    setCached: (key, value) => {
      ctx.genericIntersectionPairAssignments.set(key, value);
    },
    getExcludedPointWorld: (pointId) => getPointWorldById(pointId, scene, ctx),
    getPreviousStablePoint: (pointId) => getPreviousStableGenericIntersectionPoint(pointId, objA, objB),
    rememberStablePoint: (pointId, value) => rememberStableGenericIntersectionPoint(pointId, objA, objB, value),
  });
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
  return evalNumberByIdWithRuntime<SceneNumberDefinition>(id, {
    hasCache: (numberId) => ctx.numberCache.has(numberId),
    getCache: (numberId) => ctx.numberCache.get(numberId),
    setCache: (numberId, value) => {
      ctx.numberCache.set(numberId, value);
    },
    isInProgress: (numberId) => ctx.numberInProgress.has(numberId),
    addInProgress: (numberId) => {
      ctx.numberInProgress.add(numberId);
    },
    removeInProgress: (numberId) => {
      ctx.numberInProgress.delete(numberId);
    },
    getDefinitionById: (numberId) => {
      const num = ctx.numberById.get(numberId);
      return num ? num.definition : null;
    },
    evalDefinition: (def, selfNumberId) => evalNumberDefinition(def, scene, ctx, selfNumberId),
    onCacheHit: () => {
      ctx.stats.cacheHits += 1;
    },
  });
}

function evalNumberDefinition(
  def: SceneNumberDefinition,
  scene: SceneModel,
  ctx: SceneEvalContext,
  selfNumberId?: string
): number | null {
  return evalNumberDefinitionInScene(
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
  return evaluateAngleExpressionDegreesWithCtxInScene(
    exprRaw,
    {
      angles: scene.angles.map((angle) => ({
        id: angle.id,
        aId: angle.aId,
        bId: angle.bId,
        cId: angle.cId,
        labelText: angle.style.labelText,
      })),
      numbers: scene.numbers.map((num) => ({ id: num.id, name: num.name })),
    },
    {
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
    }
  );
}

function evaluateNumberExpressionWithCtx(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext,
  excludeNumberId?: string
): NumberExpressionEvalResult {
  return evaluateNumberExpressionWithCtxInScene(
    exprRaw,
    {
      numbers: scene.numbers.map((num) => ({ id: num.id, name: num.name })),
    },
    {
      getNumberValue: (numberId) => evalNumberById(numberId, scene, ctx),
      excludeNumberId,
    }
  );
}
