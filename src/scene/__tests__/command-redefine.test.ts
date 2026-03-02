import { commandBarApi, getGeoStore } from "../../state/geoStore";
import { parseCommandInput, type ParseContext, type Symbol } from "../../CommandParser";
import { getPointWorldPos } from "../../scene/points";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function approxEqual(a: number, b: number, eps = 1e-8): boolean {
  return Math.abs(a - b) <= eps;
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

function assertPointLabel(pointId: string, expected: string, context: string): void {
  const point = getGeoStore().scene.points.find((p) => p.id === pointId);
  if (!point) fail(`${context}: missing point ${pointId}`);
  if (point.name !== expected) fail(`${context}: expected point.name=${expected}, got ${point.name}`);
  if (point.captionTex !== expected) fail(`${context}: expected point.captionTex=${expected}, got ${point.captionTex}`);
}

function pointWorld(pointId: string): { x: number; y: number } {
  const store = getGeoStore();
  const point = store.scene.points.find((p) => p.id === pointId);
  if (!point) fail(`Missing point ${pointId}`);
  const world = getPointWorldPos(point, store.scene);
  if (!world) fail(`Point ${pointId} is undefined`);
  return world;
}

function buildParseContext(): ParseContext {
  const scene = getGeoStore().scene;
  const symbolsByLabel = new Map<string, Symbol[]>();
  const add = (symbol: Symbol) => {
    const list = symbolsByLabel.get(symbol.label);
    if (!list) symbolsByLabel.set(symbol.label, [symbol]);
    else list.push(symbol);
  };
  for (let i = 0; i < scene.points.length; i += 1) {
    const p = scene.points[i];
    add({ kind: "point", id: p.id, label: p.name });
  }
  for (let i = 0; i < scene.numbers.length; i += 1) {
    const n = scene.numbers[i];
    add({ kind: "other", id: n.id, label: n.name, type: "number" });
  }
  const pointWorldById = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < scene.points.length; i += 1) {
    const p = scene.points[i];
    const w = getPointWorldPos(p, scene);
    if (w) pointWorldById.set(p.id, w);
  }
  return {
    symbolsByLabel,
    pointWorldById,
    scalarsByName: new Map(Object.entries(commandBarApi.getScalarVars())),
    objectAliases: new Map(Object.entries(commandBarApi.getCommandObjectAliases())),
    objectNames: new Set(Object.keys(commandBarApi.getCommandObjectAliases())),
  };
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

// point alias: create then redefine in-place
mustOk(commandBarApi.applyObjectAssignment("rpt", { type: "CreatePointXY", x: 1, y: 2 }), "create point alias");
const pointAlias = getGeoStore().scene.points.find((p) => p.name === "rpt");
assert(!!pointAlias, "missing named point after point assignment create");
const pointAliasId = pointAlias.id;
assertPointLabel(pointAliasId, "rpt", "create point alias");
mustOk(commandBarApi.applyObjectAssignment("rpt", { type: "CreatePointXY", x: 3, y: 4 }), "update point alias");
const pointAliasAfter = getGeoStore().scene.points.find((p) => p.name === "rpt");
assert(!!pointAliasAfter && pointAliasAfter.id === pointAliasId, "point id changed on redefine");
assertPointLabel(pointAliasId, "rpt", "update point alias");
{
  const p = getGeoStore().scene.points.find((it) => it.id === pointAliasId);
  assert(!!p && p.kind === "free", "point alias target missing after redefine");
  assert(Math.abs(p.position.x - 3) < 1e-9 && Math.abs(p.position.y - 4) < 1e-9, "point alias position not updated");
}

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

// fail-closed: non-free point alias cannot be redefined
mustOk(commandBarApi.applyObjectAssignment("rMid", { type: "CreateMidpointByPoints", aId: a, bId: b }), "create midpoint alias");
const midId = aliasId("rMid");
assertPointLabel(midId, "rMid", "create midpoint alias");
const midBefore = getGeoStore().scene.points.find((it) => it.id === midId);
const badPoint = commandBarApi.applyObjectAssignment("rMid", { type: "CreatePointXY", x: -9, y: -9 });
assert(!badPoint.ok, "non-free point redefine unexpectedly succeeded");
const midAfter = getGeoStore().scene.points.find((it) => it.id === midId);
assert(JSON.stringify(midBefore) === JSON.stringify(midAfter), "non-free point mutated after failed redefine");

mustOk(commandBarApi.applyObjectAssignment("rMidSeg", { type: "CreateMidpointBySegment", segId }), "create midpoint-by-segment alias");
const midSegId = aliasId("rMidSeg");
assertPointLabel(midSegId, "rMidSeg", "create midpoint-by-segment alias");

// parser+assignment integration: assignment label must override midpoint auto-name
mustOk(commandBarApi.setPointXY("A", -5, 0), "set A for parser integration");
mustOk(commandBarApi.setPointXY("X", 5, 0), "set X for parser integration");
{
  const parsed = parseCommandInput("M=Midpoint(X,A)", buildParseContext());
  if (parsed.kind !== "assignObject") fail(`unexpected parse kind: ${parsed.kind}`);
  mustOk(commandBarApi.applyObjectAssignment(parsed.name, parsed.cmd), "apply parsed midpoint assignment");
}
assertPointLabel(aliasId("M"), "M", "parser midpoint assignment label");

// parser+assignment integration: transform assignments must create constrained points with assigned labels
mustOk(commandBarApi.setPointXY("TA", -2, 1), "set TA");
mustOk(commandBarApi.setPointXY("TB", 1, 2), "set TB");
mustOk(commandBarApi.setPointXY("TC", 3, -1), "set TC");
const ta = pointIdByName("TA");
const tb = pointIdByName("TB");
const tc = pointIdByName("TC");
const vectorsBeforeTranslate = (getGeoStore().scene.vectors ?? []).length;
mustOk(commandBarApi.applyObjectAssignment("tAxis", { type: "CreateLineByPoints", aId: tb, bId: tc }), "create tAxis");

{
  const parsed = parseCommandInput("TT = Translate(TA,TB,TC)", buildParseContext());
  if (parsed.kind !== "assignObject") fail(`unexpected parse kind for translate: ${parsed.kind}`);
  mustOk(commandBarApi.applyObjectAssignment(parsed.name, parsed.cmd), "apply translate assignment");
}
{
  const id = aliasId("TT");
  assertPointLabel(id, "TT", "translate assignment label");
  const point = getGeoStore().scene.points.find((p) => p.id === id);
  assert(!!point && point.kind === "pointByTranslation", "translate assignment did not create constrained translation point");
  assert(typeof point.vectorId === "string" && point.vectorId.length > 0, "translate assignment should bind to vectorId");
  const vector = (getGeoStore().scene.vectors ?? []).find((item) => item.id === point.vectorId);
  assert(!!vector, "missing translation vector object");
  assert(
    vector?.kind === "vectorFromPoints" && vector.fromId === tb && vector.toId === tc,
    "translation vector endpoints mismatch"
  );
  const wBase = pointWorld(ta);
  const wFrom = pointWorld(tb);
  const wTo = pointWorld(tc);
  const wOut = pointWorld(id);
  const expected = { x: wBase.x + (wTo.x - wFrom.x), y: wBase.y + (wTo.y - wFrom.y) };
  assert(approxEqual(wOut.x, expected.x) && approxEqual(wOut.y, expected.y), "translate point world mismatch");
}

mustOk(commandBarApi.applyObjectAssignment("TT2", { type: "CreatePointByTranslation", pointId: ta, fromId: tb, toId: tc }), "apply second translate assignment");
{
  const id = aliasId("TT");
  const id2 = aliasId("TT2");
  const p1 = getGeoStore().scene.points.find((p) => p.id === id);
  const p2 = getGeoStore().scene.points.find((p) => p.id === id2);
  assert(!!p1 && p1.kind === "pointByTranslation", "TT should remain pointByTranslation");
  assert(!!p2 && p2.kind === "pointByTranslation", "TT2 should be pointByTranslation");
  assert(typeof p1.vectorId === "string" && p1.vectorId.length > 0, "TT missing vectorId");
  assert(typeof p2.vectorId === "string" && p2.vectorId.length > 0, "TT2 missing vectorId");
  assert(p1.vectorId === p2.vectorId, "translation points should reuse identical vectorFromPoints");
  assert(
    (getGeoStore().scene.vectors ?? []).length === vectorsBeforeTranslate + 1,
    "same from/to translation should not duplicate vectors"
  );
}

{
  const parsed = parseCommandInput("TR = Rotate(TA,TB,90)", buildParseContext());
  if (parsed.kind !== "assignObject") fail(`unexpected parse kind for rotate: ${parsed.kind}`);
  mustOk(commandBarApi.applyObjectAssignment(parsed.name, parsed.cmd), "apply rotate assignment");
}
{
  const id = aliasId("TR");
  assertPointLabel(id, "TR", "rotate assignment label");
  const point = getGeoStore().scene.points.find((p) => p.id === id);
  assert(!!point && point.kind === "pointByRotation", "rotate assignment did not create constrained rotation point");
}

{
  const parsed = parseCommandInput("TD = Dilate(TA,TB,2)", buildParseContext());
  if (parsed.kind !== "assignObject") fail(`unexpected parse kind for dilate: ${parsed.kind}`);
  mustOk(commandBarApi.applyObjectAssignment(parsed.name, parsed.cmd), "apply dilate assignment");
}
{
  const id = aliasId("TD");
  assertPointLabel(id, "TD", "dilate assignment label");
  const point = getGeoStore().scene.points.find((p) => p.id === id);
  assert(!!point && point.kind === "pointByDilation", "dilate assignment did not create constrained dilation point");
}

{
  const parsed = parseCommandInput("TF = Reflect(TA,tAxis)", buildParseContext());
  if (parsed.kind !== "assignObject") fail(`unexpected parse kind for reflect: ${parsed.kind}`);
  mustOk(commandBarApi.applyObjectAssignment(parsed.name, parsed.cmd), "apply reflect assignment");
}
{
  const id = aliasId("TF");
  assertPointLabel(id, "TF", "reflect assignment label");
  const point = getGeoStore().scene.points.find((p) => p.id === id);
  assert(!!point && point.kind === "pointByReflection", "reflect assignment did not create constrained reflection point");
}
{
  const parsed = parseCommandInput("TF2 = Reflect(TA,TB)", buildParseContext());
  if (parsed.kind !== "assignObject") fail(`unexpected parse kind for point-reflect: ${parsed.kind}`);
  mustOk(commandBarApi.applyObjectAssignment(parsed.name, parsed.cmd), "apply point reflect assignment");
}
{
  const id = aliasId("TF2");
  assertPointLabel(id, "TF2", "point reflect assignment label");
  const point = getGeoStore().scene.points.find((p) => p.id === id);
  assert(!!point && point.kind === "pointByReflection", "point reflect assignment did not create constrained reflection point");
  assert(point.axis.type === "point" && point.axis.id === tb, "point reflect assignment target mismatch");
}

// constrained regression: transformed points must move with dependencies
{
  const store = getGeoStore();
  store.movePointTo(tc, { x: 6, y: 1 });
  const tId = aliasId("TT");
  const wBase = pointWorld(ta);
  const wFrom = pointWorld(tb);
  const wTo = pointWorld(tc);
  const wOut = pointWorld(tId);
  const expected = { x: wBase.x + (wTo.x - wFrom.x), y: wBase.y + (wTo.y - wFrom.y) };
  assert(approxEqual(wOut.x, expected.x) && approxEqual(wOut.y, expected.y), "translated point did not stay constrained");
}
{
  const store = getGeoStore();
  store.movePointTo(tb, { x: 5, y: -2 });
  const reflectedId = aliasId("TF2");
  const base = pointWorld(ta);
  const center = pointWorld(tb);
  const reflected = pointWorld(reflectedId);
  const expected = { x: 2 * center.x - base.x, y: 2 * center.y - base.y };
  assert(approxEqual(reflected.x, expected.x) && approxEqual(reflected.y, expected.y), "point-centered reflected point did not stay constrained");
}

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
