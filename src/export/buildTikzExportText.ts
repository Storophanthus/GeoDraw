import type { SceneModel } from "../scene/points";
import type { Vec2 } from "../geo/vec2";
import { exportTikzEfficientWithOptions, exportTikzWithOptions } from "./tikz";
import { getPointInnerSepFixedPt, TIKZ_EXPORT_CALIBRATION } from "./tikz/calibration";
import {
  getFigureTreatmentHaloCompensation,
  getFigureTreatmentLabelCompensation,
  getFigureTreatmentMarkCompensation,
  getFigureTreatmentPointCompensation,
  type FigureTreatmentMode,
} from "./figureTreatment";

export type TikzViewportRect = { xmin: number; xmax: number; ymin: number; ymax: number };

export type TikzClipRect = { kind: "rect"; xmin: number; xmax: number; ymin: number; ymax: number };

/**
 * All inputs the exporter needs, with every DOM/React-derived value already
 * resolved by the caller. This is what lets the separate PDF-preview window
 * regenerate identical TikZ from a serialized session: it captures these once
 * and only varies the four figure-sizing scales afterward.
 */
export type TikzExportParams = {
  scene: SceneModel;
  /** Precomputed viewport rect, or undefined to export every object. */
  viewport: TikzViewportRect | undefined;
  clipRectWorld: TikzClipRect | undefined;
  clipPolygonWorld: Vec2[] | undefined;
  /** camera.zoom — screen px per world unit. */
  screenPxPerWorld: number;
  /** Canvas True Zoom folded into scalebox/globalScale; preview-only metadata. */
  canvasTrueZoom?: number;
  /** Resolved Canvas/General/Very-close-up visual treatment factor. */
  figureTreatmentFactor?: number;
  /** Named treatment, retained because Canvas at 100% also means canvas metrics. */
  figureTreatmentMode?: FigureTreatmentMode;
  emitTkzSetup: boolean;
  drawLayerBackend: "plain" | "tkz";
  bakeCoordinates: boolean;
  labelGlow: boolean;
  /** Multiplier for label halo/contour spread. */
  labelHaloScale?: number;
  /** Emit generated numeric literals with at most two decimal places. */
  roundNumbersToTwoDecimals?: boolean;
  /** Approximate colors with xcolor/dvipsnames names and emit no custom definitions. */
  preferDvipsNames?: boolean;
  /** Canvas background color, retained for preview/full-document presentation. */
  backgroundColor: string | undefined;
  efficient: boolean;
  /** Simple outer visual scale emitted with \scalebox. */
  scaleboxScale: number;
  /** Advanced TikZ transform scale emitted with transform shape. */
  trueGlobalScale: number;
  globalScale: number;
  pointScale: number;
  lineScale: number;
  labelScale: number;
};

const safeScale = (value: number | undefined): number => (Number.isFinite(value) ? (value as number) : 1);

/**
 * Pure TikZ builder shared by the Export panel and the PDF-preview window, so
 * both produce byte-identical output for the same inputs. The panel computes the
 * params from live state/DOM; the preview reads them from its session and only
 * changes the figure-sizing scales.
 */
