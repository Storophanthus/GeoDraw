import { exportTikz } from "../../export/tikz";
import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import type { CircleStyle, LineStyle, PointStyle, SceneModel } from "../points";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
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

function hydrateMinimalScene(rawScene: unknown): SceneModel {
  const scene = normalizeSceneIntegrity(rawScene as SceneModel);
  for (const p of scene.points) {
    if (!(p as { style?: PointStyle }).style) (p as { style?: PointStyle }).style = { ...defaultPointStyle };
  }
  for (const l of scene.lines) {
    if (!(l as { style?: LineStyle }).style) (l as { style?: LineStyle }).style = { ...defaultLineStyle };
  }
  for (const c of scene.circles) {
    if (!(c as { style?: CircleStyle }).style) (c as { style?: CircleStyle }).style = { ...defaultCircleStyle };
  }
  return scene;
}

function assertTopologySkipped(
  name: string,
  rawScene: unknown
): void {
  const scene = hydrateMinimalScene(rawScene);
  const tikz = exportTikz(scene);
  assert(tikz.includes("\\tkzDrawCircle"), `${name}: export should still contain visible circles`);
  assert(!tikz.includes("tkzTanCC_"), `${name}: topologically impossible circle-circle tangents should be skipped`);
}

const coincidentFixture = {
  scene: {
    points: [
      { id: "p1", kind: "free", name: "O1", captionTex: "O1", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p2", kind: "free", name: "A1", captionTex: "A1", visible: true, showLabel: "name", position: { x: 3, y: 0 } },
      { id: "p3", kind: "free", name: "O2", captionTex: "O2", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p4", kind: "free", name: "A2", captionTex: "A2", visible: true, showLabel: "name", position: { x: 3, y: 0 } },
    ],
    lines: [
      { id: "l1", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "outer", branchIndex: 0, visible: true },
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

const concentricUnequalFixture = {
  scene: {
    points: [
      { id: "p1", kind: "free", name: "O1", captionTex: "O1", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p2", kind: "free", name: "A1", captionTex: "A1", visible: true, showLabel: "name", position: { x: 3, y: 0 } },
      { id: "p3", kind: "free", name: "O2", captionTex: "O2", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p4", kind: "free", name: "A2", captionTex: "A2", visible: true, showLabel: "name", position: { x: 5, y: 0 } },
    ],
    lines: [
      { id: "l1", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "outer", branchIndex: 0, visible: true },
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

const containedFixture = {
  scene: {
    points: [
      { id: "p1", kind: "free", name: "O1", captionTex: "O1", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p2", kind: "free", name: "A1", captionTex: "A1", visible: true, showLabel: "name", position: { x: 5, y: 0 } },
      { id: "p3", kind: "free", name: "O2", captionTex: "O2", visible: true, showLabel: "name", position: { x: 1, y: 0 } },
      { id: "p4", kind: "free", name: "A2", captionTex: "A2", visible: true, showLabel: "name", position: { x: 3, y: 0 } },
    ],
    lines: [
      { id: "l1", kind: "circleCircleTangent", circleAId: "c1", circleBId: "c2", family: "outer", branchIndex: 0, visible: true },
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

assertTopologySkipped("tangent-circle-circle-coincident", coincidentFixture.scene);
assertTopologySkipped("tangent-circle-circle-concentric-unequal", concentricUnequalFixture.scene);
assertTopologySkipped("tangent-circle-circle-contained", containedFixture.scene);

console.log("tangent-circle-circle topology policy export audit: OK");
