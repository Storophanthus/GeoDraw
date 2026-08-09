import {
  exportTikzEfficientWithOptions,
  exportTikzWithOptions,
  type TikzExportOptions,
  type TikzExportViewport,
} from "../tikz.ts";
import type { AngleStyle, LineStyle, PointStyle, SceneModel } from "../../scene/points.ts";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertIncludes(source: string, expected: string, message: string): void {
  assert(source.includes(expected), `${message}\nMissing: ${expected}\n\n${source}`);
}

function assertNoTkzMacros(source: string, label: string): void {
  const macro = source.match(/\\tkz[A-Za-z@]+/u)?.[0];
  assert(!macro, `${label} must not depend on tkz-euclide, but emitted ${macro}.\n\n${source}`);
}

function numericPathCoordinates(line: string): Array<{ x: number; y: number }> {
  return [...line.matchAll(/\(([-+\d.eE]+),([-+\d.eE]+)\)/gu)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4.75,
  strokeColor: "#101828",
  strokeWidth: 1.35,
  strokeOpacity: 1,
  fillColor: "#f9fafb",
  fillOpacity: 1,
  labelFontPx: 13.456789012345,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#101828",
  labelOffsetPx: { x: 8.1234567890123, y: -7.2345678901234 },
};

const lineStyle: LineStyle = {
  strokeColor: "#344054",
  strokeWidth: 1.7,
  dash: "solid",
  opacity: 1,
};

const markedSegmentStyle: LineStyle = {
  strokeColor: "#067647",
  strokeWidth: 1.45,
  dash: "solid",
  opacity: 1,
  segmentMarks: [
    {
      enabled: true,
      mark: "||",
      pos: 0.5,
      sizePt: 5.25,
      color: "#067647",
      lineWidthPt: 1.125,
      distribution: "multi",
      startPos: 0.25,
      endPos: 0.75,
      step: 0.25,
    },
  ],
};

function angleStyle(overrides: Partial<AngleStyle> = {}): AngleStyle {
  return {
    strokeColor: "#b42318",
    strokeWidth: 1.3,
    strokeDash: "solid",
    strokeOpacity: 1,
    textColor: "#101828",
    textSize: 13,
    fillEnabled: true,
    fillColor: "#fecdca",
    fillOpacity: 0.28,
    pattern: "",
    patternColor: "#fecdca",
    markStyle: "arc",
    markSymbol: "|",
    arcMultiplicity: 1,
    markPos: 0.5,
    markSize: 4.5,
    markColor: "#b42318",
    arcRadius: 0.9,
    labelText: "",
    labelPosWorld: { x: 0, y: 0 },
    showLabel: false,
    showValue: false,
    ...overrides,
  };
}

const scene: SceneModel = {
  points: [
    {
      id: "line-a",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: -1.2345678901234, y: 0.375123456789012 },
      style: pointStyle,
    },
    {
      id: "line-b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: false,
      showLabel: "none",
      position: { x: 2.3456789012345, y: 0.375123456789012 },
      style: pointStyle,
    },
    {
      id: "segment-a",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: false,
      showLabel: "none",
      position: { x: -4, y: -2.2 },
      style: pointStyle,
    },
    {
      id: "segment-b",
      kind: "free",
      name: "D",
      captionTex: "D",
      visible: false,
      showLabel: "none",
      position: { x: 4, y: -2.2 },
      style: pointStyle,
    },
    {
      id: "angle-a",
      kind: "free",
      name: "E",
      captionTex: "E",
      visible: false,
      showLabel: "none",
      position: { x: 2, y: 0 },
      style: pointStyle,
    },
    {
      id: "angle-b",
      kind: "free",
      name: "F",
      captionTex: "F",
      visible: false,
      showLabel: "none",
      position: { x: 1, y: 0 },
      style: pointStyle,
    },
    {
      id: "angle-c",
      kind: "free",
      name: "G",
      captionTex: "G",
      visible: false,
      showLabel: "none",
      position: { x: 1.5, y: 1.4 },
      style: pointStyle,
    },
    {
      id: "right-a",
      kind: "free",
      name: "H",
      captionTex: "H",
      visible: false,
      showLabel: "none",
      position: { x: -1, y: 2.5 },
      style: pointStyle,
    },
    {
      id: "right-b",
      kind: "free",
      name: "I",
      captionTex: "I",
      visible: false,
      showLabel: "none",
      position: { x: -2, y: 2.5 },
      style: pointStyle,
    },
    {
      id: "right-c",
      kind: "free",
      name: "J",
      captionTex: "J",
      visible: false,
      showLabel: "none",
      position: { x: -2, y: 3.5 },
      style: pointStyle,
    },
    {
      id: "sector-a",
      kind: "free",
      name: "K",
      captionTex: "K",
      visible: false,
      showLabel: "none",
      position: { x: -3.5, y: 0 },
      style: pointStyle,
    },
    {
      id: "sector-b",
      kind: "free",
      name: "L",
      captionTex: "L",
      visible: false,
      showLabel: "none",
      position: { x: -4.5, y: 0 },
      style: pointStyle,
    },
    {
      id: "sector-c",
      kind: "free",
      name: "M",
      captionTex: "M",
      visible: false,
      showLabel: "none",
      position: { x: -4.5, y: 1.2 },
      style: pointStyle,
    },
  ],
  vectors: [],
  numbers: [],
  lines: [
    {
      id: "infinite-line",
      kind: "twoPoint",
      aId: "line-a",
      bId: "line-b",
      visible: true,
      style: lineStyle,
    },
  ],
  segments: [
    {
      id: "marked-segment",
      aId: "segment-a",
      bId: "segment-b",
      visible: true,
      showLabel: false,
      style: markedSegmentStyle,
    },
  ],
  circles: [],
  polygons: [],
  angles: [
    {
      id: "ordinary-angle",
      kind: "angle",
      aId: "angle-a",
      bId: "angle-b",
      cId: "angle-c",
      visible: true,
      style: angleStyle({
        labelText: "\\alpha",
        labelPosWorld: { x: 1.87654321098765, y: 0.654321098765432 },
        showLabel: true,
      }),
    },
    {
      id: "right-angle",
      kind: "angle",
      aId: "right-a",
      bId: "right-b",
      cId: "right-c",
      visible: true,
      style: angleStyle({
        markStyle: "rightSquare",
        markSymbol: "none",
        fillColor: "#d1fadf",
        patternColor: "#d1fadf",
        strokeColor: "#067647",
        markColor: "#067647",
        promoteToSolid: true,
      }),
    },
    {
      id: "sector",
      kind: "sector",
      aId: "sector-a",
      bId: "sector-b",
      cId: "sector-c",
      visible: true,
      style: angleStyle({
        strokeColor: "#175cd3",
        markColor: "#175cd3",
        fillColor: "#d1e9ff",
        patternColor: "#d1e9ff",
      }),
    },
  ],
};

