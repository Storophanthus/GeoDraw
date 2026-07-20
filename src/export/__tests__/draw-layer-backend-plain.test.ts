import { exportTikzWithOptions } from "../tikz.ts";
import type { AngleStyle, SceneModel } from "../../scene/points.ts";

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
if (plain.includes("circle [through=")) {
  throw new Error("Expected plain backend to avoid invalid circle-through syntax.");
}
if (!plain.includes("circle [radius=")) {
  throw new Error("Expected plain backend to emit circle [radius=...] for non-fixed circles.");
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

const fixedRadiusScene: SceneModel = {
  points: [
    { id: "O", kind: "free", name: "O", captionTex: "O", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "P", kind: "free", name: "P", captionTex: "P", visible: true, showLabel: "name", position: { x: 3, y: 0 }, style: pointStyle },
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [{ id: "u", kind: "fixedRadius", centerId: "O", radius: 2.5, visible: true, style: circleStyle }],
  polygons: [],
  angles: [],
};

const fixedRadiusPlain = exportTikzWithOptions(fixedRadiusScene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: false,
});
if (fixedRadiusPlain.includes("\\tkzDefCircle") || fixedRadiusPlain.includes("\\tkzDrawCircle") || fixedRadiusPlain.includes("\\tkzFillCircle")) {
  throw new Error("Expected plain fixed-radius export to avoid tkz circle helpers.");
}
if (!fixedRadiusPlain.includes("\\draw") || !fixedRadiusPlain.includes("circle [radius=")) {
  throw new Error("Expected plain fixed-radius export to use direct \\draw circle radius syntax.");
}

const namedColorScene: SceneModel = {
  points: [
    { id: "pn1", kind: "free", name: "P", captionTex: "P", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "pn2", kind: "free", name: "Q", captionTex: "Q", visible: true, showLabel: "name", position: { x: 4, y: 0 }, style: pointStyle },
  ],
  numbers: [],
  lines: [],
  segments: [
    {
      id: "sn1",
      aId: "pn1",
      bId: "pn2",
      visible: true,
      showLabel: false,
      style: { strokeColor: "Goldenrod", strokeWidth: 1.2, dash: "solid", opacity: 1 },
    },
  ],
  circles: [],
  polygons: [],
  angles: [],
};

const namedColorPlain = exportTikzWithOptions(namedColorScene, {
  drawLayerBackend: "plain",
  emitTkzSetup: false,
  bakePointCoordinates: true,
});

if (!namedColorPlain.includes("Goldenrod")) {
  throw new Error("Expected export to keep Goldenrod color name in output for non-core named colors.");
}
if (!namedColorPlain.includes("\\definecolor{Goldenrod}{RGB}")) {
  throw new Error("Expected export to define non-core named colors like Goldenrod.");
}

const arrowScene: SceneModel = {
  points: [
    { id: "pa1", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "pb1", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "name", position: { x: 3, y: 0 }, style: pointStyle },
  ],
  numbers: [],
  lines: [],
  segments: [
    {
      id: "as1",
      aId: "pa1",
      bId: "pb1",
      visible: true,
      showLabel: false,
      style: {
        strokeColor: "#1f2937",
        strokeWidth: 1.2,
        dash: "solid",
        opacity: 1,
        segmentArrowMark: { enabled: true, direction: "->", mode: "end", tip: "Triangle" },
      },
    },
  ],
  circles: [],
  polygons: [],
  angles: [],
};

const arrowPlain = exportTikzWithOptions(arrowScene, {
  drawLayerBackend: "plain",
  emitTkzSetup: false,
  bakePointCoordinates: true,
});
if (!arrowPlain.includes("\\usetikzlibrary{") || !arrowPlain.includes("arrows")) {
  throw new Error("Expected plain backend to include arrows library when arrow marks require it.");
}

const plainSectorStyle: AngleStyle = {
  strokeColor: "#0f172a",
  strokeWidth: 1.2,
  strokeDash: "solid",
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 12,
  fillEnabled: true,
  fillColor: "#e2e8f0",
  fillOpacity: 0.2,
  pattern: "",
  patternColor: "#e2e8f0",
  markStyle: "arc",
  markSymbol: "|",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 1,
  markColor: "#0f172a",
  angleMarks: [],
  arcRadius: 1,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: false,
  showValue: false,
};

const sectorScene: SceneModel = {
  points: [
    { id: "psA", kind: "free", name: "A", captionTex: "A", visible: true, showLabel: "name", position: { x: 0, y: 0 }, style: pointStyle },
    { id: "psB", kind: "free", name: "B", captionTex: "B", visible: true, showLabel: "name", position: { x: 5, y: 0 }, style: pointStyle },
    { id: "psC", kind: "free", name: "C", captionTex: "C", visible: true, showLabel: "name", position: { x: 2.5, y: 3.4 }, style: pointStyle },
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [
    {
      id: "psAng",
      kind: "sector",
      aId: "psA",
      bId: "psB",
      cId: "psC",
      visible: true,
      style: plainSectorStyle,
    },
  ],
};

const plainSector = exportTikzWithOptions(sectorScene, {
  drawLayerBackend: "plain",
  emitTkzSetup: false,
  bakePointCoordinates: true,
});

if (plainSector.includes("\\tkzFillSector") || plainSector.includes("\\tkzDrawSector")) {
  throw new Error("Expected plain sector export to avoid tkz sector draw/fill macros.");
}

if (!plainSector.includes("\\fill[") || !plainSector.includes("arc[start angle=")) {
  throw new Error("Expected plain sector export to emit a fill arc path.");
}

if (!plainSector.includes("\\draw") || !plainSector.includes("--")) {
  throw new Error("Expected plain sector export to emit a sector stroke path.");
}

console.log("✓ export draw-layer plain backend test passed");
