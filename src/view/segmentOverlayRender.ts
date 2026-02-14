import { sub } from "../geo/geometry";
import type { Vec2 } from "../geo/vec2";
import type { SceneModel } from "../scene/points";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

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
  const lineWidth = Math.max(0.5, arrow.lineWidthPt ?? style.strokeWidth);
  const headScale = Math.max(0.2, Math.min(8, arrow.sizeScale ?? 1));
  const headSize = Math.max(6, (7 + lineWidth * 1.2) * headScale);
  const pos = clamp01(arrow.pos ?? style.segmentMark?.pos ?? 0.5);
  const mid = { x: p1.x + ux * len * pos, y: p1.y + uy * len * pos };

  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = style.opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawArrowHead = (tip: Vec2, dirX: number, dirY: number) => {
    const nx = -dirY;
    const ny = dirX;
    const backX = tip.x - dirX * headSize;
    const backY = tip.y - dirY * headSize;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(backX + nx * (headSize * 0.45), backY + ny * (headSize * 0.45));
    ctx.lineTo(backX - nx * (headSize * 0.45), backY - ny * (headSize * 0.45));
    ctx.closePath();
    ctx.fill();
  };

  if (arrow.mode === "end") {
    if (arrow.direction === "->" || arrow.direction === "<->") drawArrowHead(p2, ux, uy);
    if (arrow.direction === "<-" || arrow.direction === "<->") drawArrowHead(p1, -ux, -uy);
    ctx.restore();
    return;
  }
  const distribution = arrow.distribution ?? "single";
  if (distribution === "multi") {
    let start = clamp01(arrow.startPos ?? 0.45);
    let end = clamp01(arrow.endPos ?? 0.55);
    const step = Math.max(0.01, Math.min(1, arrow.step ?? 0.05));
    if (end < start) {
      const t = start;
      start = end;
      end = t;
    }
    for (let t = start; t <= end + 1e-9; t += step) {
      const tip = { x: p1.x + ux * len * t, y: p1.y + uy * len * t };
      if (arrow.direction === "->" || arrow.direction === "<->") drawArrowHead(tip, ux, uy);
      if (arrow.direction === "<-" || arrow.direction === "<->") drawArrowHead(tip, -ux, -uy);
    }
  } else {
    if (arrow.direction === "->" || arrow.direction === "<->") drawArrowHead(mid, ux, uy);
    if (arrow.direction === "<-" || arrow.direction === "<->") drawArrowHead(mid, -ux, -uy);
  }
  ctx.restore();
}
