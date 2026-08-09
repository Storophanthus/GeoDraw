import { buildTikzExportText, type TikzExportParams } from "../buildTikzExportText.ts";
import type { AngleStyle, LineStyle, PointStyle, SceneModel } from "../../scene/points.ts";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, label: string): void {
  assert(
    Math.abs(actual - expected) < 1e-8,
    `${label}: expected ${expected}, received ${actual}`
  );
}

function commandLine(source: string, macro: string): string {
  const line = source.split("\n").find((candidate) => candidate.includes(`\\${macro}`));
  assert(line, `Expected ${macro} in exported TikZ.\n\n${source}`);
  return line;
}

function segmentMarkDecorationLine(source: string): string {
  const line = source
    .split("\n")
    .find((candidate) =>
      candidate.includes("gdMarkDoubleTick=") && candidate.includes("(A) -- (B)")
    );
  assert(line, `Expected a precomputed segment-mark style in exported TikZ.\n\n${source}`);
  return line;
}

function segmentMarkCoordinates(line: string): number[] {
  const match = line.match(
    /gdMarkDoubleTick=\{([-+\d.eE]+)\}\{([-+\d.eE]+)pt\}\{([-+\d.eE]+)pt\}/u
  );
  assert(match, `Expected position, half-length, and half-gap in mark style.\n\n${line}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function pointLabelLine(source: string, pointName: string): string {
  const line = source
    .split("\n")
    .find((candidate) =>
      candidate.includes(`\\tkzLabelPoint`) && candidate.includes(`(${pointName})`)
      || candidate.includes("\\node") && candidate.includes(`at (${pointName})`)
    );
  assert(line, `Expected label attached to ${pointName} in exported TikZ.\n\n${source}`);
  return line;
}

function optionNumber(line: string, name: string): number {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = line.match(new RegExp(`(?:^|[,\\[])\\s*${escapedName}=([-+\\d.eE]+)`));
  assert(match, `Expected ${name}=... in command.\n\n${line}`);
  return Number(match[1]);
}

function fontSizeNumber(line: string): number {
  const match = line.match(/\\fontsize\{([-+\d.eE]+)pt\}/u);
  assert(match, `Expected an explicit \\fontsize in command.\n\n${line}`);
  return Number(match[1]);
}

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#111827",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#111827",
  labelOffsetPx: { x: 8, y: -8 },
};

const segmentStyle: LineStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 1.5,
  dash: "solid",
  opacity: 1,
  segmentMarks: [
    {
      enabled: true,
      mark: "||",
      pos: 0.5,
      sizePt: 6,
      color: "#0f766e",
      lineWidthPt: 1.25,
    },
  ],
};

const angleStyle: AngleStyle = {
  strokeColor: "#b42318",
  strokeWidth: 1.25,
  strokeDash: "solid",
  strokeOpacity: 1,
  textColor: "#111827",
  textSize: 14,
  fillEnabled: false,
  fillColor: "#ffffff",
  fillOpacity: 0,
  pattern: "",
  patternColor: "#ffffff",
  markStyle: "arc",
  markSymbol: "|",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 5,
  markColor: "#b42318",
  arcRadius: 1,
  labelText: "",
  labelPosWorld: { x: 0.6, y: 0.6 },
  showLabel: false,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    { id: "a", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "none", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "b", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "none", position: { x: 2, y: 0 }, style: pointStyle },
    { id: "c", kind: "free", name: "C", captionTex: "C", visible: true, showLabel: "none", position: { x: 0, y: 2 }, style: pointStyle },
  ],
  vectors: [],
  numbers: [],
  lines: [],
  segments: [{ id: "ab", aId: "a", bId: "b", visible: true, showLabel: false, style: segmentStyle }],
  circles: [],
  polygons: [],
  angles: [{ id: "bac", aId: "b", bId: "a", cId: "c", visible: true, style: angleStyle }],
  textLabels: [],
  richTextNodes: [],
};

const baseParams: TikzExportParams = {
  scene,
  viewport: { xmin: -1, xmax: 3, ymin: -1, ymax: 3 },
  clipRectWorld: undefined,
  clipPolygonWorld: undefined,
  screenPxPerWorld: 80,
  emitTkzSetup: true,
  drawLayerBackend: "tkz",
  bakeCoordinates: false,
  labelGlow: false,
  backgroundColor: "#ffffff",
  efficient: false,
  scaleboxScale: 1,
  trueGlobalScale: 1,
  globalScale: 1,
  pointScale: 1,
  lineScale: 1,
  labelScale: 1,
};

const base = buildTikzExportText(baseParams);
const transformed = buildTikzExportText({ ...baseParams, trueGlobalScale: 2 });
const scaleboxed = buildTikzExportText({ ...baseParams, scaleboxScale: 2 });
const wideMark = buildTikzExportText({
  ...baseParams,
  scene: {
    ...scene,
    segments: scene.segments.map((segment) => ({
      ...segment,
      style: {
        ...segment.style,
        segmentMarks: segment.style.segmentMarks?.map((mark) => ({
          ...mark,
          lineWidthPt: 4,
        })),
      },
    })),
  },
});
const plainTransformed = buildTikzExportText({
  ...baseParams,
  drawLayerBackend: "plain",
  bakeCoordinates: true,
  emitTkzSetup: false,
  trueGlobalScale: 2,
});
const labeledConstructionScene: SceneModel = {
  ...scene,
  points: scene.points.map((point, index) =>
    index === 0 ? { ...point, showLabel: "name" as const } : point
  ),
};
const labeledConstruction = buildTikzExportText({
  ...baseParams,
  scene: labeledConstructionScene,
});
const coordinateCompressedLabeledConstruction = buildTikzExportText({
  ...baseParams,
  scene: labeledConstructionScene,
  globalScale: 0.25,
});
const trueZoomedLabeledConstruction = buildTikzExportText({
  ...baseParams,
  scene: labeledConstructionScene,
  canvasTrueZoom: 2,
  scaleboxScale: 2,
  globalScale: 0.5,
});
const pageAwareGlow = buildTikzExportText({
  ...baseParams,
  scene: {
    ...scene,
    points: scene.points.map((point, index) =>
      index === 0 ? { ...point, showLabel: "name" as const } : point
    ),
  },
  drawLayerBackend: "plain",
  bakeCoordinates: true,
  labelGlow: true,
  backgroundColor: "#fefefe",
});

const labeledConstructionCommand = pointLabelLine(labeledConstruction, "A");
const coordinateCompressedLabelCommand = pointLabelLine(coordinateCompressedLabeledConstruction, "A");
assert(
  labeledConstructionCommand.includes("font=\\fontsize{"),
  `Geometric-construction point labels must use a canvas-calibrated font instead of the document default.\n\n${labeledConstruction}`
);
assertClose(
  fontSizeNumber(coordinateCompressedLabelCommand),
  fontSizeNumber(labeledConstructionCommand),
  "coordinate-only Global scale must not resize a construction label font"
);
assertClose(
  fontSizeNumber(pointLabelLine(trueZoomedLabeledConstruction, "A")),
  fontSizeNumber(labeledConstructionCommand) / 2,
  "inner construction font must remove True Zoom already carried by the outer scalebox"
);

assert(
  pageAwareGlow.includes("\\contour{\\thepagecolor}{#3}"),
  "Visual Exact glow helper must use the host document page color."
);
assert(
  /\\gdLabelGlow\{[^{}]+pt\}\{\\thepagecolor\}\{\$A\$\}/u.test(pageAwareGlow),
  `Visual Exact point labels must not bake the canvas background into the glow call.\n\n${pageAwareGlow}`
);

const formattingScene: SceneModel = {
  ...scene,
  points: scene.points.map((point, index) =>
    index === 0
      ? { ...point, position: { x: 0.123456789, y: 0.987654321 } }
      : point
  ),
  segments: scene.segments.map((segment) => ({
    ...segment,
    style: { ...segment.style, strokeColor: "#123456" },
  })),
};
const formattingParams: TikzExportParams = {
  ...baseParams,
  scene: formattingScene,
  drawLayerBackend: "plain",
  bakeCoordinates: true,
  emitTkzSetup: false,
  scaleboxScale: 1.23456789,
};
const fullPrecisionFormatting = buildTikzExportText(formattingParams);
const roundedFormatting = buildTikzExportText({
  ...formattingParams,
  roundNumbersToTwoDecimals: true,
});
const roundedConstructionFormatting = buildTikzExportText({
  ...baseParams,
  scene: formattingScene,
  roundNumbersToTwoDecimals: true,
});
assert(
  fullPrecisionFormatting.includes("0.123456789"),
  "Default export formatting must retain full coordinate precision."
);
assert(
  roundedFormatting.includes("\\scalebox{1.23}"),
  "Two-decimal formatting must also shorten the outer scalebox value."
);
assert(
  roundedFormatting.includes("\\coordinate (A) at (0.123456789,0.987654321);"),
  `Exact Coordinates must retain defining geometry even when cosmetic numbers use two decimals.\n\n${roundedFormatting}`
);
assert(
  roundedConstructionFormatting.includes("0.123456789/0.987654321/A"),
  `Two-decimal formatting must not round defining coordinates in Geometric Construction mode.\n\n${roundedConstructionFormatting}`
);

const exactColorFormatting = buildTikzExportText(formattingParams);
const namedColorFormatting = buildTikzExportText({
  ...formattingParams,
  preferDvipsNames: true,
});
assert(
  exactColorFormatting.includes("\\definecolor{gdC_123456}{RGB}{18,52,86}"),
  "Exact color mode must retain custom RGB definitions."
);
assert(
  !namedColorFormatting.includes("\\definecolor"),
  `dvipsnames-only mode must not emit custom color definitions.\n\n${namedColorFormatting}`
);
assert(
  !namedColorFormatting.includes("gdC_123456"),
  "dvipsnames-only mode must replace custom generated color names."
);
await compileTikzSnippet("dvipsnames-only-export", namedColorFormatting);

assert(
  transformed.includes("\\scalebox{2}{%\n\\begin{tikzpicture}"),
  `Geometric constructions must apply advanced scaling outside the completed tikzpicture.\n\n${transformed}`
);
assert(!base.includes("transform shape"), "Default scale must preserve the legacy tikzpicture setup.");
assert(
  !transformed.includes("transform shape"),
  "Geometric construction math must never run inside transform shape."
);
assert(
  /\\begin\{tikzpicture\}\[x=[-+\d.eE]+cm,y=[-+\d.eE]+cm,scale=2,transform shape,/u.test(plainTransformed),
  `Exact-coordinate export may safely use the advanced inner transform.\n\n${plainTransformed}`
);
assert(
  scaleboxed.includes("\\scalebox{2}{%\n\\begin{tikzpicture}"),
  `Expected the regular true-global scale to wrap the complete figure in \\scalebox.\n\n${scaleboxed}`
);
assert(!scaleboxed.includes("transform shape"), "A scalebox must not enable the advanced TikZ transform.");

const baseSegment = commandLine(base, "tkzDrawSegment");
const doubledSegment = commandLine(transformed, "tkzDrawSegment");
assertClose(
  optionNumber(doubledSegment, "line width"),
  optionNumber(baseSegment, "line width"),
  "construction segment inner line width"
);

const baseSegmentMark = segmentMarkDecorationLine(base);
const doubledSegmentMark = segmentMarkDecorationLine(transformed);
assert(
  doubledSegmentMark === baseSegmentMark,
  "Advanced construction scale must leave the independently precomputed inner mark unchanged."
);
const wideSegmentMark = segmentMarkDecorationLine(wideMark);
assert(
  JSON.stringify(segmentMarkCoordinates(wideSegmentMark)) ===
    JSON.stringify(segmentMarkCoordinates(baseSegmentMark)),
  "Changing segment-mark width must not change the precomputed tick length or gap."
);
assert(
  optionNumber(wideSegmentMark, "line width") > optionNumber(baseSegmentMark, "line width"),
  "Changing segment-mark width must still change the exported stroke width."
);
assert(
  base.includes("gdMarkDoubleTick/.style n args={4}"),
  "A double-tick segment mark must export through one reusable TikZ style."
);

const baseAngle = commandLine(base, "tkzMarkAngle");
const doubledAngle = commandLine(transformed, "tkzMarkAngle");
assertClose(
  optionNumber(doubledAngle, "size"),
  optionNumber(baseAngle, "size"),
  "tkzMarkAngle coordinate-space radius"
);
assertClose(optionNumber(doubledAngle, "mksize"), optionNumber(baseAngle, "mksize"), "tkzMarkAngle inner mark size");
assertClose(
  optionNumber(doubledAngle, "line width"),
  optionNumber(baseAngle, "line width"),
  "tkzMarkAngle inner line width"
);

assert(
  commandLine(scaleboxed, "tkzDrawSegment") === baseSegment,
  "The scalebox wrapper must leave the inner line styling unchanged."
);

await compileTikzSnippet("advanced-transform-scale", transformed);
await compileTikzSnippet("advanced-transform-scale-plain", plainTransformed);
await compileTikzSnippet("true-global-scalebox", scaleboxed);

console.log("✓ true global export scale test passed");
