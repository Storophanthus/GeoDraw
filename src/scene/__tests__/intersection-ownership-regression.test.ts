import {
  beginSceneEvalTick,
  endSceneEvalTick,
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  type CircleStyle,
  type LineStyle,
  type PointStyle,
  type SceneModel,
  type ScenePoint,
} from "../points";
import { circleCircleIntersections, distance, lineCircleIntersectionBranches } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";

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

function freePoint(id: string, name: string, x: number, y: number): ScenePoint {
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

function requirePoint(scene: SceneModel, id: string): ScenePoint {
  const p = scene.points.find((it) => it.id === id);
  if (!p) throw new Error(`Missing point ${id}`);
  return p;
}

function setFreePoint(scene: SceneModel, id: string, next: Vec2): void {
  const p = requirePoint(scene, id);
  if (p.kind !== "free") throw new Error(`Point ${id} is not free`);
  p.position = next;
}

function getWorldOrThrow(scene: SceneModel, id: string): Vec2 {
  const p = requirePoint(scene, id);
  const world = getPointWorldPos(p, scene);
  if (!world) throw new Error(`Point ${id} is undefined`);
  return world;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function closestRootIndex(world: Vec2, roots: [Vec2, Vec2]): 0 | 1 {
  return distance(world, roots[0]) <= distance(world, roots[1]) ? 0 : 1;
}

function testCircleLinePairOwnership(): void {
  const scene: SceneModel = {
    points: [
      freePoint("p_1", "A", 0.0173828125, 2.437158203125),
      freePoint("p_2", "B", -3.310641739615876, 4.7147657144054325),
      freePoint("p_5", "E", 0.8605218885435392, -1.7172687486381386),
      {
        id: "p_11",
        kind: "midpointPoints",
        name: "K",
        captionTex: "K",
        visible: true,
        showLabel: "name",
        aId: "p_2",
        bId: "p_5",
        style: pointStyle,
      },
      {
        id: "p_9",
        kind: "circleLineIntersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        circleId: "c_1",
        lineId: "l_1",
        branchIndex: 0,
        style: pointStyle,
      },
      {
        id: "p_13",
        kind: "circleLineIntersectionPoint",
        name: "M",
        captionTex: "M",
        visible: true,
        showLabel: "name",
        circleId: "c_1",
        lineId: "l_1",
        branchIndex: 1,
        style: pointStyle,
      },
    ],
    numbers: [],
    lines: [{ id: "l_1", kind: "twoPoint", aId: "p_1", bId: "p_11", visible: true, style: lineStyle }],
    segments: [],
    circles: [{ id: "c_1", kind: "twoPoint", centerId: "p_1", throughId: "p_2", visible: true, style: circleStyle }],
    angles: [],
  };

  const line = scene.lines[0];
  const circle = scene.circles[0];
  const startB = { x: -3.310641739615876, y: 4.7147657144054325 };
  const endB = { x: 0.634, y: 6.335 };
  const steps = 80;
  let prevM: Vec2 | null = null;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    setFreePoint(scene, "p_2", { x: lerp(startB.x, endB.x, t), y: lerp(startB.y, endB.y, t) });
    beginSceneEvalTick(scene);
    const m = getWorldOrThrow(scene, "p_13");
    const n = getWorldOrThrow(scene, "p_9");
    const anchors = getLineWorldAnchors(line, scene);
    const geom = getCircleWorldGeometry(circle, scene);
    if (!anchors || !geom) throw new Error("line/circle geometry unavailable");
    const rootsRaw = lineCircleIntersectionBranches(anchors.a, anchors.b, geom.center, geom.radius);
    if (rootsRaw.length !== 2) {
      endSceneEvalTick(scene);
      prevM = m;
      continue;
    }
    const roots: [Vec2, Vec2] = [rootsRaw[0].point, rootsRaw[1].point];
    const idxM = closestRootIndex(m, roots);
    const idxN = closestRootIndex(n, roots);
    if (idxM === idxN) {
      throw new Error(`Circle-line ownership regression at step ${i}: both points mapped to root ${idxM}`);
    }
    if (prevM) {
      const jump = distance(prevM, m);
      const gap = distance(roots[0], roots[1]);
      if (gap > 1e-3 && jump > gap * 0.8 + 1e-3) {
        throw new Error(
          `Circle-line continuity regression at step ${i}: jump=${jump.toFixed(6)} gap=${gap.toFixed(6)}`
        );
      }
    }
    endSceneEvalTick(scene);
    prevM = m;
  }
}

function testCircleCirclePairOwnership(): void {
  const scene: SceneModel = {
    points: [
      freePoint("a", "A", 0, 0),
      freePoint("b", "B", 4, 0),
      freePoint("c", "C", 2, 0),
      freePoint("d", "D", 2, 3.2),
      {
        id: "i",
        kind: "intersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        objA: { type: "circle", id: "c1" },
        objB: { type: "circle", id: "c2" },
        preferredWorld: { x: 1, y: 3 },
        style: pointStyle,
      },
      {
        id: "j",
        kind: "intersectionPoint",
        name: "J",
        captionTex: "J",
        visible: true,
        showLabel: "name",
        objA: { type: "circle", id: "c1" },
        objB: { type: "circle", id: "c2" },
        preferredWorld: { x: 1, y: -3 },
        style: pointStyle,
      },
    ],
    numbers: [],
    lines: [],
    segments: [],
    circles: [
      { id: "c1", kind: "twoPoint", centerId: "a", throughId: "b", visible: true, style: circleStyle },
      { id: "c2", kind: "twoPoint", centerId: "c", throughId: "d", visible: true, style: circleStyle },
    ],
    angles: [],
  };

  const c1 = scene.circles[0];
  const c2 = scene.circles[1];
  const startD = { x: 2, y: 3.2 };
  const endD = { x: 2, y: 5.5 };
  const steps = 80;
  let prevI: Vec2 | null = null;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    setFreePoint(scene, "d", { x: lerp(startD.x, endD.x, t), y: lerp(startD.y, endD.y, t) });
    beginSceneEvalTick(scene);
    const iw = getWorldOrThrow(scene, "i");
    const jw = getWorldOrThrow(scene, "j");
    const g1 = getCircleWorldGeometry(c1, scene);
    const g2 = getCircleWorldGeometry(c2, scene);
    if (!g1 || !g2) throw new Error("circle geometry unavailable");
    const roots = circleCircleIntersections(g1.center, g1.radius, g2.center, g2.radius);
    if (roots.length !== 2) {
      endSceneEvalTick(scene);
      prevI = iw;
      continue;
    }
    const pair: [Vec2, Vec2] = [roots[0], roots[1]];
    const idxI = closestRootIndex(iw, pair);
    const idxJ = closestRootIndex(jw, pair);
    if (idxI === idxJ) {
      throw new Error(`Circle-circle ownership regression at step ${i}: both points mapped to root ${idxI}`);
    }
    if (prevI) {
      const jump = distance(prevI, iw);
      const gap = distance(pair[0], pair[1]);
      if (gap > 1e-3 && jump > gap * 0.8 + 1e-3) {
        throw new Error(
          `Circle-circle continuity regression at step ${i}: jump=${jump.toFixed(6)} gap=${gap.toFixed(6)}`
        );
      }
    }
    endSceneEvalTick(scene);
    prevI = iw;
  }
}

testCircleLinePairOwnership();
testCircleCirclePairOwnership();
console.log("✓ intersection ownership regression tests passed");
