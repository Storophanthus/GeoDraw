import { getGeoStore } from "../../state/geoStore";
import { getPointWorldPos } from "../points";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function worldOf(pointId: string): { x: number; y: number } | null {
  const scene = getGeoStore().scene;
  const point = scene.points.find((item) => item.id === pointId);
  return point ? getPointWorldPos(point, scene) : null;
}

const store = getGeoStore();
const centerId = store.createFreePoint({ x: -1, y: -1 });
const endpointId = store.createFreePoint({ x: 1, y: -1 });
const farEndId = store.createFreePoint({ x: -4, y: -1 });
const circleId = store.createCircle(centerId, endpointId);
const segmentId = store.createSegment(endpointId, farEndId);
assert(circleId && segmentId, "Expected circle and segment construction.");

const intersectionId = store.createIntersectionPoint(
  { type: "circle", id: circleId },
  { type: "segment", id: segmentId },
  { x: -3, y: -1 }
);
assert(intersectionId, "Expected the non-endpoint segment-circle intersection.");
let intersection = getGeoStore().scene.points.find((point) => point.id === intersectionId);
assert(intersection?.kind === "circleSegmentIntersectionPoint", "Expected stable circle-segment metadata.");
assert(
  intersection.excludePointId === endpointId,
  "Expected creation to remember the occupied endpoint root."
);

store.movePointTo(centerId, { x: -0.5, y: 0 });
let world = worldOf(intersectionId);
assert(world && Math.abs(world.x + 2) <= 1e-8 && Math.abs(world.y + 1) <= 1e-8, "Expected the other root after dependency movement.");

store.movePointTo(farEndId, { x: 0, y: -1 });
world = worldOf(intersectionId);
assert(world === null, "Expected the other intersection to become undefined outside the finite segment domain.");

console.log("segment-circle-creation-exclusion: ok");
