import { type SceneModel } from "../points";
import { applyProfileColorsToDefaults, recolorSceneForProfile } from "../../state/colorProfiles";
import {
  defaultAngleStyle,
  defaultCircleStyle,
  defaultLabelToolStyle,
  defaultLineStyle,
  defaultPointStyle,
  defaultPolygonStyle,
  defaultSegmentStyle,
  defaultTextboxToolStyle,
} from "../../state/slices/sceneSlice";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const defaults = applyProfileColorsToDefaults(
  {
    pointDefaults: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    segmentDefaults: { ...defaultSegmentStyle },
    lineDefaults: { ...defaultLineStyle },
    circleDefaults: { ...defaultCircleStyle },
    polygonDefaults: { ...defaultPolygonStyle },
    angleDefaults: { ...defaultAngleStyle, labelPosWorld: { ...defaultAngleStyle.labelPosWorld } },
    labelToolDefaults: { ...defaultLabelToolStyle },
    textboxToolDefaults: { ...defaultTextboxToolStyle },
  },
  "grayscale_white_dot"
);

assert(defaults.pointDefaults.strokeColor === "#000000", "profile should update default point stroke color");
assert(defaults.pointDefaults.fillColor === "#ffffff", "profile should update default point fill color");
assert(defaults.segmentDefaults.strokeColor === "#000000", "profile should update default segment stroke color");
assert(defaults.segmentDefaults.strokeWidth === defaultSegmentStyle.strokeWidth, "profile should preserve default segment stroke width");
assert(defaults.angleDefaults.fillColor === "#bfbfbf", "profile should update default angle fill color");
assert(defaults.angleDefaults.strokeWidth === defaultAngleStyle.strokeWidth, "profile should preserve default angle stroke width");
assert(defaults.textboxToolDefaults.boxWidthPx === 220, "profile should preserve default textbox width");

const scene: SceneModel = {
  points: [
    {
      id: "p1",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: {
        ...defaultPointStyle,
        labelOffsetPx: { ...defaultPointStyle.labelOffsetPx },
      },
    },
  ],
  vectors: [],
  segments: [
    {
      id: "s1",
      aId: "p1",
      bId: "p1",
      visible: true,
      showLabel: false,
      style: {
        ...defaultSegmentStyle,
        strokeColor: "#123456",
      },
    },
  ],
  lines: [
    {
      id: "l1",
      kind: "twoPoint",
      aId: "p1",
      bId: "p1",
      visible: true,
      style: { ...defaultLineStyle },
    },
  ],
  circles: [
    {
      id: "c1",
      kind: "twoPoint",
      centerId: "p1",
      throughId: "p1",
      visible: true,
      style: {
        ...defaultCircleStyle,
        fillColor: defaultPolygonStyle.fillColor,
      },
    },
  ],
  polygons: [
    {
      id: "pg1",
      pointIds: ["p1", "p1", "p1"],
      visible: true,
      style: { ...defaultPolygonStyle },
    },
  ],
  angles: [
    {
      id: "a1",
      kind: "angle",
      aId: "p1",
      bId: "p1",
      cId: "p1",
      visible: true,
      style: {
        ...defaultAngleStyle,
        labelPosWorld: { ...defaultAngleStyle.labelPosWorld },
      },
    },
  ],
  numbers: [],
};

const recolored = recolorSceneForProfile(scene, "classic", "grayscale_white_dot");

assert(recolored.points[0].style.fillColor === "#ffffff", "point fill should be recolored");
assert(recolored.points[0].style.labelColor === "#000000", "point label color should be recolored");
assert(recolored.lines[0].style.strokeColor === "#000000", "line color should be recolored");
assert(recolored.polygons[0].style.fillColor === "#bfbfbf", "polygon fill should be recolored");
assert(recolored.angles[0].style.markColor === "#000000", "angle mark should be recolored");
assert(recolored.segments[0].style.strokeColor === "#123456", "custom segment color should remain unchanged");

console.log("color-profile-regression tests: OK");
