import { hitTestTopObject } from "../../engine";
import { camera as camMath, type Camera, type Viewport } from "../../view/camera";
import type { SceneModel } from "../points";
import { defaultAngleStyle, defaultPointStyle } from "../../state/slices/sceneSlice";

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
    {
      id: "c",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 4 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
  ],
  vectors: [],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [
    {
      id: "sec",
      kind: "sector",
      aId: "b",
      bId: "a",
      cId: "c",
      visible: true,
      style: {
        ...defaultAngleStyle,
        labelPosWorld: { ...defaultAngleStyle.labelPosWorld },
        markStyle: "none",
      },
    },
    {
      id: "ang",
      kind: "angle",
      aId: "b",
      bId: "a",
      cId: "c",
      visible: true,
      style: {
        ...defaultAngleStyle,
        labelPosWorld: { ...defaultAngleStyle.labelPosWorld },
        markStyle: "arc",
      },
    },
  ],
};

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 1000, heightPx: 700 };

// Pick a point near the non-sector angle arc (small radius around A), still inside the sector.
const click = camMath.worldToScreen({ x: 0.26, y: 0.26 }, camera, vp);
const hit = hitTestTopObject(scene, camera, vp, click, {
  pointTolPx: 10,
  angleTolPx: 20,
  segmentTolPx: 8,
  lineTolPx: 8,
  circleTolPx: 8,
});

assert(hit?.type === "angle" && hit.id === "ang", "Non-sector angle should win selection over overlapping sector.");

console.log("angle-sector-hit-priority: ok");