const viewport: TikzExportViewport = {
  xmin: -5.12345678901234,
  xmax: 6.98765432109876,
  ymin: -3.45678901234567,
  ymax: 4.56789012345678,
};

const visualExactOptions: TikzExportOptions = {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: false,
  viewport,
  clipSpace: 0,
  screenPxPerWorld: 100,
  worldToTikzScale: 1,
  autoScaleToFitCm: { maxWidthCm: 22.4, maxHeightCm: 14.4 },
};

const visualExact = exportTikzWithOptions(scene, visualExactOptions);
const efficientVisualExact = exportTikzEfficientWithOptions(scene, visualExactOptions);

for (const [label, output] of [
  ["Visual Exact", visualExact],
  ["Efficient Visual Exact", efficientVisualExact],
] as const) {
  assertNoTkzMacros(output, label);
  assertIncludes(
    output,
    "\\usetikzlibrary{patterns,through,arrows",
    `${label} must load the TikZ libraries required by its generated options and paths.`
  );
  assertIncludes(
    output,
    "line cap=round,line join=round,>=triangle 45",
    `${label} must retain the triangle 45 arrowhead option now backed by the arrows library.`
  );
  assertIncludes(
    output,
    "\\path[use as bounding box] (-5.12345678901234,-3.45678901234567) rectangle (6.98765432109876,4.56789012345678);",
    `${label} must preserve the exact current-view PDF bounding box.`
  );
  assertIncludes(
    output,
    "\\clip (-5.12345678901234,-3.45678901234567) rectangle (6.98765432109876,4.56789012345678);",
    `${label} must clip to the exact current canvas view.`
  );
  assertIncludes(
    output,
    "at (1.87654321098765,0.654321098765432)",
    `${label} must place the angle label at its exact stored world coordinate.`
  );
}

