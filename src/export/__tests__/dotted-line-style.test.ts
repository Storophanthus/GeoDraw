import { exportTikz } from "../tikz.ts";
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
  labelHaloWidthPx: 3,
  labelHaloColor: "#ffffff",
  labelColor: "#111111",
  labelOffsetPx: { x: 8, y: -8 },
};

const scene: SceneModel = {
  points: [
    {
      id: "pA",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: -2, y: 0 },
      style: pointStyle,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 4, y: 0 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [
    {
      id: "l1",
      aId: "pA",
      bId: "pB",
      visible: true,
      style: {
        strokeColor: "#1d4ed8",
        strokeWidth: 6,
        dash: "dotted",
        opacity: 1,
      },
    },
  ],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const tikz = exportTikz(scene);
const drawLine = tikz
  .split("\n")
  .find((line) => line.startsWith("\\tkzDrawLine["));

if (!drawLine) {
  throw new Error("Expected dotted line fixture to export a \\tkzDrawLine command.");
}
if (!drawLine.includes("line cap=round")) {
  throw new Error(`Expected dotted export to force round-cap dots: ${drawLine}`);
}
if (!/dash pattern=on 0pt off [0-9.]+pt/.test(drawLine)) {
  throw new Error(`Expected dotted export to use explicit on 0pt/off Npt pattern: ${drawLine}`);
}
if (drawLine.includes(", dotted") || drawLine.includes("[dotted")) {
  throw new Error(`Expected dotted export to avoid TikZ builtin dotted style: ${drawLine}`);
}

console.log("✓ export dotted-line style test passed");
