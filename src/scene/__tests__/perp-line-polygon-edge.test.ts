import { hitTestTopObject } from "../../engine";
import { runConstructClickAdapter, type ConstructClickIo } from "../../view/constructClickAdapter";
import { camera as camMath, type Camera, type Viewport } from "../../view/camera";
import type { PendingSelection } from "../../state/slices/storeTypes";
import type { SceneModel } from "../points";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const segmentStyle = { strokeColor: "#334155", strokeWidth: 1.2, dash: "solid" as const, opacity: 1 };
const polygonStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.2,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
};

const scene: SceneModel = {
  points: [
    {
      id: "pA",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: -2, y: 0 },
      style: pointStyle,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 2, y: 0 },
      style: pointStyle,
    },
    {
      id: "pC",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      locked: false,
      auxiliary: false,
      position: { x: 0, y: 2 },
      style: pointStyle,
    },
  ],
  numbers: [],
  lines: [],
  segments: [
    { id: "sAB", aId: "pA", bId: "pB", ownedByPolygonIds: ["poly1"], visible: true, showLabel: false, style: segmentStyle },
    { id: "sBC", aId: "pB", bId: "pC", ownedByPolygonIds: ["poly1"], visible: true, showLabel: false, style: segmentStyle },
    { id: "sCA", aId: "pC", bId: "pA", ownedByPolygonIds: ["poly1"], visible: true, showLabel: false, style: segmentStyle },
  ],
  circles: [],
  polygons: [{ id: "poly1", pointIds: ["pA", "pB", "pC"], visible: true, style: polygonStyle }],
  angles: [],
};

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 800, heightPx: 600 };
const edgeMidScreen = camMath.worldToScreen({ x: 0, y: 0 }, camera, vp);

const topHit = hitTestTopObject(scene, camera, vp, edgeMidScreen, {
  pointTolPx: 12,
  angleTolPx: 20,
  segmentTolPx: 10,
  lineTolPx: 10,
  circleTolPx: 10,
});
assert(topHit?.type === "segment" && topHit.id === "sAB", "Polygon boundary should prioritize edge segment hit over polygon hit.");

const worldByPointId = new Map<string, { x: number; y: number }>([
  ["pA", { x: -2, y: 0 }],
  ["pB", { x: 2, y: 0 }],
  ["pC", { x: 0, y: 2 }],
]);
const resolvedPoints = scene.points.map((point) => ({ point, world: worldByPointId.get(point.id)! }));
let pending: PendingSelection = null;
const createdPerp: Array<{ throughId: string; base: { type: "line" | "segment"; id: string } }> = [];

const io: ConstructClickIo = {
  setPendingSelection(next) {
    pending = next;
  },
  clearPendingSelection() {
    pending = null;
  },
  createFreePoint() {
    throw new Error("Unexpected free point creation in perpendicular regression.");
  },
  createSegment() {
    return null;
  },
  createLine() {
    return null;
  },
  createPolygon() {
    return null;
  },
  createRegularPolygon() {
    return null;
  },
  createCircle() {
    return null;
  },
  createAuxiliaryCircle() {
    return null;
  },
  createCircleThreePoint() {
    return null;
  },
  createPerpendicularLine(throughId, base) {
    createdPerp.push({ throughId, base });
    return "l_perp";
  },
  createParallelLine() {
    return null;
  },
  createTangentLines() {
    return [];
  },
  createCircleTangentLines() {
    return [];
  },
  createAngleBisectorLine() {
    return null;
  },
  createAngle() {
    return null;
  },
  createSector() {
    return null;
  },
  createAngleFixed() {
    return null;
  },
  createMidpointFromPoints() {
    return null;
  },
  createMidpointFromSegment() {
    return null;
  },
  createPointOnLine() {
    return null;
  },
  createPointOnSegment() {
    return null;
  },
  createPointOnCircle() {
    return null;
  },
  createPointByRotation() {
    return null;
  },
  createPointByTranslation() {
    return null;
  },
  createPointByDilation() {
    return null;
  },
  createPointByReflection() {
    return null;
  },
  createIntersectionPoint() {
    return null;
  },
  createCircleCenterPoint() {
    return null;
  },
  setExportClipWorld() {},
  setSelectedObject() {},
  setCopyStyleSource() {},
  applyCopyStyleTo() {},
  getPointWorldById(id) {
    return worldByPointId.get(id) ?? null;
  },
  gridSnapEnabled: false,
  snapWorldToGrid(world) {
    return world;
  },
};

