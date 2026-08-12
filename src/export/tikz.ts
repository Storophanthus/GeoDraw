import { circleCircleIntersections, clipRayToRect, distance, lineCircleIntersectionBranches } from "../geo/geometry";
import { resolveAngleRightStatus, type AngleRightStatus } from "../domain/rightAngleProvenance";
import { normalizeSceneIntegrity } from "../domain/sceneIntegrity";
import {
  exportFriendlyColorNameByRgbKey,
  parseColorToRgb,
  resolveExportFriendlyColorName,
  resolveNearestDvipsColorName,
} from "../exportFriendlyColors";
import {
  collectAngleMarkPositions,
  collectSegmentMarkPositions,
  computeOrientedAngleRad,
  type AngleMarkSymbol,
  resolveAngleMarks,
  resolveSegmentMarks,
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getCircleWorldGeometry,
  getEllipseWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  resolveTextLabelAlignment,
  resolveTextLabelBoxHeightPx,
  resolveTextLabelBoxWidthPx,
  resolveTextLabelDisplayText,
  resolveTextLabelRenderMode,
  type GeometryObjectRef,
  type SceneGeometryLayerRef,
  type SceneCircle,
  SceneModel,
  ScenePoint,
  SegmentArrowMark,
  type SegmentMarkSymbol,
  type PathArrowMark,
} from "../scene/points";
import { geometryLayerKey, getGeometryLayerOrder } from "../scene/geometryLayerOrder";
import {
  defaultObjectLabelPosWorld,
  defaultObjectLabelText,
  isFiniteLabelPosWorld,
  resolveObjectLabelText,
} from "../scene/objectLabels";
import { angleBisectorRad, defaultAngleLabelDist, shortestAngleDiffRad } from "../scene/angleLabelPlacement";
import { parseTextLabelRichText } from "../text/textLabelRichText";
import { extractDisplayMathSource, extractInlineMathSource } from "../text-editor/richTextDocument";
import type { RichTextDocument } from "../text-editor/richTextModel";
import tkzMacroWhitelist from "../../docs/tkz-euclide-macros.json";
import { assertNoUnknownTkzMacro } from "./tkzWhitelist";
import type { TikzRendererCapabilities } from "./tikz/renderCapabilities";
import { appendRenderedConstructions } from "./tikz/renderConstructions";
import { makeEfficientTikz } from "./tikz/efficient/makeEfficientTikz";
import { createTikzRendererContext } from "./tikz/renderContext";
import type { DrawLayerBackendKind } from "./tikz/renderContext";
import { appendRenderedDrawLayers } from "./tikz/renderDrawLayers";
import { appendRenderedSetupAndPoints } from "./tikz/renderSetupAndPoints";
import { TIKZ_EXPORT_CALIBRATION } from "./tikz/calibration";

export { makeEfficientTikz };

export type TikzExportViewport = { xmin: number; xmax: number; ymin: number; ymax: number };
export type TikzExportOptions = {
  viewport?: TikzExportViewport;
  clipRectWorld?: TikzExportViewport;
  clipPolygonWorld?: { x: number; y: number }[];
  emitTkzSetup?: boolean;
  clipSpace?: number;
  globalLineAdd?: number;
  pointScale?: number;
  lineScale?: number;
  labelScale?: number;
  trueGlobalScale?: number;
  /** Canvas True Zoom already represented by the outer scalebox wrapper. */
  canvasTrueZoom?: number;
  /** Visual treatment applied outside the tikzpicture (Canvas/close-up). */
  visualTreatmentFactor?: number;
  worldToTikzScale?: number;
  screenPxPerWorld?: number;
  labelGlow?: boolean;
  /** Multiplies every exported label contour width. */
  labelHaloScale?: number;
  /** Rounds generated numeric literals to two decimal places. */
  roundNumbersToTwoDecimals?: boolean;
  /** Maps every exported color to the nearest xcolor/dvipsnames color. */
  preferDvipsNames?: boolean;
  // Canvas-wide halo used by angle/object/free-text overlays. Point labels keep
  // their own per-point halo color.
  labelHaloColor?: string;
  drawLayerBackend?: DrawLayerBackendKind;
  segmentStrokeScale?: number;
  pointStrokeScale?: number;
  pointInnerSepFixedPt?: number;
  pointInnerSepScale?: number;
  segmentMarkSizeScale?: number;
  segmentMarkTreatmentScale?: number;
  segmentMarkRoundSizeScale?: number;
  segmentMarkNonRoundSizeScale?: number;
  segmentMarkLineWidthScale?: number;
  segmentMarkTreatmentStrokeScale?: number;
  pointLabelOffsetScale?: number;
  pathDotMarkSizeScale?: number;
  angleLabelFontScale?: number;
  angleArcStrokeScale?: number;
  angleArcSizeScale?: number;
  angleMarkSizeScale?: number;
  rightAngleStrokeScale?: number;
  rightAngleSizeScale?: number;
  autoScaleToFitCm?: { maxWidthCm: number; maxHeightCm: number };
  // When true, every point is emitted as a literal `\tkzDefPoint` at the position
  // the app computes (full double precision), instead of being re-derived in TeX
  // via tkz construction macros. The output is no longer parametric/editable, but
  // it is pixel-faithful to the canvas and immune to tkz-euclide's fixed-point
  // intersection drift and `common=` ordering fragility.
  bakePointCoordinates?: boolean;
};

type ResolvedTikzExportOptions = TikzExportOptions & {
  // Canvas-style sizes (labels in particular) must be calibrated against the
  // auto-fit scale before the user-facing coordinate-only Global multiplier.
  // This keeps Global from silently changing a label's physical font size.
  resolvedCanvasStylePxToTikzPt?: number;
};

