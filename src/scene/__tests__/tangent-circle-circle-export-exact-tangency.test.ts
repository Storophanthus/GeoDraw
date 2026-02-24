import { exportTikz } from "../../export/tikz";
import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import { getCircleWorldGeometry, getLineWorldAnchors } from "../points";
import type { CircleStyle, LineStyle, PointStyle, SceneModel } from "../points";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lineDirection(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-12) return null;
  return { x: dx / len, y: dy / len };
}

function pointLineDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const den = Math.hypot(dx, dy);
  if (den <= 1e-12) return Number.POSITIVE_INFINITY;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / den;
}

function assertCoincidentLines(
  line1: { a: { x: number; y: number }; b: { x: number; y: number } },
  line2: { a: { x: number; y: number }; b: { x: number; y: number } },
  ctx: string
): void {
  const d1 = lineDirection(line1.a, line1.b);
  const d2 = lineDirection(line2.a, line2.b);
  if (!d1 || !d2) fail(`${ctx}: degenerate line anchors`);
  const cross = Math.abs(d1.x * d2.y - d1.y * d2.x);
  if (cross > 1e-6) fail(`${ctx}: collapsed tangent branches are not parallel`);
  const off = pointLineDistance(line2.a, line1.a, line1.b);
  if (off > 1e-6) fail(`${ctx}: collapsed tangent branches are not coincident`);
}

function hydrateMinimalScene(rawScene: unknown): SceneModel {
  const scene = normalizeSceneIntegrity(rawScene as SceneModel);
  for (const p of scene.points) {
    if (!(p as { style?: PointStyle }).style) {
      (p as { style?: PointStyle }).style = { ...defaultPointStyle };
    }
  }
  for (const l of scene.lines) {
    if (!(l as { style?: LineStyle }).style) {
      (l as { style?: LineStyle }).style = { ...defaultLineStyle };
    }
  }
  for (const c of scene.circles) {
    if (!(c as { style?: CircleStyle }).style) {
      (c as { style?: CircleStyle }).style = { ...defaultCircleStyle };
    }
  }
  return scene;
}

const defaultPointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.4,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const defaultLineStyle: LineStyle = {
  strokeColor: "#1f2937",
  strokeWidth: 1.8,
  dash: "solid",
  opacity: 1,
};

const defaultCircleStyle: CircleStyle = {
  strokeColor: "#1f2937",
  strokeWidth: 1.8,
  strokeDash: "solid",
  strokeOpacity: 1,
};

function runExactTangencyAudit(fileName: string, rawScene: unknown): void {
  const scene = hydrateMinimalScene(rawScene);
  const circles = scene.circles.filter((c) => c.visible);
  assert(circles.length >= 2, `${fileName}: expected two visible circles`);
  const cA = circles[0];
  const cB = circles[1];
  const gA = getCircleWorldGeometry(cA, scene);
  const gB = getCircleWorldGeometry(cB, scene);
  if (!gA || !gB) fail(`${fileName}: circle geometry missing`);

  const d = dist(gA.center, gB.center);
  const sum = gA.radius + gB.radius;
  const diff = Math.abs(gA.radius - gB.radius);
  const tol = 1e-8 * Math.max(1, d, gA.radius, gB.radius);
  const mode: "external" | "internal" =
    Math.abs(d - sum) <= tol ? "external" :
    Math.abs(d - diff) <= tol ? "internal" :
    fail(`${fileName}: fixture is not exact tangency`);

  const collapsedFamily = mode === "external" ? "inner" : "outer";
  const visibleTangents = scene.lines.filter(
    (l): l is Extract<typeof l, { kind: "circleCircleTangent" }> => l.visible && l.kind === "circleCircleTangent"
  );
  const collapsedLines = visibleTangents.filter((l) => l.family === collapsedFamily);
  assert(collapsedLines.length === 2, `${fileName}: expected two visible collapsed-family tangent lines`);
  const exportedVisibleTangents = visibleTangents.filter((l) => !(mode === "internal" && l.family === "inner"));

  const collapsedAnchors = collapsedLines.map((l) => {
    const anchors = getLineWorldAnchors(l, scene);
    if (!anchors) fail(`${fileName}: missing canvas anchors for ${l.id}`);
    return anchors;
  });
  assertCoincidentLines(collapsedAnchors[0], collapsedAnchors[1], `${fileName}`);

  const tikz = exportTikz(scene);

  const tangentDraws = tikz.match(/\\tkzDrawLine(?:\[[^\]]*\])?\((tkzTanCC_[^,]+),(tkzTanCC_[^)]+)\)/g) ?? [];
  assert(
    tangentDraws.length >= exportedVisibleTangents.length,
    `${fileName}: expected at least ${exportedVisibleTangents.length} tangent draw lines, found ${tangentDraws.length}`
  );

  const degenerateDraws = tikz.match(/\\tkzDrawLine(?:\[[^\]]*\])?\(tkzTanCC_T_\d+,tkzTanCC_deg_\d+\)/g) ?? [];
  assert(
    degenerateDraws.length === collapsedLines.length,
    `${fileName}: expected ${collapsedLines.length} degenerate tangent draws, found ${degenerateDraws.length}`
  );

  const contactMatches = [
    ...tikz.matchAll(
      /\\tkzDefPointBy\[homothety=center [^\]]*?\bratio\s+([-+0-9.]+)\]\([^)]+\)\s+\\tkzGetPoint\{tkzTanCC_T_\d+\}/g
    ),
  ];
  assert(
    contactMatches.length === collapsedLines.length,
    `${fileName}: expected ${collapsedLines.length} collapsed tangent contact constructions, found ${contactMatches.length}`
  );

  const expectedRatio = mode === "external"
    ? gA.radius / (gA.radius + gB.radius)
    : gA.radius / (gA.radius - gB.radius);
  for (const m of contactMatches) {
    const ratio = Number(m[1]);
    if (!Number.isFinite(ratio)) fail(`${fileName}: invalid collapsed tangent contact ratio ${m[1]}`);
    if (Math.abs(ratio - expectedRatio) > 1e-9 * Math.max(1, Math.abs(expectedRatio))) {
      fail(`${fileName}: collapsed tangent contact ratio mismatch (expected ${expectedRatio}, got ${ratio})`);
    }
  }

  if (tikz.includes("tkzTanCC_A_") || tikz.includes("tkzTanCC_B_")) {
    fail(`${fileName}: exact tangency export should not use hard-coded tangent-point fallback`);
  }
}

