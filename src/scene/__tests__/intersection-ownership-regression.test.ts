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
import { circleCircleIntersections, distance, lineCircleIntersectionBranches, lineLineIntersection } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";

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
    polygons: [],
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
    polygons: [],
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

function testGenericBranchIndexOverridesPreferredWorld(): void {
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
        // Intentionally biased toward the opposite branch; branchIndex must win.
        branchIndex: 0,
        preferredWorld: { x: 0, y: -10 },
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
        branchIndex: 1,
        preferredWorld: { x: 0, y: 10 },
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [],
    segments: [],
    circles: [
      { id: "c1", kind: "twoPoint", centerId: "a", throughId: "b", visible: true, style: circleStyle },
      { id: "c2", kind: "twoPoint", centerId: "c", throughId: "d", visible: true, style: circleStyle },
    ],
    angles: [],
  };

  beginSceneEvalTick(scene);
  const iw = getWorldOrThrow(scene, "i");
  const jw = getWorldOrThrow(scene, "j");
  const g1 = getCircleWorldGeometry(scene.circles[0], scene);
  const g2 = getCircleWorldGeometry(scene.circles[1], scene);
  if (!g1 || !g2) throw new Error("circle geometry unavailable");
  const roots = circleCircleIntersections(g1.center, g1.radius, g2.center, g2.radius);
  if (roots.length !== 2) throw new Error(`expected two roots, got ${roots.length}`);
  const pair: [Vec2, Vec2] = [roots[0], roots[1]];
  const idxI = closestRootIndex(iw, pair);
  const idxJ = closestRootIndex(jw, pair);
  endSceneEvalTick(scene);

  if (idxI !== 0 || idxJ !== 1) {
    throw new Error(
      `Branch index regression: expected I->0, J->1, got I->${idxI}, J->${idxJ}`
    );
  }
}

