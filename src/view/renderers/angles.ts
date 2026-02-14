import type { Vec2 } from "../../geo/vec2";
import type { SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import {
  computeRightMarkSizePx,
  drawAngleArcPreview,
  drawAngleSector,
  nonSectorAngleRadiusPx,
  drawRightAngleMark,
  drawRightAngleSquareFill,
} from "../angleRender";
import { resolveCanvasFillStyle } from "../patternFill";
import type { DrawableObjectSelection } from "./types";

export type ResolvedAngleForRender = {
  angle: SceneModel["angles"][number];
  a: Vec2;
  b: Vec2;
  c: Vec2;
  theta: number;
};

export function drawAngles(
  ctx: CanvasRenderingContext2D,
  resolvedAngles: ResolvedAngleForRender[],
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  mapStrokeWidth: (raw: number) => number
): void {
  for (const entry of resolvedAngles) {
    const { angle, a, b, c } = entry;
    if (!angle.visible) continue;
    const as = camMath.worldToScreen(a, camera, vp);
    const bs = camMath.worldToScreen(b, camera, vp);
    const cs = camMath.worldToScreen(c, camera, vp);
    const isSector = angle.kind === "sector";
    const radiusPx = isSector
      ? Math.max(2, Math.hypot(as.x - bs.x, as.y - bs.y))
      : nonSectorAngleRadiusPx(angle.style.arcRadius);
    const rightExact = Boolean(angle.isRightExact);
    const rightApprox = !rightExact && Boolean(angle.isRightApprox);
    const rightLike = rightExact || rightApprox;
    const rightSolid = rightExact || (rightApprox && Boolean(angle.style.promoteToSolid));
    const rawMarkStyle = angle.style.markStyle === "right" ? "rightSquare" : angle.style.markStyle;
    const drawRightSquareShape = rawMarkStyle === "rightSquare" || (rightLike && rawMarkStyle === "arc");
    const resolvedMarkStyle = (drawRightSquareShape ? "rightSquare" : rawMarkStyle) as
      | "arc"
      | "none"
      | "rightSquare"
      | "rightArcDot";
    const markSizePx = Math.max(3, Math.min(16, angle.style.markSize ?? 4));
    const rightMarkSizePx = computeRightMarkSizePx(radiusPx, mapStrokeWidth(angle.style.strokeWidth));

    ctx.save();
    if (angle.style.fillEnabled && angle.style.fillOpacity > 0) {
      ctx.globalAlpha = angle.style.fillOpacity;
      ctx.fillStyle = resolveCanvasFillStyle(
        ctx,
        angle.style.fillColor,
        angle.style.pattern,
        angle.style.patternColor
      );
      if (resolvedMarkStyle === "rightSquare") {
        drawRightAngleSquareFill(ctx, as, bs, cs, rightMarkSizePx);
      } else {
        drawAngleSector(ctx, as, bs, entry.theta, radiusPx);
      }
      ctx.fill();
    }
    ctx.globalAlpha = angle.style.strokeOpacity;
    ctx.strokeStyle = angle.style.strokeColor;
    ctx.lineWidth = mapStrokeWidth(angle.style.strokeWidth);
    const approxDashed =
      !isSector && rightApprox && !rightSolid && (resolvedMarkStyle === "rightSquare" || resolvedMarkStyle === "rightArcDot");
    if (approxDashed) ctx.setLineDash([6, 4]);
    if (isSector) {
      const dash = angle.style.strokeDash ?? "solid";
      if (dash === "dashed") ctx.setLineDash([7, 5]);
      else if (dash === "dotted") ctx.setLineDash([2, 4]);
    }
    if (isSector) {
      const start = Math.atan2(as.y - bs.y, as.x - bs.x);
      const end = start - entry.theta;
      ctx.beginPath();
      ctx.moveTo(bs.x, bs.y);
      ctx.lineTo(bs.x + Math.cos(start) * radiusPx, bs.y + Math.sin(start) * radiusPx);
      ctx.arc(bs.x, bs.y, radiusPx, start, end, true);
      ctx.lineTo(bs.x, bs.y);
      ctx.stroke();
    } else if (resolvedMarkStyle !== "none") {
      if (rightLike && resolvedMarkStyle === "rightSquare") {
        drawRightAngleMark(ctx, as, bs, cs, rightMarkSizePx);
        ctx.stroke();
      } else {
        drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx);
        if (!rightLike) {
          if ((angle.style.arcMultiplicity ?? 1) >= 2) drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx + 6);
          if ((angle.style.arcMultiplicity ?? 1) >= 3) drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx + 12);
          drawArcBarMarks(
            ctx,
            as,
            bs,
            entry.theta,
            radiusPx,
            angle.style.markSymbol ?? "none",
            markSizePx,
            angle.style.markPos ?? 0.5,
            angle.style.markColor ?? angle.style.strokeColor,
            mapStrokeWidth(angle.style.strokeWidth)
          );
        } else if (resolvedMarkStyle === "rightArcDot") {
          drawRightInnerDot(ctx, as, bs, cs, rightMarkSizePx, Math.max(1.8, Math.min(4.5, rightMarkSizePx * 0.18)));
        }
      }
    }

    if (selectedObject?.type === "angle" && selectedObject.id === angle.id) {
      const isNew = recentCreatedObject?.type === "angle" && recentCreatedObject.id === angle.id;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = mapStrokeWidth(angle.style.strokeWidth) + (isNew ? 1.5 : 1.6);
      if (isSector) {
        const start = Math.atan2(as.y - bs.y, as.x - bs.x);
        const end = start - entry.theta;
        ctx.beginPath();
        ctx.moveTo(bs.x, bs.y);
        ctx.lineTo(bs.x + Math.cos(start) * (radiusPx + 2), bs.y + Math.sin(start) * (radiusPx + 2));
        ctx.arc(bs.x, bs.y, radiusPx + 2, start, end, true);
        ctx.lineTo(bs.x, bs.y);
        ctx.stroke();
      } else if (resolvedMarkStyle !== "none") {
        if (rightLike && resolvedMarkStyle === "rightSquare") {
          drawRightAngleMark(ctx, as, bs, cs, rightMarkSizePx + 2);
          ctx.stroke();
        } else {
          drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx + 2);
          if (!rightLike) {
            if ((angle.style.arcMultiplicity ?? 1) >= 2) drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx + 8);
            if ((angle.style.arcMultiplicity ?? 1) >= 3) drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx + 14);
          }
        }
      }
      const lScreen = camMath.worldToScreen(angle.style.labelPosWorld, camera, vp);
      ctx.beginPath();
      ctx.arc(lScreen.x, lScreen.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(245,158,11,0.85)";
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawArcBarMarks(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  theta: number,
  radius: number,
  mark: "none" | "|" | "||" | "|||",
  markSize: number,
  pos: number,
  markColor: string,
  strokeWidth: number
): void {
  const count = mark === "|" ? 1 : mark === "||" ? 2 : mark === "|||" ? 3 : 0;
  if (count === 0) return;
  const start = Math.atan2(a.y - b.y, a.x - b.x);
  const p = Math.max(0.1, Math.min(0.9, Number.isFinite(pos) ? pos : 0.5));
  const mid = start - theta * p;
  // Keep bars visually proportional to the arc radius and closer together like textbook marks.
  const tickHalf = Math.max(3.6, Math.min(radius * 0.4, markSize * 1.08 + radius * 0.09));
  const baseStep = Math.max(0.022, Math.min(0.075, (tickHalf * 0.54) / Math.max(1, radius)));
  ctx.save();
  ctx.strokeStyle = markColor;
  ctx.lineWidth = strokeWidth;
  for (let i = 0; i < count; i += 1) {
    // Bars are distributed along the arc (angle offset), not radially.
    const phi = mid + (i - (count - 1) * 0.5) * baseStep;
    const nx = Math.cos(phi);
    const ny = Math.sin(phi);
    const cx = b.x + nx * radius;
    const cy = b.y + ny * radius;
    ctx.beginPath();
    // Tick orientation should cross the arc like tkz marks (radial stroke).
    ctx.moveTo(cx - nx * tickHalf, cy - ny * tickHalf);
    ctx.lineTo(cx + nx * tickHalf, cy + ny * tickHalf);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRightInnerDot(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  c: Vec2,
  size: number,
  dotRadius: number
): void {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const uLen = Math.hypot(ux, uy);
  const vLen = Math.hypot(vx, vy);
  if (uLen <= 1e-9 || vLen <= 1e-9) return;
  const unx = ux / uLen;
  const uny = uy / uLen;
  const vnx = vx / vLen;
  const vny = vy / vLen;
  // Anchor dot on the right-mark geometry, so it scales and stays centered
  // consistently with the square counterpart.
  const t = size * 0.55;
  const cx = b.x + (unx + vnx) * t;
  const cy = b.y + (uny + vny) * t;
  ctx.beginPath();
  ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}