assertIncludes(
  efficientVisualExact,
  "\\coordinate (A) at (-1.2345678901234,0.375123456789012);",
  "Efficient Visual Exact must retain baked coordinate precision."
);

const visualLines = visualExact.split("\n");
const pointLabelLine = visualLines.find(
  (line) => line.startsWith("\\node") && line.includes("{$A$}")
);
assert(pointLabelLine, `Visual Exact must emit point A's label as a direct TikZ node.\n\n${visualExact}`);
assert(
  pointLabelLine.includes("at (A)") && numericPathCoordinates(pointLabelLine).length === 0,
  `Visual Exact may bake point A itself, but its label must remain relative to named point A.\n\n${pointLabelLine}`
);
const pointLabelFontPt = Number(
  pointLabelLine.match(/\\fontsize\{([-+\d.eE]+)pt\}/u)?.[1] ?? Number.NaN
);
const viewportWorldWidth = viewport.xmax - viewport.xmin;
const viewportWorldHeight = viewport.ymax - viewport.ymin;
const finalCoordinateScale = Math.min(22.4 / viewportWorldWidth, 14.4 / viewportWorldHeight);
const expectedCanvasPxToTikzPt = (finalCoordinateScale * (72.27 / 2.54)) / 100;
const expectedPointLabelFontPt = pointStyle.labelFontPx * expectedCanvasPxToTikzPt;
assert(
  Number.isFinite(pointLabelFontPt) &&
    Math.abs(pointLabelFontPt - expectedPointLabelFontPt) <= 1e-12,
  `Point label font must use the final canvas-pixel-to-TikZ-point metric: ${pointLabelLine}`
);
const semanticPointPlacement = pointLabelLine.match(
  /above right=\{([-+\d.eE]+)em and ([-+\d.eE]+)em\}/u
);
const pointLabelYShiftEm = Number(semanticPointPlacement?.[1] ?? Number.NaN);
const pointLabelXShiftEm = Number(semanticPointPlacement?.[2] ?? Number.NaN);
const expectedPointLabelDescentPx = pointStyle.labelFontPx * 0.14;
assert(
  Number.isFinite(pointLabelXShiftEm) &&
    Number.isFinite(pointLabelYShiftEm) &&
    Math.abs(pointLabelXShiftEm - (pointStyle.labelOffsetPx.x * expectedCanvasPxToTikzPt) / expectedPointLabelFontPt) <= 1e-12 &&
    Math.abs(
      pointLabelYShiftEm -
        Math.max(0, -pointStyle.labelOffsetPx.y - expectedPointLabelDescentPx) /
          pointStyle.labelFontPx
    ) <= 1e-12,
  `Visual Exact point-label displacement must convert the canvas baseline origin into editable semantic edge gaps.\n\n${pointLabelLine}`
);
for (const [label, output] of [
  ["Visual Exact", visualExact],
  ["Efficient Visual Exact", efficientVisualExact],
] as const) {
  const labelLine = output
    .split("\n")
    .find((line) => line.startsWith("\\node") && line.includes("{$A$}"));
  assert(
    labelLine?.includes("at (A)"),
    `${label} must never replace a named point-label anchor with a calculated coordinate.\n\n${output}`
  );
}

