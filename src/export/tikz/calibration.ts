// Centralized exporter calibration constants.
// Edit this file to adjust default canvas->TikZ parity behavior.
export const TIKZ_EXPORT_CALIBRATION = {
  // UI-level line scale is historically mapped to exporter line scale via this factor.
  uiLineScaleToExporter: 0.5 / 1.2,
  // Point stroke calibration used by ExportPanel options.
  pointStrokeScale: 0.4 / 1.05,
  // Keep point marker size stable by fixed inner sep in TikZ (pt).
  pointInnerSepFixedPt: 1.5,
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
    maxWidthCm: 14,
    maxHeightCm: 9,
  },
  // Point style conversion constants used inside tikz.ts.
  pointConversion: {
    basePointStrokePx: 1.4,
    basePointSizePx: 4,
    nonMatchLineWidthFactor: 1.05,
    nonMatchInnerSepFactorPt: 3.75,
    matchCanvasPxToPt: 0.75,
  },
} as const;

export type TikzExportCalibration = typeof TIKZ_EXPORT_CALIBRATION;
