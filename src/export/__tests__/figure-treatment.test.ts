import {
  applyFigureTreatment,
  getFigureTreatmentFactor,
  getFigureTreatmentHaloCompensation,
  getFigureTreatmentLabelCompensation,
  getFigureTreatmentMarkCompensation,
  getFigureTreatmentPointCompensation,
  isCanvasMatchedFigureSizing,
  removeFigureTreatment,
  resolveSavedFigureTreatment,
} from "../figureTreatment.ts";
import { buildTikzExportText, type TikzExportParams } from "../buildTikzExportText.ts";
import { TIKZ_EXPORT_CALIBRATION } from "../tikz/calibration.ts";
import type { LineStyle, PointStyle, SceneModel } from "../../scene/points.ts";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, received ${actual}`);
}

function tikzScale(source: string): number {
  const match = source.match(/\\begin\{tikzpicture\}\[[^\]]*scale=([-+\d.eE]+)/u);
  assert(match, `Expected an emitted TikZ scale.\n\n${source}`);
  return Number(match[1]);
}

const baseScalebox = 0.8;
const baseGlobal = 1.2;
const canvas = applyFigureTreatment(baseScalebox, baseGlobal, "canvas", 2.54);
const general = applyFigureTreatment(baseScalebox, baseGlobal, "general", 2.54);
const veryCloseup = applyFigureTreatment(baseScalebox, baseGlobal, "veryCloseup", 2.54);

assertClose(getFigureTreatmentFactor("canvas", 2.54), 2.54, "Canvas factor");
assertClose(getFigureTreatmentFactor("general", 2.54), 1, "General factor");
assertClose(getFigureTreatmentFactor("veryCloseup", 2.54), 2.5, "Very-close-up factor");
assertClose(
  2.15 * getFigureTreatmentLabelCompensation(2.15),
  2.15 ** 0.35,
  "Canvas label treatment curve"
);
assert(
  2.15 * getFigureTreatmentLabelCompensation(2.15) > 1.25 &&
    2.15 * getFigureTreatmentLabelCompensation(2.15) < 1.35,
  "A 215% Canvas treatment should produce approximately 1.3x typography."
);
assert(
  getFigureTreatmentPointCompensation(2.15) > 0.58 &&
    getFigureTreatmentPointCompensation(2.15) < 0.63,
  "A 215% Canvas treatment should apply approximately 0.6x point compensation."
);
assertClose(
  2.15 * getFigureTreatmentPointCompensation(2.15),
  2.15 ** 0.35,
  "Canvas point treatment curve"
);
assertClose(
  2.15 * getFigureTreatmentMarkCompensation(2.15),
  2.15 ** 0.35,
  "Canvas segment-mark treatment curve"
);
assert(
  getFigureTreatmentHaloCompensation(2.15) > 0.47 &&
    getFigureTreatmentHaloCompensation(2.15) < 0.53,
  "A 215% Canvas treatment should apply approximately 0.5x halo compensation."
);
assert(
  2.15 * getFigureTreatmentHaloCompensation(2.15) > 1.03 &&
    2.15 * getFigureTreatmentHaloCompensation(2.15) < 1.12,
  "A 215% Canvas treatment should keep the visible halo close to neutral."
);
assertClose(canvas.scaleboxScale, baseScalebox * 2.54, "Canvas outer scale");
assertClose(canvas.globalScale, baseGlobal / 2.54, "Canvas reciprocal TikZ scale");
assertClose(general.scaleboxScale, baseScalebox, "General outer scale");
assertClose(general.globalScale, baseGlobal, "General TikZ scale");
assertClose(veryCloseup.scaleboxScale, baseScalebox * 2.5, "Very-close-up outer scale");
assertClose(veryCloseup.globalScale, baseGlobal / 2.5, "Very-close-up reciprocal TikZ scale");
assertClose(canvas.scaleboxScale * canvas.globalScale, baseScalebox * baseGlobal, "Canvas product");
assertClose(general.scaleboxScale * general.globalScale, baseScalebox * baseGlobal, "General product");
assertClose(
  veryCloseup.scaleboxScale * veryCloseup.globalScale,
  baseScalebox * baseGlobal,
  "Very-close-up product"
);

assert(
  isCanvasMatchedFigureSizing("canvas", {
    trueGlobalScale: "1",
    globalScale: "1",
    pointScale: "1",
    lineScale: "1",
    labelScale: "1",
    labelHaloScale: "1",
  }),
  "Neutral Canvas sizing must be recognized as WYSIWYG."
);
assert(
  !isCanvasMatchedFigureSizing("canvas", {
    trueGlobalScale: "1",
    globalScale: "0.8",
    pointScale: "1.5",
    lineScale: "2",
    labelScale: "1.5",
    labelHaloScale: "1",
  }),
  "Independent PDF multipliers must be reported as non-canvas sizing."
);

const restored = removeFigureTreatment(
  veryCloseup.scaleboxScale,
  veryCloseup.globalScale,
  "veryCloseup",
  2.54
);
assertClose(restored.scaleboxScale, baseScalebox, "Restored outer baseline");
assertClose(restored.globalScale, baseGlobal, "Restored TikZ baseline");

const savedNamed = resolveSavedFigureTreatment("veryCloseup", 2, 0.48, 0.8, 1.2, 2.54);
assert(savedNamed.mode === "veryCloseup", "A named treatment must remain named when saved.");
assertClose(savedNamed.scaleboxScale, 0.8, "Named treatment saved outer baseline");
assertClose(savedNamed.globalScale, 1.2, "Named treatment saved TikZ baseline");

const savedCustom = resolveSavedFigureTreatment("custom", 3.81, 0.6, 0.8, 1.2, 2.54);
assert(savedCustom.mode === "canvas", "A Custom treatment must fall back to Canvas when saved.");
assertClose(savedCustom.scaleboxScale, 1.5, "Custom saved outer baseline");
assertClose(savedCustom.globalScale, 1.524, "Custom saved TikZ baseline");

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#111827",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#111827",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#111827",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle: LineStyle = {
  strokeColor: "#374151",
  strokeWidth: 1.5,
  dash: "solid",
  opacity: 1,
  segmentMarks: [{
    enabled: true,
    mark: "|",
    pos: 0.5,
    sizePt: 2.2,
    lineWidthPt: 1.4,
    color: "#374151",
  }],
};

const scene: SceneModel = {
  points: [
    { id: "a", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "b", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "name", position: { x: 3, y: 1 }, style: pointStyle },
  ],
  vectors: [],
  numbers: [],
  lines: [],
  segments: [{ id: "ab", aId: "a", bId: "b", visible: true, showLabel: false, style: lineStyle }],
  circles: [],
  polygons: [],
  angles: [],
  textLabels: [],
  richTextNodes: [],
};

function params(drawLayerBackend: "plain" | "tkz", scaleboxScale: number, globalScale: number): TikzExportParams {
  return {
    scene,
    viewport: { xmin: -1, xmax: 4, ymin: -1, ymax: 2 },
    clipRectWorld: undefined,
    clipPolygonWorld: undefined,
    screenPxPerWorld: 80,
    canvasTrueZoom: 1,
    emitTkzSetup: drawLayerBackend === "tkz",
    drawLayerBackend,
    bakeCoordinates: drawLayerBackend === "plain",
    labelGlow: true,
    backgroundColor: "#ffffff",
    efficient: false,
    scaleboxScale,
    trueGlobalScale: 1,
    globalScale,
    pointScale: 1,
    lineScale: 1,
    labelScale: 1,
    labelHaloScale: 1,
  };
}

function firstNumber(source: string, pattern: RegExp, label: string): number {
  const match = source.match(pattern);
  assert(match, `Expected ${label}.\n\n${source}`);
  return Number(match[1]);
}

function numericMarkLength(source: string): number {
  const matches = [...source.matchAll(
    /\\draw\[[^\]]+\] \(([-+\d.eE]+),([-+\d.eE]+)\) -- \(([-+\d.eE]+),([-+\d.eE]+)\);/gu
  )];
  assert(matches.length > 0, `Expected a precomputed numeric segment mark.\n\n${source}`);
  const match = matches[0];
  return Math.hypot(Number(match[3]) - Number(match[1]), Number(match[4]) - Number(match[2]));
}

function pointSizeMetric(source: string): number {
  const minimumSize = source.match(/minimum size=([-+\d.eE]+)pt/u);
  if (minimumSize) return Number(minimumSize[1]);
  const innerSep = source.match(/inner sep=([-+\d.eE]+)pt/u);
  assert(innerSep, `Expected a point-size metric.\n\n${source}`);
  return Number(innerSep[1]);
}

function haloWidth(source: string): number {
  const shared = source.match(/\\gdLabelGlow\{([-+\d.eE]+)pt\}/u);
  if (shared) return Number(shared[1]);
  return firstNumber(source, /\\contourlength\{([-+\d.eE]+)pt\}/u, "label halo width");
}

function tkzMarkSize(source: string): number {
  const direct = source.match(/\\tkzMarkSegment\[[^\]]*size=([-+\d.eE]+)pt/u);
  if (direct) return Number(direct[1]);
  const named = source.match(/gdMark(?:Tick|DoubleTick|TripleTick)=\{[-+\d.eE]+\}\{([-+\d.eE]+)pt\}/u);
  assert(named, `Expected a tkz segment-mark size.\n\n${source}`);
  return Number(named[1]);
}

function sharedDrawLineWidth(source: string): number {
  const shared = source.match(/gdDrawStyle1\/\.style=\{[^}]*line width=([-+\d.eE]+)pt/u);
  if (shared) return Number(shared[1]);
  const drawObjects = source.slice(source.indexOf("% Draw objects"));
  return firstNumber(drawObjects, /line width=([-+\d.eE]+)pt/u, "draw line width");
}

function tkzMarkLineWidth(source: string): number {
  return firstNumber(
    source,
    /gdMark(?:Tick|DoubleTick|TripleTick)=\{[^\n]*line width=([-+\d.eE]+)pt/u,
    "tkz segment-mark line width"
  );
}

function numericMarkLineWidth(source: string): number {
  return firstNumber(
    source,
    /\\draw\[[^\]]*line width=([-+\d.eE]+)pt[^\]]*\] \([-+\d.eE]+,[-+\d.eE]+\) -- \([-+\d.eE]+,[-+\d.eE]+\);/u,
    "numeric segment-mark line width"
  );
}

function labelXShift(source: string): number {
  return firstNumber(source, /xshift=([-+\d.eE]+)pt/u, "point-label x shift");
}

function labelFontSize(source: string): number {
  return firstNumber(source, /font=\\fontsize\{([-+\d.eE]+)pt\}/u, "point-label font size");
}

for (const backend of ["plain", "tkz"] as const) {
  const generalText = buildTikzExportText(params(backend, 1, 1));
  const closeupText = buildTikzExportText({
    ...params(backend, 2.5, 0.4),
    figureTreatmentFactor: 2.5,
  });
  assert(!generalText.includes("\\scalebox{"), `${backend}: General must not add a neutral scalebox.`);
  assert(closeupText.includes("\\scalebox{2.5}"), `${backend}: Very close-up must emit scalebox 2.5.`);
  assertClose(tikzScale(closeupText) / tikzScale(generalText), 0.4, `${backend}: TikZ compensation ratio`);
  await compileTikzSnippet(`figure-treatment-general-${backend}`, generalText);
  await compileTikzSnippet(`figure-treatment-very-closeup-${backend}`, closeupText);
}

// Canvas at exactly 100% used to fall through to the compact legacy
// reconstructible calibration because its numeric factor equals General (1).
// The named mode must keep editable construction output visually aligned with
// the plain/canvas backend even at that neutral factor.
const canvasAt100Plain = buildTikzExportText({
  ...params("plain", 1, 1),
  figureTreatmentMode: "canvas",
  figureTreatmentFactor: 1,
});
const canvasAt100Tkz = buildTikzExportText({
  ...params("tkz", 1, 1),
  figureTreatmentMode: "canvas",
  figureTreatmentFactor: 1,
});
assertClose(
  pointSizeMetric(canvasAt100Tkz),
  pointSizeMetric(canvasAt100Plain),
  "Canvas 100% point metric parity"
);
assertClose(
  sharedDrawLineWidth(canvasAt100Tkz),
  sharedDrawLineWidth(canvasAt100Plain),
  "Canvas 100% line metric parity"
);
assertClose(
  labelFontSize(canvasAt100Tkz),
  labelFontSize(canvasAt100Plain),
  "Canvas 100% label metric parity"
);
await compileTikzSnippet("figure-treatment-canvas-100-tkz", canvasAt100Tkz);

// A whole-scene Canvas treatment previously cancelled itself in Visual Exact:
// the inner TikZ scale made fixed-size styling smaller by exactly the amount
// the outer scalebox enlarged it. Keep styling independent of coordinate scale,
// enlarge coordinate-space segment marks, and add room around the automatic box.
const wholeGeneral = buildTikzExportText({
  ...params("plain", 1, 1),
  viewport: undefined,
  canvasTrueZoom: 2.15,
  figureTreatmentFactor: 1,
});
const wholeCanvasCloseup = buildTikzExportText({
  ...params("plain", 2.15, 1 / 2.15),
  viewport: undefined,
  canvasTrueZoom: 2.15,
  figureTreatmentFactor: 2.15,
});
const wholeGeneralTkz = buildTikzExportText({
  ...params("tkz", 1, 1),
  viewport: undefined,
  canvasTrueZoom: 2.15,
  figureTreatmentFactor: 1,
});
const wholeCanvasCloseupTkz = buildTikzExportText({
  ...params("tkz", 2.15, 1 / 2.15),
  viewport: undefined,
  canvasTrueZoom: 2.15,
  figureTreatmentFactor: 2.15,
});
const wholeGeneralPointSize = firstNumber(
  wholeGeneral,
  /minimum size=([-+\d.eE]+)pt/u,
  "general point size"
);
const wholeCloseupPointSize = firstNumber(
  wholeCanvasCloseup,
  /minimum size=([-+\d.eE]+)pt/u,
  "close-up point size"
);
assert(
  (wholeCloseupPointSize * 2.15) / wholeGeneralPointSize > 1,
  "The moderated outer treatment must still visibly enlarge points after padded auto-fit."
);
assertClose(
  numericMarkLength(wholeCanvasCloseup) / numericMarkLength(wholeGeneral),
  2.15 ** 0.35,
  "Whole-scene segment mark length treatment"
);
assert(
  tikzScale(wholeCanvasCloseup) * 2.15 < tikzScale(wholeGeneral),
  "Close-up treatment must retain automatic fitting breathing room without emitting a crop."
);
assertClose(
  pointSizeMetric(wholeCanvasCloseupTkz) / pointSizeMetric(wholeCanvasCloseup),
  TIKZ_EXPORT_CALIBRATION.constructionCloseup.pointMetricScale,
  "Geometric Construction close-up point calibration"
);
assertClose(
  (haloWidth(wholeCanvasCloseupTkz) * 2.15) / haloWidth(wholeGeneralTkz),
  2.15 ** 0.1,
  "Geometric Construction halo treatment"
);
assertClose(
  sharedDrawLineWidth(wholeCanvasCloseupTkz) /
    sharedDrawLineWidth(wholeCanvasCloseup),
  TIKZ_EXPORT_CALIBRATION.constructionCloseup.lineMetricScale,
  "Geometric Construction close-up line calibration"
);
assertClose(
  (2 * tkzMarkSize(wholeCanvasCloseupTkz)) /
    (numericMarkLength(wholeCanvasCloseup) * tikzScale(wholeCanvasCloseup) * (72.27 / 2.54)),
  TIKZ_EXPORT_CALIBRATION.constructionCloseup.segmentMarkSizeScale,
  "Geometric Construction close-up segment-mark length calibration"
);
assertClose(
  tkzMarkLineWidth(wholeCanvasCloseupTkz) /
    numericMarkLineWidth(wholeCanvasCloseup),
  TIKZ_EXPORT_CALIBRATION.constructionCloseup.lineMetricScale *
    TIKZ_EXPORT_CALIBRATION.constructionCloseup.segmentMarkStrokeScale,
  "Geometric Construction close-up segment-mark stroke calibration"
);
const closeupLabelOffsetRatio =
  labelXShift(wholeCanvasCloseupTkz) / labelFontSize(wholeCanvasCloseupTkz);
const expectedCloseupLabelOffsetRatio =
  (8 * TIKZ_EXPORT_CALIBRATION.constructionCloseup.labelOffsetScale) / 14;
assert(
  Math.abs(closeupLabelOffsetRatio - expectedCloseupLabelOffsetRatio) < 0.01,
  `Geometric Construction close-up label-offset calibration: expected approximately ${expectedCloseupLabelOffsetRatio}, received ${closeupLabelOffsetRatio}`
);
await compileTikzSnippet("figure-treatment-canvas-tkz", wholeCanvasCloseupTkz);

console.log("figure-treatment: ok");