const semanticPointBase = scene.points[0];
assert(
  semanticPointBase?.kind === "free",
  "Visual Exact semantic edge-gap fixture requires a free point base."
);
const semanticEdgeGapScene: SceneModel = {
  ...scene,
  points: [
    {
      ...semanticPointBase,
      id: "left-label",
      name: "A",
      captionTex: "A",
      position: { x: -1, y: 0 },
      style: {
        ...pointStyle,
        labelFontPx: 18,
        labelOffsetPx: { x: -23.7109375, y: 1.44140625 },
      },
    },
    {
      ...semanticPointBase,
      id: "below-label",
      name: "I",
      captionTex: "I",
      position: { x: 1, y: 0 },
      style: {
        ...pointStyle,
        labelFontPx: 18,
        labelOffsetPx: { x: 2.73828125, y: 22.4765625 },
      },
    },
    {
      ...semanticPointBase,
      id: "caption-label",
      name: "P",
      captionTex: "P^{\\prime}",
      showLabel: "caption",
      position: { x: 3, y: 0 },
      style: {
        ...pointStyle,
        labelFontPx: 18,
        labelOffsetPx: { x: -4.950981614086016, y: -30.511649574899497 },
      },
    },
  ],
  lines: [],
  segments: [],
  angles: [],
};
const semanticEdgeGapExport = exportTikzWithOptions(
  semanticEdgeGapScene,
  visualExactOptions
);
const semanticEdgeGapLines = semanticEdgeGapExport.split("\n");
const leftEdgeGapLine = semanticEdgeGapLines.find((line) => line.includes("{$A$}"));
const belowEdgeGapLine = semanticEdgeGapLines.find((line) => line.includes("{$I$}"));
const captionEdgeGapLine = semanticEdgeGapLines.find((line) =>
  line.includes("{$P^{\\prime}$}")
);
assertIncludes(
  leftEdgeGapLine ?? "",
  "left=0.697274305555556em",
  "A left-positioned label must subtract its own estimated width from the canvas baseline-origin offset."
);
assertIncludes(
  belowEdgeGapLine ?? "",
  "below=0.468697916666667em",
  "A below-positioned label must subtract its ascent from the canvas baseline-origin offset."
);
assertIncludes(
  captionEdgeGapLine ?? "",
  "above=0.864306992684181em",
  "An above-positioned KaTeX caption must subtract its rendered height from the canvas top-left offset."
);

const infiniteLineCommentIndex = visualLines.findIndex((line) =>
  line.includes("DrawLine exported as finite viewport segment (A,B)")
);
assert(infiniteLineCommentIndex >= 0, `Visual Exact must export an infinite line as a finite viewport segment.\n\n${visualExact}`);
const infiniteLineDraw = visualLines
  .slice(infiniteLineCommentIndex + 1)
  .find((line) => line.startsWith("\\draw"));
assert(infiniteLineDraw, `Missing direct TikZ draw command after the finite-line marker.\n\n${visualExact}`);
const lineCoordinates = numericPathCoordinates(infiniteLineDraw);
assert(lineCoordinates.length >= 2, `Could not parse Visual Exact line endpoints: ${infiniteLineDraw}`);
const sortedLineCoordinates = lineCoordinates.slice(0, 2).sort((left, right) => left.x - right.x);
assert(
  sortedLineCoordinates[0].x <= viewport.xmin + 1e-9 &&
    sortedLineCoordinates[1].x >= viewport.xmax - 1e-9 &&
    sortedLineCoordinates.every((point) => Math.abs(point.y - 0.375123456789012) <= 1e-9),
  `The infinite horizontal line must reach both viewport edges: ${infiniteLineDraw}`
);

const sectorStroke = visualLines.find(
  (line) =>
    line.startsWith("\\draw") &&
    line.includes("(L) -- (K)") &&
    line.includes("arc[start angle=")
);
assert(sectorStroke, `Visual Exact must emit the sector boundary with direct TikZ.\n\n${visualExact}`);
assert(
  sectorStroke.trimEnd().endsWith("-- cycle;"),
  `The sector stroke must include both radial sides and close its boundary: ${sectorStroke}`
);

const directArcLines = visualLines.filter(
  (line) => line.startsWith("\\draw") && line.includes("arc[start angle=")
);
assert(
  directArcLines.length >= 2,
  `Visual Exact must draw both the ordinary angle and sector with direct TikZ arcs.\n\n${visualExact}`
);
const directAngleFills = visualLines.filter(
  (line) => line.startsWith("\\fill") && line.includes("arc[start angle=") && line.includes("-- cycle;")
);
assert(
  directAngleFills.length >= 2,
  `Visual Exact must fill ordinary angles and sectors with direct closed TikZ paths.\n\n${visualExact}`
);

const rightAngleDirectPath = visualLines.find((line) => {
  if (!line.startsWith("\\draw") || line.includes("arc[")) return false;
  const points = numericPathCoordinates(line);
  return (
    points.length === 3 &&
    points.every((point) => Math.hypot(point.x - -2, point.y - 2.5) < 0.5)
  );
});
assert(
  rightAngleDirectPath,
  `Visual Exact must emit the right-angle square as a direct numeric TikZ path.\n\n${visualExact}`
);

