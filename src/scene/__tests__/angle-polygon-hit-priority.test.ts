import { hitTestTopObject } from "../../engine";
import type { Camera, Viewport } from "../../view/camera";
import { camera as camMath } from "../../view/camera";
import { decideMovePointerDown } from "../../view/pointerInteraction";
import type { SceneModel } from "../points";
import {
  defaultAngleStyle,
  defaultPointStyle,
  defaultPolygonStyle,
  defaultSegmentStyle,
} from "../../state/slices/sceneSlice";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const scene: SceneModel = {
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
      position: { x: -2, y: -2 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
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
      position: { x: 2, y: -2 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
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
      position: { x: 2, y: 2 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "pD",
      kind: "free",
      name: "D",
      captionTex: "D",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: -2, y: 2 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
  ],
  vectors: [],
  numbers: [],
  lines: [],
  circles: [],
  segments: [
    {
      id: "sAB",
      aId: "pA",
      bId: "pB",
      ownedByPolygonIds: ["poly1"],
      visible: true,
      showLabel: false,
      style: { ...defaultSegmentStyle },
    },
    {
      id: "sBC",
      aId: "pB",
      bId: "pC",
      ownedByPolygonIds: ["poly1"],
      visible: true,
      showLabel: false,
      style: { ...defaultSegmentStyle },
    },
    {
      id: "sCD",
      aId: "pC",
      bId: "pD",
      ownedByPolygonIds: ["poly1"],
      visible: true,
      showLabel: false,
      style: { ...defaultSegmentStyle },
    },
    {
      id: "sDA",
      aId: "pD",
      bId: "pA",
      ownedByPolygonIds: ["poly1"],
      visible: true,
      showLabel: false,
      style: { ...defaultSegmentStyle },
    },
  ],
  polygons: [
    {
      id: "poly1",
      pointIds: ["pA", "pB", "pC", "pD"],
      visible: true,
      style: { ...defaultPolygonStyle, fillOpacity: 0.35 },
    },
  ],
  angles: [
    {
      id: "aSector",
      kind: "sector",
      aId: "pD",
      bId: "pC",
      cId: "pB",
      visible: true,
      style: { ...defaultAngleStyle, labelPosWorld: { ...defaultAngleStyle.labelPosWorld } },
    },
  ],
};

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 900, heightPx: 700 };
const clickInsideSector = camMath.worldToScreen({ x: 1.2, y: 1.2 }, camera, vp);

const topHit = hitTestTopObject(scene, camera, vp, clickInsideSector, {
  pointTolPx: 12,
  angleTolPx: 20,
  segmentTolPx: 10,
  lineTolPx: 10,
  circleTolPx: 10,
});
assert(
  topHit?.type === "angle" && topHit.id === "aSector",
  "Angle inside filled polygon should be selectable over polygon fill."
);

const moveDecision = decideMovePointerDown({
  hitLabelId: null,
  hitAngleLabelId: null,
  hitPointId: null,
  hitSegmentId: null,
  hitPolygonId: "poly1",
  hitLineId: null,
  hitCircleId: null,
  hitAngleId: "aSector",
  scenePoints: scene.points,
});
assert(
  moveDecision.selectedObject?.type === "angle" && moveDecision.selectedObject.id === "aSector",
  "Move selection should prioritize angle over polygon when both are hit."
);

const sceneNoAngle: SceneModel = {
  ...scene,
  angles: [{ ...scene.angles[0], visible: false }],
};
const fallbackHit = hitTestTopObject(sceneNoAngle, camera, vp, clickInsideSector, {
  pointTolPx: 12,
  angleTolPx: 20,
  segmentTolPx: 10,
  lineTolPx: 10,
  circleTolPx: 10,
});
assert(
  fallbackHit?.type === "polygon" && fallbackHit.id === "poly1",
  "Polygon should still be selectable when no angle is hit."
);

console.log("angle-polygon-hit-priority: ok");
