import { exportTikzWithOptions } from "../tikz.ts";
import type { PointShape, SceneModel } from "../../scene/points.ts";

const basePointStyle = {
  shape: "circle" as const,
  sizePx: 6,
  strokeColor: "#0f172a",
  strokeWidth: 1.2,
  strokeOpacity: 0.85,
  fillColor: "#60a5fa",
  fillOpacity: 0.7,
  labelFontPx: 12,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const shapes: PointShape[] = [
  "circle",
  "dot",
  "square",
  "diamond",
  "triUp",
  "triDown",
  "plus",
  "x",
  "cross",
];

const scene: SceneModel = {
  points: shapes.map((shape, i) => ({
    id: `p${i + 1}`,
    kind: "free",
    name: String.fromCharCode("A".charCodeAt(0) + i),
    captionTex: String.fromCharCode("A".charCodeAt(0) + i),
    visible: true,
    showLabel: "none",
    position: { x: i * 2, y: 0 },
    style: {
      ...basePointStyle,
      shape,
    },
  })),
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const tikz = exportTikzWithOptions(scene, {});
const pointStyleLines = tikz.split("\n").filter((line) => line.startsWith("\\tikzset{tkzVertex"));

if (!pointStyleLines.some((line) => line.includes("shape=cross,") && line.includes("fill=none"))) {
  throw new Error("Expected plus point shape to export with tkz shape=cross.");
}

const crossOutStyles = pointStyleLines.filter((line) => line.includes("shape=cross out"));
if (crossOutStyles.length < 2) {
  throw new Error("Expected both x and cross app shapes to export as shape=cross out variants.");
}
if (!crossOutStyles.some((line) => line.includes("path picture={\\draw["))) {
  throw new Error("Expected app cross shape to include plus overlay path picture.");
}
if (!crossOutStyles.some((line) => !line.includes("path picture={\\draw["))) {
  throw new Error("Expected app x shape to export as plain cross out (without plus overlay).");
}

if (!pointStyleLines.some((line) => line.includes("shape=circle") && line.includes("draw=none") && line.includes("line width=0pt"))) {
  throw new Error("Expected dot point shape to export as fill-only circle with no stroke.");
}

if (!pointStyleLines.some((line) => line.includes("shape=diamond"))) {
  throw new Error("Expected diamond point shape to be exported.");
}

if (!pointStyleLines.some((line) => line.includes("regular polygon, regular polygon sides=3"))) {
  throw new Error("Expected triangular point shapes to be exported via regular polygon.");
}

if (!tikz.includes("\\usetikzlibrary{shapes.geometric}")) {
  throw new Error("Expected exporter to inject shapes.geometric when geometric point shapes are used.");
}

console.log("✓ export point-shape style parity test passed");
