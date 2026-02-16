import { circleCircleIntersections, distance, lineCircleIntersectionBranches } from "../geo/geometry";
import { resolveAngleRightStatus } from "../domain/rightAngleProvenance";
import { normalizeSceneIntegrity } from "../domain/sceneIntegrity";
import {
  computeOrientedAngleRad,
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  type GeometryObjectRef,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";
import tkzMacroWhitelist from "../../docs/tkz-euclide-macros.json";
import { assertNoUnknownTkzMacro } from "./tkzWhitelist";

export type TikzExportViewport = { xmin: number; xmax: number; ymin: number; ymax: number };
export type TikzExportOptions = {
  viewport?: TikzExportViewport;
  clipRectWorld?: TikzExportViewport;
  clipPolygonWorld?: { x: number; y: number }[];
  clipSpace?: number;
  globalLineAdd?: number;
  pointScale?: number;
  lineScale?: number;
  labelScale?: number;
  worldToTikzScale?: number;
  screenPxPerWorld?: number;
  matchCanvas?: boolean;
  labelGlow?: boolean;
  segmentStrokeScale?: number;
  pointStrokeScale?: number;
  pointInnerSepFixedPt?: number;
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
  | { kind: "DefPoint"; name: string; x: number; y: number }
  | { kind: "DefPointOnLine"; name: string; a: string; b: string }
  | { kind: "DefPointByRotation"; name: string; center: string; point: string; angleDeg: number; direction: "CCW" | "CW" }
  | { kind: "DefPointByTranslation"; name: string; point: string; from: string; to: string }
  | { kind: "DefPointByDilation"; name: string; point: string; center: string; factor: number }
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
  | { kind: "DefCircleCircumCenter"; centerName: string; a: string; b: string; c: string }
  | { kind: "DefPointOnCircle"; name: string; center: string; through: string; theta: number }
  | { kind: "DefMidPoint"; name: string; a: string; b: string }
  | { kind: "InterLL"; name: string; a1: string; a2: string; b1: string; b2: string }
  | {
      kind: "InterLC";
      name: string;
      lineA: string;
      lineB: string;
      circleO: string;
      circleX: string;
      branch: 0 | 1;
      common?: string;
      selector?: { name: string; x: number; y: number };
    }
  | {
      kind: "InterCC";
      name: string;
      circleAO: string;
      circleAX: string;
      circleBO: string;
      circleBX: string;
      branch: 0 | 1;
      common?: string;
      selector?: { name: string; x: number; y: number };
    }
  | { kind: "DrawSegment"; a: string; b: string; style?: string }
  | { kind: "MarkSegment"; a: string; b: string; style: string }
  | { kind: "DrawRaw"; tex: string }
  | { kind: "DrawLine"; a: string; b: string; addLeft: number; addRight: number; style?: string }
  | { kind: "DrawCircle"; o: string; x: string; style?: string }
  | { kind: "DrawCircleRadius"; o: string; radius: number; style?: string }
  | { kind: "DrawSector"; o: string; a: string; b: string; style?: string }
  | { kind: "FillSector"; o: string; a: string; b: string; style?: string }
  | { kind: "FillAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "MarkAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "MarkRightAngle"; a: string; b: string; c: string; style?: string }
  | { kind: "LabelAngle"; a: string; b: string; c: string; text: string; style?: string }
  | { kind: "DrawPoints"; style: string; points: string[] }
  | { kind: "LabelPoints"; points: string[] }
  | { kind: "LabelPoint"; name: string; text: string; options?: string; useGlow?: boolean };

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

// Canvas arrow-width slider values are visually calibrated in canvas pixels.
// Export them to TikZ pt using this empirically matched conversion:
// 7.6 (canvas) -> 0.6pt (TikZ).
const PATH_ARROW_WIDTH_EXPORT_SCALE = 0.6 / 7.6;

export function buildTikzIR(scene: SceneModel, options: TikzExportOptions = {}): TikzCommand[] {
  const pointById = new Map(scene.points.map((p) => [p.id, p]));
  const lineById = new Map(scene.lines.map((l) => [l.id, l]));
  const segById = new Map(scene.segments.map((s) => [s.id, s]));
  const circleById = new Map(scene.circles.map((c) => [c.id, c]));

  const pointName = buildPointNameMap(scene.points);

  const defs: TikzCommand[] = [];
  const constructions: TikzCommand[] = [];
  const draws: TikzCommand[] = [];
  const definedPointIds = new Set<string>();

  const freeItems: Array<{ name: string; x: number; y: number }> = [];
  const viewport = options.viewport ?? computeExportViewport(scene);
  let coordScale = clampPositive(options.worldToTikzScale ?? 1, 0.01, 100);
  const labelScale = clampPositive(options.labelScale ?? 1, 0.1, 10);
  // Auto-fit viewport for document embedding when canvas-match export is enabled.
  // Fit both down and up so exported framing matches the current canvas view density.
  if (options.matchCanvas) {
    const maxWidthCm = clampPositive(options.autoScaleToFitCm?.maxWidthCm ?? 14, 1, 200);
    const maxHeightCm = clampPositive(options.autoScaleToFitCm?.maxHeightCm ?? 9, 1, 200);
    const worldWidth = Math.max(1e-9, Math.abs(viewport.xmax - viewport.xmin));
    const worldHeight = Math.max(1e-9, Math.abs(viewport.ymax - viewport.ymin));
    const fitScale = Math.min(maxWidthCm / worldWidth, maxHeightCm / worldHeight);
    coordScale = clampPositive(coordScale * fitScale, 0.01, 100);
  }
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
    const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
    // Slightly expand explicit clip rectangle to avoid antialias/stroke edge shaving.
    const clipPadWorld = 14 / pxPerWorld;
    defs.push({
      kind: "ClipRect",
      xmin: Math.min(options.clipRectWorld.xmin, options.clipRectWorld.xmax) - clipPadWorld,
      xmax: Math.max(options.clipRectWorld.xmin, options.clipRectWorld.xmax) + clipPadWorld,
      ymin: Math.min(options.clipRectWorld.ymin, options.clipRectWorld.ymax) - clipPadWorld,
      ymax: Math.max(options.clipRectWorld.ymin, options.clipRectWorld.ymax) + clipPadWorld,
    });
  }
  if (options.clipPolygonWorld && options.clipPolygonWorld.length >= 3) {
    const pxPerWorld = clampPositive(options.screenPxPerWorld ?? 80, 1, 20000);
    const clipPadWorld = 14 / pxPerWorld;
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
  let selectorIndex = 0;
  let derivedAuxIndex = 0;
  const circleThroughNameById = new Map<string, string>();
  const circleCenterNameById = new Map<string, string>();

  const newSelectorName = (kind: "LC" | "CC"): string => {
    selectorIndex += 1;
    return `tkzSel${kind}_${selectorIndex}`;
  };

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
    ensureCircleCenterName(circleId);
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
      const anchorsWorld = getLineWorldAnchors(line, scene);
      if (!anchorsWorld) {
        throw new Error(`Cannot export undefined circle-circle tangent geometry: ${line.id}`);
      }
      const circleA = circleById.get(line.circleAId);
      const circleB = circleById.get(line.circleBId);
      if (!circleA || !circleB) {
        throw new Error(`Cannot export undefined circle-circle tangent geometry: ${line.id}`);
      }
      const geomA = circleGeomById(circleA.id);
      const geomB = circleGeomById(circleB.id);
      const simMode: "outer" | "inner" = line.family === "outer" ? "outer" : "inner";
      const simWorld = resolveCircleSimilitudeCenter(geomA.center, geomA.radius, geomB.center, geomB.radius, simMode);
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

        let tangentAName = tangentFirstName;
        if (tangentCandidatesA.length > 1) {
          const d0 = distance(tangentCandidatesA[0], anchorsWorld.a);
          const d1 = distance(tangentCandidatesA[1], anchorsWorld.a);
          tangentAName = d1 < d0 ? tangentSecondName : tangentFirstName;
        }
        let tangentBName = tangentBFirstName;
        if (tangentCandidatesB.length > 1) {
          const d0 = distance(tangentCandidatesB[0], anchorsWorld.b);
          const d1 = distance(tangentCandidatesB[1], anchorsWorld.b);
          tangentBName = d1 < d0 ? tangentBSecondName : tangentBFirstName;
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
      const through = { x: center.x + geom.radius, y: center.y };
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
      if (point.excludePointId) {
        const excluded = getPointWorldPosCached(scene, point.excludePointId);
        if (excluded) {
          const ROOT_EPS = 1e-6;
          const hasOther = roots.some((r) => distance(r.point, excluded) > ROOT_EPS);
          if (!hasOther) {
            visiting.delete(pointId);
            visited.add(pointId);
            return;
          }
        }
      }
      let selector: { name: string; x: number; y: number } | undefined;
      if (!commonName) {
        const other = inferOtherLineCircleBranchPointFromWorld(lineWorld.a, lineWorld.b, center, through, branch);
        if (other) {
          selector = { name: newSelectorName("LC"), x: other.x, y: other.y };
          commonName = selector.name;
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
        selector,
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
      let selector: { name: string; x: number; y: number } | undefined;
      if (!commonName) {
        const other = inferOtherLineCircleBranchPointFromWorld(wa, wb, center, through, branch);
        if (other) {
          selector = { name: newSelectorName("LC"), x: other.x, y: other.y };
          commonName = selector.name;
        }
      }
      constructions.push({
        kind: "InterLC",
        name,
        lineA: segAName,
        lineB: segBName,
        circleO: circleCenterName,
        circleX: circleThroughName,
        branch,
        common: commonName,
        selector,
      });
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
      const cBThrough = { x: cBGeom.center.x + cBGeom.radius, y: cBGeom.center.y };
      const branch: 0 | 1 = point.branchIndex;
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
      let selector: { name: string; x: number; y: number } | undefined;
      if (!commonName) {
        const other = inferOtherCircleCircleBranchPoint(cAGeom.center, cAThrough, cBGeom.center, cBThrough, branch);
        if (other) {
          selector = { name: newSelectorName("CC"), x: other.x, y: other.y };
          commonName = selector.name;
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
        selector,
      });
      definedPointIds.add(point.id);
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
          let selector: { name: string; x: number; y: number } | undefined;
          if (!commonName) {
            const other = inferOtherCircleCircleBranchPoint(cAGeom.center, cAThrough, cBGeom.center, cBThrough, branch);
            if (other) {
              selector = { name: newSelectorName("CC"), x: other.x, y: other.y };
              commonName = selector.name;
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
            selector,
          });
          definedPointIds.add(point.id);
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
          let commonName: string | undefined;
          if (branch === 1) {
            const sibling = scene.points.find(
              (p) =>
                p.kind === "intersectionPoint" &&
                p.id !== point.id &&
                sameObjectPair(p.objA, p.objB, point.objA, point.objB) &&
                definedPointIds.has(p.id)
            );
            if (sibling) commonName = mustName(pointName, sibling.id);
          }
          if (!commonName) {
            commonName = inferLineCircleCommonFromEndpointsWorld(
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
          let selector: { name: string; x: number; y: number } | undefined;
          if (!commonName) {
            const other = inferOtherLineCircleBranchPointFromWorld(mixed.ll.worldA, mixed.ll.worldB, center, through, branch);
            if (other) {
              selector = { name: newSelectorName("LC"), x: other.x, y: other.y };
              commonName = selector.name;
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
            common: commonName,
            selector,
          });
          definedPointIds.add(point.id);
        }
      }
    }

    visiting.delete(pointId);
    visited.add(pointId);
  };

  for (const point of scene.points) {
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
    draws.push({
      kind: "DrawSegment",
      a: aName,
      b: bName,
      style: segmentStyleToTikz(seg.style, options),
    });
    const markStyle = segmentMarkToTikz(
      seg.style.segmentMark,
      seg.style.strokeColor,
      seg.style.strokeWidth,
      seg.style.opacity,
      options
    );
    if (markStyle) {
      draws.push({
        kind: "MarkSegment",
        a: aName,
        b: bName,
        style: markStyle,
      });
    }
    const arrowOverlay = segmentArrowOverlayToTikz(seg.style.segmentArrowMark, aName, bName, {
      strokeColor: seg.style.strokeColor,
      strokeWidth: seg.style.strokeWidth,
      opacity: seg.style.opacity,
    });
    if (arrowOverlay) {
      if (arrowOverlay.kind === "tkz") {
        draws.push({
          kind: "DrawSegment",
          a: aName,
          b: bName,
          style: arrowOverlay.style,
        });
      } else {
        draws.push({
          kind: "DrawRaw",
          tex: arrowOverlay.tex,
        });
      }
    }
  }
  for (const line of scene.lines) {
    if (!line.visible) continue;
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
    draws.push({
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
    if (circle.kind === "fixedRadius") {
      const geom = circleGeomById(circle.id);
      if (!Number.isFinite(geom.radius) || geom.radius <= 0) {
        throw new Error(`Unsupported construction: CircleFixedRadius (invalid radius for ${circle.id})`);
      }
      draws.push({
        kind: "DrawCircleRadius",
        o: centerName,
        radius: geom.radius,
        style: circleStyleToTikz(circle.style, options),
      });
    } else if (circle.kind === "threePoint") {
      if (!definedPointIds.has(circle.aId) || !definedPointIds.has(circle.bId) || !definedPointIds.has(circle.cId)) {
        throw new Error(`Cannot export undefined circle geometry: ${circle.id}`);
      }
      draws.push({
        kind: "DrawCircle",
        o: centerName,
        x: mustName(pointName, circle.aId),
        style: circleStyleToTikz(circle.style, options),
      });
    } else {
      if (!definedPointIds.has(circle.throughId)) {
        throw new Error(`Cannot export undefined circle geometry: ${circle.id}`);
      }
      draws.push({
        kind: "DrawCircle",
        o: centerName,
        x: mustName(pointName, circle.throughId),
        style: circleStyleToTikz(circle.style, options),
      });
    }
    const circleGeom = circleGeomById(circle.id);
    const circleThroughName = ensureCircleThroughName(circle.id);
    let throughWorld: { x: number; y: number } | null = null;
    if (circle.kind === "fixedRadius") {
      throughWorld = { x: circleGeom.center.x + circleGeom.radius, y: circleGeom.center.y };
    } else if (circle.kind === "threePoint") {
      throughWorld = getPointWorldPosCached(scene, circle.aId);
    } else {
      throughWorld = getPointWorldPosCached(scene, circle.throughId);
    }
    if (!throughWorld) {
      throw new Error(`Cannot export undefined circle geometry: ${circle.id}`);
    }
    const circleStartRad = Math.atan2(throughWorld.y - circleGeom.center.y, throughWorld.x - circleGeom.center.x);
    const circleArrowOverlay = pathArrowOverlayToTikz(
      circle.style.arrowMark,
      circlePathExprFromNamedStart(circleThroughName, circleGeom.radius, circleStartRad),
      {
        strokeColor: circle.style.strokeColor,
        strokeWidth: circle.style.strokeWidth,
        opacity: circle.style.strokeOpacity,
      },
      0.5
    );
    if (circleArrowOverlay) {
      draws.push({ kind: "DrawRaw", tex: circleArrowOverlay });
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
    const style = polygonStyleToTikz(polygon.style, options);
    const path = names.map((name, idx) => (idx === 0 ? `(${name})` : ` -- (${name})`)).join("");
    const opts = style ? `[${style}]` : "";
    draws.push({ kind: "DrawRaw", tex: `\\draw${opts} ${path} -- cycle;` });
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
        draws.push({ kind: "FillSector", o: bName, a: aName, b: cName, style: fillStyle });
      }
      draws.push({
        kind: "DrawSector",
        o: bName,
        a: aName,
        b: cName,
        style: sectorDrawStyleToTikz(angle.style, options),
      });
      const sectorRadius = distance(aWorld, bWorld);
      const sectorStart = Math.atan2(aWorld.y - bWorld.y, aWorld.x - bWorld.x);
      const sectorArrowOverlay = pathArrowOverlayToTikz(
        angle.style.arcArrowMark,
        arcPathExprFromWorld(bWorld, sectorRadius, sectorStart, theta, `(${aName})`),
        {
          strokeColor: angle.style.strokeColor,
          strokeWidth: angle.style.strokeWidth,
          opacity: angle.style.strokeOpacity,
        },
        angle.style.markPos ?? 0.5
      );
      if (sectorArrowOverlay) {
        draws.push({ kind: "DrawRaw", tex: sectorArrowOverlay });
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
      draws.push({ kind: "FillAngle", a: aName, b: bName, c: cName, style: fillStyle });
    }
    if (markKind === "rightSquare" || markKind === "rightArcDot") {
      const markStyle = angleMarkStyleToTikz(angle.style, true, options, markKind);
      const mergedStyle = rightSquareFillStyle ? [markStyle, rightSquareFillStyle].filter(Boolean).join(", ") : markStyle;
      draws.push({ kind: "MarkRightAngle", a: aName, b: bName, c: cName, style: mergedStyle });
    } else if (markKind === "arc") {
      const markStyle = angleMarkStyleToTikz(angle.style, false, options, markKind);
      draws.push({ kind: "MarkAngle", a: aName, b: bName, c: cName, style: markStyle });
    }
    if (markKind === "arc" || markKind === "rightArcDot") {
      const angleStart = Math.atan2(aWorld.y - bWorld.y, aWorld.x - bWorld.x);
      const arcRadius = nonSectorAngleRadiusWorldFromStyle(angle.style, options);
      const arcArrowOverlay = pathArrowOverlayToTikz(
        angle.style.arcArrowMark,
        arcPathExprFromWorld(bWorld, arcRadius, angleStart, theta),
        {
          strokeColor: angle.style.strokeColor,
          strokeWidth: angle.style.strokeWidth,
          opacity: angle.style.strokeOpacity,
        },
        angle.style.markPos ?? 0.5
      );
      if (arcArrowOverlay) {
        draws.push({ kind: "DrawRaw", tex: arcArrowOverlay });
      }
    }
    if (angle.style.showLabel || angle.style.showValue) {
      const labelText = buildAngleLabelTex(angle.style.labelText, angle.style.showLabel, angle.style.showValue, theta);
      if (labelText) {
        const labelStyle = angleLabelStyleToTikz(angle.style, bWorld, options);
        draws.push({ kind: "LabelAngle", a: aName, b: bName, c: cName, text: labelText, style: labelStyle });
      }
    }
  }

  const drawablePoints = scene.points.filter((point) => point.visible && definedPointIds.has(point.id));
  const pointStyleGroups = buildPointStyleGroups(drawablePoints, pointName, options);
  for (const group of pointStyleGroups) {
    draws.push({ kind: "DrawPoints", style: group.styleName, points: group.points } as TikzCommand);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draws[draws.length - 1] as any).styleExpr = group.styleExpr;
  }

  const labelPlacementById = computeLabelPlacementMap(scene, options);
  const labels: Array<{ name: string; text: string; options?: string; useGlow?: boolean }> = [];
  for (const point of scene.points) {
    if (!point.visible) continue;
    if (!definedPointIds.has(point.id)) continue;
    if (point.showLabel === "none") continue;
    const name = pointName.get(point.id);
    if (!name) continue;
    const labelOptions = pointLabelOptionsToTikz(point, labelPlacementById.get(point.id) ?? null, options);
    const matchCanvas = options.matchCanvas ?? false;
    const labelGlowEnabled = options.labelGlow ?? true;
    if (point.showLabel === "name") {
      labels.push({
        name,
        text: point.name || name,
        options: matchCanvas ? [labelOptions, `text=${rgbColorExpr(point.style.labelColor)}`].join(", ") : labelOptions,
        useGlow: labelGlowEnabled && matchCanvas && point.style.labelHaloWidthPx > 0,
      });
    } else {
      labels.push({
        name,
        text: point.captionTex || point.name || name,
        options: matchCanvas ? [labelOptions, `text=${rgbColorExpr(point.style.labelColor)}`].join(", ") : labelOptions,
        useGlow: labelGlowEnabled && matchCanvas && point.style.labelHaloWidthPx > 0,
      });
    }
  }
  labels.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of labels) {
    draws.push({ kind: "LabelPoint", name: item.name, text: item.text, options: item.options, useGlow: item.useGlow });
  }

  return [...defs, ...constructions, ...draws];
}

export function renderTikz(cmds: TikzCommand[]): string {
  const setupUnits = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupUnits" }> => c.kind === "SetupUnits");
  const setupLabelScale = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupLabelScale" }> => c.kind === "SetupLabelScale");
  const setupViewport = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupViewport" }> => c.kind === "SetupViewport");
  const setupLine = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupLine" }> => c.kind === "SetupLine");
  const clipRect = cmds.find((c): c is Extract<TikzCommand, { kind: "ClipRect" }> => c.kind === "ClipRect");
  const clipPolygon = cmds.find((c): c is Extract<TikzCommand, { kind: "ClipPolygon" }> => c.kind === "ClipPolygon");
  const pointsDefs = cmds.filter((c) => c.kind === "DefPoints");
  const pointDefs = cmds.filter((c) => c.kind === "DefPoint");
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
      c.kind !== "DrawSector" &&
      c.kind !== "FillSector" &&
      c.kind !== "FillAngle" &&
      c.kind !== "MarkAngle" &&
      c.kind !== "MarkRightAngle" &&
      c.kind !== "LabelAngle" &&
      c.kind !== "DrawPoints" &&
      c.kind !== "LabelPoints" &&
      c.kind !== "LabelPoint"
  );
  const drawObjects = cmds.filter(
    (c) =>
      c.kind === "DrawSegment" ||
      c.kind === "MarkSegment" ||
      c.kind === "DrawRaw" ||
      c.kind === "DrawLine" ||
      c.kind === "DrawCircle" ||
      c.kind === "DrawSector" ||
      c.kind === "FillSector" ||
      c.kind === "DrawCircleRadius" ||
      c.kind === "FillAngle" ||
      c.kind === "MarkAngle" ||
      c.kind === "MarkRightAngle"
  );
  const drawAngleLabels = cmds.filter((c): c is Extract<TikzCommand, { kind: "LabelAngle" }> => c.kind === "LabelAngle");
  const drawPoints = cmds.filter((c) => c.kind === "DrawPoints");
  const drawLabels = cmds.filter((c) => c.kind === "LabelPoints" || c.kind === "LabelPoint");
  const hasGlowLabels = drawLabels.some((c) => c.kind === "LabelPoint" && Boolean(c.useGlow));

  const out: string[] = [];
  const scale = setupUnits?.scale ?? 1;
  out.push(`\\begin{tikzpicture}[scale=${fmt(scale)},line cap=round,line join=round,>=triangle 45]`);
  if (hasGlowLabels) {
    // Reusable text halo macro using contour stroke (page-color aware).
    out.push(
      "\\newcommand{\\gdLabelGlow}[1]{\\begingroup\\contourlength{0.42pt}\\ifcsname thepagecolor\\endcsname\\contour{\\thepagecolor}{#1}\\else\\contour{white}{#1}\\fi\\endgroup}"
    );
  }
  // When explicit export clip rectangle is present, avoid tkz viewport clip to
  // prevent extra outer whitespace from a larger bounding box.
  if (setupViewport && !clipRect && !clipPolygon) {
    assertTkzMacro("tkzInit");
    assertTkzMacro("tkzClip");
    out.push(
      `\\tkzInit[xmin=${fmt(setupViewport.xmin)},xmax=${fmt(setupViewport.xmax)},ymin=${fmt(
        setupViewport.ymin
      )},ymax=${fmt(setupViewport.ymax)}]`
    );
    out.push(`\\tkzClip[space=${fmt(setupViewport.space)}]`);
  }
  if (setupLine) {
    assertTkzMacro("tkzSetUpLine");
    out.push(`\\tkzSetUpLine[add=${fmt(setupLine.addLeft)} and ${fmt(setupLine.addRight)}]`);
  }
  if (clipRect) {
    out.push(`\\clip (${fmt(clipRect.xmin)},${fmt(clipRect.ymin)}) rectangle (${fmt(clipRect.xmax)},${fmt(clipRect.ymax)});`);
  }
  if (clipPolygon && clipPolygon.points.length >= 3) {
    const path = clipPolygon.points.map((p) => `(${fmt(p.x)},${fmt(p.y)})`).join(" -- ");
    out.push(`\\clip ${path} -- cycle;`);
  }

  // Emit predefined styles used by tkzDrawPoints[...] commands.
  const pointStyles = extractPointStyles(cmds);
  for (const style of pointStyles) {
    out.push(`\\tikzset{${style.styleName}/.style={${style.styleExpr}}}`);
  }

  out.push("% Points");
  for (const cmd of pointsDefs) {
    assertTkzMacro("tkzDefPoints");
    const items = cmd.items.map((it) => `${fmt(it.x)}/${fmt(it.y)}/${it.name}`).join(", ");
    out.push(`\\tkzDefPoints{${items}}`);
  }
  for (const cmd of pointDefs) {
    assertTkzMacro("tkzDefPoint");
    out.push(`\\tkzDefPoint(${fmt(cmd.x)},${fmt(cmd.y)}){${cmd.name}}`);
  }

  out.push("% Constructions");
  let interLCTmpIdx = 0;
  for (const cmd of constructions) {
    if (cmd.kind === "DefMidPoint") {
      assertTkzMacro("tkzDefMidPoint");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefMidPoint(${cmd.a},${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnLine") {
      assertTkzMacro("tkzDefPointBy");
      assertTkzMacro("tkzGetPoint");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tRaw = (cmd as any).t;
      const t = typeof tRaw === "number" && Number.isFinite(tRaw) ? tRaw : 0.5;
      out.push(`\\tkzDefPointBy[homothety=center ${cmd.a} ratio ${fmt(t)}](${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointByRotation") {
      assertAngleFixedMacro("tkzDefPointBy");
      assertTkzMacro("tkzGetPoint");
      if (cmd.direction !== "CCW" && cmd.direction !== "CW") {
        throw new Error("Unsupported AngleFixed option: direction=CW (no tkz mapping)");
      }
      const signedAngle = cmd.direction === "CW" ? -Math.abs(cmd.angleDeg) : Math.abs(cmd.angleDeg);
      out.push(`\\tkzDefPointBy[rotation=center ${cmd.center} angle ${fmt(signedAngle)}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointByTranslation") {
      assertTkzMacro("tkzDefPointBy");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefPointBy[translation= from ${cmd.from} to ${cmd.to}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointByDilation") {
      assertTkzMacro("tkzDefPointBy");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefPointBy[homothety=center ${cmd.center} ratio ${fmt(cmd.factor)}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointByReflection") {
      assertTkzMacro("tkzDefPointBy");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefPointBy[projection=onto ${cmd.axisA}--${cmd.axisB}](${cmd.point}) \\tkzGetPoint{${cmd.footName}}`);
      out.push(`\\tkzDefPointBy[homothety=center ${cmd.footName} ratio -1](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPerpendicularLine") {
      assertPerpendicularMacro("tkzDefLine");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefLine[perpendicular=through ${cmd.through}](${cmd.baseA},${cmd.baseB}) \\tkzGetPoint{${cmd.auxName}}`);
      continue;
    }
    if (cmd.kind === "DefParallelLine") {
      assertParallelMacro("tkzDefLine");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefLine[parallel=through ${cmd.through}](${cmd.baseA},${cmd.baseB}) \\tkzGetPoint{${cmd.auxName}}`);
      continue;
    }
    if (cmd.kind === "DefCircleSimilitudeCenter") {
      const macro = cmd.mode === "outer" ? "tkzDefExtSimilitudeCenter" : "tkzDefIntSimilitudeCenter";
      assertTkzMacro(macro);
      assertTkzMacro("tkzGetPoint");
      out.push(`\\${macro}(${cmd.circleAO},${cmd.circleAX})(${cmd.circleBO},${cmd.circleBX}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefCircleTangentsFromPoint") {
      assertTkzMacro("tkzDefLine");
      assertTkzMacro("tkzGetPoints");
      out.push(
        `\\tkzDefLine[tangent from = ${cmd.from}](${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${cmd.firstName}}{${cmd.secondName}}`
      );
      continue;
    }
    if (cmd.kind === "DefAngleBisectorLine") {
      assertAngleBisectorMacro("tkzDefTriangleCenter");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefTriangleCenter[in](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.auxName}}`);
      continue;
    }
    if (cmd.kind === "DefCircleCircumCenter") {
      assertTkzMacro("tkzDefCircle");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefCircle[circum](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.centerName}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnCircle") {
      assertTkzMacro("tkzDefPointOnCircle");
      assertTkzMacro("tkzGetPoint");
      const deg = (cmd.theta * 180) / Math.PI;
      out.push(`\\tkzDefPointOnCircle[through = center ${cmd.center} angle ${fmt(deg)} point ${cmd.through}]`);
      out.push(`\\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLL") {
      assertTkzMacro("tkzInterLL");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzInterLL(${cmd.a1},${cmd.a2})(${cmd.b1},${cmd.b2}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLC") {
      if (cmd.selector) {
        assertTkzMacro("tkzDefPoint");
        out.push(`\\tkzDefPoint(${fmt(cmd.selector.x)},${fmt(cmd.selector.y)}){${cmd.selector.name}}`);
      }
      assertTkzMacro("tkzInterLC");
      assertTkzMacro("tkzGetPoints");
      const canSwap = cmd.lineA !== cmd.lineB;
      const shouldSwap = !cmd.common && canSwap && cmd.branch === 1;
      const la = shouldSwap ? cmd.lineB : cmd.lineA;
      const lb = shouldSwap ? cmd.lineA : cmd.lineB;
      interLCTmpIdx += 1;
      const other = `tkzInterLC_${interLCTmpIdx}_other`;
      const opt = cmd.common ? `[common=${cmd.common}]` : "";
      out.push(`\\tkzInterLC${opt}(${la},${lb})(${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${cmd.name}}{${other}}`);
      continue;
    }
    if (cmd.kind === "InterCC") {
      if (cmd.selector) {
        assertTkzMacro("tkzDefPoint");
        out.push(`\\tkzDefPoint(${fmt(cmd.selector.x)},${fmt(cmd.selector.y)}){${cmd.selector.name}}`);
      }
      assertTkzMacro("tkzInterCC");
      assertTkzMacro("tkzGetPoints");
      const canSwap = cmd.circleAO !== cmd.circleBO || cmd.circleAX !== cmd.circleBX;
      const shouldSwap = !cmd.common && canSwap && cmd.branch === 1;
      const ao = shouldSwap ? cmd.circleBO : cmd.circleAO;
      const ax = shouldSwap ? cmd.circleBX : cmd.circleAX;
      const bo = shouldSwap ? cmd.circleAO : cmd.circleBO;
      const bx = shouldSwap ? cmd.circleAX : cmd.circleBX;
      interLCTmpIdx += 1;
      const other = `tkzInterCC_${interLCTmpIdx}_other`;
      const opt = cmd.common ? `[common=${cmd.common}]` : "";
      out.push(`\\tkzInterCC${opt}(${ao},${ax})(${bo},${bx}) \\tkzGetPoints{${cmd.name}}{${other}}`);
    }
  }

  out.push("% Draw objects");
  let drawCircleRadiusTmpIdx = 0;
  for (const cmd of drawObjects) {
    if (cmd.kind === "DrawSegment") {
      assertTkzMacro("tkzDrawSegment");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawSegment${opts}(${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "MarkSegment") {
      assertTkzMacro("tkzMarkSegment");
      out.push(`\\tkzMarkSegment[${cmd.style}](${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawRaw") {
      out.push(cmd.tex);
    } else if (cmd.kind === "DrawLine") {
      assertTkzMacro("tkzDrawLine");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawLine${opts}(${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawCircle") {
      assertTkzMacro("tkzDrawCircle");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawCircle${opts}(${cmd.o},${cmd.x})`);
    } else if (cmd.kind === "DrawSector") {
      assertTkzMacro("tkzDrawSector");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "FillSector") {
      assertTkzMacro("tkzFillSector");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "DrawCircleRadius") {
      assertCircleFixedMacro("tkzDefCircle");
      assertCircleFixedMacro("tkzGetPoint");
      assertCircleFixedMacro("tkzDrawCircle");
      drawCircleRadiusTmpIdx += 1;
      const tmpThrough = `tkzCircleRDraw_${drawCircleRadiusTmpIdx}`;
      out.push(`\\tkzDefCircle[R](${cmd.o},${fmt(cmd.radius)}) \\tkzGetPoint{${tmpThrough}}`);
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawCircle${opts}(${cmd.o},${tmpThrough})`);
    } else if (cmd.kind === "FillAngle") {
      assertAngleMacro("tkzFillAngle", "Angle.fill");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkAngle") {
      assertAngleMacro("tkzMarkAngle", "Angle.mark");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkRightAngle") {
      assertAngleMacro("tkzMarkRightAngles", "Angle.markRight");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkRightAngles${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    }
  }

  out.push("% Draw points");
  for (const cmd of drawPoints) {
    if (cmd.points.length === 0) continue;
    assertTkzMacro("tkzDrawPoints");
    out.push(`\\tkzDrawPoints[${cmd.style}](${cmd.points.join(",")})`);
  }

  out.push("% Labels");
  const shouldScaleLabels = Boolean(setupLabelScale && Math.abs(setupLabelScale.scale - 1) > 1e-9);
  if (shouldScaleLabels) {
    out.push(`\\begin{scope}[every node/.style={scale=${fmt(setupLabelScale!.scale)}}]`);
  }
  for (const cmd of drawAngleLabels) {
    assertAngleMacro("tkzLabelAngle", "Angle.label");
    const opts = cmd.style ? `[${cmd.style}]` : "";
    out.push(`\\tkzLabelAngle${opts}(${cmd.a},${cmd.b},${cmd.c}){$${escapeTikzText(cmd.text)}$}`);
  }
  for (const cmd of drawLabels) {
    if (cmd.kind === "LabelPoints") {
      if (cmd.points.length === 0) continue;
      assertTkzMacro("tkzLabelPoints");
      out.push(`\\tkzLabelPoints(${cmd.points.join(",")})`);
      continue;
    }
    assertTkzMacro("tkzLabelPoint");
    const opts = cmd.options ? `[${cmd.options}]` : "";
    const labelText = cmd.useGlow
      ? `\\gdLabelGlow{$${escapeTikzText(cmd.text)}$}`
      : `$${escapeTikzText(cmd.text)}$`;
    out.push(`\\tkzLabelPoint${opts}(${cmd.name}){${labelText}}`);
  }
  if (shouldScaleLabels) {
    out.push("\\end{scope}");
  }

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
  return tex;
}

export function exportTikzWithOptions(scene: SceneModel, options: TikzExportOptions): string {
  const normalizedScene = normalizeSceneIntegrity(scene);
  // Scene can be updated frequently; reset per-scene memoized lookups before each export.
  pointByIdCache.delete(normalizedScene);
  pointWorldCache.delete(normalizedScene);
  const tex = renderTikz(buildTikzIR(normalizedScene, options));
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
    add(vertex.x, vertex.y);
    const r = Math.max(0, angle.style.arcRadius);
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

function inferOtherLineCircleBranchPointFromWorld(
  lineA: { x: number; y: number },
  lineB: { x: number; y: number },
  circleO: { x: number; y: number },
  circleX: { x: number; y: number },
  selectedBranch: 0 | 1
): { x: number; y: number } | null {
  const radius = distance(circleO, circleX);
  const branches = lineCircleIntersectionBranches(lineA, lineB, circleO, radius);
  if (branches.length < 2) return null;
  const idx = selectedBranch === 0 ? 1 : 0;
  return branches[idx].point;
}

function inferOtherCircleCircleBranchPoint(
  aCenter: { x: number; y: number },
  aThrough: { x: number; y: number },
  bCenter: { x: number; y: number },
  bThrough: { x: number; y: number },
  selectedBranch: 0 | 1
): { x: number; y: number } | null {
  const ra = distance(aCenter, aThrough);
  const rb = distance(bCenter, bThrough);
  const intersections = circleCircleIntersections(aCenter, ra, bCenter, rb);
  if (intersections.length < 2) return null;
  const idx = selectedBranch === 0 ? 1 : 0;
  return intersections[idx];
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
  const matchCanvas = options.matchCanvas ?? false;
  const basePointStroke = 1.4;
  const basePointSizePx = 4;
  const pointStrokeScale = clampPositive(options.pointStrokeScale ?? 1, 0.01, 100);
  const lineWidthPt = (matchCanvas
    ? Math.max(0.1, s.strokeWidth * lineScale * 0.75)
    : Math.max(0.1, 1.05 * lineScale * (s.strokeWidth / basePointStroke))) * pointStrokeScale;
  const fixedInnerSep = options.pointInnerSepFixedPt;
  const innerSepPt = fixedInnerSep !== undefined
    ? Math.max(0.4, fixedInnerSep * pointScale)
    : matchCanvas
    ? Math.max(0.4, s.sizePx * pointScale * 0.75)
    : Math.max(0.4, 3.75 * pointScale * (s.sizePx / basePointSizePx));
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

function segmentStyleToTikz(style: SceneModel["segments"][number]["style"], options: TikzExportOptions): string {
  return lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.dash, style.opacity, options);
}

function segmentMarkToTikz(
  mark: SceneModel["segments"][number]["style"]["segmentMark"],
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
  if (!Number.isFinite(mark.pos) || mark.pos < 0 || mark.pos > 1) {
    throw new Error("Unsupported SegmentMark: pos");
  }
  if (!Number.isFinite(mark.sizePt) || mark.sizePt <= 0) {
    throw new Error("Unsupported SegmentMark: sizePt");
  }
  const sizeScale = clampPositive(options.segmentMarkSizeScale ?? 1, 0.01, 100);
  const widthScale = clampPositive(options.segmentMarkLineWidthScale ?? 1, 0.01, 100);
  const opts: string[] = [
    `mark=${mark.mark}`,
    `pos=${fmt(mark.pos)}`,
    `size=${fmt(mark.sizePt * sizeScale)}pt`,
  ];
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

function segmentArrowOverlayToTikz(
  arrow: SceneModel["segments"][number]["style"]["segmentArrowMark"],
  aName: string,
  bName: string,
  base: { strokeColor: string; strokeWidth: number; opacity: number }
): { kind: "tkz"; style: string } | { kind: "raw"; tex: string } | null {
  if (!arrow?.enabled) return null;
  if (arrow.mode === "mid") {
    const midOverlay = pathArrowOverlayToTikz(arrow, `(${aName}) -- (${bName})`, base, arrow.pos ?? 0.5);
    if (!midOverlay) return null;
    return { kind: "raw", tex: midOverlay };
  }

  ensureSupportedArrowDirection(arrow.direction, "SegmentArrowMark");
  const tip = resolveArrowTipName(arrow.tip, "SegmentArrowMark");
  const arrowColor = rgbColorExpr(arrow.color ?? base.strokeColor);
  const opacity = normalizedOpacity(base.opacity);
  const sourceWidth = resolveArrowSourceWidth(arrow.lineWidthPt, base.strokeWidth);
  if (arrow.lineWidthPt !== undefined && (!Number.isFinite(arrow.lineWidthPt) || arrow.lineWidthPt <= 0)) {
    throw new Error("Unsupported SegmentArrowMark: lineWidthPt");
  }
  const arrowWidth = Math.max(0.1, sourceWidth * PATH_ARROW_WIDTH_EXPORT_SCALE);
  const arrowScale = clampPositive(arrow.sizeScale ?? 1, 0.1, 20);
  const tailFrac = Math.max(0.02, Math.min(0.14, 0.03 + 0.03 * arrowScale));
  const t = fmt(1 - tailFrac);
  const tNeg = fmt(-tailFrac);
  const drawStyle = `color=${arrowColor},line width=${fmt(arrowWidth)}pt,-{${tip}[scale=${fmt(arrowScale)}]}${
    opacity < 0.999 ? `,opacity=${fmt(opacity)}` : ""
  }`;
  if (arrow.direction === "->") {
    return {
      kind: "raw",
      tex: `\\draw[${drawStyle}] ($(${aName})!${t}!(${bName})$) -- (${bName});`,
    };
  }
  if (arrow.direction === "<-") {
    return {
      kind: "raw",
      tex: `\\draw[${drawStyle}] ($(${bName})!${t}!(${aName})$) -- (${aName});`,
    };
  }
  if (arrow.direction === "<->") {
    return {
      kind: "raw",
      tex: [
        `\\draw[${drawStyle}] ($(${aName})!${t}!(${bName})$) -- (${bName});`,
        `\\draw[${drawStyle}] ($(${bName})!${t}!(${aName})$) -- (${aName});`,
      ].join("\n"),
    };
  }
  return {
    kind: "raw",
    tex: [
      `\\draw[${drawStyle}] ($(${aName})!${tNeg}!(${bName})$) -- (${aName});`,
      `\\draw[${drawStyle}] ($(${bName})!${tNeg}!(${aName})$) -- (${bName});`,
    ].join("\n"),
  };
}

function pathArrowOverlayToTikz(
  arrow:
    | SceneModel["segments"][number]["style"]["segmentArrowMark"]
    | SceneModel["circles"][number]["style"]["arrowMark"]
    | SceneModel["angles"][number]["style"]["arcArrowMark"],
  pathExpr: string,
  base: { strokeColor: string; strokeWidth: number; opacity: number },
  fallbackPos: number
): string | null {
  if (!arrow?.enabled) return null;
  ensureSupportedArrowDirection(arrow.direction, "PathArrowMark");
  const tip = resolveArrowTipName(arrow.tip, "PathArrowMark");
  if (arrow.lineWidthPt !== undefined && (!Number.isFinite(arrow.lineWidthPt) || arrow.lineWidthPt <= 0)) {
    throw new Error("Unsupported PathArrowMark: lineWidthPt");
  }
  const arrowColor = rgbColorExpr(arrow.color ?? base.strokeColor);
  const opacity = normalizedOpacity(base.opacity);
  const sourceWidth = resolveArrowSourceWidth(arrow.lineWidthPt, base.strokeWidth);
  const arrowWidth = Math.max(0.1, sourceWidth * PATH_ARROW_WIDTH_EXPORT_SCALE);
  const arrowScale = clampPositive(arrow.sizeScale ?? 1, 0.1, 20);
  const arrowOpts = `color=${arrowColor},line width=${fmt(arrowWidth)}pt,scale=${fmt(arrowScale)}${
    opacity < 0.999 ? `,opacity=${fmt(opacity)}` : ""
  }`;
  const forwardCmd = `\\arrow[${arrowOpts}]{${tip}}`;
  const reverseCmd = `\\arrowreversed[${arrowOpts}]{${tip}}`;
  const pairDelta = Math.max(0.003, Math.min(0.035, 0.009 + 0.003 * arrowScale));
  const positions = collectPathArrowPositions(arrow, fallbackPos);
  const marks: string[] = [];

  const addMark = (pos: number, command: string) => {
    marks.push(`mark=at position ${fmt(clamp01(pos))} with {${command}}`);
  };

  for (let i = 0; i < positions.length; i += 1) {
    const p = positions[i];
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

  if (marks.length === 0) return null;
  const opts: string[] = ["postaction=decorate", `decoration={markings,${marks.join(",")}}`];
  if (opacity < 0.999) opts.push(`opacity=${fmt(opacity)}`);
  return `\\path[${opts.join(", ")}] ${pathExpr};`;
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
  for (let t = start; t <= end + 1e-9 && out.length < 600; t += step) {
    out.push(clamp01(t));
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

function resolveArrowSourceWidth(lineWidthPt: unknown, baseStrokeWidth: unknown): number {
  if (Number.isFinite(lineWidthPt) && (lineWidthPt as number) > 0) return lineWidthPt as number;
  if (Number.isFinite(baseStrokeWidth) && (baseStrokeWidth as number) > 0) return baseStrokeWidth as number;
  return 1;
}

function normalizedOpacity(value: unknown): number {
  return Number.isFinite(value) ? clamp01(value as number) : 1;
}

function circlePathExprFromNamedStart(startName: string, radius: number, startRad: number): string {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Unsupported PathArrowMark: circle radius");
  }
  if (!Number.isFinite(startRad)) {
    throw new Error("Unsupported PathArrowMark: circle start angle");
  }
  const startDeg = (startRad * 180) / Math.PI;
  const endDeg = startDeg - 360;
  // Canvas circle path direction is clockwise (screen +theta). Export clockwise to keep arrow direction parity.
  return `(${startName}) arc[start angle=${fmt(startDeg)},end angle=${fmt(endDeg)},radius=${fmt(radius)}]`;
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

function circleStyleToTikz(style: SceneModel["circles"][number]["style"], options: TikzExportOptions): string {
  const opts = lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.strokeDash, style.strokeOpacity, options);
  const parts = opts.split(", ").filter(Boolean);
  const fillOpacity = clamp01(style.fillOpacity ?? 0);
  if (fillOpacity > 0) {
    parts.push(`fill=${rgbColorExpr(style.fillColor ?? style.strokeColor)}`);
    parts.push(`fill opacity=${fmt(fillOpacity)}`);
  }
  const pattern = readPatternOption(style);
  if (pattern) {
    parts.push(pattern.patternExpr);
    if (pattern.patternColorExpr) parts.push(pattern.patternColorExpr);
  }
  return parts.join(", ");
}

function polygonStyleToTikz(style: SceneModel["polygons"][number]["style"], options: TikzExportOptions): string {
  const opts = lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.strokeDash, style.strokeOpacity, options);
  const parts = opts.split(", ").filter(Boolean);
  const fillOpacity = clamp01(style.fillOpacity ?? 0);
  if (fillOpacity > 0) {
    parts.push(`fill=${rgbColorExpr(style.fillColor ?? style.strokeColor)}`);
    parts.push(`fill opacity=${fmt(fillOpacity)}`);
  }
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
  markKind: "arc" | "rightSquare" | "rightArcDot"
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
  const opts: string[] = [
    `color=${rgbColorExpr(style.strokeColor)}`,
    `line width=${fmt(strokeWidthToTikzPt(style.strokeWidth, options))}pt`,
    `size=${fmt(baseSizeWorld * sizeScale)}`,
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
    const arcMultiplicity = style.arcMultiplicity ?? 1;
    const arcExpr = arcMultiplicity === 3 ? "lll" : arcMultiplicity === 2 ? "ll" : "l";
    opts.push(`arc=${arcExpr}`);
    const markSymbol = style.markSymbol ?? "none";
    if (markSymbol !== "none" && markSymbol !== "|" && markSymbol !== "||" && markSymbol !== "|||") {
      throw new Error(`Unsupported construction: angle mark style symbol ${String(markSymbol)}`);
    }
    opts.push(`mark=${markSymbol}`);
    const mkPos = Number.isFinite(style.markPos) ? Math.max(0, Math.min(1, style.markPos)) : 0.5;
    const mkSizeBase = Number.isFinite(style.markSize) ? Math.max(0.1, style.markSize) : 4;
    const mkSizeScale = clampPositive(options.angleMarkSizeScale ?? 1, 0.01, 100);
    const mkSize = mkSizeBase * mkSizeScale;
    const mkColor = style.markColor && style.markColor.trim() ? style.markColor : style.strokeColor;
    opts.push(`mkpos=${fmt(mkPos)}`);
    opts.push(`mksize=${fmt(mkSize)}`);
    opts.push(`mkcolor=${rgbColorExpr(mkColor)}`);
  }
  if (opacity < 0.999) opts.push(`opacity=${fmt(opacity)}`);
  return opts.join(", ");
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
  if (dash === "dotted") opts.push("dotted");
  if (opacity < 0.999) opts.push(`opacity=${fmt(clamp01(opacity))}`);
  return opts.join(", ");
}

function strokeWidthToTikzPt(strokeWidth: number, options: TikzExportOptions): number {
  const lineScale = clampPositive(options.lineScale ?? 1, 0.05, 10);
  const matchCanvas = options.matchCanvas ?? false;
  return Math.max(0.1, strokeWidth * lineScale * (matchCanvas ? 0.75 : 1));
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

function pointLabelOptionsToTikz(point: ScenePoint, placement: LabelPlacement | null, exportOptions: TikzExportOptions): string {
  const opts: string[] = [];
  const xShiftPt = placement?.xShiftPt ?? 12;
  const yShiftPt = placement?.yShiftPt ?? 12;
  const rawXShiftPt = placement?.rawXShiftPt ?? xShiftPt;
  const rawYShiftPt = placement?.rawYShiftPt ?? yShiftPt;
  const matchCanvas = exportOptions.matchCanvas ?? false;
  const fontPt = Math.max(6, Math.min(48, point.style.labelFontPx * (matchCanvas ? 0.75 : 1)));
  if (matchCanvas) {
    // Keep quadrant stable from user drag offset, so labels don't flip due to
    // collision-spread/min-clear post-processing.
    opts.push(directionOptionFromShift(rawXShiftPt, rawYShiftPt));
  } else {
    // Placement solver computes label center directly; keep node anchored at center.
    opts.push("anchor=center");
    if (Math.abs(xShiftPt) > 1e-9) opts.push(`xshift=${fmt(xShiftPt)}pt`);
    if (Math.abs(yShiftPt) > 1e-9) opts.push(`yshift=${fmt(yShiftPt)}pt`);
  }
  if (!matchCanvas) {
    const baselinePt = Math.max(fontPt + 1, fontPt * 1.2);
    opts.push(`font=\\fontsize{${fmt(fontPt)}pt}{${fmt(baselinePt)}pt}\\selectfont`);
  }

  // Reuse point halo style for label readability on dense diagrams.
  if (!matchCanvas && point.style.labelHaloWidthPx > 0) {
    opts.push("circle");
    opts.push(`fill=${rgbColorExpr(point.style.labelHaloColor)}`);
    opts.push("fill opacity=0.8");
    opts.push("text opacity=1");
    opts.push("outer sep=0pt");
    opts.push("inner sep=0pt");
    if (placement && placement.bubbleRadiusPt > 0) {
      opts.push(`minimum size=${fmt(placement.bubbleRadiusPt * 1.62)}pt`);
    }
  }
  if (!matchCanvas && point.style.labelColor) {
    opts.push(`text=${rgbColorExpr(point.style.labelColor)}`);
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

    let rawDxPx = point.style.labelOffsetPx.x;
    let rawDyPx = point.style.labelOffsetPx.y;
    if (point.showLabel === "caption") {
      // Caption labels are rendered in canvas as top-left anchored HTML overlays.
      // Convert stored top-left offset to an approximate label-center shift so
      // anchor direction matches the visual quadrant.
      const caption = point.captionTex || point.name || "";
      const fontPx = Math.max(6, Math.min(48, point.style.labelFontPx));
      const boxW = Math.max(18, caption.length * (fontPx * 0.58) + 8);
      const boxH = Math.max(16, fontPx * 1.2);
      rawDxPx += boxW * 0.5;
      // KaTeX label overlay is top-left anchored; visual glyph center sits lower
      // than geometric half-height. Subscripts/fractions lower perceived center
      // further, so include a conservative TeX-descender bias.
      const subscriptCount = (caption.match(/_/g) ?? []).length;
      const hasFraction = /\\frac|\\dfrac|\\tfrac/.test(caption);
      const texDescenderBiasPx = subscriptCount * fontPx * 0.55 + (hasFraction ? fontPx * 0.35 : 0);
      rawDyPx += boxH * 0.95 + texDescenderBiasPx;
    }

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
  const arrowTipRegex = /-\{(?:Stealth|Latex|Triangle)\[|\\arrow(?:reversed)?\[[^\]]*\]\{(?:Stealth|Latex|Triangle)\}/;
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
    const suffix = needsArrowsMeta ? ",arrows.meta" : "";
    libraryLines.push(`\\usetikzlibrary{decorations.markings${suffix}}`);
  } else if (needsArrowsMeta) {
    libraryLines.push("\\usetikzlibrary{arrows.meta}");
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
