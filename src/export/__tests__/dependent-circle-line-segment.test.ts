import type { AngleStyle, CircleStyle, LineStyle, PointStyle, SceneModel } from "../../scene/points.ts";
import { getPointWorldPos } from "../../scene/points.ts";
import { exportTikzWithOptions } from "../tikz.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pointStyle: PointStyle = {
  shape: "circle",
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

const lineStyle: LineStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.5,
  dash: "solid",
  opacity: 1,
};

const circleStyle: CircleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.5,
  strokeDash: "solid",
  strokeOpacity: 1,
};

const angleStyle: AngleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.2,
  strokeOpacity: 1,
  textColor: "#111111",
  textSize: 14,
  fillEnabled: false,
  fillColor: "#ffffff",
  fillOpacity: 0,
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 4,
  markColor: "#334155",
  arcRadius: 0.8,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: false,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    {
      id: "p_1",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 8.189837803519879, y: 2.554842501436155 },
      style: pointStyle,
    },
    {
      id: "p_10",
      kind: "circleLineIntersectionPoint",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "caption",
      circleId: "c_2",
      lineId: "l_2",
      branchIndex: 0,
      style: pointStyle,
    },
    {
      id: "p_2",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 2.8435275503181368, y: 1.7328655222733902 },
      style: pointStyle,
    },
    {
      id: "p_5",
      kind: "pointByRotation",
      name: "Da",
      captionTex: "Da",
      visible: false,
      showLabel: "name",
      centerId: "p_1",
      pointId: "p_2",
      angleDeg: 80,
      angleExpr: "80",
      direction: "CW",
      radiusMode: "keep",
      style: pointStyle,
    },
    {
      id: "p_6",
      kind: "pointByRotation",
      name: "Ca",
      captionTex: "Ca",
      visible: false,
      showLabel: "name",
      centerId: "p_2",
      pointId: "p_1",
      angleDeg: 80,
      angleExpr: "80",
      direction: "CCW",
      radiusMode: "keep",
      style: pointStyle,
    },
    {
      id: "p_7",
      kind: "circleLineIntersectionPoint",
      name: "aaaD",
      captionTex: "aaaD",
      visible: false,
      showLabel: "name",
      circleId: "c_1",
      lineId: "l_1",
      branchIndex: 1,
      style: pointStyle,
    },
    {
      id: "p_8",
      kind: "circleLineIntersectionPoint",
      name: "D",
      captionTex: "D",
      visible: true,
      showLabel: "name",
      circleId: "c_1",
      lineId: "l_1",
      branchIndex: 1,
      excludePointId: "p_7",
      style: pointStyle,
    },
  ],
  vectors: [],
  numbers: [],
  lines: [
    { id: "l_1", kind: "twoPoint", aId: "p_1", bId: "p_5", visible: false, style: lineStyle },
    { id: "l_2", kind: "twoPoint", aId: "p_2", bId: "p_6", visible: false, style: lineStyle },
  ],
  segments: [
    { id: "s_1", aId: "p_1", bId: "p_2", visible: true, showLabel: false, style: lineStyle },
    { id: "s_6", aId: "p_10", bId: "p_8", visible: true, showLabel: false, style: lineStyle },
    { id: "s_7", aId: "p_10", bId: "p_1", visible: true, showLabel: false, style: lineStyle },
    { id: "s_8", aId: "p_8", bId: "p_1", visible: true, showLabel: false, style: lineStyle },
    { id: "s_9", aId: "p_10", bId: "p_2", visible: true, showLabel: false, style: lineStyle },
  ],
  circles: [
    { id: "c_1", kind: "twoPoint", centerId: "p_1", throughId: "p_2", visible: false, style: circleStyle },
    { id: "c_2", kind: "twoPoint", centerId: "p_8", throughId: "p_1", visible: true, style: circleStyle },
  ],
  polygons: [],
  angles: [
    { id: "a_3", kind: "angle", aId: "p_10", bId: "p_8", cId: "p_1", visible: true, style: angleStyle },
  ],
};

for (const pointId of ["p_7", "p_8"]) {
  const point = scene.points.find((candidate) => candidate.id === pointId);
  assert(point, `Missing fixture point ${pointId}.`);
  assert(getPointWorldPos(point, scene), `Expected ${pointId} to resolve before export.`);
}
const undefinedPoint = scene.points.find((candidate) => candidate.id === "p_10");
assert(undefinedPoint, "Missing fixture point p_10.");
assert(
  getPointWorldPos(undefinedPoint, scene) === null,
  "The fixture must keep C undefined because c_2 and l_2 do not intersect."
);

for (const drawLayerBackend of ["plain", "tkz"] as const) {
  const source = exportTikzWithOptions(scene, {
    viewport: { xmin: -4, xmax: 12, ymin: -4, ymax: 14 },
    clipSpace: 0,
    globalLineAdd: 5,
    drawLayerBackend,
    bakePointCoordinates: drawLayerBackend === "plain",
    emitTkzSetup: false,
  });
  assert(
    source.includes("(A) -- (B)") || source.includes("(A,B)"),
    `${drawLayerBackend} export must retain valid segment A--B.`
  );
  assert(
    source.includes("(D) -- (A)") || source.includes("(D,A)"),
    `${drawLayerBackend} export must retain valid segment D--A.`
  );
  assert(
    !source.includes("(C) --") && !source.includes("(C,D)") && !source.includes("(C,A)") && !source.includes("(C,B)"),
    `${drawLayerBackend} export must omit segments whose endpoint C is undefined.`
  );
  assert(!source.includes("\\tkzMarkAngle") && !source.includes("\\tkzMarkRightAngle"), `${drawLayerBackend} export must omit the undefined angle at D.`);
}

console.log("✓ dependent circle-line segment export test passed");
