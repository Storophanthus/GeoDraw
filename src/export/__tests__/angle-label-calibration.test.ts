import { exportTikzWithOptions } from "../tikz.ts";
import { getPointInnerSepFixedPt, TIKZ_EXPORT_CALIBRATION } from "../tikz/calibration.ts";
import type { AngleStyle, SceneModel } from "../../scene/points.ts";

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#000000",
  strokeWidth: 1.4,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#000000",
  labelOffsetPx: { x: 8, y: -8 },
};

function makeAngleStyle(labelPosWorld: { x: number; y: number }, labelText: string, arcRadius = 1.95): AngleStyle {
  return {
    strokeColor: "#000000",
    strokeWidth: 1,
    strokeDash: "solid",
    strokeOpacity: 1,
    textColor: "#000000",
    textSize: 16,
    fillEnabled: false,
    fillColor: "#e7dcc8",
    fillOpacity: 0.2,
    pattern: "",
    markStyle: "arc",
    markSymbol: "none",
    arcMultiplicity: 1,
    markPos: 0.5,
    markSize: 7.4,
    markColor: "#000000",
    arcRadius,
    labelText,
    labelPosWorld,
    showLabel: true,
    showValue: false,
    promoteToSolid: false,
  };
}

function polarPoint(angleDeg: number, dist: number): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(angleRad) * dist, y: Math.sin(angleRad) * dist };
}

function exportScene(scene: SceneModel): string {
  return exportTikzWithOptions(scene, {
    worldToTikzScale: 1,
    pointScale: 1,
    lineScale: TIKZ_EXPORT_CALIBRATION.uiLineScaleToExporter,
    labelScale: 1,
    screenPxPerWorld: 130,
    labelGlow: true,
    pointStrokeScale: TIKZ_EXPORT_CALIBRATION.pointStrokeScale,
    pointInnerSepFixedPt: getPointInnerSepFixedPt(),
    pointInnerSepScale: TIKZ_EXPORT_CALIBRATION.pointInnerSepScale,
    segmentMarkSizeScale: TIKZ_EXPORT_CALIBRATION.segmentMarkSizeScale,
    segmentMarkRoundSizeScale: TIKZ_EXPORT_CALIBRATION.segmentMarkRoundSizeScale,
    segmentMarkNonRoundSizeScale: TIKZ_EXPORT_CALIBRATION.segmentMarkNonRoundSizeScale,
    segmentMarkLineWidthScale: TIKZ_EXPORT_CALIBRATION.segmentMarkLineWidthScale,
    pathDotMarkSizeScale: TIKZ_EXPORT_CALIBRATION.pathDotMarkSizeScale,
    angleLabelFontScale: TIKZ_EXPORT_CALIBRATION.angleLabelFontScale,
    angleArcSizeScale: TIKZ_EXPORT_CALIBRATION.angleArcSizeScale,
    angleMarkSizeScale: TIKZ_EXPORT_CALIBRATION.angleMarkSizeScale,
    rightAngleSizeScale: TIKZ_EXPORT_CALIBRATION.rightAngleSizeScale,
    autoScaleToFitCm: {
      maxWidthCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxWidthCm,
      maxHeightCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxHeightCm,
    },
  });
}

const sharedPoints = [
  {
    id: "pA",
    kind: "free" as const,
    name: "A",
    captionTex: "A",
    visible: true,
    showLabel: "name" as const,
    position: { x: 5.008154296875, y: 6.225683593750002 },
    style: pointStyle,
  },
  {
    id: "pB",
    kind: "free" as const,
    name: "B",
    captionTex: "B",
    visible: true,
    showLabel: "name" as const,
    position: { x: 6.5, y: 2 },
    style: pointStyle,
  },
  {
    id: "pP",
    kind: "free" as const,
    name: "P",
    captionTex: "P",
    visible: true,
    showLabel: "name" as const,
    position: { x: 2.0947372411479606, y: 2.8209394582715808 },
    style: pointStyle,
  },
];

const outlierDistanceScene: SceneModel = {
  points: sharedPoints,
  vectors: [],
  segments: [],
  lines: [],
  circles: [],
  polygons: [],
  numbers: [],
  angles: [
    {
      id: "a_far",
      aId: "pA",
      bId: "pB",
      cId: "pP",
      visible: true,
      style: makeAngleStyle({ x: 6.1545230485013445, y: 2.365916118203361 }, "\\beta"),
    },
  ],
};

