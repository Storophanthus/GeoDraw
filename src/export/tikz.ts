import { circleCircleIntersections, distance, lineCircleIntersectionBranches } from "../geo/geometry";
import { resolveAngleRightStatus } from "../domain/rightAngleProvenance";
import { normalizeSceneIntegrity } from "../domain/sceneIntegrity";
import {
  collectSegmentMarkPositions,
  computeOrientedAngleRad,
  type AngleMarkSymbol,
  resolveAngleMarks,
  resolveSegmentMarks,
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  resolveTextLabelDisplayText,
  type GeometryObjectRef,
  SceneModel,
  ScenePoint,
  SegmentArrowMark,
  type PathArrowMark,
} from "../scene/points";
import {
  defaultObjectLabelPosWorld,
  defaultObjectLabelText,
  isFiniteLabelPosWorld,
  resolveObjectLabelText,
} from "../scene/objectLabels";
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
  worldToTikzScale?: number;
  screenPxPerWorld?: number;
  labelGlow?: boolean;
  drawLayerBackend?: DrawLayerBackendKind;
  segmentStrokeScale?: number;
  pointStrokeScale?: number;
  pointInnerSepFixedPt?: number;
  pointInnerSepScale?: number;
  segmentMarkSizeScale?: number;
  segmentMarkLineWidthScale?: number;
  angleLabelFontScale?: number;
  angleArcStrokeScale?: number;
  angleArcSizeScale?: number;
  angleMarkSizeScale?: number;
  rightAngleStrokeScale?: number;
  rightAngleSizeScale?: number;
  autoScaleToFitCm?: { maxWidthCm: number; maxHeightCm: number };
};