const directMarkLines = visualLines.filter((line) => {
  if (!line.startsWith("\\draw") || line.includes("(C) -- (D)")) return false;
  const points = numericPathCoordinates(line);
  return (
    points.length === 2 &&
    points.every((point) => Math.abs(point.y - -2.2) < 0.25) &&
    points.every((point) => Math.abs(point.x) < 2.25)
  );
});
assert(
  directMarkLines.length === 0,
  `Visual Exact must not bake distributed segment marks into anonymous numeric strokes.\n\n${visualExact}`
);
assert(
  visualExact.includes("gdMultiDoubleTick/.style={") &&
    visualExact.includes("mark=between positions 0.25 and 0.75 step 0.25 with {") &&
    visualExact.includes("\\path[gdMultiDoubleTick] (C) -- (D); % Segment mark C--D"),
  `Visual Exact must keep distributed segment marks as one readable named-path decoration.\n\n${visualExact}`
);
const definitionsIndex = visualExact.indexOf("gdMultiDoubleTick/.style={");
const pointsSectionIndex = visualExact.indexOf("% Points");
assert(
  definitionsIndex > 0 && definitionsIndex < pointsSectionIndex,
  `Generated style definitions must be grouped near the beginning, before geometry sections.\n\n${visualExact}`
);

const reconstructible = exportTikzWithOptions(scene, {
  drawLayerBackend: "tkz",
  bakePointCoordinates: false,
  emitTkzSetup: true,
  viewport,
  clipSpace: 0,
});

assertIncludes(reconstructible, "\\tkzDefPoints{", "Reconstructible export must retain tkz point definitions.");
assertIncludes(reconstructible, "\\tkzDrawLine", "Reconstructible export must retain tkz infinite-line semantics.");
const reconstructibleMarkLines = reconstructible
  .split("\n")
  .filter((line) => line.includes("\\path[gdMultiDoubleTick]") && line.includes("(C) -- (D)"));
assert(
  reconstructibleMarkLines.length === 1,
  `Reconstructible export must keep the distributed mark as one readable decoration attached to the named segment.\n\n${reconstructible}`
);
assert(
  reconstructible.includes("gdMultiDoubleTick/.style={") &&
    reconstructible.includes("mark=between positions 0.25 and 0.75 step 0.25 with {"),
  `Reconstructed distributed double ticks must use one reusable, customizable TikZ style.\n\n${reconstructible}`
);
assert(
  !reconstructible.includes("gdMarkDoubleTick/.style") &&
    !reconstructible.includes("gdMarkTripleTick/.style") &&
    !reconstructible.includes("gdMarkCircle/.style"),
  `The export must not include segment-mark styles that this figure does not use.\n\n${reconstructible}`
);
assert(
  reconstructibleMarkLines.every((line) => line.includes("% Segment mark C--D")),
  `The compact segment-mark use must identify its owning segment.\n\n${reconstructible}`
);
assert(
  !reconstructible.includes("\\tkzMarkSegment"),
  "Canvas-calibrated reconstructible export must not couple double-tick spacing to tkz-euclide's plot-mark line width."
);
assertIncludes(reconstructible, "\\tkzDrawSector", "Reconstructible export must retain tkz sector semantics.");
assertIncludes(reconstructible, "\\tkzMarkAngle", "Reconstructible export must retain tkz ordinary-angle semantics.");
assertIncludes(reconstructible, "\\tkzLabelAngle", "Reconstructible export must retain tkz angle-label semantics.");
assert(
  /\\node\[[^\]]*xshift=[^\]]*\]\s+at\s+\(A\)/u.test(reconstructible),
  `Reconstructible export must keep point labels attached to named construction points while preserving their dragged offsets.\n\n${reconstructible}`
);
assertIncludes(
  reconstructible,
  "\\tkzMarkRightAngles",
  "Reconstructible export must retain tkz right-angle semantics."
);

await compileTikzSnippet("visual-exact-contract", visualExact);

console.log("✓ Visual Exact plain/baked contract and reconstructible isolation test passed");