export type TikzCommand =
  | { kind: "SetupUnits"; scale: number; trueGlobalScale?: number; labelHaloScale?: number }
  | { kind: "SetupLabelScale"; scale: number }
  | {
      kind: "SetupViewport";
      xmin: number;
      xmax: number;
      ymin: number;
      ymax: number;
      space: number;
      /** True only when the user explicitly requested canvas-view framing. */
      clip: boolean;
    }
  | { kind: "ClipRect"; xmin: number; xmax: number; ymin: number; ymax: number }
  | { kind: "ClipPolygon"; points: { x: number; y: number }[] }
  | { kind: "SetupLine"; addLeft: number; addRight: number }
  | { kind: "DefPoints"; items: { name: string; x: number; y: number }[] }
  | { kind: "ConstructionComment"; text: string }
  | { kind: "DefPoint"; name: string; x: number; y: number }
  | { kind: "DefPointOnLine"; name: string; a: string; b: string }
  | { kind: "DefPointByRotation"; name: string; center: string; point: string; angleDeg: number; direction: "CCW" | "CW" }
  | { kind: "DefPointByTranslation"; name: string; point: string; from: string; to: string }
  | { kind: "DefPointByDilation"; name: string; point: string; center: string; factor: number }
  | { kind: "DefPointByProjection"; name: string; point: string; axisA: string; axisB: string }
  | { kind: "DefPointByReflection"; name: string; point: string; axisA: string; axisB: string; footName: string }
  | { kind: "DefPerpendicularLine"; auxName: string; through: string; baseA: string; baseB: string }
  | { kind: "DefParallelLine"; auxName: string; through: string; baseA: string; baseB: string }
  | {
    kind: "DefCircleSimilitudeCenter";
    name: string;
    mode: "outer" | "inner";
    circleAO: string;
    circleAX: string;
    circleBO: string;
    circleBX: string;
  }
  | {
    kind: "DefCircleTangentsFromPoint";
    from: string;
    circleO: string;
    circleX: string;
    firstName: string;
    secondName: string;
  }
  | { kind: "DefAngleBisectorLine"; auxName: string; a: string; b: string; c: string }
  | { kind: "DefTriangleCenterPoint"; name: string; centerKind: "incenter" | "orthocenter" | "centroid" | "circumcenter"; a: string; b: string; c: string }
  | { kind: "DefIncircle"; centerName: string; touchName: string; a: string; b: string; c: string }
  | { kind: "DefCircleCircumCenter"; centerName: string; a: string; b: string; c: string }
  | { kind: "DefPointOnCircle"; name: string; center: string; through: string; theta: number }
  | { kind: "DefMidPoint"; name: string; a: string; b: string }
  | { kind: "InterLL"; name: string; a1: string; a2: string; b1: string; b2: string }
  | { kind: "InterLC"; name: string; lineA: string; lineB: string; circleO: string; circleX: string; branch: 0 | 1; common?: string; swap?: boolean }
  | { kind: "InterCC"; name: string; circleAO: string; circleAX: string; circleBO: string; circleBX: string; branch: 0 | 1; common?: string; swap?: boolean }
  | { kind: "DrawSegment"; a: string; b: string; style?: string }
  | { kind: "MarkSegment"; a: string; b: string; style: string }
  | { kind: "DrawRaw"; tex: string }
  | {
    kind: "DrawLine";
    a: string;
    b: string;
    addLeft: number;
    addRight: number;
    style?: string;
    finiteFallback?: { ax: number; ay: number; bx: number; by: number };
  }
  | { kind: "DrawCircle"; o: string; x: string; style?: string }
  | { kind: "FillCircle"; o: string; x: string; style?: string }
  | { kind: "DrawCircleRadius"; o: string; radius: number; radiusExpr?: string; style?: string }
  | { kind: "FillCircleRadius"; o: string; radius: number; radiusExpr?: string; style?: string }
  | { kind: "DrawSector"; o: string; a: string; b: string; style?: string }
  | { kind: "FillSector"; o: string; a: string; b: string; style?: string }
  | { kind: "FillAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "MarkAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "MarkRightAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "LabelAngle"; a: string; b: string; c: string; text: string; style?: string; useGlow?: boolean }
  | { kind: "DrawPoints"; style: string; points: string[] }
  | { kind: "LabelPoints"; points: string[] }
  | {
    kind: "LabelPoint";
    name: string;
    text: string;
    options?: string;
    renderAsNode?: boolean;
    useGlow?: boolean;
    plainGlow?: { widthPt: number; color?: string };
    plainGlowCommand?: string;
  }
  | {
    kind: "LabelAt";
    x: number;
    y: number;
    text: string;
    options?: string;
    useGlow?: boolean;
    textMode?: "math" | "raw";
    plainGlow?: { widthPt: number; color?: string };
    plainGlowCommand?: string;
  };

const TEXT_LABEL_CANVAS_SIZE_SCALE = 1.8;

type PointStyleDef = {
  styleName: string;
  styleExpr: string;
};

type LabelPlacement = {
  xShiftPt: number;
  yShiftPt: number;
  rawXShiftPt: number;
  rawYShiftPt: number;
  offsetXPx: number;
  offsetYPx: number;
  scale: number;
  bubbleRadiusPt: number;
};

// Canvas stroke widths are calibrated in canvas pixels. Keep exported arrow outline
// stroke near line stroke via this empirical conversion:
// 7.6px (canvas) -> 0.6pt (TikZ).
const PATH_ARROW_WIDTH_EXPORT_SCALE = 0.6 / 7.6;
// Arrow width UI is stored as lineWidthPt = sliderValue * 8.
const PATH_ARROW_WIDTH_UI_FACTOR = 8;
const DEFAULT_PATH_ARROW_UI = 1.3;
// Fallback only. Normal arrow export computes px->pt from the actual
// canvas zoom and final TikZ coordinate scale.
const FALLBACK_CANVAS_PX_TO_TIKZ_PT = 0.5;
const TIKZ_PT_PER_CM = 72.27 / 2.54;

type PathArrowExportMetrics = {
  pathLengthWorld?: number;
  screenPxPerWorld?: number;
  canvasPxToTikzPt?: number;
  canvasExact?: boolean;
};

function edgeKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`;
}

export function buildTikzIR(scene: SceneModel, options: TikzExportOptions = {}): TikzCommand[] {
  const bakePointCoordinates = options.bakePointCoordinates ?? false;
  const emitPlainConstructions =
    options.drawLayerBackend === "plain" && Boolean(options.bakePointCoordinates);
  const pointById = new Map(scene.points.map((p) => [p.id, p]));
  const lineById = new Map(scene.lines.map((l) => [l.id, l]));
  const segById = new Map(scene.segments.map((s) => [s.id, s]));
  const circleById = new Map(scene.circles.map((c) => [c.id, c]));

  const pointName = buildPointNameMap(scene.points);

  const defs: TikzCommand[] = [];
  const constructions: TikzCommand[] = [];
  const geometryBundles = new Map<string, TikzCommand[]>();
  const drawPointsLayer: TikzCommand[] = [];
  const drawLabelsLayer: TikzCommand[] = [];
  let multiArrowStyleIndex = 0;
  const multiArrowStyleNames = new Map<string, string>();
  const resolveMultiArrowStyleName = (signature: string): string => {
    const existing = multiArrowStyleNames.get(signature);
    if (existing) return existing;
    multiArrowStyleIndex += 1;
    const name = multiArrowStyleIndex === 1
      ? "gdMultiArrow"
      : `gdMultiArrow${multiArrowStyleIndex}`;
    multiArrowStyleNames.set(signature, name);
    return name;
  };
  let multiMarkStyleIndex = 0;
  const nextMultiMarkStyleName = (mark: SegmentMarkSymbol): string => {
    multiMarkStyleIndex += 1;
    const baseName =
      mark === "|"
        ? "gdMultiTick"
        : mark === "||"
          ? "gdMultiDoubleTick"
          : mark === "|||"
            ? "gdMultiTripleTick"
            : "gdMultiMark";
    return multiMarkStyleIndex === 1
      ? baseName
      : `${baseName}${multiMarkStyleIndex}`;
  };
  const definedPointIds = new Set<string>();
  const polygonOwnedEdgePresence = new Set<string>();
  for (const segment of scene.segments) {
    if (!Array.isArray(segment.ownedByPolygonIds) || segment.ownedByPolygonIds.length === 0) continue;
    const key = edgeKey(segment.aId, segment.bId);
    for (const polygonId of segment.ownedByPolygonIds) {
      polygonOwnedEdgePresence.add(`${polygonId}::${key}`);
    }
  }

  const pushGeometryCommands = (ref: SceneGeometryLayerRef, commands: TikzCommand[]): void => {
    if (commands.length === 0) return;
    const key = geometryLayerKey(ref);
    const bundle = geometryBundles.get(key);
    if (bundle) {
      bundle.push(...commands);
      return;
    }
    geometryBundles.set(key, [...commands]);
  };

  const exportPxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  const canvasTrueZoom = clampPositive(options.canvasTrueZoom ?? 1, 0.05, 20);
  const visualTreatmentFactor = clampPositive(options.visualTreatmentFactor ?? 1, 0.05, 20);
  const freeItems: Array<{ name: string; x: number; y: number }> = [];
  const hasExplicitCanvasViewport = options.viewport !== undefined;
  const viewport = options.viewport ?? computeExportViewport(
    scene,
    exportPxPerWorld,
    visualTreatmentFactor
  );
  let coordScale = clampPositive(options.worldToTikzScale ?? 1, 0.01, 100);
  const trueGlobalScale = clampPositive(options.trueGlobalScale ?? 1, 0.05, 10);
  const labelHaloScale = clampPositive(options.labelHaloScale ?? 1, 0.05, 10);
  const labelScale = clampPositive(options.labelScale ?? 1, 0.1, 10);
  // Auto-fit viewport for document embedding. Fit both down and up so exported
  // framing matches the current canvas view density.
  const maxWidthCm = clampPositive(
    options.autoScaleToFitCm?.maxWidthCm ?? TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxWidthCm,
    1,
    200
  );
  const maxHeightCm = clampPositive(
    options.autoScaleToFitCm?.maxHeightCm ?? TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxHeightCm,
    1,
    200
  );
  const worldWidth = Math.max(1e-9, Math.abs(viewport.xmax - viewport.xmin));
  const worldHeight = Math.max(1e-9, Math.abs(viewport.ymax - viewport.ymin));
  const fitScale = Math.min(maxWidthCm / worldWidth, maxHeightCm / worldHeight);
  coordScale = clampPositive(coordScale * fitScale, 0.01, 100);
  const canvasPxToTikzPt = (coordScale * TIKZ_PT_PER_CM) / exportPxPerWorld;
  options = {
    ...options,
    // Fixed-size visual styling must be calibrated before the coordinate-only
    // TikZ scale. Otherwise reciprocal TikZ/scalebox treatment cancels itself
    // and a close-up looks identical to General. A captured viewport already
    // became tighter by True Zoom, so remove that one framing contribution.
    resolvedCanvasStylePxToTikzPt:
      hasExplicitCanvasViewport ||
      options.drawLayerBackend === "plain" ||
      (options.drawLayerBackend === "tkz" && visualTreatmentFactor > 1 + 1e-9)
        ? (fitScale * TIKZ_PT_PER_CM) /
          (exportPxPerWorld * (hasExplicitCanvasViewport ? canvasTrueZoom : 1))
        : undefined,
  } as ResolvedTikzExportOptions;
  defs.push({ kind: "SetupUnits", scale: coordScale, trueGlobalScale, labelHaloScale });
  defs.push({ kind: "SetupLabelScale", scale: labelScale });
  defs.push({
    kind: "SetupViewport",
    xmin: viewport.xmin,
    xmax: viewport.xmax,
    ymin: viewport.ymin,
    ymax: viewport.ymax,
    space: options.clipSpace ?? 0,
    clip: hasExplicitCanvasViewport,
  });
  const globalAdd = options.globalLineAdd ?? 5;
  const lineDrawClipBounds = lineDrawClipBoundsForOptions(viewport, options);
  const plainLineDrawClipBounds = rawLineDrawClipBoundsForOptions(viewport, options);
  defs.push({ kind: "SetupLine", addLeft: globalAdd, addRight: globalAdd });
  if (options.clipRectWorld) {
    // Slightly expand explicit clip rectangle to avoid antialias/stroke edge shaving.
    // Visual Exact must preserve the user's selected crop literally: padding
    // changes both the visible PDF and its bounding box. Keep legacy tkz output
    // unchanged.
    const clipPadWorld =
      options.drawLayerBackend === "plain" && options.bakePointCoordinates
        ? 0
        : 14 / exportPxPerWorld;
    defs.push({
      kind: "ClipRect",
      xmin: Math.min(options.clipRectWorld.xmin, options.clipRectWorld.xmax) - clipPadWorld,
      xmax: Math.max(options.clipRectWorld.xmin, options.clipRectWorld.xmax) + clipPadWorld,
      ymin: Math.min(options.clipRectWorld.ymin, options.clipRectWorld.ymax) - clipPadWorld,
      ymax: Math.max(options.clipRectWorld.ymin, options.clipRectWorld.ymax) + clipPadWorld,
    });
  }
  if (options.clipPolygonWorld && options.clipPolygonWorld.length >= 3) {
    const clipPadWorld =
      options.drawLayerBackend === "plain" && options.bakePointCoordinates
        ? 0
        : 14 / exportPxPerWorld;
    const points = options.clipPolygonWorld.map((p) => ({ x: p.x, y: p.y }));
    const center = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    center.x /= points.length;
    center.y /= points.length;
    const expanded = points.map((p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const d = Math.hypot(dx, dy);
      if (d <= 1e-12) return p;
      return { x: p.x + (dx / d) * clipPadWorld, y: p.y + (dy / d) * clipPadWorld };
    });
    defs.push({ kind: "ClipPolygon", points: expanded });
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const lineAnchorNames = new Map<string, { a: string; b: string }>();
  let derivedAuxIndex = 0;
  const circleThroughNameById = new Map<string, string>();
  const circleCenterNameById = new Map<string, string>();
  const incircleConstructedCircleIds = new Set<string>();
  const incircleCircleIdsByCenterId = new Map<string, string[]>();

  const normalizeExpr = (expr: string | undefined): string => (expr ?? "").replace(/\s+/g, "");
  const buildInradiusExprCandidates = (a: string, b: string, c: string): string[] => {
    const perms = [
      [a, b, c],
      [a, c, b],
      [b, a, c],
      [b, c, a],
      [c, a, b],
      [c, b, a],
    ] as const;
    return perms.map(([x, y, z]) => `Inradius(${x},${y},${z})`);
  };
  const isExportableIncircle = (circleId: string): boolean => {
    const circle = circleById.get(circleId);
    if (!circle || circle.kind !== "fixedRadius") return false;
    const centerPoint = pointById.get(circle.centerId);
    if (!centerPoint || centerPoint.kind !== "triangleCenter" || centerPoint.centerKind !== "incenter") return false;
    const aPoint = pointById.get(centerPoint.aId);
    const bPoint = pointById.get(centerPoint.bId);
    const cPoint = pointById.get(centerPoint.cId);
    if (!aPoint || !bPoint || !cPoint) return false;
    const normalized = normalizeExpr(circle.radiusExpr);
    if (!normalized) return false;
    return buildInradiusExprCandidates(aPoint.name, bPoint.name, cPoint.name)
      .map((expr) => normalizeExpr(expr))
      .includes(normalized);
  };

  for (const circle of scene.circles) {
    if (circle.kind !== "fixedRadius" || !isExportableIncircle(circle.id)) continue;
    const ids = incircleCircleIdsByCenterId.get(circle.centerId);
    if (ids) ids.push(circle.id);
    else incircleCircleIdsByCenterId.set(circle.centerId, [circle.id]);
  }



  const circleGeomById = (circleId: string): { center: { x: number; y: number }; radius: number } => {
    const circle = circleById.get(circleId);
    if (!circle) throw new Error(`Missing circle ${circleId}`);
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) throw new Error(`Undefined circle geometry for ${circleId}`);
    return geom;
  };

  const ensureCircleCenterName = (circleId: string): string => {
    const cached = circleCenterNameById.get(circleId);
    if (cached) return cached;
    const circle = circleById.get(circleId);
    if (!circle) throw new Error(`Missing circle ${circleId}`);
    if (circle.kind !== "threePoint") {
      resolvePoint(circle.centerId);
      const centerName = mustName(pointName, circle.centerId);
      circleCenterNameById.set(circleId, centerName);
      return centerName;
    }
    resolvePoint(circle.aId);
    resolvePoint(circle.bId);
    resolvePoint(circle.cId);
    derivedAuxIndex += 1;
    const centerName = `tkzCircum_${derivedAuxIndex}`;
    if (bakePointCoordinates) {
      // Bake the circumcenter to a literal point so the drawn circle is exact.
      const center = circleGeomById(circle.id).center;
      constructions.push({ kind: "DefPoint", name: centerName, x: center.x, y: center.y });
    } else {
      constructions.push({
        kind: "DefCircleCircumCenter",
        centerName,
        a: mustName(pointName, circle.aId),
        b: mustName(pointName, circle.bId),
        c: mustName(pointName, circle.cId),
      });
    }
    circleCenterNameById.set(circleId, centerName);
    return centerName;
  };

  const ensureCircleThroughName = (circleId: string): string => {
    const cached = circleThroughNameById.get(circleId);
    if (cached) return cached;
    const circle = circleById.get(circleId);
    if (!circle) throw new Error(`Missing circle ${circleId}`);
    if (incircleConstructedCircleIds.has(circle.id)) {
      const throughName = circleThroughNameById.get(circle.id);
      if (!throughName) throw new Error(`Missing incircle through point cache for ${circle.id}`);
      return throughName;
    }
    ensureCircleCenterName(circle.id);
    if (circle.kind === "threePoint") {
      resolvePoint(circle.aId);
      const name = mustName(pointName, circle.aId);
      circleThroughNameById.set(circleId, name);
      return name;
    }
    if (circle.kind !== "fixedRadius") {
      resolvePoint(circle.throughId);
      const name = mustName(pointName, circle.throughId);
      circleThroughNameById.set(circleId, name);
      return name;
    }
    const geom = circleGeomById(circle.id);
    const center = geom.center;
    if (!Number.isFinite(geom.radius) || geom.radius <= 0) {
      throw new Error(`Unsupported construction: CircleFixedRadius (invalid radius for ${circleId})`);
    }
    derivedAuxIndex += 1;
    const helperName = `tkzCircleR_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPoint",
      name: helperName,
      x: center.x + geom.radius,
      y: center.y,
    });
    circleThroughNameById.set(circleId, helperName);
    return helperName;
  };

  const resolveLineAnchorsById = (lineId: string): { a: string; b: string } => {
    const cached = lineAnchorNames.get(lineId);
    if (cached) return cached;
    const line = lineById.get(lineId);
    if (!line) throw new Error(`Missing line ${lineId}`);
    if (line.kind === "tangent") {
      resolvePoint(line.throughId);
      const anchorsWorld = getLineWorldAnchors(line, scene);
      if (!anchorsWorld) {
        throw new Error(`Cannot export undefined tangent geometry: ${line.id}`);
      }
      if (emitPlainConstructions) {
        derivedAuxIndex += 1;
        const auxName = `gdTan_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefPoint",
          name: auxName,
          x: anchorsWorld.b.x,
          y: anchorsWorld.b.y,
        });
        const anchors = {
          a: mustName(pointName, line.throughId),
          b: auxName,
        };
        lineAnchorNames.set(lineId, anchors);
        return anchors;
      }
      derivedAuxIndex += 1;
      const auxName = `tkzTan_${derivedAuxIndex}`;
      constructions.push({
        kind: "DefPoint",
        name: auxName,
        x: anchorsWorld.b.x,
        y: anchorsWorld.b.y,
      });
      const anchors = { a: mustName(pointName, line.throughId), b: auxName };
      lineAnchorNames.set(lineId, anchors);
      return anchors;
    }

    if (line.kind === "circleCircleTangent") {
      const circleA = circleById.get(line.circleAId);
      const circleB = circleById.get(line.circleBId);
      if (!circleA || !circleB) {
        throw new Error(`Cannot export undefined circle-circle tangent geometry: ${line.id}`);
      }
      const geomA = circleGeomById(circleA.id);
      const geomB = circleGeomById(circleB.id);
      const anchorsWorld = getLineWorldAnchors(line, scene);
      if (emitPlainConstructions) {
        if (!anchorsWorld) {
          throw new Error(`Cannot export undefined circle-circle tangent geometry: ${line.id}`);
        }
        derivedAuxIndex += 1;
        const tangentBaseName = `gdTanCC_${derivedAuxIndex}`;
        const tangentAName = `${tangentBaseName}_a`;
        constructions.push({
          kind: "DefPoint",
          name: tangentAName,
          x: anchorsWorld.a.x,
          y: anchorsWorld.a.y,
        });
        const tangentBName = `${tangentBaseName}_b`;
        constructions.push({
          kind: "DefPoint",
          name: tangentBName,
          x: anchorsWorld.b.x,
          y: anchorsWorld.b.y,
        });
        const anchors = { a: tangentAName, b: tangentBName };
        lineAnchorNames.set(lineId, anchors);
        return anchors;
      }
      const tangentTopology = classifyCircleCircleTangentTopology(geomA, geomB);
      assertCircleCircleTangentExportable(line, geomA, geomB);
      if (
        tangentTopology.kind === "degenerateTangency" &&
        !tangentTopology.near &&
        isExactDegenerateCircleCircleTangentFamily(line, tangentTopology)
      ) {
        const circleAO = ensureCircleCenterName(line.circleAId);
        const circleBO = ensureCircleCenterName(line.circleBId);
        const contactRatio =
          tangentTopology.mode === "external"
            ? geomA.radius / (geomA.radius + geomB.radius)
            : geomA.radius / (geomA.radius - geomB.radius);
        derivedAuxIndex += 1;
        const contactName = `tkzTanCC_T_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefPointByDilation",
          name: contactName,
          center: circleAO,
          point: circleBO,
          factor: contactRatio,
        });
        derivedAuxIndex += 1;
        const tangentAuxName = `tkzTanCC_deg_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefPerpendicularLine",
          auxName: tangentAuxName,
          through: contactName,
          baseA: circleAO,
          baseB: circleBO,
        });
        const anchors = { a: contactName, b: tangentAuxName };
        lineAnchorNames.set(lineId, anchors);
        return anchors;
      }
      if (!anchorsWorld) {
        throw new Error(`Cannot export undefined circle-circle tangent geometry: ${line.id}`);
      }
      const simMode: "outer" | "inner" = line.family === "outer" ? "outer" : "inner";
      const equalRadiusTol = 1e-9 * Math.max(1, geomA.radius, geomB.radius);
      if (line.family === "outer" && Math.abs(geomA.radius - geomB.radius) <= equalRadiusTol) {
        const equalOuterAnchors = tryResolveOuterTangentEqualRadii({
          line,
          geomA,
          geomB,
          anchorsWorld,
        });
        if (equalOuterAnchors) {
          lineAnchorNames.set(lineId, equalOuterAnchors);
          return equalOuterAnchors;
        }
      }
      const simWorld = resolveCircleSimilitudeCenter(geomA.center, geomA.radius, geomB.center, geomB.radius, simMode);
      const canUseOuterUnsafeFallback =
        tangentTopology.kind === "disjoint" ||
        tangentTopology.kind === "intersecting" ||
        (tangentTopology.kind === "degenerateTangency" &&
          tangentTopology.mode === "external" &&
          line.family === "outer");
      if (
        line.family === "outer" &&
        canUseOuterUnsafeFallback &&
        simWorld &&
        isTkzUnsafePoint(simWorld) &&
        Math.abs(geomA.radius - geomB.radius) > 1e-12
      ) {
        // Reduced-radius tkz construction avoids unsafe similitude-center coordinates,
        // but for near-equal radii it can lose tangency due tkz numeric precision.
        // In this unsafe region, prefer exact scene-computed tangency points.
        const explicitOuterAnchors = tryResolveOuterTangentByExplicitAnchors({ lineId, anchorsWorld });
        if (explicitOuterAnchors) {
          lineAnchorNames.set(lineId, explicitOuterAnchors);
          return explicitOuterAnchors;
        }
        const reducedOuterAnchors = tryResolveOuterTangentByRadiusDifference({
          line,
          geomA,
          geomB,
          anchorsWorld,
        });
        if (reducedOuterAnchors) {
          lineAnchorNames.set(lineId, reducedOuterAnchors);
          return reducedOuterAnchors;
        }
      }
      const tangentCandidatesA = simWorld ? tangentPointsFromPointToCircle(simWorld, geomA.center, geomA.radius) : [];
      const tangentCandidatesB = simWorld ? tangentPointsFromPointToCircle(simWorld, geomB.center, geomB.radius) : [];

      if (simWorld && tangentCandidatesA.length > 0 && tangentCandidatesB.length > 0) {
        const circleAO = ensureCircleCenterName(line.circleAId);
        const circleAX = ensureCircleThroughName(line.circleAId);
        const circleBO = ensureCircleCenterName(line.circleBId);
        const circleBX = ensureCircleThroughName(line.circleBId);

        derivedAuxIndex += 1;
        const simName = `tkzSim_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefCircleSimilitudeCenter",
          name: simName,
          mode: simMode,
          circleAO,
          circleAX,
          circleBO,
          circleBX,
        });

        derivedAuxIndex += 1;
        const tangentFirstName = `tkzTanCC_${derivedAuxIndex}_1`;
        derivedAuxIndex += 1;
        const tangentSecondName = `tkzTanCC_${derivedAuxIndex}_2`;
        constructions.push({
          kind: "DefCircleTangentsFromPoint",
          from: simName,
          circleO: circleAO,
          circleX: circleAX,
          firstName: tangentFirstName,
          secondName: tangentSecondName,
        });

        derivedAuxIndex += 1;
        const tangentBFirstName = `tkzTanCC_${derivedAuxIndex}_1`;
        derivedAuxIndex += 1;
        const tangentBSecondName = `tkzTanCC_${derivedAuxIndex}_2`;
        constructions.push({
          kind: "DefCircleTangentsFromPoint",
          from: simName,
          circleO: circleBO,
          circleX: circleBX,
          firstName: tangentBFirstName,
          secondName: tangentBSecondName,
        });

        const tkzOrderedTangentsA = orderTangencyCandidatesLikeTkz(
          simWorld,
          geomA.center,
          tangentCandidatesA,
          tangentFirstName,
          tangentSecondName
        );
        let tangentAName = tangentFirstName;
        if (tkzOrderedTangentsA.length > 0) {
          tangentAName = nearestNamedTangencyPoint(tkzOrderedTangentsA, anchorsWorld.a).name;
        }

        const tkzOrderedTangentsB = orderTangencyCandidatesLikeTkz(
          simWorld,
          geomB.center,
          tangentCandidatesB,
          tangentBFirstName,
          tangentBSecondName
        );
        let tangentBName = tangentBFirstName;
        if (tkzOrderedTangentsB.length > 0) {
          tangentBName = nearestNamedTangencyPoint(tkzOrderedTangentsB, anchorsWorld.b).name;
        }
        const anchors = { a: tangentAName, b: tangentBName };
        lineAnchorNames.set(lineId, anchors);
        return anchors;
      }

      // Fallback for degenerate/export-unrepresentable similitude cases
      // (for example equal-radius outer tangents where external center is at infinity).
      derivedAuxIndex += 1;
      const auxAName = `tkzTanCC_A_${derivedAuxIndex}`;
      constructions.push({
        kind: "DefPoint",
        name: auxAName,
        x: anchorsWorld.a.x,
        y: anchorsWorld.a.y,
      });
      derivedAuxIndex += 1;
      const auxBName = `tkzTanCC_B_${derivedAuxIndex}`;
      constructions.push({
        kind: "DefPoint",
        name: auxBName,
        x: anchorsWorld.b.x,
        y: anchorsWorld.b.y,
      });
      const anchors = { a: auxAName, b: auxBName };
      lineAnchorNames.set(lineId, anchors);
      return anchors;
    }

    if (line.kind === "perpendicular" || line.kind === "parallel" || line.kind === "angleBisector") {
      if (line.kind === "angleBisector") {
        resolvePoint(line.aId);
        resolvePoint(line.bId);
        resolvePoint(line.cId);
      } else {
        resolvePoint(line.throughId);
        resolveLineLikeNames(line.base);
      }
      const anchorsWorld = getLineWorldAnchors(line, scene);
      if (!anchorsWorld) {
        throw new Error(`Cannot export undefined ${line.kind} geometry: ${line.id}`);
      }
      if (emitPlainConstructions) {
        const baseAnchorName =
          line.kind === "angleBisector" ? mustName(pointName, line.bId) : mustName(pointName, line.throughId);
        derivedAuxIndex += 1;
        const auxName = `${line.kind === "perpendicular" ? "gdPerp" : line.kind === "parallel" ? "gdPar" : "gdBis"}_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefPoint",
          name: auxName,
          x: anchorsWorld.b.x,
          y: anchorsWorld.b.y,
        });
        const anchors = { a: baseAnchorName, b: auxName };
        lineAnchorNames.set(lineId, anchors);
        return anchors;
      }
      if (line.kind === "angleBisector") {
        derivedAuxIndex += 1;
        const auxName = `tkzBis_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefAngleBisectorLine",
          auxName,
          a: mustName(pointName, line.aId),
          b: mustName(pointName, line.bId),
          c: mustName(pointName, line.cId),
        });
        const anchors = { a: mustName(pointName, line.bId), b: auxName };
        lineAnchorNames.set(lineId, anchors);
        return anchors;
      }
      resolvePoint(line.throughId);
      const base = resolveLineLikeNames(line.base);
      derivedAuxIndex += 1;
      const auxName = `${line.kind === "perpendicular" ? "tkzPerp" : "tkzPar"}_${derivedAuxIndex}`;
      constructions.push(
        line.kind === "perpendicular"
          ? {
            kind: "DefPerpendicularLine",
            auxName,
            through: mustName(pointName, line.throughId),
            baseA: base.a,
            baseB: base.b,
          }
          : {
            kind: "DefParallelLine",
            auxName,
            through: mustName(pointName, line.throughId),
            baseA: base.a,
            baseB: base.b,
          }
      );
      const anchors = { a: mustName(pointName, line.throughId), b: auxName };
      lineAnchorNames.set(lineId, anchors);
      return anchors;
    }
    resolvePoint(line.aId);
    resolvePoint(line.bId);
    if (!definedPointIds.has(line.aId) || !definedPointIds.has(line.bId)) {
      throw new Error(`Cannot export undefined line geometry: ${line.id}`);
    }
    const anchors = { a: mustName(pointName, line.aId), b: mustName(pointName, line.bId) };
    lineAnchorNames.set(lineId, anchors);
    return anchors;
  };

  const isTopologicallyImpossibleCircleCircleTangent = (
    line: Extract<SceneModel["lines"][number], { kind: "circleCircleTangent" }>
  ): boolean => {
    const circleA = circleById.get(line.circleAId);
    const circleB = circleById.get(line.circleBId);
    if (!circleA || !circleB) return false;
    const geomA = circleGeomById(circleA.id);
    const geomB = circleGeomById(circleB.id);
    return circleCircleTangentHasNoCurrentAnchors(line, geomA, geomB);
  };

  const resolveLineLikeNames = (ref: { type: "line" | "segment"; id: string }): { a: string; b: string } => {
    if (ref.type === "segment") {
      const seg = segById.get(ref.id);
      if (!seg) throw new Error(`Missing segment ${ref.id}`);
      resolvePoint(seg.aId);
      resolvePoint(seg.bId);
      if (!definedPointIds.has(seg.aId) || !definedPointIds.has(seg.bId)) {
        throw new Error(`Cannot export undefined segment geometry: ${seg.id}`);
      }
      return { a: mustName(pointName, seg.aId), b: mustName(pointName, seg.bId) };
    }
    return resolveLineAnchorsById(ref.id);
  };

  const tryResolveOuterTangentByRadiusDifference = ({
    line,
    geomA,
    geomB,
    anchorsWorld,
  }: {
    line: Extract<SceneModel["lines"][number], { kind: "circleCircleTangent" }>;
    geomA: { center: { x: number; y: number }; radius: number };
    geomB: { center: { x: number; y: number }; radius: number };
    anchorsWorld: { a: { x: number; y: number }; b: { x: number; y: number } };
  }): { a: string; b: string } | null => {
    if (!(geomA.radius > 1e-12) || !(geomB.radius > 1e-12)) return null;
    const useAAsBig = geomA.radius >= geomB.radius;
    const bigCircleId = useAAsBig ? line.circleAId : line.circleBId;
    const smallCircleId = useAAsBig ? line.circleBId : line.circleAId;
    const bigGeom = useAAsBig ? geomA : geomB;
    const smallGeom = useAAsBig ? geomB : geomA;
    const diff = bigGeom.radius - smallGeom.radius;
    if (!(diff > 1e-12)) return null;

    const bigCenterName = ensureCircleCenterName(bigCircleId);
    const bigThroughName = ensureCircleThroughName(bigCircleId);
    const smallCenterName = ensureCircleCenterName(smallCircleId);

    derivedAuxIndex += 1;
    const reducedPointName = `tkzTanCC_R_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPointByDilation",
      name: reducedPointName,
      center: bigCenterName,
      point: bigThroughName,
      factor: diff / bigGeom.radius,
    });

    derivedAuxIndex += 1;
    const redFirstName = `tkzTanCC_${derivedAuxIndex}_1`;
    derivedAuxIndex += 1;
    const redSecondName = `tkzTanCC_${derivedAuxIndex}_2`;
    constructions.push({
      kind: "DefCircleTangentsFromPoint",
      from: smallCenterName,
      circleO: bigCenterName,
      circleX: reducedPointName,
      firstName: redFirstName,
      secondName: redSecondName,
    });

    const redCandidates = tangentPointsFromPointToCircle(smallGeom.center, bigGeom.center, diff);
    if (redCandidates.length === 0) return null;
    const tkzOrderedReduced = orderTangencyCandidatesLikeTkz(
      smallGeom.center,
      bigGeom.center,
      redCandidates,
      redFirstName,
      redSecondName
    );
    if (tkzOrderedReduced.length === 0) return null;

    const candidateMap = tkzOrderedReduced.map((cand) => {
      const dx = cand.point.x - bigGeom.center.x;
      const dy = cand.point.y - bigGeom.center.y;
      const bigPoint = {
        x: bigGeom.center.x + (bigGeom.radius / diff) * dx,
        y: bigGeom.center.y + (bigGeom.radius / diff) * dy,
      };
      const smallPoint = {
        x: smallGeom.center.x + (smallGeom.radius / diff) * dx,
        y: smallGeom.center.y + (smallGeom.radius / diff) * dy,
      };
      const pointOnA = useAAsBig ? bigPoint : smallPoint;
      const pointOnB = useAAsBig ? smallPoint : bigPoint;
      return { reducedName: cand.name, pointOnA, pointOnB };
    });

    let chosen = candidateMap[0];
    let best = distance(chosen.pointOnA, anchorsWorld.a) + distance(chosen.pointOnB, anchorsWorld.b);
    for (let i = 1; i < candidateMap.length; i += 1) {
      const score = distance(candidateMap[i].pointOnA, anchorsWorld.a) + distance(candidateMap[i].pointOnB, anchorsWorld.b);
      if (score < best) {
        chosen = candidateMap[i];
        best = score;
      }
    }

    derivedAuxIndex += 1;
    const bigTangencyName = `tkzTanCC_Big_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPointByDilation",
      name: bigTangencyName,
      center: bigCenterName,
      point: chosen.reducedName,
      factor: bigGeom.radius / diff,
    });

    derivedAuxIndex += 1;
    const scaledForSmallName = `tkzTanCC_SmallScaled_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPointByDilation",
      name: scaledForSmallName,
      center: bigCenterName,
      point: bigTangencyName,
      factor: smallGeom.radius / bigGeom.radius,
    });

    derivedAuxIndex += 1;
    const smallTangencyName = `tkzTanCC_Small_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPointByTranslation",
      name: smallTangencyName,
      point: scaledForSmallName,
      from: bigCenterName,
      to: smallCenterName,
    });

    derivedAuxIndex += 1;
    const tangentAuxName = `tkzTanCC_outerDiff_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPerpendicularLine",
      auxName: tangentAuxName,
      through: bigTangencyName,
      baseA: bigCenterName,
      baseB: bigTangencyName,
    });

    const pointAName = useAAsBig ? bigTangencyName : smallTangencyName;
    const pointBName = useAAsBig ? smallTangencyName : bigTangencyName;
    return { a: pointAName, b: pointBName === pointAName ? tangentAuxName : pointBName };
  };

  const tryResolveOuterTangentByExplicitAnchors = ({
    lineId,
    anchorsWorld,
  }: {
    lineId: string;
    anchorsWorld: { a: { x: number; y: number }; b: { x: number; y: number } };
  }): { a: string; b: string } | null => {
    if (
      !Number.isFinite(anchorsWorld.a.x) ||
      !Number.isFinite(anchorsWorld.a.y) ||
      !Number.isFinite(anchorsWorld.b.x) ||
      !Number.isFinite(anchorsWorld.b.y)
    ) {
      return null;
    }

    constructions.push({
      kind: "ConstructionComment",
      text: `gd fallback: unsafe near-equal outer tangent (${lineId}) -> explicit tangent anchors`,
    });

    derivedAuxIndex += 1;
    const anchorAName = `tkzTanCC_expA_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPoint",
      name: anchorAName,
      x: anchorsWorld.a.x,
      y: anchorsWorld.a.y,
    });

    derivedAuxIndex += 1;
    const anchorBName = `tkzTanCC_expB_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPoint",
      name: anchorBName,
      x: anchorsWorld.b.x,
      y: anchorsWorld.b.y,
    });

    return { a: anchorAName, b: anchorBName };
  };

  const tryResolveOuterTangentEqualRadii = ({
    line,
    geomA,
    geomB,
    anchorsWorld,
  }: {
    line: Extract<SceneModel["lines"][number], { kind: "circleCircleTangent" }>;
    geomA: { center: { x: number; y: number }; radius: number };
    geomB: { center: { x: number; y: number }; radius: number };
    anchorsWorld: { a: { x: number; y: number }; b: { x: number; y: number } };
  }): { a: string; b: string } | null => {
    if (!(geomA.radius > 1e-12) || !(geomB.radius > 1e-12)) return null;
    const d = distance(geomA.center, geomB.center);
    if (!(d > 1e-12)) return null;
    const r = (geomA.radius + geomB.radius) * 0.5;
    const dx = geomB.center.x - geomA.center.x;
    const dy = geomB.center.y - geomA.center.y;
    const nx = -dy / d;
    const ny = dx / d;

    const ccwCand = {
      a: { x: geomA.center.x + r * nx, y: geomA.center.y + r * ny },
      b: { x: geomB.center.x + r * nx, y: geomB.center.y + r * ny },
    };
    const cwCand = {
      a: { x: geomA.center.x - r * nx, y: geomA.center.y - r * ny },
      b: { x: geomB.center.x - r * nx, y: geomB.center.y - r * ny },
    };
    const ccwScore = distance(ccwCand.a, anchorsWorld.a) + distance(ccwCand.b, anchorsWorld.b);
    const cwScore = distance(cwCand.a, anchorsWorld.a) + distance(cwCand.b, anchorsWorld.b);
    const useCcw = ccwScore <= cwScore;

    const circleAO = ensureCircleCenterName(line.circleAId);
    const circleBO = ensureCircleCenterName(line.circleBId);

    derivedAuxIndex += 1;
    const rotatedCenterName = `tkzTanCC_eqRot_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPointByRotation",
      name: rotatedCenterName,
      center: circleAO,
      point: circleBO,
      angleDeg: 90,
      direction: useCcw ? "CCW" : "CW",
    });

    derivedAuxIndex += 1;
    const tangencyAName = `tkzTanCC_eqA_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPointByDilation",
      name: tangencyAName,
      center: circleAO,
      point: rotatedCenterName,
      factor: geomA.radius / d,
    });

    derivedAuxIndex += 1;
    const tangencyBName = `tkzTanCC_eqB_${derivedAuxIndex}`;
    constructions.push({
      kind: "DefPointByTranslation",
      name: tangencyBName,
      point: tangencyAName,
      from: circleAO,
      to: circleBO,
    });

    return { a: tangencyAName, b: tangencyBName };
  };

  const resolvePoint = (pointId: string) => {
    if (visited.has(pointId)) return;
    if (visiting.has(pointId)) throw new Error(`Cycle detected at point ${pointId}`);
    const point = pointById.get(pointId);
    if (!point) throw new Error(`Missing point ${pointId}`);

    visiting.add(pointId);

    const name = mustName(pointName, point.id);

    if (bakePointCoordinates) {
      // Baked-coordinate export: emit the app-computed position as a literal point
      // instead of re-deriving it in TeX. No dependency recursion is needed.
      const world = getPointWorldPosCached(scene, point.id);
      if (!world) {
        // No evaluated position (e.g. a dynamic intersection currently off-domain).
        // It is not drawn on the canvas, so leave it undefined like the constructive path.
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      if (point.kind === "free") {
        freeItems.push({ name, x: world.x, y: world.y });
      } else {
        constructions.push({ kind: "DefPoint", name, x: world.x, y: world.y });
      }
      definedPointIds.add(point.id);
      visiting.delete(pointId);
      visited.add(pointId);
      return;
    }

    if (point.kind === "free") {
      freeItems.push({ name, x: point.position.x, y: point.position.y });
      definedPointIds.add(point.id);
    } else if (point.kind === "circleCenter") {
      const world = getPointWorldPosCached(scene, point.id);
      if (!world) {
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      constructions.push({
        kind: "DefPoint",
        name,
        x: world.x,
        y: world.y,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "triangleCenter") {
      resolvePoint(point.aId);
      resolvePoint(point.bId);
      resolvePoint(point.cId);
      const incircleCircleIds = incircleCircleIdsByCenterId.get(point.id) ?? [];
      if (point.centerKind === "incenter" && incircleCircleIds.length > 0) {
        derivedAuxIndex += 1;
        const touchName = `tkzInc_${derivedAuxIndex}`;
        const a = mustName(pointName, point.aId);
        const b = mustName(pointName, point.bId);
        const c = mustName(pointName, point.cId);
        constructions.push({
          kind: "DefIncircle",
          centerName: name,
          touchName,
          a,
          b,
          c,
        });
        for (const circleId of incircleCircleIds) {
          circleCenterNameById.set(circleId, name);
          circleThroughNameById.set(circleId, touchName);
          incircleConstructedCircleIds.add(circleId);
        }
      } else {
        constructions.push({
          kind: "DefTriangleCenterPoint",
          name,
          centerKind: point.centerKind,
          a: mustName(pointName, point.aId),
          b: mustName(pointName, point.bId),
          c: mustName(pointName, point.cId),
        });
      }
      definedPointIds.add(point.id);
    } else if (point.kind === "midpointPoints") {
      resolvePoint(point.aId);
      resolvePoint(point.bId);
      constructions.push({
        kind: "DefMidPoint",
        name,
        a: mustName(pointName, point.aId),
        b: mustName(pointName, point.bId),
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "midpointSegment") {
      const seg = segById.get(point.segId);
      if (!seg) throw new Error(`Missing segment ${point.segId}`);
      resolvePoint(seg.aId);
      resolvePoint(seg.bId);
      constructions.push({
        kind: "DefMidPoint",
        name,
        a: mustName(pointName, seg.aId),
        b: mustName(pointName, seg.bId),
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "pointOnLine") {
      const lineAnchors = resolveLineAnchorsById(point.lineId);
      constructions.push({
        kind: "DefPointOnLine",
        name,
        a: lineAnchors.a,
        b: lineAnchors.b,
        // Kept for renderer param-preserving homothety while keeping public union shape unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (constructions[constructions.length - 1] as any).t = point.s;
      definedPointIds.add(point.id);
    } else if (point.kind === "pointOnSegment") {
      const seg = segById.get(point.segId);
      if (!seg) throw new Error(`Missing segment ${point.segId}`);
      resolvePoint(seg.aId);
      resolvePoint(seg.bId);
      constructions.push({
        kind: "DefPointOnLine",
        name,
        a: mustName(pointName, seg.aId),
        b: mustName(pointName, seg.bId),
        // Kept for renderer param-preserving homothety while keeping public union shape unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (constructions[constructions.length - 1] as any).t = point.u;
      definedPointIds.add(point.id);
    } else if (point.kind === "pointOnCircle") {
      const circle = circleById.get(point.circleId);
      if (!circle) throw new Error(`Missing circle ${point.circleId}`);
      const circleCenterName = ensureCircleCenterName(circle.id);
      const throughName = ensureCircleThroughName(circle.id);
      constructions.push({
        kind: "DefPointOnCircle",
        name,
        center: circleCenterName,
        through: throughName,
        theta: point.t,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "pointOnEllipse") {
      const ellipse = (scene.ellipses ?? []).find((item) => item.id === point.ellipseId);
      if (!ellipse) throw new Error(`Missing ellipse ${point.ellipseId}`);
      resolvePoint(ellipse.focusAId);
      resolvePoint(ellipse.focusBId);
      resolvePoint(ellipse.throughId);
      const world = getPointWorldPosCached(scene, point.id);
      if (!world) throw new Error(`Cannot export undefined point on ellipse: ${point.id}`);
      // Ellipses are emitted as numeric TikZ paths, so their constrained points
      // use the matching evaluated coordinate in constructive exports as well.
      constructions.push({ kind: "DefPoint", name, x: world.x, y: world.y });
      definedPointIds.add(point.id);
    } else if (point.kind === "pointByRotation") {
      resolvePoint(point.centerId);
      resolvePoint(point.pointId);
      const expr = point.angleExpr?.trim() || (Number.isFinite(point.angleDeg) ? String(point.angleDeg) : "");
      const evaluated = evaluateAngleExpressionDegrees(scene, expr);
      if (!evaluated.ok) {
        throw new Error(`Unsupported construction: AngleFixed expression for ${name}: ${evaluated.error}`);
      }
      constructions.push({
        kind: "DefPointByRotation",
        name,
        center: mustName(pointName, point.centerId),
        point: mustName(pointName, point.pointId),
        angleDeg: evaluated.valueDeg,
        direction: point.direction,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "pointByTranslation") {
      resolvePoint(point.pointId);
      resolvePoint(point.fromId);
      resolvePoint(point.toId);
      constructions.push({
        kind: "DefPointByTranslation",
        name,
        point: mustName(pointName, point.pointId),
        from: mustName(pointName, point.fromId),
        to: mustName(pointName, point.toId),
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "pointByDilation") {
      resolvePoint(point.pointId);
      resolvePoint(point.centerId);
      const expr = point.factorExpr?.trim() || (typeof point.factor === "number" && Number.isFinite(point.factor) ? String(point.factor) : "");
      if (!expr) {
        throw new Error(`Unsupported construction: Dilate expression for ${name}: missing factor`);
      }
      const evaluated = evaluateNumberExpression(scene, expr);
      if (!evaluated.ok) {
        throw new Error(`Unsupported construction: Dilate expression for ${name}: ${evaluated.error}`);
      }
      if (!Number.isFinite(evaluated.value)) {
        throw new Error(`Unsupported construction: Dilate expression for ${name}: non-finite value`);
      }
      constructions.push({
        kind: "DefPointByDilation",
        name,
        point: mustName(pointName, point.pointId),
        center: mustName(pointName, point.centerId),
        factor: evaluated.value,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "pointByReflection") {
      resolvePoint(point.pointId);
      if (point.axis.type === "point") {
        resolvePoint(point.axis.id);
        constructions.push({
          kind: "DefPointByDilation",
          name,
          point: mustName(pointName, point.pointId),
          center: mustName(pointName, point.axis.id),
          factor: -1,
        });
      } else if (point.axis.type === "pointPair") {
        resolvePoint(point.axis.aId);
        resolvePoint(point.axis.bId);
        derivedAuxIndex += 1;
        const footName = `tkzRefProj_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefPointByReflection",
          name,
          point: mustName(pointName, point.pointId),
          axisA: mustName(pointName, point.axis.aId),
          axisB: mustName(pointName, point.axis.bId),
          footName,
        });
      } else {
        const axis = resolveLineLikeNames(point.axis);
        derivedAuxIndex += 1;
        const footName = `tkzRefProj_${derivedAuxIndex}`;
        constructions.push({
          kind: "DefPointByReflection",
          name,
          point: mustName(pointName, point.pointId),
          axisA: axis.a,
          axisB: axis.b,
          footName,
        });
      }
      definedPointIds.add(point.id);
    } else if (point.kind === "pointByProjection") {
      resolvePoint(point.pointId);
      resolvePoint(point.axisAId);
      resolvePoint(point.axisBId);
      constructions.push({
        kind: "DefPointByProjection",
        name,
        point: mustName(pointName, point.pointId),
        axisA: mustName(pointName, point.axisAId),
        axisB: mustName(pointName, point.axisBId),
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "circleLineIntersectionPoint") {
      const circle = circleById.get(point.circleId);
      const line = lineById.get(point.lineId);
      if (!circle || !line) throw new Error(`Missing circle/line for ${point.id}`);
      const lineAnchors = resolveLineAnchorsById(point.lineId);
      const circleCenterName = ensureCircleCenterName(circle.id);
      const circleThroughName = ensureCircleThroughName(circle.id);
      const lineWorld = getLineWorldAnchors(line, scene);
      const geom = circleGeomById(circle.id);
      const center = geom.center;
      if (!lineWorld) throw new Error(`Undefined line/circle geometry for ${point.name}`);
      const supportRoots = lineCircleIntersectionBranches(lineWorld.a, lineWorld.b, center, geom.radius);
      const roots = filterLineCircleBranchesToDomain(supportRoots, false, line.kind === "ray");
      if (roots.length === 0) {
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      if (line.kind === "ray" && roots.length === 1 && supportRoots.length > 1) {
        constructions.push({
          kind: "DefPointByDilation",
          name,
          center: lineAnchors.a,
          point: lineAnchors.b,
          factor: roots[0].t,
        });
        definedPointIds.add(point.id);
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      if (!point.excludePointId && point.branchIndex === 1 && roots.length < 2) {
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      if (roots.length === 1) {
        if (singleLineCircleRootIsExcluded(roots, point.excludePointId, scene)) {
          visiting.delete(pointId);
          visited.add(pointId);
          return;
        }
        constructions.push({
          kind: "DefPointByProjection",
          name,
          point: circleCenterName,
          axisA: lineAnchors.a,
          axisB: lineAnchors.b,
        });
        definedPointIds.add(point.id);
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      let branch: 0 | 1 = point.branchIndex;
      if (point.excludePointId) {
        const excluded = getPointWorldPosCached(scene, point.excludePointId);
        if (excluded) {
          branch = inferLineCircleBranchFromExcludedRoots(roots, excluded, point.branchIndex);
        }
      }
      let commonName = validDefinedLineCircleCommonPointName(
        point.excludePointId,
        roots,
        branch,
        scene,
        definedPointIds,
        pointName,
        circle
      );
      if (!commonName) {
        const sibling = scene.points.find(
          (p) =>
            p.kind === "circleLineIntersectionPoint" &&
            p.id !== point.id &&
            p.circleId === point.circleId &&
            p.lineId === point.lineId &&
            definedPointIds.has(p.id)
        );
        if (sibling) {
          resolvePoint(sibling.id);
          commonName = validDefinedLineCircleCommonPointName(
            sibling.id,
            roots,
            branch,
            scene,
            definedPointIds,
            pointName,
            circle
          );
        }
      }
      let swap = false;
      const targetWorld = getPointWorldPos(point, scene);

      if (targetWorld && !commonName && roots.length === 2) {
        const anchorsWorld = getLineWorldAnchors(line, scene);
        if (anchorsWorld) {
          const t = targetWorld;
          const r0 = roots[0].point;
          const r1 = roots[1].point;
          const other = distance(r0, t) > distance(r1, t) ? r0 : r1;

          const da_t = distance(anchorsWorld.a, t);
          const da_o = distance(anchorsWorld.a, other);
          const db_t = distance(anchorsWorld.b, t);
          const db_o = distance(anchorsWorld.b, other);

          if (Math.abs(db_t - db_o) > Math.abs(da_t - da_o) + 0.001) {
            const tmp = lineAnchors.a;
            lineAnchors.a = lineAnchors.b;
            lineAnchors.b = tmp;
            swap = db_t > db_o;
          } else {
            swap = da_t > da_o;
          }
        }
      }

      constructions.push({
        kind: "InterLC",
        name,
        lineA: lineAnchors.a,
        lineB: lineAnchors.b,
        circleO: circleCenterName,
        circleX: circleThroughName,
        branch,
        common: commonName,
        swap,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "circleSegmentIntersectionPoint") {
      const circle = circleById.get(point.circleId);
      const seg = segById.get(point.segId);
      if (!circle || !seg) throw new Error(`Missing circle/segment for ${point.id}`);
      resolvePoint(seg.aId);
      resolvePoint(seg.bId);
      const segAName = mustName(pointName, seg.aId);
      const segBName = mustName(pointName, seg.bId);
      const wa = getPointWorldPosCached(scene, seg.aId);
      const wb = getPointWorldPosCached(scene, seg.bId);
      if (!wa || !wb) throw new Error(`Undefined segment geometry for ${point.name}`);
      const circleCenterName = ensureCircleCenterName(circle.id);
      const circleThroughName = ensureCircleThroughName(circle.id);
      const geom = circleGeomById(circle.id);
      const center = geom.center;
      const supportRoots = lineCircleIntersectionBranches(wa, wb, center, geom.radius);
      const roots = filterLineCircleBranchesToDomain(supportRoots, true);
      if (roots.length === 0) {
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      if (!point.excludePointId && point.branchIndex === 1 && roots.length < 2) {
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      const singleFiniteRootFactor = finiteSingleLineCircleRootFactor(roots, supportRoots);
      if (roots.length === 1) {
        if (singleLineCircleRootIsExcluded(roots, point.excludePointId, scene)) {
          visiting.delete(pointId);
          visited.add(pointId);
          return;
        }
        if (singleFiniteRootFactor !== null) {
          constructions.push({
            kind: "DefPointByDilation",
            name,
            center: segAName,
            point: segBName,
            factor: singleFiniteRootFactor,
          });
          definedPointIds.add(point.id);
          visiting.delete(pointId);
          visited.add(pointId);
          return;
        }
        constructions.push({
          kind: "DefPointByProjection",
          name,
          point: circleCenterName,
          axisA: segAName,
          axisB: segBName,
        });
        definedPointIds.add(point.id);
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      let branch: 0 | 1 = point.branchIndex;
      if (point.excludePointId) {
        const excluded = getPointWorldPosCached(scene, point.excludePointId);
        if (excluded) {
          branch = inferLineCircleBranchFromExcludedRoots(roots, excluded, point.branchIndex);
        }
      }
      let commonName = validDefinedLineCircleCommonPointName(
        point.excludePointId,
        roots,
        branch,
        scene,
        definedPointIds,
        pointName,
        circle
      );
      if (!commonName) {
        const sibling = scene.points.find(
          (p) =>
            p.kind === "circleSegmentIntersectionPoint" &&
            p.id !== point.id &&
            p.circleId === point.circleId &&
            p.segId === point.segId &&
            definedPointIds.has(p.id)
        );
        if (sibling) {
          resolvePoint(sibling.id);
          commonName = validDefinedLineCircleCommonPointName(
            sibling.id,
            roots,
            branch,
            scene,
            definedPointIds,
            pointName,
            circle
          );
        }
      }
      let swap = false;
      const targetWorld = getPointWorldPos(point, scene);

      if (targetWorld && !commonName && roots.length === 2 && wa && wb) {
        const t = targetWorld;
        const r0 = roots[0].point;
        const r1 = roots[1].point;
        const other = distance(r0, t) > distance(r1, t) ? r0 : r1;

        const da_t = distance(wa, t);
        const da_o = distance(wa, other);
        const db_t = distance(wb, t);
        const db_o = distance(wb, other);

        let lineA = segAName;
        let lineB = segBName;

        if (Math.abs(db_t - db_o) > Math.abs(da_t - da_o) + 0.001) {
          lineA = segBName;
          lineB = segAName;
          swap = db_t > db_o;
        } else {
          swap = da_t > da_o;
        }

        constructions.push({
          kind: "InterLC",
          name,
          lineA,
          lineB,
          circleO: circleCenterName,
          circleX: circleThroughName,
          branch,
          common: commonName,
          swap,
        });
      } else {
        constructions.push({
          kind: "InterLC",
          name,
          lineA: segAName,
          lineB: segBName,
          circleO: circleCenterName,
          circleX: circleThroughName,
          branch,
          common: commonName,
        });
      }
      definedPointIds.add(point.id);
    } else if (point.kind === "circleCircleIntersectionPoint") {
      const cA = circleById.get(point.circleAId);
      const cB = circleById.get(point.circleBId);
      if (!cA || !cB) throw new Error(`Missing circles for ${point.id}`);
      const cACenterName = ensureCircleCenterName(cA.id);
      const cBCenterName = ensureCircleCenterName(cB.id);
      const cAThroughName = ensureCircleThroughName(cA.id);
      const cBThroughName = ensureCircleThroughName(cB.id);
      const cAGeom = circleGeomById(cA.id);
      const cBGeom = circleGeomById(cB.id);
      const roots = circleCircleIntersections(cAGeom.center, cAGeom.radius, cBGeom.center, cBGeom.radius);
      let branch: 0 | 1 = point.branchIndex;
      if (point.excludePointId) {
        const excluded = getPointWorldPosCached(scene, point.excludePointId);
        if (excluded) {
          branch = inferCircleCircleBranchFromExcludedRoots(roots, excluded, point.branchIndex);
        }
      }
      let commonName = validDefinedCircleCircleCommonPointName(
        point.excludePointId,
        roots,
        branch,
        scene,
        definedPointIds,
        pointName
      );
      if (!commonName && branch === 1) {
        const sibling = scene.points.find((p) => {
          if (p.id === point.id || p.kind !== "circleCircleIntersectionPoint") return false;
          return (
            ((p.circleAId === point.circleAId && p.circleBId === point.circleBId) ||
              (p.circleAId === point.circleBId && p.circleBId === point.circleAId)) &&
            definedPointIds.has(p.id)
          );
        });
        if (sibling) {
          resolvePoint(sibling.id);
          commonName = validDefinedCircleCircleCommonPointName(
            sibling.id,
            roots,
            branch,
            scene,
            definedPointIds,
            pointName
          );
        }
      }
      const targetWorld = getPointWorldPos(point, scene);

      // Find a common point (one that already exists and matches the OTHER intersection)
      if (!commonName && roots.length === 2 && targetWorld) {
        const otherWorld = distance(roots[0], targetWorld) > distance(roots[1], targetWorld) ? roots[0] : roots[1];
        for (const pid of definedPointIds) {
          const pWorld = getPointWorldPosCached(scene, pid);
          if (pWorld && distance(pWorld, otherWorld) < 0.005) {
            commonName = mustName(pointName, pid);
            break;
          }
        }
      }

      let swap = false;
      if (targetWorld) {
        if (!commonName) {
          const roots = circleCircleIntersections(cAGeom.center, cAGeom.radius, cBGeom.center, cBGeom.radius);
          if (roots.length === 2) {
            const o1 = cAGeom.center;
            const o2 = cBGeom.center;
            const a_t = computeOrientedAngleRad(o1, targetWorld, o2);
            if (a_t !== null) {
              swap = a_t >= Math.PI;
            }
          }
        }

        constructions.push({
          kind: "InterCC",
          name,
          circleAO: cACenterName,
          circleAX: cAThroughName,
          circleBO: cBCenterName,
          circleBX: cBThroughName,
          branch,
          common: commonName,
          swap,
        });
        definedPointIds.add(point.id);
      }
    } else if (point.kind === "lineLikeIntersectionPoint") {
      if (!getPointWorldPos(point, scene)) {
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }
      const llA = lineLikeNamesFromRef(point.objA, resolveLineAnchorsById, scene, lineById, segById, pointName, resolvePoint);
      const llB = lineLikeNamesFromRef(point.objB, resolveLineAnchorsById, scene, lineById, segById, pointName, resolvePoint);
      if (!llA || !llB) {
        throw new Error(
          `Unsupported intersection construction for point ${point.name}: ${point.objA.type}-${point.objB.type}`
        );
      }
      constructions.push({
        kind: "InterLL",
        name,
        a1: llA.a,
        a2: llA.b,
        b1: llB.a,
        b2: llB.b,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "intersectionPoint") {
      if (point.objA.type === "angle" || point.objB.type === "angle") {
        const world = getPointWorldPos(point, scene);
        if (!world) {
          visiting.delete(pointId);
          visited.add(pointId);
          return;
        }
        constructions.push({
          kind: "DefPoint",
          name,
          x: world.x,
          y: world.y,
        });
        definedPointIds.add(point.id);
        visiting.delete(pointId);
        visited.add(pointId);
        return;
      }

      const llA = lineLikeNamesFromRef(point.objA, resolveLineAnchorsById, scene, lineById, segById, pointName, resolvePoint);
      const llB = lineLikeNamesFromRef(point.objB, resolveLineAnchorsById, scene, lineById, segById, pointName, resolvePoint);
      const cA = circleFromRef(point.objA, circleById);
      const cB = circleFromRef(point.objB, circleById);

      if (llA && llB) {
        if (!getPointWorldPos(point, scene)) {
          visiting.delete(pointId);
          visited.add(pointId);
          return;
        }
        constructions.push({
          kind: "InterLL",
          name,
          a1: llA.a,
          a2: llA.b,
          b1: llB.a,
          b2: llB.b,
        });
        definedPointIds.add(point.id);
      } else {
        const mixed = llA && cB ? { ll: llA, c: cB } : llB && cA ? { ll: llB, c: cA } : null;
        if (!mixed && cA && cB) {
          const cACenterName = ensureCircleCenterName(cA.id);
          const cBCenterName = ensureCircleCenterName(cB.id);
          const cAThroughName = ensureCircleThroughName(cA.id);
          const cBThroughName = ensureCircleThroughName(cB.id);
          const cAGeom = circleGeomById(cA.id);
          const cBGeom = circleGeomById(cB.id);
          const cAThrough = { x: cAGeom.center.x + cAGeom.radius, y: cAGeom.center.y };
          const cBThrough = { x: cBGeom.center.x + cBGeom.radius, y: cBGeom.center.y };
          const roots = circleCircleIntersections(cAGeom.center, cAGeom.radius, cBGeom.center, cBGeom.radius);
          let branch = inferCircleCircleBranch(point, cAGeom.center, cAThrough, cBGeom.center, cBThrough);
          if (point.excludePointId) {
            const excluded = getPointWorldPosCached(scene, point.excludePointId);
            if (excluded) {
              branch = inferCircleCircleBranchFromExcludedRoots(roots, excluded, branch);
            }
          }
          let commonName = validDefinedCircleCircleCommonPointName(
            point.excludePointId,
            roots,
            branch,
            scene,
            definedPointIds,
            pointName
          );
          if (branch === 1) {
            const sibling = scene.points.find((p) => {
              if (p.id === point.id || p.kind !== "intersectionPoint") return false;
              const aCircle = isCircleRef(point.objA) && isCircleRef(point.objB);
              const bCircle = isCircleRef(p.objA) && isCircleRef(p.objB);
              if (!aCircle || !bCircle) return false;
              return sameObjectPair(p.objA, p.objB, point.objA, point.objB) && definedPointIds.has(p.id);
            });
            if (sibling) {
              resolvePoint(sibling.id);
              commonName = validDefinedCircleCircleCommonPointName(
                sibling.id,
                roots,
                branch,
                scene,
                definedPointIds,
                pointName
              );
            }
          }
          const targetWorld = getPointWorldPos(point, scene);

          // Find a common point (one that already exists and matches the OTHER intersection)
          if (!commonName && roots.length === 2 && targetWorld) {
            const otherWorld = distance(roots[0], targetWorld) > distance(roots[1], targetWorld) ? roots[0] : roots[1];
            for (const pid of definedPointIds) {
              const pWorld = getPointWorldPosCached(scene, pid);
              if (pWorld && distance(pWorld, otherWorld) < 0.005) {
                commonName = mustName(pointName, pid);
                break;
              }
            }
          }

          let swap = false;
          if (targetWorld) {
            if (!commonName) {
              const roots = circleCircleIntersections(cAGeom.center, cAGeom.radius, cBGeom.center, cBGeom.radius);
              if (roots.length === 2) {
                const o1 = cAGeom.center;
                const o2 = cBGeom.center;
                const a_t = computeOrientedAngleRad(o1, targetWorld, o2);
                if (a_t !== null) {
                  swap = a_t >= Math.PI;
                }
              }
            }

            constructions.push({
              kind: "InterCC",
              name,
              circleAO: cACenterName,
              circleAX: cAThroughName,
              circleBO: cBCenterName,
              circleBX: cBThroughName,
              branch,
              common: commonName,
              swap,
            });
            definedPointIds.add(point.id);
          }
        } else {
          if (!mixed) {
            throw new Error(
              `Unsupported intersection construction for point ${point.name}: ${point.objA.type}-${point.objB.type}`
            );
          }
          const mixedCenterName = ensureCircleCenterName(mixed.c.id);
          const circleThroughName = ensureCircleThroughName(mixed.c.id);
          const geom = circleGeomById(mixed.c.id);
          const center = geom.center;
          const through = { x: center.x + geom.radius, y: center.y };
          const supportRoots = lineCircleIntersectionBranches(mixed.ll.worldA, mixed.ll.worldB, center, geom.radius);
          const roots = filterLineCircleBranchesToDomain(supportRoots, mixed.ll.finite, mixed.ll.ray);
          if (roots.length === 0) {
            visiting.delete(pointId);
            visited.add(pointId);
            return;
          }
          const singleFiniteRootFactor = finiteSingleLineCircleRootFactor(roots, supportRoots);
          if (roots.length === 1) {
            if (singleLineCircleRootIsExcluded(roots, point.excludePointId, scene)) {
              visiting.delete(pointId);
              visited.add(pointId);
              return;
            }
            if (singleFiniteRootFactor !== null) {
              constructions.push({
                kind: "DefPointByDilation",
                name,
                center: mixed.ll.a,
                point: mixed.ll.b,
                factor: singleFiniteRootFactor,
              });
              definedPointIds.add(point.id);
              visiting.delete(pointId);
              visited.add(pointId);
              return;
            }
            constructions.push({
              kind: "DefPointByProjection",
              name,
              point: mixedCenterName,
              axisA: mixed.ll.a,
              axisB: mixed.ll.b,
            });
            definedPointIds.add(point.id);
            visiting.delete(pointId);
            visited.add(pointId);
            return;
          }
          let branch = inferLineCircleBranchFromWorld(point, mixed.ll.worldA, mixed.ll.worldB, center, through);
          if (point.excludePointId) {
            const excluded = getPointWorldPosCached(scene, point.excludePointId);
            if (excluded) {
              branch = inferLineCircleBranchFromExcludedRoots(roots, excluded, branch);
            }
          }
          let mixCommonName = validDefinedLineCircleCommonPointName(
            point.excludePointId,
            roots,
            branch,
            scene,
            definedPointIds,
            pointName
          );
          if (!mixCommonName) {
            const sibling = scene.points.find(
              (p) =>
                p.kind === "intersectionPoint" &&
                p.id !== point.id &&
                sameObjectPair(p.objA, p.objB, point.objA, point.objB) &&
                definedPointIds.has(p.id)
            );
            if (sibling) {
              mixCommonName = validDefinedLineCircleCommonPointName(
                sibling.id,
                roots,
                branch,
                scene,
                definedPointIds,
                pointName
              );
            }
          }
          if (!mixCommonName) {
            mixCommonName = inferLineCircleCommonFromEndpointsWorld(
              mixed.ll.endpointAId,
              mixed.ll.endpointBId,
              mixed.ll.worldA,
              mixed.ll.worldB,
              roots,
              branch,
              pointName
            );
          }
          let swap = false;
          const targetWorld = getPointWorldPos(point, scene);
          if (targetWorld && !mixCommonName) {
            if (roots.length === 2) {
              const t = targetWorld;
              const r0 = roots[0].point;
              const r1 = roots[1].point;
              const other = distance(r0, t) > distance(r1, t) ? r0 : r1;
              const da_t = distance(mixed.ll.worldA, targetWorld);
              const da_o = distance(mixed.ll.worldA, other);
              const db_t = distance(mixed.ll.worldB, targetWorld);
              const db_o = distance(mixed.ll.worldB, other);
              if (Math.abs(db_t - db_o) > Math.abs(da_t - da_o) + 0.001) {
                swap = db_t > db_o;
              } else {
                swap = da_t > da_o;
              }
            }
          }

          constructions.push({
            kind: "InterLC",
            name,
            lineA: mixed.ll.a,
            lineB: mixed.ll.b,
            circleO: mixedCenterName,
            circleX: circleThroughName,
            branch,
            common: mixCommonName,
            swap,
          });
          definedPointIds.add(point.id);
        }
      }
    }

    visiting.delete(pointId);
    visited.add(pointId);
  };

  for (const point of scene.points) {
    // Visual Exact has no constructive dependency graph to preserve. Avoid
    // emitting invisible orphan coordinates (especially huge off-canvas ones);
    // visible geometry resolves its hidden anchors on demand below.
    if (emitPlainConstructions && !point.visible) continue;
    const pointWorld = getPointWorldPosCached(scene, point.id);
    // Dynamic intersections can legitimately become undefined under drag.
    // A point with no evaluated position is not drawn on the canvas, so it
    // should not block export unless visible geometry later depends on it.
    if (!pointWorld) {
      continue;
    }
    if (emitPlainConstructions) {
      // Standalone point markers/labels are clipped by the canvas. Do not put
      // remote coordinates into TeX merely because the source point is marked
      // visible; geometry that actually needs the point resolves it on demand.
      const visualPadWorld = 64 / exportPxPerWorld;
      if (
        pointWorld.x < plainLineDrawClipBounds.xmin - visualPadWorld ||
        pointWorld.x > plainLineDrawClipBounds.xmax + visualPadWorld ||
        pointWorld.y < plainLineDrawClipBounds.ymin - visualPadWorld ||
        pointWorld.y > plainLineDrawClipBounds.ymax + visualPadWorld
      ) {
        continue;
      }
    }
    resolvePoint(point.id);
  }

  for (const seg of scene.segments) {
    if (!seg.visible) continue;
    const aWorld = getPointWorldPosCached(scene, seg.aId);
    const bWorld = getPointWorldPosCached(scene, seg.bId);
    if (
      aWorld &&
      bWorld &&
      !finiteSegmentIntersectsRect(
        aWorld,
        bWorld,
        plainLineDrawClipBounds,
        64 / exportPxPerWorld
      )
    ) {
      continue;
    }
    resolvePoint(seg.aId);
    resolvePoint(seg.bId);
    if (!definedPointIds.has(seg.aId) || !definedPointIds.has(seg.bId)) {
      // Dynamic intersections can legitimately disappear while their parent
      // objects move. The canvas omits every segment that depends on such a
      // point; export must do the same instead of aborting the whole figure.
      continue;
    }
    const aName = mustName(pointName, seg.aId);
    const bName = mustName(pointName, seg.bId);
    const segmentBundle: TikzCommand[] = [];
    const segmentArrows = seg.style.segmentArrowMarks ?? seg.style.segmentArrowMark;
    const segmentStrokeCarrierKey = selectSegmentStrokeCarrierArrowKey(seg.style, segmentArrows);
    if (!segmentStrokeCarrierKey) {
      segmentBundle.push({
        kind: "DrawSegment",
        a: aName,
        b: bName,
        style: segmentStyleToTikz(seg.style, options, hasEnabledEndpointSegmentArrow(segmentArrows)),
      });
    }
    const markCommands = segmentMarksToTikz(
      seg.style,
      seg.style.strokeColor,
      seg.style.strokeWidth,
      seg.style.opacity,
      options,
      aName,
      bName,
      aWorld ?? undefined,
      bWorld ?? undefined,
      nextMultiMarkStyleName
    );
    segmentBundle.push(...markCommands);
    const segmentLengthWorld = aWorld && bWorld ? distance(aWorld, bWorld) : undefined;
    const arrowOverlay = segmentArrowsToTikz(
      segmentArrows,
      aName,
      bName,
      {
        strokeColor: seg.style.strokeColor,
        strokeWidth: seg.style.strokeWidth,
        opacity: seg.style.opacity,
        segmentStrokeWidthPt: strokeWidthToTikzPt(seg.style.strokeWidth, options),
        segmentStrokeCarrierKey,
      },
      {
        pathLengthWorld: segmentLengthWorld,
        screenPxPerWorld: exportPxPerWorld,
        canvasPxToTikzPt,
        canvasExact: options.drawLayerBackend === "plain",
      },
      options.pathDotMarkSizeScale,
      options.drawLayerBackend === "plain",
      resolveMultiArrowStyleName
    );
    if (arrowOverlay) {
      if (arrowOverlay.kind === "tkz") {
        segmentBundle.push({
          kind: "DrawSegment",
          a: aName,
          b: bName,
          style: arrowOverlay.style,
        });
      } else {
        segmentBundle.push({
          kind: "DrawRaw",
          tex: arrowOverlay.tex,
        });
      }
    }
    pushGeometryCommands({ type: "segment", id: seg.id }, segmentBundle);
  }
  for (const line of scene.lines) {
    if (!line.visible) continue;
    if (line.kind === "circleCircleTangent" && isTopologicallyImpossibleCircleCircleTangent(line)) continue;
    const lineNames = resolveLineAnchorsById(line.id);
    const ext = computeLineDrawPlacement(scene, line);
    const lineWorldAnchors = getLineWorldAnchors(line, scene);
    if (!lineWorldAnchors) throw new Error(`Cannot export undefined line geometry: ${line.id}`);
    const circleCircleAnchorId = line.kind === "circleCircleTangent" ? `${line.id}#a` : null;
    const lineAnchorId =
      line.kind === "perpendicular" || line.kind === "parallel" || line.kind === "tangent"
        ? line.throughId
        : line.kind === "circleCircleTangent"
          ? (circleCircleAnchorId as string)
          : line.kind === "angleBisector"
            ? line.bId
            : line.aId;
    const drawAName =
      ext.drawAId === line.id
        ? lineNames.b
        : ext.drawAId === lineAnchorId
          ? lineNames.a
          : pointName.get(ext.drawAId) ?? ext.drawAId;
    const drawBName =
      ext.drawBId === line.id
        ? lineNames.b
        : ext.drawBId === lineAnchorId
          ? lineNames.a
          : pointName.get(ext.drawBId) ?? ext.drawBId;
    const drawAWorld = resolveLineDrawReferenceWorld(scene, line, ext.drawAId, lineWorldAnchors);
    const drawBWorld = resolveLineDrawReferenceWorld(scene, line, ext.drawBId, lineWorldAnchors);
    const drawSpanWorld = drawAWorld && drawBWorld ? distance(drawAWorld, drawBWorld) : distance(lineWorldAnchors.a, lineWorldAnchors.b);
    const rayFallback = line.kind === "ray"
      ? clipRayToRect(
          lineWorldAnchors.a,
          lineWorldAnchors.b,
          options.drawLayerBackend === "plain" ? plainLineDrawClipBounds : lineDrawClipBounds
        )
      : null;
    const finiteFallback =
      line.kind === "ray"
        ? rayFallback
          ? { ax: rayFallback.a.x, ay: rayFallback.a.y, bx: rayFallback.b.x, by: rayFallback.b.y }
          : null
      : options.drawLayerBackend === "plain"
        ? lineSegmentThroughRect(lineWorldAnchors.a, lineWorldAnchors.b, plainLineDrawClipBounds)
        : shouldUseFiniteLineDrawFallback(drawSpanWorld, globalAdd)
          ? lineSegmentThroughRect(lineWorldAnchors.a, lineWorldAnchors.b, lineDrawClipBounds)
          : null;
    if ((options.drawLayerBackend === "plain" || line.kind === "ray") && !finiteFallback) continue;
    pushGeometryCommands({ type: "line", id: line.id }, [{
      kind: "DrawLine",
      a: drawAName,
      b: drawBName,
      addLeft: ext.addLeft,
      addRight: ext.addRight,
      style: lineStyleToTikz(line.style, options),
      finiteFallback: finiteFallback ?? undefined,
    }]);
  }
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    // Visual Exact deliberately bakes the canvas result, rather than its
    // construction.  A very large circle is a special case: putting its
    // distant centre or enormous radius into TikZ can exceed TeX's dimension
    // limit even though only a nearly-straight sliver is visible on canvas.
    // Keep this strictly out of the reconstructible/tkz path.
    const isPlainVisualExact = options.drawLayerBackend === "plain" && bakePointCoordinates;
    const preflightGeom = isPlainVisualExact ? circleGeomById(circle.id) : null;
    const hugePlainCircle = Boolean(preflightGeom && preflightGeom.radius * exportPxPerWorld > 6000);
    if (hugePlainCircle && preflightGeom) {
      const visibleCircle = hugeCircleVisibleBoundary(preflightGeom, plainLineDrawClipBounds);
      if (!visibleCircle.intersects) {
        // The canvas clip makes this circle entirely invisible.  In
        // particular, do not resolve its centre just to emit a clipped-away
        // coordinate definition.
        continue;
      }
      if (visibleCircle.containsBounds) {
        // Canvas has no circle boundary to show here; suppress fill as well
        // rather than asking TikZ to paint an enormous disc.
        continue;
      }
      const tangent = hugeCircleTangentSegment(preflightGeom, plainLineDrawClipBounds);
      if (tangent) {
        pushGeometryCommands({ type: "circle", id: circle.id }, [{
          kind: "DrawRaw",
          tex: `% gd plain visual-exact: huge circle rendered as clipped tangent\n\\draw[${circleStrokeStyleToTikz(circle.style, options)}] (${fmt(tangent.ax)},${fmt(tangent.ay)}) -- (${fmt(tangent.bx)},${fmt(tangent.by)});`,
        }]);
      }
      // Arrow decorations are parameterized over the huge circumference and
      // would reintroduce a giant path. The canvas-scale boundary above is the
      // safe visual representation for this exceptional case.
      continue;
    }
    const centerName = ensureCircleCenterName(circle.id);
    const throughName = incircleConstructedCircleIds.has(circle.id) ? ensureCircleThroughName(circle.id) : null;
    const shouldExportPlainCirclesAsRadius = options.drawLayerBackend === "plain";
    const circleRadiusForPlain = shouldExportPlainCirclesAsRadius ? circleGeomById(circle.id).radius : null;
    const fixedRadiusExpr =
      circle.kind === "fixedRadius" && !shouldExportPlainCirclesAsRadius
        ? pgfSafeRadiusExpression(circle.radiusExpr)
        : undefined;
    const fillStyle = circleFillStyleToTikz(circle.style);
    const strokeStyle = circleStrokeStyleToTikz(circle.style, options);
    const circleBundle: TikzCommand[] = [];
    if (circle.kind === "fixedRadius" && !throughName) {
      const geom = circleGeomById(circle.id);
      if (!Number.isFinite(geom.radius) || geom.radius <= 0) {
        throw new Error(`Unsupported construction: CircleFixedRadius (invalid radius for ${circle.id})`);
      }
      const radiusExpr = shouldExportPlainCirclesAsRadius
        ? undefined
        : pgfSafeRadiusExpression(circle.radiusExpr);
      if (fillStyle) {
        circleBundle.push({
          kind: "FillCircleRadius",
          o: centerName,
          radius: geom.radius,
          radiusExpr: radiusExpr ?? undefined,
          style: fillStyle,
        });
      }
      circleBundle.push({
        kind: "DrawCircleRadius",
        o: centerName,
        radius: geom.radius,
        radiusExpr: radiusExpr ?? undefined,
        style: strokeStyle,
      });
    } else if (throughName) {
      if (shouldExportPlainCirclesAsRadius && !Number.isFinite(circleRadiusForPlain ?? Number.NaN)) {
        throw new Error(`Unsupported construction: Circle plain export missing finite radius for ${circle.id}`);
      }
      if (fillStyle) {
        if (shouldExportPlainCirclesAsRadius) {
          circleBundle.push({
            kind: "FillCircleRadius",
            o: centerName,
            radius: circleRadiusForPlain as number,
            radiusExpr: fixedRadiusExpr ?? undefined,
            style: fillStyle,
          });
        } else {
          circleBundle.push({
            kind: "FillCircle",
            o: centerName,
            x: throughName,
            style: fillStyle,
          });
        }
      }
      if (shouldExportPlainCirclesAsRadius) {
        circleBundle.push({
          kind: "DrawCircleRadius",
          o: centerName,
          radius: circleRadiusForPlain as number,
          radiusExpr: fixedRadiusExpr ?? undefined,
          style: strokeStyle,
        });
      } else {
        circleBundle.push({
          kind: "DrawCircle",
          o: centerName,
          x: throughName,
          style: strokeStyle,
        });
      }
    } else if (circle.kind === "threePoint") {
      if (!definedPointIds.has(circle.aId) || !definedPointIds.has(circle.bId) || !definedPointIds.has(circle.cId)) {
        throw new Error(`Cannot export undefined circle geometry: ${circle.id}`);
      }
      const through = mustName(pointName, circle.aId);
      if (shouldExportPlainCirclesAsRadius && !Number.isFinite(circleRadiusForPlain ?? Number.NaN)) {
        throw new Error(`Unsupported construction: Circle plain export missing finite radius for ${circle.id}`);
      }
      if (fillStyle) {
        if (shouldExportPlainCirclesAsRadius) {
          circleBundle.push({
            kind: "FillCircleRadius",
            o: centerName,
            radius: circleRadiusForPlain as number,
            style: fillStyle,
          });
        } else {
          circleBundle.push({
            kind: "FillCircle",
            o: centerName,
            x: through,
            style: fillStyle,
          });
        }
      }
      if (shouldExportPlainCirclesAsRadius) {
        circleBundle.push({
          kind: "DrawCircleRadius",
          o: centerName,
          radius: circleRadiusForPlain as number,
          style: strokeStyle,
        });
      } else {
        circleBundle.push({
          kind: "DrawCircle",
          o: centerName,
          x: through,
          style: strokeStyle,
        });
      }
    } else {
      if (circle.kind === "fixedRadius") {
        throw new Error(`Missing symbolic export path for fixed-radius circle ${circle.id}`);
      }
      if (shouldExportPlainCirclesAsRadius && !Number.isFinite(circleRadiusForPlain ?? Number.NaN)) {
        throw new Error(`Unsupported construction: Circle plain export missing finite radius for ${circle.id}`);
      }
      // Visual Exact already has the evaluated radius, so it must not require
      // (or emit) a hidden construction point merely because that point was
      // used to define the circle. Reconstructible mode does need the named
      // through point and therefore resolves that dependency on demand.
      const through = shouldExportPlainCirclesAsRadius
        ? null
        : ensureCircleThroughName(circle.id);
      if (fillStyle) {
        if (shouldExportPlainCirclesAsRadius) {
          circleBundle.push({
            kind: "FillCircleRadius",
            o: centerName,
            radius: circleRadiusForPlain as number,
            style: fillStyle,
          });
        } else {
          circleBundle.push({
            kind: "FillCircle",
            o: centerName,
            x: through as string,
            style: fillStyle,
          });
        }
      }
      if (shouldExportPlainCirclesAsRadius) {
        circleBundle.push({
          kind: "DrawCircleRadius",
          o: centerName,
          radius: circleRadiusForPlain as number,
          style: strokeStyle,
        });
      } else {
        circleBundle.push({
          kind: "DrawCircle",
          o: centerName,
          x: through as string,
          style: strokeStyle,
        });
      }
    }
    const circleGeom = circleGeomById(circle.id);
    const circleArrowOverlay = pathArrowOverlayToTikz(
      circle.style.arrowMarks ?? circle.style.arrowMark,
      circlePathExprFromCenterClockwise(circleGeom.center, circleGeom.radius),
      {
        strokeColor: circle.style.strokeColor,
        strokeWidth: circle.style.strokeWidth,
        opacity: circle.style.strokeOpacity,
      },
      0.5,
      {
        pathLengthWorld: 2 * Math.PI * circleGeom.radius,
        screenPxPerWorld: exportPxPerWorld,
        canvasPxToTikzPt,
        canvasExact: options.drawLayerBackend === "plain",
      },
      undefined, // arcDef undefined -> Use markings (Decoration)
      { bend: true }, // Circle arrows use bend
      options.pathDotMarkSizeScale,
      resolveMultiArrowStyleName
    );
    if (circleArrowOverlay) {
      circleBundle.push({ kind: "DrawRaw", tex: circleArrowOverlay });
    }
    pushGeometryCommands({ type: "circle", id: circle.id }, circleBundle);
  }
  for (const ellipse of scene.ellipses ?? []) {
    if (!ellipse.visible) continue;
    if (
      !definedPointIds.has(ellipse.focusAId) ||
      !definedPointIds.has(ellipse.focusBId) ||
      !definedPointIds.has(ellipse.throughId)
    ) {
      throw new Error(`Cannot export undefined ellipse geometry: ${ellipse.id}`);
    }
    const geom = getEllipseWorldGeometry(ellipse, scene);
    if (!geom) throw new Error(`Cannot export undefined ellipse geometry: ${ellipse.id}`);
    const ellipseArrows = ellipse.style.arrowMarks ?? (ellipse.style.arrowMark ? [ellipse.style.arrowMark] : []);
    if (ellipseArrows.some((arrow) => Boolean(arrow?.enabled))) {
      throw new Error(`Unsupported Ellipse style: arrow marks (${ellipse.id})`);
    }
    const fillStyle = circleFillStyleToTikz(ellipse.style);
    const strokeStyle = circleStrokeStyleToTikz(ellipse.style, options);
    const transformStyle = ellipseRotationStyleToTikz(geom.center, geom.rotationRad);
    const ellipsePath = `(${fmt(geom.center.x)},${fmt(geom.center.y)}) ellipse[x radius=${fmt(geom.semiMajor)}, y radius=${fmt(geom.semiMinor)}]`;
    const ellipseBundle: TikzCommand[] = [];
    if (fillStyle) {
      const fillOpts = [fillStyle, transformStyle].filter(Boolean).join(", ");
      ellipseBundle.push({ kind: "DrawRaw", tex: `\\fill[${fillOpts}] ${ellipsePath};` });
    }
    const drawOpts = [strokeStyle, transformStyle].filter(Boolean).join(", ");
    ellipseBundle.push({ kind: "DrawRaw", tex: `\\draw[${drawOpts}] ${ellipsePath};` });
    pushGeometryCommands({ type: "ellipse", id: ellipse.id }, ellipseBundle);
  }
  for (const polygon of scene.polygons) {
    if (!polygon.visible) continue;
    if (polygon.pointIds.length < 3) continue;
    const names: string[] = [];
    for (let i = 0; i < polygon.pointIds.length; i += 1) {
      const pointId = polygon.pointIds[i];
      resolvePoint(pointId);
      if (!definedPointIds.has(pointId)) {
        throw new Error(`Cannot export undefined polygon geometry: ${polygon.id}`);
      }
      names.push(mustName(pointName, pointId));
    }
    const fillStyle = polygonFillStyleToTikz(polygon.style);
    const strokeStyle = polygonStrokeStyleToTikz(polygon.style, options);
    const polygonBundle: TikzCommand[] = [];
    const path = names.map((name, idx) => (idx === 0 ? `(${name})` : ` -- (${name})`)).join("");
    if (fillStyle) {
      const fillOpts = fillStyle ? `[${fillStyle}]` : "";
      polygonBundle.push({ kind: "DrawRaw", tex: `\\fill${fillOpts} ${path} -- cycle;` });
    }
    const strokeOpts = strokeStyle ? `[${strokeStyle}]` : "";
    for (let i = 0; i < polygon.pointIds.length; i += 1) {
      const nextIndex = (i + 1) % polygon.pointIds.length;
      const scopedKey = `${polygon.id}::${edgeKey(polygon.pointIds[i], polygon.pointIds[nextIndex])}`;
      // Polygon edges are managed by owned segment objects when present.
      if (polygonOwnedEdgePresence.has(scopedKey)) continue;
      polygonBundle.push({
        kind: "DrawRaw",
        tex: `\\draw${strokeOpts} (${names[i]}) -- (${names[nextIndex]});`,
      });
    }
    pushGeometryCommands({ type: "polygon", id: polygon.id }, polygonBundle);
  }
  for (const angle of scene.angles) {
    if (!angle.visible) continue;
    resolvePoint(angle.aId);
    resolvePoint(angle.bId);
    resolvePoint(angle.cId);
    const aWorld = getPointWorldPosCached(scene, angle.aId);
    const bWorld = getPointWorldPosCached(scene, angle.bId);
    const cWorld = getPointWorldPosCached(scene, angle.cId);
    if (!aWorld || !bWorld || !cWorld) {
      // Match canvas semantics for temporarily undefined intersection-based
      // angles: omit this dependent object and keep exporting valid geometry.
      continue;
    }
    const theta = computeOrientedAngleRad(aWorld, bWorld, cWorld);
    if (theta === null) {
      continue;
    }
    const aName = mustName(pointName, angle.aId);
    const bName = mustName(pointName, angle.bId);
    const cName = mustName(pointName, angle.cId);
    const angleBundle: TikzCommand[] = [];
    if (angle.kind === "sector") {
      const sectorRadius = distance(aWorld, bWorld);
      const sectorStart = Math.atan2(aWorld.y - bWorld.y, aWorld.x - bWorld.x);
      const sectorArcPath = arcPathExprFromWorld(bWorld, sectorRadius, sectorStart, theta, `(${aName})`);
      const sectorDrawStyle = sectorDrawStyleToTikz(angle.style, options);
      const sectorFillStyle = angle.style.fillEnabled ? sectorFillStyleToTikz(angle.style) : null;

      if (options.drawLayerBackend === "plain") {
        if (sectorFillStyle) {
          angleBundle.push({
            kind: "DrawRaw",
            tex: `\\fill[${sectorFillStyle}] (${bName}) -- ${sectorArcPath} -- cycle;`,
          });
        }
        const drawOpts = sectorDrawStyle ? `[${sectorDrawStyle}]` : "";
        angleBundle.push({
          kind: "DrawRaw",
          tex: `\\draw${drawOpts} (${bName}) -- ${sectorArcPath} -- cycle;`,
        });
      } else {
        if (sectorFillStyle) {
          angleBundle.push({ kind: "FillSector", o: bName, a: aName, b: cName, style: sectorFillStyle });
        }
        angleBundle.push({
          kind: "DrawSector",
          o: bName,
          a: aName,
          b: cName,
          style: sectorDrawStyle,
        });
      }

      const sectorArrowOverlay = pathArrowOverlayToTikz(
        angle.style.arcArrowMarks ?? angle.style.arcArrowMark,
        sectorArcPath,
        {
          strokeColor: angle.style.strokeColor,
          strokeWidth: angle.style.strokeWidth,
          opacity: angle.style.strokeOpacity,
        },
        angle.style.markPos ?? 0.5,
        {
          pathLengthWorld: Math.abs(theta) * sectorRadius,
          screenPxPerWorld: exportPxPerWorld,
          canvasPxToTikzPt,
          canvasExact: false,
        },
        {
          center: bWorld,
          radius: sectorRadius,
          startRad: sectorStart,
          sweepRad: theta,
        },
        { flex: true }, // Keep angle arrows using flex
        options.pathDotMarkSizeScale,
        resolveMultiArrowStyleName
      );
      if (sectorArrowOverlay) {
        if (options.drawLayerBackend !== "plain") {
          angleBundle.push({ kind: "DrawRaw", tex: sectorArrowOverlay });
        }
      }
      const normalizedSectorMarkStyle =
        angle.style.markStyle === "right"
          ? "rightSquare"
          : angle.style.markStyle;
      const shouldDrawSectorArcMarks =
        options.drawLayerBackend !== "plain" ||
        normalizedSectorMarkStyle === "arc";
      if (
        options.drawLayerBackend === "plain" &&
        normalizedSectorMarkStyle === "arc" &&
        resolveAngleMarks(angle.style).length > 0
      ) {
        angleBundle.push({
          kind: "DrawRaw",
          tex: `\\draw[${sectorDrawStyle}] ${sectorArcPath};`,
        });
      }
      const sectorMarkOverlay = shouldDrawSectorArcMarks
        ? sectorMarksToTikz(
            angle.style,
            sectorArcPath,
            {
              strokeColor: angle.style.strokeColor,
              strokeWidth: angle.style.strokeWidth,
              opacity: angle.style.strokeOpacity,
            },
            options
          )
        : null;
      if (sectorMarkOverlay) {
        angleBundle.push({ kind: "DrawRaw", tex: sectorMarkOverlay });
      }
      if (
        options.drawLayerBackend === "plain" &&
        sectorArrowOverlay
      ) {
        angleBundle.push({ kind: "DrawRaw", tex: sectorArrowOverlay });
      }
      pushGeometryCommands({ type: "angle", id: angle.id }, angleBundle);
      if (
        options.drawLayerBackend === "plain" &&
        (angle.style.showLabel || angle.style.showValue)
      ) {
        const labelText = buildAngleLabelTex(
          angle.style.labelText,
          angle.style.showLabel,
          angle.style.showValue,
          theta
        );
        const labelCommand = labelText
          ? plainAngleLabelCommand(angle, labelText, options)
          : null;
        if (labelCommand) drawLabelsLayer.push(labelCommand);
      }
      continue;
    }
    const rightStatus = resolveAngleRightStatus(scene, angle);
    if (options.drawLayerBackend === "plain") {
      angleBundle.push(
        ...plainNonSectorAngleCommands(
          angle,
          aWorld,
          bWorld,
          cWorld,
          theta,
          rightStatus,
          options,
          resolveMultiArrowStyleName
        )
      );
      pushGeometryCommands({ type: "angle", id: angle.id }, angleBundle);
      if (angle.style.showLabel || angle.style.showValue) {
        const labelText = buildAngleLabelTex(
          angle.style.labelText,
          angle.style.showLabel,
          angle.style.showValue,
          theta
        );
        const labelCommand = labelText
          ? plainAngleLabelCommand(angle, labelText, options)
          : null;
        if (labelCommand) drawLabelsLayer.push(labelCommand);
      }
      continue;
    }
    const exportAsRight = rightStatus === "exact" || (rightStatus === "approx" && Boolean(angle.style.promoteToSolid));
    const markKind = resolveAngleMarkKind(angle.style.markStyle, exportAsRight);
    const rightSquareFillStyle =
      exportAsRight && markKind === "rightSquare" && angle.style.fillEnabled ? rightSquareFillStyleToTikz(angle.style) : null;
    if (angle.style.fillEnabled && !rightSquareFillStyle) {
      const fillStyle = angleFillStyleToTikz(angle.style, options);
      angleBundle.push({ kind: "FillAngle", a: aName, b: bName, c: cName, style: fillStyle });
    }
    if (markKind === "rightSquare" || markKind === "rightArcDot") {
      const markStyle = angleMarkStyleToTikz(angle.style, true, options, markKind);
      const mergedStyle = rightSquareFillStyle ? [markStyle, rightSquareFillStyle].filter(Boolean).join(", ") : markStyle;
      angleBundle.push({ kind: "MarkRightAngle", a: aName, b: bName, c: cName, style: mergedStyle });
    } else if (markKind === "arc") {
      const marks = resolveAngleMarks(angle.style);
      let arcLayerOffset = 0;
      for (const mark of marks) {
        const markStyle = angleMarkStyleToTikz(angle.style, false, options, markKind, {
          arcMultiplicity: mark.arcMultiplicity,
          markSymbol: mark.markSymbol,
          markPos: mark.markPos,
          markSize: mark.markSize,
          markColor: mark.markColor,
          arcLayerOffset,
        });
        angleBundle.push({ kind: "MarkAngle", a: aName, b: bName, c: cName, style: markStyle });
        arcLayerOffset += mark.arcMultiplicity;
      }
    }
    if (markKind === "arc" || markKind === "rightArcDot") {
      const angleStart = Math.atan2(aWorld.y - bWorld.y, aWorld.x - bWorld.x);
      const arcRadius = nonSectorAngleRadiusWorldFromStyle(angle.style, options);
      const arcArrowOverlay = pathArrowOverlayToTikz(
        angle.style.arcArrowMarks ?? angle.style.arcArrowMark,
        arcPathExprFromWorld(bWorld, arcRadius, angleStart, theta),
        {
          strokeColor: angle.style.strokeColor,
          strokeWidth: angle.style.strokeWidth,
          opacity: angle.style.strokeOpacity,
        },
        angle.style.markPos ?? 0.5,
        {
          pathLengthWorld: Math.abs(theta) * arcRadius,
          screenPxPerWorld: exportPxPerWorld,
          canvasPxToTikzPt,
          canvasExact: false,
        },
        {
          center: bWorld,
          radius: arcRadius,
          startRad: angleStart,
          sweepRad: theta,
        },
        { flex: true }, // Keep angle arrows using flex
        options.pathDotMarkSizeScale,
        resolveMultiArrowStyleName
      );
      if (arcArrowOverlay) {
        angleBundle.push({ kind: "DrawRaw", tex: arcArrowOverlay });
      }
    }
    pushGeometryCommands({ type: "angle", id: angle.id }, angleBundle);
    if (angle.style.showLabel || angle.style.showValue) {
      const labelText = buildAngleLabelTex(angle.style.labelText, angle.style.showLabel, angle.style.showValue, theta);
      if (labelText) {
        const labelStyle = angleLabelStyleToTikz(angle, aWorld, bWorld, cWorld, options, rightStatus !== "none");
        drawLabelsLayer.push({
          kind: "LabelAngle",
          a: aName,
          b: bName,
          c: cName,
          text: labelText,
          style: labelStyle,
          useGlow: (options.labelGlow ?? true) && Boolean(angle.style.labelGlow),
        });
      }
    }
  }

  const drawablePoints = scene.points.filter((point) => point.visible && definedPointIds.has(point.id));
  const pointStyleGroups = buildPointStyleGroups(drawablePoints, pointName, options);
  for (const group of pointStyleGroups) {
    drawPointsLayer.push({ kind: "DrawPoints", style: group.styleName, points: group.points } as TikzCommand);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (drawPointsLayer[drawPointsLayer.length - 1] as any).styleExpr = group.styleExpr;
  }

  const labelPlacementById = computeLabelPlacementMap(scene, options);
  const labels: Array<{
    name: string;
    text: string;
    options?: string;
    renderAsNode?: boolean;
    useGlow?: boolean;
  }> = [];
  const objectLabels: Array<{
    type: "segment" | "line" | "circle" | "ellipse" | "polygon";
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
    useGlow: boolean;
  }> = [];
  const objectLabelGlowEnabled = options.labelGlow ?? true;

  for (const point of scene.points) {
    if (!point.visible) continue;
    if (!definedPointIds.has(point.id)) continue;
    if (point.showLabel === "none") continue;
    const name = pointName.get(point.id);
    if (!name) continue;
    const placement = labelPlacementById.get(point.id) ?? null;
    const labelGlowEnabled = options.labelGlow ?? true;
    const plainPxToPt = resolvedPlainCanvasPxToTikzPt(options);
    if (plainPxToPt !== null) {
      const offsetXPx = placement?.offsetXPx ?? point.style.labelOffsetPx.x;
      const offsetYPx = placement?.offsetYPx ?? point.style.labelOffsetPx.y;
      const canvasKatexScale =
        point.showLabel === "caption" ? 0.95 : 1;
      const fontPt = Math.max(
        1,
        point.style.labelFontPx * canvasKatexScale * plainPxToPt
      );
      const baselinePt = Math.max(fontPt, fontPt * 1.2);
      const labelText =
        point.showLabel === "name"
          ? point.name || name
          : point.captionTex || point.name || name;
      drawLabelsLayer.push({
        kind: "LabelPoint",
        name,
        text: labelText,
        options: [
          semanticPointLabelPositionOption(
            labelText,
            offsetXPx,
            offsetYPx,
            point.style.labelFontPx * canvasKatexScale,
            point.showLabel === "caption" ? "top-left" : "baseline-left"
          ),
          "inner sep=0pt",
          `text=${rgbColorExpr(point.style.labelColor)}`,
          `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(baselinePt)}pt}\\selectfont`,
        ].join(", "),
        useGlow: labelGlowEnabled && point.style.labelHaloWidthPx > 0,
        plainGlow: {
          widthPt:
            point.style.labelHaloWidthPx *
            plainPxToPt *
            trueGlobalScale *
            labelHaloScale,
          // No export override deliberately means "use the page color". The
          // glow macro resolves it through \thepagecolor, with a white fallback
          // when the host document has no pagecolor support.
          color: options.labelHaloColor
            ? rgbColorExpr(options.labelHaloColor)
            : undefined,
        },
      });
      continue;
    }
    const labelOptions = pointLabelOptionsToTikz(point, placement, options);
    const renderAsNode = resolvedReconstructibleCanvasStylePxToTikzPt(options) !== null;
    if (point.showLabel === "name") {
      labels.push({
        name,
        text: point.name || name,
        options: [labelOptions, `text=${rgbColorExpr(point.style.labelColor)}`].join(", "),
        renderAsNode,
        useGlow: labelGlowEnabled && point.style.labelHaloWidthPx > 0,
      });
    } else {
      labels.push({
        name,
        text: point.captionTex || point.name || name,
        options: [labelOptions, `text=${rgbColorExpr(point.style.labelColor)}`].join(", "),
        renderAsNode,
        useGlow: labelGlowEnabled && point.style.labelHaloWidthPx > 0,
      });
    }
  }

  for (const segment of scene.segments) {
    if (!segment.visible || !segment.showLabel) continue;
    const fallbackText = defaultObjectLabelText({ type: "segment", id: segment.id }, scene);
    const text = resolveObjectLabelText(segment.labelText, fallbackText);
    const fallbackPos = defaultObjectLabelPosWorld({ type: "segment", id: segment.id }, scene);
    const labelPos = isFiniteLabelPosWorld(segment.labelPosWorld) ? segment.labelPosWorld : fallbackPos;
    if (!labelPos) continue;
    objectLabels.push({
      type: "segment",
      id: segment.id,
      x: labelPos.x,
      y: labelPos.y,
      text,
      color: segment.style.strokeColor,
      useGlow: objectLabelGlowEnabled && segment.labelGlow !== false,
    });
  }

  for (const line of scene.lines) {
    if (!line.visible || !line.showLabel) continue;
    if (line.kind === "circleCircleTangent" && isTopologicallyImpossibleCircleCircleTangent(line)) continue;
    const fallbackText = defaultObjectLabelText({ type: "line", id: line.id }, scene);
    const text = resolveObjectLabelText(line.labelText, fallbackText);
    const fallbackPos = defaultObjectLabelPosWorld({ type: "line", id: line.id }, scene);
    const labelPos = isFiniteLabelPosWorld(line.labelPosWorld) ? line.labelPosWorld : fallbackPos;
    if (!labelPos) continue;
    objectLabels.push({
      type: "line",
      id: line.id,
      x: labelPos.x,
      y: labelPos.y,
      text,
      color: line.style.strokeColor,
      useGlow: objectLabelGlowEnabled && line.labelGlow !== false,
    });
  }

  for (const circle of scene.circles) {
    if (!circle.visible || !circle.showLabel) continue;
    const fallbackText = defaultObjectLabelText({ type: "circle", id: circle.id }, scene);
    const text = resolveObjectLabelText(circle.labelText, fallbackText);
    const fallbackPos = defaultObjectLabelPosWorld({ type: "circle", id: circle.id }, scene);
    const labelPos = isFiniteLabelPosWorld(circle.labelPosWorld) ? circle.labelPosWorld : fallbackPos;
    if (!labelPos) continue;
    objectLabels.push({
      type: "circle",
      id: circle.id,
      x: labelPos.x,
      y: labelPos.y,
      text,
      color: circle.style.strokeColor,
      useGlow: objectLabelGlowEnabled && circle.labelGlow !== false,
    });
  }

  for (const ellipse of scene.ellipses ?? []) {
    if (!ellipse.visible || !ellipse.showLabel) continue;
    const fallbackText = defaultObjectLabelText({ type: "ellipse", id: ellipse.id }, scene);
    const text = resolveObjectLabelText(ellipse.labelText, fallbackText);
    const fallbackPos = defaultObjectLabelPosWorld({ type: "ellipse", id: ellipse.id }, scene);
    const labelPos = isFiniteLabelPosWorld(ellipse.labelPosWorld) ? ellipse.labelPosWorld : fallbackPos;
    if (!labelPos) continue;
    objectLabels.push({
      type: "ellipse",
      id: ellipse.id,
      x: labelPos.x,
      y: labelPos.y,
      text,
      color: ellipse.style.strokeColor,
      useGlow: objectLabelGlowEnabled && ellipse.labelGlow !== false,
    });
  }

  for (const polygon of scene.polygons) {
    if (!polygon.visible || !polygon.showLabel) continue;
    const fallbackText = defaultObjectLabelText({ type: "polygon", id: polygon.id }, scene);
    const text = resolveObjectLabelText(polygon.labelText, fallbackText);
    const fallbackPos = defaultObjectLabelPosWorld({ type: "polygon", id: polygon.id }, scene);
    const labelPos = isFiniteLabelPosWorld(polygon.labelPosWorld) ? polygon.labelPosWorld : fallbackPos;
    if (!labelPos) continue;
    objectLabels.push({
      type: "polygon",
      id: polygon.id,
      x: labelPos.x,
      y: labelPos.y,
      text,
      color: polygon.style.strokeColor,
      useGlow: objectLabelGlowEnabled && polygon.labelGlow !== false,
    });
  }

  for (const label of scene.textLabels ?? []) {
    if (!label.visible) continue;
    const displayText = resolveTextLabelDisplayText(label, scene);
    const renderMode = resolveTextLabelRenderMode(label.style);
    const boxWidthPx = resolveTextLabelBoxWidthPx(label.style);
    const boxHeightPx = resolveTextLabelBoxHeightPx(label.style);
    const textAlign = resolveTextLabelAlignment(label.style);
    const text =
      renderMode === "tex"
        ? displayText
        : renderMode === "mixed"
          ? buildMixedTextLabelNodeText(displayText)
          : buildPlainTextLabelNodeText(displayText);
    const plainPxToPt = resolvedPlainCanvasPxToTikzPt(options);
    const reconstructiblePxToPt = resolvedReconstructibleCanvasStylePxToTikzPt(options);
    const canvasStylePxToPt = plainPxToPt ?? reconstructiblePxToPt;
    const fontPt =
      canvasStylePxToPt === null
        ? Math.max(1, Math.min(72, label.style.textSize + 0.19))
        : Math.max(
            0.5,
            Math.max(8, label.style.textSize) *
              TEXT_LABEL_CANVAS_SIZE_SCALE *
              (renderMode === "tex" ? 0.95 : 1) *
              canvasStylePxToPt
          );
    const baselinePt = Math.max(fontPt + 1, fontPt * 1.2);
    const rotationDeg =
      typeof label.style.rotationDeg === "number" && Number.isFinite(label.style.rotationDeg)
        ? label.style.rotationDeg
        : 0;
    const boxOptions =
      plainPxToPt === null
        ? boxWidthPx && renderMode !== "tex"
          ? [
              `text width=${fmt(
                boxWidthPx / TEXT_LABEL_CANVAS_SIZE_SCALE
              )}pt`,
            ]
          : []
        : boxWidthPx || boxHeightPx
          ? [
              `inner xsep=${fmt(12 * plainPxToPt)}pt`,
              `inner ysep=${fmt(10 * plainPxToPt)}pt`,
              ...(boxWidthPx
                ? [
                    `text width=${fmt(
                      Math.max(1, boxWidthPx - 24) * plainPxToPt
                    )}pt`,
                  ]
                : []),
              ...(boxHeightPx
                ? [
                    `minimum height=${fmt(
                      boxHeightPx * plainPxToPt
                    )}pt`,
                  ]
                : []),
            ]
          : [];
    drawLabelsLayer.push({
      kind: "LabelAt",
      x: label.positionWorld.x,
      y: label.positionWorld.y,
      text,
      options: [
        "anchor=center",
        `align=${textAlign}`,
        `text=${rgbColorExpr(label.style.textColor)}`,
        `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(baselinePt)}pt}\\selectfont`,
        ...boxOptions,
        ...(Math.abs(rotationDeg) > 1e-9
          ? [`rotate=${fmt(plainPxToPt === null ? rotationDeg : -rotationDeg)}`]
          : []),
      ].join(", "),
      textMode: renderMode === "tex" ? "math" : "raw",
      useGlow: (options.labelGlow ?? true) && Boolean(label.style.labelGlow),
      ...(plainPxToPt === null
        ? {}
        : {
            plainGlow: {
              widthPt: 3.5 * plainPxToPt * trueGlobalScale * labelHaloScale,
              color: options.labelHaloColor ? rgbColorExpr(options.labelHaloColor) : undefined,
            },
          }),
    });
  }

  for (const node of scene.richTextNodes ?? []) {
    if (!node.visible) continue;
    const text = buildRichTextNodeText(node.document);
    const plainPxToPt = resolvedPlainCanvasPxToTikzPt(options);
    const reconstructiblePxToPt = resolvedReconstructibleCanvasStylePxToTikzPt(options);
    const canvasStylePxToPt = plainPxToPt ?? reconstructiblePxToPt;
    const fontPt =
      canvasStylePxToPt === null
        ? Math.max(1, Math.min(72, node.style.textSize + 0.19))
        : Math.max(
            0.5,
            Math.max(8, node.style.textSize) *
              TEXT_LABEL_CANVAS_SIZE_SCALE *
              canvasStylePxToPt
          );
    const baselinePt = Math.max(fontPt + 1, fontPt * 1.2);
    const rotationDeg =
      typeof node.style.rotationDeg === "number" && Number.isFinite(node.style.rotationDeg)
        ? node.style.rotationDeg
        : 0;
    drawLabelsLayer.push({
      kind: "LabelAt",
      x: node.positionWorld.x,
      y: node.positionWorld.y,
      text,
      options: [
        "anchor=north west",
        `align=${node.style.textAlign}`,
        `text=${rgbColorExpr(node.style.textColor)}`,
        `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(baselinePt)}pt}\\selectfont`,
        ...(Math.abs(rotationDeg) > 1e-9
          ? [`rotate=${fmt(plainPxToPt === null ? rotationDeg : -rotationDeg)}`]
          : []),
      ].join(", "),
      textMode: "raw",
      useGlow: (options.labelGlow ?? true) && Boolean(node.style.labelGlow),
      ...(plainPxToPt === null
        ? {}
        : {
            plainGlow: {
              widthPt: 3.5 * plainPxToPt * trueGlobalScale * labelHaloScale,
              color: options.labelHaloColor ? rgbColorExpr(options.labelHaloColor) : undefined,
            },
          }),
    });
  }

  labels.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of labels) {
    drawLabelsLayer.push({
      kind: "LabelPoint",
      name: item.name,
      text: item.text,
      options: item.options,
      renderAsNode: item.renderAsNode,
      useGlow: item.useGlow,
    });
  }
  objectLabels.sort((a, b) => {
    const typeOrder = (type: "segment" | "line" | "circle" | "ellipse" | "polygon") =>
      type === "segment" ? 0 : type === "line" ? 1 : type === "circle" ? 2 : type === "ellipse" ? 3 : 4;
    const byType = typeOrder(a.type) - typeOrder(b.type);
    if (byType !== 0) return byType;
    return a.id.localeCompare(b.id);
  });
  for (const item of objectLabels) {
    const plainPxToPt = resolvedPlainCanvasPxToTikzPt(options);
    const reconstructiblePxToPt = resolvedReconstructibleCanvasStylePxToTikzPt(options);
    const canvasStylePxToPt = plainPxToPt ?? reconstructiblePxToPt;
    const fontOptions =
      canvasStylePxToPt === null
        ? []
        : [
            `font=\\fontsize{${fmt(16 * 0.95 * canvasStylePxToPt)}pt}{${fmt(
              19.2 * 0.95 * canvasStylePxToPt
            )}pt}\\selectfont`,
          ];
    drawLabelsLayer.push({
      kind: "LabelAt",
      x: item.x,
      y: item.y,
      text: item.text,
      options: [
        plainPxToPt === null ? "anchor=center" : "anchor=north west",
        ...(plainPxToPt === null ? [] : ["inner sep=0pt"]),
        `text=${rgbColorExpr(item.color)}`,
        ...fontOptions,
      ].join(", "),
      useGlow: item.useGlow,
      ...(plainPxToPt === null
        ? {}
        : {
            plainGlow: {
              widthPt: 3.5 * plainPxToPt * trueGlobalScale * labelHaloScale,
              color: options.labelHaloColor ? rgbColorExpr(options.labelHaloColor) : undefined,
            },
          }),
    });
  }

  const drawObjectsLayer = [...getGeometryLayerOrder(scene)]
    .reverse()
    .flatMap((ref) => geometryBundles.get(geometryLayerKey(ref)) ?? []);

  if (freeItems.length > 0) {
    freeItems.sort((a, b) => a.name.localeCompare(b.name));
    defs.push({ kind: "DefPoints", items: freeItems });
  }

  return [
    ...defs,
    ...constructions,
    ...drawObjectsLayer,
    ...drawPointsLayer,
    ...drawLabelsLayer,
  ];
}

type ParsedTikzOptionPart = {
  key: string | null;
  value: string;
  raw: string;
};

function splitTopLevelCommaParts(input: string): string[] {
  const out: string[] = [];
  let token = "";
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "{") brace += 1;
    else if (ch === "}") brace = Math.max(0, brace - 1);
    else if (ch === "[") bracket += 1;
    else if (ch === "]") bracket = Math.max(0, bracket - 1);
    else if (ch === "(") paren += 1;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    if (ch === "," && brace === 0 && bracket === 0 && paren === 0) {
      out.push(token);
      token = "";
      continue;
    }
    token += ch;
  }
  out.push(token);
  return out;
}

function findTopLevelEquals(input: string): number {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "{") brace += 1;
    else if (ch === "}") brace = Math.max(0, brace - 1);
    else if (ch === "[") bracket += 1;
    else if (ch === "]") bracket = Math.max(0, bracket - 1);
    else if (ch === "(") paren += 1;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    if (ch === "=" && brace === 0 && bracket === 0 && paren === 0) return i;
  }
  return -1;
}

function parseTikzOptionList(style: string): ParsedTikzOptionPart[] | null {
  const tokens = splitTopLevelCommaParts(style);
  const parts: ParsedTikzOptionPart[] = [];
  for (const tokenRaw of tokens) {
    const raw = tokenRaw.trim();
    if (!raw) return null;
    const eq = findTopLevelEquals(raw);
    if (eq < 0) {
      parts.push({ key: null, value: raw, raw });
      continue;
    }
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (!key || !value) return null;
    parts.push({ key, value, raw });
  }
  return parts;
}

function buildGroupedMarkAngleTex(
  run: Array<Extract<TikzCommand, { kind: "MarkAngle" }>>
): string | null {
  if (run.length < 2) return null;
  const first = run[0];
  const firstStyle = typeof first.style === "string" ? first.style : "";
  if (!firstStyle) return null;
  const parsedStyles = run.map((cmd) => {
    if (cmd.a !== first.a || cmd.b !== first.b || cmd.c !== first.c) return null;
    if (typeof cmd.style !== "string" || !cmd.style.trim()) return null;
    return parseTikzOptionList(cmd.style);
  });
  if (parsedStyles.some((p) => !p)) return null;
  const base = parsedStyles[0] as ParsedTikzOptionPart[];
  for (let i = 1; i < parsedStyles.length; i += 1) {
    const parts = parsedStyles[i] as ParsedTikzOptionPart[];
    if (parts.length !== base.length) return null;
    for (let j = 0; j < base.length; j += 1) {
      if ((parts[j].key ?? null) !== (base[j].key ?? null)) return null;
    }
  }

  const varyingIndices: number[] = [];
  for (let j = 0; j < base.length; j += 1) {
    const firstVal = base[j].value;
    let differs = false;
    for (let i = 1; i < parsedStyles.length; i += 1) {
      const parts = parsedStyles[i] as ParsedTikzOptionPart[];
      if (parts[j].value !== firstVal) {
        differs = true;
        break;
      }
    }
    if (differs) varyingIndices.push(j);
  }
  if (varyingIndices.length === 0) return null;

  // Keep foreach payload simple and robust for current exporter-generated angle styles.
  for (const parts of parsedStyles as ParsedTikzOptionPart[][]) {
    for (const idx of varyingIndices) {
      const value = parts[idx].value;
      if (/[{},/]/.test(value)) return null;
    }
  }

  // Do not parameterize individual keys (e.g. `arc=\gdAngArc`) because tkz-euclide
  // compares some option values via `\ifx` internally (`arc=l/ll/lll`), and macro
  // indirection can change behavior. Also avoid passing a braced option-list macro
  // into `[...]`, because pgfkeys can treat it as one unknown key. Instead iterate
  // complete commands as foreach items.
  const cmdItems = run
    .map((cmd) => `{\\tkzMarkAngle[${String(cmd.style).trim()}](${cmd.a},${cmd.b},${cmd.c})}`)
    .join(",");
  return `\\foreach \\gdAngCmd in {${cmdItems}}{\\gdAngCmd}`;
}

export function renderTikz(
  cmds: TikzCommand[],
  options: Pick<TikzExportOptions, "emitTkzSetup" | "drawLayerBackend" | "preferDvipsNames"> & { groupMarkAngles?: boolean } = {}
): string {
  const setupUnits = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupUnits" }> => c.kind === "SetupUnits");
  const setupLabelScale = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupLabelScale" }> => c.kind === "SetupLabelScale");
  const setupViewport = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupViewport" }> => c.kind === "SetupViewport");
  const setupLine = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupLine" }> => c.kind === "SetupLine");
  const clipRect = cmds.find((c): c is Extract<TikzCommand, { kind: "ClipRect" }> => c.kind === "ClipRect");
  const clipPolygon = cmds.find((c): c is Extract<TikzCommand, { kind: "ClipPolygon" }> => c.kind === "ClipPolygon");
  const pointsDefs = cmds.filter((c): c is Extract<TikzCommand, { kind: "DefPoints" }> => c.kind === "DefPoints");
  const pointDefs = cmds.filter((c): c is Extract<TikzCommand, { kind: "DefPoint" }> => c.kind === "DefPoint");
  const constructions = cmds.filter(
    (c) =>
      c.kind !== "DefPoints" &&
      c.kind !== "SetupUnits" &&
      c.kind !== "SetupLabelScale" &&
      c.kind !== "SetupViewport" &&
      c.kind !== "SetupLine" &&
      c.kind !== "ClipRect" &&
      c.kind !== "ClipPolygon" &&
      c.kind !== "DrawSegment" &&
      c.kind !== "MarkSegment" &&
      c.kind !== "DrawRaw" &&
      c.kind !== "DrawLine" &&
      c.kind !== "DrawCircle" &&
      c.kind !== "FillCircle" &&
      c.kind !== "DrawSector" &&
      c.kind !== "FillSector" &&
      c.kind !== "FillCircleRadius" &&
      c.kind !== "FillAngle" &&
      c.kind !== "MarkAngle" &&
      c.kind !== "MarkRightAngle" &&
      c.kind !== "LabelAngle" &&
      c.kind !== "DrawPoints" &&
      c.kind !== "LabelPoints" &&
      c.kind !== "LabelPoint" &&
      c.kind !== "LabelAt"
  );
  const drawObjects = cmds.filter(
    (c) =>
      c.kind === "DrawSegment" ||
      c.kind === "MarkSegment" ||
      c.kind === "DrawRaw" ||
      c.kind === "DrawLine" ||
      c.kind === "DrawCircle" ||
      c.kind === "FillCircle" ||
      c.kind === "DrawSector" ||
      c.kind === "FillSector" ||
      c.kind === "DrawCircleRadius" ||
      c.kind === "FillCircleRadius" ||
      c.kind === "FillAngle" ||
      c.kind === "MarkAngle" ||
      c.kind === "MarkRightAngle"
  );
  const drawAngleLabels = cmds.filter((c): c is Extract<TikzCommand, { kind: "LabelAngle" }> => c.kind === "LabelAngle");
  const drawPoints = cmds.filter((c) => c.kind === "DrawPoints");
  const drawLabels = cmds.filter((c) => c.kind === "LabelPoints" || c.kind === "LabelPoint" || c.kind === "LabelAt");
  const drawPointLabels = drawLabels.filter((c) => c.kind === "LabelPoints" || c.kind === "LabelPoint");
  const drawOtherLabels = drawLabels.filter((c) => c.kind === "LabelAt");
  const precomputedSegmentMarkStyleNames = drawObjects.flatMap((command) => {
    if (command.kind !== "DrawRaw") return [];
    return [...command.tex.matchAll(/\\path\[(gdMark[A-Za-z]+)=/gu)].map((match) => match[1]);
  });
  const emitTkzSetup = options.emitTkzSetup ?? true;
  const groupMarkAngles = options.groupMarkAngles ?? false;
  const drawLayerBackend = options.drawLayerBackend ?? "tkz";
  const usesLabelGlowMacro =
    drawLayerBackend === "plain"
      ? drawLabels.some(
          (c) =>
            (c.kind === "LabelPoint" || c.kind === "LabelAt") &&
            Boolean(c.useGlow)
        )
      : drawLabels.some(
          (c) =>
            (c.kind === "LabelPoint" || c.kind === "LabelAt") &&
            Boolean(c.useGlow)
        ) || drawAngleLabels.some((c) => Boolean(c.useGlow));

  const out: string[] = [];
  const pushSectionHeader = (title: string) => {
    if (out.length > 0 && out[out.length - 1] !== "") out.push("");
    out.push(title);
    out.push("");
  };
  const scale = setupUnits?.scale ?? 1;
  const trueGlobalScale = setupUnits?.trueGlobalScale ?? 1;
  const labelHaloScale = setupUnits?.labelHaloScale ?? 1;
  const capabilities: TikzRendererCapabilities = {
    fmt,
    fmtGeometry,
    escapeTikzText,
    buildGroupedMarkAngleTex,
    assertTkzMacro,
    assertPerpendicularMacro,
    assertParallelMacro,
    assertAngleBisectorMacro,
    assertAngleFixedMacro,
    assertCircleFixedMacro,
    assertAngleMacro,
  };
  const renderCtx = createTikzRendererContext(out, pushSectionHeader, {
    scale,
    trueGlobalScale,
    labelHaloScale,
    usesLabelGlowMacro,
    emitTkzSetup,
    labelScale: setupLabelScale?.scale ?? null,
    groupMarkAngles,
    drawLayerBackend,
  }, capabilities);

  appendRenderedSetupAndPoints({
    ctx: renderCtx,
    precomputedSegmentMarkStyleNames,
    setupViewport,
    setupLine,
    clipRect,
    clipPolygon,
    pointStyles: extractPointStyles(cmds),
    pointsDefs,
    pointDefs,
  });

  appendRenderedConstructions(renderCtx, constructions);

  appendRenderedDrawLayers({
    ctx: renderCtx,
    drawObjects,
    drawPoints,
    drawPointLabels,
    drawAngleLabels,
    drawOtherLabels,
  });

  out.push("\\end{tikzpicture}");
  const withHoistedDefinitions = hoistGeneratedDefinitions(out);
  const withNamedColors = hoistNamedColors(
    withHoistedDefinitions,
    renderCtx.options.drawLayerBackend !== "plain",
    options.preferDvipsNames === true
  );
  const withOptionalLibraries = injectOptionalTikzLibraries(
    withNamedColors,
    renderCtx.options.drawLayerBackend === "plain"
  );
  return withOptionalLibraries.join("\n");
}

export function exportTikz(scene: SceneModel): string {
  const normalizedScene = normalizeSceneIntegrity(scene);
  // Scene can be updated frequently; reset per-scene memoized lookups before each export.
  pointByIdCache.delete(normalizedScene);
  pointWorldCache.delete(normalizedScene);
  const tex = renderTikz(buildTikzIR(normalizedScene));
  assertNoUnknownTkzMacro(tex);
  assertNoUnknownTkzMacro(tex);
  return tex;
}

export function exportTikzEfficient(scene: SceneModel): string {
  const normalizedScene = normalizeSceneIntegrity(scene);
  pointByIdCache.delete(normalizedScene);
  pointWorldCache.delete(normalizedScene);
  const standard = renderTikz(buildTikzIR(normalizedScene), { groupMarkAngles: true });
  assertNoUnknownTkzMacro(standard);
  return makeEfficientTikz(standard);
}

export function exportTikzEfficientWithOptions(scene: SceneModel, options: TikzExportOptions): string {
  return withTikzNumberPrecision(options.roundNumbersToTwoDecimals === true, () => {
    const normalizedScene = normalizeSceneIntegrity(scene);
    pointByIdCache.delete(normalizedScene);
    pointWorldCache.delete(normalizedScene);
    const standard = renderTikz(buildTikzIR(normalizedScene, options), {
      emitTkzSetup: options.emitTkzSetup,
      drawLayerBackend: options.drawLayerBackend,
      preferDvipsNames: options.preferDvipsNames,
      groupMarkAngles: true,
    });
    assertNoUnknownTkzMacro(standard);
    return makeEfficientTikz(
      standard,
      options.drawLayerBackend === "plain" && options.bakePointCoordinates
        ? { preserveGeometry: true }
        : undefined
    );
  });
}

export function exportTikzWithOptions(scene: SceneModel, options: TikzExportOptions): string {
  return withTikzNumberPrecision(options.roundNumbersToTwoDecimals === true, () => {
    const normalizedScene = normalizeSceneIntegrity(scene);
    // Scene can be updated frequently; reset per-scene memoized lookups before each export.
    pointByIdCache.delete(normalizedScene);
    pointWorldCache.delete(normalizedScene);
    const tex = renderTikz(buildTikzIR(normalizedScene, options), {
      emitTkzSetup: options.emitTkzSetup,
      drawLayerBackend: options.drawLayerBackend,
      preferDvipsNames: options.preferDvipsNames,
    });
    assertNoUnknownTkzMacro(tex);
    return tex;
  });
}

export const exportTikZ = (scene: unknown): string => exportTikz(scene as SceneModel);

function buildPointNameMap(points: ScenePoint[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const p of points) {
    // Point names are already validated in-app; keep them verbatim for identity fidelity.
    names.set(p.id, p.name);
  }
  return names;
}

function mustName(names: Map<string, string>, pointId: string): string {
  const v = names.get(pointId);
  if (!v) throw new Error(`Missing point name for ${pointId}`);
  return v;
}

let activeTikzDecimalPlaces: number | null = null;

function withTikzNumberPrecision<T>(roundToTwoDecimals: boolean, build: () => T): T {
  const previous = activeTikzDecimalPlaces;
  activeTikzDecimalPlaces = roundToTwoDecimals ? 2 : null;
  try {
    return build();
  } finally {
    activeTikzDecimalPlaces = previous;
  }
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "0";
  if (activeTikzDecimalPlaces !== null) {
    const rounded = Number(v.toFixed(activeTikzDecimalPlaces));
    return Object.is(rounded, -0) ? "0" : rounded.toString();
  }
  return fmtGeometry(v);
}

function fmtGeometry(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return Number(v.toPrecision(15)).toString();
}

function pgfSafeRadiusExpression(exprRaw: string | undefined): string | null {
  const expr = (exprRaw ?? "").trim();
  if (!expr) return null;
  if (Number.isFinite(Number(expr))) return null;
  if (!/^[0-9A-Za-z_+\-*/^().,\s]+$/.test(expr)) return null;
  const identifiers = expr.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  const allowed = new Set(["sqrt", "pow", "abs", "min", "max", "pi", "Pi", "PI", "e", "tau", "Tau", "TAU"]);
  if (identifiers.some((id) => !allowed.has(id))) return null;
  return expr
    .replace(/\s+/g, "")
    .replace(/\b(?:Pi|PI|pi)\b/g, "pi")
    .replace(/\b(?:Tau|TAU|tau)\b/g, "(2*pi)");
}

function roundDecimal(v: number, decimals: number): number {
  if (!Number.isFinite(v)) return 0;
  const factor = 10 ** decimals;
  return Math.round(v * factor) / factor;
}

function resolveCircleSimilitudeCenter(
  centerA: { x: number; y: number },
  radiusA: number,
  centerB: { x: number; y: number },
  radiusB: number,
  mode: "outer" | "inner"
): { x: number; y: number } | null {
  const eps = 1e-12;
  if (!(radiusA > eps) || !(radiusB > eps)) return null;
  if (mode === "outer") {
    const denom = radiusA - radiusB;
    if (Math.abs(denom) <= eps) return null;
    return {
      x: (-radiusB * centerA.x + radiusA * centerB.x) / denom,
      y: (-radiusB * centerA.y + radiusA * centerB.y) / denom,
    };
  }
  const denom = radiusA + radiusB;
  if (Math.abs(denom) <= eps) return null;
  return {
    x: (radiusB * centerA.x + radiusA * centerB.x) / denom,
    y: (radiusB * centerA.y + radiusA * centerB.y) / denom,
  };
}

function tangentPointsFromPointToCircle(
  through: { x: number; y: number },
  center: { x: number; y: number },
  radius: number
): Array<{ x: number; y: number }> {
  const eps = 1e-10;
  const vx = through.x - center.x;
  const vy = through.y - center.y;
  const d2 = vx * vx + vy * vy;
  const r2 = radius * radius;
  if (!(radius > 1e-12) || d2 <= 1e-12 || d2 < r2 - eps) return [];
  const k = r2 / d2;
  const perp = { x: -vy, y: vx };
  if (Math.abs(d2 - r2) <= eps) {
    return [
      {
        x: center.x + k * vx,
        y: center.y + k * vy,
      },
    ];
  }
  const h = (radius * Math.sqrt(Math.max(0, d2 - r2))) / d2;
  return [
    {
      x: center.x + k * vx + h * perp.x,
      y: center.y + k * vy + h * perp.y,
    },
    {
      x: center.x + k * vx - h * perp.x,
      y: center.y + k * vy - h * perp.y,
    },
  ];
}

type CircleCircleTangentTopology =
  | { kind: "disjoint" }
  | { kind: "intersecting" }
  | { kind: "contained" }
  | { kind: "concentricUnequal" }
  | { kind: "coincident" }
  | { kind: "degenerateTangency"; mode: "external" | "internal"; near: boolean };

function circleCircleTangentMetrics(
  a: { center: { x: number; y: number }; radius: number },
  b: { center: { x: number; y: number }; radius: number }
): {
  d: number;
  r1: number;
  r2: number;
  sum: number;
  diff: number;
  extGap: number;
  intGap: number;
  exactTol: number;
  nearTol: number;
} {
  const d = distance(a.center, b.center);
  const r1 = a.radius;
  const r2 = b.radius;
  const maxScale = Math.max(1, d, r1, r2);
  const exactTol = 1e-9 * maxScale;
  const nearTol = 1e-6 * maxScale;
  const sum = r1 + r2;
  const diff = Math.abs(r1 - r2);
  const extGap = d - sum;
  const intGap = d - diff;
  return { d, r1, r2, sum, diff, extGap, intGap, exactTol, nearTol };
}

function classifyCircleCircleTangentTopology(
  a: { center: { x: number; y: number }; radius: number },
  b: { center: { x: number; y: number }; radius: number }
): CircleCircleTangentTopology {
  const { d, r1, r2, sum, diff, extGap, intGap, exactTol, nearTol } = circleCircleTangentMetrics(a, b);

  if (d <= exactTol) {
    if (Math.abs(r1 - r2) <= exactTol) return { kind: "coincident" };
    return { kind: "concentricUnequal" };
  }

  if (Math.abs(extGap) <= nearTol) {
    return { kind: "degenerateTangency", mode: "external", near: Math.abs(extGap) > exactTol };
  }
  if (Math.abs(intGap) <= nearTol) {
    return { kind: "degenerateTangency", mode: "internal", near: Math.abs(intGap) > exactTol };
  }

  if (d > sum + nearTol) return { kind: "disjoint" };
  if (d < diff - nearTol) return { kind: "contained" };
  return { kind: "intersecting" };
}

function isTkzUnsafePoint(p: { x: number; y: number }): boolean {
  // TeX dimensions overflow around 16384pt (~576cm). Keep a conservative margin.
  const safeAbsCm = 400;
  return Math.abs(p.x) > safeAbsCm || Math.abs(p.y) > safeAbsCm;
}

function assertCircleCircleTangentExportable(
  line: Extract<SceneModel["lines"][number], { kind: "circleCircleTangent" }>,
  a: { center: { x: number; y: number }; radius: number },
  b: { center: { x: number; y: number }; radius: number }
): void {
  const topology = classifyCircleCircleTangentTopology(a, b);
  const diag = circleCircleTangentDiagnosticsSuffix(a, b);
  switch (topology.kind) {
    case "disjoint":
      return;
    case "intersecting":
      if (line.family === "outer") return;
      throw new Error(
        `Cannot export circle-circle tangent ${line.id}: inner tangents are undefined for intersecting circles${diag}`
      );
    case "degenerateTangency":
      if (topology.mode === "external" && line.family === "outer") return;
      if (!topology.near) {
        if (isExactDegenerateCircleCircleTangentFamily(line, topology)) return;
        if (topology.mode === "internal" && line.family === "inner") {
          throw new Error(
            `Cannot export circle-circle tangent ${line.id}: inner tangents are undefined for internally tangent circles${diag}`
          );
        }
      }
      throw new Error(
        `Cannot export circle-circle tangent ${line.id}: ${
          topology.near ? "near-degenerate" : "degenerate"
        } ${topology.mode} tangency is unsupported in tkz export${diag}`
      );
    case "contained":
      throw new Error(`Cannot export circle-circle tangent ${line.id}: one circle contains the other (no common tangents)${diag}`);
    case "concentricUnequal":
      throw new Error(`Cannot export circle-circle tangent ${line.id}: concentric unequal circles have no common tangents${diag}`);
    case "coincident":
      throw new Error(`Cannot export circle-circle tangent ${line.id}: coincident circles have infinitely many common tangents${diag}`);
  }
}

function circleCircleTangentDiagnosticsSuffix(
  a: { center: { x: number; y: number }; radius: number },
  b: { center: { x: number; y: number }; radius: number }
): string {
  const { d, r1, r2, extGap, intGap } = circleCircleTangentMetrics(a, b);
  return ` (d=${fmt(d)}, r1=${fmt(r1)}, r2=${fmt(r2)}, extGap=${fmt(extGap)}, intGap=${fmt(intGap)})`;
}

function circleCircleTangentHasNoCurrentAnchors(
  line: Extract<SceneModel["lines"][number], { kind: "circleCircleTangent" }>,
  a: { center: { x: number; y: number }; radius: number },
  b: { center: { x: number; y: number }; radius: number }
): boolean {
  const { d, r1, r2, sum, diff, exactTol } = circleCircleTangentMetrics(a, b);
  if (!(r1 > 1e-12) || !(r2 > 1e-12)) return true;
  if (d <= exactTol) return true;
  if (line.family === "inner") return d < sum - exactTol;
  return d < diff - exactTol;
}

function isExactDegenerateCircleCircleTangentFamily(
  line: Extract<SceneModel["lines"][number], { kind: "circleCircleTangent" }>,
  topology: CircleCircleTangentTopology
): boolean {
  if (topology.kind !== "degenerateTangency" || topology.near) return false;
  const collapsedFamily = topology.mode === "external" ? "inner" : "outer";
  return line.family === collapsedFamily;
}

type NamedTangencyPoint = {
  name: string;
  point: { x: number; y: number };
};

function orderTangencyCandidatesLikeTkz(
  through: { x: number; y: number },
  center: { x: number; y: number },
  candidates: Array<{ x: number; y: number }>,
  firstName: string,
  secondName: string
): NamedTangencyPoint[] {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    return [{ name: firstName, point: candidates[0] }];
  }

  const [c0, c1] = candidates;
  const s0 = tangentChoiceOrientationSign(through, c0, center);
  const s1 = tangentChoiceOrientationSign(through, c1, center);
  const eps = 1e-12;

  // tkz-euclide manual: tkzFirstPointResult is the contact point for which
  // angle (through, contact, center) is counterclockwise.
  if (s0 > eps && s1 <= eps) {
    return [
      { name: firstName, point: c0 },
      { name: secondName, point: c1 },
    ];
  }
  if (s1 > eps && s0 <= eps) {
    return [
      { name: firstName, point: c1 },
      { name: secondName, point: c0 },
    ];
  }

  // Numerical fallback near degeneracy: preserve deterministic helper order.
  return [
    { name: firstName, point: c0 },
    { name: secondName, point: c1 },
  ];
}

function tangentChoiceOrientationSign(
  through: { x: number; y: number },
  contact: { x: number; y: number },
  center: { x: number; y: number }
): number {
  const ux = through.x - contact.x;
  const uy = through.y - contact.y;
  const vx = center.x - contact.x;
  const vy = center.y - contact.y;
  return ux * vy - uy * vx;
}

function nearestNamedTangencyPoint(
  candidates: NamedTangencyPoint[],
  target: { x: number; y: number }
): NamedTangencyPoint {
  let best = candidates[0];
  let bestDist = distance(best.point, target);
  for (let i = 1; i < candidates.length; i += 1) {
    const d = distance(candidates[i].point, target);
    if (d < bestDist) {
      best = candidates[i];
      bestDist = d;
    }
  }
  return best;
}

function lineLikeNamesFromRef(
  ref: GeometryObjectRef,
  resolveLineAnchorsById: (lineId: string) => { a: string; b: string },
  scene: SceneModel,
  lineById: Map<string, SceneModel["lines"][number]>,
  segById: Map<string, SceneModel["segments"][number]>,
  pointName: Map<string, string>,
  resolvePoint: (pointId: string) => void
): {
  a: string;
  b: string;
  worldA: { x: number; y: number };
  worldB: { x: number; y: number };
  endpointAId?: string;
  endpointBId?: string;
  finite: boolean;
  ray: boolean;
} | null {
  if (ref.type === "line") {
    const line = lineById.get(ref.id);
    if (!line) return null;
    const names = resolveLineAnchorsById(ref.id);
    const anchors = getLineWorldAnchors(line, scene);
    if (!anchors) return null;
    if (line.kind === "perpendicular" || line.kind === "parallel") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.throughId, finite: false, ray: false };
    }
    if (line.kind === "tangent") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.throughId, finite: false, ray: false };
    }
    if (line.kind === "circleCircleTangent") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, finite: false, ray: false };
    }
    if (line.kind === "angleBisector") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.bId, finite: false, ray: false };
    }
    return {
      a: names.a,
      b: names.b,
      worldA: anchors.a,
      worldB: anchors.b,
      endpointAId: line.aId,
      endpointBId: line.bId,
      finite: false,
      ray: line.kind === "ray",
    };
  }
  if (ref.type === "segment") {
    const seg = segById.get(ref.id);
    if (!seg) return null;
    resolvePoint(seg.aId);
    resolvePoint(seg.bId);
    const wa = getPointWorldPosCached(scene, seg.aId);
    const wb = getPointWorldPosCached(scene, seg.bId);
    if (!wa || !wb) return null;
    return {
      a: mustName(pointName, seg.aId),
      b: mustName(pointName, seg.bId),
      worldA: wa,
      worldB: wb,
      endpointAId: seg.aId,
      endpointBId: seg.bId,
      finite: true,
      ray: false,
    };
  }
  return null;
}

