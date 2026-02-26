import type { Vec2 } from "../geo/vec2";
import type { NumberExpressionEvalResult } from "./eval/numericExpression";
import {
  type AngleExpressionEvalResult,
} from "./eval/expressionEval";
import {
  type SceneEvalStats,
  updateImplicitEvalStats,
} from "./eval/evalContext";
import {
  beginSceneEvalTickInScenePublic,
  endSceneEvalTickInScenePublic,
  evaluateAngleExpressionDegreesInScenePublic,
  evaluateNumberExpressionInScenePublic,
  getLastSceneEvalStatsInScenePublic,
} from "./eval/sceneEvalApiFacade";
import { evaluateAngleExpressionDegreesWithCtxInSceneModel } from "./eval/sceneExpressionFacade";
import { evalNumberByIdWithSceneFacades, evaluateNumberExpressionWithCtxUsingFacades } from "./eval/sceneNumberExpressionFacade";
import { createSceneEvalStateStore } from "./eval/sceneEvalStateStore";
import {
  getCircleWorldGeometryInScenePublic,
  getLineWorldAnchorsInScenePublic,
  getNumberValueInScenePublic,
  getPointWorldPosInSceneWithImplicitStats,
  resolveTextLabelDisplayTextInScene,
} from "./eval/scenePublicEvalFacade";
import { evalPointUncheckedInSceneWithFacades } from "./eval/scenePointEvalFacade";
import { evalPointWithCtxInScene } from "./eval/pointRuntime";
import { type SceneEvalContext } from "./eval/sceneContextBuilder";

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
export {
  collectSegmentMarkPositions,
  resolveAngleMarks,
  resolveSegmentMarkAnchorPos,
  resolveSegmentMarks,
} from "./sceneMarkStyleUtils";

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
  segmentMark?: SegmentMark;
  segmentMarks?: SegmentMark[];
  segmentArrowMark?: SegmentArrowMark;
  segmentArrowMarks?: SegmentArrowMark[];
};

export type ArrowDirection = "->" | "<-" | "<->" | ">-<";

export type ArrowTipStyle = "Stealth" | "Latex" | "Triangle";

export type PathArrowMark = {
  enabled: boolean;
  direction: ArrowDirection;
  tip?: ArrowTipStyle;
  pos?: number;
  distribution?: "single" | "multi";
  startPos?: number;
  endPos?: number;
  step?: number;
  sizeScale?: number;
  arrowLength?: number;
  color?: string;
  lineWidthPt?: number;
  pairGapPx?: number;
};

export type SegmentArrowMark = PathArrowMark & {
  mode: "end" | "mid";
};

export type SegmentMarkSymbol = "none" | "|" | "||" | "|||" | "s" | "s|" | "s||" | "x" | "o" | "oo" | "z";

export type SegmentMark = {
  enabled: boolean;
  mark: SegmentMarkSymbol;
  pos: number;
  sizePt: number;
  color?: string;
  lineWidthPt?: number;
  distribution?: "single" | "multi";
  startPos?: number;
  endPos?: number;
  step?: number;
};

export type CircleStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeDash: "solid" | "dashed" | "dotted";
  strokeOpacity: number;
  fillColor?: string;
  fillOpacity?: number;
  pattern?: string;
  patternColor?: string;
  arrowMark?: PathArrowMark;
  arrowMarks?: PathArrowMark[];
};

export type PolygonStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeDash: "solid" | "dashed" | "dotted";
  strokeOpacity: number;
  fillColor?: string;
  fillOpacity?: number;
  pattern?: string;
  patternColor?: string;
  // Kept optional for style-copy compatibility with circle styles.
  arrowMark?: PathArrowMark;
};

export type AngleMarkStyle =
  | "arc"
  | "none"
  | "rightSquare"
  | "rightArcDot"
  // Legacy value kept for scene backward compatibility.
  | "right";

export type AngleMarkSymbol = "none" | "|" | "||" | "|||";

export type AngleMark = {
  enabled: boolean;
  arcMultiplicity: 1 | 2 | 3;
  markSymbol: AngleMarkSymbol;
  markPos: number;
  markSize: number;
  markColor?: string;
};

