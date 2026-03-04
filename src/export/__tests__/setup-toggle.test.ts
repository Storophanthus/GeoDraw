import { exportTikz, exportTikzWithOptions } from "../tikz.ts";
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
  labelHaloWidthPx: 3,
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

const scene: SceneModel = {
  points: [
    {
      id: "pA",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: -2, y: 1 },
      style: pointStyle,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 3, y: 1 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [
    {
      id: "s1",
      aId: "pA",
      bId: "pB",
      visible: true,
      showLabel: false,
      style: segmentStyle,
    },
  ],
  circles: [],
  polygons: [],
  angles: [],
};

const withSetupDefault = exportTikz(scene);
if (!withSetupDefault.includes("\\tkzInit[")) {
  throw new Error("Expected default export to include \\tkzInit.");
}
if (!withSetupDefault.includes("\\tkzClip[space=")) {
  throw new Error("Expected default export to include \\tkzClip.");
}
if (!withSetupDefault.includes("\\tkzSetUpLine[")) {
  throw new Error("Expected default export to include \\tkzSetUpLine.");
}

const withoutSetup = exportTikzWithOptions(scene, { emitTkzSetup: false });
if (withoutSetup.includes("\\tkzInit[")) {
  throw new Error("Expected export with emitTkzSetup=false to omit \\tkzInit.");
}
if (withoutSetup.includes("\\tkzClip[space=")) {
  throw new Error("Expected export with emitTkzSetup=false to omit \\tkzClip.");
}
if (withoutSetup.includes("\\tkzSetUpLine[")) {
  throw new Error("Expected export with emitTkzSetup=false to omit \\tkzSetUpLine.");
}
if (!withoutSetup.includes("\\tkzDrawSegment")) {
  throw new Error("Expected geometry draw commands to remain when tkz setup is omitted.");
}

const withSetupExplicit = exportTikzWithOptions(scene, { emitTkzSetup: true });
if (!withSetupExplicit.includes("\\tkzInit[")) {
  throw new Error("Expected export with emitTkzSetup=true to include \\tkzInit.");
}

console.log("✓ export setup-toggle test passed");
