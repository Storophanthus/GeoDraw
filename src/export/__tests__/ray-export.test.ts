import type { SceneModel } from "../../scene/points.ts";
import { exportTikzWithOptions } from "../tikz.ts";

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#111111",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#111111",
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

const scene: SceneModel = {
  points: [
    { id: "O", kind: "free", name: "O", captionTex: "O", visible: false, showLabel: "none", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "A", kind: "free", name: "A", captionTex: "A", visible: false, showLabel: "none", position: { x: 1, y: 0 }, style: pointStyle },
  ],
  numbers: [],
  lines: [
    { id: "ray", kind: "ray", aId: "O", bId: "A", visible: true, showLabel: false, style: lineStyle },
  ],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const viewport = { xmin: -5, xmax: 5, ymin: -4, ymax: 4 };
for (const drawLayerBackend of ["plain", "tkz"] as const) {
  const tikz = exportTikzWithOptions(scene, {
    viewport,
    clipSpace: 0,
    globalLineAdd: 0,
    drawLayerBackend,
    bakePointCoordinates: drawLayerBackend === "plain",
    emitTkzSetup: false,
  });
  const rayDraw = tikz
    .split("\n")
    .find((line) => line.trimStart().startsWith("\\draw") && line.includes("--") && line.includes("(0,0)"));
  if (!rayDraw) throw new Error(`Expected ${drawLayerBackend} export to draw the ray from its origin.`);
  const endpointMatch = rayDraw.match(/-- \((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\);$/u);
  const endpointX = endpointMatch ? Number(endpointMatch[1]) : Number.NaN;
  const endpointY = endpointMatch ? Number(endpointMatch[2]) : Number.NaN;
  if (!Number.isFinite(endpointX) || endpointX < viewport.xmax || Math.abs(endpointY) > 1e-9) {
    throw new Error(`Expected ${drawLayerBackend} export to reach the forward viewport edge: ${rayDraw}`);
  }
  if (rayDraw.includes("(-5,0)")) {
    throw new Error(`Expected ${drawLayerBackend} export to omit the backward support line: ${rayDraw}`);
  }
  if (tikz.includes("\\tkzDrawLine")) {
    throw new Error(`Expected ${drawLayerBackend} ray export to use an explicit forward-only finite path.`);
  }
}

console.log("✓ ray export test passed");
