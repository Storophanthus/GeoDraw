import { getGeoStore } from "../../state/geoStore";
import { applyDilationToObject, applyInversionToObject } from "../../tools/objectTransforms";
import { getPointWorldPos } from "../points";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function pointWorld(pointId: string): { x: number; y: number } {
  const scene = getGeoStore().scene;
  const point = scene.points.find((item) => item.id === pointId);
  assert(!!point, `Point ${pointId} should exist.`);
  const world = getPointWorldPos(point!, scene);
  assert(!!world, `Point ${pointId} should evaluate to a world position.`);
  return world!;
}

function approx(a: number, b: number, msg: string): void {
  assert(Math.abs(a - b) <= 1e-9, `${msg} (expected ${b}, got ${a})`);
}

// The ops mirror how CanvasView wires the object transforms to store actions.
// `scene` is a getter so every step inside a transform sees the latest state.
function makeOps() {
  return {
    get scene() {
      return getGeoStore().scene;
    },
    createPointByTranslation: (pointId: string, fromId: string, toId: string) =>
      getGeoStore().createPointByTranslation(pointId, fromId, toId),
    createPointByRotation: (
      centerId: string,
      pointId: string,
      angleDeg: number,
      direction: "CCW" | "CW",
      angleExpr?: string
    ) => getGeoStore().createPointByRotation(centerId, pointId, angleDeg, direction, angleExpr),
    createPointByDilation: (pointId: string, centerId: string, factorExpr: string) =>
      getGeoStore().createPointByDilation(pointId, centerId, factorExpr),
    createPointByReflection: (pointId: string, axis: Parameters<ReturnType<typeof getGeoStore>["createPointByReflection"]>[1]) =>
      getGeoStore().createPointByReflection(pointId, axis),
    createPointOnLine: (lineId: string, s: number) => getGeoStore().createPointOnLine(lineId, s),
    createPointOnCircle: (circleId: string, t: number) => getGeoStore().createPointOnCircle(circleId, t),
    createSegment: (aId: string, bId: string) => getGeoStore().createSegment(aId, bId),
    createLine: (aId: string, bId: string) => getGeoStore().createLine(aId, bId),
    createAngleBisectorLine: (aId: string, bId: string, cId: string) =>
      getGeoStore().createAngleBisectorLine(aId, bId, cId),
    createCircle: (centerId: string, throughId: string) => getGeoStore().createCircle(centerId, throughId),
    createCircleThreePoint: (aId: string, bId: string, cId: string) =>
      getGeoStore().createCircleThreePoint(aId, bId, cId),
    createCircleFixedRadius: (centerId: string, radiusExpr: string) =>
      getGeoStore().createCircleFixedRadius(centerId, radiusExpr),
    createCircleCenterPoint: (circleId: string) => getGeoStore().createCircleCenterPoint(circleId),
    createPolygon: (pointIds: string[]) => getGeoStore().createPolygon(pointIds),
    createAngle: (aId: string, bId: string, cId: string) => getGeoStore().createAngle(aId, bId, cId),
    createSector: (centerId: string, startId: string, endId: string) =>
      getGeoStore().createSector(centerId, startId, endId),
    setObjectVisibility: (
      obj: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string },
      visible: boolean
    ) => getGeoStore().setObjectVisibility(obj, visible),
  };
}

const store = getGeoStore();
const oId = store.createFreePoint({ x: 0, y: 0 });
const aId = store.createFreePoint({ x: 2, y: 0 });

// --- Homothety driven by a slider number ---
{
  const kId = getGeoStore().createNumber({ kind: "slider", value: 2, min: -3, max: 3, step: 0.1 }, "k");
  assert(!!kId, "Slider number k should be created.");
  const kNumber = getGeoStore().scene.numbers.find((item) => item.id === kId);
  assert(kNumber?.name === "k", "Slider should be named k.");

  const imageId = applyDilationToObject({ type: "point", id: aId }, oId, "k", makeOps());
  assert(!!imageId, "Homothety image of A should be created.");
  approx(pointWorld(imageId!).x, 4, "Image of A under homothety k=2 should sit at x=4.");
  approx(pointWorld(imageId!).y, 0, "Image of A under homothety k=2 should sit at y=0.");

  getGeoStore().updateNumberDefinitionById(kId!, { kind: "slider", value: -1, min: -3, max: 3, step: 0.1 });
  approx(pointWorld(imageId!).x, -2, "Image should follow the slider live (k=-1 → x=-2).");
  approx(pointWorld(imageId!).y, 0, "Image should stay on the x-axis after slider change.");
}

// --- Inversion of a point through a circle ---
{
  const tId = getGeoStore().createFreePoint({ x: 1, y: 0 });
  const inversionCircleId = getGeoStore().createCircle(oId, tId);
  assert(!!inversionCircleId, "Inversion circle should be created.");

  getGeoStore().updateNumberDefinitionById(
    getGeoStore().scene.numbers.find((item) => item.name === "k")!.id,
    { kind: "slider", value: 2, min: -3, max: 3, step: 0.1 }
  );

  const invertedId = applyInversionToObject({ type: "point", id: aId }, inversionCircleId!, makeOps());
  assert(!!invertedId, "Inversion of a point should be supported.");
  // A=(2,0), unit circle at O: image at r^2/d^2 * A = (1/4)*(2,0) = (0.5, 0).
  approx(pointWorld(invertedId!).x, 0.5, "Inverted point should sit at x=0.5.");
  approx(pointWorld(invertedId!).y, 0, "Inverted point should sit at y=0.");

  const invertedPoint = getGeoStore().scene.points.find((item) => item.id === invertedId);
  assert(invertedPoint?.visible !== false, "Inverted point should stay visible.");

  // Inversion is a live construction: moving the source moves the image.
  getGeoStore().movePointTo(aId, { x: 4, y: 0 });
  approx(pointWorld(invertedId!).x, 0.25, "Inverted point should follow its source (x=0.25).");
}

console.log("homothety-inversion-tool tests: OK");
