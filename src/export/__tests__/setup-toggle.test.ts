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
if (withSetupDefault.includes("\\tkzClip[space=")) {
  throw new Error("Automatic complete-scene fitting must not emit \\tkzClip.");
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
if (withSetupExplicit.includes("\\tkzClip[space=")) {
  throw new Error("Enabling tkz setup alone must not turn automatic fitting into a crop.");
}

const reconstructibleViewport = exportTikzWithOptions(scene, {
  emitTkzSetup: true,
  viewport: { xmin: -5, xmax: 7, ymin: -3, ymax: 4 },
});
if (!reconstructibleViewport.includes("\\tkzClip[space=")) {
  throw new Error("An explicit canvas viewport must retain reconstructible \\tkzClip output.");
}

const plainAuto = exportTikzWithOptions(scene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: true,
});
if (plainAuto.includes("\\clip ") || plainAuto.includes("use as bounding box")) {
  throw new Error("Automatic complete-scene fitting must not emit a hard clip or bounding box.");
}

const sceneWithHiddenRemotePoint: SceneModel = {
  ...scene,
  points: [
    ...scene.points,
    {
      id: "hidden-remote",
      kind: "free",
      name: "Hidden",
      captionTex: "Hidden",
      visible: false,
      showLabel: "none",
      position: { x: 10000, y: -10000 },
      style: pointStyle,
    },
  ],
};
const plainAutoWithHiddenRemotePoint = exportTikzWithOptions(sceneWithHiddenRemotePoint, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  emitTkzSetup: true,
});
const readPictureScale = (source: string): string | undefined =>
  source.match(/\\begin\{tikzpicture\}\[scale=([^,\]]+)/u)?.[1];
if (readPictureScale(plainAutoWithHiddenRemotePoint) !== readPictureScale(plainAuto)) {
  throw new Error("Hidden orphan construction points must not change automatic figure fitting.");
}

const plainViewport = exportTikzWithOptions(scene, {
  drawLayerBackend: "plain",
  bakePointCoordinates: true,
  // Plain rendering must remain tkz-free even if a caller leaves this legacy
  // setup option enabled.
  emitTkzSetup: true,
  viewport: { xmin: -5, xmax: 7, ymin: -3, ymax: 4 },
  clipSpace: 0,
});
if (!plainViewport.includes("\\path[use as bounding box] (-5,-3) rectangle (7,4);")) {
  throw new Error("Expected plain export to set an explicit bounding box from SetupViewport.");
}
if (!plainViewport.includes("\\clip (-5,-3) rectangle (7,4);")) {
  throw new Error("Expected plain export to clip drawing to SetupViewport.");
}
if (
  !plainViewport.includes(">=triangle 45") ||
  !/\\usetikzlibrary\{[^}]*\barrows\b[^}]*\}/u.test(plainViewport)
) {
  throw new Error("Expected plain export to retain triangle 45 and load its arrows library.");
}
if (
  plainViewport.includes("\\tkzInit[") ||
  plainViewport.includes("\\tkzClip[") ||
  plainViewport.includes("\\tkzSetUpLine[")
) {
  throw new Error("Expected plain viewport setup to avoid tkz-euclide setup macros.");
}

console.log("✓ export setup-toggle test passed");
