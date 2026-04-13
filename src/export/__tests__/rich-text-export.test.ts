import { exportTikz } from "../tikz.ts";
import type { SceneModel } from "../../scene/points.ts";
import { parseRichTextSourceToDocument } from "../../richtext/document.ts";

const scene: SceneModel = {
  points: [],
  vectors: [],
  segments: [],
  lines: [],
  circles: [],
  polygons: [],
  angles: [],
  numbers: [],
  textLabels: [],
  richTextNodes: [
    {
      id: "rt_1",
      type: "richText",
      name: "rt_1",
      visible: true,
      positionWorld: { x: 42, y: 11 },
      boundsPx: { widthPx: 400, heightPx: 80 },
      document: parseRichTextSourceToDocument("A number $a$ is algebraic\n\\[{a}^{2}+1=0\\]"),
      style: {
        textColor: "#000000",
        textSize: 12,
        textAlign: "left",
        rotationDeg: 0,
      },
    },
  ],
};

const tikz = exportTikz(scene);

if (!tikz.includes("\\node[anchor=north west")) {
  throw new Error("Expected rich text to export as a positioned node.");
}
if (!tikz.includes("A number $a$ is algebraic")) {
  throw new Error("Expected rich text paragraph and inline math in export.");
}
if (!tikz.includes("$\\displaystyle {a}^{2}+1=0$")) {
  throw new Error("Expected rich text display math in export.");
}

const initMatch = /\\tkzInit\[xmin=([-0-9.]+),xmax=([-0-9.]+),ymin=([-0-9.]+),ymax=([-0-9.]+)\]/u.exec(tikz);
if (!initMatch) {
  throw new Error("Expected export viewport initialization.");
}
const [, xminRaw, xmaxRaw, yminRaw, ymaxRaw] = initMatch;
const xmin = Number(xminRaw);
const xmax = Number(xmaxRaw);
const ymin = Number(yminRaw);
const ymax = Number(ymaxRaw);
if (!(xmin < 42 && xmax > 47 && ymin < 10 && ymax > 11)) {
  throw new Error(`Expected rich text bounds to contribute to export viewport, got ${initMatch[0]}`);
}

console.log("✓ rich-text export test passed");
