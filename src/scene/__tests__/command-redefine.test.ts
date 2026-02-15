import { commandBarApi, getGeoStore } from "../../state/geoStore";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function pointIdByName(name: string): string {
  const point = getGeoStore().scene.points.find((p) => p.name === name);
  if (!point) fail(`Missing point ${name}`);
  return point.id;
}

function aliasId(name: string): string {
  const alias = commandBarApi.getCommandObjectAliases()[name];
  if (!alias) fail(`Missing alias ${name}`);
  return alias.id;
}

function mustOk<T extends { ok: boolean }>(out: T, context: string): asserts out is T & { ok: true } {
  if (!out.ok) fail(`${context}: ${JSON.stringify(out)}`);
}

function edgeKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`;
}

// Base points
mustOk(commandBarApi.setPointXY("RA", 0, 0), "set RA");
mustOk(commandBarApi.setPointXY("RB", 4, 0), "set RB");
mustOk(commandBarApi.setPointXY("RC", 0, 3), "set RC");
mustOk(commandBarApi.setPointXY("RD", 2, 5), "set RD");

const a = pointIdByName("RA");
const b = pointIdByName("RB");
const c = pointIdByName("RC");
const d = pointIdByName("RD");

// line: create then update in-place
mustOk(commandBarApi.applyObjectAssignment("rl", { type: "CreateLineByPoints", aId: a, bId: b }), "create line");
const lineId = aliasId("rl");
mustOk(commandBarApi.applyObjectAssignment("rl", { type: "CreateLineByPoints", aId: b, bId: c }), "update line");
assert(aliasId("rl") === lineId, "line alias id changed on redefine");
{
  const line = getGeoStore().scene.lines.find((it) => it.id === lineId);
  assert(line?.kind === "twoPoint", "line kind mismatch after redefine");
  assert(line.aId === b && line.bId === c, "line endpoints not updated");
}

// segment: create then update in-place
mustOk(commandBarApi.applyObjectAssignment("rs", { type: "CreateSegmentByPoints", aId: a, bId: c }), "create segment");
const segId = aliasId("rs");
mustOk(commandBarApi.applyObjectAssignment("rs", { type: "CreateSegmentByPoints", aId: b, bId: d }), "update segment");
assert(aliasId("rs") === segId, "segment alias id changed on redefine");
{
  const seg = getGeoStore().scene.segments.find((it) => it.id === segId);
  assert(seg?.aId === b && seg.bId === d, "segment endpoints not updated");
}

// circle: create through-point then redefine to center-radius
mustOk(commandBarApi.applyObjectAssignment("rc", { type: "CreateCircleCenterThrough", centerId: a, throughId: b }), "create circle");
const circleId = aliasId("rc");
mustOk(
  commandBarApi.applyObjectAssignment("rc", { type: "CreateCircleCenterRadius", centerId: c, r: 2, rExpr: "2" }),
  "update circle"
);
assert(aliasId("rc") === circleId, "circle alias id changed on redefine");
{
  const circle = getGeoStore().scene.circles.find((it) => it.id === circleId);
  assert(circle?.kind === "fixedRadius", "circle kind mismatch after redefine");
  assert(circle.centerId === c && Math.abs(circle.radius - 2) < 1e-9, "circle center/radius not updated");
}

// polygon: create then update in-place
mustOk(commandBarApi.applyObjectAssignment("rp", { type: "CreatePolygonByPoints", pointIds: [a, b, c] }), "create polygon");
const polygonId = aliasId("rp");
mustOk(commandBarApi.applyObjectAssignment("rp", { type: "CreatePolygonByPoints", pointIds: [a, c, d] }), "update polygon");
assert(aliasId("rp") === polygonId, "polygon alias id changed on redefine");
{
  const polygon = getGeoStore().scene.polygons.find((it) => it.id === polygonId);
  assert(!!polygon, "missing polygon after redefine");
  assert(polygon.pointIds.join(",") === [a, c, d].join(","), "polygon point ids not updated");
}

// polygon ownership safety: redefine updates owned edge set deterministically
mustOk(commandBarApi.setPointXY("RE", -2, 1), "set RE");
const e = pointIdByName("RE");
mustOk(commandBarApi.applyObjectAssignment("rp2", { type: "CreatePolygonByPoints", pointIds: [a, b, c] }), "create polygon rp2");
const polygon2Id = aliasId("rp2");
mustOk(commandBarApi.applyObjectAssignment("rp2", { type: "CreatePolygonByPoints", pointIds: [a, c, e] }), "update polygon rp2");
{
  const ownedKeys = new Set(
    getGeoStore().scene.segments
      .filter((s) => Array.isArray(s.ownedByPolygonIds) && s.ownedByPolygonIds.includes(polygon2Id))
      .map((s) => edgeKey(s.aId, s.bId))
  );
  const expected = new Set([edgeKey(a, c), edgeKey(c, e), edgeKey(e, a)]);
  assert(ownedKeys.size === expected.size, "polygon owned edge count mismatch after redefine");
  for (const key of expected) assert(ownedKeys.has(key), `missing polygon-owned edge ${key}`);
}

// angle: create then update in-place
mustOk(commandBarApi.applyObjectAssignment("ra", { type: "CreateAngle", aId: a, bId: b, cId: c }), "create angle");
const angleId = aliasId("ra");
mustOk(commandBarApi.applyObjectAssignment("ra", { type: "CreateAngle", aId: d, bId: c, cId: b }), "update angle");
assert(aliasId("ra") === angleId, "angle alias id changed on redefine");
{
  const angle = getGeoStore().scene.angles.find((it) => it.id === angleId);
  assert(angle?.kind === "angle", "angle kind mismatch after redefine");
  assert(angle.aId === d && angle.bId === c && angle.cId === b, "angle points not updated");
}

// sector ownership: create sector alias should sprout radial owned segments.
mustOk(commandBarApi.applyObjectAssignment("rsct", { type: "CreateSector", centerId: a, startId: b, endId: c }), "create sector");
const sectorId = aliasId("rsct");
{
  const owned = getGeoStore().scene.segments.filter(
    (s) => Array.isArray(s.ownedBySectorIds) && s.ownedBySectorIds.includes(sectorId)
  );
  const ownedKeys = new Set(owned.map((s) => edgeKey(s.aId, s.bId)));
  const expected = new Set([edgeKey(a, b), edgeKey(a, c)]);
  assert(ownedKeys.size === 2, "sector should own exactly two radial segments");
  for (const key of expected) assert(ownedKeys.has(key), `missing sector-owned radial edge ${key}`);
}

// sector -> angle redefine should release sector-owned radial segments.
mustOk(commandBarApi.applyObjectAssignment("rsct", { type: "CreateAngle", aId: b, bId: a, cId: c }), "sector to angle");
{
  const stillOwned = getGeoStore().scene.segments.some(
    (s) => Array.isArray(s.ownedBySectorIds) && s.ownedBySectorIds.includes(sectorId)
  );
  assert(!stillOwned, "sector-owned radial edges were not released on sector->angle redefine");
}

// fail-closed: incompatible redefine must error and not mutate
const segBefore = getGeoStore().scene.segments.find((it) => it.id === segId);
const bad = commandBarApi.applyObjectAssignment("rs", { type: "CreateLineByPoints", aId: a, bId: b });
assert(!bad.ok, "incompatible redefine unexpectedly succeeded");
const segAfter = getGeoStore().scene.segments.find((it) => it.id === segId);
assert(JSON.stringify(segBefore) === JSON.stringify(segAfter), "segment mutated after failed redefine");

// stale alias safety: deleting aliased object then reassigning same alias should recreate, not fail.
{
  const store = getGeoStore();
  store.setSelectedObject({ type: "line", id: lineId });
  store.deleteSelectedObject();
}
assert(!getGeoStore().scene.lines.some((l) => l.id === lineId), "expected line to be deleted");
mustOk(commandBarApi.applyObjectAssignment("rl", { type: "CreateLineByPoints", aId: a, bId: d }), "recreate stale alias");
const recreatedLineId = aliasId("rl");
assert(recreatedLineId !== lineId, "stale alias did not remap to recreated object");

console.log("command-redefine tests: OK");