function circleFromRef(
  ref: GeometryObjectRef,
  circleById: Map<string, SceneModel["circles"][number]>
): SceneModel["circles"][number] | null {
  if (ref.type !== "circle") return null;
  return circleById.get(ref.id) ?? null;
}

function inferLineCircleBranchFromWorld(
  point: Extract<ScenePoint, { kind: "intersectionPoint" }>,
  _a: { x: number; y: number },
  _b: { x: number; y: number },
  _center: { x: number; y: number },
  _through: { x: number; y: number }
): 0 | 1 {
  if (Number.isInteger(point.branchIndex) && (point.branchIndex as number) >= 0) {
    return (point.branchIndex as number) === 1 ? 1 : 0;
  }
  return 0;
}

function inferCircleCircleBranch(
  point: Extract<ScenePoint, { kind: "intersectionPoint" }>,
  _aCenter: { x: number; y: number },
  _aThrough: { x: number; y: number },
  _bCenter: { x: number; y: number },
  _bThrough: { x: number; y: number }
): 0 | 1 {
  if (Number.isInteger(point.branchIndex) && (point.branchIndex as number) >= 0) {
    return (point.branchIndex as number) === 1 ? 1 : 0;
  }
  return 0;
}

function inferCircleCircleBranchFromExcludedRoots(
  roots: Array<{ x: number; y: number }>,
  excluded: { x: number; y: number },
  fallback: 0 | 1
): 0 | 1 {
  if (roots.length < 2) return 0;
  const ROOT_EPS = 1e-6;
  const d0 = distance(roots[0], excluded);
  const d1 = distance(roots[1], excluded);
  if (d0 <= ROOT_EPS && d1 > ROOT_EPS) return 1;
  if (d1 <= ROOT_EPS && d0 > ROOT_EPS) return 0;
  return fallback;
}

