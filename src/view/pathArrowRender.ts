import type { ArrowDirection, ArrowTipStyle, PathArrowMark, SegmentArrowMark } from "../scene/points";
import type { Vec2 } from "../geo/vec2";

const PATH_ARROW_CANVAS_WIDTH_UI_FACTOR = 8;

export type ArrowHeadPlacement = {
  tip: Vec2;
  dirX: number;
  dirY: number;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function resolveArrowTipStyle(tip: ArrowTipStyle | undefined): ArrowTipStyle {
  return tip === "Latex" || tip === "Triangle" || tip === "Stealth" ? tip : "Stealth";
}

export function collectArrowPositions(
  arrow: Pick<PathArrowMark, "distribution" | "pos" | "startPos" | "endPos" | "step">,
  fallbackPos: number
): number[] {
  const distribution = arrow.distribution ?? "single";
  if (distribution !== "multi") return [clamp01(arrow.pos ?? fallbackPos)];
  let start = clamp01(arrow.startPos ?? 0.45);
  let end = clamp01(arrow.endPos ?? 0.55);
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  const step = Math.max(0.01, Math.min(1, arrow.step ?? 0.05));
  const out: number[] = [];
  for (let t = start; t <= end + 1e-9 && out.length < 500; t += step) {
    out.push(clamp01(t));
  }
  if (out.length === 0) out.push(clamp01(arrow.pos ?? fallbackPos));
  return out;
}

export function resolveEndArrowPlacements(
  p1: Vec2,
  p2: Vec2,
  ux: number,
  uy: number,
  direction: ArrowDirection
): ArrowHeadPlacement[] {
  if (direction === "->") return [{ tip: p2, dirX: ux, dirY: uy }];
  if (direction === "<-") return [{ tip: p1, dirX: -ux, dirY: -uy }];
  if (direction === "<->") {
    return [
      { tip: p2, dirX: ux, dirY: uy },
      { tip: p1, dirX: -ux, dirY: -uy },
    ];
  }
  return [
    { tip: p1, dirX: ux, dirY: uy },
    { tip: p2, dirX: -ux, dirY: -uy },
  ];
}

export function resolveMidArrowPlacements(
  center: Vec2,
  ux: number,
  uy: number,
  direction: ArrowDirection,
  separationPx: number
): ArrowHeadPlacement[] {
  if (direction === "->") return [{ tip: center, dirX: ux, dirY: uy }];
  if (direction === "<-") return [{ tip: center, dirX: -ux, dirY: -uy }];
  const sx = ux * separationPx;
  const sy = uy * separationPx;
  if (direction === "<->") {
    return [
      { tip: { x: center.x + sx, y: center.y + sy }, dirX: ux, dirY: uy },
      { tip: { x: center.x - sx, y: center.y - sy }, dirX: -ux, dirY: -uy },
    ];
  }
  return [
    { tip: { x: center.x - sx, y: center.y - sy }, dirX: ux, dirY: uy },
    { tip: { x: center.x + sx, y: center.y + sy }, dirX: -ux, dirY: -uy },
  ];
}

export function drawArrowPlacements(
  ctx: CanvasRenderingContext2D,
  placements: ArrowHeadPlacement[],
  headSize: number,
  tipStyle: ArrowTipStyle | undefined,
  widthScale = 1
): void {
  const resolvedTipStyle = resolveArrowTipStyle(tipStyle);
  for (let i = 0; i < placements.length; i += 1) {
    const placement = placements[i];
    drawArrowHead(ctx, placement.tip, placement.dirX, placement.dirY, headSize, resolvedTipStyle, widthScale);
  }
}

export function segmentArrowHeadSize(
  lineWidth: number,
  sizeScale: number | undefined
): { headSize: number; separation: number; widthScale: number } {
  const scale = Math.max(0.2, Math.min(8, sizeScale ?? 1));
  const widthScale = Math.sqrt(Math.max(0.2, Math.min(12, lineWidth)));
  // Size controls tip length. Width is handled separately via wing scale.
  const headSize = Math.max(6, 8 * scale);
  // Keep clear separation between paired arrows; include width contribution.
  const separation = Math.max(3, Math.max(headSize * 1.6, headSize * 1.2 * widthScale));
  return { headSize, separation, widthScale };
}

export function arrowCanvasLineWidthFromStoredPt(lineWidthPt: number): number {
  if (!Number.isFinite(lineWidthPt) || lineWidthPt <= 0) return 0.5;
  const width = lineWidthPt / PATH_ARROW_CANVAS_WIDTH_UI_FACTOR;
  return Math.max(0.5, width);
}

export function isSupportedArrowDirection(direction: unknown): direction is ArrowDirection {
  return direction === "->" || direction === "<-" || direction === "<->" || direction === ">-<";
}

export function isSupportedArrowTipStyle(tip: unknown): tip is ArrowTipStyle {
  return tip === "Stealth" || tip === "Latex" || tip === "Triangle";
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: Vec2,
  dirX: number,
  dirY: number,
  headSize: number,
  tipStyle: ArrowTipStyle,
  widthScale: number
): void {
  const profile =
    tipStyle === "Latex"
      ? { lengthMul: 0.92, wingMul: 0.35, notchMul: 0 }
      : tipStyle === "Triangle"
      ? { lengthMul: 1.02, wingMul: 0.58, notchMul: 0 }
      : { lengthMul: 1.05, wingMul: 0.47, notchMul: 0.2 };
  const len = headSize * profile.lengthMul;
  const wing = headSize * profile.wingMul * widthScale;
  const backX = tip.x - dirX * len;
  const backY = tip.y - dirY * len;
  const nx = -dirY;
  const ny = dirX;

  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(backX + nx * wing, backY + ny * wing);
  if (profile.notchMul > 0) {
    const notchX = tip.x - dirX * (len * (1 - profile.notchMul));
    const notchY = tip.y - dirY * (len * (1 - profile.notchMul));
    ctx.lineTo(notchX, notchY);
  }
  ctx.lineTo(backX - nx * wing, backY - ny * wing);
  ctx.closePath();
  ctx.fill();
}

export function asPathArrowMark(arrow: SegmentArrowMark | PathArrowMark): PathArrowMark {
  const {
    enabled,
    direction,
    tip,
    pos,
    distribution,
    startPos,
    endPos,
    step,
    sizeScale,
    color,
    lineWidthPt,
  } = arrow;
  return { enabled, direction, tip, pos, distribution, startPos, endPos, step, sizeScale, color, lineWidthPt };
}
