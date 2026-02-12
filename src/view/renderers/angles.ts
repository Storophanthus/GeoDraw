import type { Vec2 } from "../../geo/vec2";
import type { SceneModel } from "../../scene/points";
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
    } else if (angle.style.markStyle === "right") {
      drawRightAngleMark(ctx, as, bs, cs, radiusPx * 0.55);
      ctx.stroke();
    } else if (angle.style.markStyle === "arc") {
      drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx);
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
      } else if (angle.style.markStyle === "right") {
        drawRightAngleMark(ctx, as, bs, cs, radiusPx * 0.63);
        ctx.stroke();
      } else if (angle.style.markStyle === "arc") {
        drawAngleArcPreview(ctx, as, bs, entry.theta, radiusPx + 2);
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