function circleCircleRootMatchIndex(
  roots: Array<{ x: number; y: number }>,
  pointWorld: { x: number; y: number } | null
): 0 | 1 | null {
  if (!pointWorld || roots.length < 2) return null;
  const ROOT_EPS = 1e-6;
  const d0 = distance(roots[0], pointWorld);
  const d1 = distance(roots[1], pointWorld);
  const m0 = d0 <= ROOT_EPS;
  const m1 = d1 <= ROOT_EPS;
  if (m0 && !m1) return 0;
  if (m1 && !m0) return 1;
  return null;
}

function isCircleRef(ref: GeometryObjectRef): boolean {
  return ref.type === "circle";
}

function sameObjectPair(a1: GeometryObjectRef, b1: GeometryObjectRef, a2: GeometryObjectRef, b2: GeometryObjectRef): boolean {
  return (sameObjectRef(a1, a2) && sameObjectRef(b1, b2)) || (sameObjectRef(a1, b2) && sameObjectRef(b1, a2));
}

function sameObjectRef(a: GeometryObjectRef, b: GeometryObjectRef): boolean {
  return a.type === b.type && a.id === b.id;
}

function filterLineCircleBranchesToDomain(
  branches: Array<{ point: { x: number; y: number }; t: number }>,
  finite: boolean,
  ray = false
): Array<{ point: { x: number; y: number }; t: number }> {
  if (ray) return branches.filter((branch) => branch.t >= -FINITE_DOMAIN_EPS);
  if (!finite) return branches;
  return branches.filter((branch) => branch.t >= -FINITE_DOMAIN_EPS && branch.t <= 1 + FINITE_DOMAIN_EPS);
}

const FINITE_DOMAIN_EPS = 1e-6;

function finiteSingleLineCircleRootFactor(
  roots: Array<{ point: { x: number; y: number }; t: number }>,
  supportRoots: Array<{ point: { x: number; y: number }; t: number }>
): number | null {
  if (roots.length !== 1 || supportRoots.length <= roots.length) return null;
  const t = roots[0].t;
  if (t < 0 && t >= -FINITE_DOMAIN_EPS) return 0;
  if (t > 1 && t <= 1 + FINITE_DOMAIN_EPS) return 1;
  return t;
}