export type AngleStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeDash?: "solid" | "dashed" | "dotted";
  strokeOpacity: number;
  textColor: string;
  textSize: number;
  fillEnabled: boolean;
  fillColor: string;
  fillOpacity: number;
  pattern?: string;
  patternColor?: string;
  markStyle: AngleMarkStyle;
  markSymbol: AngleMarkSymbol;
  arcMultiplicity: 1 | 2 | 3;
  markPos: number;
  markSize: number;
  markColor: string;
  angleMarks?: AngleMark[];
  arcRadius: number;
  labelText: string;
  labelPosWorld: Vec2;
  showLabel: boolean;
  showValue: boolean;
  promoteToSolid?: boolean;
  arcArrowMark?: PathArrowMark;
  arcArrowMarks?: PathArrowMark[];
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

export type PointByTranslation = {
  id: string;
  kind: "pointByTranslation";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  pointId: string;
  vectorId?: string;
  fromId: string;
  toId: string;
  style: PointStyle;
};

export type PointByDilation = {
  id: string;
  kind: "pointByDilation";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  pointId: string;
  centerId: string;
  factor?: number;
  factorExpr?: string;
  style: PointStyle;
};

export type PointByReflection = {
  id: string;
  kind: "pointByReflection";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  pointId: string;
  axis: LineLikeObjectRef;
  style: PointStyle;
};

export type CircleCenterPoint = {
  id: string;
  kind: "circleCenter";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  circleId: string;
  style: PointStyle;
};

export type TriangleCenterKind = "incenter" | "orthocenter" | "centroid";

export type TriangleCenterPoint = {
  id: string;
  kind: "triangleCenter";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  centerKind: TriangleCenterKind;
  aId: string;
  bId: string;
  cId: string;
  style: PointStyle;
};

export type GeometryObjectRef =
  | { type: "line"; id: string }
  | { type: "segment"; id: string }
  | { type: "circle"; id: string }
  | { type: "angle"; id: string };

export type LineLikeObjectRef = { type: "line"; id: string } | { type: "segment"; id: string };

export type SceneVectorFromPoints = {
  id: string;
  kind: "vectorFromPoints";
  fromId: string;
  toId: string;
};

export type SceneVectorFree = {
  id: string;
  kind: "freeVector";
  dx: number;
  dy: number;
};

export type SceneVector = SceneVectorFromPoints | SceneVectorFree;

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
  // Optional explicit branch index. When set, evaluation uses this branch
  // deterministically instead of preferredWorld heuristics.
  branchIndex?: number;
  preferredWorld: Vec2;
  excludePointId?: string;
  style: PointStyle;
};

