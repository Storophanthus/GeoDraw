import fixture from "../../export/__fixtures__/incircle-hidden-center-label-hit.json";
import { commandBarApi, getGeoStore } from "../../state/geoStore";
import { takeHistorySnapshot } from "../../state/slices/historySlice";
import { getCircleWorldGeometry, getPointWorldPos, type SceneModel } from "../points";

function equal(actual: unknown, expected: unknown, message = "Values must match"): void {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function ok(condition: unknown): asserts condition {
  if (!condition) throw new Error("Expected a defined result");
}

function deepEqual(actual: unknown, expected: unknown): void {
  equal(JSON.stringify(actual), JSON.stringify(expected));
}

getGeoStore().loadSnapshot({
  ...takeHistorySnapshot(getGeoStore()),
  scene: structuredClone(fixture.scene) as SceneModel,
  nextPointId: 13,
  nextCircleId: 2,
});

function point(id: string) {
  const result = getGeoStore().scene.points.find((item) => item.id === id);
  ok(result);
  return result;
}

const count = getGeoStore().scene.points.length;
equal(point("p_4").visible, false);
equal(getGeoStore().createCircleCenterPoint("c_1"), "p_4");
equal(point("p_4").visible, true, "Midpoint must reveal the incircle's hidden center");
equal(point("p_4").showLabel, getGeoStore().objectLabelDefaults.point);
equal(getGeoStore().scene.points.length, count, "Reuse the actual center identity, even when I coincides");
equal(point("p_4").kind, "triangleCenter");
equal(point("p_4").locked, true);
deepEqual(getGeoStore().selectedObject, { type: "point", id: "p_4" });

getGeoStore().undo();
equal(point("p_4").visible, false, "Revealing the center must be undoable");
equal(point("p_4").showLabel, "none");
getGeoStore().redo();
equal(point("p_4").visible, true);
getGeoStore().movePointTo("p_3", { x: 2, y: 7 });
const scene = getGeoStore().scene;
const circle = scene.circles.find((item) => item.id === "c_1")!;
deepEqual(getPointWorldPos(point("p_4"), scene), getCircleWorldGeometry(circle, scene)?.center);

// A freshly executed Incircle command must have the same tool behavior.
const commandCircleId = commandBarApi.createIncircle("p_1", "p_2", "p_3");
ok(commandCircleId);
const commandCircle = getGeoStore().scene.circles.find((item) => item.id === commandCircleId)!;
if (commandCircle.kind === "threePoint") throw new Error("Expected a center-based circle");
equal(point(commandCircle.centerId).visible, false);
equal(getGeoStore().createCircleCenterPoint(commandCircleId), commandCircle.centerId);
equal(point(commandCircle.centerId).visible, true);

// Hidden centers of ordinary and three-point circles are also reusable.
const ordinaryId = getGeoStore().createCircle("p_1", "p_2")!;
getGeoStore().setObjectVisibility({ type: "point", id: "p_1" }, false);
equal(getGeoStore().createCircleCenterPoint(ordinaryId), "p_1");
equal(point("p_1").visible, true);
const threePointId = getGeoStore().createCircleThreePoint("p_1", "p_2", "p_3")!;
const centerId = getGeoStore().createCircleCenterPoint(threePointId)!;
getGeoStore().setObjectVisibility({ type: "point", id: centerId }, false);
equal(getGeoStore().createCircleCenterPoint(threePointId), centerId);
equal(point(centerId).visible, true);

getGeoStore().updatePointFieldsByIds([centerId], { showLabel: "none" });
const beforeReselect = getGeoStore().scene;
equal(getGeoStore().createCircleCenterPoint(threePointId), centerId);
equal(point(centerId).showLabel, "none", "An already visible center keeps its chosen label mode");
equal(getGeoStore().scene, beforeReselect, "Selecting a visible center should not mutate the scene");
equal(getGeoStore().createCircleCenterPoint("missing-circle"), null);

console.log("circle-center-visibility: ok");
