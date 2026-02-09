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

const lineStyle = {
  strokeColor: "#222222",
  strokeWidth: 1.5,
  dash: "solid" as const,
  opacity: 1,
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
      position: { x: -10, y: 0 },
      style: pointStyle,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: pointStyle,
    },
    {
      id: "pC",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: 15, y: 0 },
      style: pointStyle,
    },
  ],
  segments: [],
  lines: [
    {
      id: "l1",
      aId: "pA",
      bId: "pB",
      visible: true,
      style: lineStyle,
    },
  ],
  circles: [],
};

const tikz = exportTikz(scene);

const drawLine = tikz
  .split("\n")
  .find((line) => line.startsWith("\\tkzDrawLine[add=") && line.includes("(A,C)"));
if (!drawLine) {
  throw new Error("Expected line to be drawn using extreme collinear anchors (A,C)");
}

const addMatch = drawLine.match(/add=([^ ]+) and ([^\]]+)/);
if (!addMatch) {
  throw new Error("Line export missing add=<left> and <right>");
}

const left = Number(addMatch[1]);
const right = Number(addMatch[2]);
if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
  throw new Error(`Invalid line add extents: left=${addMatch[1]} right=${addMatch[2]}`);
}

console.log("✓ export line-extents test passed");