export type LineLikeIntersectionPoint = {
  id: string;
  kind: "lineLikeIntersectionPoint";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  objA: LineLikeObjectRef;
  objB: LineLikeObjectRef;
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

export type CircleSegmentIntersectionPoint = {
  id: string;
  kind: "circleSegmentIntersectionPoint";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  circleId: string;
  segId: string;
  branchIndex: 0 | 1;
  excludePointId?: string;
  style: PointStyle;
};

export type CircleCircleIntersectionPoint = {
  id: string;
  kind: "circleCircleIntersectionPoint";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  circleAId: string;
  circleBId: string;
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
  | PointByTranslation
  | PointByDilation
  | PointByReflection
  | CircleCenterPoint
  | TriangleCenterPoint
  | IntersectionPoint
  | LineLikeIntersectionPoint
  | CircleLineIntersectionPoint
  | CircleSegmentIntersectionPoint
  | CircleCircleIntersectionPoint;

export type ObjectLabelFields = {
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
};

export type SceneSegment = {
  id: string;
  aId: string;
  bId: string;
  // Segment ownership created by polygon tool.
  // Manual segments keep this undefined.
  ownedByPolygonIds?: string[];
  // Segment ownership created by sector tool (radial sides).
  // Manual segments keep this undefined.
  ownedBySectorIds?: string[];
  visible: boolean;
  showLabel: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: LineStyle;
};

export type SceneLineTwoPoint = {
  id: string;
  kind?: "twoPoint";
  aId: string;
  bId: string;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: LineStyle;
};

export type SceneLinePerpendicular = {
  id: string;
  kind: "perpendicular";
  throughId: string;
  base: LineLikeObjectRef;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: LineStyle;
};

export type SceneLineParallel = {
  id: string;
  kind: "parallel";
  throughId: string;
  base: LineLikeObjectRef;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: LineStyle;
};

export type SceneLineAngleBisector = {
  id: string;
  kind: "angleBisector";
  aId: string;
  bId: string;
  cId: string;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: LineStyle;
};

export type SceneLineTangent = {
  id: string;
  kind: "tangent";
  throughId: string;
  circleId: string;
  branchIndex: 0 | 1;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: LineStyle;
};

export type SceneLineCircleCircleTangent = {
  id: string;
  kind: "circleCircleTangent";
  circleAId: string;
  circleBId: string;
  family: "outer" | "inner";
  branchIndex: 0 | 1;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: LineStyle;
};

export type SceneLine =
  | SceneLineTwoPoint
  | SceneLinePerpendicular
  | SceneLineParallel
  | SceneLineAngleBisector
  | SceneLineTangent
  | SceneLineCircleCircleTangent;

export type SceneCircleTwoPoint = {
  id: string;
  kind?: "twoPoint";
  centerId: string;
  throughId: string;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: CircleStyle;
};

export type SceneCircleThreePoint = {
  id: string;
  kind: "threePoint";
  aId: string;
  bId: string;
  cId: string;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: CircleStyle;
};

export type SceneCircleFixedRadius = {
  id: string;
  kind: "fixedRadius";
  centerId: string;
  radius: number;
  radiusExpr?: string;
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: CircleStyle;
};

export type SceneCircle = SceneCircleTwoPoint | SceneCircleThreePoint | SceneCircleFixedRadius;

export type ScenePolygon = {
  id: string;
  pointIds: string[];
  visible: boolean;
  showLabel?: boolean;
  labelText?: string;
  labelPosWorld?: Vec2;
  style: PolygonStyle;
};

export type SceneAngle = {
  id: string;
  kind?: "angle" | "sector";
  aId: string;
  bId: string;
  cId: string;
  // True only when right-angle relation is proven by construction provenance.
  isRightExact?: boolean;
  // Runtime hint for UI/render; persisted scenes may omit it.
  isRightApprox?: boolean;
  visible: boolean;
  style: AngleStyle;
};

export type SceneNumberConstant = {
  kind: "constant";
  value: number;
};

export type SceneNumberSlider = {
  kind: "slider";
  value: number;
  min: number;
  max: number;
  step: number;
  sliderMode?: "real" | "degree" | "radian";
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
  | SceneNumberSlider
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

export type SceneTextLabelStyle = {
  textColor: string;
  textSize: number;
  useTex: boolean;
  rotationDeg?: number;
};

export type SceneTextLabel = {
  id: string;
  name: string;
  text: string;
  contentMode?: "static" | "number" | "expression";
  numberId?: string;
  expr?: string;
  visible: boolean;
  positionWorld: Vec2;
  style: SceneTextLabelStyle;
};

export type SceneModel = {
  points: ScenePoint[];
  vectors?: SceneVector[];
  segments: SceneSegment[];
  lines: SceneLine[];
  circles: SceneCircle[];
  polygons: ScenePolygon[];
  angles: SceneAngle[];
  numbers: SceneNumber[];
  textLabels?: SceneTextLabel[];
};

const sceneEvalState = createSceneEvalStateStore();

export function beginSceneEvalTick(scene: SceneModel): void {
  beginSceneEvalTickInScenePublic(scene, {
    sceneEvalContexts: sceneEvalState.sceneEvalContexts,
    buildSceneEvalContext: sceneEvalState.buildSceneEvalContext,
  });
}

export function endSceneEvalTick(scene: SceneModel): SceneEvalStats | null {
  return endSceneEvalTickInScenePublic(scene, {
    sceneEvalContexts: sceneEvalState.sceneEvalContexts,
    sceneLastEvalStats: sceneEvalState.sceneLastEvalStats,
  });
}

export function getLastSceneEvalStats(scene: SceneModel): SceneEvalStats | null {
  return getLastSceneEvalStatsInScenePublic(scene, sceneEvalState.sceneLastEvalStats);
}

export function getPointWorldPos(
  point: ScenePoint,
  scene: SceneModel,
  visited: Set<string> = new Set()
): Vec2 | null {
  void visited;
  return getPointWorldPosInSceneWithImplicitStats(point, scene, {
    getOrCreateSceneEvalContext: sceneEvalState.getOrCreateSceneEvalContext,
    updateImplicitEvalStats: (s, c) => updateImplicitEvalStats(s, c, sceneEvalState.sceneLastEvalStats),
    evalPointById: evalPoint,
  });
}

function evalPoint(pointId: string, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPointWithCtxInScene(pointId, scene, ctx, {
    evalPointUnchecked,
  });
}

function evalPointUnchecked(point: ScenePoint, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPointUncheckedInSceneWithFacades(point, scene, ctx, {
    getPointWorldById,
    evaluateAngleExpressionDegreesWithCtx,
    evaluateNumberExpressionWithCtx,
  });
}

function getPointWorldById(pointId: string, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPoint(pointId, scene, ctx);
}

export function getLineWorldAnchors(line: SceneLine, scene: SceneModel): { a: Vec2; b: Vec2 } | null {
  return getLineWorldAnchorsInScenePublic(line, scene, {
    getOrCreateSceneEvalContext: sceneEvalState.getOrCreateSceneEvalContext,
    updateImplicitEvalStats: (s, c) => updateImplicitEvalStats(s, c, sceneEvalState.sceneLastEvalStats),
    getPointWorldById,
    evaluateNumberExpressionWithCtx,
  });
}

export function getCircleWorldGeometry(circle: SceneCircle, scene: SceneModel): { center: Vec2; radius: number } | null {
  return getCircleWorldGeometryInScenePublic(circle, scene, {
    getOrCreateSceneEvalContext: sceneEvalState.getOrCreateSceneEvalContext,
    updateImplicitEvalStats: (s, c) => updateImplicitEvalStats(s, c, sceneEvalState.sceneLastEvalStats),
    getPointWorldById,
    evaluateNumberExpressionWithCtx,
  });
}

export function getNumberValue(numOrId: SceneNumber | string, scene: SceneModel): number | null {
  return getNumberValueInScenePublic(numOrId, scene, {
    getOrCreateSceneEvalContext: sceneEvalState.getOrCreateSceneEvalContext,
    evalNumberById,
    updateImplicitEvalStats: (s, c) => updateImplicitEvalStats(s, c, sceneEvalState.sceneLastEvalStats),
  });
}

export function resolveTextLabelDisplayText(label: SceneTextLabel, scene: SceneModel): string {
  return resolveTextLabelDisplayTextInScene(label, scene, {
    getNumberValue,
    evaluateNumberExpression,
  });
}

function evalNumberById(id: string, scene: SceneModel, ctx: SceneEvalContext): number | null {
  return evalNumberByIdWithSceneFacades(id, scene, ctx, {
    getPointWorldById,
  });
}

export { computeConvexAngleRad, computeOrientedAngleRad, isRightAngle, RIGHT_ANGLE_EPS } from "./eval/angleMath";

export function evaluateAngleExpressionDegrees(scene: SceneModel, exprRaw: string): AngleExpressionEvalResult {
  return evaluateAngleExpressionDegreesInScenePublic(scene, exprRaw, {
    getOrCreateSceneEvalContext: sceneEvalState.getOrCreateSceneEvalContext,
    evaluateAngleExpressionDegreesWithCtx,
  });
}

export function evaluateNumberExpression(scene: SceneModel, exprRaw: string): NumberExpressionEvalResult {
  return evaluateNumberExpressionInScenePublic(scene, exprRaw, {
    getOrCreateSceneEvalContext: sceneEvalState.getOrCreateSceneEvalContext,
    evaluateNumberExpressionWithCtx: (s, expr, c) => evaluateNumberExpressionWithCtx(s, expr, c),
  });
}

function evaluateAngleExpressionDegreesWithCtx(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext
): AngleExpressionEvalResult {
  return evaluateAngleExpressionDegreesWithCtxInSceneModel(scene, exprRaw, ctx, {
    getPointWorldById,
    evalNumberById,
  });
}

function evaluateNumberExpressionWithCtx(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext,
  excludeNumberId?: string
): NumberExpressionEvalResult {
  return evaluateNumberExpressionWithCtxUsingFacades(scene, exprRaw, ctx, { getPointWorldById }, excludeNumberId);
}
