import { selectConstructionDescription } from "../../state/selectors/constructionDescription";
import {
  defaultCircleStyle,
  defaultLineStyle,
  defaultPointStyle,
  defaultPolygonStyle,
  defaultSegmentStyle,
} from "../../state/slices/sceneSlice";
import type { SceneModel, ScenePoint } from "../points";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function mkFree(id: string, name: string, x: number, y: number): ScenePoint {
  return {
    id,
    kind: "free",
    name,
    captionTex: name,
    visible: true,
    showLabel: "name",
    position: { x, y },
    style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
  };
}

const scene: SceneModel = {
  points: [
    mkFree("pA", "A", 0, 0),
    mkFree("pB", "B", 2, 0),
    mkFree("pC", "C", 3, 1),
    mkFree("pO", "O", -1, -1),
    mkFree("pX", "X", 0, 0),
    mkFree("pY", "Y", 1, 2),
    {
      id: "pAr",
      kind: "pointByReflection",
      name: "D",
      captionTex: "D",
      visible: true,
      showLabel: "name",
      pointId: "pA",
      axis: { type: "line", id: "lBC" },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "pBr",
      kind: "pointByReflection",
      name: "E",
      captionTex: "E",
      visible: true,
      showLabel: "name",
      pointId: "pB",
      axis: { type: "line", id: "lBC" },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "pAt",
      kind: "pointByTranslation",
      name: "F",
      captionTex: "F",
      visible: true,
      showLabel: "name",
      pointId: "pA",
      vectorId: "vXY",
      fromId: "pX",
      toId: "pY",
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "pBt",
      kind: "pointByTranslation",
      name: "G",
      captionTex: "G",
      visible: true,
      showLabel: "name",
      pointId: "pB",
      vectorId: "vXY",
      fromId: "pX",
      toId: "pY",
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "pAd",
      kind: "pointByDilation",
      name: "H",
      captionTex: "H",
      visible: true,
      showLabel: "name",
      pointId: "pA",
      centerId: "pO",
      factor: 2,
      factorExpr: "2",
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "pBd",
      kind: "pointByDilation",
      name: "I",
      captionTex: "I",
      visible: true,
      showLabel: "name",
      pointId: "pB",
      centerId: "pO",
      factor: 2,
      factorExpr: "2",
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
    {
      id: "pCd",
      kind: "pointByDilation",
      name: "J",
      captionTex: "J",
      visible: true,
      showLabel: "name",
      pointId: "pC",
      centerId: "pO",
      factor: 2,
      factorExpr: "2",
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
  ],
  vectors: [{ id: "vXY", kind: "vectorFromPoints", fromId: "pX", toId: "pY" }],
  lines: [
    {
      id: "lBC",
      kind: "twoPoint",
      aId: "pB",
      bId: "pC",
      visible: true,
      style: { ...defaultLineStyle },
    },
    {
      id: "lRef",
      kind: "twoPoint",
      aId: "pAr",
      bId: "pBr",
      visible: true,
      style: { ...defaultLineStyle },
    },
  ],
  segments: [
    {
      id: "sRef",
      aId: "pAr",
      bId: "pBr",
      visible: true,
      showLabel: false,
      style: { ...defaultSegmentStyle },
    },
  ],
  circles: [
    {
      id: "cTrans",
      kind: "twoPoint",
      centerId: "pAt",
      throughId: "pBt",
      visible: true,
      style: { ...defaultCircleStyle },
    },
  ],
  polygons: [
    {
      id: "polyDil",
      pointIds: ["pAd", "pBd", "pCd"],
      visible: true,
      style: { ...defaultPolygonStyle },
    },
  ],
  angles: [],
  numbers: [],
};

{
  const text = selectConstructionDescription({ type: "segment", id: "sRef" }, scene);
  assert(text === "Segment AB reflected over line BC.", `unexpected segment transform description: ${text}`);
}

{
  const text = selectConstructionDescription({ type: "line", id: "lRef" }, scene);
  assert(text === "Line AB reflected over line BC.", `unexpected line transform description: ${text}`);
}

{
  const text = selectConstructionDescription({ type: "circle", id: "cTrans" }, scene);
  assert(text === "Circle with center A through B translated by vector XY.", `unexpected circle transform description: ${text}`);
}

{
  const text = selectConstructionDescription({ type: "polygon", id: "polyDil" }, scene);
  assert(text === "Polygon ABC dilated about O with factor 2.", `unexpected polygon transform description: ${text}`);
}

console.log("construction-description-transform: ok");
