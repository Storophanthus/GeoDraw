import { parseCommandInput, type ParseContext, type Symbol } from "../../CommandParser";
import { exportTikz } from "../../export/tikz";
import { captureGeoDocumentRuntimeState, commandBarApi, getGeoStore } from "../../state/geoStore";
import { getPointWorldPos } from "../points";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function approx(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) <= 1e-9, `${message} (expected ${expected}, got ${actual})`);
}

function mustOk<T extends { ok: boolean }>(result: T, message: string): asserts result is T & { ok: true } {
  assert(result.ok, `${message}: ${"error" in result ? String(result.error) : "failed"}`);
}

function pointId(name: string): string {
  const point = getGeoStore().scene.points.find((item) => item.name === name);
  assert(!!point, `Point ${name} should exist`);
  return point!.id;
}

function pointX(name: string): number {
  const scene = getGeoStore().scene;
  const point = scene.points.find((item) => item.name === name);
  assert(!!point, `Point ${name} should exist`);
  const world = getPointWorldPos(point!, scene);
  assert(!!world, `Point ${name} should evaluate`);
  return world!.x;
}

function buildContext(): ParseContext {
  const scene = getGeoStore().scene;
  const symbolsByLabel = new Map<string, Symbol[]>();
  const pointWorldById = new Map<string, { x: number; y: number }>();
  for (const point of scene.points) {
    symbolsByLabel.set(point.name, [{ kind: "point", id: point.id, label: point.name }]);
    const world = getPointWorldPos(point, scene);
    if (world) pointWorldById.set(point.id, world);
  }
  const aliases = commandBarApi.getCommandObjectAliases();
  return {
    symbolsByLabel,
    pointWorldById,
    scalarsByName: new Map(Object.entries(commandBarApi.getScalarVars())),
    objectAliases: new Map(Object.entries(aliases)),
    objectNames: new Set(Object.keys(aliases)),
    transformationMaps: new Map(Object.entries(commandBarApi.getTransformationMaps())),
  };
}

function defineMap(input: string): void {
  const parsed = parseCommandInput(input, buildContext());
  assert(parsed.kind === "assignTransformationMap", `${input} should define a map, got ${JSON.stringify(parsed)}`);
  if (parsed.kind !== "assignTransformationMap") return;
  mustOk(commandBarApi.setTransformationMap(parsed.name, parsed.definition), `Define ${parsed.name}`);
}

function constructAssignedPoint(input: string): string {
  const parsed = parseCommandInput(input, buildContext());
  assert(parsed.kind === "assignObject", `${input} should construct an assigned point, got ${JSON.stringify(parsed)}`);
  if (parsed.kind !== "assignObject") return "";
  const applied = commandBarApi.applyObjectAssignment(parsed.name, parsed.cmd);
  mustOk(applied, `Apply ${input}`);
  assert(applied.objectType === "point", `${input} should create a point`);
  return applied.id;
}

mustOk(commandBarApi.setPointXY("InvO", 0, 0), "Create inversion center");
mustOk(commandBarApi.setPointXY("Unit", 1, 0), "Create unit point");
mustOk(commandBarApi.setPointXY("HomO", 1, 0), "Create homothety center");
mustOk(commandBarApi.setPointXY("MapA", 3, 0), "Create source point");

const circleResult = commandBarApi.applyObjectAssignment("invCircle", {
  type: "CreateCircleCenterThrough",
  centerId: pointId("InvO"),
  throughId: pointId("Unit"),
});
mustOk(circleResult, "Create inversion circle");

defineMap("f = Homothety(HomO,2)");
defineMap("g = Inversion(invCircle)");
defineMap("h = Compose(f,g)");
defineMap("hInv = Inverse(h)");

const capturedMaps = new Map(captureGeoDocumentRuntimeState().transformationMaps);
assert(capturedMaps.has("f") && capturedMaps.has("g") && capturedMaps.has("h"), "Named maps should persist with the active document runtime");

const imageId = constructAssignedPoint("Image = h(MapA)");
approx(pointX("Image"), -1 / 3, "Compose(f,g) should apply inversion first and homothety second");

const sceneAfterImage = getGeoStore().scene;
const imagePoint = sceneAfterImage.points.find((point) => point.id === imageId)!;
assert(imagePoint.kind === "pointByDilation", "The final composed step should remain a live homothety node");
const helperPoint = sceneAfterImage.points.find(
  (point) => point.id === imagePoint.pointId
);
assert(helperPoint?.visible === false && helperPoint.auxiliary === true, "The composed intermediate point should be hidden and auxiliary");

getGeoStore().movePointTo(pointId("MapA"), { x: 4, y: 0 });
approx(pointX("Image"), -0.5, "A composed image should update when its source moves");

constructAssignedPoint("InverseImage = hInv(MapA)");
approx(pointX("InverseImage"), 0.4, "Inverse(h) should reverse and invert the primitive maps");

constructAssignedPoint("DirectInverse = Inversion(MapA,invCircle)");
approx(pointX("DirectInverse"), 0.25, "The direct Inversion(P,c) command should construct a live inverse point");

const nameConflict = commandBarApi.setScalarVar("f", 3);
assert(!nameConflict.ok, "A named map should reserve its name against scalar assignments");

const tikz = exportTikz(getGeoStore().scene);
assert(tikz.includes("\\tkzGetPoint{Image}"), "A composed map image should export through existing transformation constructions");
assert(tikz.includes("\\tkzGetPoint{DirectInverse}"), "A direct inversion image should export through its live dilation construction");

console.log("command-transformation-maps tests: OK");
