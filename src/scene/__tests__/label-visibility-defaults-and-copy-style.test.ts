import { getGeoStore } from "../../state/geoStore";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const store = getGeoStore();

store.setObjectLabelDefaults({
  point: "caption",
  segment: true,
  segmentGlow: false,
});

const p1 = store.createFreePoint({ x: 0, y: 0 });
const p2 = store.createFreePoint({ x: 4, y: 0 });
const s1 = store.createSegment(p1, p2);
assert(s1 !== null, "segment creation should succeed");

let state = getGeoStore();
const point1 = state.scene.points.find((point) => point.id === p1);
const segment1 = state.scene.segments.find((segment) => segment.id === s1);
assert(point1?.showLabel === "caption", "new points should honor the default point label mode");
assert(segment1?.showLabel === true, "new segments should honor the default object label visibility");
assert(segment1?.labelGlow === false, "new segments should honor the default label glow setting");

const p3 = store.createFreePoint({ x: 8, y: 0 });
store.updatePointFieldsByIds([p3], { showLabel: "none" });
store.setCopyStyleSource({ type: "point", id: p1 });
store.applyCopyStyleTo({ type: "point", id: p3 });

state = getGeoStore();
const point3 = state.scene.points.find((point) => point.id === p3);
assert(point3?.showLabel === "caption", "copy style should copy point label mode");

const p4 = store.createFreePoint({ x: 0, y: 3 });
const p5 = store.createFreePoint({ x: 4, y: 3 });
const s2 = store.createSegment(p4, p5);
assert(s2 !== null, "second segment creation should succeed");
store.updateSegmentFieldsByIds([s2], { showLabel: false });
store.setCopyStyleSource({ type: "segment", id: s1 });
store.applyCopyStyleTo({ type: "segment", id: s2 });

state = getGeoStore();
const segment2 = state.scene.segments.find((segment) => segment.id === s2);
assert(segment2?.showLabel === true, "copy style should copy label visibility for label-bearing objects");
assert(segment2?.labelGlow === false, "copy style should copy label glow for label-bearing objects");

console.log("label-visibility-defaults-and-copy-style: ok");
