import { buildTikzExportText, type TikzExportParams } from "../buildTikzExportText.ts";
import type {
  LineStyle,
  PointStyle,
  SceneModel,
  SegmentMarkSymbol,
} from "../../scene/points.ts";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

const marks: Array<{ symbol: SegmentMarkSymbol; styleName: string }> = [
  { symbol: "|", styleName: "gdMarkTick" },
  { symbol: "||", styleName: "gdMarkDoubleTick" },
  { symbol: "|||", styleName: "gdMarkTripleTick" },
  { symbol: "s", styleName: "gdMarkSlash" },
  { symbol: "s|", styleName: "gdMarkSlashTick" },
  { symbol: "s||", styleName: "gdMarkSlashDoubleTick" },
  { symbol: "x", styleName: "gdMarkCross" },
  { symbol: "o", styleName: "gdMarkCircle" },
  { symbol: "oo", styleName: "gdMarkDoubleCircle" },
  { symbol: "dot", styleName: "gdMarkDot" },
  { symbol: "z", styleName: "gdMarkZigzag" },
];

const points: SceneModel["points"] = [];
const segments: SceneModel["segments"] = [];
for (let index = 0; index < marks.length; index += 1) {
  const aId = `a-${index}`;
  const bId = `b-${index}`;
  points.push({
    id: aId,
    kind: "free",
    name: `A${index}`,
    captionTex: `A${index}`,
    visible: true,
    showLabel: "none",
    position: { x: 0, y: index },
    style: pointStyle,
  });
  points.push({
    id: bId,
    kind: "free",
    name: `B${index}`,
    captionTex: `B${index}`,
    visible: true,
    showLabel: "none",
    position: { x: 4, y: index },
    style: pointStyle,
  });
  const lineStyle: LineStyle = {
    strokeColor: "#344054",
    strokeWidth: 1.4,
    dash: "solid",
    opacity: 1,
    segmentMarks: [{
      enabled: true,
      mark: marks[index].symbol,
      pos: 0.5,
      sizePt: 2.2,
      lineWidthPt: 3.9,
      color: "#403963",
    }],
  };
  segments.push({ id: `segment-${index}`, aId, bId, visible: true, showLabel: false, style: lineStyle });
}

const scene: SceneModel = {
  points,
  vectors: [],
  numbers: [],
  lines: [],
  segments,
  circles: [],
  polygons: [],
  angles: [],
};

const params: TikzExportParams = {
  scene,
  viewport: { xmin: -1, xmax: 5, ymin: -1, ymax: marks.length },
  clipRectWorld: undefined,
  clipPolygonWorld: undefined,
  screenPxPerWorld: 80,
  emitTkzSetup: true,
  drawLayerBackend: "tkz",
  bakeCoordinates: false,
  labelGlow: false,
  backgroundColor: "#ffffff",
  efficient: true,
  scaleboxScale: 1,
  trueGlobalScale: 1,
  globalScale: 1,
  pointScale: 1,
  lineScale: 1,
  labelScale: 1,
};

const tikz = buildTikzExportText(params);
assert(
  (tikz.match(/% Segment-mark styles used in this figure; each use is labeled below\./gu) ?? []).length === 1,
  `Expected one shared segment-mark tikzset block.\n\n${tikz}`
);
assert(!tikz.includes("\\tkzMarkSegment"), "Canvas-calibrated marks must use the customizable styles.");
for (const { styleName } of marks) {
  assert(
    tikz.includes(`${styleName}=`),
    `Expected an invocation of the ${styleName} segment-mark style.\n\n${tikz}`
  );
}

await compileTikzSnippet("segment-mark-tikzset", tikz);

console.log("✓ customizable segment-mark tikzset test passed");
