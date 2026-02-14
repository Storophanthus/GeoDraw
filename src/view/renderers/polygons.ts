import { getPointWorldPos, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { resolveCanvasFillStyle } from "../patternFill";
import { applyStrokeDash } from "../strokeStyle";
import type { DrawableObjectSelection } from "./types";

export function drawPolygons(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  copySource: DrawableObjectSelection
): void {
  ctx.save();
  for (const polygon of scene.polygons) {
    if (!polygon.visible || polygon.pointIds.length < 3) continue;
    const screenPoints = polygon.pointIds
      .map((id) => scene.points.find((point) => point.id === id))
      .map((point) => (point ? getPointWorldPos(point, scene) : null))
      .filter((world): world is { x: number; y: number } => Boolean(world))
      .map((world) => camMath.worldToScreen(world, camera, vp));
    if (screenPoints.length < 3) continue;

    const fillOpacity = Math.max(0, Math.min(1, polygon.style.fillOpacity ?? 0));
    if (fillOpacity > 0 && polygon.style.fillColor) {
      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = resolveCanvasFillStyle(
        ctx,
        polygon.style.fillColor,
        polygon.style.pattern,
        polygon.style.patternColor
      );
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i += 1) {
        ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = Math.max(0, Math.min(1, polygon.style.strokeOpacity));
    applyStrokeDash(ctx, polygon.style.strokeDash, polygon.style.strokeWidth);
    ctx.strokeStyle = polygon.style.strokeColor;
    ctx.lineWidth = polygon.style.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i += 1) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    if (selectedObject?.type === "polygon" && selectedObject.id === polygon.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "polygon" && recentCreatedObject.id === polygon.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = polygon.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i += 1) {
        ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    if (copySource?.type === "polygon" && copySource.id === polygon.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = polygon.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i += 1) {
        ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}
