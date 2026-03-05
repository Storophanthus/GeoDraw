import { exportTikzEfficientWithOptions, exportTikzWithOptions } from "../tikz.ts";
import type { AngleStyle, LineStyle, PointStyle, SceneModel } from "../../scene/points.ts";

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 6,
  strokeColor: "#000000",
  strokeWidth: 1.7,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 18,
  labelHaloWidthPx: 3.5,
  labelHaloColor: "#ffffff",
  labelColor: "#000000",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle: LineStyle = {
  strokeColor: "#000000",
  strokeWidth: 1.6,
  dash: "solid",
  opacity: 1,
};

const angleStyle: AngleStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeDash: "solid",
  strokeOpacity: 1,
  textColor: "#000000",
  textSize: 16,
  fillEnabled: true,
  fillColor: "#e7dcc8",
  fillOpacity: 0.2,
  pattern: "",
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 7.4,
  markColor: "#000000",
  arcRadius: 5,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: false,
  showValue: false,
  promoteToSolid: false,
};

const scene: SceneModel = {
  points: [
    { id: "o", kind: "free", name: "O", captionTex: "O", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    {
      id: "b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: Math.sqrt(3), y: 1 },
      style: pointStyle,
    },
    {
      id: "c",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: 1, y: Math.sqrt(3) },
      style: pointStyle,
    },
    { id: "u", kind: "free", name: "U", captionTex: "U", visible: true, showLabel: "name", position: { x: 0.8, y: -3 }, style: pointStyle },
    { id: "v", kind: "free", name: "V", captionTex: "V", visible: true, showLabel: "name", position: { x: 0.8, y: 3 }, style: pointStyle },
    {
      id: "f",
      kind: "intersectionPoint",
      name: "F",
      captionTex: "F",
      visible: true,
      showLabel: "name",
      objA: { type: "line", id: "l1" },
      objB: { type: "angle", id: "a1" },
      preferredWorld: { x: 1.4, y: 1.3 },
      style: pointStyle,
    },
    {
      id: "g",
      kind: "lineLikeIntersectionPoint",
      name: "G",
      captionTex: "G",
      visible: true,
      showLabel: "name",
      objA: { type: "line", id: "l1" },
      objB: { type: "segment", id: "sOB" },
      preferredWorld: { x: 0.9, y: 0.5 },
      style: pointStyle,
    },
    {
      id: "h",
      kind: "lineLikeIntersectionPoint",
      name: "H",
      captionTex: "H",
      visible: true,
      showLabel: "name",
      objA: { type: "line", id: "l1" },
      objB: { type: "segment", id: "sOC" },
      preferredWorld: { x: 0.7, y: 1.2 },
      style: pointStyle,
    },
  ],
  vectors: [],
  numbers: [],
  lines: [{ id: "l1", kind: "twoPoint", aId: "u", bId: "v", visible: true, style: lineStyle }],
  segments: [
    { id: "sOB", aId: "o", bId: "b", visible: true, showLabel: false, style: lineStyle },
    { id: "sOC", aId: "o", bId: "c", visible: true, showLabel: false, style: lineStyle },
  ],
  circles: [],
  polygons: [],
  angles: [{ id: "a1", kind: "sector", aId: "b", bId: "o", cId: "c", visible: true, style: angleStyle }],
};

for (const exporter of [exportTikzWithOptions, exportTikzEfficientWithOptions]) {
  let out = "";
  try {
    out = exporter(scene, { emitTkzSetup: false });
  } catch (error) {
    throw new Error(`Export should not fail for visible undefined dynamic intersections: ${String(error)}`);
  }
  if (!out.includes("\\begin{tikzpicture}")) {
    throw new Error("Expected TikZ output after skipping undefined intersection points.");
  }
}

console.log("✓ undefined visible intersections export test passed");
