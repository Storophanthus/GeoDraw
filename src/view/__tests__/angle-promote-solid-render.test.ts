import type { SceneModel } from "../../scene/points";
import { drawAngles, type ResolvedAngleForRender } from "../renderers/angles";
import { drawSegments } from "../renderers/segments";
import type { Camera, Viewport } from "../camera";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

class FakeCanvasContext {
  globalAlpha = 1;
  strokeStyle: string | CanvasGradient | CanvasPattern = "#000";
  fillStyle: string | CanvasGradient | CanvasPattern = "#000";
  lineWidth = 1;
  lineCap: CanvasLineCap = "butt";
  lineJoin: CanvasLineJoin = "miter";
  shadowBlur = 0;
  shadowColor = "";

  private dash: number[] = [];
  private dashStack: number[][] = [];
  strokeDashHistory: number[][] = [];

  save(): void {
    this.dashStack.push([...this.dash]);
  }

  restore(): void {
    const restored = this.dashStack.pop();
    this.dash = restored ? [...restored] : [];
  }

  setLineDash(segments: number[]): void {
    this.dash = [...segments];
  }

  getLineDash(): number[] {
    return [...this.dash];
  }

  beginPath(): void {}
  moveTo(_x: number, _y: number): void {}
  lineTo(_x: number, _y: number): void {}
  arc(_x: number, _y: number, _radius: number, _start: number, _end: number, _anticlockwise?: boolean): void {}
  closePath(): void {}
  fill(): void {}

  stroke(): void {
    this.strokeDashHistory.push([...this.dash]);
  }
}

const camera: Camera = {
  pos: { x: 0, y: 0 },
  zoom: 1,
};

const viewport: Viewport = {
  widthPx: 200,
  heightPx: 200,
};

const baseStyle: SceneModel["angles"][number]["style"] = {
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeDash: "solid",
  strokeOpacity: 1,
  textColor: "#000000",
  textSize: 16,
  fillEnabled: false,
  fillColor: "#808080",
  fillOpacity: 0.28,
  pattern: "",
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 7.4,
  markColor: "#000000",
  arcRadius: 1.95,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: false,
  showValue: false,
  promoteToSolid: false,
};

function makeResolvedAngle(id: string, promoteToSolid: boolean): ResolvedAngleForRender {
  return {
    angle: {
      id,
      aId: "p_a",
      bId: "p_b",
      cId: "p_c",
      visible: true,
      isRightExact: false,
      isRightApprox: true,
      style: {
        ...baseStyle,
        promoteToSolid,
      },
    },
    a: { x: 0, y: 1 },
    b: { x: 0, y: 0 },
    c: { x: 1, y: 0 },
    theta: Math.PI / 2,
  };
}

{
  const ctx = new FakeCanvasContext();
  ctx.setLineDash([8, 6]);
  drawAngles(
    ctx as unknown as CanvasRenderingContext2D,
    [makeResolvedAngle("solid", true)],
    camera,
    viewport,
    null,
    null,
    (raw) => raw
  );
  assert(
    ctx.strokeDashHistory.some((dash) => dash.length === 0),
    `Expected promoted right angle to render with solid stroke, got ${JSON.stringify(ctx.strokeDashHistory)}`
  );
}

{
  const ctx = new FakeCanvasContext();
  ctx.setLineDash([8, 6]);
  drawAngles(
    ctx as unknown as CanvasRenderingContext2D,
    [makeResolvedAngle("dashed", false)],
    camera,
    viewport,
    null,
    null,
    (raw) => raw
  );
  assert(
    ctx.strokeDashHistory.some((dash) => dash.length === 2 && dash[0] === 6 && dash[1] === 4),
    `Expected unpromoted approximate right angle to keep dashed stroke, got ${JSON.stringify(ctx.strokeDashHistory)}`
  );
}

{
  const ctx = new FakeCanvasContext();
  const segmentScene: SceneModel = {
    points: [
      {
        id: "s_a",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: {
          shape: "circle",
          sizePx: 6,
          strokeColor: "#000000",
          strokeWidth: 1.7,
          strokeOpacity: 1,
          fillColor: "#ffffff",
          fillOpacity: 1,
          labelFontPx: 18,
          labelHaloWidthPx: 3.5,
          labelHaloColor: "#ffffff",
          labelColor: "#000000",
          labelOffsetPx: { x: 8, y: -8 },
        },
      },
      {
        id: "s_b",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 1, y: 0 },
        style: {
          shape: "circle",
          sizePx: 6,
          strokeColor: "#000000",
          strokeWidth: 1.7,
          strokeOpacity: 1,
          fillColor: "#ffffff",
          fillOpacity: 1,
          labelFontPx: 18,
          labelHaloWidthPx: 3.5,
          labelHaloColor: "#ffffff",
          labelColor: "#000000",
          labelOffsetPx: { x: 8, y: -8 },
        },
      },
    ],
    vectors: [],
    numbers: [],
    lines: [],
    segments: [
      {
        id: "seg_dashed",
        aId: "s_a",
        bId: "s_b",
        visible: true,
        showLabel: false,
        style: {
          strokeColor: "#000000",
          strokeWidth: 1.6,
          dash: "dashed",
          opacity: 1,
        },
      },
    ],
    circles: [],
    polygons: [],
    angles: [],
    textLabels: [],
  };

  drawSegments(
    ctx as unknown as CanvasRenderingContext2D,
    segmentScene,
    camera,
    viewport,
    null,
    null,
    null
  );
  drawAngles(
    ctx as unknown as CanvasRenderingContext2D,
    [makeResolvedAngle("after-segment", true)],
    camera,
    viewport,
    null,
    null,
    (raw) => raw
  );
  const hasDashedSegmentStroke = ctx.strokeDashHistory.some((dash) => dash.length === 2 && dash[0] === 8 && dash[1] === 6);
  const finalAngleStroke = ctx.strokeDashHistory[ctx.strokeDashHistory.length - 1] ?? null;
  assert(hasDashedSegmentStroke, `Expected dashed segment stroke history, got ${JSON.stringify(ctx.strokeDashHistory)}`);
  assert(
    Array.isArray(finalAngleStroke) && finalAngleStroke.length === 0,
    `Expected promoted right angle after dashed segment to render solid, got ${JSON.stringify(ctx.strokeDashHistory)}`
  );
}

console.log("angle-promote-solid-render: ok");