function inferLineCircleBranchFromExcludedRoots(
  roots: Array<{ point: { x: number; y: number }; t: number }>,
  excluded: { x: number; y: number },
  fallback: 0 | 1
): 0 | 1 {
  if (roots.length < 2) return 0;
  const ROOT_EPS = 1e-6;
  const d0 = distance(roots[0].point, excluded);
  const d1 = distance(roots[1].point, excluded);
  if (d0 <= ROOT_EPS && d1 > ROOT_EPS) return 1;
  if (d1 <= ROOT_EPS && d0 > ROOT_EPS) return 0;
  return fallback;
}

function lineCircleRootMatchIndex(
  roots: Array<{ point: { x: number; y: number }; t: number }>,
  pointWorld: { x: number; y: number } | null
): 0 | 1 | null {
  if (!pointWorld || roots.length < 2) return null;
  const ROOT_EPS = 1e-6;
  const d0 = distance(roots[0].point, pointWorld);
  const d1 = distance(roots[1].point, pointWorld);
  const m0 = d0 <= ROOT_EPS;
  const m1 = d1 <= ROOT_EPS;
  if (m0 && !m1) return 0;
  if (m1 && !m0) return 1;
  return null;
}

// Whether a point lies on `circle` by construction (not merely by numeric
// coincidence). Such a point can be used as a known-root anchor. For line-circle
// export the renderer deliberately uses `near` from that anchor instead of
// tkz-euclide's `common=`: the latter compares transformed dimensions with an
// absolute tolerance and can swap result slots at a picture-scale threshold.
// Coincidental/theorem-only points are not safe anchors because the independently
// reconstructed circle need not pass through them exactly.
function isPointConstructedOnCircle(pointId: string, circle: SceneCircle, scene: SceneModel): boolean {
  if (circle.kind === "threePoint") {
    if (pointId === circle.aId || pointId === circle.bId || pointId === circle.cId) return true;
  } else if (circle.kind === "fixedRadius") {
    // Only the center is named; nothing lies on the circle by construction.
  } else if (pointId === circle.throughId) {
    // twoPoint circle: the "through" point is on the circle (the center is not).
    return true;
  }
  const point = scene.points.find((candidate) => candidate.id === pointId);
  if (!point) return false;
  if (point.kind === "pointOnCircle") return point.circleId === circle.id;
  if (point.kind === "circleLineIntersectionPoint") return point.circleId === circle.id;
  if (point.kind === "circleSegmentIntersectionPoint") return point.circleId === circle.id;
  if (point.kind === "circleCircleIntersectionPoint") {
    return point.circleAId === circle.id || point.circleBId === circle.id;
  }
  return false;
}

function validDefinedLineCircleCommonPointName(
  pointId: string | undefined,
  roots: Array<{ point: { x: number; y: number }; t: number }>,
  selectedBranch: 0 | 1,
  scene: SceneModel,
  definedPointIds: Set<string>,
  pointName: Map<string, string>,
  circle?: SceneCircle
): string | undefined {
  if (!pointId || !definedPointIds.has(pointId) || roots.length < 2) return undefined;
  if (circle && !isPointConstructedOnCircle(pointId, circle, scene)) return undefined;
  const pointWorld = getPointWorldPosCached(scene, pointId);
  const match = lineCircleRootMatchIndex(roots, pointWorld);
  if (match === null || match === selectedBranch) return undefined;
  return mustName(pointName, pointId);
}

function validDefinedCircleCircleCommonPointName(
  pointId: string | undefined,
  roots: Array<{ x: number; y: number }>,
  selectedBranch: 0 | 1,
  scene: SceneModel,
  definedPointIds: Set<string>,
  pointName: Map<string, string>
): string | undefined {
  if (!pointId || !definedPointIds.has(pointId) || roots.length < 2) return undefined;
  const pointWorld = getPointWorldPosCached(scene, pointId);
  const match = circleCircleRootMatchIndex(roots, pointWorld);
  if (match === null || match === selectedBranch) return undefined;
  return mustName(pointName, pointId);
}

function singleLineCircleRootIsExcluded(
  roots: Array<{ point: { x: number; y: number }; t: number }>,
  excludePointId: string | undefined,
  scene: SceneModel
): boolean {
  if (!excludePointId || roots.length !== 1) return false;
  const excluded = getPointWorldPosCached(scene, excludePointId);
  if (!excluded) return false;
  return distance(excluded, roots[0].point) <= 1e-6;
}

function inferLineCircleCommonFromEndpointsWorld(
  lineAId: string | undefined,
  lineBId: string | undefined,
  lineAWorld: { x: number; y: number },
  lineBWorld: { x: number; y: number },
  branches: Array<{ point: { x: number; y: number }; t: number }>,
  selectedBranch: 0 | 1,
  pointName: Map<string, string>
): string | undefined {
  if (branches.length < 2) return undefined;

  const ROOT_EPS = 1e-6;
  const aD0 = distance(lineAWorld, branches[0].point);
  const aD1 = distance(lineAWorld, branches[1].point);
  const bD0 = distance(lineBWorld, branches[0].point);
  const bD1 = distance(lineBWorld, branches[1].point);
  const aMatch = aD0 <= ROOT_EPS ? 0 : aD1 <= ROOT_EPS ? 1 : null;
  const bMatch = bD0 <= ROOT_EPS ? 0 : bD1 <= ROOT_EPS ? 1 : null;

  if (lineAId && aMatch !== null && bMatch === null && selectedBranch !== aMatch) return pointName.get(lineAId);
  if (lineBId && bMatch !== null && aMatch === null && selectedBranch !== bMatch) return pointName.get(lineBId);
  return undefined;
}

function computeExportViewport(
  scene: SceneModel,
  pxPerWorld = 80,
  visualTreatmentFactor = 1
): { xmin: number; xmax: number; ymin: number; ymax: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const add = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const addPointById = (pointId: string): void => {
    const point = scene.points.find((candidate) => candidate.id === pointId);
    if (!point) return;
    const world = getPointWorldPos(point, scene);
    if (world) add(world.x, world.y);
  };

  const addObjectLabel = (object: {
    showLabel?: boolean;
    labelPosWorld?: { x: number; y: number };
  }): void => {
    if (!object.showLabel || !object.labelPosWorld) return;
    add(object.labelPosWorld.x, object.labelPosWorld.y);
  };

  for (const point of scene.points) {
    if (!point.visible) continue;
    const world = getPointWorldPos(point, scene);
    if (!world) continue;
    add(world.x, world.y);
  }

  // Hidden construction points must not enlarge a complete-scene export, but
  // hidden endpoints of visible objects still contribute through those
  // objects. This mirrors what is actually drawn rather than what happens to
  // exist in the dependency graph.
  for (const segment of scene.segments) {
    if (!segment.visible) continue;
    addPointById(segment.aId);
    addPointById(segment.bId);
    addObjectLabel(segment);
  }

  for (const line of scene.lines) {
    if (!line.visible) continue;
    const anchors = getLineWorldAnchors(line, scene);
    if (anchors) {
      add(anchors.a.x, anchors.a.y);
      add(anchors.b.x, anchors.b.y);
    }
    addObjectLabel(line);
  }

  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) continue;
    const center = geom.center;
    const r = geom.radius;
    if (!Number.isFinite(r)) continue;
    add(center.x - r, center.y - r);
    add(center.x + r, center.y + r);
    addObjectLabel(circle);
  }

  for (const ellipse of scene.ellipses ?? []) {
    if (!ellipse.visible) continue;
    const geom = getEllipseWorldGeometry(ellipse, scene);
    if (!geom) continue;
    const cos = Math.cos(geom.rotationRad);
    const sin = Math.sin(geom.rotationRad);
    const rx = Math.sqrt(geom.semiMajor * geom.semiMajor * cos * cos + geom.semiMinor * geom.semiMinor * sin * sin);
    const ry = Math.sqrt(geom.semiMajor * geom.semiMajor * sin * sin + geom.semiMinor * geom.semiMinor * cos * cos);
    add(geom.center.x - rx, geom.center.y - ry);
    add(geom.center.x + rx, geom.center.y + ry);
    addObjectLabel(ellipse);
  }

  for (const polygon of scene.polygons) {
    if (!polygon.visible) continue;
    for (const pointId of polygon.pointIds) addPointById(pointId);
    addObjectLabel(polygon);
  }

  for (const angle of scene.angles) {
    if (!angle.visible) continue;
    const vertex = getPointWorldPosCached(scene, angle.bId);
    if (!vertex) continue;
    const aWorld = getPointWorldPosCached(scene, angle.aId);
    add(vertex.x, vertex.y);
    const r =
      angle.kind === "sector" && aWorld
        ? Math.max(0, distance(aWorld, vertex))
        : Math.max(0, angle.style.arcRadius);
    add(vertex.x - r, vertex.y - r);
    add(vertex.x + r, vertex.y + r);
    add(angle.style.labelPosWorld.x, angle.style.labelPosWorld.y);
  }

  for (const node of scene.richTextNodes ?? []) {
    if (!node.visible) continue;
    add(node.positionWorld.x, node.positionWorld.y);
    const widthWorld = Math.max(0.5, (node.boundsPx?.widthPx ?? 320) / pxPerWorld);
    const heightWorld = Math.max(0.3, (node.boundsPx?.heightPx ?? Math.max(18, node.style.textSize * 1.5)) / pxPerWorld);
    add(node.positionWorld.x + widthWorld, node.positionWorld.y - heightWorld);
  }

  for (const label of scene.textLabels ?? []) {
    if (!label.visible) continue;
    add(label.positionWorld.x, label.positionWorld.y);
    const widthWorld = Math.max(
      0.25,
      (label.style.boxWidthPx ?? Math.max(24, label.text.length * label.style.textSize * 0.6)) /
        pxPerWorld
    );
    const heightWorld = Math.max(
      0.2,
      (label.style.boxHeightPx ?? Math.max(16, label.style.textSize * 1.4)) / pxPerWorld
    );
    add(label.positionWorld.x + widthWorld / 2, label.positionWorld.y + heightWorld / 2);
    add(label.positionWorld.x - widthWorld / 2, label.positionWorld.y - heightWorld / 2);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
  }

  let width = maxX - minX;
  let height = maxY - minY;
  if (width < 1e-6) width = 1;
  if (height < 1e-6) height = 1;
  const basePad = Math.max(0.25, 0.1 * Math.max(width, height));
  // Close-up treatments make labels, points, halos, and marks larger relative
  // to geometry. Give the automatic whole-scene box matching breathing room so
  // labels at an extreme point are not shaved by the PDF crop.
  const treatmentPad =
    (28 * Math.max(0, visualTreatmentFactor - 1)) /
    clampPositive(pxPerWorld, 1, 20000);
  const pad = basePad + treatmentPad;

  return {
    xmin: minX - pad,
    xmax: maxX + pad,
    ymin: minY - pad,
    ymax: maxY + pad,
  };
}

const TKZ_DRAW_LINE_SAFE_EXTENDED_LENGTH = 400;

function rawLineDrawClipBoundsForOptions(
  viewport: TikzExportViewport,
  options: TikzExportOptions
): TikzExportViewport {
  if (options.clipRectWorld) return normalizeViewportRect(options.clipRectWorld);
  if (options.clipPolygonWorld && options.clipPolygonWorld.length >= 3) {
    return boundsForPoints(options.clipPolygonWorld);
  }
  return normalizeViewportRect(viewport);
}

function lineDrawClipBoundsForOptions(
  viewport: TikzExportViewport,
  options: TikzExportOptions
): TikzExportViewport {
  const rawBounds = options.clipRectWorld
    ? normalizeViewportRect(options.clipRectWorld)
    : options.clipPolygonWorld && options.clipPolygonWorld.length >= 3
      ? boundsForPoints(options.clipPolygonWorld)
      : normalizeViewportRect(viewport);
  const width = Math.max(1e-9, rawBounds.xmax - rawBounds.xmin);
  const height = Math.max(1e-9, rawBounds.ymax - rawBounds.ymin);
  const pad = Math.max(0.5, Math.abs(options.clipSpace ?? 0), 0.02 * Math.max(width, height));
  return {
    xmin: rawBounds.xmin - pad,
    xmax: rawBounds.xmax + pad,
    ymin: rawBounds.ymin - pad,
    ymax: rawBounds.ymax + pad,
  };
}

function normalizeViewportRect(rect: TikzExportViewport): TikzExportViewport {
  return {
    xmin: Math.min(rect.xmin, rect.xmax),
    xmax: Math.max(rect.xmin, rect.xmax),
    ymin: Math.min(rect.ymin, rect.ymax),
    ymax: Math.max(rect.ymin, rect.ymax),
  };
}

function finiteSegmentIntersectsRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: TikzExportViewport,
  padding = 0
): boolean {
  const pad = Math.max(0, padding);
  const bounds = {
    xmin: rect.xmin - pad,
    xmax: rect.xmax + pad,
    ymin: rect.ymin - pad,
    ymax: rect.ymax + pad,
  };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let tMin = 0;
  let tMax = 1;
  const constraints = [
    { p: -dx, q: a.x - bounds.xmin },
    { p: dx, q: bounds.xmax - a.x },
    { p: -dy, q: a.y - bounds.ymin },
    { p: dy, q: bounds.ymax - a.y },
  ];
  for (const { p, q } of constraints) {
    if (Math.abs(p) <= 1e-12) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) tMin = Math.max(tMin, t);
    else tMax = Math.min(tMax, t);
    if (tMin > tMax) return false;
  }
  return true;
}

function boundsForPoints(points: Array<{ x: number; y: number }>): TikzExportViewport {
  let xmin = Number.POSITIVE_INFINITY;
  let xmax = Number.NEGATIVE_INFINITY;
  let ymin = Number.POSITIVE_INFINITY;
  let ymax = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    xmin = Math.min(xmin, point.x);
    xmax = Math.max(xmax, point.x);
    ymin = Math.min(ymin, point.y);
    ymax = Math.max(ymax, point.y);
  }
  if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || !Number.isFinite(ymin) || !Number.isFinite(ymax)) {
    return { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
  }
  return normalizeViewportRect({ xmin, xmax, ymin, ymax });
}

function shouldUseFiniteLineDrawFallback(drawSpanWorld: number, globalAdd: number): boolean {
  if (!Number.isFinite(drawSpanWorld) || drawSpanWorld <= 1e-9) return true;
  const extensionFactor = 1 + 2 * Math.max(0, globalAdd);
  return drawSpanWorld * extensionFactor > TKZ_DRAW_LINE_SAFE_EXTENDED_LENGTH;
}

function resolveLineDrawReferenceWorld(
  scene: SceneModel,
  line: SceneModel["lines"][number],
  id: string,
  anchors: { a: { x: number; y: number }; b: { x: number; y: number } }
): { x: number; y: number } | null {
  if (id === line.id) return anchors.b;
  if (line.kind === "circleCircleTangent" && id === `${line.id}#a`) return anchors.a;
  return getPointWorldPosCached(scene, id);
}

function lineSegmentThroughRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: TikzExportViewport
): { ax: number; ay: number; bx: number; by: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-12)) return null;

  const candidates: Array<{ x: number; y: number; t: number }> = [];
  const eps = 1e-7;
  const addCandidate = (t: number) => {
    if (!Number.isFinite(t)) return;
    const x = a.x + t * dx;
    const y = a.y + t * dy;
    if (x < rect.xmin - eps || x > rect.xmax + eps || y < rect.ymin - eps || y > rect.ymax + eps) return;
    if (candidates.some((candidate) => Math.hypot(candidate.x - x, candidate.y - y) <= 1e-6)) return;
    candidates.push({ x, y, t });
  };

  if (Math.abs(dx) > 1e-12) {
    addCandidate((rect.xmin - a.x) / dx);
    addCandidate((rect.xmax - a.x) / dx);
  }
  if (Math.abs(dy) > 1e-12) {
    addCandidate((rect.ymin - a.y) / dy);
    addCandidate((rect.ymax - a.y) / dy);
  }

  if (candidates.length >= 2) {
    candidates.sort((p, q) => p.t - q.t);
    const first = candidates[0];
    const last = candidates[candidates.length - 1];
    return { ax: first.x, ay: first.y, bx: last.x, by: last.y };
  }

  const center = {
    x: (rect.xmin + rect.xmax) / 2,
    y: (rect.ymin + rect.ymax) / 2,
  };
  const tCenter = ((center.x - a.x) * dx + (center.y - a.y) * dy) / (len * len);
  const nearest = {
    x: a.x + tCenter * dx,
    y: a.y + tCenter * dy,
  };
  const ux = dx / len;
  const uy = dy / len;
  const halfSpan = Math.hypot(rect.xmax - rect.xmin, rect.ymax - rect.ymin) / 2;
  return {
    ax: nearest.x - ux * halfSpan,
    ay: nearest.y - uy * halfSpan,
    bx: nearest.x + ux * halfSpan,
    by: nearest.y + uy * halfSpan,
  };
}

function hugeCircleVisibleBoundary(
  circle: { center: { x: number; y: number }; radius: number },
  bounds: TikzExportViewport
): { intersects: boolean; containsBounds: boolean } {
  const { center, radius } = circle;
  if (!Number.isFinite(radius) || radius <= 0) return { intersects: false, containsBounds: false };
  const nearestX = Math.max(bounds.xmin, Math.min(bounds.xmax, center.x));
  const nearestY = Math.max(bounds.ymin, Math.min(bounds.ymax, center.y));
  const minDistance = Math.hypot(nearestX - center.x, nearestY - center.y);
  const maxDistance = Math.max(
    Math.hypot(bounds.xmin - center.x, bounds.ymin - center.y),
    Math.hypot(bounds.xmin - center.x, bounds.ymax - center.y),
    Math.hypot(bounds.xmax - center.x, bounds.ymin - center.y),
    Math.hypot(bounds.xmax - center.x, bounds.ymax - center.y)
  );
  const epsilon = Math.max(1e-9, radius * 1e-12);
  return {
    intersects: radius >= minDistance - epsilon && radius <= maxDistance + epsilon,
    containsBounds: radius > maxDistance + epsilon,
  };
}

function hugeCircleTangentSegment(
  circle: { center: { x: number; y: number }; radius: number },
  bounds: TikzExportViewport
): { ax: number; ay: number; bx: number; by: number } | null {
  // Match drawHugeCircleAsClippedLine on the canvas: approximate the visible
  // arc at the radial point facing the viewport center.
  const viewportCenter = {
    x: (bounds.xmin + bounds.xmax) * 0.5,
    y: (bounds.ymin + bounds.ymax) * 0.5,
  };
  const dx = viewportCenter.x - circle.center.x;
  const dy = viewportCenter.y - circle.center.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 1e-12)) return null;
  const point = {
    x: circle.center.x + (dx / length) * circle.radius,
    y: circle.center.y + (dy / length) * circle.radius,
  };
  return lineSegmentThroughRect(point, { x: point.x - dy / length, y: point.y + dx / length }, bounds);
}

function computeLineDrawPlacement(
  scene: SceneModel,
  line: SceneModel["lines"][number]
): { drawAId: string; drawBId: string; addLeft: number; addRight: number } {
  const anchors = getLineWorldAnchors(line, scene);
  if (!anchors) throw new Error(`Cannot export undefined line geometry: ${line.id}`);
  const a = anchors.a;
  const b = anchors.b;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dd = dx * dx + dy * dy;
  const circleCircleAnchorId = line.kind === "circleCircleTangent" ? `${line.id}#a` : null;
  const anchorAId =
    line.kind === "perpendicular" || line.kind === "parallel" || line.kind === "tangent"
      ? line.throughId
      : line.kind === "circleCircleTangent"
        ? (circleCircleAnchorId as string)
        : line.kind === "angleBisector"
          ? line.bId
          : line.aId;
  const anchorBId =
    line.kind === "perpendicular" || line.kind === "parallel" || line.kind === "tangent"
      ? line.id
      : line.kind === "circleCircleTangent"
        ? line.id
        : line.kind === "angleBisector"
          ? line.id
          : line.bId;
  if (dd <= 1e-12) return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 1, addRight: 1 };
  const len = Math.sqrt(dd);

  const distTol = Math.max(1e-6, len * 1e-6);
  const relevantPointIds = collectLineRelevantPointIds(scene, line);
  const candidates: Array<{ id: string; s: number }> = [];

  for (const item of relevantPointIds) {
    const w = item.world;
    if (!w) continue;
    const ux = w.x - a.x;
    const uy = w.y - a.y;
    const s = (ux * dx + uy * dy) / dd;
    const px = a.x + s * dx;
    const py = a.y + s * dy;
    const dist = Math.hypot(w.x - px, w.y - py);
    if (dist > distTol) continue;
    candidates.push({ id: item.id, s });
  }

  if (candidates.length < 2) {
    return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };
  }

  candidates.sort((p1, p2) => p1.s - p2.s);
  const minCand = candidates[0];
  const maxCand = candidates[candidates.length - 1];

  if (minCand.id === maxCand.id) {
    return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };
  }

  let minS = 0;
  let maxS = 1;
  for (const c of candidates) {
    if (c.s < minS) minS = c.s;
    if (c.s > maxS) maxS = c.s;
  }

  const drawAId = minCand.id;
  const drawBId = maxCand.id;
  const wa = relevantPointIds.find((item) => item.id === drawAId)?.world ?? null;
  const wb = relevantPointIds.find((item) => item.id === drawBId)?.world ?? null;
  if (!wa || !wb) return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };

  const ddx = wb.x - wa.x;
  const ddy = wb.y - wa.y;
  const ddDraw = ddx * ddx + ddy * ddy;
  if (ddDraw <= 1e-12) return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };
  const lenDraw = Math.sqrt(ddDraw);

  let minT = 0;
  let maxT = 1;
  for (const c of candidates) {
    const w = relevantPointIds.find((item) => item.id === c.id)?.world ?? null;
    if (!w) continue;
    const ux = w.x - wa.x;
    const uy = w.y - wa.y;
    const t = (ux * ddx + uy * ddy) / ddDraw;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }

  const margin = Math.max(0.06, 0.02 * lenDraw);
  const addLeft = Math.max(0.12, -minT * lenDraw + margin);
  const addRight = Math.max(0.12, (maxT - 1) * lenDraw + margin);
  return { drawAId, drawBId, addLeft, addRight };
}

function collectLineRelevantPointIds(
  scene: SceneModel,
  line: SceneModel["lines"][number]
): Array<{ id: string; world: { x: number; y: number } | null }> {
  const items: Array<{ id: string; world: { x: number; y: number } | null }> = [];
  const pushPoint = (id: string, world: { x: number; y: number } | null) => {
    if (items.some((item) => item.id === id)) return;
    items.push({ id, world });
  };

  const anchors = getLineWorldAnchors(line, scene);
  if (line.kind === "perpendicular" || line.kind === "parallel" || line.kind === "tangent") {
    pushPoint(line.throughId, getPointWorldPosCached(scene, line.throughId));
    pushPoint(line.id, anchors?.b ?? null);
  } else if (line.kind === "circleCircleTangent") {
    pushPoint(`${line.id}#a`, anchors?.a ?? null);
    pushPoint(line.id, anchors?.b ?? null);
  } else if (line.kind === "angleBisector") {
    pushPoint(line.bId, getPointWorldPosCached(scene, line.bId));
    pushPoint(line.id, anchors?.b ?? null);
  } else {
    pushPoint(line.aId, getPointWorldPosCached(scene, line.aId));
    pushPoint(line.bId, getPointWorldPosCached(scene, line.bId));
  }

  for (const point of scene.points) {
    if (point.kind === "pointOnLine" && point.lineId === line.id) {
      pushPoint(point.id, getPointWorldPosCached(scene, point.id));
      continue;
    }
    if (point.kind === "circleLineIntersectionPoint" && point.lineId === line.id) {
      pushPoint(point.id, getPointWorldPosCached(scene, point.id));
      continue;
    }
    if (
      point.kind === "intersectionPoint" &&
      ((point.objA.type === "line" && point.objA.id === line.id) || (point.objB.type === "line" && point.objB.id === line.id))
    ) {
      pushPoint(point.id, getPointWorldPosCached(scene, point.id));
      continue;
    }
    if (
      point.kind === "lineLikeIntersectionPoint" &&
      ((point.objA.type === "line" && point.objA.id === line.id) || (point.objB.type === "line" && point.objB.id === line.id))
    ) {
      pushPoint(point.id, getPointWorldPosCached(scene, point.id));
    }
  }
  return items;
}

const pointByIdCache = new WeakMap<SceneModel, Map<string, ScenePoint>>();
const pointWorldCache = new WeakMap<SceneModel, Map<string, ReturnType<typeof getPointWorldPos>>>();

function getPointByIdCached(scene: SceneModel, pointId: string): ScenePoint | null {
  let map = pointByIdCache.get(scene);
  if (!map) {
    map = new Map(scene.points.map((p) => [p.id, p]));
    pointByIdCache.set(scene, map);
  }
  return map.get(pointId) ?? null;
}

function getPointWorldPosCached(scene: SceneModel, pointId: string) {
  let map = pointWorldCache.get(scene);
  if (!map) {
    map = new Map();
    pointWorldCache.set(scene, map);
  }
  if (map.has(pointId)) return map.get(pointId) ?? null;
  const point = getPointByIdCached(scene, pointId);
  const world = point ? getPointWorldPos(point, scene) : null;
  map.set(pointId, world);
  return world;
}

function buildPointStyleGroups(
  points: ScenePoint[],
  pointName: Map<string, string>,
  options: TikzExportOptions
): Array<{ styleName: string; points: string[]; styleExpr: string }> {
  const groups = new Map<string, { styleName: string; points: string[]; styleExpr: string }>();
  let idx = 0;

  for (const point of points) {
    if (!point.visible) continue;
    const name = pointName.get(point.id);
    if (!name) continue;

    const key = styleKey(point);
    if (!groups.has(key)) {
      const styleName = idx === 0 ? "tkzVertex" : `tkzVertex${idx}`;
      idx += 1;
      groups.set(key, {
        styleName,
        points: [],
        styleExpr: pointStyleToTikz(point, options),
      });
    }

    const group = groups.get(key)!;
    group.points.push(name);
  }

  const ordered = [...groups.values()];
  for (const group of ordered) {
    group.points.sort((a, b) => a.localeCompare(b));
  }
  ordered.sort((a, b) => a.styleName.localeCompare(b.styleName));
  return ordered;
}

function extractPointStyles(cmds: TikzCommand[]): PointStyleDef[] {
  const defs: PointStyleDef[] = [];
  const seen = new Set<string>();

  for (const cmd of cmds) {
    if (cmd.kind !== "DrawPoints") continue;
    if (seen.has(cmd.style)) continue;
    seen.add(cmd.style);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const styleExpr = (cmd as any).styleExpr as string | undefined;
    if (!styleExpr) continue;
    defs.push({ styleName: cmd.style, styleExpr });
  }

  return defs;
}

function styleKey(point: ScenePoint): string {
  const s = point.style;
  return JSON.stringify({
    shape: s.shape,
    sizePx: s.sizePx,
    strokeColor: s.strokeColor,
    strokeWidth: s.strokeWidth,
    strokeOpacity: s.strokeOpacity,
    fillColor: s.fillColor,
    fillOpacity: s.fillOpacity,
  });
}

function pointStyleToTikz(point: ScenePoint, options: TikzExportOptions): string {
  const s = point.style;
  const shape = mapPointShape(s.shape);
  const draw = rgbColorExpr(s.strokeColor);
  const fill = rgbColorExpr(s.fillColor);
  const pointScale = clampPositive(options.pointScale ?? 1, 0.05, 10);
  const trueGlobalScale = clampPositive(options.trueGlobalScale ?? 1, 0.05, 10);
  const canvasStylePxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    resolvedReconstructibleCanvasStylePxToTikzPt(options);
  if (canvasStylePxToPt !== null) {
    const radiusPx = Math.max(1.5, s.sizePx * pointScale);
    const strokeWidthPt = Math.max(
      0.1,
      s.strokeWidth * pointScale * canvasStylePxToPt * trueGlobalScale
    );
    const radiusPt = radiusPx * canvasStylePxToPt;
    if (shape.kind === "dot") {
      const diameterPt = Math.max(1.2, radiusPx * 0.4) * 2 * canvasStylePxToPt;
      const opts = [
        "shape=circle",
        "draw=none",
        `fill=${fill}`,
        "line width=0pt",
        "inner sep=0pt",
        "outer sep=0pt",
        `minimum size=${fmt(diameterPt)}pt`,
      ];
      if (s.fillOpacity < 0.999) opts.push(`fill opacity=${fmt(clamp01(s.fillOpacity))}`);
      return opts.join(", ");
    }
    if (shape.kind === "lineGlyph") {
      const plainShapeName =
        s.shape === "plus" ? "rectangle" : shape.shapeName;
      const overlayPlus = s.shape === "plus" || shape.overlayPlus;
      const opts = [
        `shape=${plainShapeName}`,
        s.shape === "plus" ? "draw=none" : `draw=${draw}`,
        "fill=none",
        `line width=${fmt(strokeWidthPt)}pt`,
        "inner sep=0pt",
        "outer sep=0pt",
        `minimum size=${fmt(radiusPt * 2)}pt`,
      ];
      if (s.strokeOpacity < 0.999) opts.push(`draw opacity=${fmt(clamp01(s.strokeOpacity))}`);
      if (overlayPlus) opts.push(crossPlusOverlayPathPicture(draw, strokeWidthPt, s.strokeOpacity));
      return opts.join(", ");
    }
    const opts = [
      `shape=${shape.shapeName}`,
      `draw=${draw}`,
      `fill=${fill}`,
      `line width=${fmt(strokeWidthPt)}pt`,
      "inner sep=0pt",
      "outer sep=0pt",
      `minimum size=${fmt(radiusPt * 2)}pt`,
    ];
    if (s.strokeOpacity < 0.999) opts.push(`draw opacity=${fmt(clamp01(s.strokeOpacity))}`);
    if (s.fillOpacity < 0.999) opts.push(`fill opacity=${fmt(clamp01(s.fillOpacity))}`);
    return opts.join(", ");
  }
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const pointConv = TIKZ_EXPORT_CALIBRATION.pointConversion;
  const pointStrokeScale = clampPositive(options.pointStrokeScale ?? 1, 0.01, 100);
  const pointInnerSepScale = clampPositive(options.pointInnerSepScale ?? 1, 0.01, 100);
  const lineWidthPt = Math.max(0.1, s.strokeWidth * lineScale * pointConv.matchCanvasPxToPt) *
    pointStrokeScale;
  const fixedInnerSep = options.pointInnerSepFixedPt;
  const baseInnerSepPt = fixedInnerSep !== undefined
    ? Math.max(0.4, fixedInnerSep * pointScale)
    : Math.max(0.4, s.sizePx * pointScale * pointConv.matchCanvasPxToPt);
  const innerSepPt = Math.max(0.4, baseInnerSepPt * pointInnerSepScale);
  if (shape.kind === "dot") {
    // Canvas "dot" is a small filled marker with no stroke.
    const dotInnerSepPt = Math.max(0.35, innerSepPt * 0.4);
    const opts = [
      "shape=circle",
      "draw=none",
      `fill=${fill}`,
      "line width=0pt",
      `inner sep=${fmt(dotInnerSepPt)}pt`,
    ];
    if (s.fillOpacity < 0.999) opts.push(`fill opacity=${fmt(clamp01(s.fillOpacity))}`);
    return opts.join(", ");
  }

  if (shape.kind === "lineGlyph") {
    const glyphSizePt = Math.max(0.8, innerSepPt * 2);
    const opts = [
      `shape=${shape.shapeName}`,
      `draw=${draw}`,
      "fill=none",
      `line width=${fmt(lineWidthPt)}pt`,
      "inner sep=0pt",
      `minimum size=${fmt(glyphSizePt)}pt`,
    ];
    if (s.strokeOpacity < 0.999) opts.push(`draw opacity=${fmt(clamp01(s.strokeOpacity))}`);
    if (shape.overlayPlus) opts.push(crossPlusOverlayPathPicture(draw, lineWidthPt, s.strokeOpacity));
    return opts.join(", ");
  }

  const opts = [
    `shape=${shape.shapeName}`,
    `draw=${draw}`,
    `fill=${fill}`,
    `line width=${fmt(lineWidthPt)}pt`,
    `inner sep=${fmt(innerSepPt)}pt`,
  ];
  if (s.strokeOpacity < 0.999) opts.push(`draw opacity=${fmt(clamp01(s.strokeOpacity))}`);
  if (s.fillOpacity < 0.999) opts.push(`fill opacity=${fmt(clamp01(s.fillOpacity))}`);
  return opts.join(", ");
}

function segmentStyleToTikz(
  style: SceneModel["segments"][number]["style"],
  options: TikzExportOptions,
  hasEndpointArrow = false
): string {
  const base = lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.dash, style.opacity, options);
  if (!hasEndpointArrow) return base;
  // Avoid round-cap protrusion beyond endpoints when an endpoint arrowhead is present.
  if (style.dash === "dotted") return base;
  if (base.includes("line cap=")) return base;
  return `${base},line cap=butt`;
}

function segmentMarkStyleBaseToTikz(
  mark: NonNullable<SceneModel["segments"][number]["style"]["segmentMark"]>,
  segmentStrokeColor: string,
  segmentStrokeWidth: number,
  segmentOpacity: number,
  options: TikzExportOptions
): string | null {
  if (!mark?.enabled || mark.mark === "none") return null;
  const tikzMark = mapSegmentMarkSymbolToTikz(mark.mark);
  if (!tikzMark) {
    throw new Error(`Unsupported SegmentMark: mark=${String(mark.mark)}`);
  }
  if (!Number.isFinite(mark.sizePt) || mark.sizePt <= 0) {
    throw new Error("Unsupported SegmentMark: sizePt");
  }
  const sizeScale =
    clampPositive(options.segmentMarkSizeScale ?? 1, 0.01, 100) *
    clampPositive(options.segmentMarkTreatmentScale ?? 1, 0.01, 100);
  const roundSizeScale = clampPositive(options.segmentMarkRoundSizeScale ?? 1, 0.01, 100);
  const nonRoundSizeScale = clampPositive(options.segmentMarkNonRoundSizeScale ?? 1, 0.01, 100);
  const symbolScale = isRoundSegmentMarkSymbol(mark.mark) ? roundSizeScale : nonRoundSizeScale;
  const symbolSpecificScale = segmentMarkSymbolExportScale(mark.mark);
  const widthScale =
    clampPositive(options.segmentMarkLineWidthScale ?? 1, 0.01, 100) *
    clampPositive(options.segmentMarkTreatmentStrokeScale ?? 1, 0.01, 100);
  const opts: string[] = [`mark=${tikzMark}`, `size=${fmt(mark.sizePt * sizeScale * symbolScale * symbolSpecificScale)}pt`];
  opts.push(`color=${rgbColorExpr(mark.color ?? segmentStrokeColor)}`);
  const opacity = clamp01(segmentOpacity);
  if (opacity < 0.999) opts.push(`opacity=${fmt(opacity)}`);
  if (mark.lineWidthPt !== undefined) {
    if (!Number.isFinite(mark.lineWidthPt) || mark.lineWidthPt <= 0) {
      throw new Error("Unsupported SegmentMark: lineWidthPt");
    }
    opts.push(`line width=${fmt(mark.lineWidthPt * widthScale)}pt`);
  } else {
    opts.push(`line width=${fmt(strokeWidthToTikzPt(segmentStrokeWidth, options))}pt`);
  }
  return opts.join(", ");
}

function mapSegmentMarkSymbolToTikz(mark: SegmentMarkSymbol): string | null {
  if (mark === "none") return null;
  if (mark === "dot") return "*";
  return mark;
}

function isRoundSegmentMarkSymbol(mark: SegmentMarkSymbol): boolean {
  return mark === "o" || mark === "oo" || mark === "dot";
}

function segmentMarkSymbolExportScale(mark: SegmentMarkSymbol): number {
  if (mark === "oo") return 2;
  return 1;
}

function segmentMarkToTikz(
  mark: NonNullable<SceneModel["segments"][number]["style"]["segmentMark"]>,
  pos: number,
  segmentStrokeColor: string,
  segmentStrokeWidth: number,
  segmentOpacity: number,
  options: TikzExportOptions
): string | null {
  if (!Number.isFinite(pos) || pos < 0 || pos > 1) {
    throw new Error("Unsupported SegmentMark: pos");
  }
  const baseStyle = segmentMarkStyleBaseToTikz(mark, segmentStrokeColor, segmentStrokeWidth, segmentOpacity, options);
  if (!baseStyle) return null;
  return `${baseStyle}, pos=${fmt(pos)}`;
}