// Path 1: point C then edge AB.
runConstructClickAdapter({
  screen: camMath.worldToScreen({ x: 0, y: 2 }, camera, vp),
  pointerEvent: { shiftKey: false } as PointerEvent,
  activeTool: "perp_line",
  pendingSelection: null,
  copyStyleSource: null,
  scene,
  resolvedPoints,
  camera,
  vp,
  angleFixedTool: { angleExpr: "45", direction: "CCW" },
  regularPolygonTool: { sides: 5, direction: "CCW" },
  transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
  tolerances: { point: 12, angle: 20, segment: 10, line: 10, circle: 10 },
  io,
});
const pendingPointFirst = pending as { tool?: string; first?: { type?: string; id?: string } } | null;
assert(
  pendingPointFirst?.tool === "perp_line" &&
    pendingPointFirst.first?.type === "point" &&
    pendingPointFirst.first?.id === "pC",
  "Expected first perp click to select point C."
);

runConstructClickAdapter({
  screen: edgeMidScreen,
  pointerEvent: { shiftKey: false } as PointerEvent,
  activeTool: "perp_line",
  pendingSelection: pending,
  copyStyleSource: null,
  scene,
  resolvedPoints,
  camera,
  vp,
  angleFixedTool: { angleExpr: "45", direction: "CCW" },
  regularPolygonTool: { sides: 5, direction: "CCW" },
  transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
  tolerances: { point: 12, angle: 20, segment: 10, line: 10, circle: 10 },
  io,
});
assert(createdPerp.length === 1, "Expected perpendicular to be created from point-first path.");
assert(createdPerp[0].throughId === "pC", "Expected point-first perpendicular through C.");
assert(createdPerp[0].base.type === "segment" && createdPerp[0].base.id === "sAB", "Expected base segment AB in point-first path.");

// Path 2: edge AB then point C.
pending = null;
createdPerp.length = 0;
runConstructClickAdapter({
  screen: edgeMidScreen,
  pointerEvent: { shiftKey: false } as PointerEvent,
  activeTool: "perp_line",
  pendingSelection: null,
  copyStyleSource: null,
  scene,
  resolvedPoints,
  camera,
  vp,
  angleFixedTool: { angleExpr: "45", direction: "CCW" },
  regularPolygonTool: { sides: 5, direction: "CCW" },
  transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
  tolerances: { point: 12, angle: 20, segment: 10, line: 10, circle: 10 },
  io,
});
const pendingLineLikeFirst = pending as
  | { tool?: string; first?: { type?: string; ref?: { type?: "line" | "segment"; id?: string } } }
  | null;
assert(
  pendingLineLikeFirst?.tool === "perp_line" &&
    pendingLineLikeFirst.first?.type === "lineLike" &&
    pendingLineLikeFirst.first?.ref?.type === "segment" &&
    pendingLineLikeFirst.first?.ref?.id === "sAB",
  "Expected first perp click on polygon edge to select segment AB."
);

runConstructClickAdapter({
  screen: camMath.worldToScreen({ x: 0, y: 2 }, camera, vp),
  pointerEvent: { shiftKey: false } as PointerEvent,
  activeTool: "perp_line",
  pendingSelection: pending,
  copyStyleSource: null,
  scene,
  resolvedPoints,
  camera,
  vp,
  angleFixedTool: { angleExpr: "45", direction: "CCW" },
  regularPolygonTool: { sides: 5, direction: "CCW" },
  transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
  tolerances: { point: 12, angle: 20, segment: 10, line: 10, circle: 10 },
  io,
});
assert(createdPerp.length === 1, "Expected perpendicular to be created from segment-first path.");
assert(createdPerp[0].throughId === "pC", "Expected segment-first perpendicular through C.");
assert(createdPerp[0].base.type === "segment" && createdPerp[0].base.id === "sAB", "Expected base segment AB in segment-first path.");

console.log("perp-line-polygon-edge: ok");
