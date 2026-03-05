import { hitTestAngleId, hitTestSegmentId, hitTestTopObject, resolveVisibleAngles } from "../../engine";
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

const clickOnSectorBoundary = camMath.worldToScreen({ x: 2, y: 0.8 }, camera, vp);
const boundaryTopHit = hitTestTopObject(scene, camera, vp, clickOnSectorBoundary, {
  pointTolPx: 12,
  angleTolPx: 20,
  segmentTolPx: 10,
  lineTolPx: 10,
  circleTolPx: 10,
});
assert(
  boundaryTopHit?.type === "segment" && boundaryTopHit.id === "sBC",
  "Sector boundary segment should win selection over overlapping sector fill."
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
  sceneSegments: scene.segments,
  sceneAngles: scene.angles,
  scenePoints: scene.points,
});
assert(
  moveDecision.selectedObject?.type === "angle" && moveDecision.selectedObject.id === "aSector",
  "Move selection should prioritize angle over polygon when both are hit."
);

const boundaryMoveDecision = decideMovePointerDown({
  hitLabelId: null,
  hitAngleLabelId: null,
  hitPointId: null,
  hitSegmentId: "sBC",
  hitPolygonId: null,
  hitLineId: null,
  hitCircleId: null,
  hitAngleId: "aSector",
  sceneSegments: scene.segments,
  sceneAngles: scene.angles,
  scenePoints: scene.points,
});
assert(
  boundaryMoveDecision.selectedObject?.type === "segment" && boundaryMoveDecision.selectedObject.id === "sBC",
  "Move selection should prioritize sector boundary segment over overlapping sector."
);

{
  // Regression: a segment crossing a sector interior (e.g. semicircle diameter/chord)
  // must remain selectable over the sector fill.
  const semiScene: SceneModel = {
    points: [
      {
        id: "pO",
        kind: "free",
        name: "O",
        captionTex: "O",
        visible: true,
        showLabel: "name",
        locked: false,
        auxiliary: false,
        position: { x: 0, y: 0 },
        style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
      },
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        locked: false,
        auxiliary: false,
        position: { x: -3, y: 0 },
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
        position: { x: 3, y: 0 },
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
        visible: true,
        showLabel: false,
        style: { ...defaultSegmentStyle },
      },
    ],
    polygons: [],
    angles: [
      {
        id: "sectorSemi",
        kind: "sector",
        aId: "pA",
        bId: "pO",
        cId: "pB",
        visible: true,
        style: { ...defaultAngleStyle, labelPosWorld: { ...defaultAngleStyle.labelPosWorld } },
      },
    ],
  };
  const clickOnDiameter = camMath.worldToScreen({ x: 0.2, y: 0.01 }, camera, vp);
  const semiTopHit = hitTestTopObject(semiScene, camera, vp, clickOnDiameter, {
    pointTolPx: 12,
    angleTolPx: 20,
    segmentTolPx: 10,
    lineTolPx: 10,
    circleTolPx: 10,
  });
  assert(
    semiTopHit?.type === "segment" && semiTopHit.id === "sAB",
    "Semicircle diameter/chord segment should be selectable over sector fill."
  );

  const semiMoveDecision = decideMovePointerDown({
    hitLabelId: null,
    hitAngleLabelId: null,
    hitPointId: null,
    hitSegmentId: "sAB",
    hitPolygonId: null,
    hitLineId: null,
    hitCircleId: null,
    hitAngleId: "sectorSemi",
    sceneSegments: semiScene.segments,
    sceneAngles: semiScene.angles,
    scenePoints: semiScene.points,
  });
  assert(
    semiMoveDecision.selectedObject?.type === "segment" && semiMoveDecision.selectedObject.id === "sAB",
    "Move selection should prioritize semicircle diameter/chord segment over sector."
  );
}

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

const polygonDragDecision = decideMovePointerDown({
  hitLabelId: null,
  hitAngleLabelId: null,
  hitPointId: null,
  hitSegmentId: null,
  hitPolygonId: "poly1",
  hitLineId: null,
  hitCircleId: null,
  hitAngleId: null,
  scenePoints: scene.points,
});
assert(
  polygonDragDecision.mode === "drag-polygon" && polygonDragDecision.selectedObject?.type === "polygon",
  "Polygon should enter drag mode when hit without an overlapping angle."
);

console.log("angle-polygon-hit-priority: ok");

