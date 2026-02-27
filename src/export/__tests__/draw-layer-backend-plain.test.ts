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

const segmentStyle = {
  strokeColor: "#0f766e",
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
    { id: "pA", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "pB", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "name", position: { x: 4, y: 0 }, style: pointStyle },
    { id: "pC", kind: "free", name: "C", captionTex: "C", visible: true, showLabel: "name", position: { x: 2, y: 3 }, style: pointStyle },
  ],
  numbers: [],
  lines: [{ id: "l1", aId: "pA", bId: "pB", visible: true, style: lineStyle }],
  segments: [{ id: "s1", aId: "pB", bId: "pC", visible: true, showLabel: false, style: segmentStyle }],
  circles: [{ id: "c1", kind: "twoPoint", centerId: "pA", throughId: "pC", visible: true, style: circleStyle }],
  polygons: [],
  angles: [],
};

const plain = exportTikzWithOptions(scene, { drawLayerBackend: "plain" });
if (!plain.includes("% Draw objects")) {
  throw new Error("Expected draw-objects section in plain draw-layer export.");
}
if (!plain.includes("\\draw[")) {
  throw new Error("Expected plain draw backend to emit \\draw commands.");
}
if (!plain.includes("gd plain draw backend: DrawLine exported as anchor segment")) {
  throw new Error("Expected plain backend DrawLine approximation marker.");
}
if (plain.includes("\\tkzDrawSegment") || plain.includes("\\tkzDrawLine") || plain.includes("\\tkzDrawCircle")) {
  throw new Error("Expected plain backend to avoid tkz draw macros for line/segment/circle.");
}
if (!plain.includes("\\node") || !plain.includes("at (A)")) {
  throw new Error("Expected plain backend to emit point labels as TikZ nodes.");
}

const tkz = exportTikzWithOptions(scene, { drawLayerBackend: "tkz" });
if (!tkz.includes("\\tkzDrawSegment") || !tkz.includes("\\tkzDrawLine") || !tkz.includes("\\tkzDrawCircle")) {
  throw new Error("Expected tkz backend to retain tkz draw macros.");
}

console.log("✓ export draw-layer plain backend test passed");