function segmentMarksToTikz(
  style: Pick<SceneModel["segments"][number]["style"], "segmentMark" | "segmentMarks">,
  segmentStrokeColor: string,
  segmentStrokeWidth: number,
  segmentOpacity: number,
  options: TikzExportOptions,
  aName: string,
  bName: string,
  aWorld?: { x: number; y: number },
  bWorld?: { x: number; y: number },
  nextMultiMarkStyleName?: (mark: SegmentMarkSymbol) => string
): TikzCommand[] {
  const marks = resolveSegmentMarks(style);
  if (marks.length === 0) return [];
  const out: TikzCommand[] = [];
  if (options.drawLayerBackend === "plain") {
    if (!aWorld || !bWorld) return out;
    for (const mark of marks) {
      const positions = collectSegmentMarkPositions(mark, 0.5);
      if (
        (mark.distribution ?? "single") === "multi" &&
        positions.length > 1 &&
        nextMultiMarkStyleName
      ) {
        const tex = multiSegmentMarkToTikz(
          mark,
          positions,
          aName,
          bName,
          segmentStrokeColor,
          segmentStrokeWidth,
          segmentOpacity,
          options,
          nextMultiMarkStyleName(mark.mark)
        );
        if (tex) {
          out.push({ kind: "DrawRaw", tex });
          continue;
        }
      }
      for (const pos of positions) {
        const tex = plainSegmentMarkToTikz(
          mark,
          pos,
          aWorld,
          bWorld,
          segmentStrokeColor,
          segmentStrokeWidth,
          segmentOpacity,
          options
        );
        if (tex) out.push({ kind: "DrawRaw", tex });
      }
    }
    return out;
  }
  const reconstructibleStylePxToPt = resolvedReconstructibleCanvasStylePxToTikzPt(options);
  if (reconstructibleStylePxToPt !== null) {
    for (const mark of marks) {
      const positions = collectSegmentMarkPositions(mark, 0.5);
      if (
        (mark.distribution ?? "single") === "multi" &&
        positions.length > 1 &&
        nextMultiMarkStyleName
      ) {
        const tex = multiSegmentMarkToTikz(
          mark,
          positions,
          aName,
          bName,
          segmentStrokeColor,
          segmentStrokeWidth,
          segmentOpacity,
          options,
          nextMultiMarkStyleName(mark.mark),
          reconstructibleStylePxToPt
        );
        if (tex) {
          out.push({ kind: "DrawRaw", tex });
          continue;
        }
      }
      for (const pos of positions) {
        const tex = precomputedTkzSegmentMarkToTikz(
          mark,
          pos,
          aName,
          bName,
          segmentStrokeColor,
          segmentStrokeWidth,
          segmentOpacity,
          options,
          reconstructibleStylePxToPt
        );
        if (tex) out.push({ kind: "DrawRaw", tex });
      }
    }
    return out;
  }
  for (const mark of marks) {
    const positions = collectSegmentMarkPositions(mark, 0.5);
    if ((mark.distribution ?? "single") === "multi" && positions.length > 1) {
      const baseStyle = segmentMarkStyleBaseToTikz(mark, segmentStrokeColor, segmentStrokeWidth, segmentOpacity, options);
      if (!baseStyle) continue;
      const posList = positions.map((p) => fmt(p)).join(",");
      out.push({
        kind: "DrawRaw",
        tex: `\\foreach \\gdPos in {${posList}}{\\tkzMarkSegment[${baseStyle}, pos=\\gdPos](${aName},${bName})}`,
      });
      continue;
    }
    for (let i = 0; i < positions.length; i += 1) {
      const styleExpr = segmentMarkToTikz(mark, positions[i], segmentStrokeColor, segmentStrokeWidth, segmentOpacity, options);
      if (styleExpr) {
        out.push({
          kind: "MarkSegment",
          a: aName,
          b: bName,
          style: styleExpr,
        });
      }
    }
  }
  return out;
}

function precomputedTkzSegmentMarkToTikz(
  mark: NonNullable<SceneModel["segments"][number]["style"]["segmentMark"]>,
  posRaw: number,
  aName: string,
  bName: string,
  segmentStrokeColor: string,
  segmentStrokeWidth: number,
  segmentOpacity: number,
  options: TikzExportOptions,
  stylePxToPt: number
): string | null {
  if (!mark.enabled || mark.mark === "none") return null;
  const pos = clamp01(Number.isFinite(posRaw) ? posRaw : 0.5);
  const markTreatmentScale = clampPositive(
    options.segmentMarkTreatmentScale ?? 1,
    0.01,
    100
  );
  const sizePx = Math.max(1, mark.sizePt) * markTreatmentScale;
  const sizePt = sizePx * stylePxToPt;
  const tickHalfPt = sizePx * 2.2 * stylePxToPt;
  const gapPt = Math.max(2, sizePx * 0.85) * stylePxToPt;
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const markLineWidthScale = clampPositive(
    options.segmentMarkTreatmentStrokeScale ?? 1,
    0.01,
    100
  );
  const lineWidthPt = Math.max(
    0.1,
    Math.max(0.5, mark.lineWidthPt ?? segmentStrokeWidth) *
      lineScale *
      markLineWidthScale *
      stylePxToPt
  );
  const color = rgbColorExpr(mark.color ?? segmentStrokeColor);
  const opacity = normalizedOpacity(segmentOpacity);
  const drawOpts = [
    `color=${color}`,
    `line width=${fmt(lineWidthPt)}pt`,
  ];
  if (opacity < 0.999) drawOpts.push(`opacity=${fmt(opacity)}`);
  const dim = (value: number): string => `${fmt(value)}pt`;
  const useStyle = (style: string, args: string[], styleOptions: string[]): string => {
    const values = [...args, styleOptions.join(", ")].map((value) => `{${value}}`).join("");
    return `\\path[${style}=${values}] (${aName}) -- (${bName}); % Segment mark ${aName}--${bName}`;
  };

  let markPath: string | null = null;
  if (mark.mark === "|") {
    markPath = useStyle("gdMarkTick", [fmt(pos), dim(tickHalfPt)], drawOpts);
  } else if (mark.mark === "||") {
    markPath = useStyle(
      "gdMarkDoubleTick",
      [fmt(pos), dim(tickHalfPt), dim(gapPt * 0.5)],
      drawOpts
    );
  } else if (mark.mark === "|||") {
    markPath = useStyle(
      "gdMarkTripleTick",
      [fmt(pos), dim(tickHalfPt), dim(gapPt)],
      drawOpts
    );
  } else if (mark.mark === "s") {
    markPath = useStyle(
      "gdMarkSlash",
      [fmt(pos), dim(tickHalfPt), dim(tickHalfPt * 0.55)],
      drawOpts
    );
  } else if (mark.mark === "s|") {
    markPath = useStyle(
      "gdMarkSlashTick",
      [fmt(pos), dim(tickHalfPt), dim(tickHalfPt * 0.55), dim(gapPt * 0.5), dim(tickHalfPt)],
      drawOpts
    );
  } else if (mark.mark === "s||") {
    markPath = useStyle(
      "gdMarkSlashDoubleTick",
      [fmt(pos), dim(tickHalfPt), dim(tickHalfPt * 0.55), dim(gapPt), dim(tickHalfPt)],
      drawOpts
    );
  } else if (mark.mark === "x") {
    markPath = useStyle(
      "gdMarkCross",
      [fmt(pos), dim(sizePt * 0.6), dim(sizePt)],
      drawOpts
    );
  } else if (mark.mark === "o") {
    const radiusPt = Math.max(1.2, sizePx * 0.6) * stylePxToPt;
    markPath = useStyle("gdMarkCircle", [fmt(pos), dim(radiusPt)], drawOpts);
  } else if (mark.mark === "oo") {
    const radiusPt = Math.max(1.2, sizePx * 0.55) * stylePxToPt;
    markPath = useStyle(
      "gdMarkDoubleCircle",
      [fmt(pos), dim(radiusPt), dim(gapPt * 0.55)],
      drawOpts
    );
  } else if (mark.mark === "dot") {
    const radiusPt = Math.max(1.2, sizePx * 0.58) * stylePxToPt;
    const fillOpts = [`fill=${color}`];
    if (opacity < 0.999) fillOpts.push(`fill opacity=${fmt(opacity)}`);
    markPath = useStyle("gdMarkDot", [fmt(pos), dim(radiusPt)], fillOpts);
  } else if (mark.mark === "z") {
    markPath = useStyle(
      "gdMarkZigzag",
      [fmt(pos), dim(gapPt), dim(sizePt * 0.8), dim(sizePt * 0.2)],
      drawOpts
    );
  }
  if (!markPath) return null;

  // The named tikzset style keeps each exported mark easy to customize while
  // preserving a live anchor/orientation on the named segment. Its dimensions
  // remain independent, unlike tkz-euclide's built-in ||/||| plot marks whose
  // bar gap is derived from \pgflinewidth.
  return markPath;
}

function plainSegmentMarkToTikz(
  mark: NonNullable<SceneModel["segments"][number]["style"]["segmentMark"]>,
  posRaw: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  segmentStrokeColor: string,
  segmentStrokeWidth: number,
  segmentOpacity: number,
  options: TikzExportOptions
): string | null {
  if (!mark.enabled || mark.mark === "none") return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 1e-12) return null;
  const ux = dx / length;
  const uy = dy / length;
  // Canvas builds its normal in screen coordinates (Y down). Converted back
  // into world/TikZ coordinates (Y up), that normal is (uy,-ux).
  const nx = uy;
  const ny = -ux;
  const pos = clamp01(Number.isFinite(posRaw) ? posRaw : 0.5);
  const center = { x: a.x + dx * pos, y: a.y + dy * pos };
  // With an explicit canvas viewport the tighter framing already carries True
  // Zoom into coordinate-space marks. A whole-scene export does not, so apply
  // the resolved treatment factor here. The independent mark-size compensation
  // lets close-up treatments moderate mark growth without changing its stroke.
  const coordinateMarkScale = options.viewport
    ? 1
    : clampPositive(options.visualTreatmentFactor ?? 1, 0.05, 20);
  const markTreatmentScale = clampPositive(
    options.segmentMarkTreatmentScale ?? 1,
    0.01,
    100
  );
  const sizePx = Math.max(1, mark.sizePt) * coordinateMarkScale * markTreatmentScale;
  const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  const sizeWorld = sizePx / pxPerWorld;
  const tickHalfWorld = (sizePx * 2.2) / pxPerWorld;
  const gapWorld = Math.max(2, sizePx * 0.85) / pxPerWorld;
  const lineWidthPx = Math.max(0.5, mark.lineWidthPt ?? segmentStrokeWidth);
  const lineWidthPt =
    lineWidthPx *
    clampPositive(options.lineScale ?? 1, 0.05, 10) *
    clampPositive(options.segmentMarkTreatmentStrokeScale ?? 1, 0.01, 100) *
    (resolvedPlainCanvasPxToTikzPt(options) ?? FALLBACK_CANVAS_PX_TO_TIKZ_PT);
  const color = rgbColorExpr(mark.color ?? segmentStrokeColor);
  const opacity = normalizedOpacity(segmentOpacity);
  const drawOpts = [
    `color=${color}`,
    `line width=${fmt(Math.max(0.1, lineWidthPt))}pt`,
    "line cap=round",
    "line join=round",
  ];
  if (opacity < 0.999) drawOpts.push(`opacity=${fmt(opacity)}`);
  const draw = (points: Array<{ x: number; y: number }>, close = false): string => {
    const path = points.map((p) => `(${fmt(p.x)},${fmt(p.y)})`).join(" -- ");
    return `\\draw[${drawOpts.join(", ")}] ${path}${close ? " -- cycle" : ""};`;
  };
  const along = (amount: number) => ({
    x: center.x + ux * amount,
    y: center.y + uy * amount,
  });
  const cross = (origin: { x: number; y: number }, amount: number) => ({
    x: origin.x + nx * amount,
    y: origin.y + ny * amount,
  });
  const tick = (offset: number): string => {
    const origin = along(offset);
    return draw([cross(origin, -tickHalfWorld), cross(origin, tickHalfWorld)]);
  };
  const slash = (offset: number): string => {
    const origin = along(offset);
    const p1 = {
      x: origin.x - ux * tickHalfWorld - nx * tickHalfWorld * 0.55,
      y: origin.y - uy * tickHalfWorld - ny * tickHalfWorld * 0.55,
    };
    const p2 = {
      x: origin.x + ux * tickHalfWorld + nx * tickHalfWorld * 0.55,
      y: origin.y + uy * tickHalfWorld + ny * tickHalfWorld * 0.55,
    };
    return draw([p1, p2]);
  };

  if (mark.mark === "|") return tick(0);
  if (mark.mark === "||") return `${tick(-gapWorld * 0.5)}\n${tick(gapWorld * 0.5)}`;
  if (mark.mark === "|||") return `${tick(-gapWorld)}\n${tick(0)}\n${tick(gapWorld)}`;
  if (mark.mark === "s") return slash(0);
  if (mark.mark === "s|") return `${slash(-gapWorld * 0.5)}\n${tick(gapWorld * 0.5)}`;
  if (mark.mark === "s||") return `${slash(-gapWorld)}\n${tick(0)}\n${tick(gapWorld)}`;
  if (mark.mark === "x") {
    return [
      draw([
        { x: center.x - nx * sizeWorld - ux * sizeWorld * 0.6, y: center.y - ny * sizeWorld - uy * sizeWorld * 0.6 },
        { x: center.x + nx * sizeWorld + ux * sizeWorld * 0.6, y: center.y + ny * sizeWorld + uy * sizeWorld * 0.6 },
      ]),
      draw([
        { x: center.x - nx * sizeWorld + ux * sizeWorld * 0.6, y: center.y - ny * sizeWorld + uy * sizeWorld * 0.6 },
        { x: center.x + nx * sizeWorld - ux * sizeWorld * 0.6, y: center.y + ny * sizeWorld - uy * sizeWorld * 0.6 },
      ]),
    ].join("\n");
  }
  if (mark.mark === "o") {
    const radius = Math.max(1.2, sizePx * 0.6) / pxPerWorld;
    return `\\draw[${drawOpts.join(", ")}] (${fmt(center.x)},${fmt(center.y)}) circle[radius=${fmt(radius)}];`;
  }
  if (mark.mark === "oo") {
    const radius = Math.max(1.2, sizePx * 0.55) / pxPerWorld;
    const left = along(-gapWorld * 0.55);
    const right = along(gapWorld * 0.55);
    return [
      `\\draw[${drawOpts.join(", ")}] (${fmt(left.x)},${fmt(left.y)}) circle[radius=${fmt(radius)}];`,
      `\\draw[${drawOpts.join(", ")}] (${fmt(right.x)},${fmt(right.y)}) circle[radius=${fmt(radius)}];`,
    ].join("\n");
  }
  if (mark.mark === "dot") {
    const radius = Math.max(1.2, sizePx * 0.58) / pxPerWorld;
    const fillOpts = [`fill=${color}`];
    if (opacity < 0.999) fillOpts.push(`fill opacity=${fmt(opacity)}`);
    return `\\fill[${fillOpts.join(", ")}] (${fmt(center.x)},${fmt(center.y)}) circle[radius=${fmt(radius)}];`;
  }
  if (mark.mark === "z") {
    return draw([
      { x: center.x - ux * gapWorld - nx * sizeWorld * 0.8, y: center.y - uy * gapWorld - ny * sizeWorld * 0.8 },
      { x: center.x + ux * gapWorld + nx * sizeWorld * 0.8, y: center.y + uy * gapWorld - ny * sizeWorld * 0.2 },
      { x: center.x - ux * gapWorld - nx * sizeWorld * 0.8, y: center.y - uy * gapWorld + ny * sizeWorld * 0.8 },
      { x: center.x + ux * gapWorld + nx * sizeWorld * 0.8, y: center.y + uy * gapWorld + ny * sizeWorld * 0.2 },
    ]);
  }
  return null;
}

function multiSegmentMarkToTikz(
  mark: NonNullable<SceneModel["segments"][number]["style"]["segmentMark"]>,
  positions: number[],
  aName: string,
  bName: string,
  segmentStrokeColor: string,
  segmentStrokeWidth: number,
  segmentOpacity: number,
  options: TikzExportOptions,
  styleName: string,
  explicitStylePxToPt?: number
): string | null {
  if (!mark.enabled || mark.mark === "none" || positions.length < 2) return null;
  const stylePxToPt =
    explicitStylePxToPt ??
    resolvedPlainCanvasPxToTikzPt(options) ??
    FALLBACK_CANVAS_PX_TO_TIKZ_PT;
  const markTreatmentScale = clampPositive(
    options.segmentMarkTreatmentScale ?? 1,
    0.01,
    100
  );
  const sizePx = Math.max(1, mark.sizePt) * markTreatmentScale;
  const sizePt = sizePx * stylePxToPt;
  const tickHalfPt = sizePx * 2.2 * stylePxToPt;
  const gapPt = Math.max(2, sizePx * 0.85) * stylePxToPt;
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const markLineWidthScale = clampPositive(
    options.segmentMarkTreatmentStrokeScale ?? 1,
    0.01,
    100
  );
  const lineWidthPt = Math.max(
    0.1,
    Math.max(0.5, mark.lineWidthPt ?? segmentStrokeWidth) *
      lineScale *
      markLineWidthScale *
      stylePxToPt
  );
  const color = rgbColorExpr(mark.color ?? segmentStrokeColor);
  const opacity = normalizedOpacity(segmentOpacity);
  const drawOptions = [
    `color=${color}`,
    `line width=${fmt(lineWidthPt)}pt`,
    "line cap=round",
    "line join=round",
  ];
  if (opacity < 0.999) drawOptions.push(`opacity=${fmt(opacity)}`);
  const fillOptions = [`fill=${color}`];
  if (opacity < 0.999) fillOptions.push(`fill opacity=${fmt(opacity)}`);
  const dim = (value: number): string => `${fmt(value)}pt`;
  const draw = (path: string, extraOptions: string[] = []): string =>
    `\\draw[${[...drawOptions, ...extraOptions].join(", ")}] ${path};`;
  const fill = (path: string): string =>
    `\\fill[${fillOptions.join(", ")}] ${path};`;
  const tick = (offset = 0): string =>
    draw(
      `(0pt,-${dim(tickHalfPt)}) -- (0pt,${dim(tickHalfPt)})`,
      Math.abs(offset) > 1e-12 ? [`xshift=${dim(offset)}`] : []
    );
  const slash = (offset = 0): string =>
    draw(
      `(-${dim(tickHalfPt)},-${dim(tickHalfPt * 0.55)}) -- (${dim(tickHalfPt)},${dim(tickHalfPt * 0.55)})`,
      Math.abs(offset) > 1e-12 ? [`xshift=${dim(offset)}`] : []
    );

  let markerCommands: string[];
  if (mark.mark === "|") {
    markerCommands = [tick()];
  } else if (mark.mark === "||") {
    markerCommands = [tick(-gapPt * 0.5), tick(gapPt * 0.5)];
  } else if (mark.mark === "|||") {
    markerCommands = [tick(-gapPt), tick(), tick(gapPt)];
  } else if (mark.mark === "s") {
    markerCommands = [slash()];
  } else if (mark.mark === "s|") {
    markerCommands = [slash(-gapPt * 0.5), tick(gapPt * 0.5)];
  } else if (mark.mark === "s||") {
    markerCommands = [slash(-gapPt), tick(), tick(gapPt)];
  } else if (mark.mark === "x") {
    markerCommands = [
      draw(`(-${dim(sizePt * 0.6)},-${dim(sizePt)}) -- (${dim(sizePt * 0.6)},${dim(sizePt)})`),
      draw(`(-${dim(sizePt * 0.6)},${dim(sizePt)}) -- (${dim(sizePt * 0.6)},-${dim(sizePt)})`),
    ];
  } else if (mark.mark === "o") {
    const radiusPt = Math.max(1.2, sizePx * 0.6) * stylePxToPt;
    markerCommands = [draw(`(0pt,0pt) circle[radius=${dim(radiusPt)}]`)];
  } else if (mark.mark === "oo") {
    const radiusPt = Math.max(1.2, sizePx * 0.55) * stylePxToPt;
    markerCommands = [
      draw(`(0pt,0pt) circle[radius=${dim(radiusPt)}]`, [`xshift=-${dim(gapPt * 0.55)}`]),
      draw(`(0pt,0pt) circle[radius=${dim(radiusPt)}]`, [`xshift=${dim(gapPt * 0.55)}`]),
    ];
  } else if (mark.mark === "dot") {
    const radiusPt = Math.max(1.2, sizePx * 0.58) * stylePxToPt;
    markerCommands = [fill(`(0pt,0pt) circle[radius=${dim(radiusPt)}]`)];
  } else if (mark.mark === "z") {
    markerCommands = [
      draw(
        `(-${dim(gapPt)},-${dim(sizePt * 0.8)}) -- (${dim(gapPt)},-${dim(sizePt * 0.2)}) -- (-${dim(gapPt)},${dim(sizePt * 0.8)}) -- (${dim(gapPt)},${dim(sizePt * 0.2)})`
      ),
    ];
  } else {
    return null;
  }

  const start = positions[0];
  const end = positions[positions.length - 1];
  const step = Math.max(0.001, Math.abs(positions[1] - positions[0]));
  return [
    "% Distributed segment mark: edit this style to customize the whole group.",
    "\\tikzset{",
    `  ${styleName}/.style={`,
    "    postaction=decorate,",
    "    decoration={",
    "      markings,",
    `      mark=between positions ${fmt(start)} and ${fmt(end)} step ${fmt(step)} with {`,
    ...markerCommands.map((command) => `        ${command}`),
    "      }",
    "    }",
    "  }",
    "}",
    `\\path[${styleName}] (${aName}) -- (${bName}); % Segment mark ${aName}--${bName}`,
  ].join("\n");
}

function segmentArrowsToTikz(
  styleArrows: SegmentArrowMark | SegmentArrowMark[] | undefined,
  aName: string,
  bName: string,
  base: {
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
    segmentStrokeWidthPt: number;
    segmentStrokeCarrierKey: string | null;
  },
  metrics?: PathArrowExportMetrics,
  dotSizeScale?: number,
  plainBackend = false,
  resolveMultiArrowStyleName?: (signature: string) => string
): { kind: "tkz"; style: string } | { kind: "raw"; tex: string } | null {
  const arrows = Array.isArray(styleArrows) ? styleArrows : styleArrows ? [styleArrows] : [];
  if (arrows.length === 0) return null;
  const effectiveArrows = canonicalizeSegmentArrows(arrows);
  if (effectiveArrows.length === 0) return null;

  const rawTexs: string[] = [];
  const drawEndpointSegment = (
    style: string,
    from: string,
    to: string
  ): string =>
    plainBackend
      ? `\\draw[${style}] (${from}) -- (${to});`
      : `\\tkzDrawSegment[${style}](${from},${to})`;

  for (const effectiveArrow of effectiveArrows) {
    const tip = resolveArrowTipName(effectiveArrow.tip, "SegmentArrowMark");
    if (isDotArrowTip(tip)) {
      const dotOverlays = segmentDotArrowOverlaysToTikz(
        effectiveArrow,
        tip,
        aName,
        bName,
        {
          strokeColor: base.strokeColor,
          strokeWidth: base.strokeWidth,
          opacity: base.opacity,
        },
        metrics,
        dotSizeScale
      );
      if (dotOverlays.length > 0) {
        rawTexs.push(...dotOverlays);
      }
      continue;
    }

    if (effectiveArrow.mode === "mid") {
      const midOverlay = pathArrowOverlayToTikz(
        effectiveArrow,
        `(${aName}) -- (${bName})`,
        base,
        effectiveArrow.pos ?? 0.5,
        metrics,
        undefined,
        undefined,
        dotSizeScale,
        resolveMultiArrowStyleName
      );
      if (midOverlay) {
        rawTexs.push(midOverlay);
      }
      continue;
    }

    // End arrow logic
    ensureSupportedArrowDirection(effectiveArrow.direction, "SegmentArrowMark");
    const arrowColor = rgbColorExpr(effectiveArrow.color ?? base.strokeColor);
    const opacity = normalizedOpacity(base.opacity);
    const sourceStrokeWidth = resolveArrowSourceWidth(undefined, base.strokeWidth);
    const overlayArrowWidthPt = Math.max(0.1, sourceStrokeWidth * PATH_ARROW_WIDTH_EXPORT_SCALE);
    const normalizedSegmentColor = base.strokeColor.trim().toLowerCase();
    const normalizedArrowColor = (effectiveArrow.color ?? base.strokeColor).trim().toLowerCase();
    const arrowKey = segmentArrowCanonicalKey(effectiveArrow);
    const isCarrierArrow = base.segmentStrokeCarrierKey !== null && arrowKey === base.segmentStrokeCarrierKey;
    const hasSameColorCarrier = base.segmentStrokeCarrierKey !== null && normalizedArrowColor === normalizedSegmentColor;
    const useSegmentStrokeWidthForEndpoint =
      effectiveArrow.mode === "end" &&
      (isCarrierArrow || hasSameColorCarrier);
    const arrowWidth = useSegmentStrokeWidthForEndpoint ? base.segmentStrokeWidthPt : overlayArrowWidthPt;
    const arrowWidthUi = resolvePathArrowWidthUi(effectiveArrow.lineWidthPt);
    const canvasPxToTikzPt = resolveCanvasPxToTikzPt(metrics);
    const tipMetrics = resolvePathArrowTipMetricsPx(
      tip,
      effectiveArrow.sizeScale,
      arrowWidthUi,
      "PathArrowMark",
      effectiveArrow.arrowLength
    );
    const tipSpec = resolveArrowTipSpec(
      tip,
      tipMetrics.lengthPx * canvasPxToTikzPt,
      tipMetrics.widthPx * canvasPxToTikzPt
    );
    const drawStyleBase = `color=${arrowColor},line width=${fmt(arrowWidth)}pt,line cap=butt${opacity < 0.999 ? `,opacity=${fmt(opacity)}` : ""
      }`;
    const drawStyleForward = `${drawStyleBase},-{${tipSpec}}`;
    const pathLengthPx =
      Number.isFinite(metrics?.pathLengthWorld) &&
      Number.isFinite(metrics?.screenPxPerWorld) &&
      (metrics?.pathLengthWorld as number) > 0 &&
      (metrics?.screenPxPerWorld as number) > 0
        ? (metrics?.pathLengthWorld as number) * (metrics?.screenPxPerWorld as number)
        : NaN;
    const tipLengthPx = tipMetrics.lengthPx;
    const shortTailFrac = Number.isFinite(pathLengthPx)
      ? Math.max(0.01, Math.min(0.35, (tipLengthPx * 1.1) / (pathLengthPx as number)))
      : 0.06;
    const shortTailT = fmt(1 - shortTailFrac);
    const preferHeadOnlyEndpointOverlay = hasSameColorCarrier && !isCarrierArrow;

    if (effectiveArrow.direction === "->") {
      if (preferHeadOnlyEndpointOverlay) {
        rawTexs.push(
          drawEndpointSegment(
            drawStyleForward,
            `$(${aName})!${shortTailT}!(${bName})$`,
            bName
          )
        );
      } else {
        rawTexs.push(
          drawEndpointSegment(drawStyleForward, aName, bName)
        );
      }
    } else if (effectiveArrow.direction === "<-") {
      if (preferHeadOnlyEndpointOverlay) {
        rawTexs.push(
          drawEndpointSegment(
            drawStyleForward,
            `$(${bName})!${shortTailT}!(${aName})$`,
            aName
          )
        );
      } else {
        rawTexs.push(
          drawEndpointSegment(drawStyleForward, bName, aName)
        );
      }
    } else if (effectiveArrow.direction === "<->") {
      if (preferHeadOnlyEndpointOverlay) {
        rawTexs.push(
          drawEndpointSegment(
            drawStyleForward,
            `$(${aName})!${shortTailT}!(${bName})$`,
            bName
          )
        );
        rawTexs.push(
          drawEndpointSegment(
            drawStyleForward,
            `$(${bName})!${shortTailT}!(${aName})$`,
            aName
          )
        );
      } else {
        rawTexs.push(
          drawEndpointSegment(
            `${drawStyleBase},{${tipSpec}}-{${tipSpec}}`,
            aName,
            bName
          )
        );
      }
    } else {
      // >-< inward endpoint arrows need a short extension outside each endpoint
      // to orient arrowheads toward the segment interior.
      const tailFrac = Math.max(0.02, Math.min(0.14, 0.03 + 0.03 * clampPositive(effectiveArrow.sizeScale ?? DEFAULT_PATH_ARROW_UI, 0.1, 20)));
      const tNeg = fmt(-tailFrac);
      rawTexs.push(
        drawEndpointSegment(
          drawStyleForward,
          `$(${aName})!${tNeg}!(${bName})$`,
          aName
        )
      );
      rawTexs.push(
        drawEndpointSegment(
          drawStyleForward,
          `$(${bName})!${tNeg}!(${aName})$`,
          bName
        )
      );
    }
  }

  if (rawTexs.length === 0) return null;
  return { kind: "raw", tex: rawTexs.join("\n") };
}

function segmentDotArrowOverlaysToTikz(
  arrow: SegmentArrowMark,
  tip: "Dot" | "OpenDot",
  aName: string,
  bName: string,
  base: { strokeColor: string; strokeWidth: number; opacity: number },
  metrics?: PathArrowExportMetrics,
  dotSizeScale?: number
): string[] {
  const pathExpr = `(${aName}) -- (${bName})`;
  const overlays: string[] = [];
  const pushDotOverlay = (pos: number) => {
    const overlay = pathArrowOverlayToTikz(
      {
        enabled: true,
        direction: "->",
        tip,
        distribution: "single",
        pos: clamp01(pos),
        sizeScale: arrow.sizeScale,
        color: arrow.color,
        lineWidthPt: arrow.lineWidthPt,
        pairGapPx: arrow.pairGapPx,
        arrowLength: arrow.arrowLength,
      },
      pathExpr,
      base,
      clamp01(pos),
      metrics,
      undefined,
      undefined,
      dotSizeScale
    );
    if (overlay) overlays.push(overlay);
  };

  if (arrow.mode === "end") {
    if (arrow.direction === "->") {
      pushDotOverlay(1);
      return overlays;
    }
    if (arrow.direction === "<-") {
      pushDotOverlay(0);
      return overlays;
    }
    pushDotOverlay(0);
    pushDotOverlay(1);
    return overlays;
  }

  const midOverlay = pathArrowOverlayToTikz(
    arrow,
    pathExpr,
    base,
    arrow.pos ?? 0.5,
    metrics,
    undefined,
    undefined,
    dotSizeScale
  );
  if (midOverlay) overlays.push(midOverlay);
  return overlays;
}

function normalizeLegacyEndpointMidArrow(arrow: SegmentArrowMark): SegmentArrowMark {
  if (arrow.mode !== "mid") return arrow;
  if ((arrow.distribution ?? "single") !== "single") return arrow;
  const pos = Number.isFinite(arrow.pos) ? (arrow.pos as number) : 0.5;
  const endpointEpsilon = 1e-6;
  // Backward-compat for older UI that approximated endpoint arrows via mid-pos 0/1.
  if (arrow.direction === "->" && pos >= 1 - endpointEpsilon) {
    return { ...arrow, mode: "end", distribution: "single" };
  }
  if (arrow.direction === "<-" && pos <= endpointEpsilon) {
    return { ...arrow, mode: "end", distribution: "single" };
  }
  return arrow;
}

function hasEnabledEndpointSegmentArrow(styleArrows: SegmentArrowMark | SegmentArrowMark[] | undefined): boolean {
  const arrows = Array.isArray(styleArrows) ? styleArrows : styleArrows ? [styleArrows] : [];
  return canonicalizeSegmentArrows(arrows).some((arrow) => arrow.mode === "end");
}

function selectSegmentStrokeCarrierArrowKey(
  style: SceneModel["segments"][number]["style"],
  styleArrows: SegmentArrowMark | SegmentArrowMark[] | undefined
): string | null {
  if (style.dash !== "solid") return null;
  const arrows = Array.isArray(styleArrows) ? styleArrows : styleArrows ? [styleArrows] : [];
  const canonical = canonicalizeSegmentArrows(arrows);
  const strokeColor = style.strokeColor.trim().toLowerCase();
  for (const arrow of canonical) {
    if (arrow.mode !== "end") continue;
    if (arrow.direction !== "->" && arrow.direction !== "<-" && arrow.direction !== "<->") continue;
    const arrowColor = (arrow.color ?? style.strokeColor).trim().toLowerCase();
    if (arrowColor !== strokeColor) continue;
    return segmentArrowCanonicalKey(arrow);
  }
  return null;
}

function canonicalizeSegmentArrows(arrows: SegmentArrowMark[]): SegmentArrowMark[] {
  const normalized = arrows
    .filter((arrow) => Boolean(arrow?.enabled))
    .map((arrow) => normalizeLegacyEndpointMidArrow(arrow))
    .filter((arrow) => arrow.enabled);
  if (normalized.length === 0) return [];

  const hasEndpoint = normalized.some((arrow) => arrow.mode === "end");
  const filtered = hasEndpoint
    ? normalized.filter((arrow) => arrow.mode === "end" || !isBoundarySingleMidArrow(arrow))
    : normalized;

  const out: SegmentArrowMark[] = [];
  const seen = new Set<string>();
  for (const arrow of filtered) {
    const key = segmentArrowCanonicalKey(arrow);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(arrow);
  }
  return mergeBidirectionalEndpointPairs(out);
}

function mergeBidirectionalEndpointPairs(arrows: SegmentArrowMark[]): SegmentArrowMark[] {
  const merged: SegmentArrowMark[] = [];
  const pendingForwardByKey = new Map<string, number>();
  const pendingBackwardByKey = new Map<string, number>();
  for (const arrow of arrows) {
    if (arrow.mode !== "end") {
      merged.push(arrow);
      continue;
    }
    if (arrow.direction !== "->" && arrow.direction !== "<-") {
      merged.push(arrow);
      continue;
    }
    const mergeKey = bidirectionalEndpointMergeKey(arrow);
    if (arrow.direction === "->") {
      const oppositeIndex = pendingBackwardByKey.get(mergeKey);
      if (oppositeIndex !== undefined) {
        merged[oppositeIndex] = { ...merged[oppositeIndex], direction: "<->" };
        pendingBackwardByKey.delete(mergeKey);
        continue;
      }
      pendingForwardByKey.set(mergeKey, merged.length);
      merged.push(arrow);
      continue;
    }
    const oppositeIndex = pendingForwardByKey.get(mergeKey);
    if (oppositeIndex !== undefined) {
      merged[oppositeIndex] = { ...merged[oppositeIndex], direction: "<->" };
      pendingForwardByKey.delete(mergeKey);
      continue;
    }
    pendingBackwardByKey.set(mergeKey, merged.length);
    merged.push(arrow);
  }
  return merged;
}

function bidirectionalEndpointMergeKey(arrow: SegmentArrowMark): string {
  const round = (value: unknown): string => {
    if (!Number.isFinite(value)) return "";
    return (value as number).toFixed(4);
  };
  return [
    arrow.mode,
    arrow.tip ?? "",
    arrow.distribution ?? "single",
    round(arrow.pos),
    round(arrow.startPos),
    round(arrow.endPos),
    round(arrow.step),
    round(arrow.sizeScale),
    round(arrow.lineWidthPt),
    round(arrow.arrowLength),
    round(arrow.pairGapPx),
    arrow.color ?? "",
  ].join("|");
}

function isBoundarySingleMidArrow(arrow: SegmentArrowMark): boolean {
  if (arrow.mode !== "mid") return false;
  if ((arrow.distribution ?? "single") !== "single") return false;
  const pos = Number.isFinite(arrow.pos) ? (arrow.pos as number) : 0.5;
  const endpointEpsilon = 1e-6;
  return pos <= endpointEpsilon || pos >= 1 - endpointEpsilon;
}

function segmentArrowCanonicalKey(arrow: SegmentArrowMark): string {
  const round = (value: unknown): string => {
    if (!Number.isFinite(value)) return "";
    return (value as number).toFixed(4);
  };
  return [
    arrow.mode,
    arrow.direction,
    arrow.tip ?? "",
    arrow.distribution ?? "single",
    round(arrow.pos),
    round(arrow.startPos),
    round(arrow.endPos),
    round(arrow.step),
    round(arrow.sizeScale),
    round(arrow.lineWidthPt),
    round(arrow.arrowLength),
    round(arrow.pairGapPx),
    arrow.color ?? "",
  ].join("|");
}

