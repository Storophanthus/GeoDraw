import { exportTikz } from "../tikz.ts";
import type { AngleStyle, SceneModel } from "../../scene/points.ts";

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

const segmentStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 1.8,
  dash: "solid" as const,
  opacity: 1,
};

const lineStyle = {
  strokeColor: "#1f2937",
  strokeWidth: 1.8,
  dash: "solid" as const,
  opacity: 1,
};

const circleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.6,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
};

const polygonStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 1.8,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
};

const angleStyle: AngleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1,
  strokeDash: "solid",
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 14,
  fillEnabled: true,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
  pattern: "",
  patternColor: "#93c5fd",
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 4,
  markColor: "#334155",
  arcRadius: 1,
  labelText: "",
  labelPosWorld: { x: 8, y: 8 },
  showLabel: false,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    { id: "pA", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "pB", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "name", position: { x: 4, y: 0 }, style: pointStyle },
    { id: "pC", kind: "free", name: "C", captionTex: "C", visible: true, showLabel: "name", position: { x: 8, y: 0 }, style: pointStyle },
    { id: "pD", kind: "free", name: "D", captionTex: "D", visible: true, showLabel: "name", position: { x: 9, y: 0 }, style: pointStyle },
    { id: "pE", kind: "free", name: "E", captionTex: "E", visible: true, showLabel: "name", position: { x: 0, y: 4 }, style: pointStyle },
    { id: "pF", kind: "free", name: "F", captionTex: "F", visible: true, showLabel: "name", position: { x: 2, y: 6 }, style: pointStyle },
    { id: "pG", kind: "free", name: "G", captionTex: "G", visible: true, showLabel: "name", position: { x: 4, y: 4 }, style: pointStyle },
    { id: "pH", kind: "free", name: "H", captionTex: "H", visible: true, showLabel: "name", position: { x: 8, y: 4 }, style: pointStyle },
    { id: "pI", kind: "free", name: "I", captionTex: "I", visible: true, showLabel: "name", position: { x: 8, y: 8 }, style: pointStyle },
    { id: "pJ", kind: "free", name: "J", captionTex: "J", visible: true, showLabel: "name", position: { x: 10, y: 8 }, style: pointStyle },
  ],
  numbers: [],
  lines: [
    { id: "l1", aId: "pA", bId: "pG", visible: true, style: lineStyle },
  ],
  segments: [
    { id: "s1", aId: "pA", bId: "pB", visible: true, showLabel: false, style: segmentStyle },
  ],
  circles: [
    { id: "c1", kind: "twoPoint", centerId: "pC", throughId: "pD", visible: true, style: circleStyle },
  ],
  polygons: [
    { id: "poly1", pointIds: ["pE", "pF", "pG"], visible: true, style: polygonStyle },
  ],
  angles: [
    { id: "ang1", kind: "sector", aId: "pH", bId: "pI", cId: "pJ", visible: true, style: angleStyle },
  ],
  geometryLayerOrder: [
    { type: "segment", id: "s1" },
    { type: "line", id: "l1" },
    { type: "circle", id: "c1" },
    { type: "polygon", id: "poly1" },
    { type: "angle", id: "ang1" },
  ],
};

const tikz = exportTikz(scene);
const sectorFillIdx = tikz.indexOf("\\tkzFillSector");
const sectorDrawIdx = tikz.indexOf("\\tkzDrawSector");
const polygonFillIdx = tikz.indexOf("\\fill[");
const polygonDrawIdx = tikz.indexOf("\\draw[");
const circleFillIdx = tikz.indexOf("\\tkzFillCircle");
const circleDrawIdx = tikz.indexOf("\\tkzDrawCircle");
const lineDrawIdx = tikz.indexOf("\\tkzDrawLine");
const segmentDrawIdx = tikz.indexOf("\\tkzDrawSegment");

const indices = [
  ["sector fill", sectorFillIdx],
  ["sector draw", sectorDrawIdx],
  ["polygon fill", polygonFillIdx],
  ["polygon draw", polygonDrawIdx],
  ["circle fill", circleFillIdx],
  ["circle draw", circleDrawIdx],
  ["line draw", lineDrawIdx],
  ["segment draw", segmentDrawIdx],
] as const;

for (const [label, idx] of indices) {
  if (idx < 0) throw new Error(`Expected ${label} command in exported TikZ.`);
}

const ordered = [sectorFillIdx, sectorDrawIdx, polygonFillIdx, polygonDrawIdx, circleFillIdx, circleDrawIdx, lineDrawIdx, segmentDrawIdx];
for (let i = 1; i < ordered.length; i += 1) {
  if (ordered[i - 1] > ordered[i]) {
    throw new Error("Expected geometry draw order to follow the explicit layer order.");
  }
}

const drawPointsIdx = tikz.indexOf("% Draw points");
const labelsIdx = tikz.indexOf("% Labels");
if (drawPointsIdx < 0 || labelsIdx < 0 || drawPointsIdx > labelsIdx) {
  throw new Error("Expected points layer before labels layer.");
}
if (drawPointsIdx < segmentDrawIdx) {
  throw new Error("Expected points to be emitted after draw objects.");
}

console.log("✓ export layer-order test passed");
