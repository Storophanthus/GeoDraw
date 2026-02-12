import type { PointShape } from "../scene/points";

export function drawPointSymbol(
  ctx: CanvasRenderingContext2D,
  shape: PointShape,
  x: number,
  y: number,
  sizePx: number,
  fillColor: string,
  fillOpacity: number,
  strokeColor: string,
  strokeWidth: number,
  strokeOpacity: number
): void {
  const r = Math.max(1.5, sizePx);
  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.globalAlpha = fillOpacity;

  if (shape === "dot") {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.2, r * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (shape === "x" || shape === "plus" || shape === "cross") {
    ctx.globalAlpha = strokeOpacity;
    ctx.beginPath();
    if (shape === "x" || shape === "cross") {
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
    }
    if (shape === "plus" || shape === "cross") {
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case "diamond":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case "square":
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case "triUp":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x - r, y + r);
      ctx.closePath();
      break;
    case "triDown":
      ctx.moveTo(x, y + r);
      ctx.lineTo(x + r, y - r);
      ctx.lineTo(x - r, y - r);
      ctx.closePath();
      break;
  }
  ctx.fill();
  ctx.globalAlpha = strokeOpacity;
  ctx.stroke();
  ctx.restore();
}