const tinyAngleScene: SceneModel = {
  points: [
    {
      id: "p_1",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: -3, y: -2 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "p_2",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: -0.5, y: 4 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "p_3",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: -2, y: -2.5 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "p_4",
      kind: "free",
      name: "D",
      captionTex: "D",
      visible: true,
      showLabel: "name",
      position: { x: 6, y: -1.5 },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
  ],
  vectors: [],
  numbers: [],
  lines: [],
  segments: [
    { id: "s_1", aId: "p_1", bId: "p_2", visible: true, showLabel: false, style: { ...defaultSegmentStyle } },
    { id: "s_2", aId: "p_2", bId: "p_3", visible: true, showLabel: false, style: { ...defaultSegmentStyle } },
    { id: "s_3", aId: "p_3", bId: "p_4", visible: true, showLabel: false, style: { ...defaultSegmentStyle } },
  ],
  circles: [],
  polygons: [],
  angles: [
    { id: "a_1", kind: "angle", aId: "p_1", bId: "p_2", cId: "p_3", visible: true, style: { ...defaultAngleStyle, labelPosWorld: { ...defaultAngleStyle.labelPosWorld } } },
    { id: "a_2", kind: "angle", aId: "p_4", bId: "p_3", cId: "p_2", visible: true, style: { ...defaultAngleStyle, labelPosWorld: { ...defaultAngleStyle.labelPosWorld } } },
  ],
};

const tinyABCScreen = camMath.worldToScreen({ x: -0.5, y: 4 }, camera, vp);
const tinyAngleClick = { x: tinyABCScreen.x - 4, y: tinyABCScreen.y + 17 };
const tinyBoundaryClickBA = { x: tinyABCScreen.x - 24, y: tinyABCScreen.y + 32 };
const tinyBoundaryClickBC = { x: tinyABCScreen.x - 12, y: tinyABCScreen.y + 50 };
const tinyTopHit = hitTestTopObject(tinyAngleScene, camera, vp, tinyAngleClick, {
  pointTolPx: 12,
  angleTolPx: 20,
  segmentTolPx: 10,
  lineTolPx: 10,
  circleTolPx: 10,
});
assert(
  tinyTopHit?.type === "angle" && tinyTopHit.id === "a_1",
  "Tiny angle ABC should win top-hit over overlapping segments near the vertex."
);

const tinyBoundaryTopHitBA = hitTestTopObject(tinyAngleScene, camera, vp, tinyBoundaryClickBA, {
  pointTolPx: 12,
  angleTolPx: 20,
  segmentTolPx: 10,
  lineTolPx: 10,
  circleTolPx: 10,
});
assert(
  tinyBoundaryTopHitBA?.type === "angle" && tinyBoundaryTopHitBA.id === "a_1",
  "Tiny angle ABC should still win when clicking near BA boundary inside angle radius."
);

const tinyBoundaryTopHitBC = hitTestTopObject(tinyAngleScene, camera, vp, tinyBoundaryClickBC, {
  pointTolPx: 12,
  angleTolPx: 20,
  segmentTolPx: 10,
  lineTolPx: 10,
  circleTolPx: 10,
});
assert(
  tinyBoundaryTopHitBC?.type === "angle" && tinyBoundaryTopHitBC.id === "a_1",
  "Tiny angle ABC should still win when clicking near BC boundary inside angle radius."
);

const tinyAngleHitId = hitTestAngleId(tinyAngleClick, resolveVisibleAngles(tinyAngleScene), camera, vp, 20);
const tinySegmentHitId = hitTestSegmentId(tinyAngleClick, tinyAngleScene, camera, vp, 10);
assert(tinyAngleHitId === "a_1", "Tiny-angle click should resolve a_1 as angle hit.");
assert(Boolean(tinySegmentHitId), "Tiny-angle click should also be near a segment for priority tie-break coverage.");
const tinyMoveDecision = decideMovePointerDown({
  hitLabelId: null,
  hitAngleLabelId: null,
  hitPointId: null,
  hitSegmentId: tinySegmentHitId,
  hitPolygonId: null,
  hitLineId: null,
  hitCircleId: null,
  hitAngleId: tinyAngleHitId,
  scenePoints: tinyAngleScene.points,
});
assert(
  tinyMoveDecision.selectedObject?.type === "angle" && tinyMoveDecision.selectedObject.id === "a_1",
  "Move selection should prioritize tiny angle over segment when both are hit."
);

console.log("angle-segment tiny-angle hit-priority: ok");
