import { getPointWorldPos, type PointStyle, type SceneModel } from "../points";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
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
      position: { x: 0, y: 0 },
      style: pointStyle,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 2, y: 1 },
      style: pointStyle,
    },
    {
      id: "pP",
      kind: "free",
      name: "P",
      captionTex: "P",
      visible: true,
      showLabel: "name",
      position: { x: 4, y: -3 },
      style: pointStyle,
    },
    {
      id: "pT",
      kind: "pointByTranslation",
      name: "T",
      captionTex: "T",
      visible: true,
      showLabel: "name",
      pointId: "pP",
      vectorId: "v_1",
      // Legacy fields intentionally disagree with vectorId to assert vector-first eval.
      fromId: "pB",
      toId: "pB",
      style: pointStyle,
    },
  ],
  vectors: [
    {
      id: "v_1",
      kind: "vectorFromPoints",
      fromId: "pA",
      toId: "pB",
    },
  ],
  segments: [],
  lines: [],
  circles: [],
  polygons: [],
  angles: [],
  numbers: [],
};

const translated = getPointWorldPos(scene.points[3], scene);
assert(!!translated, "translated point should resolve");
assert(approx(translated.x, 6) && approx(translated.y, -2), "pointByTranslation should use vectorId before legacy from/to");

console.log("vector-translation-regression tests: OK");
