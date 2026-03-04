import { exportTikz } from "../../export/tikz";
import { getCircleWorldGeometry, getLineWorldAnchors } from "../points";
import { commandBarApi, getGeoStore } from "../../state/geoStore";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function setPoint(name: string, x: number, y: number): void {
  const result = commandBarApi.setPointXY(name, x, y);
  if (!result.ok) fail(`Failed to set point ${name}: ${result.error}`);
}

function findPointId(name: string): string {
  const point = getGeoStore().scene.points.find((p) => p.name === name);
  if (!point) fail(`Missing point ${name}`);
  return point.id;
}

type TangentGroup = {
  mode: "outer" | "inner";
  simName: string;
  aFirst: string;
  aSecond: string;
  bFirst: string;
  bSecond: string;
};

type TangentDrawPair = { a: string; b: string };

function parseTangentGroups(tikz: string): TangentGroup[] {
  const out: TangentGroup[] = [];
  const lines = tikz.split(/\r?\n/);
  for (let i = 0; i + 2 < lines.length; i += 1) {
    const sim = lines[i].match(
      /\\tkzDef(Ext|Int)SimilitudeCenter\([^)]*\)\([^)]*\)\s+\\tkzGetPoint\{(tkzSim_\d+)\}/
    );
    if (!sim) continue;
    const tangA = lines[i + 1].match(
      /\\tkzDefLine\[tangent from = (tkzSim_\d+)\]\([^)]*\)\s+\\tkzGetPoints\{(tkzTanCC_\d+_1)\}\{(tkzTanCC_\d+_2)\}/
    );
    const tangB = lines[i + 2].match(
      /\\tkzDefLine\[tangent from = (tkzSim_\d+)\]\([^)]*\)\s+\\tkzGetPoints\{(tkzTanCC_\d+_1)\}\{(tkzTanCC_\d+_2)\}/
    );
    if (!tangA || !tangB) continue;
    if (tangA[1] !== sim[2] || tangB[1] !== sim[2]) {
      fail(`Unexpected tangent helper grouping around ${sim[2]}`);
    }
    out.push({
      mode: sim[1] === "Ext" ? "outer" : "inner",
      simName: sim[2],
      aFirst: tangA[2],
      aSecond: tangA[3],
      bFirst: tangB[2],
      bSecond: tangB[3],
    });
    i += 2;
  }
  return out;
}

function parseTangentDrawPairs(tikz: string): TangentDrawPair[] {
  const out: TangentDrawPair[] = [];
  const re = /\\tkzDrawLine(?:\[[^\]]*\])?\((tkzTanCC_[^,]+),(tkzTanCC_[^)]+)\)/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(tikz))) {
    out.push({ a: m[1], b: m[2] });
  }
  return out;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function similitudeCenter(
  centerA: { x: number; y: number },
  radiusA: number,
  centerB: { x: number; y: number },
  radiusB: number,
  mode: "outer" | "inner"
): { x: number; y: number } | null {
  const eps = 1e-12;
  if (!(radiusA > eps) || !(radiusB > eps)) return null;
  if (mode === "outer") {
    const denom = radiusA - radiusB;
    if (Math.abs(denom) <= eps) return null;
    return {
      x: (-radiusB * centerA.x + radiusA * centerB.x) / denom,
      y: (-radiusB * centerA.y + radiusA * centerB.y) / denom,
    };
  }
  const denom = radiusA + radiusB;
  if (Math.abs(denom) <= eps) return null;
  return {
    x: (radiusB * centerA.x + radiusA * centerB.x) / denom,
    y: (radiusB * centerA.y + radiusA * centerB.y) / denom,
  };
}

function tangentCandidatesFromPoint(
  through: { x: number; y: number },
  center: { x: number; y: number },
  radius: number
): Array<{ x: number; y: number }> {
  const eps = 1e-10;
  const vx = through.x - center.x;
  const vy = through.y - center.y;
  const d2 = vx * vx + vy * vy;
  const r2 = radius * radius;
  if (!(radius > 1e-12) || d2 <= 1e-12 || d2 < r2 - eps) return [];
  const k = r2 / d2;
  const perp = { x: -vy, y: vx };
  if (Math.abs(d2 - r2) <= eps) {
    return [{ x: center.x + k * vx, y: center.y + k * vy }];
  }
  const h = (radius * Math.sqrt(Math.max(0, d2 - r2))) / d2;
  return [
    { x: center.x + k * vx + h * perp.x, y: center.y + k * vy + h * perp.y },
    { x: center.x + k * vx - h * perp.x, y: center.y + k * vy - h * perp.y },
  ];
}

function orientationSign(
  through: { x: number; y: number },
  contact: { x: number; y: number },
  center: { x: number; y: number }
): number {
  const ux = through.x - contact.x;
  const uy = through.y - contact.y;
  const vx = center.x - contact.x;
  const vy = center.y - contact.y;
  return ux * vy - uy * vx;
}

function tkzOrderedNamesForCandidates(
  through: { x: number; y: number },
  center: { x: number; y: number },
  candidates: Array<{ x: number; y: number }>,
  firstName: string,
  secondName: string
): Array<{ name: string; point: { x: number; y: number } }> {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) return [{ name: firstName, point: candidates[0] }];
  const [c0, c1] = candidates;
  const s0 = orientationSign(through, c0, center);
  const s1 = orientationSign(through, c1, center);
  const eps = 1e-12;
  // tkz contract: first point is CCW
  if (s0 > eps && s1 <= eps) return [{ name: firstName, point: c0 }, { name: secondName, point: c1 }];
  if (s1 > eps && s0 <= eps) return [{ name: firstName, point: c1 }, { name: secondName, point: c0 }];
  return [{ name: firstName, point: c0 }, { name: secondName, point: c1 }];
}

