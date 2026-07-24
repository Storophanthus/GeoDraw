import type { SceneModel } from "../scene/points";
import type { Vec2 } from "../geo/vec2";
import { exportTikzEfficientWithOptions, exportTikzWithOptions } from "./tikz";
import { getPointInnerSepFixedPt, TIKZ_EXPORT_CALIBRATION } from "./tikz/calibration";

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
  emitTkzSetup: boolean;
  drawLayerBackend: "plain" | "tkz";
  bakeCoordinates: boolean;
  labelGlow: boolean;
  /** Canvas background color, used as the label-halo color in exact-metrics mode. */
  backgroundColor: string | undefined;
  efficient: boolean;
  globalScale: number;
  pointScale: number;
  lineScale: number;
  labelScale: number;
};

const safeScale = (value: number): number => (Number.isFinite(value) ? value : 1);

/**
 * Pure TikZ builder shared by the Export panel and the PDF-preview window, so
 * both produce byte-identical output for the same inputs. The panel computes the
 * params from live state/DOM; the preview reads them from its session and only
 * changes the scales.
 */
export function buildTikzExportText(params: TikzExportParams): string {
  const useCanvasExactMetrics = params.drawLayerBackend === "plain";
  const globalScale = safeScale(params.globalScale);
  const pointScale = safeScale(params.pointScale);
  const lineScale = safeScale(params.lineScale);
  const labelScale = safeScale(params.labelScale);

  const tikzOptions = {
    viewport: params.viewport,
    clipRectWorld: params.clipRectWorld,
    clipPolygonWorld: params.clipPolygonWorld,
    worldToTikzScale: globalScale,
    pointScale,
    lineScale: lineScale * (useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.uiLineScaleToExporter),
    labelScale,
    screenPxPerWorld: params.screenPxPerWorld,
    emitTkzSetup: params.emitTkzSetup,
    drawLayerBackend: params.drawLayerBackend,
    labelGlow: params.labelGlow,
    labelHaloColor: useCanvasExactMetrics ? params.backgroundColor : undefined,
    bakePointCoordinates: params.bakeCoordinates,
    pointStrokeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pointStrokeScale,
    pointInnerSepFixedPt: useCanvasExactMetrics ? undefined : getPointInnerSepFixedPt(),
    pointInnerSepScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pointInnerSepScale,
    segmentMarkSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkSizeScale,
    segmentMarkRoundSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkRoundSizeScale,
    segmentMarkNonRoundSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkNonRoundSizeScale,
    segmentMarkLineWidthScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkLineWidthScale,
    pathDotMarkSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pathDotMarkSizeScale,
    angleLabelFontScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleLabelFontScale,
    angleArcSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleArcSizeScale,
    angleMarkSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleMarkSizeScale,
    rightAngleSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.rightAngleSizeScale,
    autoScaleToFitCm: {
      maxWidthCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxWidthCm,
      maxHeightCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxHeightCm,
    },
  } as const;

  return params.efficient
    ? exportTikzEfficientWithOptions(params.scene, tikzOptions)
    : exportTikzWithOptions(params.scene, tikzOptions);
}
