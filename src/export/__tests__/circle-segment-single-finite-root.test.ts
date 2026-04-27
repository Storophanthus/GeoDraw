import { exportTikz } from "../tikz.ts";
import type { CircleStyle, LineStyle, PointStyle, SceneModel } from "../../scene/points.ts";

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 6,
  strokeColor: "#000000",
  strokeWidth: 1.7,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 18,
  labelHaloWidthPx: 3.5,
  labelHaloColor: "#ffffff",
  labelColor: "#000000",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle: LineStyle = {
  strokeColor: "#000000",
  strokeWidth: 1.6,
  dash: "solid",
  opacity: 1,
};

const circleStyle: CircleStyle = {
  strokeColor: "#000000",
  strokeWidth: 1.6,
  strokeDash: "solid",
  strokeOpacity: 1,
  fillOpacity: 0,
};

function makeBaseScene(extraPoints: SceneModel["points"]): SceneModel {
  return {
    points: [
      {
        id: "o",
        kind: "free",
        name: "O",
        captionTex: "O",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
      },
      {
        id: "a",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 5, y: 0 },
        style: pointStyle,
      },
      {
        id: "c",
        kind: "free",
        name: "C",
        captionTex: "C",
        visible: true,
        showLabel: "name",
        position: { x: 2, y: 0 },
        style: pointStyle,
      },
      {
        id: "d",
        kind: "free",
        name: "D",
        captionTex: "D",
        visible: true,
        showLabel: "name",
        position: { x: 8, y: 0 },
        style: pointStyle,
      },
      ...extraPoints,
    ],
    numbers: [],
    lines: [],
    segments: [
      {
        id: "s1",
        aId: "c",
        bId: "d",
        visible: true,
        showLabel: false,
        style: lineStyle,
      },
    ],
    circles: [
      {
        id: "c1",
        kind: "twoPoint",
        centerId: "o",
        throughId: "a",
        visible: true,
        showLabel: false,
        style: circleStyle,
      },
    ],
    polygons: [],
    angles: [],
  };
}

const dedicatedScene = makeBaseScene([
  {
    id: "e",
    kind: "circleSegmentIntersectionPoint",
    name: "E",
    captionTex: "E",
    visible: true,
    showLabel: "name",
    circleId: "c1",
    segId: "s1",
    branchIndex: 0,
    style: pointStyle,
  },
  {
    id: "f",
    kind: "circleSegmentIntersectionPoint",
    name: "F",
    captionTex: "F",
    visible: true,
    showLabel: "name",
    circleId: "c1",
    segId: "s1",
    branchIndex: 1,
    style: pointStyle,
  },
]);

const dedicatedTikz = exportTikz(dedicatedScene);

if (!/\\tkzDefPointBy\[homothety=center C ratio 0\.5\]\(D\) \\tkzGetPoint\{E\}/.test(dedicatedTikz)) {
  throw new Error(`Expected finite single segment-circle root to export via homothety for E:\n${dedicatedTikz}`);
}

if (dedicatedTikz.includes("\\tkzGetPoint{F}")) {
  throw new Error(`Did not expect a second segment-domain root export for F:\n${dedicatedTikz}`);
}

const genericScene = makeBaseScene([
  {
    id: "g",
    kind: "intersectionPoint",
    name: "G",
    captionTex: "G",
    visible: true,
    showLabel: "name",
    objA: { type: "segment", id: "s1" },
    objB: { type: "circle", id: "c1" },
    preferredWorld: { x: 5, y: 0 },
    style: pointStyle,
  },
]);

const genericTikz = exportTikz(genericScene);

if (!/\\tkzDefPointBy\[homothety=center C ratio 0\.5\]\(D\) \\tkzGetPoint\{G\}/.test(genericTikz)) {
  throw new Error(`Expected finite single mixed segment-circle root to export via homothety for G:\n${genericTikz}`);
}

console.log("circle-segment-single-finite-root: ok");
