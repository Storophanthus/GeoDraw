import type { Camera, Viewport } from "../../view/camera";
import { drawPolygons } from "../../view/renderers/polygons";
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

const segmentStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 2,
  dash: "solid" as const,
  opacity: 1,
};

const polygonStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.6,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
  fillColor: "#93c5fd",
  fillOpacity: 0.22,
};

function createScene(edgeVisible: boolean): SceneModel {
  return {
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
      {
        id: "sAB",
        aId: "pA",
        bId: "pB",
        ownedByPolygonIds: ["pg_1"],
        visible: edgeVisible,
        showLabel: false,
        style: segmentStyle,
      },
      {
        id: "sBC",
        aId: "pB",
        bId: "pC",
        ownedByPolygonIds: ["pg_1"],
        visible: edgeVisible,
        showLabel: false,
        style: segmentStyle,
      },
      {
        id: "sCA",
        aId: "pC",
        bId: "pA",
        ownedByPolygonIds: ["pg_1"],
        visible: edgeVisible,
        showLabel: false,
        style: segmentStyle,
      },
    ],
    circles: [],
    polygons: [{ id: "pg_1", pointIds: ["pA", "pB", "pC"], visible: true, style: polygonStyle }],
    angles: [],
  };
}

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

{
  const scene = createScene(false);
  const { ctx, calls } = createMockContext();
  drawPolygons(ctx, scene, camera, vp, null, null, null);
  const fillCount = calls.filter((call) => call === "fill").length;
  const strokeCount = calls.filter((call) => call === "stroke").length;
  assert(fillCount === 1, "Polygon fill should still render when owned segments are hidden.");
  assert(strokeCount === 0, "Polygon border should not render when all owned segments are hidden.");
}

{
  const scene = createScene(true);
  const { ctx, calls } = createMockContext();
  drawPolygons(ctx, scene, camera, vp, null, null, null);
  const strokeCount = calls.filter((call) => call === "stroke").length;
  assert(strokeCount === 3, "Polygon border should render all three edges when owned segments are visible.");
}

console.log("polygon-owned-segment-visibility: ok");
