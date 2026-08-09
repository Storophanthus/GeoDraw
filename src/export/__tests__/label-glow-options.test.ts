import { exportTikzWithOptions, renderTikz } from "../tikz.ts";
import type { AngleStyle, PointStyle, SceneModel } from "../../scene/points.ts";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const angleStyle: AngleStyle = {
  strokeColor: "#0f172a",
  strokeWidth: 1,
  strokeDash: "solid",
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 16,
  fillEnabled: false,
  fillColor: "#f5f1e6",
  fillOpacity: 0.2,
  pattern: "",
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 7.4,
  markColor: "#0f172a",
  arcRadius: 1.5,
  labelText: "Ang",
  labelPosWorld: { x: 0.8, y: 0.4 },
  showLabel: true,
  showValue: false,
  labelGlow: true,
  promoteToSolid: false,
};

function makeBaseScene(): SceneModel {
  return {
    points: [
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "none",
        position: { x: 0, y: 0 },
        style: pointStyle,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "none",
        position: { x: 2, y: 0 },
        style: pointStyle,
      },
      {
        id: "pC",
        kind: "free",
        name: "C",
        captionTex: "C",
        visible: true,
        showLabel: "none",
        position: { x: 0, y: 2 },
        style: pointStyle,
      },
    ],
    segments: [],
    lines: [],
    circles: [],
    polygons: [],
    angles: [],
    numbers: [],
    textLabels: [],
    richTextNodes: [],
  };
}

const noGlowScene = makeBaseScene();
noGlowScene.lines = [
  {
    id: "l1",
    aId: "pA",
    bId: "pB",
    visible: true,
    showLabel: true,
    labelText: "NoGlow",
    labelPosWorld: { x: 1, y: -0.2 },
    labelGlow: false,
    style: { strokeColor: "#0f172a", strokeWidth: 1.5, dash: "solid", opacity: 1 },
  },
];

const noGlowTikz = exportTikzWithOptions(noGlowScene, {});
if (noGlowTikz.includes("\\gdLabelGlow{$NoGlow$}")) {
  throw new Error("Expected object labelGlow=false to export without glow wrapper.");
}
if (!noGlowTikz.includes("{$NoGlow$}")) {
  throw new Error("Expected object labelGlow=false label to remain exported.");
}

const glowScene = makeBaseScene();
glowScene.lines = [
  {
    id: "l1",
    aId: "pA",
    bId: "pB",
    visible: true,
    showLabel: true,
    labelText: "Obj",
    labelPosWorld: { x: 1, y: -0.2 },
    labelGlow: true,
    style: { strokeColor: "#0f172a", strokeWidth: 1.5, dash: "solid", opacity: 1 },
  },
];
glowScene.angles = [
  {
    id: "a1",
    aId: "pB",
    bId: "pA",
    cId: "pC",
    visible: true,
    style: angleStyle,
  },
];
glowScene.textLabels = [
  {
    id: "t1",
    name: "T1",
    text: "T",
    visible: true,
    positionWorld: { x: 0.5, y: 1 },
    style: { textColor: "#0f172a", textSize: 12, useTex: true, textMode: "tex", textAlign: "center", labelGlow: true },
  },
  {
    id: "t2",
    name: "T2",
    text: "Plain",
    visible: true,
    positionWorld: { x: 0.5, y: 1.4 },
    style: { textColor: "#0f172a", textSize: 12, useTex: false, textMode: "plain", textAlign: "center", labelGlow: true },
  },
];
glowScene.richTextNodes = [
  {
    id: "r1",
    type: "richText",
    name: "R1",
    visible: true,
    positionWorld: { x: 0.5, y: 1.8 },
    document: {
      kind: "document",
      blocks: [{ kind: "paragraph", children: [{ kind: "text", text: "Rich" }] }],
    },
    style: { textColor: "#0f172a", textSize: 12, textAlign: "left", labelGlow: true },
  },
];