function nearestName(
  candidates: Array<{ name: string; point: { x: number; y: number } }>,
  target: { x: number; y: number }
): string {
  if (candidates.length === 0) fail("No tangent candidates");
  let best = candidates[0];
  let bestDist = dist(best.point, target);
  for (let i = 1; i < candidates.length; i += 1) {
    const d = dist(candidates[i].point, target);
    if (d < bestDist) {
      best = candidates[i];
      bestDist = d;
    }
  }
  return best.name;
}

function sameUnorderedPair(a: TangentDrawPair, b: TangentDrawPair): boolean {
  return (a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a);
}

// Seed scene
setPoint("O1", 0, 0);
setPoint("R1", 2, 0);
setPoint("O2", 8, 1);
setPoint("R2", 9.7, 1);

const o1 = findPointId("O1");
const r1 = findPointId("R1");
const o2 = findPointId("O2");
const r2 = findPointId("R2");

const c1 = getGeoStore().createCircle(o1, r1);
const c2 = getGeoStore().createCircle(o2, r2);
if (!c1 || !c2) fail("Failed to create circles");
const tangentIds = getGeoStore().createCircleTangentLines(c1, c2);
assert(tangentIds.length === 4, `Expected 4 tangents initially, got ${tangentIds.length}`);

const cases = [
  { O1: [0, 0], R1: [2, 0], O2: [8, 1], R2: [9.7, 1] },
  { O1: [1.5, -2], R1: [4.2, -2], O2: [9.3, 3.7], R2: [10.5, 3.7] },
  { O1: [-3.2, 1.1], R1: [-0.7, 2.0], O2: [6.6, -2.4], R2: [8.0, -1.9] },
  { O1: [2.4, 4.8], R1: [4.1, 6.0], O2: [11.3, 0.2], R2: [12.2, 1.9] },
  { O1: [-5.0, -3.0], R1: [-3.4, -2.2], O2: [5.8, 4.4], R2: [7.1, 4.9] },
];

for (let caseIdx = 0; caseIdx < cases.length; caseIdx += 1) {
  const cfg = cases[caseIdx];
  setPoint("O1", cfg.O1[0], cfg.O1[1]);
  setPoint("R1", cfg.R1[0], cfg.R1[1]);
  setPoint("O2", cfg.O2[0], cfg.O2[1]);
  setPoint("R2", cfg.R2[0], cfg.R2[1]);

  const state = getGeoStore();
  const scene = state.scene;
  const circleA = scene.circles.find((c) => c.id === c1);
  const circleB = scene.circles.find((c) => c.id === c2);
  if (!circleA || !circleB) fail(`case ${caseIdx}: circles missing`);
  const geomA = getCircleWorldGeometry(circleA, scene);
  const geomB = getCircleWorldGeometry(circleB, scene);
  if (!geomA || !geomB) fail(`case ${caseIdx}: circle geometry missing`);

  // Keep test in the non-degenerate disjoint regime (4 tangents) to focus on branch pairing.
  const d = dist(geomA.center, geomB.center);
  if (!(d > geomA.radius + geomB.radius + 1e-3)) {
    fail(`case ${caseIdx}: not safely disjoint`);
  }
  if (Math.abs(geomA.radius - geomB.radius) <= 1e-6) {
    fail(`case ${caseIdx}: equal radii would trigger outer-similitude degeneracy fallback`);
  }

  const visibleTangents = scene.lines.filter(
    (l): l is Extract<typeof l, { kind: "circleCircleTangent" }> => l.visible && l.kind === "circleCircleTangent"
  );
  assert(visibleTangents.length === 4, `case ${caseIdx}: expected 4 visible tangents, got ${visibleTangents.length}`);

  const tikz = exportTikz(scene);
  const groups = parseTangentGroups(tikz);
  const drawPairs = parseTangentDrawPairs(tikz);
  assert(groups.length === visibleTangents.length, `case ${caseIdx}: tangent helper groups mismatch`);
  assert(drawPairs.length >= visibleTangents.length, `case ${caseIdx}: draw line tangent pairs missing`);

  for (let i = 0; i < visibleTangents.length; i += 1) {
    const line = visibleTangents[i];
    const anchors = getLineWorldAnchors(line, scene);
    if (!anchors) fail(`case ${caseIdx}: missing anchors for ${line.id}`);
    const group = groups[i];
    const actualPair = drawPairs[i];
    if (group.mode !== line.family) {
      fail(`case ${caseIdx}: expected helper mode ${line.family} but got ${group.mode} for ${line.id}`);
    }

    const sim = similitudeCenter(geomA.center, geomA.radius, geomB.center, geomB.radius, line.family);
    if (!sim) fail(`case ${caseIdx}: missing similitude center for ${line.id}`);
    const candsA = tangentCandidatesFromPoint(sim, geomA.center, geomA.radius);
    const candsB = tangentCandidatesFromPoint(sim, geomB.center, geomB.radius);
    const namedA = tkzOrderedNamesForCandidates(sim, geomA.center, candsA, group.aFirst, group.aSecond);
    const namedB = tkzOrderedNamesForCandidates(sim, geomB.center, candsB, group.bFirst, group.bSecond);
    const expectedPair: TangentDrawPair = {
      a: nearestName(namedA, anchors.a),
      b: nearestName(namedB, anchors.b),
    };

    if (!sameUnorderedPair(actualPair, expectedPair)) {
      fail(
        `case ${caseIdx}: tangent branch pairing mismatch for ${line.id} (${line.family}/${line.branchIndex}) ` +
        `expected {${expectedPair.a},${expectedPair.b}} got {${actualPair.a},${actualPair.b}}`
      );
    }
  }
}

console.log("tangent-circle-circle export branch tests: OK");
