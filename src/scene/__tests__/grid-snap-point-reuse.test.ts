import { runConstructClickAdapter, type ConstructClickIo } from "../../view/constructClickAdapter";
import type { Camera, Viewport } from "../../view/camera";
import type { SceneModel } from "../points";
import type { ActiveTool } from "../../state/slices/storeTypes";

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

const scene: SceneModel = {
  points: [
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 2, y: 3 },
      style: pointStyle,
      locked: false,
      auxiliary: false,
    },
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const resolvedPoints = [
  {
    point: scene.points[0],
    world: { x: 2, y: 3 },
  },
];

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 800, heightPx: 600 };

function runScenario(activeTool: ActiveTool): void {
  let pending: unknown = null;
  let freePointCreates = 0;

  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      freePointCreates += 1;
      return "p_new";
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
    createPerpendicularLine() {
      return null;
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
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
      return id === "pB" ? { x: 2, y: 3 } : null;
    },
    gridSnapEnabled: true,
    snapWorldToGrid() {
      // Simulate magnetic grid snapping to existing point B.
      return { x: 2, y: 3 };
    },
  };

  runConstructClickAdapter({
    // Deliberately outside point hit tolerance from B's screen position.
    screen: { x: 620, y: 0 },
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool,
    pendingSelection: null,
    copyStyleSource: null,
    scene,
    resolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 10,
    },
    io,
  });

  const pendingValue = pending as { tool?: string; first?: { type?: string; id?: string } } | null;
  assert(freePointCreates === 0, `${activeTool}: should reuse existing snapped point instead of creating a duplicate free point`);
  assert(pendingValue?.tool === activeTool, `${activeTool}: should start pending selection for the active tool`);
  assert(
    Boolean(pendingValue && pendingValue.first?.type === "point" && pendingValue.first?.id === "pB"),
    `${activeTool}: first selected point should be existing point B`
  );
}

runScenario("segment");
runScenario("line2p");

console.log("grid-snap-point-reuse: ok");
