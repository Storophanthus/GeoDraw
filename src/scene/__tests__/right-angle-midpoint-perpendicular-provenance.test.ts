import { resolveAngleRightStatus, rebuildRightAngleProvenance } from "../../domain/rightAngleProvenance";
import type { SceneModel } from "../points";
import { createInitialGeoState } from "../../state/slices";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const base = createInitialGeoState();

const scene: SceneModel = {
  points: [
    {
      id: "p_a",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 0, y: 0 },
      style: { ...base.pointDefaults },
    },
    {
      id: "p_b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 4, y: 0 },
      style: { ...base.pointDefaults },
    },
    {
      id: "p_v",
      kind: "midpointPoints",
      name: "V",
      captionTex: "V",
      visible: true,
      showLabel: "name",
      locked: true,
      auxiliary: true,
      aId: "p_a",
      bId: "p_b",
      style: { ...base.pointDefaults },
    },
    {
      id: "p_c",
      kind: "circleLineIntersectionPoint",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      locked: true,
      auxiliary: true,
      circleId: "c_v",
      lineId: "l_perp",
      branchIndex: 0,
      style: { ...base.pointDefaults },
    },
  ],
  vectors: [],
  numbers: [],
  segments: [
    {
      id: "s_base",
      aId: "p_a",
      bId: "p_b",
      visible: true,
      showLabel: false,
      style: { ...base.segmentDefaults },
    },
  ],
  lines: [
    {
      id: "l_perp",
      kind: "perpendicular",
      throughId: "p_v",
      base: { type: "segment", id: "s_base" },
      visible: false,
      showLabel: false,
      style: { ...base.lineDefaults },
    },
  ],
  circles: [
    {
      id: "c_v",
      kind: "twoPoint",
      centerId: "p_v",
      throughId: "p_b",
      visible: false,
      showLabel: false,
      style: { ...base.circleDefaults },
    },
  ],
  polygons: [],
  angles: [
    {
      id: "a_1",
      aId: "p_c",
      bId: "p_v",
      cId: "p_b",
      isRightExact: false,
      visible: true,
      style: { ...base.angleDefaults },
    },
    {
      id: "a_2",
      aId: "p_a",
      bId: "p_v",
      cId: "p_c",
      isRightExact: false,
      visible: true,
      style: { ...base.angleDefaults },
    },
  ],
  textLabels: [],
};

rebuildRightAngleProvenance(scene);

for (const angle of scene.angles) {
  const status = resolveAngleRightStatus(scene, angle);
  assert(
    status === "exact",
    `Expected exact right angle for ${angle.id}, got "${status}".`
  );
}

console.log("right-angle-midpoint-perpendicular-provenance: ok");
