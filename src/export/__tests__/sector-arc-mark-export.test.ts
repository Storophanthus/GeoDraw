import { exportTikzWithOptions } from "../tikz.ts";
import type { AngleStyle, PointStyle, SceneModel } from "../../scene/points.ts";

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#000000",
  strokeWidth: 1.2,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#000000",
  labelOffsetPx: { x: 8, y: -8 },
};

const sectorStyle: AngleStyle = {
  strokeColor: "#111111",
  strokeWidth: 1.3,
  strokeDash: "solid",
  strokeOpacity: 1,
  textColor: "#111111",
  textSize: 14,
  fillEnabled: true,
  fillColor: "#f0e7d6",
  fillOpacity: 0.2,
  pattern: "",
  patternColor: "#f0e7d6",
  markStyle: "arc",
  markSymbol: "|",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 1.2,
  markColor: "#111111",
  angleMarks: [
    {
      enabled: true,
      arcMultiplicity: 1,
      markSymbol: "|",
      markPos: 0.3,
      markSize: 0.8,
      markColor: "#111111",
    },
    {
      enabled: true,
      arcMultiplicity: 1,
      markSymbol: "||",
      markPos: 0.5,
      markSize: 0.8,
      markColor: "#111111",
      distribution: "multi",
      startPos: 0.65,
      endPos: 0.85,
      step: 0.1,
    },
  ],
  arcRadius: 1,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: false,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    { id: "o", kind: "free", name: "O", captionTex: "O", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "a", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "name", position: { x: 3, y: 0 }, style: pointStyle },
    { id: "b", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "name", position: { x: 1, y: 2.6 }, style: pointStyle },
  ],
  vectors: [],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [{ id: "sec1", kind: "sector", aId: "a", bId: "o", cId: "b", visible: true, style: sectorStyle }],
};

const tikz = exportTikzWithOptions(scene, { emitTkzSetup: false });

if (!tikz.includes("\\tkzDrawSector")) {
  throw new Error("Expected sector stroke command in export.");
}
if (!tikz.includes("postaction=decorate") || !tikz.includes("decoration={markings")) {
  throw new Error("Expected sector arc mark decoration in export.");
}
if (!tikz.includes("mark=at position")) {
  throw new Error("Expected sector arc mark positions in export.");
}
if (!tikz.includes("pt) -- (") || !tikz.includes("pt,") || !tikz.includes("line cap=round")) {
  throw new Error("Expected sector mark strokes to be emitted in pt units.");
}

console.log("✓ sector arc mark export test passed");
