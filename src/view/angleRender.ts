import type { Vec2 } from "../geo/vec2";

function normalizeScreenVec(v: Vec2): Vec2 {
  const d = Math.hypot(v.x, v.y);
  if (d <= 1e-9) return { x: 1, y: 0 };
  return { x: v.x / d, y: v.y / d };
}

function angleSweep(aScreen: Vec2, bScreen: Vec2, thetaRad: number): { start: number; sweep: number } {
  const start = Math.atan2(aScreen.y - bScreen.y, aScreen.x - bScreen.x);
  // World-oriented angle is CCW in math coordinates. In screen coordinates (Y down),
  // this corresponds to decreasing screen angle by theta.
  let sweep = thetaRad;
  while (sweep < 0) sweep += Math.PI * 2;
  while (sweep >= Math.PI * 2) sweep -= Math.PI * 2;
  return { start, sweep };
}

export function drawAngleArcPreview(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  thetaRad: number,
  radiusPx: number
): void {
  const sweep = angleSweep(aScreen, bScreen, thetaRad);
  ctx.beginPath();
  ctx.arc(bScreen.x, bScreen.y, radiusPx, sweep.start, sweep.start - sweep.sweep, true);
  ctx.stroke();
}

export function drawAngleSector(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  thetaRad: number,
  radiusPx: number
): void {
  const sweep = angleSweep(aScreen, bScreen, thetaRad);
  ctx.beginPath();
  ctx.moveTo(bScreen.x, bScreen.y);
  ctx.arc(bScreen.x, bScreen.y, radiusPx, sweep.start, sweep.start - sweep.sweep, true);
  ctx.closePath();
}

export function drawRightAngleMark(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  cScreen: Vec2,
  sizePx: number
): void {
  const u = normalizeScreenVec({ x: aScreen.x - bScreen.x, y: aScreen.y - bScreen.y });
  const v = normalizeScreenVec({ x: cScreen.x - bScreen.x, y: cScreen.y - bScreen.y });
  const p1 = { x: bScreen.x + u.x * sizePx, y: bScreen.y + u.y * sizePx };
  const p3 = { x: bScreen.x + v.x * sizePx, y: bScreen.y + v.y * sizePx };
  const p2 = { x: p1.x + v.x * sizePx, y: p1.y + v.y * sizePx };
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
}

export function drawRightAngleSquareFill(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  cScreen: Vec2,
  sizePx: number
): void {
  const u = normalizeScreenVec({ x: aScreen.x - bScreen.x, y: aScreen.y - bScreen.y });
  const v = normalizeScreenVec({ x: cScreen.x - bScreen.x, y: cScreen.y - bScreen.y });
  const p1 = { x: bScreen.x + u.x * sizePx, y: bScreen.y + u.y * sizePx };
  const p3 = { x: bScreen.x + v.x * sizePx, y: bScreen.y + v.y * sizePx };
  const p2 = { x: p1.x + v.x * sizePx, y: p1.y + v.y * sizePx };
  ctx.beginPath();
  ctx.moveTo(bScreen.x, bScreen.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
}

export function computeRightMarkSizePx(radiusPx: number, strokePx: number): number {
  // Keep right-angle marker readable against current arc sizing.
  return Math.max(7, radiusPx * 0.34 + Math.max(0, strokePx) * 0.3);
}
