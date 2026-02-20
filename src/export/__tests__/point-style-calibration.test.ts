import { exportTikzWithOptions } from "../tikz.ts";
import { getPointInnerSepFixedPt, TIKZ_EXPORT_CALIBRATION } from "../tikz/calibration.ts";
import type { SceneModel } from "../../scene/points.ts";

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.4,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const scene: SceneModel = {
  points: [
    {
      id: "p1",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const tikz = exportTikzWithOptions(scene, {
  worldToTikzScale: 1,
  pointScale: 1,
  lineScale: TIKZ_EXPORT_CALIBRATION.uiLineScaleToExporter,
  labelScale: 1,
  screenPxPerWorld: 80,
  labelGlow: true,
  pointStrokeScale: TIKZ_EXPORT_CALIBRATION.pointStrokeScale,
  pointInnerSepFixedPt: getPointInnerSepFixedPt(),
  pointInnerSepScale: TIKZ_EXPORT_CALIBRATION.pointInnerSepScale,
  segmentMarkSizeScale: TIKZ_EXPORT_CALIBRATION.segmentMarkSizeScale,
  segmentMarkLineWidthScale: TIKZ_EXPORT_CALIBRATION.segmentMarkLineWidthScale,
  angleLabelFontScale: TIKZ_EXPORT_CALIBRATION.angleLabelFontScale,
  angleArcSizeScale: TIKZ_EXPORT_CALIBRATION.angleArcSizeScale,
  angleMarkSizeScale: TIKZ_EXPORT_CALIBRATION.angleMarkSizeScale,
  rightAngleSizeScale: TIKZ_EXPORT_CALIBRATION.rightAngleSizeScale,
  autoScaleToFitCm: {
    maxWidthCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxWidthCm,
    maxHeightCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxHeightCm,
  },
});

const pointStyleLine = tikz
  .split("\n")
  .find((line) => line.startsWith("\\tikzset{tkzVertex/.style={"));
if (!pointStyleLine) {
  throw new Error("Expected exported point style line.");
}
if (!pointStyleLine.includes("line width=0.4pt")) {
  throw new Error(`Expected default point stroke to export as line width=0.4pt: ${pointStyleLine}`);
}
if (!pointStyleLine.includes("inner sep=1pt")) {
  throw new Error(`Expected default point size to export as inner sep=1pt: ${pointStyleLine}`);
}

console.log("✓ export point-style calibration test passed");