function pathArrowOverlayToTikz(
  styleArrows: PathArrowMark | PathArrowMark[] | SegmentArrowMark | SegmentArrowMark[] | undefined,
  pathExpr: string,
  base: { strokeColor: string; strokeWidth: number; opacity: number },
  fallbackPos: number,
  metrics?: PathArrowExportMetrics,
  _arcDef?: { center: { x: number; y: number }; radius: number; startRad: number; sweepRad: number },
  _arrowTipOptions?: { bend?: boolean; flex?: boolean },
  dotSizeScale?: number,
  resolveMultiArrowStyleName?: (signature: string) => string
): string | null {
  const arrows = Array.isArray(styleArrows) ? styleArrows : styleArrows ? [styleArrows] : [];
  const results: string[] = [];

  for (const arrow of arrows) {
    if (!arrow?.enabled) continue;
    ensureSupportedArrowDirection(arrow.direction, "PathArrowMark");
    const tip = resolveArrowTipName(arrow.tip, "PathArrowMark");
    const isDotTip = isDotArrowTip(tip);
    const arrowColor = rgbColorExpr(arrow.color ?? base.strokeColor);
    const opacity = normalizedOpacity(base.opacity);
    const arrowWidthUi = resolvePathArrowWidthUi(arrow.lineWidthPt);
    const canvasPxToTikzPt = resolveCanvasPxToTikzPt(metrics);
    const resolvedDotSizeScale = clampPositive(dotSizeScale ?? 1, 0.05, 20);

    const marks: string[] = [];
    let pairDelta = 0;
    let markerCmd = "";
    let forwardCmd = "";
    let reverseCmd = "";
    let arrowTipSpec = "";

    if (isDotTip) {
      const dotMetrics = resolvePathDotMarkMetricsPx(
        arrowWidthUi,
        clampPositive(arrow.sizeScale ?? DEFAULT_PATH_ARROW_UI, 0.1, 20) * resolvedDotSizeScale,
        arrow.arrowLength
      );
      markerCmd = dotMarkCommandToTikz(
        tip,
        arrowColor,
        opacity,
        dotMetrics.radiusPx * canvasPxToTikzPt,
        dotMetrics.strokePx * canvasPxToTikzPt
      );
      pairDelta = computePathArrowPairDelta(
        dotMetrics.pairSeparationPx,
        metrics?.pathLengthWorld,
        metrics?.screenPxPerWorld,
        arrow.pairGapPx
      );
    } else {
      const tipMetrics = resolvePathArrowTipMetricsPx(
        tip,
        arrow.sizeScale,
        arrowWidthUi,
        "PathArrowMark",
        arrow.arrowLength
      );
      arrowTipSpec = resolveArrowTipSpec(
        tip,
        tipMetrics.lengthPx * canvasPxToTikzPt,
        tipMetrics.widthPx * canvasPxToTikzPt,
        opacity < 0.999 ? { opacity } : undefined
      );
      forwardCmd = pathArrowGlyphCommandToTikz(tip, arrowColor, opacity, tipMetrics, canvasPxToTikzPt, false);
      reverseCmd = pathArrowGlyphCommandToTikz(tip, arrowColor, opacity, tipMetrics, canvasPxToTikzPt, true);
      pairDelta = computePathArrowPairDelta(
        tipMetrics.pairSeparationPx,
        metrics?.pathLengthWorld,
        metrics?.screenPxPerWorld,
        arrow.pairGapPx
      );
    }
    const positions = collectPathArrowPositions(arrow, fallbackPos);

    if (
      resolveMultiArrowStyleName &&
      !isDotTip &&
      positions.length > 1 &&
      (arrow.direction === "->" || arrow.direction === "<-")
    ) {
      const start = positions[0];
      const end = positions[positions.length - 1];
      const step = Math.max(0.001, Math.min(1, arrow.step ?? 0.05));
      const arrowCommand = arrow.direction === "->" ? "\\arrow" : "\\arrowreversed";
      const multiStyleName = resolveMultiArrowStyleName(
        [arrow.direction, arrowColor, fmt(start), fmt(end), fmt(step)].join("|")
      );
      results.push(
        [
          "\\tikzset{",
          `  ${multiStyleName}/.style={`,
          "    postaction=decorate,",
          "    decoration={",
          "      markings,",
          `      mark=between positions ${fmt(start)} and ${fmt(end)} step ${fmt(step)} with {`,
          `        ${arrowCommand}[color=${arrowColor}]{#1}`,
          "      }",
          "    }",
          "  }",
          "}",
          `\\path[${multiStyleName}={${arrowTipSpec}}] ${pathExpr};`,
        ].join("\n")
      );
      continue;
    }

    const addMark = (pos: number, command: string) => {
      marks.push(`mark=at position ${fmt(clamp01(pos))} with {${command}}`);
    };

    for (let i = 0; i < positions.length; i += 1) {
      const p = positions[i];
      if (isDotTip) {
        if (arrow.direction === "->" || arrow.direction === "<-") {
          addMark(p, markerCmd);
        } else {
          addMark(p - pairDelta, markerCmd);
          addMark(p + pairDelta, markerCmd);
        }
        continue;
      }
      if (arrow.direction === "->") {
        addMark(p, forwardCmd);
      } else if (arrow.direction === "<-") {
        addMark(p, reverseCmd);
      } else if (arrow.direction === "<->") {
        addMark(p - pairDelta, reverseCmd);
        addMark(p + pairDelta, forwardCmd);
      } else {
        addMark(p - pairDelta, forwardCmd);
        addMark(p + pairDelta, reverseCmd);
      }
    }

    if (marks.length > 0) {
      const opts: string[] = ["postaction=decorate", `decoration={markings,${marks.join(",")}}`];
      results.push(`\\path[${opts.join(", ")}] ${pathExpr};`);
    }
  }

  return results.length > 0 ? results.join("\n") : null;
}

function sectorMarksToTikz(
  style: SceneModel["angles"][number]["style"],
  pathExpr: string,
  base: { strokeColor: string; strokeWidth: number; opacity: number },
  options: TikzExportOptions
): string | null {
  const marks = resolveAngleMarks(style);
  if (marks.length === 0) return null;
  const canvasStylePxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    resolvedReconstructibleCanvasStylePxToTikzPt(options);
  const lineWidthPt =
    canvasStylePxToPt === null
      ? strokeWidthToTikzPt(base.strokeWidth, options)
      : strokeWidthToTikzPt(
          base.strokeWidth * ANGLE_CANVAS_STROKE_SCALE,
          options
        );
  const overlays: string[] = [];
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    const markSize =
      (mark.markSize ?? 1.2) *
      clampPositive(options.angleMarkSizeScale ?? 1, 0.01, 100);
    const markCommand = sectorMarkSymbolCommandToTikz(
      mark.markSymbol,
      canvasStylePxToPt === null
        ? Math.max(0.2, markSize * FALLBACK_CANVAS_PX_TO_TIKZ_PT)
        : markSize,
      rgbColorExpr(mark.markColor ?? style.markColor ?? base.strokeColor),
      lineWidthPt,
      normalizedOpacity(base.opacity),
      canvasStylePxToPt ?? undefined
    );
    if (!markCommand) continue;
    const positions = collectAngleMarkPositions(mark, style.markPos ?? 0.5);
    if (positions.length === 0) continue;
    const markEntries = positions
      .map((pos) => `mark=at position ${fmt(clamp01(pos))} with {${markCommand}}`)
      .join(",");
    overlays.push(`\\path[postaction=decorate,decoration={markings,${markEntries}}] ${pathExpr};`);
  }
  return overlays.length > 0 ? overlays.join("\n") : null;
}

function sectorMarkSymbolCommandToTikz(
  symbol: AngleMarkSymbol,
  size: number,
  colorExpr: string,
  lineWidthPt: number,
  opacity: number,
  canvasPxToTikzPt?: number
): string | null {
  const count = symbol === "|" ? 1 : symbol === "||" ? 2 : symbol === "|||" ? 3 : 0;
  if (count === 0) return null;
  const tickHalf =
    canvasPxToTikzPt === undefined
      ? Math.max(0.2, size * 2.2)
      : Math.max(1.4, size * 2.2) * canvasPxToTikzPt;
  const gap =
    canvasPxToTikzPt === undefined
      ? Math.max(0.2, size * 0.85)
      : Math.max(1.8, size * 0.85) * canvasPxToTikzPt;
  const offsets = count === 1 ? [0] : count === 2 ? [-gap * 0.5, gap * 0.5] : [-gap, 0, gap];
  const drawOpts = [
    `color=${colorExpr}`,
    `line width=${fmt(Math.max(0.1, lineWidthPt))}pt`,
    canvasPxToTikzPt === undefined ? "line cap=round" : "line cap=butt",
  ];
  if (opacity < 0.999) drawOpts.push(`opacity=${fmt(opacity)}`);
  return offsets
    .map((offset) => {
      return `\\draw[${drawOpts.join(", ")}] (${fmt(offset)}pt,${fmt(-tickHalf)}pt) -- (${fmt(offset)}pt,${fmt(tickHalf)}pt);`;
    })
    .join("");
}

function computePathArrowPairDelta(
  pairSeparationPx: number,
  pathLengthWorld: number | undefined,
  screenPxPerWorld: number | undefined,
  explicitGapPx?: number
): number {
  const requestedGapPx =
    typeof explicitGapPx === "number" && Number.isFinite(explicitGapPx) && explicitGapPx >= 0
      ? explicitGapPx
      : pairSeparationPx;
  const separationPx = Math.max(3, requestedGapPx);
  if (Number.isFinite(pathLengthWorld) && (pathLengthWorld as number) > 1e-9) {
    const pxPerWorld = clampPositive(screenPxPerWorld ?? 80, 1, 20000);
    const pathLengthPx = (pathLengthWorld as number) * pxPerWorld;
    if (pathLengthPx > 1e-9) {
      // Relax cap to 0.4 (40%) to allow larger gaps on short segments.
      return Math.max(0.002, Math.min(0.4, separationPx / pathLengthPx));
    }
  }
  // Fallback when path length is not known at call site.
  return Math.max(0.01, Math.min(0.1, separationPx / 240));
}

function collectPathArrowPositions(
  arrow: Pick<
    NonNullable<SceneModel["circles"][number]["style"]["arrowMark"]>,
    "distribution" | "pos" | "startPos" | "endPos" | "step"
  >,
  fallbackPos: number
): number[] {
  const distribution = arrow.distribution ?? "single";
  if (distribution !== "multi") return [clamp01(arrow.pos ?? fallbackPos)];
  let start = clamp01(arrow.startPos ?? 0.45);
  let end = clamp01(arrow.endPos ?? 0.55);
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  const step = Math.max(0.001, Math.min(1, arrow.step ?? 0.05));
  const out: number[] = [];
  // Compute from start + i*step to avoid cumulative float drift in exported positions.
  for (let i = 0; i < 600; i += 1) {
    const t = start + i * step;
    if (t > end + 1e-9) break;
    out.push(clamp01(roundDecimal(t, 12)));
  }
  if (out.length === 0) out.push(clamp01(arrow.pos ?? fallbackPos));
  return out;
}

function ensureSupportedArrowDirection(
  direction: unknown,
  context: "SegmentArrowMark" | "PathArrowMark"
): asserts direction is "->" | "<-" | "<->" | ">-<" {
  if (direction === "->" || direction === "<-" || direction === "<->" || direction === ">-<") return;
  throw new Error(`Unsupported ${context}: direction=${String(direction)}`);
}

type ResolvedArrowTipName = "Stealth" | "Latex" | "Triangle" | "Dot" | "OpenDot";

function isDotArrowTip(tip: ResolvedArrowTipName): tip is "Dot" | "OpenDot" {
  return tip === "Dot" || tip === "OpenDot";
}

function resolveArrowTipName(
  tip: unknown,
  context: "SegmentArrowMark" | "PathArrowMark"
): ResolvedArrowTipName {
  if (tip === undefined || tip === null || tip === "") return "Stealth";
  if (tip === "Stealth" || tip === "Latex" || tip === "Triangle" || tip === "Dot" || tip === "OpenDot") return tip;
  throw new Error(`Unsupported ${context}: tip=${String(tip)}`);
}

function resolveArrowTipSpec(
  tip: "Stealth" | "Latex" | "Triangle",
  lengthPt: number,
  widthPt: number,
  options?: { bend?: boolean; flex?: boolean; opacity?: number }
): string {
  let extra = "";
  if (options?.flex) {
    extra += ",flex";
  } else if (options?.bend) {
    extra += ",bend";
  }
  if (options?.opacity !== undefined && options.opacity < 0.999) {
    extra += `,opacity=${fmt(options.opacity)}`;
  }
  return `${tip}[length=${fmt(Math.max(0.5, lengthPt))}pt,width=${fmt(Math.max(0.4, widthPt))}pt${extra}]`;
}

function resolveCanvasPxToTikzPt(metrics: PathArrowExportMetrics | undefined): number {
  const value = metrics?.canvasPxToTikzPt;
  if (Number.isFinite(value) && (value as number) > 0) return value as number;
  return FALLBACK_CANVAS_PX_TO_TIKZ_PT;
}

function resolvePathArrowWidthUi(lineWidthPt: unknown): number {
  if (!Number.isFinite(lineWidthPt) || (lineWidthPt as number) <= 0) return DEFAULT_PATH_ARROW_UI;
  return clampPositive((lineWidthPt as number) / PATH_ARROW_WIDTH_UI_FACTOR, 0.2, 12);
}

type PathArrowTipMetricsPx = {
  lengthPx: number;
  widthPx: number;
  halfWidthPx: number;
  notchDistancePx: number;
  lineWidthPx: number;
  pairSeparationPx: number;
};

function resolvePathArrowTipMetricsPx(
  tip: "Stealth" | "Latex" | "Triangle",
  sizeScale: unknown,
  widthUi: number,
  _context: "SegmentArrowMark" | "PathArrowMark",
  arrowLength?: number
): PathArrowTipMetricsPx {
  const numericSizeScale =
    typeof sizeScale === "number" && Number.isFinite(sizeScale) ? sizeScale : DEFAULT_PATH_ARROW_UI;
  const scale = clampPositive(numericSizeScale, 0.2, 8);
  const normalizedWidthUi = Math.max(0.2, Math.min(12, widthUi));
  const baseLength = (arrowLength ?? 1.0) * 16.8;
  const headSize = Math.max(4, baseLength * scale);
  const referenceSize = 24 * scale;
  const widthScale = Math.sqrt(normalizedWidthUi) * (referenceSize / headSize);
  const profile =
    tip === "Latex"
      ? { lengthMul: 0.95, wingMul: 0.34, notchMul: 0 }
      : tip === "Triangle"
        ? { lengthMul: 1.0, wingMul: 0.56, notchMul: 0 }
        : { lengthMul: 1.2, wingMul: 0.44, notchMul: 0.34 };
  const lengthPx = headSize * profile.lengthMul;
  const halfWidthPx = headSize * profile.wingMul * widthScale;
  const widthPx = halfWidthPx * 2;
  const notchDistancePx = lengthPx * (1 - profile.notchMul);
  const pairSeparationPx = Math.max(3, Math.max(headSize * 1.45, headSize * 1.05 * widthScale));
  const lineWidthPx = Math.max(0.8, normalizedWidthUi * 1.35);
  return { lengthPx, widthPx, halfWidthPx, notchDistancePx, lineWidthPx, pairSeparationPx };
}

function pathArrowGlyphCommandToTikz(
  tip: "Stealth" | "Latex" | "Triangle",
  colorExpr: string,
  opacity: number,
  metrics: PathArrowTipMetricsPx,
  pxToPt: number,
  reversed: boolean
): string {
  const len = Math.max(0.5, metrics.lengthPx * pxToPt);
  const wing = Math.max(0.3, metrics.halfWidthPx * pxToPt);
  const notch = Math.max(0, metrics.notchDistancePx * pxToPt);
  const stroke = Math.max(0.1, metrics.lineWidthPx * pxToPt);
  const opacityOpt = opacity < 0.999 ? `,opacity=${fmt(opacity)}` : "";
  const x = (value: number) => fmt(reversed ? value : -value);
  const y = (value: number) => fmt(reversed ? -value : value);

  if (tip === "Latex") {
    return `\\draw[color=${colorExpr},line width=${fmt(stroke)}pt,line cap=round,line join=round${opacityOpt}] (${x(len)}pt,${y(wing)}pt) -- (0pt,0pt) -- (${x(len)}pt,${y(-wing)}pt);`;
  }

  const middle =
    tip === "Stealth"
      ? ` -- (${x(notch)}pt,0pt)`
      : "";
  return `\\fill[color=${colorExpr}${opacityOpt}] (0pt,0pt) -- (${x(len)}pt,${y(wing)}pt)${middle} -- (${x(len)}pt,${y(-wing)}pt) -- cycle;`;
}

function resolvePathDotMarkMetricsPx(
  widthUi: number,
  effectiveScale: number,
  arrowLength: number | undefined
): { radiusPx: number; strokePx: number; pairSeparationPx: number } {
  const widthScale = Math.sqrt(Math.max(0.2, Math.min(12, widthUi)));
  const lengthScale = Math.max(0.2, Math.min(4, arrowLength ?? 1.0));
  const radiusPx = Math.max(1.2, 2.2 * effectiveScale * widthScale * lengthScale);
  const strokePx = Math.max(0.8, 0.8 * effectiveScale * widthScale);
  const pairSeparationPx = Math.max(3, radiusPx * 3.2);
  return { radiusPx, strokePx, pairSeparationPx };
}

function dotMarkCommandToTikz(
  tip: "Dot" | "OpenDot",
  colorExpr: string,
  opacity: number,
  radiusPt: number,
  strokePt: number
): string {
  if (tip === "Dot") {
    const fillOpts = [`color=${colorExpr}`];
    if (opacity < 0.999) fillOpts.push(`opacity=${fmt(opacity)}`);
    return `\\fill[${fillOpts.join(", ")}] (0pt,0pt) circle[radius=${fmt(Math.max(0.3, radiusPt))}pt];`;
  }
  const drawOpts = [`color=${colorExpr}`, `line width=${fmt(Math.max(0.1, strokePt))}pt`];
  if (opacity < 0.999) drawOpts.push(`opacity=${fmt(opacity)}`);
  return `\\draw[${drawOpts.join(", ")}] (0pt,0pt) circle[radius=${fmt(Math.max(0.3, radiusPt))}pt];`;
}

function resolveArrowSourceWidth(_lineWidthPt: unknown, baseStrokeWidth: unknown): number {
  // lineWidthPt is now used for geometry width (Ui), not stroke width.
  // if (Number.isFinite(lineWidthPt) && (lineWidthPt as number) > 0) return lineWidthPt as number;
  if (Number.isFinite(baseStrokeWidth) && (baseStrokeWidth as number) > 0) return baseStrokeWidth as number;
  return 1;
}

function normalizedOpacity(value: unknown): number {
  return Number.isFinite(value) ? clamp01(value as number) : 1;
}

function circlePathExprFromCenterClockwise(center: { x: number; y: number }, radius: number): string {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Unsupported PathArrowMark: circle radius");
  }
  // Canvas full-circle overlay parameterization: t=0 at rightmost point, clockwise.
  const sx = center.x + radius;
  const sy = center.y;
  return `(${fmt(sx)},${fmt(sy)}) arc[start angle=0,end angle=-360,radius=${fmt(radius)}]`;
}

function arcPathExprFromWorld(
  center: { x: number; y: number },
  radius: number,
  startRad: number,
  sweepRad: number,
  startPointExpr?: string
): string {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Unsupported PathArrowMark: arc radius");
  }
  if (!Number.isFinite(startRad) || !Number.isFinite(sweepRad)) {
    throw new Error("Unsupported PathArrowMark: arc angles");
  }
  const startDeg = (startRad * 180) / Math.PI;
  const endDeg = ((startRad + sweepRad) * 180) / Math.PI;
  if (startPointExpr) {
    return `${startPointExpr} arc[start angle=${fmt(startDeg)},end angle=${fmt(endDeg)},radius=${fmt(radius)}]`;
  }
  const sx = center.x + Math.cos(startRad) * radius;
  const sy = center.y + Math.sin(startRad) * radius;
  return `(${fmt(sx)},${fmt(sy)}) arc[start angle=${fmt(startDeg)},end angle=${fmt(endDeg)},radius=${fmt(radius)}]`;
}

function lineStyleToTikz(style: SceneModel["lines"][number]["style"], options: TikzExportOptions): string {
  return lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.dash, style.opacity, options);
}

function circleStrokeStyleToTikz(style: SceneModel["circles"][number]["style"], options: TikzExportOptions): string {
  return lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.strokeDash, style.strokeOpacity, options);
}

function circleFillStyleToTikz(style: SceneModel["circles"][number]["style"]): string | null {
  const fillOpacity = clamp01(style.fillOpacity ?? 0);
  if (fillOpacity <= 0) return null;
  const parts: string[] = [
    `fill=${rgbColorExpr(style.fillColor ?? style.strokeColor)}`,
    `fill opacity=${fmt(fillOpacity)}`,
  ];
  const pattern = readPatternOption(style);
  if (pattern) {
    parts.push(pattern.patternExpr);
    if (pattern.patternColorExpr) parts.push(pattern.patternColorExpr);
  }
  return parts.join(", ");
}

function ellipseRotationStyleToTikz(center: { x: number; y: number }, rotationRad: number): string {
  const rotationDeg = (rotationRad * 180) / Math.PI;
  if (!Number.isFinite(rotationDeg) || Math.abs(rotationDeg) <= 1e-9) return "";
  return `rotate around={${fmt(rotationDeg)}:(${fmt(center.x)},${fmt(center.y)})}`;
}

function polygonStrokeStyleToTikz(style: SceneModel["polygons"][number]["style"], options: TikzExportOptions): string {
  return lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.strokeDash, style.strokeOpacity, options);
}

function polygonFillStyleToTikz(style: SceneModel["polygons"][number]["style"]): string | null {
  const fillOpacity = clamp01(style.fillOpacity ?? 0);
  if (fillOpacity <= 0) return null;
  const parts: string[] = [
    `fill=${rgbColorExpr(style.fillColor ?? style.strokeColor)}`,
    `fill opacity=${fmt(fillOpacity)}`,
  ];
  const pattern = readPatternOption(style);
  if (pattern) {
    parts.push(pattern.patternExpr);
    if (pattern.patternColorExpr) parts.push(pattern.patternColorExpr);
  }
  return parts.join(", ");
}

function angleMarkStyleToTikz(
  style: SceneModel["angles"][number]["style"],
  isRightAngle: boolean,
  options: TikzExportOptions,
  markKind: "arc" | "rightSquare" | "rightArcDot",
  arcMarkOverride?: {
    arcMultiplicity?: 1 | 2 | 3;
    markSymbol?: AngleMarkSymbol;
    markPos?: number;
    markSize?: number;
    markColor?: string;
    arcLayerOffset?: number;
  }
): string {
  if (!Number.isFinite(style.arcRadius) || style.arcRadius <= 0) {
    throw new Error("Unsupported Angle style: arcRadius must be > 0.");
  }
  const opacity = clamp01(style.strokeOpacity);
  const isRightArcDot = isRightAngle && markKind === "rightArcDot";
  const sizeScale = isRightArcDot
    ? clampPositive(options.angleArcSizeScale ?? 1, 0.01, 100)
    : isRightAngle
      ? clampPositive(options.rightAngleSizeScale ?? 1, 0.01, 100)
      : clampPositive(options.angleArcSizeScale ?? 1, 0.01, 100);
  const baseSizeWorld = isRightArcDot
    ? nonSectorAngleRadiusWorldFromStyle(style, options)
    : isRightAngle
      ? rightAngleMarkSizeWorldFromStyle(style, options)
      : nonSectorAngleRadiusWorldFromStyle(style, options);
  const arcLayerOffset =
    !isRightAngle && markKind === "arc"
      ? Math.max(0, Math.floor(Number(arcMarkOverride?.arcLayerOffset ?? 0)))
      : 0;
  const layeredSizeWorld = baseSizeWorld + arcLayerOffset * angleArcLayerGapWorld(options);
  const opts: string[] = [
    `color=${rgbColorExpr(style.strokeColor)}`,
    `line width=${fmt(strokeWidthToTikzPt(style.strokeWidth, options))}pt`,
    `size=${fmt(layeredSizeWorld * sizeScale)}`,
  ];
  if (isRightArcDot) {
    opts.push("german");
    const exportedSize = baseSizeWorld * sizeScale;
    // Keep german inner dot visually proportional to the right-arc size.
    // Calibrated so size≈0.83 maps to dotsize≈3, matching expected tkz look.
    const dotSize = Math.max(1, Math.min(6, exportedSize * 3.6));
    opts.push(`dotsize=${fmt(dotSize)}`);
  }
  if (!isRightAngle && markKind === "arc") {
    const arcMultiplicity = normalizeArcMultiplicity(arcMarkOverride?.arcMultiplicity ?? style.arcMultiplicity ?? 1);
    const arcExpr = arcMultiplicity === 3 ? "lll" : arcMultiplicity === 2 ? "ll" : "l";
    opts.push(`arc=${arcExpr}`);
    const markSymbol = arcMarkOverride?.markSymbol ?? style.markSymbol ?? "none";
    if (markSymbol !== "none" && markSymbol !== "|" && markSymbol !== "||" && markSymbol !== "|||") {
      throw new Error(`Unsupported construction: angle mark style symbol ${String(markSymbol)}`);
    }
    opts.push(`mark=${markSymbol}`);
    const mkPosRaw = arcMarkOverride?.markPos;
    const mkPos = Number.isFinite(mkPosRaw) ? Math.max(0, Math.min(1, mkPosRaw as number)) : Number.isFinite(style.markPos) ? Math.max(0, Math.min(1, style.markPos)) : 0.5;
    const mkSizeRaw = arcMarkOverride?.markSize;
    const mkSizeBase = Number.isFinite(mkSizeRaw) ? Math.max(0.1, mkSizeRaw as number) : Number.isFinite(style.markSize) ? Math.max(0.1, style.markSize) : 4;
    const mkSizeScale = clampPositive(options.angleMarkSizeScale ?? 1, 0.01, 100);
    const mkSize = mkSizeBase * mkSizeScale;
    const mkColorSource = arcMarkOverride?.markColor ?? style.markColor;
    const mkColor = mkColorSource && mkColorSource.trim() ? mkColorSource : style.strokeColor;
    opts.push(`mkpos=${fmt(mkPos)}`);
    opts.push(`mksize=${fmt(mkSize)}`);
    opts.push(`mkcolor=${rgbColorExpr(mkColor)}`);
  }
  if (opacity < 0.999) opts.push(`opacity=${fmt(opacity)}`);
  return opts.join(", ");
}

function angleArcLayerGapWorld(options: TikzExportOptions): number {
  const pxPerWorld = Number.isFinite(options.screenPxPerWorld) && (options.screenPxPerWorld as number) > 1e-9
    ? (options.screenPxPerWorld as number)
    : 80;
  return 6 / pxPerWorld;
}

function normalizeArcMultiplicity(value: unknown): 1 | 2 | 3 {
  const n = Number(value);
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

function resolveAngleMarkKind(
  markStyle: SceneModel["angles"][number]["style"]["markStyle"],
  isRightExact: boolean
): "none" | "arc" | "rightSquare" | "rightArcDot" {
  const normalized = markStyle === "right" ? "rightSquare" : markStyle;
  if (
    normalized !== "none" &&
    normalized !== "arc" &&
    normalized !== "rightSquare" &&
    normalized !== "rightArcDot"
  ) {
    throw new Error(`Unsupported construction: angle mark style ${String(markStyle)}`);
  }
  if (normalized === "none") return "none";
  if (!isRightExact) {
    // Graceful fallback: if a right-only style is stored on a non-right angle
    // (legacy/default drift), export as standard arc mark instead of failing export.
    return "arc";
  }
  if (normalized === "rightArcDot") return "rightArcDot";
  if (normalized === "rightSquare") return "rightSquare";
  return "rightSquare";
}

const ANGLE_CANVAS_STROKE_SCALE = 3.25 / 1.8;
const LABEL_GLOW_WIDTH_PX = 3.5;

function plainAngleStrokeStyleToTikz(
  style: SceneModel["angles"][number]["style"],
  options: TikzExportOptions,
  dashPx?: readonly [number, number]
): string {
  const plainPxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    FALLBACK_CANVAS_PX_TO_TIKZ_PT;
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const widthPt = Math.max(
    0.1,
    style.strokeWidth * ANGLE_CANVAS_STROKE_SCALE * lineScale * plainPxToPt
  );
  const out = [
    `color=${rgbColorExpr(style.strokeColor)}`,
    `line width=${fmt(widthPt)}pt`,
    "line cap=butt",
    "line join=miter",
  ];
  if (dashPx) {
    out.push(
      `dash pattern=on ${fmt(dashPx[0] * lineScale * plainPxToPt)}pt off ${fmt(
        dashPx[1] * lineScale * plainPxToPt
      )}pt`
    );
  }
  const opacity = normalizedOpacity(style.strokeOpacity);
  if (opacity < 0.999) out.push(`opacity=${fmt(opacity)}`);
  return out.join(", ");
}

function plainAngleFillStyleToTikz(
  style: SceneModel["angles"][number]["style"]
): string {
  return sectorFillStyleToTikz(style);
}

function plainAngleRightGeometry(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  sizeWorld: number
): {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  p3: { x: number; y: number };
  u: { x: number; y: number };
  v: { x: number; y: number };
} | null {
  const adx = a.x - b.x;
  const ady = a.y - b.y;
  const cdx = c.x - b.x;
  const cdy = c.y - b.y;
  const alen = Math.hypot(adx, ady);
  const clen = Math.hypot(cdx, cdy);
  if (alen <= 1e-12 || clen <= 1e-12) return null;
  const u = { x: adx / alen, y: ady / alen };
  const v = { x: cdx / clen, y: cdy / clen };
  const p1 = { x: b.x + u.x * sizeWorld, y: b.y + u.y * sizeWorld };
  const p3 = { x: b.x + v.x * sizeWorld, y: b.y + v.y * sizeWorld };
  const p2 = { x: p1.x + v.x * sizeWorld, y: p1.y + v.y * sizeWorld };
  return { p1, p2, p3, u, v };
}

function plainWorldPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point) => `(${fmt(point.x)},${fmt(point.y)})`)
    .join(" -- ");
}

function plainAngleBarMarksToTikz(
  mark: ReturnType<typeof resolveAngleMarks>[number],
  style: SceneModel["angles"][number]["style"],
  center: { x: number; y: number },
  startRad: number,
  sweepRad: number,
  radiusWorld: number,
  radiusPx: number,
  options: TikzExportOptions,
  collectDistributedPositions: boolean
): string[] {
  const count =
    mark.markSymbol === "|"
      ? 1
      : mark.markSymbol === "||"
        ? 2
        : mark.markSymbol === "|||"
          ? 3
          : 0;
  if (count === 0) return [];
  const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  const plainPxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    FALLBACK_CANVAS_PX_TO_TIKZ_PT;
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const markSizeScale = clampPositive(options.angleMarkSizeScale ?? 1, 0.01, 100);
  const sizePx =
    (Number.isFinite(mark.markSize) ? Math.max(0.2, mark.markSize) : 1.2) *
    markSizeScale;
  const tickHalfPx = Math.max(1.4, sizePx * 2.2);
  const gapPx = Math.max(1.8, sizePx * 0.85);
  const baseStep = Math.max(0.01, Math.min(0.2, gapPx / Math.max(1, radiusPx)));
  const lineWidthPt =
    Math.max(
      0.5,
      style.strokeWidth * ANGLE_CANVAS_STROKE_SCALE * lineScale
    ) * plainPxToPt;
  const color = rgbColorExpr(
    mark.markColor ?? style.markColor ?? style.strokeColor
  );
  const drawOptions = [
    `color=${color}`,
    `line width=${fmt(Math.max(0.1, lineWidthPt))}pt`,
    "line cap=butt",
  ];
  const opacity = normalizedOpacity(style.strokeOpacity);
  if (opacity < 0.999) drawOptions.push(`opacity=${fmt(opacity)}`);
  const positions = collectDistributedPositions
    ? collectAngleMarkPositions(mark, 0.5)
    : [clamp01(mark.markPos)];
  const out: string[] = [];
  for (const pos of positions) {
    const baseAngle = startRad + sweepRad * clamp01(pos);
    for (let i = 0; i < count; i += 1) {
      // Canvas lays bars along the screen-space arc. Reversing Y reverses that
      // angular offset in world coordinates.
      const phi =
        baseAngle - (i - (count - 1) * 0.5) * baseStep;
      const nx = Math.cos(phi);
      const ny = Math.sin(phi);
      const cx = center.x + nx * radiusWorld;
      const cy = center.y + ny * radiusWorld;
      const halfWorld = tickHalfPx / pxPerWorld;
      out.push(
        `\\draw[${drawOptions.join(", ")}] (${fmt(
          cx - nx * halfWorld
        )},${fmt(cy - ny * halfWorld)}) -- (${fmt(
          cx + nx * halfWorld
        )},${fmt(cy + ny * halfWorld)});`
      );
    }
  }
  return out;
}

function plainNonSectorAngleCommands(
  angle: SceneModel["angles"][number],
  aWorld: { x: number; y: number },
  bWorld: { x: number; y: number },
  cWorld: { x: number; y: number },
  theta: number,
  rightStatus: AngleRightStatus,
  options: TikzExportOptions,
  resolveMultiArrowStyleName?: (signature: string) => string
): TikzCommand[] {
  const style = angle.style;
  const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  const plainPxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    FALLBACK_CANVAS_PX_TO_TIKZ_PT;
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const arcSizeScale = clampPositive(
    options.angleArcSizeScale ?? 1,
    0.01,
    100
  );
  const radiusPx =
    Math.max(18, Math.min(120, style.arcRadius * 34)) * arcSizeScale;
  const radiusWorld = radiusPx / pxPerWorld;
  const startRad = Math.atan2(
    aWorld.y - bWorld.y,
    aWorld.x - bWorld.x
  );
  const arcPath = arcPathExprFromWorld(
    bWorld,
    radiusWorld,
    startRad,
    theta
  );
  const rightLike = rightStatus !== "none";
  const rightSolid =
    rightStatus === "exact" ||
    (rightStatus === "approx" && Boolean(style.promoteToSolid));
  const markKind = resolveAngleMarkKind(style.markStyle, rightLike);
  const mappedStrokePx =
    style.strokeWidth * ANGLE_CANVAS_STROKE_SCALE * lineScale;
  const rightSizePx =
    Math.max(7, radiusPx * 0.34 + mappedStrokePx * 0.3) *
    clampPositive(options.rightAngleSizeScale ?? 1, 0.01, 100);
  const rightGeometry = plainAngleRightGeometry(
    aWorld,
    bWorld,
    cWorld,
    rightSizePx / pxPerWorld
  );
  const approximateDash =
    rightStatus === "approx" &&
    !rightSolid &&
    (markKind === "rightSquare" || markKind === "rightArcDot")
      ? ([6, 4] as const)
      : undefined;
  const strokeStyle = plainAngleStrokeStyleToTikz(
    style,
    options,
    approximateDash
  );
  const commands: TikzCommand[] = [];

  if (style.fillEnabled && style.fillOpacity > 0) {
    const fillStyle = plainAngleFillStyleToTikz(style);
    if (rightLike && markKind === "rightSquare" && rightGeometry) {
      commands.push({
        kind: "DrawRaw",
        tex: `\\fill[${fillStyle}] ${plainWorldPath([
          bWorld,
          rightGeometry.p1,
          rightGeometry.p2,
          rightGeometry.p3,
        ])} -- cycle;`,
      });
    } else {
      commands.push({
        kind: "DrawRaw",
        tex: `\\fill[${fillStyle}] (${fmt(bWorld.x)},${fmt(
          bWorld.y
        )}) -- ${arcPath} -- cycle;`,
      });
    }
  }

  if (markKind === "rightSquare" && rightGeometry) {
    commands.push({
      kind: "DrawRaw",
      tex: `\\draw[${strokeStyle}] ${plainWorldPath([
        rightGeometry.p1,
        rightGeometry.p2,
        rightGeometry.p3,
      ])};`,
    });
  } else if (markKind === "rightArcDot") {
    commands.push({
      kind: "DrawRaw",
      tex: `\\draw[${strokeStyle}] ${arcPath};`,
    });
    if (rightGeometry) {
      const dotCenter = {
        x:
          bWorld.x +
          (rightGeometry.u.x + rightGeometry.v.x) *
            (rightSizePx / pxPerWorld) *
            0.55,
        y:
          bWorld.y +
          (rightGeometry.u.y + rightGeometry.v.y) *
            (rightSizePx / pxPerWorld) *
            0.55,
      };
      const dotRadiusWorld =
        Math.max(1.8, Math.min(4.5, rightSizePx * 0.18)) /
        pxPerWorld;
      const dotOpts = [`fill=${rgbColorExpr(style.strokeColor)}`];
      const opacity = normalizedOpacity(style.strokeOpacity);
      if (opacity < 0.999) {
        dotOpts.push(`fill opacity=${fmt(opacity)}`);
      }
      commands.push({
        kind: "DrawRaw",
        tex: `\\fill[${dotOpts.join(", ")}] (${fmt(
          dotCenter.x
        )},${fmt(dotCenter.y)}) circle[radius=${fmt(
          dotRadiusWorld
        )}];`,
      });
    }
  } else if (markKind === "arc") {
    const marks = resolveAngleMarks(style);
    let arcLayerOffset = 0;
    for (const mark of marks) {
      for (let layer = 0; layer < mark.arcMultiplicity; layer += 1) {
        const layerRadiusPx =
          radiusPx + (arcLayerOffset + layer) * 6;
        commands.push({
          kind: "DrawRaw",
          tex: `\\draw[${strokeStyle}] ${arcPathExprFromWorld(
            bWorld,
            layerRadiusPx / pxPerWorld,
            startRad,
            theta
          )};`,
        });
      }
      const markRadiusPx =
        radiusPx +
        (arcLayerOffset + (mark.arcMultiplicity - 1) * 0.5) * 6;
      const marksTex = plainAngleBarMarksToTikz(
        mark,
        style,
        bWorld,
        startRad,
        theta,
        markRadiusPx / pxPerWorld,
        markRadiusPx,
        options,
        false
      );
      for (const tex of marksTex) {
        commands.push({ kind: "DrawRaw", tex });
      }
      arcLayerOffset += mark.arcMultiplicity;
    }
  }

  if (markKind === "arc" || markKind === "rightArcDot") {
    const arrowOverlay = pathArrowOverlayToTikz(
      style.arcArrowMarks ?? style.arcArrowMark,
      arcPath,
      {
        strokeColor: style.strokeColor,
        strokeWidth: mappedStrokePx,
        opacity: style.strokeOpacity,
      },
      style.markPos ?? 0.5,
      {
        pathLengthWorld: Math.abs(theta) * radiusWorld,
        screenPxPerWorld: pxPerWorld,
        canvasPxToTikzPt: plainPxToPt,
        canvasExact: true,
      },
      {
        center: bWorld,
        radius: radiusWorld,
        startRad,
        sweepRad: theta,
      },
      { flex: true },
      options.pathDotMarkSizeScale,
      resolveMultiArrowStyleName
    );
    if (arrowOverlay) {
      commands.push({ kind: "DrawRaw", tex: arrowOverlay });
    }
  }
  return commands;
}

