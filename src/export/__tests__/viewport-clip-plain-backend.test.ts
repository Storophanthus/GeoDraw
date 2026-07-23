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

const segmentStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 2,
  dash: "solid" as const,
  opacity: 1,
};

// Points sit well outside the viewport below, so a failure to clip is visible
// as geometry outside the requested window.
const scene: SceneModel = {
  points: [
    {
      id: "pA",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: -40, y: -30 },
      style: pointStyle,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 40, y: 30 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [{ id: "s1", aId: "pA", bId: "pB", visible: true, showLabel: false, style: segmentStyle }],
  circles: [],
  polygons: [],
  angles: [],
};

const viewport = { xmin: -5, xmax: 5, ymin: -4, ymax: 4 };

// Regression: "Export what I see now" (viewport clipping) silently stopped
// working in Exact Coordinates mode. The plain backend forces emitTkzSetup
// off because \tkzInit/\tkzClip are tkz-euclide macros, which removed the only
// path that clipped to the viewport, so the whole drawing was exported.
const plain = exportTikzWithOptions(scene, {
  viewport,
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: false,
});

if (!plain.includes("\\clip (")) {
  throw new Error("Expected plain backend with a viewport to emit a \\clip rectangle.");
}
if (plain.includes("\\tkzClip")) {
  throw new Error("Expected plain backend to avoid the tkz-euclide \\tkzClip macro.");
}
if (plain.includes("\\tkzInit")) {
  throw new Error("Expected plain backend to avoid the tkz-euclide \\tkzInit macro.");
}

// The clip must actually bound the requested window rather than the drawing.
const clipLine = plain.split("\n").find((line) => line.trimStart().startsWith("\\clip ("));
if (!clipLine) {
  throw new Error("Expected to find the emitted \\clip line.");
}
const nums = (clipLine.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
if (nums.length < 4) {
  throw new Error(`Expected 4 coordinates in the clip rectangle, got: ${clipLine}`);
}
const [x1, y1, x2, y2] = nums;
// clipSpace defaults to 0, so the rectangle should match the viewport exactly.
if (x1 !== viewport.xmin || y1 !== viewport.ymin || x2 !== viewport.xmax || y2 !== viewport.ymax) {
  throw new Error(
    `Expected clip rectangle to match the viewport (${viewport.xmin},${viewport.ymin})..(${viewport.xmax},${viewport.ymax}), got ${clipLine}`
  );
}

// The clip has to precede the drawing commands, otherwise it bounds nothing.
const clipIdx = plain.indexOf("\\clip (");
const drawIdx = plain.indexOf("\\draw");
if (drawIdx >= 0 && clipIdx > drawIdx) {
  throw new Error("Expected the \\clip to be emitted before any draw commands.");
}

// An explicit clip rectangle still wins, so we must not emit two clips.
const withExplicitClip = exportTikzWithOptions(scene, {
  viewport,
  clipRectWorld: { xmin: -2, xmax: 2, ymin: -2, ymax: 2 },
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: false,
});
const clipCount = withExplicitClip.split("\n").filter((line) => line.trimStart().startsWith("\\clip ")).length;
if (clipCount !== 1) {
  throw new Error(`Expected exactly one \\clip when an explicit clip rect is set, got ${clipCount}.`);
}

// The tkz backend keeps using \tkzClip; this fix must not change it.
const tkz = exportTikzWithOptions(scene, {
  viewport,
  drawLayerBackend: "tkz",
  emitTkzSetup: true,
});
if (!tkz.includes("\\tkzClip[space=")) {
  throw new Error("Expected tkz backend to keep using \\tkzClip.");
}

console.log("✓ export viewport-clip plain backend test passed");