export function buildTikzExportText(params: TikzExportParams): string {
  const useCanvasExactMetrics = params.drawLayerBackend === "plain";
  const scaleboxScale = Math.max(0.05, Math.min(10, safeScale(params.scaleboxScale)));
  const trueGlobalScale = Math.max(0.05, Math.min(10, safeScale(params.trueGlobalScale)));
  // tkz-euclide performs parts of its construction math in transformed TeX
  // dimensions. Running that math inside `scale=...,transform shape` can move
  // intersections and circle centers, so reconstructible exports must apply
  // the advanced factor only after the complete tikzpicture has been boxed.
  const reconstructiblePostScale = params.drawLayerBackend === "tkz" ? trueGlobalScale : 1;
  const innerTrueGlobalScale = params.drawLayerBackend === "tkz" ? 1 : trueGlobalScale;
  const outerScaleboxScale = Math.max(
    0.05,
    Math.min(100, scaleboxScale * reconstructiblePostScale)
  );
  const globalScale = safeScale(params.globalScale);
  const lineScale = safeScale(params.lineScale);
  const figureTreatmentFactor = Math.max(
    0.05,
    Math.min(20, safeScale(params.figureTreatmentFactor))
  );
  const pointScale =
    safeScale(params.pointScale) *
    getFigureTreatmentPointCompensation(figureTreatmentFactor);
  const labelScale =
    safeScale(params.labelScale) *
    getFigureTreatmentLabelCompensation(figureTreatmentFactor);
  const labelHaloScale = Math.max(
    0.05,
    Math.min(
      10,
      safeScale(params.labelHaloScale) *
        getFigureTreatmentHaloCompensation(figureTreatmentFactor)
    )
  );
  const segmentMarkTreatmentCompensation =
    getFigureTreatmentMarkCompensation(figureTreatmentFactor);
  // Construction exports retain their compact legacy defaults for General,
  // but a named close-up must match the canvas-calibrated visual treatment.
  // This affects only styling; tkz-euclide still owns all construction math.
  const useTreatmentMatchedMetrics =
    useCanvasExactMetrics ||
    params.figureTreatmentMode === "canvas" ||
    figureTreatmentFactor > 1 + 1e-9;
  const useConstructionCloseupCalibration =
    params.drawLayerBackend === "tkz" && figureTreatmentFactor > 1 + 1e-9;
  const constructionCloseup = TIKZ_EXPORT_CALIBRATION.constructionCloseup;
  const constructionPointScale = useConstructionCloseupCalibration
    ? constructionCloseup.pointMetricScale
    : 1;
  const constructionLineScale = useConstructionCloseupCalibration
    ? constructionCloseup.lineMetricScale
    : 1;

  const tikzOptions = {
    viewport: params.viewport,
    clipRectWorld: params.clipRectWorld,
    clipPolygonWorld: params.clipPolygonWorld,
    trueGlobalScale: innerTrueGlobalScale,
    canvasTrueZoom: params.canvasTrueZoom,
    visualTreatmentFactor: figureTreatmentFactor,
    worldToTikzScale: globalScale,
    pointScale: pointScale * constructionPointScale,
    lineScale:
      lineScale *
      innerTrueGlobalScale *
      constructionLineScale *
      (useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.uiLineScaleToExporter),
    labelScale,
    screenPxPerWorld: params.screenPxPerWorld,
    emitTkzSetup: params.emitTkzSetup,
    drawLayerBackend: params.drawLayerBackend,
    labelGlow: params.labelGlow,
    labelHaloScale,
    roundNumbersToTwoDecimals: params.roundNumbersToTwoDecimals,
    preferDvipsNames: params.preferDvipsNames,
    // Keep generated TikZ page-aware. With no explicit halo override,
    // \gdLabelGlow uses \thepagecolor instead of baking the current canvas
    // background into a generated color such as c0.
    labelHaloColor: undefined,
    bakePointCoordinates: params.bakeCoordinates,
    pointStrokeScale: useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pointStrokeScale,
    pointInnerSepFixedPt: useTreatmentMatchedMetrics ? undefined : getPointInnerSepFixedPt(),
    pointInnerSepScale: useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pointInnerSepScale,
    segmentMarkSizeScale: useTreatmentMatchedMetrics
      ? 1
      : TIKZ_EXPORT_CALIBRATION.segmentMarkSizeScale * innerTrueGlobalScale,
    segmentMarkTreatmentScale:
      segmentMarkTreatmentCompensation *
      (useConstructionCloseupCalibration
        ? constructionCloseup.segmentMarkSizeScale
        : 1),
    segmentMarkRoundSizeScale: useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkRoundSizeScale,
    segmentMarkNonRoundSizeScale: useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkNonRoundSizeScale,
    segmentMarkLineWidthScale:
      (useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkLineWidthScale) *
      innerTrueGlobalScale,
    segmentMarkTreatmentStrokeScale: useConstructionCloseupCalibration
      ? constructionCloseup.segmentMarkStrokeScale
      : 1,
    pointLabelOffsetScale: useConstructionCloseupCalibration
      ? constructionCloseup.labelOffsetScale
      : 1,
    pathDotMarkSizeScale:
      (useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pathDotMarkSizeScale) *
      innerTrueGlobalScale,
    angleLabelFontScale: useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleLabelFontScale,
    // tkz angle/right-angle radii are coordinate-space lengths, so the
    // tikzpicture scale already transforms them. Only the fixed-size plot mark
    // (mksize) needs the explicit true-global correction.
    angleArcSizeScale: useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleArcSizeScale,
    angleMarkSizeScale: useTreatmentMatchedMetrics
      ? 1
      : TIKZ_EXPORT_CALIBRATION.angleMarkSizeScale * innerTrueGlobalScale,
    rightAngleSizeScale: useTreatmentMatchedMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.rightAngleSizeScale,
    autoScaleToFitCm: {
      maxWidthCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxWidthCm,
      maxHeightCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxHeightCm,
    },
  } as const;

  const tikz = params.efficient
    ? exportTikzEfficientWithOptions(params.scene, tikzOptions)
    : exportTikzWithOptions(params.scene, tikzOptions);
  if (Math.abs(outerScaleboxScale - 1) <= 1e-9) return tikz;
  const scaleText = params.roundNumbersToTwoDecimals
    ? String(Number(outerScaleboxScale.toFixed(2)))
    : String(Number(outerScaleboxScale.toPrecision(15)));
  const pictureStart = tikz.indexOf("\\begin{tikzpicture}");
  if (pictureStart < 0) return `\\scalebox{${scaleText}}{%\n${tikz}\n}`;
  const prelude = tikz.slice(0, pictureStart);
  const picture = tikz.slice(pictureStart);
  return `${prelude}\\scalebox{${scaleText}}{%\n${picture}%\n}`;
}