function plainAngleLabelCommand(
  angle: SceneModel["angles"][number],
  text: string,
  options: TikzExportOptions
): Extract<TikzCommand, { kind: "LabelAt" }> | null {
  if (!isFiniteLabelPosWorld(angle.style.labelPosWorld)) return null;
  const plainPxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    FALLBACK_CANVAS_PX_TO_TIKZ_PT;
  const fontScale = clampPositive(
    options.angleLabelFontScale ?? 1,
    0.01,
    100
  );
  const fontPx =
    Math.max(8, angle.style.textSize * (25 / 16)) *
    0.95 *
    fontScale;
  const fontPt = fontPx * plainPxToPt;
  return {
    kind: "LabelAt",
    x: angle.style.labelPosWorld.x,
    y: angle.style.labelPosWorld.y,
    text,
    options: [
      "anchor=north west",
      "inner sep=0pt",
      `text=${rgbColorExpr(angle.style.textColor)}`,
      `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(
        fontPt * 1.2
      )}pt}\\selectfont`,
    ].join(", "),
    useGlow:
      (options.labelGlow ?? true) && Boolean(angle.style.labelGlow),
    plainGlow: {
      widthPt:
        LABEL_GLOW_WIDTH_PX *
        plainPxToPt *
        clampPositive(options.trueGlobalScale ?? 1, 0.05, 10) *
        clampPositive(options.labelHaloScale ?? 1, 0.05, 10),
      color: options.labelHaloColor
        ? rgbColorExpr(options.labelHaloColor)
        : undefined,
    },
  };
}

function angleFillStyleToTikz(style: SceneModel["angles"][number]["style"], options: TikzExportOptions): string {
  if (!Number.isFinite(style.fillOpacity)) {
    throw new Error("Unsupported Angle style: fillOpacity is not finite.");
  }
  if (!Number.isFinite(style.arcRadius) || style.arcRadius <= 0) {
    throw new Error("Unsupported Angle style: arcRadius must be > 0.");
  }
  const sizeScale = clampPositive(options.angleArcSizeScale ?? 1, 0.01, 100);
  const opts: string[] = [
    `fill=${rgbColorExpr(style.fillColor)}`,
    `fill opacity=${fmt(clamp01(style.fillOpacity))}`,
    `size=${fmt(nonSectorAngleRadiusWorldFromStyle(style, options) * sizeScale)}`,
  ];
  return opts.join(", ");
}

function rightSquareFillStyleToTikz(style: SceneModel["angles"][number]["style"]): string {
  if (!Number.isFinite(style.fillOpacity)) {
    throw new Error("Unsupported Angle style: fillOpacity is not finite.");
  }
  const opacity = clamp01(style.fillOpacity);
  if (opacity <= 0) return "";
  return [`fill=${rgbColorExpr(style.fillColor)}`, `fill opacity=${fmt(opacity)}`].join(", ");
}

function angleLabelStyleToTikz(
  angle: SceneModel["angles"][number],
  aWorld: { x: number; y: number },
  vertexWorld: { x: number; y: number },
  cWorld: { x: number; y: number },
  options: TikzExportOptions,
  rightLike: boolean
): string {
  let dist = Number.NaN;
  let angleRad = Number.NaN;
  let labelVectorAngleRad = Number.NaN;
  if (isFiniteLabelPosWorld(angle.style.labelPosWorld)) {
    const dx = angle.style.labelPosWorld.x - vertexWorld.x;
    const dy = angle.style.labelPosWorld.y - vertexWorld.y;
    dist = Math.hypot(dx, dy);
    angleRad = Math.atan2(dy, dx);
    labelVectorAngleRad = angleRad;
  }
  if (!Number.isFinite(dist) || dist <= 1e-9 || !Number.isFinite(angleRad)) {
    const bisectorRad = angleBisectorRad(aWorld, vertexWorld, cWorld);
    if (bisectorRad === null || !Number.isFinite(bisectorRad)) {
      throw new Error("Unsupported Angle style: labelPosWorld is invalid.");
    }
    angleRad = bisectorRad;
    dist = defaultAngleLabelDist(angle.style.arcRadius, rightLike);
  }
  if (angle.kind !== "sector") {
    const bisectorRad = angleBisectorRad(aWorld, vertexWorld, cWorld);
    if (bisectorRad !== null && Number.isFinite(bisectorRad)) {
      angleRad = bisectorRad;
    }
    const labelRadiusWorld = nonSectorAngleRadiusWorldFromStyle(angle.style, options);
    if (Number.isFinite(labelRadiusWorld) && labelRadiusWorld > 1e-9) {
      if (labelRadiusWorld < 0.24) {
        const labelVectorLeadsBisector =
          Number.isFinite(labelVectorAngleRad) &&
          Number.isFinite(angleRad) &&
          shortestAngleDiffRad(labelVectorAngleRad, angleRad) > (10 * Math.PI) / 180;
        dist = labelRadiusWorld * (labelVectorLeadsBisector ? 0.76 : 0.53);
      } else if (dist >= labelRadiusWorld * 0.65) {
        const sweepRad = computeOrientedAngleRad(aWorld, vertexWorld, cWorld);
        const sweepDeg = sweepRad === null ? Number.NaN : (sweepRad * 180) / Math.PI;
        const labelRadiusRatio = Number.isFinite(sweepDeg) && sweepDeg <= 20 ? 0.98 : 0.867;
        dist = Math.max(dist, labelRadiusWorld * labelRadiusRatio);
      }
    }
  }
  const angleDeg = (angleRad * 180) / Math.PI;
  const labelFontScale = clampPositive(options.angleLabelFontScale ?? 1, 0.01, 100);
  const reconstructiblePxToPt = resolvedReconstructibleCanvasStylePxToTikzPt(options);
  const fontPt = reconstructiblePxToPt === null
    ? Math.max(6, Math.min(72, angle.style.textSize * labelFontScale))
    : Math.max(
        0.5,
        Math.max(8, angle.style.textSize * (25 / 16)) *
          0.95 *
          reconstructiblePxToPt *
          labelFontScale
      );
  // Keep angle-label baseline spacing at 3/4 of the previous "original" export
  // profile (12pt -> 16.2pt), so 9pt maps to 12.15pt.
  const lineHeightPt = Math.max(6, fontPt * 1.35);
  return [
    `dist=${fmt(roundDecimal(dist, 2))}`,
    `angle=${fmt(angleDeg)}`,
    `text=${rgbColorExpr(angle.style.textColor)}`,
    `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(lineHeightPt)}pt}\\selectfont`,
  ].join(", ");
}

function sectorDrawStyleToTikz(style: SceneModel["angles"][number]["style"], options: TikzExportOptions): string {
  if (options.drawLayerBackend === "plain") {
    const dash =
      style.strokeDash === "dashed"
        ? ([7, 5] as const)
        : style.strokeDash === "dotted"
          ? ([2, 4] as const)
          : undefined;
    return plainAngleStrokeStyleToTikz(style, options, dash);
  }
  return lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.strokeDash ?? "solid", style.strokeOpacity, options);
}

function nonSectorAngleRadiusWorldFromStyle(
  style: SceneModel["angles"][number]["style"],
  options: TikzExportOptions
): number {
  const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  // Keep exporter consistent with canvas non-sector angle rendering:
  // canvas radiusPx = clamp(arcRadius * 34, 18, 120).
  const radiusPx = Math.max(18, Math.min(120, style.arcRadius * 34));
  return Math.max(1e-6, radiusPx / pxPerWorld);
}

function rightAngleMarkSizeWorldFromStyle(
  style: SceneModel["angles"][number]["style"],
  options: TikzExportOptions
): number {
  const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  const radiusPx = Math.max(18, Math.min(120, style.arcRadius * 34));
  const strokePx = Math.max(0.1, style.strokeWidth);
  // Keep exporter consistent with canvas right-angle square sizing:
  // sizePx = max(7, radiusPx * 0.34 + strokePx * 0.3).
  const sizePx = Math.max(7, radiusPx * 0.34 + strokePx * 0.3);
  return Math.max(1e-6, sizePx / pxPerWorld);
}

function sectorFillStyleToTikz(style: SceneModel["angles"][number]["style"]): string {
  if (!Number.isFinite(style.fillOpacity)) {
    throw new Error("Unsupported Angle style: fillOpacity is not finite.");
  }
  const opts: string[] = [`fill=${rgbColorExpr(style.fillColor)}`, `fill opacity=${fmt(clamp01(style.fillOpacity))}`];
  const pattern = readPatternOption(style);
  if (pattern) {
    opts.push(pattern.patternExpr);
    if (pattern.patternColorExpr) opts.push(pattern.patternColorExpr);
  }
  return opts.join(", ");
}

function readPatternOption(style: unknown): { patternExpr: string; patternColorExpr?: string } | null {
  if (!style || typeof style !== "object") return null;
  const raw = style as Record<string, unknown>;
  const patternRaw = raw.pattern;
  if (patternRaw === undefined || patternRaw === null || patternRaw === "") return null;
  if (typeof patternRaw !== "string") {
    throw new Error("Unsupported style option: pattern");
  }
  const pattern = patternRaw.trim();
  if (!pattern) return null;
  const patternExpr = `pattern=${pattern}`;

  const patternColorRaw = raw.patternColor;
  if (patternColorRaw === undefined || patternColorRaw === null || patternColorRaw === "") {
    const fallbackFillColor = typeof raw.fillColor === "string" && raw.fillColor.trim() ? raw.fillColor : undefined;
    return fallbackFillColor
      ? { patternExpr, patternColorExpr: `pattern color=${rgbColorExpr(fallbackFillColor)}` }
      : { patternExpr };
  }
  if (typeof patternColorRaw !== "string") {
    throw new Error("Unsupported style option: patternColor");
  }
  return { patternExpr, patternColorExpr: `pattern color=${rgbColorExpr(patternColorRaw)}` };
}

function lineLikeStyleToTikz(
  strokeColor: string,
  strokeWidth: number,
  dash: "solid" | "dashed" | "dotted",
  opacity: number,
  options: TikzExportOptions
): string {
  const widthPt = strokeWidthToTikzPt(strokeWidth, options);
  const canvasStylePxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    resolvedReconstructibleCanvasStylePxToTikzPt(options);
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const opts: string[] = [
    `color=${rgbColorExpr(strokeColor)}`,
    `line width=${fmt(widthPt)}pt`,
  ];
  if (canvasStylePxToPt !== null && dash !== "dotted") {
    // Canvas applyStrokeDash uses butt caps for solid and dashed geometry.
    opts.push("line cap=butt");
  }
  if (dash === "dashed") {
    const onPt =
      canvasStylePxToPt === null
        ? Math.max(1.5, Math.min(12, 3 * widthPt))
        : 8 * lineScale * canvasStylePxToPt;
    const offPt =
      canvasStylePxToPt === null
        ? Math.max(2, Math.min(16, 4 * widthPt))
        : 6 * lineScale * canvasStylePxToPt;
    opts.push(`dash pattern=on ${fmt(onPt)}pt off ${fmt(offPt)}pt`);
  }
  if (dash === "dotted") {
    // Use explicit round-cap dots so thick dotted strokes stay dotted (not tiny dashes).
    const offPt =
      canvasStylePxToPt === null
        ? Math.max(1.8, Math.min(20, 3.2 * widthPt))
        : Math.max(4, strokeWidth * 2.4) * lineScale * canvasStylePxToPt;
    opts.push("line cap=round");
    opts.push(`dash pattern=on 0pt off ${fmt(offPt)}pt`);
  }
  if (opacity < 0.999) opts.push(`opacity=${fmt(clamp01(opacity))}`);
  return opts.join(", ");
}

function strokeWidthToTikzPt(strokeWidth: number, options: TikzExportOptions): number {
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const pxToPt =
    resolvedPlainCanvasPxToTikzPt(options) ??
    resolvedReconstructibleCanvasStylePxToTikzPt(options) ??
    TIKZ_EXPORT_CALIBRATION.pointConversion.matchCanvasPxToPt;
  return Math.max(0.1, strokeWidth * lineScale * pxToPt);
}

function resolvedPlainCanvasPxToTikzPt(options: TikzExportOptions): number | null {
  if (options.drawLayerBackend !== "plain") return null;
  const value = (options as ResolvedTikzExportOptions).resolvedCanvasStylePxToTikzPt;
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : null;
}

function resolvedReconstructibleCanvasStylePxToTikzPt(options: TikzExportOptions): number | null {
  if (options.drawLayerBackend === "plain") return null;
  const value = (options as ResolvedTikzExportOptions).resolvedCanvasStylePxToTikzPt;
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : null;
}

function crossPlusOverlayPathPicture(draw: string, lineWidthPt: number, strokeOpacity: number): string {
  const drawOpts = [
    `draw=${draw}`,
    `line width=${fmt(lineWidthPt)}pt`,
  ];
  if (strokeOpacity < 0.999) drawOpts.push(`draw opacity=${fmt(clamp01(strokeOpacity))}`);
  return [
    "path picture={",
    `\\draw[${drawOpts.join(", ")}]`,
    "(path picture bounding box.west)--(path picture bounding box.east)",
    "(path picture bounding box.south)--(path picture bounding box.north);",
    "}",
  ].join("");
}

function mapPointShape(shape: ScenePoint["style"]["shape"]):
  | { kind: "dot" }
  | { kind: "lineGlyph"; shapeName: "cross" | "cross out"; overlayPlus: boolean }
  | { kind: "filled"; shapeName: string } {
  switch (shape) {
    case "square":
      return { kind: "filled", shapeName: "rectangle" };
    case "diamond":
      return { kind: "filled", shapeName: "diamond" };
    case "triUp":
      return { kind: "filled", shapeName: "regular polygon, regular polygon sides=3" };
    case "triDown":
      return { kind: "filled", shapeName: "regular polygon, regular polygon sides=3, shape border rotate=180" };
    case "plus":
      // tkz-euclide declares shape=cross (plus marker).
      return { kind: "lineGlyph", shapeName: "cross", overlayPlus: false };
    case "x":
      // TikZ shapes.misc provides shape=cross out (diagonal X marker).
      return { kind: "lineGlyph", shapeName: "cross out", overlayPlus: false };
    case "cross":
      // App "cross" is plus + X.
      return { kind: "lineGlyph", shapeName: "cross out", overlayPlus: true };
    case "dot":
      return { kind: "dot" };
    case "circle":
      return { kind: "filled", shapeName: "circle" };
  }
}

function pointLabelOptionsToTikz(point: ScenePoint, placement: LabelPlacement | null, exportOptions: TikzExportOptions): string {
  const opts: string[] = [];
  const xShiftPt = placement?.xShiftPt ?? 12;
  const yShiftPt = placement?.yShiftPt ?? 12;
  const rawXShiftPt = placement?.rawXShiftPt ?? xShiftPt;
  const rawYShiftPt = placement?.rawYShiftPt ?? yShiftPt;
  const canvasStylePxToPt = resolvedReconstructibleCanvasStylePxToTikzPt(exportOptions);
  if (canvasStylePxToPt !== null) {
    const labelOffsetScale = clampPositive(
      exportOptions.pointLabelOffsetScale ?? 1,
      0.05,
      10
    );
    const offsetXPx = placement?.offsetXPx ?? point.style.labelOffsetPx.x;
    const offsetYPx = placement?.offsetYPx ?? point.style.labelOffsetPx.y;
    opts.push(point.showLabel === "caption" ? "anchor=north west" : "anchor=base west");
    opts.push("inner sep=0pt");
    opts.push(`xshift=${fmt(offsetXPx * canvasStylePxToPt * labelOffsetScale)}pt`);
    opts.push(`yshift=${fmt(-offsetYPx * canvasStylePxToPt * labelOffsetScale)}pt`);
    const canvasKatexScale = point.showLabel === "caption" ? 0.95 : 1;
    const fontPt = Math.max(
      0.5,
      point.style.labelFontPx * canvasKatexScale * canvasStylePxToPt
    );
    const baselinePt = Math.max(fontPt, fontPt * 1.2);
    opts.push(
      `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(baselinePt)}pt}\\selectfont`
    );
  } else {
    // Keep quadrant stable from user drag offset, so labels don't flip due to
    // collision-spread/min-clear post-processing.
    opts.push(directionOptionFromShift(rawXShiftPt, rawYShiftPt));
  }
  return opts.join(", ");
}

function directionOptionFromShift(xShiftPt: number, yShiftPt: number): string {
  const ax = Math.abs(xShiftPt);
  const ay = Math.abs(yShiftPt);
  const eps = 1e-4;
  if (ax < eps && ay < eps) return "above right";
  if (ax < ay * 0.35) return yShiftPt >= 0 ? "above" : "below";
  if (ay < ax * 0.35) return xShiftPt >= 0 ? "right" : "left";
  if (xShiftPt >= 0 && yShiftPt >= 0) return "above right";
  if (xShiftPt < 0 && yShiftPt >= 0) return "above left";
  if (xShiftPt >= 0 && yShiftPt < 0) return "below right";
  return "below left";
}

function semanticLabelPositionOptionForDirection(
  direction: string,
  horizontalEm: number,
  verticalEm: number
): string {
  const horizontal = `${fmt(horizontalEm)}em`;
  const vertical = `${fmt(verticalEm)}em`;
  if (direction === "above" || direction === "below") {
    return `${direction}=${vertical}`;
  }
  if (direction === "left" || direction === "right") {
    return `${direction}=${horizontal}`;
  }
  // TikZ positioning treats an unbraced `distance and distance` value as a
  // single PGF math expression, where `and` becomes an unknown operator.
  return `${direction}={${vertical} and ${horizontal}}`;
}

/**
 * Canvas point names use a baseline-left text origin; KaTeX captions use a
 * top-left DOM origin. TikZ positioning distances instead measure the empty gap
 * from the point to the nearest edge of the node. Convert between those
 * meanings so the label's own width or height is not counted as whitespace.
 */
function semanticPointLabelPositionOption(
  text: string,
  offsetXPx: number,
  offsetYPx: number,
  labelFontPx: number,
  canvasOrigin: "baseline-left" | "top-left"
): string {
  const fontPx = Math.max(1, labelFontPx);
  const direction = directionOptionFromShift(offsetXPx, -offsetYPx);
  const metrics = estimateCanvasLabelTextBoxPx(text, fontPx);

  let horizontalGapPx = Math.abs(offsetXPx);
  let verticalGapPx = Math.abs(offsetYPx);

  if (direction.includes("left")) {
    horizontalGapPx = Math.max(0, -offsetXPx - metrics.widthPx);
  } else if (direction.includes("right")) {
    horizontalGapPx = Math.max(0, offsetXPx);
  }

  if (direction.includes("above")) {
    verticalGapPx = Math.max(
      0,
      -offsetYPx -
        (canvasOrigin === "baseline-left" ? metrics.descentPx : metrics.heightPx)
    );
  } else if (direction.includes("below")) {
    verticalGapPx = Math.max(
      0,
      offsetYPx - (canvasOrigin === "baseline-left" ? metrics.ascentPx : 0)
    );
  }

  return semanticLabelPositionOptionForDirection(
    direction,
    horizontalGapPx / fontPx,
    verticalGapPx / fontPx
  );
}

function normalize2(v: { x: number; y: number }): { x: number; y: number } {
  const d = Math.hypot(v.x, v.y);
  if (d < 1e-9) return { x: 0.7071, y: 0.7071 };
  return { x: v.x / d, y: v.y / d };
}

function computeLabelPlacementMap(scene: SceneModel, options: TikzExportOptions): Map<string, LabelPlacement> {
  const result = new Map<string, LabelPlacement>();
  const scale = clampPositive(options.worldToTikzScale ?? 1, 0.01, 100);
  const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  const plainPxToPt = resolvedPlainCanvasPxToTikzPt(options);
  const ptPerPxForShift = plainPxToPt ?? 0.75 / scale;
  const pointScale = clampPositive(options.pointScale ?? 1, 0.05, 10);
  const labelStack = new Map<string, number>();
  for (const point of scene.points) {
    if (!point.visible || point.showLabel === "none") continue;
    const world = getPointWorldPos(point, scene);
    if (!world) continue;
    const p = { x: world.x * pxPerWorld, y: world.y * pxPerWorld };
    const stackKey = `${Math.round(p.x * 2) / 2}:${Math.round(p.y * 2) / 2}`;
    const stackIndex = labelStack.get(stackKey) ?? 0;
    labelStack.set(stackKey, stackIndex + 1);
    const ring = Math.floor(stackIndex / 8) + 1;
    const angle = (stackIndex % 8) * (Math.PI / 4);
    const spread = stackIndex === 0 ? 0 : 10 * ring;

    // Follow canvas semantics: stored offset plus deterministic stack spread.
    const appliesStackSpread = point.showLabel === "name";
    let dxPx = point.style.labelOffsetPx.x + (appliesStackSpread ? Math.cos(angle) * spread : 0);
    let dyPx = point.style.labelOffsetPx.y + (appliesStackSpread ? Math.sin(angle) * spread : 0);

    // Keep label clear of marker even if user offset is tiny.
    const text = point.showLabel === "caption" ? point.captionTex || point.name : point.name;
    const labelRpx = computeLabelBubbleRadiusPx(text, point.style.labelFontPx, point.style.labelHaloWidthPx);
    if (plainPxToPt === null) {
      const metrics = pointStyleMetricsPx(point, pointScale);
      const minClearPx = metrics.markerRadiusPx + labelRpx + Math.max(2, point.style.labelHaloWidthPx * 0.35);
      const dist = Math.hypot(dxPx, dyPx);
      if (dist < minClearPx) {
        const dir = dist > 1e-6 ? { x: dxPx / dist, y: dyPx / dist } : normalize2({ x: 1, y: -1 });
        dxPx = dir.x * minClearPx;
        dyPx = dir.y * minClearPx;
      }
    }

    // Keep caption labels on the same quadrant rule as name labels.
    // (Canvas captions are top-left anchored, but export point labels are
    // compass-positioned tkz labels; use the raw stored drag offset directly.)
    const rawDxPx = point.style.labelOffsetPx.x;
    const rawDyPx = point.style.labelOffsetPx.y;

    result.set(point.id, {
      xShiftPt: dxPx * ptPerPxForShift,
      yShiftPt: -dyPx * ptPerPxForShift,
      rawXShiftPt: rawDxPx * ptPerPxForShift,
      rawYShiftPt: -rawDyPx * ptPerPxForShift,
      offsetXPx: dxPx,
      offsetYPx: dyPx,
      scale,
      bubbleRadiusPt: labelRpx * ptPerPxForShift,
    });
  }
  return result;
}

function pointStyleMetricsPx(point: ScenePoint, pointScale: number): { markerRadiusPx: number } {
  const strokePx = Math.max(0.2, point.style.strokeWidth * pointScale);
  const sizePx = Math.max(0.4, point.style.sizePx * pointScale);
  return { markerRadiusPx: sizePx + strokePx * 0.5 };
}

const TIKZ_CORE_COLOR_NAMES = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "cyan",
  "magenta",
  "yellow",
  "gray",
  "grey",
  "darkgray",
  "darkgrey",
  "lightgray",
  "lightgrey",
  "orange",
  "lime",
  "olive",
  "teal",
  "purple",
  "violet",
  "brown",
  "pink",
]);

function isCoreTikzColorName(rawColor: string): boolean {
  const normalized = rawColor.trim().toLowerCase();
  return TIKZ_CORE_COLOR_NAMES.has(normalized);
}

function estimateCanvasLabelTextBoxPx(
  text: string,
  labelFontPx: number
): { widthPx: number; heightPx: number; ascentPx: number; descentPx: number } {
  const fontPx = Math.max(1, labelFontPx);
  const content = (text && text.length > 0 ? text : "X").replace(/\\[a-zA-Z]+|[{}$]/g, "");
  const textLen = Math.max(1, content.length);
  const widthPx = Math.max(fontPx * 0.62, textLen * fontPx * 0.5);
  const heightPx = fontPx * 0.92;
  return {
    widthPx,
    heightPx,
    ascentPx: fontPx * 0.78,
    descentPx: fontPx * 0.14,
  };
}

function computeLabelBubbleRadiusPx(text: string, labelFontPx: number, haloWidthPx: number): number {
  const { widthPx, heightPx } = estimateCanvasLabelTextBoxPx(
    text,
    Math.max(6, Math.min(48, labelFontPx))
  );
  const baseRadius = Math.max(widthPx, heightPx) * 0.5;
  const haloPad = Math.max(0.8, haloWidthPx * 0.25);
  return baseRadius + haloPad;
}

function rgbColorExpr(rawColor: string): string {
  const named = resolveExportFriendlyColorName(rawColor);
  if (named && isCoreTikzColorName(rawColor)) return named;
  if (named && isCoreTikzColorName(named)) return named;

  const rgb = parseColorToRgb(rawColor) ?? { r: 0, g: 0, b: 0 };
  const { r, g, b } = rgb;
  return `{rgb,255:red,${r};green,${g};blue,${b}}`;
}

function hoistGeneratedDefinitions(lines: string[]): string[] {
  const flattenedLines = lines.flatMap((line) => line.split("\n"));
  const beginIndex = flattenedLines.findIndex((line) =>
    line.trim().startsWith("\\begin{tikzpicture}")
  );
  if (beginIndex < 0) return flattenedLines;

  const remaining: string[] = [];
  const definitions: string[] = [];
  const sectionHeader = /^% (?:Points|Constructions|Draw objects|Draw points|Labels)$/u;
  const takeAttachedComments = (): string[] => {
    const comments: string[] = [];
    while (remaining.length > 0) {
      const candidate = remaining[remaining.length - 1].trim();
      if (!candidate.startsWith("%") || sectionHeader.test(candidate)) break;
      comments.unshift(remaining.pop() as string);
    }
    return comments;
  };
  const braceDelta = (line: string): number => {
    let delta = 0;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === "\\") {
        index += 1;
        continue;
      }
      if (line[index] === "{") delta += 1;
      else if (line[index] === "}") delta -= 1;
    }
    return delta;
  };

  for (let index = 0; index < flattenedLines.length; index += 1) {
    const line = flattenedLines[index];
    const trimmed = line.trim();
    const isTikzset = trimmed.startsWith("\\tikzset{");
    const isGdCommand = trimmed.startsWith("\\newcommand{\\gd");
    if (!isTikzset && !isGdCommand) {
      remaining.push(line);
      continue;
    }

    definitions.push(...takeAttachedComments());
    definitions.push(line);
    if (isTikzset) {
      let depth = braceDelta(line);
      while (depth > 0 && index + 1 < flattenedLines.length) {
        index += 1;
        definitions.push(flattenedLines[index]);
        depth += braceDelta(flattenedLines[index]);
      }
    }
  }

  if (definitions.length === 0) return flattenedLines;
  const remainingBeginIndex = remaining.findIndex((line) =>
    line.trim().startsWith("\\begin{tikzpicture}")
  );
  remaining.splice(remainingBeginIndex + 1, 0, ...definitions, "");
  return remaining;
}

function hoistNamedColors(
  lines: string[],
  preferNamed: boolean,
  forceDvipsNames: boolean
): string[] {
  const rgbPattern = /\{rgb,255:red,(\d+);green,(\d+);blue,(\d+)\}/g;
  const colorMap = new Map<string, string>();
  const colorDefs: string[] = [];

  const toName = (r: number, g: number, b: number): string => {
    const hex = [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("");
    return `gdC_${hex}`;
  };

  const rewritten = lines.map((line) =>
    line.replace(rgbPattern, (_m, rs: string, gs: string, bs: string) => {
      const r = Number(rs);
      const g = Number(gs);
      const b = Number(bs);
      const key = `${r},${g},${b}`;
      let name = colorMap.get(key);
      if (!name) {
        if (forceDvipsNames) {
          name = resolveNearestDvipsColorName(`rgb(${r},${g},${b})`) ?? "black";
          colorMap.set(key, name);
        } else {
          const mapped = exportFriendlyColorNameByRgbKey[key];
          const isCore = mapped && isCoreTikzColorName(mapped);
          const useMapped = mapped !== undefined;
          name = useMapped ? mapped : toName(r, g, b);
          colorMap.set(key, name);
          if (mapped === undefined || (!isCore && !preferNamed)) {
            colorDefs.push(`\\definecolor{${name}}{RGB}{${r},${g},${b}}`);
          }
        }
      }
      return name;
    })
  );

  if (colorDefs.length === 0) return rewritten;

  const beginIdx = rewritten.findIndex((line) => line.trim().startsWith("\\begin{tikzpicture}"));
  if (beginIdx < 0) return rewritten;

  const out = [...rewritten];
  out.splice(beginIdx + 1, 0, ...colorDefs);
  return out;
}

function injectOptionalTikzLibraries(lines: string[], defaultLibs: boolean): string[] {
  const beginIdx = lines.findIndex((line) => line.trim().startsWith("\\begin{tikzpicture}"));
  if (beginIdx < 0) return lines;

  let needsPatterns = false;
  let needsPatternsMeta = false;
  let needsDecorationsMarkings = false;
  let needsArrowsMeta = false;
  let needsArrowsLibrary = false;
  let needsThroughLibrary = false;
  let needsShapesGeometric = false;
  let needsShapesMisc = false;
  let needsCalc = false;
  let needsPositioning = false;
  const patternRegex = /pattern\s*=|pattern color\s*=/;
  const patternMetaRegex = /pattern\s*=\s*\{/;
  const decorationRegex = /postaction\s*=\s*decorate|decoration\s*=\s*\{markings/i;
  const arrowTipRegex =
    /-\{(?:Stealth|Latex|Triangle)\[[^\]]*\]|\\arrow(?:reversed)?\[[^\]]*\]\{(?:Stealth|Latex|Triangle)(?:\[[^\]]*\])?\}/;
  const parameterizedArrowRegex = /\\arrow(?:reversed)?(?:\[[^\]]*\])?\{/;
  const arrowStyleRegex = />=\s*triangle|triangle\s+45/i;
  const geometricShapeRegex = /shape\s*=\s*diamond|regular polygon(?:\s|,|$)/;
  const miscShapeRegex = /shape\s*=\s*cross out(?:\s|,|$)/;
  const throughRegex = /through=/i;
  const calcCoordinateRegex = /\(\$\s*\(/;
  const positioningRegex = /\b(?:above|below)\s+(?:left|right)\s*=|\b(?:above|below|left|right)\s*=[^,\]]*(?:em|pt|cm|mm)/i;
  for (const line of lines) {
    if (patternMetaRegex.test(line)) {
      needsPatternsMeta = true;
      needsPatterns = true;
    } else if (patternRegex.test(line)) {
      needsPatterns = true;
    }
    if (decorationRegex.test(line)) needsDecorationsMarkings = true;
    if (arrowTipRegex.test(line) || parameterizedArrowRegex.test(line)) needsArrowsMeta = true;
    if (arrowStyleRegex.test(line)) needsArrowsLibrary = true;
    if (throughRegex.test(line)) needsThroughLibrary = true;
    if (geometricShapeRegex.test(line)) needsShapesGeometric = true;
    if (miscShapeRegex.test(line)) needsShapesMisc = true;
    if (calcCoordinateRegex.test(line)) needsCalc = true;
    if (positioningRegex.test(line)) needsPositioning = true;
  }

  const requestedLibs: string[] = defaultLibs ? ["patterns", "through", "arrows"] : [];
  if (needsShapesGeometric) requestedLibs.push("shapes.geometric");
  if (defaultLibs && needsShapesMisc) requestedLibs.push("shapes.misc");
  if (needsPatterns) requestedLibs.push("patterns");
  if (needsPatternsMeta) requestedLibs.push("patterns.meta");
  if (needsThroughLibrary) requestedLibs.push("through");
  if (needsDecorationsMarkings) requestedLibs.push("decorations.markings");
  if (defaultLibs && needsCalc) requestedLibs.push("calc");
  if (needsPositioning) requestedLibs.push("positioning");
  if (needsArrowsLibrary || needsArrowsMeta) requestedLibs.push("arrows");
  if (needsArrowsMeta) {
    requestedLibs.push("arrows.meta");
    requestedLibs.push("bending");
  }

  const libraryLines: string[] = [];
  if (requestedLibs.length > 0) {
    const uniq = [...new Set(requestedLibs)];
    libraryLines.push(`\\usetikzlibrary{${uniq.join(",")}}`);
  }

  if (libraryLines.length === 0) return lines;
  const out = [...lines];
  let insertIdx = beginIdx;
  for (let i = 0; i < libraryLines.length; i += 1) {
    const libraryLine = libraryLines[i];
    if (out.some((line) => line.trim() === libraryLine)) continue;
    out.splice(insertIdx, 0, libraryLine);
    insertIdx += 1;
  }
  return out;
}

function escapeTikzText(value: string): string {
  // Pass TeX label content through so commands like \alpha and ^{\circ} work.
  // Every caller wraps the result in $...$ (math mode). A blank line (2+
  // consecutive newlines — e.g. pressing Enter twice in the label textarea)
  // is a LaTeX paragraph break, and \par is illegal inside math mode, so
  // collapse and trim rather than emitting a document that won't compile.
  return value.replace(/\n{2,}/g, "\n").trim();
}

function escapeTikzPlainText(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
}

function buildPlainTextLabelNodeText(value: string): string {
  const lines = value.split("\n").map((line) => escapeTikzPlainText(line));
  if (lines.length === 0 || lines.every((line) => line.length === 0)) return "\\mbox{}";
  return lines.join(" \\\\ ");
}

function buildMixedTextLabelNodeText(value: string): string {
  const segments = parseTextLabelRichText(value);
  const lines: string[] = [];
  let currentLine = "";

  const pushCurrentLine = (force = false) => {
    if (!force && currentLine.length === 0) return;
    lines.push(currentLine);
    currentLine = "";
  };

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.kind === "text") {
      const textLines = segment.content.split("\n");
      for (let j = 0; j < textLines.length; j += 1) {
        if (currentLine.length === 0 && lines.length > 0 && j === 0 && textLines[j].length === 0) {
          continue;
        }
        currentLine += escapeTikzPlainText(textLines[j]);
        if (j < textLines.length - 1) pushCurrentLine(true);
      }
      continue;
    }
    if (segment.kind === "inlineMath") {
      currentLine += `$${segment.content || "\\,"}$`;
      continue;
    }
    pushCurrentLine();
    lines.push(`$\\displaystyle ${segment.content || "\\,"}$`);
  }

  pushCurrentLine(lines.length === 0);
  if (lines.length === 0) return "\\mbox{}";
  return lines.join(" \\\\ ");
}

function buildRichTextNodeText(document: RichTextDocument): string {
  const lines: string[] = [];
  let currentLine = "";

  const pushCurrentLine = (force = false) => {
    if (!force && currentLine.length === 0) return;
    lines.push(currentLine);
    currentLine = "";
  };

  const appendPlainText = (value: string) => {
    const textLines = value.split("\n");
    for (let i = 0; i < textLines.length; i += 1) {
      currentLine += escapeTikzPlainText(textLines[i]);
      if (i < textLines.length - 1) pushCurrentLine(true);
    }
  };

  for (const block of document.blocks) {
    if (block.kind === "displayMath") {
      pushCurrentLine();
      lines.push(`$\\displaystyle ${extractDisplayMathSource(block) || "\\,"}$`);
      continue;
    }

    for (const child of block.children) {
      if (child.kind === "text") {
        appendPlainText(child.text);
      } else if (child.kind === "symbol") {
        currentLine += `$${child.command || escapeTikzPlainText(child.text)}$`;
      } else {
        currentLine += `$${extractInlineMathSource(child) || "\\,"}$`;
      }
    }
    pushCurrentLine(lines.length === 0);
  }

  pushCurrentLine(lines.length === 0);
  if (lines.length === 0) return "\\mbox{}";
  return lines.join(" \\\\ ");
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampPositive(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

const TKZ_MACRO_SET = new Set<string>((tkzMacroWhitelist as { macros: string[] }).macros ?? []);

function assertTkzMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported tkz-euclide macro emitted: \\\\${name}. Run npm run update:tkz-macros or fix exporter.`);
}

function assertPerpendicularMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported construction: PerpendicularLine (missing tkz macro: ${name})`);
}

function assertParallelMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported construction: ParallelLine (missing tkz macro: ${name})`);
}

function assertAngleBisectorMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported construction: AngleBisector (missing tkz macro: ${name})`);
}

function assertAngleMacro(name: string, context: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported construction: ${context} (missing tkz macro: ${name})`);
}

function assertAngleFixedMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported construction: AngleFixed (missing tkz macro: ${name})`);
}

function assertCircleFixedMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported construction: CircleFixedRadius (missing tkz macro: ${name})`);
}

function buildAngleLabelTex(labelTextRaw: string, showLabel: boolean, showValue: boolean, thetaRad: number): string | null {
  const labelText = labelTextRaw.trim();
  const deg = (thetaRad * 180) / Math.PI;
  const valueTex = `${formatAngleDegreesValueForTex(deg)}^{\\circ}`;
  if (showLabel && labelText.length > 0 && showValue) return `${labelText}=${valueTex}`;
  if (showLabel && labelText.length > 0) return labelText;
  if (showValue) return valueTex;
  return null;
}

function formatAngleDegreesValueForTex(degRaw: number): string {
  if (!Number.isFinite(degRaw)) return "0";
  const deg = ((degRaw % 360) + 360) % 360;
  const nearest5 = Math.round(deg / 5) * 5;
  if (Math.abs(deg - nearest5) <= 1e-3) return String(nearest5);
  return deg.toFixed(2).replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}
