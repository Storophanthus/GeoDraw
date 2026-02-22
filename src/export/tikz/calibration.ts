// Centralized exporter calibration constants.
// Edit this file to adjust default canvas->TikZ parity behavior.
export const TIKZ_EXPORT_CALIBRATION = {
  // UI-level line scale is historically mapped to exporter line scale via this factor.
  uiLineScaleToExporter: 0.5 / 1.2,
  // Point stroke calibration used by ExportPanel options.
  pointStrokeScale: 32 / 35,
  // Point inner-sep calibration (applied after point size conversion).
  pointInnerSepScale: 1 / 3,
  // Set to a number to force fixed point radius in TikZ (pt).
  // Set to null to let export follow actual point.sizePx.
  pointInnerSepFixedPt: null,
  // Segment mark calibration.
  segmentMarkSizeScale: 5 / 8,
  segmentMarkLineWidthScale: 1 / 2.2,
  // Angle export calibration.
  angleLabelFontScale: 9 / 16,
  angleArcSizeScale: 1,
  angleMarkSizeScale: 0.5,
  rightAngleSizeScale: 1,
  // Match-canvas auto-fit default size.
  autoScaleToFitCm: {
    // Increased 1.6x so typical exports that previously landed near 0.75
    // now land near 1.2 without manual post-edit scaling.
    maxWidthCm: 22.4,
    maxHeightCm: 14.4,
  },
  // Point/canvas conversion constants used inside tikz.ts.
  pointConversion: {
    matchCanvasPxToPt: 0.75,
  },
} as const;

export type TikzExportCalibration = typeof TIKZ_EXPORT_CALIBRATION;

export function getPointInnerSepFixedPt(): number | undefined {
  const fixed = TIKZ_EXPORT_CALIBRATION.pointInnerSepFixedPt;
  return typeof fixed === "number" && Number.isFinite(fixed) ? fixed : undefined;
}