const exactExternalFixture = {
  scene: {
    points: [
      { id: "p1", kind: "free", name: "O1", captionTex: "O1", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p2", kind: "free", name: "A1", captionTex: "A1", visible: true, showLabel: "name", position: { x: 3, y: 0 } },
      { id: "p3", kind: "free", name: "O2", captionTex: "O2", visible: true, showLabel: "name", position: { x: 5, y: 0 } },
      { id: "p4", kind: "free", name: "A2", captionTex: "A2", visible: true, showLabel: "name", position: { x: 7, y: 0 } },
    ],
    lines: [
      { id: "l1", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "outer", branchIndex: 0, visible: true },
      { id: "l2", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "outer", branchIndex: 1, visible: true },
      { id: "l3", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "inner", branchIndex: 0, visible: true },
      { id: "l4", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "inner", branchIndex: 1, visible: true },
    ],
    segments: [],
    circles: [
      { id: "c1", kind: "twoPoint", centerId: "p1", throughId: "p2", visible: true },
      { id: "c2", kind: "twoPoint", centerId: "p3", throughId: "p4", visible: true },
    ],
    polygons: [],
    angles: [],
    numbers: [],
  },
};

const exactInternalFixture = {
  scene: {
    points: [
      { id: "p1", kind: "free", name: "O1", captionTex: "O1", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p2", kind: "free", name: "A1", captionTex: "A1", visible: true, showLabel: "name", position: { x: 5, y: 0 } },
      { id: "p3", kind: "free", name: "O2", captionTex: "O2", visible: true, showLabel: "name", position: { x: 3, y: 0 } },
      { id: "p4", kind: "free", name: "A2", captionTex: "A2", visible: true, showLabel: "name", position: { x: 5, y: 0 } },
    ],
    lines: [
      { id: "l1", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "outer", branchIndex: 0, visible: true },
      { id: "l2", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "outer", branchIndex: 1, visible: true },
      { id: "l3", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "inner", branchIndex: 0, visible: true },
      { id: "l4", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "inner", branchIndex: 1, visible: true },
    ],
    segments: [],
    circles: [
      { id: "c1", kind: "twoPoint", centerId: "p1", throughId: "p2", visible: true },
      { id: "c2", kind: "twoPoint", centerId: "p3", throughId: "p4", visible: true },
    ],
    polygons: [],
    angles: [],
    numbers: [],
  },
};

runExactTangencyAudit("tangent-circle-circle-exact-external.json", exactExternalFixture.scene);
runExactTangencyAudit("tangent-circle-circle-exact-internal.json", exactInternalFixture.scene);

console.log("tangent-circle-circle exact tangency export audit: OK");
