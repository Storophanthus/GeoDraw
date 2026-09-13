import fixture from "../../export/__fixtures__/circle-radius-edit.json";
import { getGeoStore } from "../../state/geoStore";
import { takeHistorySnapshot } from "../../state/slices/historySlice";
import { getCircleWorldGeometry, getPointWorldPos, type SceneModel } from "../points";

const assert = {
  equal(actual: unknown, expected: unknown, message = "Values differ") {
    if (actual !== expected) throw new Error(message);
  },
  deepEqual(actual: unknown, expected: unknown, message = "Values differ") {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
  },
  notDeepEqual(actual: unknown, expected: unknown, message: string) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error(message);
  },
};

const store = getGeoStore();
store.loadSnapshot({ ...takeHistorySnapshot(store), scene: fixture.scene as SceneModel });
const circle = () => getGeoStore().scene.circles.find(c => c.id === fixture.circleId)!;
const intersection = () => getGeoStore().scene.points.find(p => p.id === fixture.intersectionId)!;
const position = () => getPointWorldPos(intersection(), getGeoStore().scene);
const before = takeHistorySnapshot(getGeoStore());
const previousPosition = position();
const originalCircle = circle();
const originalIntersection = intersection();

assert.deepEqual(store.updateCircleRadius(fixture.circleId, " Distance(A,D) "), { ok: true });
assert.equal(circle().id, originalCircle.id);
assert.deepEqual({ ...circle(), radius: undefined, radiusExpr: undefined },
  { ...originalCircle, radius: undefined, radiusExpr: undefined }, "Keep style, visibility, labels, and center");
assert.deepEqual(intersection(), originalIntersection, "Keep intersection identity and branch metadata");
assert.notDeepEqual(position(), previousPosition, "The existing E must move");
assert.equal(getCircleWorldGeometry(circle(), getGeoStore().scene)?.radius, 3);
const applied = takeHistorySnapshot(getGeoStore());
store.undo();
assert.deepEqual(takeHistorySnapshot(getGeoStore()), before);
store.redo();
assert.deepEqual(takeHistorySnapshot(getGeoStore()), applied);

for (const expr of ["", "0", "-2", "1/0", "Distance(A,Missing)", "Distance(C,E)", `Radius(${fixture.circleId})`]) {
  const snapshot = takeHistorySnapshot(getGeoStore());
  assert.equal(store.updateCircleRadius(fixture.circleId, expr).ok, false, `Reject invalid/cyclic expression: ${expr}`);
  assert.deepEqual(takeHistorySnapshot(getGeoStore()), snapshot, "A rejected edit must not mutate the diagram");
}
const d = getGeoStore().scene.points.find(p => p.name === "D")!;
store.movePointTo(d.id, { x: -4, y: 0 });
assert.equal(getCircleWorldGeometry(circle(), getGeoStore().scene)?.radius, 4, "Keep the new expression live");
store.loadSnapshot(takeHistorySnapshot(getGeoStore()));
assert.equal(getCircleWorldGeometry(circle(), getGeoStore().scene)?.radius, 4, "Expression survives reload");
console.log("circle-radius-edit tests: OK");
