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
import { computeOrientedAngleRad } from "./eval/angleMath";
import {
  evaluateAngleExpressionDegreesWithCtxInScene,
} from "./eval/numberExpressionEvaluators";
import { evaluateSceneScalarNumberExpression } from "./eval/sceneScalarExpressionAdapter";
import { evalNumberByIdInSceneWithOps, getNumberValueInScene } from "./eval/sceneNumberAccess";
import {
  getCircleWorldGeometryInSceneWithImplicitStats,
  getLineWorldAnchorsInSceneWithImplicitStats,
} from "./eval/sceneGeometryFacade";
import { rememberStableGenericIntersectionPoint, rememberStableCircleLinePoint } from "./eval/intersectionStabilityAdapters";
import { createSceneIntersectionFacadeWithCtx } from "./eval/sceneIntersectionFacade";
import {
  evalPointUnchecked as evalPointUncheckedCore,
} from "./eval/pointEvalDispatch";
import { evalPointWithCtxInScene } from "./eval/pointRuntime";
import {
  buildSceneEvalContextForScene,
  type SceneEvalContext,
} from "./eval/sceneContextBuilder";
import { resolveTextLabelDisplayTextWithOps } from "./eval/textLabelDisplay";

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

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function roundDecimal(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeArcMultiplicity(value: unknown): 1 | 2 | 3 {
  const n = Number(value);
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

function normalizeSegmentMark(mark: SegmentMark): SegmentMark {
  return {
    ...mark,
    enabled: Boolean(mark.enabled),
    mark: mark.mark,
    pos: Number.isFinite(mark.pos) ? clampUnit(mark.pos) : 0.5,
    sizePt: Number.isFinite(mark.sizePt) ? Math.max(0.1, mark.sizePt) : 4,
    lineWidthPt:
      typeof mark.lineWidthPt === "number" && Number.isFinite(mark.lineWidthPt) && mark.lineWidthPt > 0
        ? mark.lineWidthPt
        : undefined,
    distribution: mark.distribution === "multi" ? "multi" : "single",
    startPos: Number.isFinite(mark.startPos) ? clampUnit(mark.startPos as number) : undefined,
    endPos: Number.isFinite(mark.endPos) ? clampUnit(mark.endPos as number) : undefined,
    step: Number.isFinite(mark.step) ? Math.max(0.001, Math.min(1, mark.step as number)) : undefined,
  };
}

export function resolveSegmentMarks(style: Pick<LineStyle, "segmentMark" | "segmentMarks">): SegmentMark[] {
  const source =
    Array.isArray(style.segmentMarks) && style.segmentMarks.length > 0
      ? style.segmentMarks
      : style.segmentMark
        ? [style.segmentMark]
        : [];
  const out: SegmentMark[] = [];
  for (const raw of source) {
    if (!raw) continue;
    const normalized = normalizeSegmentMark(raw);
    if (!normalized.enabled || normalized.mark === "none") continue;
    out.push(normalized);
  }
  return out;
}

export function collectSegmentMarkPositions(
  mark: Pick<SegmentMark, "distribution" | "pos" | "startPos" | "endPos" | "step">,
  fallbackPos = 0.5
): number[] {
  const distribution = mark.distribution ?? "single";
  if (distribution !== "multi") {
    const pos = Number.isFinite(mark.pos) ? (mark.pos as number) : fallbackPos;
    return [clampUnit(pos)];
  }
  let start = Number.isFinite(mark.startPos) ? clampUnit(mark.startPos as number) : 0.45;
  let end = Number.isFinite(mark.endPos) ? clampUnit(mark.endPos as number) : 0.55;
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  const step = Number.isFinite(mark.step) ? Math.max(0.001, Math.min(1, mark.step as number)) : 0.05;
  const out: number[] = [];
  // Compute each sample from start + i*step to avoid cumulative float drift.
  for (let i = 0; i < 500; i += 1) {
    const t = start + i * step;
    if (t > end + 1e-9) break;
    out.push(clampUnit(roundDecimal(t, 12)));
  }
  if (out.length === 0) out.push(clampUnit(Number.isFinite(mark.pos) ? (mark.pos as number) : fallbackPos));
  return out;
}

export function resolveSegmentMarkAnchorPos(style: Pick<LineStyle, "segmentMark" | "segmentMarks">, fallbackPos = 0.5): number {
  const marks = resolveSegmentMarks(style);
  if (marks.length === 0) return clampUnit(fallbackPos);
  return clampUnit(marks[0].pos);
}

function normalizeAngleMark(mark: AngleMark): AngleMark {
  return {
    enabled: Boolean(mark.enabled),
    arcMultiplicity: normalizeArcMultiplicity(mark.arcMultiplicity),
    markSymbol: mark.markSymbol ?? "none",
    markPos: Number.isFinite(mark.markPos) ? clampUnit(mark.markPos) : 0.5,
    markSize: Number.isFinite(mark.markSize) ? Math.max(0.1, mark.markSize) : 4,
    markColor: mark.markColor,
  };
}

export function resolveAngleMarks(style: AngleStyle): AngleMark[] {
  if (style.markStyle === "none") return [];
  const source =
    Array.isArray(style.angleMarks) && style.angleMarks.length > 0
      ? style.angleMarks
      : [
          {
            enabled: true,
            arcMultiplicity: normalizeArcMultiplicity(style.arcMultiplicity),
            markSymbol: style.markSymbol ?? "none",
            markPos: Number.isFinite(style.markPos) ? style.markPos : 0.5,
            markSize: Number.isFinite(style.markSize) ? style.markSize : 4,
            markColor: style.markColor,
          },
        ];
  const out: AngleMark[] = [];
  for (const raw of source) {
    if (!raw) continue;
    const normalized = normalizeAngleMark(raw);
    if (!normalized.enabled) continue;
    out.push(normalized);
  }
  return out;
}

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
  return evalPointWithCtxInScene(pointId, scene, ctx, {
    evalPointUnchecked,
  });
}

function evalPointUnchecked(point: ScenePoint, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPointUncheckedCore(point, scene, ctx, {
    getPointWorldById,
    resolveLineAnchorsById: (lineId, s, c) => {
      const line = c.lineById.get(lineId);
      if (!line) return null;
      return getSceneIntersectionFacade(s, c).getSceneGeometryFacade().resolveLineAnchors(line);
    },
    getCircleWorldGeometryById: (circleId, s, c) => {
      const circle = c.circleById.get(circleId);
      if (!circle) return null;
      return getSceneIntersectionFacade(s, c).getSceneGeometryFacade().getCircleWorldGeometry(circle);
    },
    evaluateAngleExpressionDegreesWithCtx,
    evaluateNumberExpressionWithCtx,
    resolveCircleLinePairAssignments: (s, c, circleId, lineId, branches, stabilitySignature) =>
      getSceneIntersectionFacade(s, c).resolveCircleLinePairAssignments(circleId, lineId, branches, stabilitySignature),
    rememberStableCircleLinePoint,
    objectIntersections: (a, b, s, c) => getSceneIntersectionFacade(s, c).objectIntersections(a, b),
    resolveGenericIntersectionPairAssignments: (s, c, objA, objB, intersections) =>
      getSceneIntersectionFacade(s, c).resolveGenericIntersectionPairAssignments(objA, objB, intersections),
    rememberStableGenericIntersectionPoint,
  });
}

function getPointWorldById(pointId: string, scene: SceneModel, ctx: SceneEvalContext): Vec2 | null {
  return evalPoint(pointId, scene, ctx);
}

function getSceneIntersectionFacade(scene: SceneModel, ctx: SceneEvalContext) {
  return createSceneIntersectionFacadeWithCtx(scene, ctx, {
    getPointWorldById,
    evaluateNumberExpressionWithCtx,
  });
}

export function getLineWorldAnchors(line: SceneLine, scene: SceneModel): { a: Vec2; b: Vec2 } | null {
  return getLineWorldAnchorsInSceneWithImplicitStats(line, scene, {
    getOrCreateSceneEvalContext,
    updateImplicitEvalStats: (s, c) => updateImplicitEvalStats(s, c, sceneLastEvalStats),
    getPointWorldById,
    evaluateNumberExpressionWithCtx,
  });
}

export function getCircleWorldGeometry(circle: SceneCircle, scene: SceneModel): { center: Vec2; radius: number } | null {
  return getCircleWorldGeometryInSceneWithImplicitStats(circle, scene, {
    getOrCreateSceneEvalContext,
    updateImplicitEvalStats: (s, c) => updateImplicitEvalStats(s, c, sceneLastEvalStats),
    getPointWorldById,
    evaluateNumberExpressionWithCtx,
  });
}

export function getNumberValue(numOrId: SceneNumber | string, scene: SceneModel): number | null {
  return getNumberValueInScene(numOrId, scene, {
    getOrCreateSceneEvalContext,
    evalNumberById,
    updateImplicitEvalStats: (s, c) => updateImplicitEvalStats(s, c, sceneLastEvalStats),
  });
}

export function resolveTextLabelDisplayText(label: SceneTextLabel, scene: SceneModel): string {
  return resolveTextLabelDisplayTextWithOps(label, {
    getNumberValue: (id) => getNumberValue(id, scene),
    evaluateNumberExpression: (expr) => evaluateNumberExpression(scene, expr),
  });
}

function evalNumberById(id: string, scene: SceneModel, ctx: SceneEvalContext): number | null {
  return evalNumberByIdInSceneWithOps(id, scene, ctx, {
    getPointWorldById,
    getCircleWorldGeometryById: (circleId, s, c) => {
      const circle = c.circleById.get(circleId);
      if (!circle) return null;
      return getSceneIntersectionFacade(s, c).getSceneGeometryFacade().getCircleWorldGeometry(circle);
    },
    evaluateNumberExpressionWithCtx,
  });
}

export { computeConvexAngleRad, computeOrientedAngleRad, isRightAngle, RIGHT_ANGLE_EPS } from "./eval/angleMath";

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
  return evaluateSceneScalarNumberExpression({
    exprRaw,
    numbers: scene.numbers.map((num) => ({ id: num.id, name: num.name })),
    points: scene.points.map((p) => ({ id: p.id, name: p.name })),
    lines: scene.lines.map((l) => ({ id: l.id, labelText: l.labelText })),
    segments: scene.segments.map((s) => ({ id: s.id, aId: s.aId, bId: s.bId, labelText: s.labelText })),
    circles: scene.circles.map((c) => ({ id: c.id, labelText: c.labelText })),
    polygons: scene.polygons.map((p) => ({ id: p.id, pointIds: p.pointIds, labelText: p.labelText })),
    excludeNumberId,
    getNumberValue: (numberId) => evalNumberById(numberId, scene, ctx),
    getPointWorldById: (pointId) => getPointWorldById(pointId, scene, ctx),
    resolveLineAnchors: (lineId) => {
      const line = ctx.lineById.get(lineId);
      if (!line) return null;
      return getSceneIntersectionFacade(scene, ctx).getSceneGeometryFacade().resolveLineAnchors(line);
    },
    getCircleWorldGeometry: (circleId) => {
      const circle = ctx.circleById.get(circleId);
      if (!circle) return null;
      return getSceneIntersectionFacade(scene, ctx).getSceneGeometryFacade().getCircleWorldGeometry(circle);
    },
  });
}
