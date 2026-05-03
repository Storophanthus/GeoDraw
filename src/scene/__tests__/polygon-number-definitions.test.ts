import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import { collectCascadeDelete } from "../../domain/geometryGraph";
import { createInitialGeoState } from "../../state/slices";
import { getNumberValue, type SceneModel } from "../points";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const base = createInitialGeoState();

const scene: SceneModel = {
  ...base.scene,
  points: [
    {
      id: "pA",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: base.pointDefaults,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 4, y: 0 },
      style: base.pointDefaults,
    },
    {
      id: "pC",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: 4, y: 3 },
      style: base.pointDefaults,
    },
  ],
  polygons: [{ id: "poly_1", pointIds: ["pA", "pB", "pC"], visible: true, showLabel: false, style: base.polygonDefaults }],
  numbers: [
    { id: "n_perim", name: "Perim_1", visible: true, definition: { kind: "polygonPerimeter", polygonId: "poly_1" } },
    { id: "n_area", name: "Area_1", visible: true, definition: { kind: "polygonArea", polygonId: "poly_1" } },
    { id: "n_stale", name: "Area_2", visible: true, definition: { kind: "polygonArea", polygonId: "missing" } },
  ],
};

const perimeter = getNumberValue("n_perim", scene);
const area = getNumberValue("n_area", scene);

assert(perimeter !== null && Math.abs(perimeter - 12) < 1e-9, `Expected triangle perimeter 12, got ${perimeter}.`);
assert(area !== null && Math.abs(area - 6) < 1e-9, `Expected triangle area 6, got ${area}.`);

const normalized = normalizeSceneIntegrity(scene);
assert(normalized.numbers.some((num) => num.id === "n_perim"), "Valid polygon perimeter number should remain.");
assert(normalized.numbers.some((num) => num.id === "n_area"), "Valid polygon area number should remain.");
assert(!normalized.numbers.some((num) => num.id === "n_stale"), "Stale polygon number should be filtered.");

const deleted = collectCascadeDelete(scene, { type: "polygon", id: "poly_1" });
assert(deleted.has("number:n_perim"), "Deleting a polygon should cascade to its perimeter variable.");
assert(deleted.has("number:n_area"), "Deleting a polygon should cascade to its area variable.");

console.log("polygon-number-definitions: ok");
