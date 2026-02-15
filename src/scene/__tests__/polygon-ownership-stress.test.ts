import { commandBarApi, getGeoStore } from "../../state/geoStore";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function mustOk<T extends { ok: boolean }>(out: T, context: string): asserts out is T & { ok: true } {
  if (!out.ok) fail(`${context}: ${JSON.stringify(out)}`);
}

function edgeKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`;
}

function pointIdByName(name: string): string {
  const p = getGeoStore().scene.points.find((it) => it.name === name);
  if (!p) fail(`Missing point ${name}`);
  return p.id;
}

function aliasId(name: string): string {
  const alias = commandBarApi.getCommandObjectAliases()[name];
  if (!alias) fail(`Missing alias ${name}`);
  return alias.id;
}

function validatePolygonOwnershipInvariants(): void {
  const scene = getGeoStore().scene;
  const polygonIds = new Set(scene.polygons.map((p) => p.id));
  for (let i = 0; i < scene.segments.length; i += 1) {
    const seg = scene.segments[i];
    if (!Array.isArray(seg.ownedByPolygonIds)) continue;
    const dedup = new Set(seg.ownedByPolygonIds);
    assert(dedup.size === seg.ownedByPolygonIds.length, `duplicate polygon owners on segment ${seg.id}`);
    for (const owner of seg.ownedByPolygonIds) {
      assert(polygonIds.has(owner), `stale polygon owner ${owner} on segment ${seg.id}`);
    }
  }
}

const prefix = `PST_${Date.now()}`;
const names = ["A", "B", "C", "D", "E", "F"].map((s) => `${prefix}_${s}`);
const coords: Array<[number, number]> = [
  [0, 0],
  [5, 0],
  [7, 3],
  [2, 6],
  [-2, 4],
  [-3, 1],
];

for (let i = 0; i < names.length; i += 1) {
  mustOk(commandBarApi.setPointXY(names[i], coords[i][0], coords[i][1]), `set point ${names[i]}`);
}
const ids = names.map((n) => pointIdByName(n));
const [a, b, c, d, e, f] = ids;

mustOk(commandBarApi.applyObjectAssignment(`${prefix}_poly1`, { type: "CreatePolygonByPoints", pointIds: [a, b, c] }), "create poly1");
mustOk(commandBarApi.applyObjectAssignment(`${prefix}_poly2`, { type: "CreatePolygonByPoints", pointIds: [a, c, d] }), "create poly2");

const poly1Id = aliasId(`${prefix}_poly1`);
const poly2Id = aliasId(`${prefix}_poly2`);

{
  const shared = getGeoStore().scene.segments.find((s) => edgeKey(s.aId, s.bId) === edgeKey(a, c));
  assert(!!shared, "missing shared edge A-C");
  assert(Array.isArray(shared.ownedByPolygonIds), "shared edge missing polygon owners");
  const owners = new Set(shared.ownedByPolygonIds);
  assert(owners.has(poly1Id) && owners.has(poly2Id), "shared edge owner set mismatch");
}

const poly1Variants: string[][] = [
  [a, b, c],
  [a, c, e],
  [a, e, f],
  [a, f, b],
  [a, b, d],
  [a, d, c],
];

for (let i = 0; i < 120; i += 1) {
  const variant = poly1Variants[i % poly1Variants.length];
  mustOk(
    commandBarApi.applyObjectAssignment(`${prefix}_poly1`, {
      type: "CreatePolygonByPoints",
      pointIds: variant,
    }),
    `redefine poly1 #${i}`
  );
  validatePolygonOwnershipInvariants();
}

// Delete poly2 and verify ownership cleanup does not affect remaining polygon owners.
{
  const store = getGeoStore();
  store.setSelectedObject({ type: "polygon", id: poly2Id });
  store.deleteSelectedObject();
}
validatePolygonOwnershipInvariants();
{
  const hasPoly2Owner = getGeoStore().scene.segments.some(
    (s) => Array.isArray(s.ownedByPolygonIds) && s.ownedByPolygonIds.includes(poly2Id)
  );
  assert(!hasPoly2Owner, "stale ownership from deleted poly2");
}

// Delete poly1 and ensure no polygon-owned edges remain in this local subgraph.
{
  const store = getGeoStore();
  store.setSelectedObject({ type: "polygon", id: poly1Id });
  store.deleteSelectedObject();
}
validatePolygonOwnershipInvariants();
{
  const idSet = new Set(ids);
  const localOwned = getGeoStore().scene.segments.filter(
    (s) => idSet.has(s.aId) && idSet.has(s.bId) && Array.isArray(s.ownedByPolygonIds) && s.ownedByPolygonIds.length > 0
  );
  assert(localOwned.length === 0, "polygon-owned edges leaked after polygon deletes");
}

console.log("polygon-ownership-stress tests: OK");
