import { exportTikzEfficientWithOptions, exportTikzWithOptions } from "../tikz.ts";
import type { AngleStyle, PointStyle, SceneModel } from "../../scene/points.ts";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#111827",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#111827",
  labelOffsetPx: { x: 8, y: -8 },
};

const scene: SceneModel = {
  points: [
    {
      id: "a",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "none",
      position: { x: 0, y: 0 },
      style: pointStyle,
    },
    {
      id: "b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "none",
      position: { x: 3, y: 0 },
      style: pointStyle,
    },
    {
      id: "c",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "none",
      position: { x: 0, y: 2 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [
    {
      id: "ab",
      aId: "a",
      bId: "b",
      visible: true,
      showLabel: false,
      style: {
        strokeColor: "#404040",
        strokeWidth: 1.5,
        dash: "solid",
        opacity: 1,
        segmentArrowMarks: [
          {
            enabled: true,
            mode: "mid",
            direction: "->",
            tip: "Stealth",
            distribution: "multi",
            startPos: 0.45,
            endPos: 0.55,
            step: 0.05,
            sizeScale: 1,
            lineWidthPt: 1.2,
          },
        ],
      },
    },
  ],
  circles: [
    {
      id: "circle-a",
      kind: "twoPoint",
      centerId: "a",
      throughId: "b",
      visible: true,
      style: {
        strokeColor: "#404040",
        strokeWidth: 1.5,
        strokeDash: "solid",
        strokeOpacity: 1,
        fillOpacity: 0,
        arrowMarks: [
          {
            enabled: true,
            direction: "->",
            tip: "Stealth",
            distribution: "multi",
            startPos: 0.2,
            endPos: 0.3,
            step: 0.05,
            sizeScale: 1,
            lineWidthPt: 1.2,
          },
        ],
      },
    },
  ],
  polygons: [],
  angles: [
    {
      id: "sector-a",
      kind: "sector",
      aId: "b",
      bId: "a",
      cId: "c",
      visible: true,
      style: {
        strokeColor: "#404040",
        strokeWidth: 1.5,
        strokeDash: "solid",
        strokeOpacity: 1,
        textColor: "#404040",
        textSize: 14,
        fillEnabled: true,
        fillColor: "#f0e7d6",
        fillOpacity: 0.2,
        markStyle: "none",
        markSymbol: "none",
        arcMultiplicity: 1,
        markPos: 0.5,
        markSize: 1,
        markColor: "#404040",
        arcRadius: 1,
        labelText: "",
        labelPosWorld: { x: 1, y: 1 },
        showLabel: false,
        showValue: false,
        arcArrowMarks: [
          {
            enabled: true,
            direction: "->",
            tip: "Stealth",
            distribution: "multi",
            startPos: 0.45,
            endPos: 0.55,
            step: 0.05,
            sizeScale: 1,
            lineWidthPt: 1.2,
          },
        ],
      } satisfies AngleStyle,
    },
  ],
};

const tikz = exportTikzWithOptions(scene, {
  drawLayerBackend: "tkz",
  bakePointCoordinates: false,
  emitTkzSetup: true,
});

assert(
  tikz.includes("gdMultiArrow/.style={"),
  `Expected a named, editable multi-arrow style.\n\n${tikz}`
);
assert(
  tikz.includes("gdMultiArrow2/.style={") && !tikz.includes("gdMultiArrow3/.style={"),
  `Expected identical segment/sector definitions to share gdMultiArrow, with a second style only for the circle's different range.\n\n${tikz}`
);
assert(
  tikz.includes("mark=between positions 0.45 and 0.55 step 0.05 with {"),
  `Expected the multi-arrow range to remain human-readable.\n\n${tikz}`
);
assert(
  tikz.includes("\\arrow[color=" ) && tikz.includes("{#1}"),
  `Expected the shared style to accept a normal TikZ arrow tip.\n\n${tikz}`
);
assert(
  /\\path\[gdMultiArrow=\{Stealth\[length=[^\]]+width=[^\]]+\]\}\] \(A\) -- \(B\);/u.test(tikz),
  `Expected one compact multi-arrow application on named points A--B.\n\n${tikz}`
);
assert(
  /\\path\[gdMultiArrow2=\{Stealth\[[^\]]+\]\}\] \([^;]+\) arc\[start angle=0,end angle=-360,radius=3\];/u.test(tikz),
  `Expected one compact multi-arrow application on the full circle.\n\n${tikz}`
);
assert(
  /\\path\[gdMultiArrow=\{Stealth\[[^\]]+\]\}\] \(B\) arc\[start angle=0,end angle=90,radius=3\];/u.test(tikz),
  `Expected the sector arc to reuse the identical segment multi-arrow style.\n\n${tikz}`
);
assert(
  !tikz.includes("mark=at position"),
  `A regular multi-arrow range must not expand into repeated mark commands.\n\n${tikz}`
);

await compileTikzSnippet("multi-arrow-style", tikz);

const compactTikz = exportTikzEfficientWithOptions(scene, {
  drawLayerBackend: "tkz",
  bakePointCoordinates: false,
  emitTkzSetup: true,
  roundNumbersToTwoDecimals: true,
});
const compactPointDefinitionIndex = compactTikz.indexOf("\\tkzDefPoints{");
const compactArrowApplicationIndex = compactTikz.indexOf(
  "\\path[gdMultiArrow={"
);
assert(
  compactPointDefinitionIndex >= 0 &&
    compactArrowApplicationIndex > compactPointDefinitionIndex,
  `Compact Code may hoist the gdMultiArrow definition, but it must leave the path application after its named points are defined.\n\n${compactTikz}`
);
await compileTikzSnippet("multi-arrow-style-compact", compactTikz);

console.log("✓ human-readable multi-arrow style test passed");