const outlierAngleScene: SceneModel = {
  points: sharedPoints,
  vectors: [],
  segments: [],
  lines: [],
  circles: [],
  polygons: [],
  numbers: [],
  angles: [
    {
      id: "a_turn",
      aId: "pP",
      bId: "pA",
      cId: "pB",
      visible: true,
      style: makeAngleStyle({ x: 4.864570122792746, y: 5.997030381200848 }, "\\alpha"),
    },
  ],
};

const smallRadiusPoints = [
  {
    id: "pSA",
    kind: "free" as const,
    name: "SA",
    captionTex: "SA",
    visible: false,
    showLabel: "none" as const,
    position: { x: 1, y: 0 },
    style: pointStyle,
  },
  {
    id: "pSB",
    kind: "free" as const,
    name: "SB",
    captionTex: "SB",
    visible: false,
    showLabel: "none" as const,
    position: { x: 0, y: 0 },
    style: pointStyle,
  },
  {
    id: "pSC",
    kind: "free" as const,
    name: "SC",
    captionTex: "SC",
    visible: false,
    showLabel: "none" as const,
    position: { x: 0, y: 1 },
    style: pointStyle,
  },
];

function makeSmallRadiusScene(labelAngleDeg: number): SceneModel {
  return {
    points: smallRadiusPoints,
    vectors: [],
    segments: [],
    lines: [],
    circles: [],
    polygons: [],
    numbers: [],
    angles: [
      {
        id: "a_small",
        aId: "pSA",
        bId: "pSB",
        cId: "pSC",
        visible: true,
        style: makeAngleStyle(polarPoint(labelAngleDeg, 0.14), "\\theta", 0.65),
      },
    ],
  };
}

const farTikz = exportScene(outlierDistanceScene);
const farLine = farTikz.split("\n").find((line) => line.includes("\\tkzLabelAngle"));
if (!farLine) {
  throw new Error("Expected exported angle label line for far-distance scene.");
}
const farDist = Number(farLine.match(/dist=([-0-9.]+)/)?.[1] ?? Number.NaN);
const farAngle = Number(farLine.match(/angle=([-0-9.]+)/)?.[1] ?? Number.NaN);
if (Math.abs(farDist - 0.5) > 1e-4) {
  throw new Error(`Expected manual angle-label distance to be preserved at export precision: ${farLine}`);
}
if (Math.abs(farAngle - 139.44448468483) > 1e-4) {
  throw new Error(`Expected angle-label direction to use the geometric bisector: ${farLine}`);
}

const turnTikz = exportScene(outlierAngleScene);
const turnLine = turnTikz.split("\n").find((line) => line.includes("\\tkzLabelAngle"));
if (!turnLine) {
  throw new Error("Expected exported angle label line for angle-outlier scene.");
}
const turnDist = Number(turnLine.match(/dist=([-0-9.]+)/)?.[1] ?? Number.NaN);
const turnAngle = Number(turnLine.match(/angle=([-0-9.]+)/)?.[1] ?? Number.NaN);
if (Math.abs(turnDist - 0.27) > 1e-4) {
  throw new Error(`Expected in-band angle-label distance to be preserved: ${turnLine}`);
}
if (Math.abs(turnAngle - (-100.554095408036)) > 1e-4) {
  throw new Error(`Expected angle-label direction to use the geometric bisector: ${turnLine}`);
}

const smallTightLine = exportScene(makeSmallRadiusScene(20))
  .split("\n")
  .find((line) => line.includes("\\tkzLabelAngle"));
if (!smallTightLine) {
  throw new Error("Expected exported angle label line for tight small-radius scene.");
}
const smallTightDist = Number(smallTightLine.match(/dist=([-0-9.]+)/)?.[1] ?? Number.NaN);
if (Math.abs(smallTightDist - 0.09) > 1e-4) {
  throw new Error(`Expected tiny arc label to use tight distance: ${smallTightLine}`);
}

const smallFarLine = exportScene(makeSmallRadiusScene(80))
  .split("\n")
  .find((line) => line.includes("\\tkzLabelAngle"));
if (!smallFarLine) {
  throw new Error("Expected exported angle label line for far small-radius scene.");
}
const smallFarDist = Number(smallFarLine.match(/dist=([-0-9.]+)/)?.[1] ?? Number.NaN);
if (Math.abs(smallFarDist - 0.13) > 1e-4) {
  throw new Error(`Expected tiny arc label to use farther distance when the label vector leads the bisector: ${smallFarLine}`);
}

console.log("✓ export angle-label calibration test passed");
