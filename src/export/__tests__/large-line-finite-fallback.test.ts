import { exportTikz } from "../tikz.ts";
import type { SceneModel } from "../../scene/points.ts";

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#111111",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 12,
  labelHaloWidthPx: 0,
  labelHaloColor: "#ffffff",
  labelColor: "#111111",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle = {
  strokeColor: "#000000",
  strokeWidth: 1.6,
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
      position: { x: 0, y: 0 },
      style: pointStyle,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 200, y: 0 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [
    {
      id: "lAB",
      kind: "twoPoint",
      aId: "pA",
      bId: "pB",
      visible: true,
      showLabel: false,
      style: lineStyle,
    },
  ],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const tikz = exportTikz(scene);

if (tikz.includes("\\tkzDrawLine")) {
  throw new Error(`Expected large line export to avoid \\tkzDrawLine dimension overflow:\n${tikz}`);
}

if (!/\\draw\[[^\]]*line width=1\.2pt[^\]]*\] \(-/.test(tikz)) {
  throw new Error(`Expected large line export to use a finite raw TikZ segment:\n${tikz}`);
}

console.log("large-line-finite-fallback: ok");
