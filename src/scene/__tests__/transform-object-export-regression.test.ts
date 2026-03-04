import { exportTikz } from "../../export/tikz";
import { defaultLineStyle, defaultPointStyle, defaultSegmentStyle } from "../../state/slices/sceneSlice";
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
    mkFree("pA", "A", -2, 0),
    mkFree("pB", "B", 1, 1),
    mkFree("pC", "C", 3, -1),
    {
      id: "pD",
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
      id: "pE",
      kind: "pointByReflection",
      name: "E",
      captionTex: "E",
      visible: true,
      showLabel: "name",
      pointId: "pB",
      axis: { type: "line", id: "lBC" },
      style: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    },
  ],
  vectors: [],
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
      id: "lDE",
      kind: "twoPoint",
      aId: "pD",
      bId: "pE",
      visible: true,
      style: { ...defaultLineStyle },
    },
  ],
  segments: [
    {
      id: "sDE",
      aId: "pD",
      bId: "pE",
      visible: true,
      showLabel: false,
      style: { ...defaultSegmentStyle },
    },
  ],
  circles: [],
  polygons: [],
  angles: [],
  numbers: [],
};

const tikz = exportTikz(scene);

assert(
  /\\tkzDefPointBy\[projection=onto B--C\]\(A\)\s*\\tkzGetPoint\{tkzRefProj_\d+\}/.test(tikz),
  "expected projection-based reflection construction for reflected point D"
);
assert(
  /\\tkzDefPointBy\[homothety=center tkzRefProj_\d+ ratio -1\]\(A\)\s*\\tkzGetPoint\{D\}/.test(tikz),
  "expected homothety reflection output for reflected point D"
);
assert(
  /\\tkzDefPointBy\[projection=onto B--C\]\(B\)\s*\\tkzGetPoint\{tkzRefProj_\d+\}/.test(tikz),
  "expected projection-based reflection construction for reflected point E"
);
assert(
  /\\tkzDefPointBy\[homothety=center tkzRefProj_\d+ ratio -1\]\(B\)\s*\\tkzGetPoint\{E\}/.test(tikz),
  "expected homothety reflection output for reflected point E"
);
assert(!/\\tkzDefPoint\([^)]*\)\{D\}/.test(tikz), "reflected point D must not be exported as hard-coded coordinates");
assert(!/\\tkzDefPoint\([^)]*\)\{E\}/.test(tikz), "reflected point E must not be exported as hard-coded coordinates");
assert(/\\tkzDrawSegment[^\n]*\(D,E\)/.test(tikz), "expected transformed segment to be drawn from reflected points D and E");
assert(/\\tkzDrawLine[^\n]*\(D,E\)/.test(tikz), "expected transformed line to be drawn from reflected points D and E");

console.log("transform-object-export-regression: ok");