const glowTikz = exportTikzWithOptions(glowScene, {});
for (const expected of [
  "\\gdLabelGlow{$Obj$}",
  "\\gdLabelGlow{$Ang$}",
  "\\gdLabelGlow{$T$}",
  "\\gdLabelGlow{Plain}",
  "\\gdLabelGlow{Rich}",
]) {
  if (!glowTikz.includes(expected)) {
    throw new Error(`Expected glow export to include ${expected}`);
  }
}

const globallyDisabledTikz = exportTikzWithOptions(glowScene, { labelGlow: false });
if (globallyDisabledTikz.includes("\\gdLabelGlow")) {
  throw new Error("Expected global labelGlow=false to suppress all glow wrappers.");
}

const pointGlowScene = makeBaseScene();
pointGlowScene.points[0].showLabel = "name";
const pointGlowPlainTikz = exportTikzWithOptions(pointGlowScene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  viewport: { xmin: -1, xmax: 3, ymin: -1, ymax: 3 },
  screenPxPerWorld: 80,
});
if (!pointGlowPlainTikz.includes("\\newcommand{\\gdLabelGlow}[3]")) {
  throw new Error("Expected a Visual Exact point label to emit the reusable glow helper.");
}
if (!pointGlowPlainTikz.includes("\\gdLabelGlow{")) {
  throw new Error("Expected a Visual Exact point label to call the reusable glow helper.");
}
if (!/\\gdLabelGlow\{[^{}]+pt\}\{\\thepagecolor\}\{\$A\$\}/u.test(pointGlowPlainTikz)) {
  throw new Error("Expected a Visual Exact point label glow to defer to \\thepagecolor.");
}
if (/\\gdLabelGlow\{[^{}]+pt\}\{c\d+\}\{\$A\$\}/u.test(pointGlowPlainTikz)) {
  throw new Error("Expected a Visual Exact point label glow not to bake a generated halo color.");
}

const repeatedPointLabelsScene = makeBaseScene();
repeatedPointLabelsScene.points = repeatedPointLabelsScene.points.map((point) => ({
  ...point,
  showLabel: "name" as const,
}));
const repeatedPointLabelsTikz = exportTikzWithOptions(repeatedPointLabelsScene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  viewport: { xmin: -1, xmax: 3, ymin: -1, ymax: 3 },
  screenPxPerWorld: 80,
});
if (!repeatedPointLabelsTikz.includes("gdLabel/.style={")) {
  throw new Error("Expected repeated Visual Exact node options to use one editable gdLabel style.");
}
if (!repeatedPointLabelsTikz.includes("\\newcommand{\\gdLabelText}[1]")) {
  throw new Error("Expected repeated Visual Exact halo settings to use one editable gdLabelText preset.");
}
for (const pointName of ["A", "B", "C"]) {
  if (!repeatedPointLabelsTikz.includes(`{\\gdLabelText{$${pointName}$}}`)) {
    throw new Error(`Expected point ${pointName} to use the compact shared label text preset.`);
  }
}
if (repeatedPointLabelsTikz.includes("\\node[anchor=west, inner sep=0pt")) {
  throw new Error("Expected repeated point-label node options not to remain expanded inline.");
}
await compileTikzSnippet("visual-exact-shared-label-style", repeatedPointLabelsTikz);

