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

function assertNearDegenerateExportFails(
  name: string,
  rawScene: unknown,
  expectedMode: "external" | "internal"
): void {
  const scene = hydrateMinimalScene(rawScene);
  let message = "";
  try {
    exportTikz(scene);
    fail(`${name}: expected export to fail closed`);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(
    message.includes(`near-degenerate ${expectedMode} tangency`),
    `${name}: expected near-degenerate ${expectedMode} classification, got: ${message}`
  );
  for (const token of ["d=", "r1=", "r2=", "extGap=", "intGap="]) {
    assert(message.includes(token), `${name}: missing diagnostic token ${token} in: ${message}`);
  }
}

const nearExternalFixture = {
  scene: {
    points: [
      { id: "p1", kind: "free", name: "O1", captionTex: "O1", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p2", kind: "free", name: "A1", captionTex: "A1", visible: true, showLabel: "name", position: { x: 3, y: 0 } },
      { id: "p3", kind: "free", name: "O2", captionTex: "O2", visible: true, showLabel: "name", position: { x: 5.0000005, y: 0 } },
      { id: "p4", kind: "free", name: "A2", captionTex: "A2", visible: true, showLabel: "name", position: { x: 7.0000005, y: 0 } },
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

const nearInternalFixture = {
  scene: {
    points: [
      { id: "p1", kind: "free", name: "O1", captionTex: "O1", visible: true, showLabel: "name", position: { x: 0, y: 0 } },
      { id: "p2", kind: "free", name: "A1", captionTex: "A1", visible: true, showLabel: "name", position: { x: 5, y: 0 } },
      { id: "p3", kind: "free", name: "O2", captionTex: "O2", visible: true, showLabel: "name", position: { x: 3.0000005, y: 0 } },
      { id: "p4", kind: "free", name: "A2", captionTex: "A2", visible: true, showLabel: "name", position: { x: 5.0000005, y: 0 } },
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

assertNearDegenerateExportFails(
  "tangent-circle-circle-near-degenerate-external",
  nearExternalFixture.scene,
  "external"
);
assertNearDegenerateExportFails(
  "tangent-circle-circle-near-degenerate-internal",
  nearInternalFixture.scene,
  "internal"
);

console.log("tangent-circle-circle near-degenerate export audit: OK");
