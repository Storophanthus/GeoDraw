import {
  beginSceneEvalTick,
  endSceneEvalTick,
  getPointWorldPos,
  type CircleStyle,
  type LineStyle,
  type PointStyle,
  type SceneModel,
  type ScenePoint,
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

function makeFreePoint(id: string, name: string, x: number, y: number): ScenePoint {
  return {
    id,
    kind: "free",
    name,
    captionTex: name,
    visible: true,
    showLabel: "name",
    position: { x, y },
    style: pointStyle,
  };
}

function buildPerfScene(): SceneModel {
  const points: ScenePoint[] = [
    makeFreePoint("p1", "A", 0, 0),
    makeFreePoint("p2", "B", 3, 0),
    makeFreePoint("p3", "C", 1.2, 0.8),
    makeFreePoint("p4", "D", 4.2, 0.8),
    makeFreePoint("p5", "E", -1.1, 1.9),
    makeFreePoint("p6", "F", 1.9, 1.9),
    makeFreePoint("p7", "L1", -6, -6),
    makeFreePoint("p8", "L2", 6, 6),
    makeFreePoint("p9", "L3", -6, 6),
    makeFreePoint("p10", "L4", 6, -6),
    makeFreePoint("p11", "L5", -6, 0),
    makeFreePoint("p12", "L6", 6, 0),
    makeFreePoint("p13", "L7", 0, -6),
    makeFreePoint("p14", "L8", 0, 6),
    makeFreePoint("p15", "L9", -6, 3),
    makeFreePoint("p16", "L10", 6, -2),
  ];

  const lines = [
    { id: "l1", aId: "p7", bId: "p8", visible: true, style: lineStyle },
    { id: "l2", aId: "p9", bId: "p10", visible: true, style: lineStyle },
    { id: "l3", aId: "p11", bId: "p12", visible: true, style: lineStyle },
    { id: "l4", aId: "p13", bId: "p14", visible: true, style: lineStyle },
    { id: "l5", aId: "p15", bId: "p16", visible: true, style: lineStyle },
  ];

  const circles = [
    { id: "c1", centerId: "p1", throughId: "p2", visible: true, style: circleStyle },
    { id: "c2", centerId: "p3", throughId: "p4", visible: true, style: circleStyle },
    { id: "c3", centerId: "p5", throughId: "p6", visible: true, style: circleStyle },
  ];

  let nextId = 17;
  let labelCode = "G".charCodeAt(0);
  for (const circle of circles) {
    for (const line of lines) {
      for (const branchIndex of [0, 1] as const) {
        const name = String.fromCharCode(labelCode++);
        points.push({
          id: `p${nextId++}`,
          kind: "circleLineIntersectionPoint",
          name,
          captionTex: name,
          visible: true,
          showLabel: "name",
          circleId: circle.id,
          lineId: line.id,
          branchIndex,
          style: pointStyle,
        });
      }
    }
  }

  const ccPairs: Array<[string, string]> = [
    ["c1", "c2"],
    ["c1", "c3"],
    ["c2", "c3"],
  ];
  for (const [ca, cb] of ccPairs) {
    points.push({
      id: `p${nextId++}`,
      kind: "intersectionPoint",
      name: `I${nextId}`,
      captionTex: `I${nextId}`,
      visible: true,
      showLabel: "name",
      objA: { type: "circle", id: ca },
      objB: { type: "circle", id: cb },
      preferredWorld: { x: 0.5, y: 2.5 },
      style: pointStyle,
    });
    points.push({
      id: `p${nextId++}`,
      kind: "intersectionPoint",
      name: `J${nextId}`,
      captionTex: `J${nextId}`,
      visible: true,
      showLabel: "name",
      objA: { type: "circle", id: ca },
      objB: { type: "circle", id: cb },
      preferredWorld: { x: 0.5, y: -2.5 },
      style: pointStyle,
    });
  }

  return {
    points,
    lines,
    circles,
    segments: [],
    angles: [],
  };
}

const scene = buildPerfScene();
beginSceneEvalTick(scene);
for (let pass = 0; pass < 5; pass += 1) {
  for (const point of scene.points) {
    getPointWorldPos(point, scene);
  }
}
const stats = endSceneEvalTick(scene);
if (!stats) throw new Error("Missing eval stats.");

const nodeCount = scene.points.length;
if (stats.totalNodeEvalCalls > nodeCount + 2) {
  throw new Error(`Expected near-linear eval calls; got ${stats.totalNodeEvalCalls} for ${nodeCount} nodes.`);
}

const expectedCircleLineNodes = scene.points.filter((p) => p.kind === "circleLineIntersectionPoint").length;
if (stats.circleLineCalls > expectedCircleLineNodes + 4) {
  throw new Error(
    `Circle-line calls exploded: ${stats.circleLineCalls}, expected around ${expectedCircleLineNodes}.`
  );
}

if (stats.ms > 200) {
  throw new Error(`Perf regression: eval tick took ${stats.ms.toFixed(2)}ms.`);
}

console.log(
  `✓ eval perf test passed: nodes=${nodeCount} evalCalls=${stats.totalNodeEvalCalls} circleLine=${stats.circleLineCalls} ms=${stats.ms.toFixed(
    2
  )}`
);
