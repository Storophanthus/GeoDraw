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
  strokeColor: "#1d4ed8",
  strokeWidth: 2.4,
  dash: "dashed" as const,
  opacity: 0.65,
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
  .find((line) => line.startsWith("\\tkzDrawLine[") && line.includes("(A,C)"));
if (!drawLine) {
  throw new Error("Expected line to be drawn using extreme collinear anchors (A,C)");
}

const setup = tikz.match(/\\tkzSetUpLine\[add=([^ ]+) and ([^\]]+)\]/);
if (!setup) {
  throw new Error("Expected global line setup with add extents");
}
const left = Number(setup[1]);
const right = Number(setup[2]);
if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
  throw new Error(`Invalid global line add extents: left=${setup[1]} right=${setup[2]}`);
}
if (/\\tkzDrawLine\[add=/.test(drawLine)) {
  throw new Error(`Expected no per-line add override: ${drawLine}`);
}

if (!drawLine.includes("dashed")) {
  throw new Error(`Expected dashed style in draw line: ${drawLine}`);
}
if (!drawLine.includes("opacity=0.65")) {
  throw new Error(`Expected opacity style in draw line: ${drawLine}`);
}
if (!drawLine.includes("line width=1.8pt")) {
  throw new Error(`Expected converted line width style in draw line: ${drawLine}`);
}
if (!drawLine.includes("color={rgb,255:red,29;green,78;blue,216}")) {
  throw new Error(`Expected converted stroke color in draw line: ${drawLine}`);
}

console.log("✓ export line-extents test passed");
