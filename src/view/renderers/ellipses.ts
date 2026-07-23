import { getEllipseWorldGeometry, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { resolveCanvasFillStyle } from "../patternFill";
import { applyStrokeDash } from "../strokeStyle";
import type { DrawableObjectSelection } from "./types";

export function drawEllipseObject(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  ellipseId: string,
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  copySource: DrawableObjectSelection
): void {
  const ellipse = (scene.ellipses ?? []).find((item) => item.id === ellipseId);
  if (!ellipse || !ellipse.visible) return;
  const geom = getEllipseWorldGeometry(ellipse, scene);
  if (!geom) return;

  const center = camMath.worldToScreen(geom.center, camera, vp);
  const rx = geom.semiMajor * camera.zoom;
  const ry = geom.semiMinor * camera.zoom;
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 1e-9 || ry <= 1e-9) return;
  if (!ellipseScreenMightTouchViewport(center.x, center.y, rx, ry, geom.rotationRad, vp.widthPx, vp.heightPx)) return;

  const rotation = -geom.rotationRad;
  applyStrokeDash(ctx, ellipse.style.strokeDash, ellipse.style.strokeWidth);

  if ((ellipse.style.fillOpacity ?? 0) > 0 && ellipse.style.fillColor) {
    ctx.globalAlpha = ellipse.style.fillOpacity ?? 0;
    ctx.fillStyle = resolveCanvasFillStyle(
      ctx,
      ellipse.style.fillColor,
      ellipse.style.pattern,
      ellipse.style.patternColor
    );
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, rotation, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = ellipse.style.strokeColor;
  ctx.globalAlpha = ellipse.style.strokeOpacity;
  ctx.lineWidth = ellipse.style.strokeWidth;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.stroke();

  if (selectedObject?.type === "ellipse" && selectedObject.id === ellipse.id) {
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    const isNew = recentCreatedObject?.type === "ellipse" && recentCreatedObject.id === ellipse.id;
    ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
    ctx.lineWidth = ellipse.style.strokeWidth + (isNew ? 1.5 : 1.6);
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, rotation, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (copySource?.type === "ellipse" && copySource.id === ellipse.id) {
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = ellipse.style.strokeWidth + 3;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, rotation, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function ellipseScreenMightTouchViewport(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotationRad: number,
  width: number,
  height: number
): boolean {
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const xExtent = Math.sqrt((rx * cos) ** 2 + (ry * sin) ** 2);
  const yExtent = Math.sqrt((rx * sin) ** 2 + (ry * cos) ** 2);
  return cx + xExtent >= -2 && cx - xExtent <= width + 2 && cy + yExtent >= -2 && cy - yExtent <= height + 2;
}