export type TikzCommand =
  | { kind: "SetupUnits"; scale: number }
  | { kind: "SetupLabelScale"; scale: number }
  | { kind: "SetupViewport"; xmin: number; xmax: number; ymin: number; ymax: number; space: number }
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
  | { kind: "DefTriangleCenterPoint"; name: string; centerKind: "incenter" | "orthocenter" | "centroid"; a: string; b: string; c: string }
  | { kind: "DefCircleCircumCenter"; centerName: string; a: string; b: string; c: string }
  | { kind: "DefPointOnCircle"; name: string; center: string; through: string; theta: number }
  | { kind: "DefMidPoint"; name: string; a: string; b: string }
  | { kind: "InterLL"; name: string; a1: string; a2: string; b1: string; b2: string }
  | { kind: "InterLC"; name: string; lineA: string; lineB: string; circleO: string; circleX: string; branch: 0 | 1; common?: string; swap?: boolean }
  | { kind: "InterCC"; name: string; circleAO: string; circleAX: string; circleBO: string; circleBX: string; branch: 0 | 1; common?: string; swap?: boolean }
  | { kind: "DrawSegment"; a: string; b: string; style?: string }
  | { kind: "MarkSegment"; a: string; b: string; style: string }
  | { kind: "DrawRaw"; tex: string }
  | { kind: "DrawLine"; a: string; b: string; addLeft: number; addRight: number; style?: string }
  | { kind: "DrawCircle"; o: string; x: string; style?: string }
  | { kind: "FillCircle"; o: string; x: string; style?: string }
  | { kind: "DrawCircleRadius"; o: string; radius: number; style?: string }
  | { kind: "FillCircleRadius"; o: string; radius: number; style?: string }
  | { kind: "DrawSector"; o: string; a: string; b: string; style?: string }
  | { kind: "FillSector"; o: string; a: string; b: string; style?: string }
  | { kind: "FillAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "MarkAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "MarkRightAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "LabelAngle"; a: string; b: string; c: string; text: string; style?: string }
  | { kind: "DrawPoints"; style: string; points: string[] }
  | { kind: "LabelPoints"; points: string[] }
  | { kind: "LabelPoint"; name: string; text: string; options?: string; useGlow?: boolean }
  | { kind: "LabelAt"; x: number; y: number; text: string; options?: string; useGlow?: boolean };

type PointStyleDef = {
  styleName: string;
  styleExpr: string;
};

type LabelPlacement = {
  xShiftPt: number;
  yShiftPt: number;
  rawXShiftPt: number;
  rawYShiftPt: number;
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
// Approximate conversion for tip geometry parity (canvas px -> TikZ pt).
// 16.8px (Canvas) * 0.5 = 8.4pt base -> 10.08pt tip length (Stealth).
const CANVAS_PX_TO_TIKZ_PT = 0.5;


export function buildTikzIR(scene: SceneModel, options: TikzExportOptions = {}): TikzCommand[] {
  const pointById = new Map(scene.points.map((p) => [p.id, p]));
  const lineById = new Map(scene.lines.map((l) => [l.id, l]));
  const segById = new Map(scene.segments.map((s) => [s.id, s]));
  const circleById = new Map(scene.circles.map((c) => [c.id, c]));

  const pointName = buildPointNameMap(scene.points);

  const defs: TikzCommand[] = [];
  const constructions: TikzCommand[] = [];
  const drawFills: TikzCommand[] = [];
  const drawStrokes: TikzCommand[] = [];
  const drawOverlays: TikzCommand[] = [];
  const drawPointsLayer: TikzCommand[] = [];
  const drawLabelsLayer: TikzCommand[] = [];
  const definedPointIds = new Set<string>();

  const freeItems: Array<{ name: string; x: number; y: number }> = [];
  const viewport = options.viewport ?? computeExportViewport(scene);
  const exportPxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  let coordScale = clampPositive(options.worldToTikzScale ?? 1, 0.01, 100);
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
  // Calculate effective pixels per world unit for TikZ metric mapping.
  // 1cm (TikZ default unit) approx equals 37.8px (at 96 DPI).
  // This ensures gap pixels (defined in screen px) map to correct physical length in TikZ.
  const arrowMetricPxPerWorld = coordScale * 37.8;
  defs.push({ kind: "SetupUnits", scale: coordScale });
  defs.push({ kind: "SetupLabelScale", scale: labelScale });
  defs.push({
    kind: "SetupViewport",
    xmin: viewport.xmin,
    xmax: viewport.xmax,
    ymin: viewport.ymin,
    ymax: viewport.ymax,
    space: options.clipSpace ?? 0,
  });
  const globalAdd = options.globalLineAdd ?? 5;
  defs.push({ kind: "SetupLine", addLeft: globalAdd, addRight: globalAdd });
  if (options.clipRectWorld) {
    // Slightly expand explicit clip rectangle to avoid antialias/stroke edge shaving.
    const clipPadWorld = 14 / exportPxPerWorld;
    defs.push({
      kind: "ClipRect",
      xmin: Math.min(options.clipRectWorld.xmin, options.clipRectWorld.xmax) - clipPadWorld,
      xmax: Math.max(options.clipRectWorld.xmin, options.clipRectWorld.xmax) + clipPadWorld,
      ymin: Math.min(options.clipRectWorld.ymin, options.clipRectWorld.ymax) - clipPadWorld,
      ymax: Math.max(options.clipRectWorld.ymin, options.clipRectWorld.ymax) + clipPadWorld,
    });
  }
  if (options.clipPolygonWorld && options.clipPolygonWorld.length >= 3) {
    const clipPadWorld = 14 / exportPxPerWorld;
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
    constructions.push({
      kind: "DefCircleCircumCenter",
      centerName,
      a: mustName(pointName, circle.aId),
      b: mustName(pointName, circle.bId),
      c: mustName(pointName, circle.cId),
    });
    circleCenterNameById.set(circleId, centerName);
    return centerName;
  };

  const ensureCircleThroughName = (circleId: string): string => {
    const cached = circleThroughNameById.get(circleId);
    if (cached) return cached;
    const circle = circleById.get(circleId);
    if (!circle) throw new Error(`Missing circle ${circleId}`);
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
      const anchorsWorld = getLineWorldAnchors(line, scene);
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
      if (
        line.family === "outer" &&
        (tangentTopology.kind === "disjoint" || tangentTopology.kind === "intersecting") &&
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
    const topology = classifyCircleCircleTangentTopology(geomA, geomB);
    switch (topology.kind) {
      case "intersecting":
        return line.family === "inner";
      case "degenerateTangency":
        if (topology.near) return false;
        return topology.mode === "internal" && line.family === "inner";
      case "contained":
      case "concentricUnequal":
      case "coincident":
        return true;
      case "disjoint":
        return false;
    }
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
      constructions.push({
        kind: "DefTriangleCenterPoint",
        name,
        centerKind: point.centerKind,
        a: mustName(pointName, point.aId),
        b: mustName(pointName, point.bId),
        c: mustName(pointName, point.cId),
      });
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
      const roots = lineCircleIntersectionBranches(lineWorld.a, lineWorld.b, center, geom.radius);
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
      if (roots.length === 1) {
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
          branch = inferLineCircleBranchFromExcludedWorld(
            lineWorld.a,
            lineWorld.b,
            center,
            { x: center.x + geom.radius, y: center.y },
            excluded,
            point.branchIndex
          );
        }
      }
      let commonName: string | undefined;
      if (point.excludePointId) {
        commonName = mustName(pointName, point.excludePointId);
      } else if (point.branchIndex === 1) {
        const sibling = scene.points.find(
          (p) =>
            p.kind === "circleLineIntersectionPoint" &&
            p.id !== point.id &&
            p.circleId === point.circleId &&
            p.lineId === point.lineId &&
            p.branchIndex === 0
        );
        if (sibling) {
          resolvePoint(sibling.id);
          if (definedPointIds.has(sibling.id)) commonName = mustName(pointName, sibling.id);
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
      const through = { x: center.x + geom.radius, y: center.y };
      const roots = lineCircleIntersectionBranches(wa, wb, center, geom.radius);
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
      if (roots.length === 1) {
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
          branch = inferLineCircleBranchFromExcludedWorld(wa, wb, center, through, excluded, point.branchIndex);
        }
      }
      let commonName: string | undefined;
      if (point.excludePointId) {
        commonName = mustName(pointName, point.excludePointId);
      } else if (point.branchIndex === 1) {
        const sibling = scene.points.find(
          (p) =>
            p.kind === "circleSegmentIntersectionPoint" &&
            p.id !== point.id &&
            p.circleId === point.circleId &&
            p.segId === point.segId &&
            p.branchIndex === 0
        );
        if (sibling) {
          resolvePoint(sibling.id);
          if (definedPointIds.has(sibling.id)) commonName = mustName(pointName, sibling.id);
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
      const cAThrough = { x: cAGeom.center.x + cAGeom.radius, y: cAGeom.center.y };
      let branch: 0 | 1 = point.branchIndex;
      let commonName: string | undefined;
      if (point.excludePointId) {
        commonName = mustName(pointName, point.excludePointId);
      } else if (branch === 1) {
        const sibling = scene.points.find((p) => {
          if (p.id === point.id || p.kind !== "circleCircleIntersectionPoint") return false;
          return (
            ((p.circleAId === point.circleAId && p.circleBId === point.circleBId) ||
              (p.circleAId === point.circleBId && p.circleBId === point.circleAId)) &&
            definedPointIds.has(p.id)
          );
        });
        if (sibling) commonName = mustName(pointName, sibling.id);
      }
      const targetWorld = getPointWorldPos(point, scene);

      // Find a common point (one that already exists and matches the OTHER intersection)
      const roots = circleCircleIntersections(cAGeom.center, cAGeom.radius, cBGeom.center, cBGeom.radius);
      if (roots.length === 2 && targetWorld) {
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
            const other = distance(roots[0], targetWorld) > distance(roots[1], targetWorld) ? roots[0] : roots[1];
            const angleA_t = computeOrientedAngleRad(cAGeom.center, cAThrough, targetWorld);
            const angleA_o = computeOrientedAngleRad(cAGeom.center, cAThrough, other);
            if (angleA_t !== null && angleA_o !== null) {
              const o1 = cAGeom.center;
              const o2 = cBGeom.center;
              const a_t = computeOrientedAngleRad(targetWorld, o1, o2);
              if (a_t !== null) {
                swap = a_t <= 0;
              }
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
          const branch = inferCircleCircleBranch(point, cAGeom.center, cAThrough, cBGeom.center, cBThrough);
          let commonName: string | undefined;
          if (branch === 1) {
            const sibling = scene.points.find((p) => {
              if (p.id === point.id || p.kind !== "intersectionPoint") return false;
              const aCircle = isCircleRef(point.objA) && isCircleRef(point.objB);
              const bCircle = isCircleRef(p.objA) && isCircleRef(p.objB);
              if (!aCircle || !bCircle) return false;
              return sameObjectPair(p.objA, p.objB, point.objA, point.objB) && definedPointIds.has(p.id);
            });
            if (sibling) commonName = mustName(pointName, sibling.id);
          }
          const targetWorld = getPointWorldPos(point, scene);

          // Find a common point (one that already exists and matches the OTHER intersection)
          const roots = circleCircleIntersections(cAGeom.center, cAGeom.radius, cBGeom.center, cBGeom.radius);
          if (roots.length === 2 && targetWorld) {
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
                const a_t = computeOrientedAngleRad(targetWorld, o1, o2);
                if (a_t !== null) {
                  swap = a_t <= 0;
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
          const branch = inferLineCircleBranchFromWorld(point, mixed.ll.worldA, mixed.ll.worldB, center, through);
          const roots = lineCircleIntersectionBranches(mixed.ll.worldA, mixed.ll.worldB, center, geom.radius);
          if (roots.length === 0) {
            visiting.delete(pointId);
            visited.add(pointId);
            return;
          }
          if (roots.length === 1) {
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
          let mixCommonName: string | undefined;
          if (branch === 1) {
            const sibling = scene.points.find(
              (p) =>
                p.kind === "intersectionPoint" &&
                p.id !== point.id &&
                sameObjectPair(p.objA, p.objB, point.objA, point.objB) &&
                definedPointIds.has(p.id)
            );
            if (sibling) mixCommonName = mustName(pointName, sibling.id);
          }
          if (!mixCommonName) {
            mixCommonName = inferLineCircleCommonFromEndpointsWorld(
              mixed.ll.endpointAId,
              mixed.ll.endpointBId,
              mixed.ll.worldA,
              mixed.ll.worldB,
              center,
              through,
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
    const pointWorld = getPointWorldPosCached(scene, point.id);
    // Hidden undefined points (e.g. intersections on vanished tangents) should not
    // poison export. Visible undefined points fail closed to avoid silent data loss.
    if (!pointWorld) {
      if (point.visible) {
        throw new Error(`Cannot export visible undefined point ${point.name}: ${point.id}`);
      }
      continue;
    }
    resolvePoint(point.id);
  }

  if (freeItems.length > 0) {
    freeItems.sort((a, b) => a.name.localeCompare(b.name));
    defs.push({ kind: "DefPoints", items: freeItems });
  }

  for (const seg of scene.segments) {
    if (!seg.visible) continue;
    if (!definedPointIds.has(seg.aId) || !definedPointIds.has(seg.bId)) {
      throw new Error(`Cannot export undefined segment geometry: ${seg.id}`);
    }
    const aName = mustName(pointName, seg.aId);
    const bName = mustName(pointName, seg.bId);
    const segmentArrows = seg.style.segmentArrowMarks ?? seg.style.segmentArrowMark;
    const segmentStrokeCarrierKey = selectSegmentStrokeCarrierArrowKey(seg.style, segmentArrows);
    if (!segmentStrokeCarrierKey) {
      drawStrokes.push({
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
      bName
    );
    drawOverlays.push(...markCommands);
    const aWorld = getPointWorldPosCached(scene, seg.aId);
    const bWorld = getPointWorldPosCached(scene, seg.bId);
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
        screenPxPerWorld: arrowMetricPxPerWorld,
      }
    );
    if (arrowOverlay) {
      if (arrowOverlay.kind === "tkz") {
        drawOverlays.push({
          kind: "DrawSegment",
          a: aName,
          b: bName,
          style: arrowOverlay.style,
        });
      } else {
        drawOverlays.push({
          kind: "DrawRaw",
          tex: arrowOverlay.tex,
        });
      }
    }
  }
  for (const line of scene.lines) {
    if (!line.visible) continue;
    if (line.kind === "circleCircleTangent" && isTopologicallyImpossibleCircleCircleTangent(line)) continue;
    const lineNames = resolveLineAnchorsById(line.id);
    const ext = computeLineDrawPlacement(scene, line);
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
    drawStrokes.push({
      kind: "DrawLine",
      a: drawAName,
      b: drawBName,
      addLeft: ext.addLeft,
      addRight: ext.addRight,
      style: lineStyleToTikz(line.style, options),
    });
  }
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    const centerName = ensureCircleCenterName(circle.id);
    const fillStyle = circleFillStyleToTikz(circle.style);
    const strokeStyle = circleStrokeStyleToTikz(circle.style, options);
    if (circle.kind === "fixedRadius") {
      const geom = circleGeomById(circle.id);
      if (!Number.isFinite(geom.radius) || geom.radius <= 0) {
        throw new Error(`Unsupported construction: CircleFixedRadius (invalid radius for ${circle.id})`);
      }
      if (fillStyle) {
        drawFills.push({
          kind: "FillCircleRadius",
          o: centerName,
          radius: geom.radius,
          style: fillStyle,
        });
      }
      drawStrokes.push({
        kind: "DrawCircleRadius",
        o: centerName,
        radius: geom.radius,
        style: strokeStyle,
      });
    } else if (circle.kind === "threePoint") {
      if (!definedPointIds.has(circle.aId) || !definedPointIds.has(circle.bId) || !definedPointIds.has(circle.cId)) {
        throw new Error(`Cannot export undefined circle geometry: ${circle.id}`);
      }
      const through = mustName(pointName, circle.aId);
      if (fillStyle) {
        drawFills.push({
          kind: "FillCircle",
          o: centerName,
          x: through,
          style: fillStyle,
        });
      }
      drawStrokes.push({
        kind: "DrawCircle",
        o: centerName,
        x: through,
        style: strokeStyle,
      });
    } else {
      if (!definedPointIds.has(circle.throughId)) {
        throw new Error(`Cannot export undefined circle geometry: ${circle.id}`);
      }
      const through = mustName(pointName, circle.throughId);
      if (fillStyle) {
        drawFills.push({
          kind: "FillCircle",
          o: centerName,
          x: through,
          style: fillStyle,
        });
      }
      drawStrokes.push({
        kind: "DrawCircle",
        o: centerName,
        x: through,
        style: strokeStyle,
      });
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
        screenPxPerWorld: arrowMetricPxPerWorld,
      },
      undefined, // arcDef undefined -> Use markings (Decoration)
      { bend: true } // Circle arrows use bend
    );
    if (circleArrowOverlay) {
      drawOverlays.push({ kind: "DrawRaw", tex: circleArrowOverlay });
    }
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
    const path = names.map((name, idx) => (idx === 0 ? `(${name})` : ` -- (${name})`)).join("");
    if (fillStyle) {
      const fillOpts = fillStyle ? `[${fillStyle}]` : "";
      drawFills.push({ kind: "DrawRaw", tex: `\\fill${fillOpts} ${path} -- cycle;` });
    }
    const strokeOpts = strokeStyle ? `[${strokeStyle}]` : "";
    drawStrokes.push({ kind: "DrawRaw", tex: `\\draw${strokeOpts} ${path} -- cycle;` });
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
      throw new Error(`Cannot export undefined angle geometry: ${angle.id}`);
    }
    const theta = computeOrientedAngleRad(aWorld, bWorld, cWorld);
    if (theta === null) {
      throw new Error(`Cannot export undefined angle geometry: ${angle.id}`);
    }
    const aName = mustName(pointName, angle.aId);
    const bName = mustName(pointName, angle.bId);
    const cName = mustName(pointName, angle.cId);
    if (angle.kind === "sector") {
      if (angle.style.fillEnabled) {
        const fillStyle = sectorFillStyleToTikz(angle.style);
        drawFills.push({ kind: "FillSector", o: bName, a: aName, b: cName, style: fillStyle });
      }
      drawStrokes.push({
        kind: "DrawSector",
        o: bName,
        a: aName,
        b: cName,
        style: sectorDrawStyleToTikz(angle.style, options),
      });
      const sectorRadius = distance(aWorld, bWorld);
      const sectorStart = Math.atan2(aWorld.y - bWorld.y, aWorld.x - bWorld.x);
      const sectorArrowOverlay = pathArrowOverlayToTikz(
        angle.style.arcArrowMarks ?? angle.style.arcArrowMark,
        arcPathExprFromWorld(bWorld, sectorRadius, sectorStart, theta, `(${aName})`),
        {
          strokeColor: angle.style.strokeColor,
          strokeWidth: angle.style.strokeWidth,
          opacity: angle.style.strokeOpacity,
        },
        angle.style.markPos ?? 0.5,
        {
          pathLengthWorld: Math.abs(theta) * sectorRadius,
          screenPxPerWorld: arrowMetricPxPerWorld,
        },
        {
          center: bWorld,
          radius: sectorRadius,
          startRad: sectorStart,
          sweepRad: theta,
        },
        { flex: true } // Keep angle arrows using flex
      );
      if (sectorArrowOverlay) {
        drawOverlays.push({ kind: "DrawRaw", tex: sectorArrowOverlay });
      }
      continue;
    }
    const rightStatus = resolveAngleRightStatus(scene, angle);
    const exportAsRight = rightStatus === "exact" || (rightStatus === "approx" && Boolean(angle.style.promoteToSolid));
    const markKind = resolveAngleMarkKind(angle.style.markStyle, exportAsRight);
    const rightSquareFillStyle =
      exportAsRight && markKind === "rightSquare" && angle.style.fillEnabled ? rightSquareFillStyleToTikz(angle.style) : null;
    if (angle.style.fillEnabled && !rightSquareFillStyle) {
      const fillStyle = angleFillStyleToTikz(angle.style, options);
      drawFills.push({ kind: "FillAngle", a: aName, b: bName, c: cName, style: fillStyle });
    }
    if (markKind === "rightSquare" || markKind === "rightArcDot") {
      const markStyle = angleMarkStyleToTikz(angle.style, true, options, markKind);
      const mergedStyle = rightSquareFillStyle ? [markStyle, rightSquareFillStyle].filter(Boolean).join(", ") : markStyle;
      drawOverlays.push({ kind: "MarkRightAngle", a: aName, b: bName, c: cName, style: mergedStyle });
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
        drawOverlays.push({ kind: "MarkAngle", a: aName, b: bName, c: cName, style: markStyle });
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
          screenPxPerWorld: arrowMetricPxPerWorld,
        },
        {
          center: bWorld,
          radius: arcRadius,
          startRad: angleStart,
          sweepRad: theta,
        },
        { flex: true } // Keep angle arrows using flex
      );
      if (arcArrowOverlay) {
        drawOverlays.push({ kind: "DrawRaw", tex: arcArrowOverlay });
      }
    }
    if (angle.style.showLabel || angle.style.showValue) {
      const labelText = buildAngleLabelTex(angle.style.labelText, angle.style.showLabel, angle.style.showValue, theta);
      if (labelText) {
        const labelStyle = angleLabelStyleToTikz(angle.style, bWorld, options);
        drawLabelsLayer.push({ kind: "LabelAngle", a: aName, b: bName, c: cName, text: labelText, style: labelStyle });
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
  const labels: Array<{ name: string; text: string; options?: string; useGlow?: boolean }> = [];
  const objectLabels: Array<{
    type: "segment" | "line" | "circle" | "polygon";
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
  }> = [];
  const objectLabelGlowEnabled = options.labelGlow ?? true;

  for (const point of scene.points) {
    if (!point.visible) continue;
    if (!definedPointIds.has(point.id)) continue;
    if (point.showLabel === "none") continue;
    const name = pointName.get(point.id);
    if (!name) continue;
    const labelOptions = pointLabelOptionsToTikz(point, labelPlacementById.get(point.id) ?? null, options);
    const labelGlowEnabled = options.labelGlow ?? true;
    if (point.showLabel === "name") {
      labels.push({
        name,
        text: point.name || name,
        options: [labelOptions, `text=${rgbColorExpr(point.style.labelColor)}`].join(", "),
        useGlow: labelGlowEnabled && point.style.labelHaloWidthPx > 0,
      });
    } else {
      labels.push({
        name,
        text: point.captionTex || point.name || name,
        options: [labelOptions, `text=${rgbColorExpr(point.style.labelColor)}`].join(", "),
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
    });
  }

  for (const label of scene.textLabels ?? []) {
    if (!label.visible) continue;
    const displayText = resolveTextLabelDisplayText(label, scene);
    const text = label.style.useTex ? displayText : wrapPlainTextForMathMode(displayText);
    // Free text labels are emitted as raw TikZ nodes (\node), which are not affected
    // by tikzpicture scale. Fold final export geometry scale into these labels only.
    const fontPt = Math.max(1, Math.min(72, label.style.textSize * coordScale));
    const baselinePt = Math.max(fontPt + 1, fontPt * 1.2);
    const rotationDeg =
      typeof label.style.rotationDeg === "number" && Number.isFinite(label.style.rotationDeg)
        ? label.style.rotationDeg
        : 0;
    drawLabelsLayer.push({
      kind: "LabelAt",
      x: label.positionWorld.x,
      y: label.positionWorld.y,
      text,
      options: [
        "anchor=center",
        `text=${rgbColorExpr(label.style.textColor)}`,
        `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(baselinePt)}pt}\\selectfont`,
        ...(Math.abs(rotationDeg) > 1e-9 ? [`rotate=${fmt(rotationDeg)}`] : []),
      ].join(", "),
      useGlow: false,
    });
  }

  labels.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of labels) {
    drawLabelsLayer.push({ kind: "LabelPoint", name: item.name, text: item.text, options: item.options, useGlow: item.useGlow });
  }
  objectLabels.sort((a, b) => {
    const typeOrder = (type: "segment" | "line" | "circle" | "polygon") =>
      type === "segment" ? 0 : type === "line" ? 1 : type === "circle" ? 2 : 3;
    const byType = typeOrder(a.type) - typeOrder(b.type);
    if (byType !== 0) return byType;
    return a.id.localeCompare(b.id);
  });
  for (const item of objectLabels) {
    drawLabelsLayer.push({
      kind: "LabelAt",
      x: item.x,
      y: item.y,
      text: item.text,
      options: [`anchor=center`, `text=${rgbColorExpr(item.color)}`].join(", "),
      useGlow: objectLabelGlowEnabled,
    });
  }

  return [
    ...defs,
    ...constructions,
    ...drawFills,
    ...drawStrokes,
    ...drawOverlays,
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
  options: Pick<TikzExportOptions, "emitTkzSetup" | "drawLayerBackend"> & { groupMarkAngles?: boolean } = {}
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
  const hasGlowLabels = drawLabels.some(
    (c) => (c.kind === "LabelPoint" || c.kind === "LabelAt") && Boolean(c.useGlow)
  );
  const emitTkzSetup = options.emitTkzSetup ?? true;
  const groupMarkAngles = options.groupMarkAngles ?? false;
  const drawLayerBackend = options.drawLayerBackend ?? "tkz";

  const out: string[] = [];
  const pushSectionHeader = (title: string) => {
    if (out.length > 0 && out[out.length - 1] !== "") out.push("");
    out.push(title);
    out.push("");
  };
  const scale = setupUnits?.scale ?? 1;
  const capabilities: TikzRendererCapabilities = {
    fmt,
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
    hasGlowLabels,
    emitTkzSetup,
    labelScale: setupLabelScale?.scale ?? null,
    groupMarkAngles,
    drawLayerBackend,
  }, capabilities);

  appendRenderedSetupAndPoints({
    ctx: renderCtx,
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
  const withNamedColors = hoistNamedColors(out);
  const withOptionalLibraries = injectOptionalTikzLibraries(withNamedColors);
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
  const normalizedScene = normalizeSceneIntegrity(scene);
  pointByIdCache.delete(normalizedScene);
  pointWorldCache.delete(normalizedScene);
  const standard = renderTikz(buildTikzIR(normalizedScene, options), {
    emitTkzSetup: options.emitTkzSetup,
    drawLayerBackend: options.drawLayerBackend,
    groupMarkAngles: true,
  });
  assertNoUnknownTkzMacro(standard);
  return makeEfficientTikz(standard);
}

export function exportTikzWithOptions(scene: SceneModel, options: TikzExportOptions): string {
  const normalizedScene = normalizeSceneIntegrity(scene);
  // Scene can be updated frequently; reset per-scene memoized lookups before each export.
  pointByIdCache.delete(normalizedScene);
  pointWorldCache.delete(normalizedScene);
  const tex = renderTikz(buildTikzIR(normalizedScene, options), {
    emitTkzSetup: options.emitTkzSetup,
    drawLayerBackend: options.drawLayerBackend,
  });
  assertNoUnknownTkzMacro(tex);
  return tex;
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

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return Number(v.toPrecision(15)).toString();
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

function classifyCircleCircleTangentTopology(
  a: { center: { x: number; y: number }; radius: number },
  b: { center: { x: number; y: number }; radius: number }
): CircleCircleTangentTopology {
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
      if (!topology.near) {
        if (isExactDegenerateCircleCircleTangentFamily(line, topology)) return;
        if (topology.mode === "external" && line.family === "outer") return;
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
  const d = distance(a.center, b.center);
  const r1 = a.radius;
  const r2 = b.radius;
  const sum = r1 + r2;
  const diff = Math.abs(r1 - r2);
  const extGap = d - sum;
  const intGap = d - diff;
  return ` (d=${fmt(d)}, r1=${fmt(r1)}, r2=${fmt(r2)}, extGap=${fmt(extGap)}, intGap=${fmt(intGap)})`;
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
): { a: string; b: string; worldA: { x: number; y: number }; worldB: { x: number; y: number }; endpointAId?: string; endpointBId?: string } | null {
  if (ref.type === "line") {
    const line = lineById.get(ref.id);
    if (!line) return null;
    const names = resolveLineAnchorsById(ref.id);
    const anchors = getLineWorldAnchors(line, scene);
    if (!anchors) return null;
    if (line.kind === "perpendicular" || line.kind === "parallel") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.throughId };
    }
    if (line.kind === "tangent") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.throughId };
    }
    if (line.kind === "circleCircleTangent") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b };
    }
    if (line.kind === "angleBisector") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.bId };
    }
    return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.aId, endpointBId: line.bId };
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

function inferLineCircleBranchFromExcludedWorld(
  a: { x: number; y: number },
  b: { x: number; y: number },
  center: { x: number; y: number },
  through: { x: number; y: number },
  excluded: { x: number; y: number },
  fallback: 0 | 1
): 0 | 1 {
  const radius = distance(center, through);
  const branches = lineCircleIntersectionBranches(a, b, center, radius);
  if (branches.length < 2) return 0;

  const ROOT_EPS = 1e-6;
  const d0 = distance(branches[0].point, excluded);
  const d1 = distance(branches[1].point, excluded);
  if (d0 <= ROOT_EPS && d1 > ROOT_EPS) return 1;
  if (d1 <= ROOT_EPS && d0 > ROOT_EPS) return 0;
  return fallback;
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

function isCircleRef(ref: GeometryObjectRef): boolean {
  return ref.type === "circle";
}

function sameObjectPair(a1: GeometryObjectRef, b1: GeometryObjectRef, a2: GeometryObjectRef, b2: GeometryObjectRef): boolean {
  return (sameObjectRef(a1, a2) && sameObjectRef(b1, b2)) || (sameObjectRef(a1, b2) && sameObjectRef(b1, a2));
}

function sameObjectRef(a: GeometryObjectRef, b: GeometryObjectRef): boolean {
  return a.type === b.type && a.id === b.id;
}

function inferLineCircleCommonFromEndpointsWorld(
  lineAId: string | undefined,
  lineBId: string | undefined,
  lineAWorld: { x: number; y: number },
  lineBWorld: { x: number; y: number },
  circleO: { x: number; y: number },
  circleX: { x: number; y: number },
  selectedBranch: 0 | 1,
  pointName: Map<string, string>
): string | undefined {
  const radius = distance(circleO, circleX);
  const branches = lineCircleIntersectionBranches(lineAWorld, lineBWorld, circleO, radius);
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

function computeExportViewport(scene: SceneModel): { xmin: number; xmax: number; ymin: number; ymax: number } {
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

  for (const point of scene.points) {
    const world = getPointWorldPos(point, scene);
    if (!world) continue;
    add(world.x, world.y);
  }

  for (const circle of scene.circles) {
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) continue;
    const center = geom.center;
    const r = geom.radius;
    if (!Number.isFinite(r)) continue;
    add(center.x - r, center.y - r);
    add(center.x + r, center.y + r);
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

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
  }

  let width = maxX - minX;
  let height = maxY - minY;
  if (width < 1e-6) width = 1;
  if (height < 1e-6) height = 1;
  const pad = Math.max(0.25, 0.1 * Math.max(width, height));

  return {
    xmin: minX - pad,
    xmax: maxX + pad,
    ymin: minY - pad,
    ymax: maxY + pad,
  };
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
  const opts = [
    shape,
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
  const allowedMarks = new Set(["|", "||", "|||", "s", "s|", "s||", "x", "o", "oo", "z"]);
  if (!allowedMarks.has(mark.mark)) {
    throw new Error(`Unsupported SegmentMark: mark=${String(mark.mark)}`);
  }
  if (!Number.isFinite(mark.sizePt) || mark.sizePt <= 0) {
    throw new Error("Unsupported SegmentMark: sizePt");
  }
  const sizeScale = clampPositive(options.segmentMarkSizeScale ?? 1, 0.01, 100);
  const widthScale = clampPositive(options.segmentMarkLineWidthScale ?? 1, 0.01, 100);
  const opts: string[] = [`mark=${mark.mark}`, `size=${fmt(mark.sizePt * sizeScale)}pt`];
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
  bName: string
): TikzCommand[] {
  const marks = resolveSegmentMarks(style);
  if (marks.length === 0) return [];
  const out: TikzCommand[] = [];
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
  metrics?: { pathLengthWorld?: number; screenPxPerWorld?: number }
): { kind: "tkz"; style: string } | { kind: "raw"; tex: string } | null {
  const arrows = Array.isArray(styleArrows) ? styleArrows : styleArrows ? [styleArrows] : [];
  if (arrows.length === 0) return null;
  const effectiveArrows = canonicalizeSegmentArrows(arrows);
  if (effectiveArrows.length === 0) return null;

  const rawTexs: string[] = [];

  for (const effectiveArrow of effectiveArrows) {
    if (effectiveArrow.mode === "mid") {
      const midOverlay = pathArrowOverlayToTikz(
        effectiveArrow,
        `(${aName}) -- (${bName})`,
        base,
        effectiveArrow.pos ?? 0.5,
        metrics as { pathLengthWorld: number; screenPxPerWorld: number }
      );
      if (midOverlay) {
        rawTexs.push(midOverlay);
      }
      continue;
    }

    // End arrow logic
    ensureSupportedArrowDirection(effectiveArrow.direction, "SegmentArrowMark");
    const tip = resolveArrowTipName(effectiveArrow.tip, "SegmentArrowMark");
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
    // Keep endpoint-arrow defaults aligned with decoration arrows.
    const effectiveScale = clampPositive(effectiveArrow.sizeScale ?? DEFAULT_PATH_ARROW_UI, 0.1, 20) * 0.75;
    const arrowWidthUi = resolvePathArrowWidthUi(effectiveArrow.lineWidthPt);
    const tipMetrics = resolvePathArrowTipMetricsPx(
      tip,
      1.0,
      arrowWidthUi,
      "PathArrowMark",
      effectiveArrow.arrowLength
    );
    const tipSpec = resolveArrowTipSpec(
      tip,
      tipMetrics.lengthPx * CANVAS_PX_TO_TIKZ_PT * effectiveScale,
      tipMetrics.widthPx * CANVAS_PX_TO_TIKZ_PT * effectiveScale
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
    const tipLengthPx = tipMetrics.lengthPx * effectiveScale;
    const shortTailFrac = Number.isFinite(pathLengthPx)
      ? Math.max(0.01, Math.min(0.35, (tipLengthPx * 1.1) / (pathLengthPx as number)))
      : 0.06;
    const shortTailT = fmt(1 - shortTailFrac);
    const preferHeadOnlyEndpointOverlay = hasSameColorCarrier && !isCarrierArrow;

    if (effectiveArrow.direction === "->") {
      if (preferHeadOnlyEndpointOverlay) {
        rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}]($(${aName})!${shortTailT}!(${bName})$,${bName})`);
      } else {
        rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}](${aName},${bName})`);
      }
    } else if (effectiveArrow.direction === "<-") {
      if (preferHeadOnlyEndpointOverlay) {
        rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}]($(${bName})!${shortTailT}!(${aName})$,${aName})`);
      } else {
        rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}](${bName},${aName})`);
      }
    } else if (effectiveArrow.direction === "<->") {
      if (preferHeadOnlyEndpointOverlay) {
        rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}]($(${aName})!${shortTailT}!(${bName})$,${bName})`);
        rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}]($(${bName})!${shortTailT}!(${aName})$,${aName})`);
      } else {
        rawTexs.push(`\\tkzDrawSegment[${drawStyleBase},{${tipSpec}}-{${tipSpec}}](${aName},${bName})`);
      }
    } else {
      // >-< inward endpoint arrows need a short extension outside each endpoint
      // to orient arrowheads toward the segment interior.
      const tailFrac = Math.max(0.02, Math.min(0.14, 0.03 + 0.03 * effectiveScale));
      const tNeg = fmt(-tailFrac);
      rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}]($(${aName})!${tNeg}!(${bName})$,${aName})`);
      rawTexs.push(`\\tkzDrawSegment[${drawStyleForward}]($(${bName})!${tNeg}!(${aName})$,${bName})`);
    }
  }

  if (rawTexs.length === 0) return null;
  return { kind: "raw", tex: rawTexs.join("\n") };
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
  metrics?: { pathLengthWorld?: number; screenPxPerWorld?: number },
  arcDef?: { center: { x: number; y: number }; radius: number; startRad: number; sweepRad: number },
  arrowTipOptions?: { bend?: boolean; flex?: boolean }
): string | null {
  const arrows = Array.isArray(styleArrows) ? styleArrows : styleArrows ? [styleArrows] : [];
  const results: string[] = [];

  for (const arrow of arrows) {
    if (!arrow?.enabled) continue;
    ensureSupportedArrowDirection(arrow.direction, "PathArrowMark");
    const tip = resolveArrowTipName(arrow.tip, "PathArrowMark");
    const arrowColor = rgbColorExpr(arrow.color ?? base.strokeColor);
    const opacity = normalizedOpacity(base.opacity);
    const sourceStrokeWidth = resolveArrowSourceWidth(undefined, base.strokeWidth);
    const arrowWidth = Math.max(0.1, sourceStrokeWidth * PATH_ARROW_WIDTH_EXPORT_SCALE);
    // User snippet requires scale=0.75 for arcs/paths.
    const effectiveScale = clampPositive(arrow.sizeScale ?? DEFAULT_PATH_ARROW_UI, 0.1, 20) * 0.75;
    const arrowWidthUi = resolvePathArrowWidthUi(arrow.lineWidthPt);

    // Bending fix: Use scale=1.0 for the arrow command so TikZ bending calculations
    // see the true physical size relative to the path. Bake the scale into dimensions.
    const arrowScaleCommand = 1.0;

    const tipMetrics = resolvePathArrowTipMetricsPx(tip, 1.0, arrowWidthUi, "PathArrowMark", arrow.arrowLength);
    const tipSpec = resolveArrowTipSpec(
      tip,
      tipMetrics.lengthPx * CANVAS_PX_TO_TIKZ_PT * effectiveScale,
      tipMetrics.widthPx * CANVAS_PX_TO_TIKZ_PT * effectiveScale,
      { ...arrowTipOptions, opacity: arcDef ? opacity : undefined }
    );

    // Standard opts for Markings (Deco)
    const arrowOptsMarking = `color=${arrowColor},line width=${fmt(arrowWidth)}pt,scale=${fmt(arrowScaleCommand)}${opacity < 0.999 ? `,opacity=${fmt(opacity)}` : ""
      }`;

    // Opts for Constructive Path (Flex)
    const arrowOptsConstructive = `color=${arrowColor},line width=${fmt(arrowWidth)}pt,scale=${fmt(
      arrowScaleCommand
    )},draw opacity=0`;

    const forwardCmd = `\\arrow[${arrowOptsMarking}]{${tipSpec}}`;
    const reverseCmd = `\\arrowreversed[${arrowOptsMarking}]{${tipSpec}}`;
    const pairDelta = computePathArrowPairDelta(
      tipMetrics.pairSeparationPx * effectiveScale,
      metrics?.pathLengthWorld,
      metrics?.screenPxPerWorld,
      arrow.pairGapPx
    );
    const positions = collectPathArrowPositions(arrow, fallbackPos);
    const marks: string[] = [];
    const paths: string[] = [];

    const addMark = (pos: number, command: string) => {
      marks.push(`mark=at position ${fmt(clamp01(pos))} with {${command}}`);
    };

    const addConstructivePath = (pos: number, reversed: boolean) => {
      if (!arcDef) return;
      const isCCW = arcDef.sweepRad >= 0;
      const targetRad = arcDef.startRad + arcDef.sweepRad * clamp01(pos);
      const epsilon = 0.2;
      const aEnd = targetRad;
      const aStart = targetRad - (isCCW ? epsilon : -epsilon);
      const pCenter = arcDef.center;
      const r = arcDef.radius;
      const startDeg = (aStart * 180) / Math.PI;
      const endDeg = (aEnd * 180) / Math.PI;
      const arcPath = `(${fmt(pCenter.x + Math.cos(aStart) * r)},${fmt(
        pCenter.y + Math.sin(aStart) * r
      )}) arc (${fmt(startDeg)}:${fmt(endDeg)}:${fmt(r)})`;
      const finalTipSpec = reversed ? tipSpec.replace(/\]$/, ",reversed]") : tipSpec;
      paths.push(`\\draw[${arrowOptsConstructive}, -{${finalTipSpec}}] ${arcPath};`);
    };

    for (let i = 0; i < positions.length; i += 1) {
      const p = positions[i];
      if (arrow.direction === "->") {
        if (arcDef) addConstructivePath(p, false);
        else addMark(p, forwardCmd);
      } else if (arrow.direction === "<-") {
        if (arcDef) addConstructivePath(p, true);
        else addMark(p, reverseCmd);
      } else if (arrow.direction === "<->") {
        if (arcDef) {
          addConstructivePath(p - pairDelta, true);
          addConstructivePath(p + pairDelta, false);
        } else {
          addMark(p - pairDelta, reverseCmd);
          addMark(p + pairDelta, forwardCmd);
        }
      } else {
        if (arcDef) {
          addConstructivePath(p - pairDelta, false);
          addConstructivePath(p + pairDelta, true);
        } else {
          addMark(p - pairDelta, forwardCmd);
          addMark(p + pairDelta, reverseCmd);
        }
      }
    }

    if (arcDef) {
      results.push(paths.join("\n"));
    } else if (marks.length > 0) {
      const opts: string[] = ["postaction=decorate", `decoration={markings,${marks.join(",")}}`];
      if (opacity < 0.999) opts.push(`opacity=${fmt(opacity)}`);
      results.push(`\\path[${opts.join(", ")}] ${pathExpr};`);
    }
  }

  return results.length > 0 ? results.join("\n") : null;
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

function resolveArrowTipName(
  tip: unknown,
  context: "SegmentArrowMark" | "PathArrowMark"
): "Stealth" | "Latex" | "Triangle" {
  if (tip === undefined || tip === null || tip === "") return "Stealth";
  if (tip === "Stealth" || tip === "Latex" || tip === "Triangle") return tip;
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

function resolvePathArrowWidthUi(lineWidthPt: unknown): number {
  if (!Number.isFinite(lineWidthPt) || (lineWidthPt as number) <= 0) return DEFAULT_PATH_ARROW_UI;
  return clampPositive((lineWidthPt as number) / PATH_ARROW_WIDTH_UI_FACTOR, 0.2, 12);
}

function resolvePathArrowTipMetricsPx(
  tip: "Stealth" | "Latex" | "Triangle",
  _arrowScale: number,
  widthUi: number,
  context: "SegmentArrowMark" | "PathArrowMark",
  arrowLength?: number
): { lengthPx: number; widthPx: number; pairSeparationPx: number } {
  // If arrowLength is provided, use it as the base size (uncoupled from scale).
  // Base length: arrowLength is now a multiplier (default 1.0).
  // 1.0 corresponds to 16.8px, matching the tuned `(1,1,3) -> 15.12pt` visually.
  // For PathArrowMark (Arcs), reduce by 0.9x to match user requirement (9pt vs 10pt).
  const contextScale = context === "PathArrowMark" ? 0.9 : 1.0;
  const baseSize = (arrowLength ?? 1.0) * 16.8 * contextScale;

  const widthScale = Math.sqrt(Math.max(0.2, Math.min(12, widthUi)));
  const profile =
    tip === "Latex"
      ? { lengthMul: 0.95, wingMul: 0.34 }
      : tip === "Triangle"
        ? { lengthMul: 1.071, wingMul: 0.56 } // Tuned to 9.0pt (from 8.4pt)
        : { lengthMul: 1.2, wingMul: 0.44 };

  // If arrowLength is explicit, we don't multiply by profile.lengthMul because 
  // the user likely interprets "Length" as the total length.
  // But for "Stealth", the visual length including notch might differ.
  // Let's stick to using baseSize as the driver.
  const lengthPx = Math.max(4, baseSize * profile.lengthMul);

  // Width calculation
  // We want width to be independent of length (matching Canvas logic).
  // Canvas uses a fixed reference size (24) equivalent.
  // Here we use the raw definition: 16.8 base size (unscaled by arrowLength).
  const widthBase = 16.8;
  const halfWidthPx = Math.max(1.2, widthBase * profile.wingMul * widthScale);
  const widthPx = halfWidthPx * 2;

  const pairSeparationPx = Math.max(3, Math.max(baseSize * 0.9, baseSize * 0.65 * widthScale));
  return { lengthPx, widthPx, pairSeparationPx };
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
  style: SceneModel["angles"][number]["style"],
  vertexWorld: { x: number; y: number },
  options: TikzExportOptions
): string {
  const dx = style.labelPosWorld.x - vertexWorld.x;
  const dy = style.labelPosWorld.y - vertexWorld.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist <= 1e-9) {
    throw new Error("Unsupported Angle style: labelPosWorld is invalid.");
  }
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const labelFontScale = clampPositive(options.angleLabelFontScale ?? 1, 0.01, 100);
  const fontPt = Math.max(6, Math.min(72, style.textSize * labelFontScale));
  // Keep angle-label baseline spacing at 3/4 of the previous "original" export
  // profile (12pt -> 16.2pt), so 9pt maps to 12.15pt.
  const lineHeightPt = Math.max(6, fontPt * 1.35);
  return [
    `dist=${fmt(dist)}`,
    `angle=${fmt(angleDeg)}`,
    `text=${rgbColorExpr(style.textColor)}`,
    `font=\\fontsize{${fmt(fontPt)}pt}{${fmt(lineHeightPt)}pt}\\selectfont`,
  ].join(", ");
}

function sectorDrawStyleToTikz(style: SceneModel["angles"][number]["style"], options: TikzExportOptions): string {
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
  const opts: string[] = [
    `color=${rgbColorExpr(strokeColor)}`,
    `line width=${fmt(widthPt)}pt`,
  ];
  if (dash === "dashed") {
    const onPt = Math.max(1.5, Math.min(12, 3 * widthPt));
    const offPt = Math.max(2, Math.min(16, 4 * widthPt));
    opts.push(`dash pattern=on ${fmt(onPt)}pt off ${fmt(offPt)}pt`);
  }
  if (dash === "dotted") {
    // Use explicit round-cap dots so thick dotted strokes stay dotted (not tiny dashes).
    const offPt = Math.max(1.8, Math.min(20, 3.2 * widthPt));
    opts.push("line cap=round");
    opts.push(`dash pattern=on 0pt off ${fmt(offPt)}pt`);
  }
  if (opacity < 0.999) opts.push(`opacity=${fmt(clamp01(opacity))}`);
  return opts.join(", ");
}

function strokeWidthToTikzPt(strokeWidth: number, options: TikzExportOptions): number {
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const pxToPt = TIKZ_EXPORT_CALIBRATION.pointConversion.matchCanvasPxToPt;
  return Math.max(0.1, strokeWidth * lineScale * pxToPt);
}

function mapPointShape(shape: ScenePoint["style"]["shape"]): string {
  switch (shape) {
    case "square":
      return "rectangle";
    case "diamond":
      return "diamond";
    case "triUp":
      return "regular polygon, regular polygon sides=3";
    case "triDown":
      return "regular polygon, regular polygon sides=3, shape border rotate=180";
    case "dot":
      return "circle";
    case "circle":
    case "plus":
    case "x":
    case "cross":
    default:
      return "circle";
  }
}

function pointLabelOptionsToTikz(_point: ScenePoint, placement: LabelPlacement | null, _exportOptions: TikzExportOptions): string {
  const opts: string[] = [];
  const xShiftPt = placement?.xShiftPt ?? 12;
  const yShiftPt = placement?.yShiftPt ?? 12;
  const rawXShiftPt = placement?.rawXShiftPt ?? xShiftPt;
  const rawYShiftPt = placement?.rawYShiftPt ?? yShiftPt;
  // Keep quadrant stable from user drag offset, so labels don't flip due to
  // collision-spread/min-clear post-processing.
  opts.push(directionOptionFromShift(rawXShiftPt, rawYShiftPt));
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

function normalize2(v: { x: number; y: number }): { x: number; y: number } {
  const d = Math.hypot(v.x, v.y);
  if (d < 1e-9) return { x: 0.7071, y: 0.7071 };
  return { x: v.x / d, y: v.y / d };
}

function computeLabelPlacementMap(scene: SceneModel, options: TikzExportOptions): Map<string, LabelPlacement> {
  const result = new Map<string, LabelPlacement>();
  const scale = clampPositive(options.worldToTikzScale ?? 1, 0.01, 100);
  const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
  const ptPerPxForShift = 0.75 / scale;
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
    let dxPx = point.style.labelOffsetPx.x + Math.cos(angle) * spread;
    let dyPx = point.style.labelOffsetPx.y + Math.sin(angle) * spread;

    // Keep label clear of marker even if user offset is tiny.
    const metrics = pointStyleMetricsPx(point, pointScale);
    const text = point.showLabel === "caption" ? point.captionTex || point.name : point.name;
    const labelRpx = computeLabelBubbleRadiusPx(text, point.style.labelFontPx, point.style.labelHaloWidthPx);
    const minClearPx = metrics.markerRadiusPx + labelRpx + Math.max(2, point.style.labelHaloWidthPx * 0.35);
    const dist = Math.hypot(dxPx, dyPx);
    if (dist < minClearPx) {
      const dir = dist > 1e-6 ? { x: dxPx / dist, y: dyPx / dist } : normalize2({ x: 1, y: -1 });
      dxPx = dir.x * minClearPx;
      dyPx = dir.y * minClearPx;
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

function computeLabelBubbleRadiusPx(text: string, labelFontPx: number, haloWidthPx: number): number {
  const fontPx = Math.max(6, Math.min(48, labelFontPx));
  const content = (text && text.length > 0 ? text : "X").replace(/\\[a-zA-Z]+|[{}$]/g, "");
  const textLen = Math.max(1, content.length);
  const widthPx = Math.max(fontPx * 0.62, textLen * fontPx * 0.5);
  const heightPx = fontPx * 0.92;
  const baseRadius = Math.max(widthPx, heightPx) * 0.5;
  const haloPad = Math.max(0.8, haloWidthPx * 0.25);
  return baseRadius + haloPad;
}

function rgbColorExpr(hex: string): string {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    /^[0-9a-fA-F]{6}$/.test(clean)
      ? clean
      : /^[0-9a-fA-F]{3}$/.test(clean)
        ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
        : "000000";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `{rgb,255:red,${r};green,${g};blue,${b}}`;
}

function hoistNamedColors(lines: string[]): string[] {
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
        name = toName(r, g, b);
        colorMap.set(key, name);
        colorDefs.push(`\\definecolor{${name}}{RGB}{${r},${g},${b}}`);
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

function injectOptionalTikzLibraries(lines: string[]): string[] {
  const beginIdx = lines.findIndex((line) => line.trim().startsWith("\\begin{tikzpicture}"));
  if (beginIdx < 0) return lines;

  let needsPatterns = false;
  let needsPatternsMeta = false;
  let needsDecorationsMarkings = false;
  let needsArrowsMeta = false;
  const patternRegex = /pattern\s*=|pattern color\s*=/;
  const patternMetaRegex = /pattern\s*=\s*\{/;
  const decorationRegex = /postaction\s*=\s*decorate|decoration\s*=\s*\{markings/i;
  const arrowTipRegex =
    /-\{(?:Stealth|Latex|Triangle)\[[^\]]*\]|\\arrow(?:reversed)?\[[^\]]*\]\{(?:Stealth|Latex|Triangle)(?:\[[^\]]*\])?\}/;
  for (const line of lines) {
    if (patternMetaRegex.test(line)) {
      needsPatternsMeta = true;
      needsPatterns = true;
    } else if (patternRegex.test(line)) {
      needsPatterns = true;
    }
    if (decorationRegex.test(line)) needsDecorationsMarkings = true;
    if (arrowTipRegex.test(line)) needsArrowsMeta = true;
  }

  const libraryLines: string[] = [];
  if (needsPatterns) {
    libraryLines.push(needsPatternsMeta ? "\\usetikzlibrary{patterns,patterns.meta}" : "\\usetikzlibrary{patterns}");
  }
  if (needsDecorationsMarkings) {
    const suffix = needsArrowsMeta ? ",arrows.meta,bending" : "";
    libraryLines.push(`\\usetikzlibrary{decorations.markings${suffix}}`);
  } else if (needsArrowsMeta) {
    libraryLines.push("\\usetikzlibrary{arrows.meta,bending}");
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
  return value;
}

function wrapPlainTextForMathMode(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\textbackslash ")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
  return `\\mbox{${escaped}}`;
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
  return deg.toFixed(2);
}
