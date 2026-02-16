import type { Camera, Viewport } from "../../view/camera";
import { drawPendingPreview } from "../../view/previews/pendingPreview";
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
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

function createMockContext(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const ctx = {
    globalAlpha: 1,
    strokeStyle: "#000000",
    fillStyle: "#000000",
    lineWidth: 1,
    save() {
      calls.push("save");
    },
    restore() {
      calls.push("restore");
    },
    setLineDash() {
      calls.push("setLineDash");
    },
    beginPath() {
      calls.push("beginPath");
    },
    moveTo() {
      calls.push("moveTo");
    },
    lineTo() {
      calls.push("lineTo");
    },
    closePath() {
      calls.push("closePath");
    },
    fill() {
      calls.push("fill");
    },
    stroke() {
      calls.push("stroke");
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 800, heightPx: 600 };
const fixedToolState = {
  angleFixedTool: { angleExpr: "45", direction: "CCW" as const },
  regularPolygonTool: { sides: 5, direction: "CCW" as const },
  circleFixedTool: { radius: "1" },
  anglePreviewArcRadius: 40,
  tolerances: { linePx: 10, segmentPx: 10 },
};

const twoPointPending: PendingSelection = {
  tool: "polygon",
  step: 2,
  points: [
    { type: "point", id: "pA" },
    { type: "point", id: "pB" },
  ],
};
{
  const { ctx, calls } = createMockContext();
  drawPendingPreview(
    ctx,
    twoPointPending,
    { x: 0, y: 2 },
    null,
    null,
    null,
    scene,
    camera,
    vp,
    fixedToolState.angleFixedTool,
    fixedToolState.regularPolygonTool,
    fixedToolState.circleFixedTool,
    fixedToolState.anglePreviewArcRadius,
    fixedToolState.tolerances
  );
  const fillIndex = calls.indexOf("fill");
  const strokeIndex = calls.indexOf("stroke");
  assert(fillIndex >= 0, "Polygon preview with two fixed points + cursor should fill pending area.");
  assert(strokeIndex >= 0, "Polygon preview should still stroke pending boundary.");
  assert(fillIndex < strokeIndex, "Polygon preview fill should render before stroke.");
}

const onePointPending: PendingSelection = {
  tool: "polygon",
  step: 2,
  points: [{ type: "point", id: "pA" }],
};
{
  const { ctx, calls } = createMockContext();
  drawPendingPreview(
    ctx,
    onePointPending,
    { x: 0, y: 2 },
    null,
    null,
    null,
    scene,
    camera,
    vp,
    fixedToolState.angleFixedTool,
    fixedToolState.regularPolygonTool,
    fixedToolState.circleFixedTool,
    fixedToolState.anglePreviewArcRadius,
    fixedToolState.tolerances
  );
  const fillCount = calls.filter((call) => call === "fill").length;
  assert(fillCount === 0, "Polygon preview should not fill before a third preview vertex exists.");
}

console.log("polygon-preview-fill: ok");
