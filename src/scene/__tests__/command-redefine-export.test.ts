import { exportTikz } from "../../export/tikz";
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

function pointId(name: string): string {
  const p = getGeoStore().scene.points.find((it) => it.name === name);
  if (!p) fail(`Missing point ${name}`);
  return p.id;
}

// deterministic base points
mustOk(commandBarApi.setPointXY("X_A", 0, 0), "set X_A");
mustOk(commandBarApi.setPointXY("X_B", 4, 0), "set X_B");
mustOk(commandBarApi.setPointXY("X_C", 0, 3), "set X_C");
mustOk(commandBarApi.setPointXY("X_D", 2, 5), "set X_D");

const a = pointId("X_A");
const b = pointId("X_B");
const c = pointId("X_C");
const d = pointId("X_D");

// alias create + redefine
mustOk(commandBarApi.applyObjectAssignment("polyX", { type: "CreatePolygonByPoints", pointIds: [a, b, c] }), "create polyX");
mustOk(commandBarApi.applyObjectAssignment("polyX", { type: "CreatePolygonByPoints", pointIds: [a, c, d] }), "redefine polyX");

mustOk(commandBarApi.applyObjectAssignment("circX", { type: "CreateCircleCenterThrough", centerId: a, throughId: b }), "create circX");
mustOk(commandBarApi.applyObjectAssignment("circX", { type: "CreateCircleCenterRadius", centerId: c, r: 2, rExpr: "2" }), "redefine circX");

mustOk(commandBarApi.applyObjectAssignment("lineX", { type: "CreateLineByPoints", aId: a, bId: b }), "create lineX");
mustOk(commandBarApi.applyObjectAssignment("lineX", { type: "CreateLineByPoints", aId: b, bId: d }), "redefine lineX");

// angle alias redefine: angle -> sector should export as sector drawing, not angle mark.
mustOk(commandBarApi.applyObjectAssignment("angX", { type: "CreateAngle", aId: b, bId: a, cId: c }), "create angX");
mustOk(commandBarApi.applyObjectAssignment("angX", { type: "CreateSector", centerId: a, startId: b, endId: d }), "redefine angX");

const tikz = exportTikz(getGeoStore().scene);

// Polygon should use redefined vertex sequence X_A -> X_C -> X_D
assert(/\(X_A\)\s*--\s*\(X_C\)\s*--\s*\(X_D\)\s*--\s*cycle;/.test(tikz), "Expected redefined polygon path in export");
assert(!/\(X_A\)\s*--\s*\(X_B\)\s*--\s*\(X_C\)\s*--\s*cycle;/.test(tikz), "Found stale pre-redefine polygon path in export");

// Circle should export as fixed-radius from center X_C with radius 2
assert(/\\tkzDefCircle\[R\]\(X_C,2\)/.test(tikz), "Expected redefined fixed-radius circle in export");

// Redefined angle alias should export as sector
assert(/\\tkzDrawSector/.test(tikz), "Expected redefined sector alias to emit \\\\tkzDrawSector");
assert(!/\\tkzMarkAngle/.test(tikz), "Did not expect angle mark export after angle->sector redefine");

console.log("command-redefine-export tests: OK");
