import { constructFromClick, evaluateScene, hitTestTopObject } from "../../engine";
import type { SceneModel } from "../points";
import type { Camera, Viewport } from "../../view/camera";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const scene: SceneModel = {
  points: [
    {
      id: "p1",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: {
        shape: "circle",
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
      },
    },
    {
      id: "p2",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 2, y: 0 },
      style: {
        shape: "circle",
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
      },
    },
  ],
  segments: [
    {
      id: "s1",
      aId: "p1",
      bId: "p2",
      visible: true,
      showLabel: false,
      style: { strokeColor: "#334155", strokeWidth: 1.2, dash: "solid", opacity: 1 },
    },
  ],
  lines: [],
  circles: [],
  angles: [],
  numbers: [],
    polygons: [],
};

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 800, heightPx: 600 };

const evalOut = evaluateScene(scene);
assert(evalOut.points.get("p1") !== null, "evaluateScene should resolve free points");
assert(evalOut.lines.size === 0, "evaluateScene line map should exist");

const hit = hitTestTopObject(scene, camera, vp, { x: 400, y: 300 });
assert(hit?.type === "point" && hit.id === "p1", "hitTestTopObject should hit point A at viewport center");

let created = 0;
constructFromClick({
  screen: { x: 420, y: 320 },
  activeTool: "point",
  pendingSelection: null,
  hits: {
    hitPointId: null,
    hitSegmentId: null,
    hitObject: null,
    shiftKey: false,
    hasCopyStyleSource: false,
    snap: null,
  },
  io: {
    setPendingSelection() {},
    clearPendingSelection() {},
    createFreePoint() {
      created += 1;
      return "p_new";
    },
    createSegment() {
      return null;
    },
    createLine() {
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
    createPolygon() {
      return null;
    },
    createRegularPolygon() {
      return null;
    },
    createPerpendicularLine() {
      return null;
    },
    createParallelLine() {
      return null;
    },
    createTangentLines() {
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
    getPointWorldById() {
      return null;
    },
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    gridSnapEnabled: false,
    snapWorldToGrid(world) {
      return world;
    },
    camera,
    vp,
  },
});
assert(created === 1, "constructFromClick should delegate point creation");

console.log("engine-boundary: ok");
