import { getCircleWorldGeometry, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { applyStrokeDash } from "../strokeStyle";
import type { DrawableObjectSelection } from "./types";

export function drawCircles(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  copySource: DrawableObjectSelection
): void {
  ctx.save();
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) continue;
    const c = camMath.worldToScreen(geom.center, camera, vp);
    const r = geom.radius * camera.zoom;
    applyStrokeDash(ctx, circle.style.strokeDash, circle.style.strokeWidth);
    if ((circle.style.fillOpacity ?? 0) > 0 && circle.style.fillColor) {
      ctx.globalAlpha = circle.style.fillOpacity ?? 0;
      ctx.fillStyle = circle.style.fillColor;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = circle.style.strokeColor;
    ctx.globalAlpha = circle.style.strokeOpacity;
    ctx.lineWidth = circle.style.strokeWidth;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();

    if (selectedObject?.type === "circle" && selectedObject.id === circle.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "circle" && recentCreatedObject.id === circle.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = circle.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (copySource?.type === "circle" && copySource.id === circle.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = circle.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
