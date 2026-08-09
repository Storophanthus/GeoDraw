import { camera, getCameraTrueZoom, type Camera, type Viewport } from "../camera.ts";
import { hitTestPointLabel } from "../labelHit.ts";
import type { ScenePoint } from "../../scene/points.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, label: string): void {
  assert(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, received ${actual}`);
}

function assertPointClose(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  label: string
): void {
  assertClose(actual.x, expected.x, `${label}.x`);
  assertClose(actual.y, expected.y, `${label}.y`);
}

const viewport: Viewport = { widthPx: 800, heightPx: 600 };
const initial: Camera = {
  pos: { x: 2, y: -1 },
  zoom: 80,
  logZoom: Math.log(80),
  trueZoom: 1,
};
const cursor = { x: 300, y: 220 };
const cursorWorld = camera.screenToWorld(cursor, initial, viewport);

const ordinary = camera.zoomAtScreenPoint(initial, viewport, cursor, 1.5);
assertClose(ordinary.zoom, 120, "ordinary zoom");
assertClose(getCameraTrueZoom(ordinary), 1, "ordinary zoom visual scale");
assertPointClose(camera.screenToWorld(cursor, ordinary, viewport), cursorWorld, "ordinary cursor anchor");

const trueZoomed = camera.trueZoomAtScreenPoint(initial, viewport, cursor, 1.5);
assertClose(trueZoomed.zoom, 120, "true zoom effective geometry zoom");
assertClose(getCameraTrueZoom(trueZoomed), 1.5, "true zoom visual scale");
assertPointClose(camera.screenToWorld(cursor, trueZoomed, viewport), cursorWorld, "true zoom cursor anchor");

const renderSpace = camera.trueZoomRenderSpace(trueZoomed, viewport);
assertClose(renderSpace.scale, 1.5, "render context scale");
assertClose(renderSpace.camera.zoom, 80, "logical geometry zoom");
assertClose(renderSpace.viewport.widthPx, viewport.widthPx / 1.5, "logical viewport width");
assertClose(renderSpace.viewport.heightPx, viewport.heightPx / 1.5, "logical viewport height");

const probeWorld = { x: 3.25, y: 0.75 };
const actualScreen = camera.worldToScreen(probeWorld, trueZoomed, viewport);
const logicalScreen = camera.worldToScreen(probeWorld, renderSpace.camera, renderSpace.viewport);
assertPointClose(
  { x: logicalScreen.x * renderSpace.scale, y: logicalScreen.y * renderSpace.scale },
  actualScreen,
  "logical render maps back to the physical canvas"
);

const ordinaryAfterTrueZoom = camera.zoomAtScreenPoint(trueZoomed, viewport, cursor, 2);
assertClose(getCameraTrueZoom(ordinaryAfterTrueZoom), 1.5, "ordinary zoom preserves accumulated true zoom");
assertClose(ordinaryAfterTrueZoom.zoom, 240, "ordinary zoom still changes geometry independently");

const clamped = camera.trueZoomAtScreenPoint(initial, viewport, cursor, 100);
assertClose(getCameraTrueZoom(clamped), 4, "true zoom upper bound");
assertClose(clamped.zoom, 320, "effective zoom uses only the applied clamped factor");

const labelBaseCamera: Camera = {
  pos: { x: 0, y: 0 },
  zoom: 80,
  logZoom: Math.log(80),
  trueZoom: 1,
};
const labelPoint: ScenePoint = {
  id: "label-point",
  kind: "free",
  name: "A",
  captionTex: "A",
  visible: true,
  showLabel: "name",
  position: { x: 0, y: 0 },
  style: {
    shape: "circle",
    sizePx: 5,
    strokeColor: "#000000",
    strokeWidth: 1,
    strokeOpacity: 1,
    fillColor: "#ffffff",
    fillOpacity: 1,
    labelFontPx: 16,
    labelHaloWidthPx: 2,
    labelHaloColor: "#ffffff",
    labelColor: "#000000",
    labelOffsetPx: { x: 24, y: -12 },
  },
};
const resolvedLabelPoint = [{ point: labelPoint, world: labelPoint.position }];
const canvasCenter = { x: viewport.widthPx / 2, y: viewport.heightPx / 2 };
const labelZoomedIn = camera.trueZoomAtScreenPoint(labelBaseCamera, viewport, canvasCenter, 2);
assert(
  hitTestPointLabel(
    { x: canvasCenter.x + 50, y: canvasCenter.y - 30 },
    resolvedLabelPoint,
    labelZoomedIn,
    viewport,
    { x: 8, y: -8 }
  ) === labelPoint.id,
  "True Zoom in must keep the visibly scaled point-name label grabbable."
);
assert(
  hitTestPointLabel(
    { x: canvasCenter.x + 25, y: canvasCenter.y - 15 },
    resolvedLabelPoint,
    labelZoomedIn,
    viewport,
    { x: 8, y: -8 }
  ) === null,
  "True Zoom in must not leave the label hit-box at its obsolete unscaled position."
);

const labelZoomedOut = camera.trueZoomAtScreenPoint(labelBaseCamera, viewport, canvasCenter, 0.5);
assert(
  hitTestPointLabel(
    { x: canvasCenter.x + 15, y: canvasCenter.y - 7 },
    resolvedLabelPoint,
    labelZoomedOut,
    viewport,
    { x: 8, y: -8 }
  ) === labelPoint.id,
  "True Zoom out must keep the visibly scaled point-name label grabbable."
);

console.log("✓ true zoom camera test passed");
