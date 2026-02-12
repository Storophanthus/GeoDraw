import { add, mul, sub } from "../../geo/geometry";
import { getLineWorldAnchors, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { applyStrokeDash } from "../strokeStyle";
import type { DrawableObjectSelection } from "./types";

export function drawLines(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  copySource: DrawableObjectSelection
): void {
  ctx.save();

  for (const line of scene.lines) {
    if (!line.visible) continue;
    const anchors = getLineWorldAnchors(line, scene);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) continue;

    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) continue;

    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const p1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const p2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);

    applyStrokeDash(ctx, line.style.dash, line.style.strokeWidth);
    ctx.strokeStyle = line.style.strokeColor;
    ctx.globalAlpha = line.style.opacity;
    ctx.lineWidth = line.style.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    if (selectedObject?.type === "line" && selectedObject.id === line.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "line" && recentCreatedObject.id === line.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = line.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    if (copySource?.type === "line" && copySource.id === line.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = line.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}
