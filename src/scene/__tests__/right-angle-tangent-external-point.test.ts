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
      id: "p_b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 0, y: 0 },
      style: { ...base.pointDefaults },
    },
    {
      id: "p_c",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 10, y: 0 },
      style: { ...base.pointDefaults },
    },
    {
      id: "p_m",
      kind: "free",
      name: "M",
      captionTex: "M",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 5, y: 0 },
      style: { ...base.pointDefaults },
    },
    {
      id: "p_y",
      kind: "free",
      name: "Y",
      captionTex: "Y",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 10, y: 4.25 },
      style: { ...base.pointDefaults },
    },
    {
      id: "p_x",
      kind: "free",
      name: "X",
      captionTex: "X",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 0, y: 3.1 },
      style: { ...base.pointDefaults },
    },
  ],
  vectors: [],
  numbers: [],
  segments: [],
  lines: [
    {
      id: "l_y",
      kind: "tangent",
      throughId: "p_y",
      circleId: "c_1",
      branchIndex: 1,
      visible: false,
      showLabel: false,
      style: { ...base.lineDefaults },
    },
    {
      id: "l_x",
      kind: "tangent",
      throughId: "p_x",
      circleId: "c_1",
      branchIndex: 0,
      visible: false,
      showLabel: false,
      style: { ...base.lineDefaults },
    },
  ],
  circles: [
    {
      id: "c_1",
      kind: "twoPoint",
      centerId: "p_m",
      throughId: "p_c",
      visible: false,
      showLabel: false,
      style: { ...base.circleDefaults },
    },
  ],
  polygons: [],
  angles: [
    {
      id: "a_myc",
      aId: "p_m",
      bId: "p_y",
      cId: "p_c",
      isRightExact: true,
      visible: true,
      style: { ...base.angleDefaults },
    },
    {
      id: "a_bxm",
      aId: "p_b",
      bId: "p_x",
      cId: "p_m",
      isRightExact: true,
      visible: true,
      style: { ...base.angleDefaults },
    },
  ],
  textLabels: [],
};

rebuildRightAngleProvenance(scene);

for (const angle of scene.angles) {
  const status = resolveAngleRightStatus(scene, angle);
  assert(status === "none", `Expected non-right status for ${angle.id}, got "${status}".`);
}

console.log("right-angle-tangent-external-point: ok");
