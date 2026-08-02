import { getGeoStore } from "../../state/geoStore";
import { camera as cameraMath } from "../../view/camera";
import { findBestSnap } from "../../view/snapEngine";
import { getEllipseWorldGeometry, getPointWorldPos } from "../points";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function approxEqual(a: number, b: number, epsilon = 1e-7): boolean {
  return Math.abs(a - b) <= epsilon;
}

const store = getGeoStore();
const focusAId = store.createFreePoint({ x: -3, y: 0 });
const focusBId = store.createFreePoint({ x: 3, y: 0 });
const throughId = store.createFreePoint({ x: 0, y: 4 });
const ellipseId = store.createEllipseFociPoint(focusAId, focusBId, throughId);
assert(ellipseId, "Expected a valid ellipse construction.");

const camera = { pos: { x: 0, y: 0 }, zoom: 80 };
const viewport = { widthPx: 800, heightPx: 600 };
const expectedBoundaryWorld = { x: 2.5, y: 2 * Math.sqrt(3) };
const expectedBoundaryScreen = cameraMath.worldToScreen(expectedBoundaryWorld, camera, viewport);
const cursor = { x: expectedBoundaryScreen.x + 5, y: expectedBoundaryScreen.y - 4 };
const snap = findBestSnap(cursor, camera, viewport, getGeoStore().scene, 12);

assert(snap?.kind === "onEllipse", `Expected onEllipse snap, got ${snap?.kind ?? "none"}.`);
assert(snap.ellipseId === ellipseId, "Expected snap to reference the hovered ellipse.");
assert(typeof snap.t === "number" && Number.isFinite(snap.t), "Expected a stable ellipse parameter.");
assert(snap.screenDistPx <= 12, "Expected projected ellipse point to be within snap tolerance.");

const constrainedId = store.createPointOnEllipse(ellipseId, snap.t);
assert(constrainedId, "Expected ellipse snap to create a constrained point.");
let constrained = getGeoStore().scene.points.find((point) => point.id === constrainedId);
assert(constrained?.kind === "pointOnEllipse", "Expected pointOnEllipse construction metadata.");

store.movePointTo(constrainedId, { x: 0.2, y: -8 });
constrained = getGeoStore().scene.points.find((point) => point.id === constrainedId);
assert(constrained?.kind === "pointOnEllipse", "Expected dragged point to remain ellipse-constrained.");
let scene = getGeoStore().scene;
let world = getPointWorldPos(constrained, scene);
assert(world, "Expected dragged constrained point to remain defined.");

let ellipse = (scene.ellipses ?? []).find((item) => item.id === ellipseId);
assert(ellipse, "Expected ellipse to remain in the scene.");
let geometry = getEllipseWorldGeometry(ellipse, scene);
assert(geometry, "Expected valid ellipse geometry after dragging its constrained point.");
const cos = Math.cos(geometry.rotationRad);
const sin = Math.sin(geometry.rotationRad);
const localX = (world.x - geometry.center.x) * cos + (world.y - geometry.center.y) * sin;
const localY = -(world.x - geometry.center.x) * sin + (world.y - geometry.center.y) * cos;
assert(
  approxEqual(
    (localX * localX) / (geometry.semiMajor * geometry.semiMajor) +
      (localY * localY) / (geometry.semiMinor * geometry.semiMinor),
    1
  ),
  "Expected dragged point to lie on the ellipse."
);

store.movePointTo(focusBId, { x: 2, y: 1 });
scene = getGeoStore().scene;
constrained = scene.points.find((point) => point.id === constrainedId);
assert(constrained?.kind === "pointOnEllipse", "Expected dependency movement to preserve point kind.");
world = getPointWorldPos(constrained, scene);
assert(world, "Expected constrained point to recompute after a focus moves.");
ellipse = (scene.ellipses ?? []).find((item) => item.id === ellipseId);
assert(ellipse, "Expected ellipse to remain after a focus moves.");
geometry = getEllipseWorldGeometry(ellipse, scene);
assert(geometry, "Expected ellipse geometry after a focus moves.");
const constrainedDistanceSum =
  Math.hypot(world.x - geometry.focusA.x, world.y - geometry.focusA.y) +
  Math.hypot(world.x - geometry.focusB.x, world.y - geometry.focusB.y);
assert(
  approxEqual(constrainedDistanceSum, 2 * geometry.semiMajor),
  "Expected constrained point to follow the recomputed ellipse."
);

console.log("ellipse-snap: ok");
