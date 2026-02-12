import type { Vec2 } from "../../geo/vec2";
import type { SceneModel } from "../../scene/points";
import { isRightAngle } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { drawAngleArcPreview, drawAngleSector, drawRightAngleMark } from "../angleRender";
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
    const radiusPx = Math.max(12, angle.style.arcRadius * camera.zoom);
    const isSector = angle.kind === "sector";
    const right = isRightAngle(a, b, c);
    const resolvedMarkStyle =
      angle.style.markStyle === "right"
        ? "rightSquare"
        : (angle.style.markStyle as "arc" | "none" | "rightSquare" | "rightArcDot");
    const markSizePx = Math.max(3, (angle.style.markSize ?? 4) * camera.zoom * 0.06);

    ctx.save();
    if (angle.style.fillEnabled && angle.style.fillOpacity > 0) {
      ctx.globalAlpha = angle.style.fillOpacity;
      ctx.fillStyle = resolveCanvasFillStyle(
        ctx,
        angle.style.fillColor,
        angle.style.pattern,
        angle.style.patternColor
      );
      drawAngleSector(ctx, as, bs, entry.theta, radiusPx);
      ctx.fill();
    }
    ctx.globalAlpha = angle.style.strokeOpacity;
    ctx.strokeStyle = angle.style.strokeColor;
    ctx.lineWidth = mapStrokeWidth(angle.style.strokeWidth);
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
      if (right && resolvedMarkStyle === "rightSquare") {
        drawRightAngleMark(ctx, as, bs, cs, radiusPx * 0.55);
        ctx.stroke();
      } else {
        drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx);
        if (!right) {
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
            angle.style.markColor ?? angle.style.strokeColor
          );
        } else if (resolvedMarkStyle === "rightArcDot") {
          drawRightInnerDot(ctx, as, bs, entry.theta, radiusPx * 0.7, Math.max(2, ctx.lineWidth * 0.8));
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
        if (right && resolvedMarkStyle === "rightSquare") {
          drawRightAngleMark(ctx, as, bs, cs, radiusPx * 0.63);
          ctx.stroke();
        } else {
          drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx + 2);
          if (!right) {
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
  markColor: string
): void {
  const count = mark === "|" ? 1 : mark === "||" ? 2 : mark === "|||" ? 3 : 0;
  if (count === 0) return;
  const start = Math.atan2(a.y - b.y, a.x - b.x);
  const p = Math.max(0.1, Math.min(0.9, Number.isFinite(pos) ? pos : 0.5));
  const mid = start - theta * p;
  const nx = Math.cos(mid);
  const ny = Math.sin(mid);
  const tx = -ny;
  const ty = nx;
  ctx.save();
  ctx.strokeStyle = markColor;
  const spacing = markSize * 1.25;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) * 0.5) * spacing;
    const cx = b.x + nx * (radius + offset);
    const cy = b.y + ny * (radius + offset);
    ctx.beginPath();
    ctx.moveTo(cx - tx * markSize, cy - ty * markSize);
    ctx.lineTo(cx + tx * markSize, cy + ty * markSize);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRightInnerDot(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  theta: number,
  radius: number,
  dotRadius: number
): void {
  const start = Math.atan2(a.y - b.y, a.x - b.x);
  const mid = start - theta * 0.5;
  const cx = b.x + Math.cos(mid) * radius;
  const cy = b.y + Math.sin(mid) * radius;
  ctx.beginPath();
  ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}