const reconstructibleRepeatedPointLabelsScene = makeBaseScene();
reconstructibleRepeatedPointLabelsScene.points = reconstructibleRepeatedPointLabelsScene.points.map(
  (point, index) => ({
    ...point,
    showLabel: "name" as const,
    style: {
      ...point.style,
      labelOffsetPx:
        index === 0
          ? { x: 8, y: -8 }
          : index === 1
            ? { x: -10, y: -6 }
            : { x: 6, y: 9 },
    },
  })
);
const reconstructibleRepeatedPointLabelsTikz = exportTikzWithOptions(
  reconstructibleRepeatedPointLabelsScene,
  {
    drawLayerBackend: "tkz",
    bakePointCoordinates: false,
    viewport: { xmin: -1, xmax: 3, ymin: -1, ymax: 3 },
    screenPxPerWorld: 80,
  }
);
if (!reconstructibleRepeatedPointLabelsTikz.includes("gdLabel/.style={")) {
  throw new Error("Expected repeated Geometric Construction node options to use one editable gdLabel style.");
}
if ((reconstructibleRepeatedPointLabelsTikz.match(/\\fontsize\{/gu) ?? []).length !== 1) {
  throw new Error("Expected the shared Geometric Construction point font size to be defined only once.");
}
if (!reconstructibleRepeatedPointLabelsTikz.includes("\\node[gdLabel, anchor=base west,")) {
  throw new Error("Expected Geometric Construction labels to retain their individual named-point offsets.");
}
if (reconstructibleRepeatedPointLabelsTikz.includes("\\newcommand{\\gdLabelText}")) {
  throw new Error("Geometric Construction must retain its one-argument gdLabelGlow helper without a plain-backend wrapper.");
}
await compileTikzSnippet(
  "geometric-construction-shared-label-style",
  reconstructibleRepeatedPointLabelsTikz
);

const mixedAnchorLabelsTikz = renderTikz(
  [
    { kind: "SetupUnits", scale: 1 },
    {
      kind: "LabelAt",
      x: 0,
      y: 0,
      text: "A",
      options: "anchor=west, inner sep=0pt, text=black",
    },
    {
      kind: "LabelAt",
      x: 1,
      y: 1,
      text: "B",
      options: "anchor=north west, inner sep=0pt, text=black",
    },
  ],
  { drawLayerBackend: "plain", emitTkzSetup: false }
);
if (/gdLabel\/\.style=\{[^}]*anchor=/u.test(mixedAnchorLabelsTikz)) {
  throw new Error("Expected mixed label anchors to remain per-node placement overrides.");
}
if (!mixedAnchorLabelsTikz.includes("\\node[gdLabel, anchor=west]")) {
  throw new Error("Expected west anchor to remain on its compact node.");
}
if (!mixedAnchorLabelsTikz.includes("\\node[gdLabel, anchor=north west]")) {
  throw new Error("Expected north-west anchor to remain on its compact node.");
}

const doubledPointGlowTikz = exportTikzWithOptions(pointGlowScene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  viewport: { xmin: -1, xmax: 3, ymin: -1, ymax: 3 },
  screenPxPerWorld: 80,
  labelHaloScale: 2,
});
const baseGlowWidth = Number(
  pointGlowPlainTikz.match(/\\gdLabelGlow\{([^{}]+)pt\}\{\\thepagecolor\}\{\$A\$\}/u)?.[1]
);
const doubledGlowWidth = Number(
  doubledPointGlowTikz.match(/\\gdLabelGlow\{([^{}]+)pt\}\{\\thepagecolor\}\{\$A\$\}/u)?.[1]
);
if (!Number.isFinite(baseGlowWidth) || Math.abs(doubledGlowWidth - baseGlowWidth * 2) > 1e-9) {
  throw new Error("Expected labelHaloScale to multiply the exported contour spread.");
}

const multilineGlowScene = makeBaseScene();
multilineGlowScene.textLabels = [
  {
    id: "multiline",
    name: "Multiline",
    text: "First line\nSecond line",
    visible: true,
    positionWorld: { x: 1, y: 1 },
    style: {
      textColor: "#0f172a",
      textSize: 14,
      useTex: false,
      textMode: "plain",
      textAlign: "center",
      labelGlow: true,
    },
  },
];
const multilinePlainTikz = exportTikzWithOptions(multilineGlowScene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  viewport: { xmin: -1, xmax: 3, ymin: -1, ymax: 3 },
  screenPxPerWorld: 80,
  labelHaloColor: "#fffaf0",
});
const multilineGlowCalls = multilinePlainTikz.match(/\\gdLabelGlow\{/gu) ?? [];
if (multilineGlowCalls.length !== 2) {
  throw new Error("Expected each Visual Exact text line to call the reusable glow helper once.");
}
await compileTikzSnippet("visual-exact-multiline-glow", multilinePlainTikz);

console.log("✓ label glow options export test passed");
