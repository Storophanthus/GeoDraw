import { exportTikzWithOptions } from "../tikz.ts";
import type { SceneModel } from "../../scene/points.ts";

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#111111",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 12,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#111111",
  labelOffsetPx: { x: 8, y: -8 },
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

const scene: SceneModel = {
  points: [
    { id: "A", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "B", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "name", position: { x: 4, y: 0 }, style: pointStyle },
    { id: "C", kind: "free", name: "C", captionTex: "C", visible: true, showLabel: "name", position: { x: 0, y: 4 }, style: pointStyle },
    { id: "D", kind: "free", name: "D", captionTex: "D", visible: true, showLabel: "name", position: { x: 1, y: 3 }, style: pointStyle },
    { id: "E", kind: "free", name: "E", captionTex: "E", visible: true, showLabel: "name", position: { x: 6, y: 0 }, style: pointStyle },
    { id: "F", kind: "free", name: "F", captionTex: "F", visible: true, showLabel: "name", position: { x: 7, y: 2 }, style: pointStyle },
  ],
  numbers: [],
  lines: [
    { id: "base", aId: "A", bId: "B", visible: true, style: lineStyle },
    { id: "par", kind: "parallel", throughId: "D", base: { type: "line", id: "base" }, visible: true, style: lineStyle },
    { id: "perp", kind: "perpendicular", throughId: "C", base: { type: "line", id: "base" }, visible: true, style: lineStyle },
    { id: "bis", kind: "angleBisector", aId: "D", bId: "A", cId: "C", visible: true, style: lineStyle },
    { id: "tan", kind: "tangent", throughId: "E", circleId: "c1", branchIndex: 0, visible: true, style: lineStyle },
    {
      id: "ct",
      kind: "circleCircleTangent",
      circleAId: "c1",
      circleBId: "c2",
      family: "outer",
      branchIndex: 0,
      visible: true,
      style: lineStyle,
    },
  ],
  segments: [],
  circles: [
    { id: "c1", kind: "twoPoint", centerId: "A", throughId: "B", visible: true, style: circleStyle },
    { id: "c2", kind: "twoPoint", centerId: "E", throughId: "F", visible: true, style: circleStyle },
  ],
  polygons: [],
  angles: [],
};

const exported = exportTikzWithOptions(scene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: false,
});

if (!exported.includes("% Constructions")) {
  throw new Error("Expected plain visual-export to include constructions section.");
}

const disallowed = [
  "\\tkzDefLine",
  "\\tkzGetPoint",
  "\\tkzGetPoints",
  "\\tkzDefTriangleCenter",
  "\\tkzDefCircleTangentsFromPoint",
  "\\tkzDefExtSimilitudeCenter",
];
for (const token of disallowed) {
  if (exported.includes(token)) {
    throw new Error(`Expected Visual-Exact plain export to avoid construction tkz macro: ${token}`);
  }
}

if (!exported.includes("\\coordinate (gdPar_")) {
  throw new Error("Expected plain visual-export to define baked anchors for parallel line.");
}

console.log("✓ export draw-layer plain construction-line test passed");
