import { sub } from "../geo/geometry";
import type { Vec2 } from "../geo/vec2";
import type { SceneModel } from "../scene/points";
import {
  clamp01,
  collectArrowPositions,
  drawArrowPlacements,
  resolveEndArrowPlacements,
  resolveMidArrowPlacements,
  segmentArrowHeadSize,
} from "./pathArrowRender";

export function drawSegmentMarkOverlay(
  ctx: CanvasRenderingContext2D,
  p1: Vec2,
  p2: Vec2,
  style: SceneModel["segments"][number]["style"]
): void {
  const mark = style.segmentMark;
  if (!mark?.enabled || mark.mark === "none") return;
  const d = sub(p2, p1);
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-6) return;
  const ux = d.x / len;
  const uy = d.y / len;
  const nx = -uy;
  const ny = ux;
  const pos = clamp01(mark.pos);
  const cx = p1.x + ux * (len * pos);
  const cy = p1.y + uy * (len * pos);
  const size = Math.max(1, mark.sizePt);
  const tickHalf = size * 2.2;
  const gap = Math.max(2, size * 0.85);
  const lineWidth = Math.max(0.5, mark.lineWidthPt ?? style.strokeWidth);
  const color = mark.color ?? style.strokeColor;

  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = style.opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawTick = (offsetAlong: number) => {
    const ox = cx + ux * offsetAlong;
    const oy = cy + uy * offsetAlong;
    ctx.beginPath();
    ctx.moveTo(ox - nx * tickHalf, oy - ny * tickHalf);
    ctx.lineTo(ox + nx * tickHalf, oy + ny * tickHalf);
    ctx.stroke();
  };

  const drawSlash = (offsetAlong: number) => {
    const ox = cx + ux * offsetAlong;
    const oy = cy + uy * offsetAlong;
    ctx.beginPath();
    ctx.moveTo(ox - ux * tickHalf - nx * tickHalf * 0.55, oy - uy * tickHalf - ny * tickHalf * 0.55);
    ctx.lineTo(ox + ux * tickHalf + nx * tickHalf * 0.55, oy + uy * tickHalf + ny * tickHalf * 0.55);
    ctx.stroke();
  };

  switch (mark.mark) {
    case "|":
      drawTick(0);
      break;
    case "||":
      drawTick(-gap * 0.5);
      drawTick(gap * 0.5);
      break;
    case "|||":
      drawTick(-gap);
      drawTick(0);
      drawTick(gap);
      break;
    case "s":
      drawSlash(0);
      break;
    case "s|":
      drawSlash(-gap * 0.5);
      drawTick(gap * 0.5);
      break;
    case "s||":
      drawSlash(-gap);
      drawTick(0);
      drawTick(gap);
      break;
    case "x":
      ctx.beginPath();
      ctx.moveTo(cx - nx * size - ux * size * 0.6, cy - ny * size - uy * size * 0.6);
      ctx.lineTo(cx + nx * size + ux * size * 0.6, cy + ny * size + uy * size * 0.6);
      ctx.moveTo(cx - nx * size + ux * size * 0.6, cy - ny * size + uy * size * 0.6);
      ctx.lineTo(cx + nx * size - ux * size * 0.6, cy + ny * size - uy * size * 0.6);
      ctx.stroke();
      break;
    case "o":
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.2, size * 0.6), 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "oo":
      ctx.beginPath();
      ctx.arc(cx - ux * gap * 0.55, cy - uy * gap * 0.55, Math.max(1.2, size * 0.55), 0, Math.PI * 2);
      ctx.arc(cx + ux * gap * 0.55, cy + uy * gap * 0.55, Math.max(1.2, size * 0.55), 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "z":
      ctx.beginPath();
      ctx.moveTo(cx - ux * gap - nx * size * 0.8, cy - uy * gap - ny * size * 0.8);
      ctx.lineTo(cx + ux * gap + nx * size * 0.8, cy + uy * gap - ny * size * 0.2);
      ctx.lineTo(cx - ux * gap - nx * size * 0.8, cy - uy * gap + ny * size * 0.8);
      ctx.lineTo(cx + ux * gap + nx * size * 0.8, cy + uy * gap + ny * size * 0.2);
      ctx.stroke();
      break;
    default:
      break;
  }

  ctx.restore();
}

export function drawSegmentArrowOverlay(
  ctx: CanvasRenderingContext2D,
  p1: Vec2,
  p2: Vec2,
  style: SceneModel["segments"][number]["style"]
): void {
  const arrow = style.segmentArrowMark;
  if (!arrow?.enabled) return;
  const d = sub(p2, p1);
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-6) return;
  const ux = d.x / len;
  const uy = d.y / len;
  const color = arrow.color ?? style.strokeColor;
  const fallbackWidth = Number.isFinite(style.strokeWidth) && style.strokeWidth > 0 ? style.strokeWidth : 1;
  const lineWidthPt =
    typeof arrow.lineWidthPt === "number" && Number.isFinite(arrow.lineWidthPt) ? arrow.lineWidthPt : fallbackWidth;
  const lineWidth = Math.max(0.5, lineWidthPt);
  const { headSize, separation } = segmentArrowHeadSize(lineWidth, arrow.sizeScale);

  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = Number.isFinite(style.opacity) ? clamp01(style.opacity) : 1;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (arrow.mode === "end") {
    const placements = resolveEndArrowPlacements(p1, p2, ux, uy, arrow.direction);
    drawArrowPlacements(ctx, placements, headSize, arrow.tip);
    ctx.restore();
    return;
  }
  const positions = collectArrowPositions(arrow, style.segmentMark?.pos ?? 0.5);
  for (let i = 0; i < positions.length; i += 1) {
    const t = clamp01(positions[i]);
    const tip = { x: p1.x + ux * len * t, y: p1.y + uy * len * t };
    const placements = resolveMidArrowPlacements(tip, ux, uy, arrow.direction, separation);
    drawArrowPlacements(ctx, placements, headSize, arrow.tip);
  }
  ctx.restore();
}
