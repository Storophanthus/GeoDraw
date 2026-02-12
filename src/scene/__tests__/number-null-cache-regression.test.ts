import {
  getNumberValue,
  getPointWorldPos,
  type AngleStyle,
  type CircleStyle,
  type LineStyle,
  type PointStyle,
  type SceneModel,
} from "../points";

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.2,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2.5,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
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
  strokeWidth: 1.8,
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 16,
  fillEnabled: false,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 4,
  markColor: "#334155",
  arcRadius: 1.2,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: true,
  showValue: true,
};

const scene: SceneModel = {
  points: [
    {
      id: "p_1",
      name: "A",
      captionTex: "A",
      kind: "free",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 2 },
      style: pointStyle,
    },
    {
      id: "p_2",
      name: "B",
      captionTex: "B",
      kind: "free",
      visible: true,
      showLabel: "name",
      position: { x: 2, y: 0 },
      style: pointStyle,
    },
    {
      id: "p_3",
      name: "C",
      captionTex: "C",
      kind: "free",
      visible: true,
      showLabel: "name",
      position: { x: -2, y: 0 },
      style: pointStyle,
    },
    {
      id: "p_4",
      name: "E",
      captionTex: "E",
      kind: "pointOnSegment",
      visible: true,
      showLabel: "name",
      segId: "s_1",
      u: 0.5,
      style: pointStyle,
    },
    {
      id: "p_7",
      name: "D",
      captionTex: "D",
      kind: "pointByRotation",
      visible: false,
      showLabel: "name",
      centerId: "p_4",
      pointId: "p_3",
      angleDeg: 90,
      angleExpr: "ang_1",
      direction: "CCW",
      radiusMode: "keep",
      style: pointStyle,
    },
    {
      id: "p_8",
      name: "F",
      captionTex: "F",
      kind: "intersectionPoint",
      visible: true,
      showLabel: "name",
      objA: { type: "line", id: "l_1" },
      objB: { type: "segment", id: "s_2" },
      preferredWorld: { x: 0, y: 0 },
      style: pointStyle,
    },
  ],
  segments: [
    { id: "s_1", aId: "p_1", bId: "p_2", visible: false, showLabel: false, style: lineStyle },
    { id: "s_2", aId: "p_2", bId: "p_3", visible: true, showLabel: false, style: lineStyle },
  ],
  lines: [
    { id: "l_1", kind: "twoPoint", aId: "p_4", bId: "p_7", visible: false, style: lineStyle },
  ],
  circles: [{ id: "c_1", centerId: "p_8", throughId: "p_3", visible: true, style: circleStyle }],
  angles: [{ id: "a_1", aId: "p_1", bId: "p_2", cId: "p_3", visible: true, style: angleStyle }],
  numbers: [
    { id: "n_1", name: "ang_1", visible: true, definition: { kind: "angleDegrees", angleId: "a_1" } },
    { id: "n_2", name: "r_1", visible: true, definition: { kind: "circleRadius", circleId: "c_1" } },
  ],
};

// First resolve a point that depends on angleExpr. This used to transiently evaluate n_2 to null.
const rotated = getPointWorldPos(scene.points.find((p) => p.id === "p_7")!, scene);
if (!rotated) throw new Error("Setup failed: rotated point should be resolvable.");

const r = getNumberValue("n_2", scene);
if (r === null || !Number.isFinite(r) || r <= 0) {
  throw new Error(`Regression: radius number remained undefined after transient eval; got ${String(r)}.`);
}

console.log(`✓ number null-cache regression passed: r_1=${r.toFixed(6)}`);
