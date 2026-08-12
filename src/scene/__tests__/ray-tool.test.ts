import { clipRayToRect, pointWithinRayDomain, projectPointToRay } from "../../geo/geometry";
import { getGeoStore } from "../../state/geoStore";
import { getPointWorldPos } from "../points";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function close(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 1e-8) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function worldOf(pointId: string): { x: number; y: number } | null {
  const scene = getGeoStore().scene;
  const point = scene.points.find((item) => item.id === pointId);
  return point ? getPointWorldPos(point, scene) : null;
}

const projectedBehind = projectPointToRay({ x: -3, y: 2 }, { x: 0, y: 0 }, { x: 1, y: 0 });
close(projectedBehind.point.x, 0, "A point behind a ray must project to its origin");
close(projectedBehind.point.y, 0, "A point behind a ray must project to its origin");
assert(!pointWithinRayDomain({ x: -0.1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), "Backward support-line points must be outside the ray domain.");
assert(pointWithinRayDomain({ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), "Forward points must remain in the ray domain.");

const clipped = clipRayToRect(
  { x: -2, y: 0 },
  { x: -1, y: 0 },
  { xmin: 0, xmax: 5, ymin: -2, ymax: 2 }
);
assert(clipped, "A ray entering the viewport must have a visible clipped span.");
close(clipped.a.x, 0, "Ray clipping must begin at the viewport entry point");
close(clipped.b.x, 5, "Ray clipping must end at the forward viewport edge");
assert(
  clipRayToRect({ x: -2, y: 0 }, { x: -3, y: 0 }, { xmin: 0, xmax: 5, ymin: -2, ymax: 2 }) === null,
  "A ray pointing away from the viewport must remain invisible."
);

const store = getGeoStore();
const originId = store.createFreePoint({ x: 0, y: 0 });
const throughId = store.createFreePoint({ x: 1, y: 0 });
const rayId = store.createRay(originId, throughId);
assert(rayId, "Expected a ray to be created from two distinct points.");
const ray = getGeoStore().scene.lines.find((line) => line.id === rayId);
assert(ray?.kind === "ray" && ray.aId === originId && ray.bId === throughId, "Ray identity and direction must be stored explicitly.");

const constrainedId = store.createPointOnLine(rayId, -4);
assert(constrainedId, "Expected a constrained point on the ray.");
let constrainedWorld = worldOf(constrainedId);
assert(constrainedWorld, "Expected constrained ray point geometry.");
close(constrainedWorld.x, 0, "Negative ray parameters must clamp to the origin");
close(constrainedWorld.y, 0, "Negative ray parameters must clamp to the origin");

const circleCenterId = store.createFreePoint({ x: 1, y: 0 });
const circleThroughId = originId;
const circleId = store.createCircle(circleCenterId, circleThroughId);
assert(circleId, "Expected a circle through the ray origin.");
const otherRootId = store.createIntersectionPoint(
  { type: "line", id: rayId },
  { type: "circle", id: circleId },
  { x: 2, y: 0 }
);
assert(otherRootId, "Expected the forward ray-circle intersection.");
const otherRootPoint = getGeoStore().scene.points.find((point) => point.id === otherRootId);
assert(otherRootPoint?.kind === "circleLineIntersectionPoint", "Expected stable ray-circle intersection metadata.");
assert(otherRootPoint.excludePointId === originId, "Expected the occupied ray-origin root to be excluded.");
let otherRootWorld = worldOf(otherRootId);
assert(otherRootWorld, "Expected the forward ray-circle root to be defined.");
close(otherRootWorld.x, 2, "Expected the non-origin forward circle root");

store.movePointTo(circleCenterId, { x: 2, y: 0 });
otherRootWorld = worldOf(otherRootId);
assert(otherRootWorld, "The other root must remain defined after moving the circle.");
close(otherRootWorld.x, 4, "The ray-circle intersection must keep the non-origin root stable");

store.movePointTo(circleCenterId, { x: -2, y: 0 });
otherRootWorld = worldOf(otherRootId);
assert(otherRootWorld === null, "A circle intersection entirely behind the ray origin must become undefined.");

console.log("ray-tool: ok");
