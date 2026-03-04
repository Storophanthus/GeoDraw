import type { Camera, Viewport } from "../view/camera";
import { camera } from "../view/camera";
import type { Vec2 } from "../geo/vec2";

export type RectGridSettings = {
  enabled: boolean;
  showAxes?: boolean;
  rotationRad: number;
  targetSpacingPx: number;
  majorEvery: number;
  minorOpacity: number;
  majorOpacity: number;
  minorWidth: number;
  majorWidth: number;
};

type GridPalette = {
  gridMinorColor: string;
  gridMajorColor: string;
  axisColor: string;
};

export function drawRectGrid(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  vp: Viewport,
  s: RectGridSettings,
  palette: GridPalette
) {
  if (!s.enabled) return;

  const spacingWorld = gridSpacingWorld(cam, s);
  const rot = s.rotationRad;

  const corners: Vec2[] = [
    { x: 0, y: 0 },
    { x: vp.widthPx, y: 0 },
    { x: 0, y: vp.heightPx },
    { x: vp.widthPx, y: vp.heightPx },
  ];

  const cg = corners.map((p) => worldToGrid(camera.screenToWorld(p, cam, vp), rot));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of cg) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }

  const pad = spacingWorld * 2;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;

  const iMin = Math.floor(minX / spacingWorld);
  const iMax = Math.ceil(maxX / spacingWorld);
  const jMin = Math.floor(minY / spacingWorld);
  const jMax = Math.ceil(maxY / spacingWorld);

  ctx.save();
  ctx.setLineDash([]);

  for (let i = iMin; i <= iMax; i++) {
    const x = i * spacingWorld;
    const major = s.majorEvery > 0 && i % s.majorEvery === 0;
    ctx.strokeStyle = major ? palette.gridMajorColor : palette.gridMinorColor;
    ctx.globalAlpha = major ? s.majorOpacity : s.minorOpacity;
    ctx.lineWidth = major ? s.majorWidth : s.minorWidth;

    const p1 = camera.worldToScreen(gridToWorld({ x, y: minY }, rot), cam, vp);
    const p2 = camera.worldToScreen(gridToWorld({ x, y: maxY }, rot), cam, vp);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  for (let j = jMin; j <= jMax; j++) {
    const y = j * spacingWorld;
    const major = s.majorEvery > 0 && j % s.majorEvery === 0;
    ctx.strokeStyle = major ? palette.gridMajorColor : palette.gridMinorColor;
    ctx.globalAlpha = major ? s.majorOpacity : s.minorOpacity;
    ctx.lineWidth = major ? s.majorWidth : s.minorWidth;

    const p1 = camera.worldToScreen(gridToWorld({ x: minX, y }, rot), cam, vp);
    const p2 = camera.worldToScreen(gridToWorld({ x: maxX, y }, rot), cam, vp);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  if (s.showAxes ?? true) {
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = Math.max(1.2, s.majorWidth + 0.3);
    ctx.strokeStyle = palette.axisColor;
    const xAxisA = camera.worldToScreen(gridToWorld({ x: minX, y: 0 }, rot), cam, vp);
    const xAxisB = camera.worldToScreen(gridToWorld({ x: maxX, y: 0 }, rot), cam, vp);
    ctx.beginPath();
    ctx.moveTo(xAxisA.x, xAxisA.y);
    ctx.lineTo(xAxisB.x, xAxisB.y);
    ctx.stroke();
    const yAxisA = camera.worldToScreen(gridToWorld({ x: 0, y: minY }, rot), cam, vp);
    const yAxisB = camera.worldToScreen(gridToWorld({ x: 0, y: maxY }, rot), cam, vp);
    ctx.beginPath();
    ctx.moveTo(yAxisA.x, yAxisA.y);
    ctx.lineTo(yAxisB.x, yAxisB.y);
    ctx.stroke();
  }

  ctx.restore();
}

export function gridSpacingWorld(cam: Camera, s: RectGridSettings): number {
  return niceSpacing(s.targetSpacingPx / Math.max(1e-9, cam.zoom));
}

export function snapWorldToRectGrid(world: Vec2, cam: Camera, s: RectGridSettings): Vec2 {
  const spacingWorld = gridSpacingWorld(cam, s);
  const p = worldToGrid(world, s.rotationRad);
  const gx = Math.round(p.x / spacingWorld) * spacingWorld;
  const gy = Math.round(p.y / spacingWorld) * spacingWorld;
  return gridToWorld({ x: gx, y: gy }, s.rotationRad);
}

function niceSpacing(raw: number) {
  const k = Math.floor(Math.log10(raw));
  const base = raw / Math.pow(10, k);
  let niceBase = 1;
  if (base >= 1.5) niceBase = 2;
  if (base >= 3.5) niceBase = 5;
  if (base >= 7.5) niceBase = 10;
  return niceBase * Math.pow(10, k);
}

function rot2(p: Vec2, a: number): Vec2 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: c * p.x - s * p.y, y: s * p.x + c * p.y };
}
function worldToGrid(p: Vec2, rot: number) { return rot2(p, -rot); }
function gridToWorld(p: Vec2, rot: number) { return rot2(p, rot); }
