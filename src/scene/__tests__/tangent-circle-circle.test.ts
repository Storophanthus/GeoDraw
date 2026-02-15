import { getLineWorldAnchors, getCircleWorldGeometry } from "../points";
import { commandBarApi, getGeoStore } from "../../state/geoStore";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function findPointId(name: string): string {
  const point = getGeoStore().scene.points.find((p) => p.name === name);
  if (!point) fail(`Missing point ${name}`);
  return point.id;
}

if (!commandBarApi.setPointXY("O1", 0, 0).ok) fail("Failed to create O1");
if (!commandBarApi.setPointXY("R1", 2, 0).ok) fail("Failed to create R1");
if (!commandBarApi.setPointXY("O2", 8, 0).ok) fail("Failed to create O2");
if (!commandBarApi.setPointXY("R2", 9, 0).ok) fail("Failed to create R2");

const o1 = findPointId("O1");
const r1 = findPointId("R1");
const o2 = findPointId("O2");
const r2 = findPointId("R2");

const c1 = getGeoStore().createCircle(o1, r1);
const c2 = getGeoStore().createCircle(o2, r2);
if (!c1 || !c2) fail("Failed to create circles for tangent-circle-circle test");

const created = getGeoStore().createCircleTangentLines(c1, c2);
assert(created.length === 4, `Expected 4 common tangents for disjoint circles, got ${created.length}`);

const circleA = getGeoStore().scene.circles.find((c) => c.id === c1);
const circleB = getGeoStore().scene.circles.find((c) => c.id === c2);
if (!circleA || !circleB) fail("Circle lookup failed after tangent creation");
const geomA = getCircleWorldGeometry(circleA, getGeoStore().scene);
const geomB = getCircleWorldGeometry(circleB, getGeoStore().scene);
if (!geomA || !geomB) fail("Circle geometry unavailable after tangent creation");

for (let i = 0; i < created.length; i += 1) {
  const lineId = created[i];
  const line = getGeoStore().scene.lines.find((l) => l.id === lineId);
  assert(!!line && line.kind === "circleCircleTangent", `Expected ${lineId} to be circleCircleTangent`);
  const anchors = line ? getLineWorldAnchors(line, getGeoStore().scene) : null;
  if (!anchors) fail(`Missing anchors for line ${lineId}`);
  const dx = anchors.b.x - anchors.a.x;
  const dy = anchors.b.y - anchors.a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-12) fail(`Degenerate line anchors for ${lineId}`);
  const nx = -dy / len;
  const ny = dx / len;
  const dA = Math.abs((geomA.center.x - anchors.a.x) * nx + (geomA.center.y - anchors.a.y) * ny);
  const dB = Math.abs((geomB.center.x - anchors.a.x) * nx + (geomB.center.y - anchors.a.y) * ny);
  if (Math.abs(dA - geomA.radius) > 1e-6) fail(`Line ${lineId} is not tangent to circle A`);
  if (Math.abs(dB - geomB.radius) > 1e-6) fail(`Line ${lineId} is not tangent to circle B`);
}

console.log("tangent-circle-circle tests: OK");
