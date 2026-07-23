import { hitTestTopObject } from "../../engine";
import { camera as camMath, type Camera, type Viewport } from "../../view/camera";
import type { SceneModel } from "../points";
import { defaultLineStyle, defaultPointStyle, defaultSegmentStyle } from "../../state/slices/sceneSlice";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const scene: SceneModel = {
  points: [
    {
      id: "a",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 4, y: 0 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
  ],
  vectors: [],
  numbers: [],
  lines: [
    { id: "line", aId: "a", bId: "b", visible: true, style: { ...defaultLineStyle } },
  ],
  segments: [
    { id: "seg-low", aId: "a", bId: "b", visible: true, showLabel: false, style: { ...defaultSegmentStyle } },
    { id: "seg-high", aId: "a", bId: "b", visible: true, showLabel: false, style: { ...defaultSegmentStyle, strokeWidth: defaultSegmentStyle.strokeWidth + 0.3 } },
  ],
  circles: [],
  polygons: [],
  angles: [],
  geometryLayerOrder: [
    { type: "segment", id: "seg-high" },
    { type: "line", id: "line" },
    { type: "segment", id: "seg-low" },
  ],
};

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 1000, heightPx: 700 };
const click = camMath.worldToScreen({ x: 2, y: 0 }, camera, vp);

const hit = hitTestTopObject(scene, camera, vp, click, {
  pointTolPx: 10,
  angleTolPx: 20,
  segmentTolPx: 8,
  lineTolPx: 8,
  circleTolPx: 8,
});

assert(hit?.type === "segment" && hit.id === "seg-high", "topmost segment should win within the same type");

const crossTypeScene: SceneModel = {
  ...scene,
  geometryLayerOrder: [
    { type: "line", id: "line" },
    { type: "segment", id: "seg-high" },
    { type: "segment", id: "seg-low" },
  ],
};

const crossTypeHit = hitTestTopObject(crossTypeScene, camera, vp, click, {
  pointTolPx: 10,
  angleTolPx: 20,
  segmentTolPx: 8,
  lineTolPx: 8,
  circleTolPx: 8,
});

assert(crossTypeHit?.type === "segment", "cross-type hit priority should still prefer segment over line");

console.log("geometry-layer-hit-priority: ok");
