import { exportTikz } from "../tikz.ts";
import type { SceneModel } from "../../scene/points.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const segmentStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 2,
  dash: "solid" as const,
  opacity: 1,
};

const polygonStyle = {
  strokeColor: "#ef4444",
  strokeWidth: 4,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
  fillColor: "#93c5fd",
  fillOpacity: 0.22,
};

function createScene(edgeVisible: boolean): SceneModel {
  return {
    points: [
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        locked: false,
        auxiliary: false,
        position: { x: -2, y: 0 },
        style: pointStyle,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        locked: false,
        auxiliary: false,
        position: { x: 2, y: 0 },
        style: pointStyle,
      },
      {
        id: "pC",
        kind: "free",
        name: "C",
        captionTex: "C",
        visible: true,
        showLabel: "name",
        locked: false,
        auxiliary: false,
        position: { x: 0, y: 2 },
        style: pointStyle,
      },
    ],
    numbers: [],
    lines: [],
    segments: [
      {
        id: "sAB",
        aId: "pA",
        bId: "pB",
        ownedByPolygonIds: ["pg_1"],
        visible: edgeVisible,
        showLabel: false,
        style: segmentStyle,
      },
      {
        id: "sBC",
        aId: "pB",
        bId: "pC",
        ownedByPolygonIds: ["pg_1"],
        visible: edgeVisible,
        showLabel: false,
        style: segmentStyle,
      },
      {
        id: "sCA",
        aId: "pC",
        bId: "pA",
        ownedByPolygonIds: ["pg_1"],
        visible: edgeVisible,
        showLabel: false,
        style: segmentStyle,
      },
    ],
    circles: [],
    polygons: [{ id: "pg_1", pointIds: ["pA", "pB", "pC"], visible: true, style: polygonStyle }],
    angles: [],
  };
}

{
  const tikz = exportTikz(createScene(false));
  assert(tikz.includes("\\fill["), "Expected polygon fill to remain exported when owned segments are hidden.");
  assert(!tikz.includes("\\tkzDrawSegment"), "Expected no segment strokes when owned segments are hidden.");
  assert(!tikz.includes("\\draw["), "Expected polygon stroke to be suppressed when edge segments exist.");
}

{
  const tikz = exportTikz(createScene(true));
  const segmentDraws = tikz.match(/\\tkzDrawSegment/g) ?? [];
  assert(segmentDraws.length === 3, "Expected exactly three segment edges for triangle polygon export.");
  assert(!tikz.includes("\\draw["), "Expected polygon stroke to defer to owned segment drawing.");
}

console.log("polygon-owned-segment-visibility-export: ok");
