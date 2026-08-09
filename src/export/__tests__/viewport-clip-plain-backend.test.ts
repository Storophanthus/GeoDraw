import { exportTikzWithOptions, renderTikz, type TikzCommand } from "../tikz.ts";
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
    {
      id: "pC",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: -40, y: 20 },
      style: pointStyle,
    },
    {
      id: "pD",
      kind: "free",
      name: "D",
      captionTex: "D",
      visible: true,
      showLabel: "name",
      position: { x: -20, y: 20 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [
    { id: "s1", aId: "pA", bId: "pB", visible: true, showLabel: false, style: segmentStyle },
    {
      id: "sOutside",
      aId: "pC",
      bId: "pD",
      visible: true,
      showLabel: false,
      style: {
        ...segmentStyle,
        segmentArrowMarks: [{
          enabled: true,
          mode: "mid",
          direction: "->",
          tip: "Stealth",
          distribution: "multi",
          startPos: 0.45,
          endPos: 0.55,
          step: 0.05,
        }],
      },
    },
  ],
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
if (plain.includes("gdMultiArrow") || plain.includes("\\coordinate (C)") || plain.includes("\\coordinate (D)")) {
  throw new Error("A wholly clipped-out Exact-mode segment must not emit points, paths, or unused style definitions.");
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
if (tkz.includes("(C,D)") || tkz.includes("gdMultiArrow")) {
  throw new Error("Reconstructible export must also omit the wholly clipped-out segment draw and its unused arrow style.");
}

// A visible circle may use an invisible constrained point as its radius
// anchor. Visual Exact draws the already-evaluated radius and must not fail or
// emit that hidden dependency as an orphan coordinate. Geometric Construction
// still resolves it because the symbolic circle needs the named point.
const hiddenRadiusPointScene: SceneModel = {
  points: [
    {
      id: "o",
      kind: "free",
      name: "O",
      captionTex: "O",
      visible: true,
      showLabel: "none",
      position: { x: 0, y: 1 },
      style: pointStyle,
    },
    {
      id: "b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: false,
      showLabel: "none",
      position: { x: -2, y: 0 },
      style: pointStyle,
    },
    {
      id: "c",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: false,
      showLabel: "none",
      position: { x: 2, y: 0 },
      style: pointStyle,
    },
    {
      id: "s",
      kind: "pointByProjection",
      name: "S",
      captionTex: "S",
      visible: false,
      showLabel: "none",
      pointId: "o",
      axisAId: "b",
      axisBId: "c",
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [{
    id: "hidden-radius-circle",
    kind: "twoPoint",
    centerId: "o",
    throughId: "s",
    visible: true,
    style: {
      strokeColor: "#111111",
      strokeWidth: 1,
      strokeDash: "solid",
      strokeOpacity: 1,
    },
  }],
  polygons: [],
  angles: [],
};

const hiddenRadiusPlain = exportTikzWithOptions(hiddenRadiusPointScene, {
  viewport: { xmin: -3, xmax: 3, ymin: -2, ymax: 3 },
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: false,
});
if (!hiddenRadiusPlain.includes("(O) circle [radius=1]")) {
  throw new Error("Visual Exact should draw a circle with a hidden radius anchor from its evaluated numeric radius.");
}
if (hiddenRadiusPlain.includes("\\coordinate (S)")) {
  throw new Error("Visual Exact should not emit an invisible radius anchor that its numeric circle does not use.");
}

const hiddenRadiusTkz = exportTikzWithOptions(hiddenRadiusPointScene, {
  viewport: { xmin: -3, xmax: 3, ymin: -2, ymax: 3 },
  drawLayerBackend: "tkz",
  emitTkzSetup: true,
});
if (!hiddenRadiusTkz.includes("\\tkzDefPointBy[projection=onto B--C](O) \\tkzGetPoint{S}")) {
  throw new Error("Geometric Construction should resolve the hidden projection used by a symbolic circle.");
}
if (!hiddenRadiusTkz.includes("\\tkzDrawCircle") || !hiddenRadiusTkz.includes("(O,S)")) {
  throw new Error("Geometric Construction should draw the symbolic circle through its resolved hidden projection.");
}
const pictureScale = Number(hiddenRadiusTkz.match(/\\begin\{tikzpicture\}\[scale=([-+\d.eE]+)/u)?.[1]);
const constructionScale = Number(hiddenRadiusTkz.match(/\\begin\{scope\}\[scale=([-+\d.eE]+)\]/u)?.[1]);
if (
  !Number.isFinite(pictureScale) ||
  !Number.isFinite(constructionScale) ||
  Math.abs(pictureScale * constructionScale - 1) > 1e-10
) {
  throw new Error(
    "Geometric Construction should neutralize the picture scale while tkz computes constrained points."
  );
}

// "Exact coordinates" must remain exact even when the optional short-number
// formatting is enabled. This tiny radius is representative of a heavily
// zoomed canvas: rounding it to 0.03 visibly destroys tangency.
const tinyCenter = { x: 3.769108368509969, y: 2.9402097696156897 };
const tinyRadius = 0.026465943644519076;
const tinyExactScene: SceneModel = {
  points: [
    {
      id: "tiny-center",
      kind: "free",
      name: "I",
      captionTex: "I",
      visible: true,
      showLabel: "none",
      position: tinyCenter,
      style: pointStyle,
    },
    {
      id: "tiny-through",
      kind: "free",
      name: "S",
      captionTex: "S",
      visible: false,
      showLabel: "none",
      position: { x: tinyCenter.x + tinyRadius, y: tinyCenter.y },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [{
    id: "tiny-circle",
    kind: "twoPoint",
    centerId: "tiny-center",
    throughId: "tiny-through",
    visible: true,
    showLabel: false,
    style: hiddenRadiusPointScene.circles[0].style,
  }],
  polygons: [],
  angles: [],
};
const tinyExact = exportTikzWithOptions(tinyExactScene, {
  viewport: { xmin: 3.5, xmax: 4, ymin: 2.7, ymax: 3.2 },
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: false,
  roundNumbersToTwoDecimals: true,
});
if (!tinyExact.includes("\\coordinate (I) at (3.76910836850997,2.94020976961569);")) {
  throw new Error("Exact Coordinates must not round a tiny drawing's defining point geometry.");
}
const tinyRadiusLiteral = Number(tinyExact.match(/circle \[radius=([-+\d.eE]+)\]/u)?.[1]);
if (!Number.isFinite(tinyRadiusLiteral) || Math.abs(tinyRadiusLiteral - tinyRadius) > 1e-14) {
  throw new Error(`Exact Coordinates must not round a tiny circle radius and destroy tangency.\n\n${tinyExact}`);
}

// A common line-circle root is an existing identity, never an output slot.
// At the scale below tkz-euclide's `common=B` tolerance used to flip and the
// generated \tkzGetPoints{D}{B} command overwrote B with D.
const stableCommonIntersectionCommands: TikzCommand[] = [
  { kind: "SetupUnits", scale: 41.8652019184994 },
  {
    kind: "DefPoints",
    items: [
      { name: "A", x: 3.7354221274846675, y: 2.9120387674981845 },
      { name: "B", x: 3.7553194366943794, y: 2.998001526477786 },
      { name: "C", x: 3.8234721182503106, y: 2.916410287995333 },
    ],
  },
  { kind: "DefTriangleCenterPoint", name: "I", centerKind: "incenter", a: "A", b: "B", c: "C" },
  { kind: "DefCircleCircumCenter", centerName: "O", a: "B", b: "C", c: "A" },
  {
    kind: "InterLC",
    name: "D",
    lineA: "B",
    lineB: "I",
    circleO: "O",
    circleX: "B",
    branch: 1,
    common: "B",
  },
];
const stableCommonIntersection = renderTikz(stableCommonIntersectionCommands, {
  drawLayerBackend: "tkz",
  emitTkzSetup: true,
});
if (!stableCommonIntersection.includes(
  "\\tkzInterLC[near](B,I)(O,B) \\tkzGetPoints{tkzInterLC_1_other}{D}"
)) {
  throw new Error("Known line-circle roots must use anchored near/far selection for stable scale-independent identity.");
}
if (/\\tkzGetPoints\{[^}]*\}\{B\}/u.test(stableCommonIntersection)) {
  throw new Error("Intersection export must never redefine an existing common point B.");
}

console.log("✓ export viewport-clip plain backend test passed");