function testGenericSegmentCircleBranchIndexOverridesPreferredWorld(): void {
  const scene: SceneModel = {
    points: [
      freePoint("a", "A", 0, 0),
      freePoint("b", "B", 4, 0),
      freePoint("c", "C", -6, 0),
      freePoint("d", "D", 6, 0),
      {
        id: "i",
        kind: "intersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        objA: { type: "segment", id: "s1" },
        objB: { type: "circle", id: "c1" },
        branchIndex: 0,
        preferredWorld: { x: 100, y: 100 },
        style: pointStyle,
      },
      {
        id: "j",
        kind: "intersectionPoint",
        name: "J",
        captionTex: "J",
        visible: true,
        showLabel: "name",
        objA: { type: "segment", id: "s1" },
        objB: { type: "circle", id: "c1" },
        branchIndex: 1,
        preferredWorld: { x: -100, y: -100 },
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [],
    segments: [{ id: "s1", aId: "c", bId: "d", visible: true, showLabel: false, style: lineStyle }],
    circles: [{ id: "c1", kind: "twoPoint", centerId: "a", throughId: "b", visible: true, style: circleStyle }],
    angles: [],
  };

  beginSceneEvalTick(scene);
  const iw = getWorldOrThrow(scene, "i");
  const jw = getWorldOrThrow(scene, "j");
  const rootsRaw = lineCircleIntersectionBranches({ x: -6, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 0 }, 4);
  if (rootsRaw.length !== 2) throw new Error(`expected two roots, got ${rootsRaw.length}`);
  const pair: [Vec2, Vec2] = [rootsRaw[0].point, rootsRaw[1].point];
  const idxI = closestRootIndex(iw, pair);
  const idxJ = closestRootIndex(jw, pair);
  endSceneEvalTick(scene);

  if (idxI !== 0 || idxJ !== 1) {
    throw new Error(
      `Segment-circle branch index regression: expected I->0, J->1, got I->${idxI}, J->${idxJ}`
    );
  }
}

function testMixedGenericBranchPersistenceUnderDrag(): void {
  const scene: SceneModel = {
    points: [
      freePoint("a", "A", 0, 0),
      freePoint("b", "B", 5, 0),
      freePoint("c", "C", 2, 0),
      freePoint("d", "D", 2, 4.2),
      freePoint("e", "E", -8, 0),
      freePoint("f", "F", 8, 0),
      {
        id: "i",
        kind: "intersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        objA: { type: "segment", id: "s1" },
        objB: { type: "circle", id: "c1" },
        branchIndex: 0,
        preferredWorld: { x: 20, y: 20 },
        style: pointStyle,
      },
      {
        id: "j",
        kind: "intersectionPoint",
        name: "J",
        captionTex: "J",
        visible: true,
        showLabel: "name",
        objA: { type: "segment", id: "s1" },
        objB: { type: "circle", id: "c1" },
        branchIndex: 1,
        preferredWorld: { x: -20, y: -20 },
        style: pointStyle,
      },
      {
        id: "k",
        kind: "intersectionPoint",
        name: "K",
        captionTex: "K",
        visible: true,
        showLabel: "name",
        objA: { type: "circle", id: "c1" },
        objB: { type: "circle", id: "c2" },
        branchIndex: 0,
        preferredWorld: { x: 0, y: -50 },
        style: pointStyle,
      },
      {
        id: "l",
        kind: "intersectionPoint",
        name: "L",
        captionTex: "L",
        visible: true,
        showLabel: "name",
        objA: { type: "circle", id: "c1" },
        objB: { type: "circle", id: "c2" },
        branchIndex: 1,
        preferredWorld: { x: 0, y: 50 },
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [],
    segments: [{ id: "s1", aId: "e", bId: "f", visible: true, showLabel: false, style: lineStyle }],
    circles: [
      { id: "c1", kind: "twoPoint", centerId: "a", throughId: "b", visible: true, style: circleStyle },
      { id: "c2", kind: "twoPoint", centerId: "c", throughId: "d", visible: true, style: circleStyle },
    ],
    angles: [],
  };

  const startD = { x: 2, y: 4.2 };
  const endD = { x: 2, y: 6.1 };
  const steps = 80;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    setFreePoint(scene, "d", { x: lerp(startD.x, endD.x, t), y: lerp(startD.y, endD.y, t) });
    beginSceneEvalTick(scene);
    const iw = getWorldOrThrow(scene, "i");
    const jw = getWorldOrThrow(scene, "j");
    const kw = getWorldOrThrow(scene, "k");
    const lw = getWorldOrThrow(scene, "l");

    const segRootsRaw = lineCircleIntersectionBranches({ x: -8, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 0 }, 5);
    if (segRootsRaw.length !== 2) throw new Error(`step ${i}: expected two segment-circle roots`);
    const segPair: [Vec2, Vec2] = [segRootsRaw[0].point, segRootsRaw[1].point];
    const idxI = closestRootIndex(iw, segPair);
    const idxJ = closestRootIndex(jw, segPair);
    if (idxI !== 0 || idxJ !== 1) {
      throw new Error(`step ${i}: segment-circle branch drift I->${idxI}, J->${idxJ}`);
    }

    const c2Center = getWorldOrThrow(scene, "c");
    const c2Through = getWorldOrThrow(scene, "d");
    const c2Radius = distance(c2Center, c2Through);
    const ccRoots = circleCircleIntersections({ x: 0, y: 0 }, 5, c2Center, c2Radius);
    if (ccRoots.length === 2) {
      const ccPair: [Vec2, Vec2] = [ccRoots[0], ccRoots[1]];
      const idxK = closestRootIndex(kw, ccPair);
      const idxL = closestRootIndex(lw, ccPair);
      if (idxK !== 0 || idxL !== 1) {
        throw new Error(`step ${i}: circle-circle branch drift K->${idxK}, L->${idxL}`);
      }
    }
    endSceneEvalTick(scene);
  }
}

function testNormalizeBackfillsMissingGenericBranchIndex(): void {
  const scene: SceneModel = {
    points: [
      freePoint("a", "A", 0, 0),
      freePoint("b", "B", 5, 0),
      freePoint("c", "C", 2, 0),
      freePoint("d", "D", 2, 4.2),
      {
        id: "i",
        kind: "intersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        objA: { type: "circle", id: "c1" },
        objB: { type: "circle", id: "c2" },
        preferredWorld: { x: 0, y: -50 },
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [],
    segments: [],
    circles: [
      { id: "c1", kind: "twoPoint", centerId: "a", throughId: "b", visible: true, style: circleStyle },
      { id: "c2", kind: "twoPoint", centerId: "c", throughId: "d", visible: true, style: circleStyle },
    ],
    angles: [],
  };
  const normalized = normalizeSceneIntegrity(scene);
  const i = normalized.points.find((p) => p.id === "i");
  if (!i || i.kind !== "intersectionPoint") throw new Error("expected normalized intersection point");
  if (i.branchIndex !== 0 && i.branchIndex !== 1) {
    throw new Error("expected normalizeSceneIntegrity to backfill branchIndex for two-root generic intersection");
  }
}

function testCircleSegmentSemanticBranchPersistenceUnderDrag(): void {
  const scene: SceneModel = {
    points: [
      freePoint("a", "A", 0, 0),
      freePoint("b", "B", 5, 0),
      freePoint("c", "C", -8, 0),
      freePoint("d", "D", 8, 0),
      {
        id: "i",
        kind: "circleSegmentIntersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        circleId: "c1",
        segId: "s1",
        branchIndex: 0,
        style: pointStyle,
      },
      {
        id: "j",
        kind: "circleSegmentIntersectionPoint",
        name: "J",
        captionTex: "J",
        visible: true,
        showLabel: "name",
        circleId: "c1",
        segId: "s1",
        branchIndex: 1,
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [],
    segments: [{ id: "s1", aId: "c", bId: "d", visible: true, showLabel: false, style: lineStyle }],
    circles: [{ id: "c1", kind: "twoPoint", centerId: "a", throughId: "b", visible: true, style: circleStyle }],
    angles: [],
  };

  const startB = { x: 5, y: 0 };
  const endB = { x: 6.5, y: 0 };
  const steps = 70;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    setFreePoint(scene, "b", { x: lerp(startB.x, endB.x, t), y: lerp(startB.y, endB.y, t) });
    beginSceneEvalTick(scene);
    const iw = getWorldOrThrow(scene, "i");
    const jw = getWorldOrThrow(scene, "j");
    const center = getWorldOrThrow(scene, "a");
    const through = getWorldOrThrow(scene, "b");
    const r = distance(center, through);
    const rootsRaw = lineCircleIntersectionBranches({ x: -8, y: 0 }, { x: 8, y: 0 }, center, r);
    if (rootsRaw.length !== 2) throw new Error(`step ${i}: expected two segment-circle roots`);
    const pair: [Vec2, Vec2] = [rootsRaw[0].point, rootsRaw[1].point];
    const idxI = closestRootIndex(iw, pair);
    const idxJ = closestRootIndex(jw, pair);
    if (idxI !== 0 || idxJ !== 1) {
      throw new Error(`step ${i}: semantic segment-circle branch drift I->${idxI}, J->${idxJ}`);
    }
    endSceneEvalTick(scene);
  }
}

function testCircleCircleSemanticBranchPersistenceUnderDrag(): void {
  const scene: SceneModel = {
    points: [
      freePoint("a", "A", 0, 0),
      freePoint("b", "B", 4, 0),
      freePoint("c", "C", 2, 0),
      freePoint("d", "D", 2, 3.2),
      {
        id: "i",
        kind: "circleCircleIntersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        circleAId: "c1",
        circleBId: "c2",
        branchIndex: 0,
        style: pointStyle,
      },
      {
        id: "j",
        kind: "circleCircleIntersectionPoint",
        name: "J",
        captionTex: "J",
        visible: true,
        showLabel: "name",
        circleAId: "c1",
        circleBId: "c2",
        branchIndex: 1,
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [],
    segments: [],
    circles: [
      { id: "c1", kind: "twoPoint", centerId: "a", throughId: "b", visible: true, style: circleStyle },
      { id: "c2", kind: "twoPoint", centerId: "c", throughId: "d", visible: true, style: circleStyle },
    ],
    angles: [],
  };

  const startD = { x: 2, y: 3.2 };
  const endD = { x: 2, y: 5.6 };
  const steps = 80;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    setFreePoint(scene, "d", { x: lerp(startD.x, endD.x, t), y: lerp(startD.y, endD.y, t) });
    beginSceneEvalTick(scene);
    const iw = getWorldOrThrow(scene, "i");
    const jw = getWorldOrThrow(scene, "j");
    const g1 = getCircleWorldGeometry(scene.circles[0], scene);
    const g2 = getCircleWorldGeometry(scene.circles[1], scene);
    if (!g1 || !g2) throw new Error("circle geometry unavailable");
    const roots = circleCircleIntersections(g1.center, g1.radius, g2.center, g2.radius);
    if (roots.length !== 2) {
      endSceneEvalTick(scene);
      continue;
    }
    const pair: [Vec2, Vec2] = [roots[0], roots[1]];
    const idxI = closestRootIndex(iw, pair);
    const idxJ = closestRootIndex(jw, pair);
    if (idxI !== 0 || idxJ !== 1) {
      throw new Error(`step ${i}: semantic circle-circle branch drift I->${idxI}, J->${idxJ}`);
    }
    endSceneEvalTick(scene);
  }
}

function testLineLikeSemanticIntersectionTracksGeometryUnderDrag(): void {
  const scene: SceneModel = {
    points: [
      freePoint("a", "A", -5, 0),
      freePoint("b", "B", 5, 0),
      freePoint("c", "C", -1, -2),
      freePoint("d", "D", 1, 2),
      {
        id: "i",
        kind: "lineLikeIntersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        objA: { type: "line", id: "l1" },
        objB: { type: "segment", id: "s1" },
        preferredWorld: { x: 0, y: 0 },
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [{ id: "l1", kind: "twoPoint", aId: "a", bId: "b", visible: true, style: lineStyle }],
    segments: [{ id: "s1", aId: "c", bId: "d", visible: true, showLabel: false, style: lineStyle }],
    circles: [],
    angles: [],
  };

  const startD = { x: 1, y: 2 };
  const endD = { x: 3, y: 1.5 };
  const steps = 80;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    setFreePoint(scene, "d", { x: lerp(startD.x, endD.x, t), y: lerp(startD.y, endD.y, t) });
    beginSceneEvalTick(scene);
    const iw = getWorldOrThrow(scene, "i");
    const anchors = getLineWorldAnchors(scene.lines[0], scene);
    const c = getWorldOrThrow(scene, "c");
    const d = getWorldOrThrow(scene, "d");
    if (!anchors) throw new Error("line geometry unavailable");
    const p = lineLineIntersection(anchors.a, anchors.b, c, d);
    if (!p) throw new Error(`step ${i}: expected line-like intersection`);
    if (distance(iw, p) > 1e-5) {
      throw new Error(`step ${i}: line-like semantic intersection drift: err=${distance(iw, p).toFixed(8)}`);
    }
    endSceneEvalTick(scene);
  }
}

function testLineSectorArcIntersectionTracksBoundary(): void {
  const scene: SceneModel = {
    points: [
      freePoint("o", "O", 0, 0),
      freePoint("a", "A", 2, 0),
      freePoint("c", "C", 0, 2),
      freePoint("u", "U", -3, 1),
      freePoint("v", "V", 3, 1),
      {
        id: "i",
        kind: "intersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        objA: { type: "line", id: "l1" },
        objB: { type: "angle", id: "a1" },
        preferredWorld: { x: 1.7, y: 1 },
        style: pointStyle,
      },
    ],
    numbers: [],
    polygons: [],
    lines: [{ id: "l1", kind: "twoPoint", aId: "u", bId: "v", visible: true, style: lineStyle }],
    segments: [],
    circles: [],
    angles: [
      {
        id: "a1",
        kind: "sector",
        aId: "a",
        bId: "o",
        cId: "c",
        visible: true,
        style: {
          strokeColor: "#334155",
          strokeWidth: 1.5,
          strokeOpacity: 1,
          textColor: "#0f172a",
          textSize: 16,
          fillEnabled: true,
          fillColor: "#60a5fa",
          fillOpacity: 0.15,
          markStyle: "arc",
          markSymbol: "none",
          arcMultiplicity: 1,
          markPos: 0.5,
          markSize: 4,
          markColor: "#000000",
          arcRadius: 40,
          labelText: "",
          labelPosWorld: { x: 0, y: 0 },
          showLabel: false,
          showValue: false,
        },
      },
    ],
  };

  beginSceneEvalTick(scene);
  const i0 = getWorldOrThrow(scene, "i");
  endSceneEvalTick(scene);
  if (Math.abs(i0.x - Math.sqrt(3)) > 1e-5 || Math.abs(i0.y - 1) > 1e-5) {
    throw new Error(`initial line-sector intersection mismatch: (${i0.x}, ${i0.y})`);
  }

  const startY = 1;
  const endY = 1.4;
  const steps = 40;
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const y = lerp(startY, endY, t);
    setFreePoint(scene, "u", { x: -3, y });
    setFreePoint(scene, "v", { x: 3, y });
    beginSceneEvalTick(scene);
    const i = getWorldOrThrow(scene, "i");
    const expectedX = Math.sqrt(Math.max(0, 4 - y * y));
    if (Math.abs(i.x - expectedX) > 2e-5 || Math.abs(i.y - y) > 2e-5) {
      throw new Error(`step ${s}: line-sector intersection drift got=(${i.x},${i.y}) expected=(${expectedX},${y})`);
    }
    endSceneEvalTick(scene);
  }
}

testCircleLinePairOwnership();
testCircleCirclePairOwnership();
testGenericBranchIndexOverridesPreferredWorld();
testGenericSegmentCircleBranchIndexOverridesPreferredWorld();
testMixedGenericBranchPersistenceUnderDrag();
testNormalizeBackfillsMissingGenericBranchIndex();
testCircleSegmentSemanticBranchPersistenceUnderDrag();
testCircleCircleSemanticBranchPersistenceUnderDrag();
testLineLikeSemanticIntersectionTracksGeometryUnderDrag();
testLineSectorArcIntersectionTracksBoundary();
console.log("✓ intersection ownership regression tests passed");
