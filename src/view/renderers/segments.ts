import { getPointWorldPos, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { drawSegmentArrowOverlay, drawSegmentMarkOverlay } from "../segmentOverlayRender";
import { applyStrokeDash } from "../strokeStyle";
import type { DrawableObjectSelection } from "./types";

export function drawSegments(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  copySource: DrawableObjectSelection
): void {
  ctx.save();

  for (const seg of scene.segments) {
    if (!seg.visible) continue;
    const aPoint = scene.points.find((p) => p.id === seg.aId);
    const bPoint = scene.points.find((p) => p.id === seg.bId);
    if (!aPoint || !bPoint) continue;
    const a = getPointWorldPos(aPoint, scene);
    const b = getPointWorldPos(bPoint, scene);
    if (!a || !b) continue;

    const p1 = camMath.worldToScreen(a, camera, vp);
    const p2 = camMath.worldToScreen(b, camera, vp);

    applyStrokeDash(ctx, seg.style.dash, seg.style.strokeWidth);
    ctx.strokeStyle = seg.style.strokeColor;
    ctx.globalAlpha = seg.style.opacity;
    ctx.lineWidth = seg.style.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    drawSegmentMarkOverlay(ctx, p1, p2, seg.style);
    drawSegmentArrowOverlay(ctx, p1, p2, seg.style);

    if (selectedObject?.type === "segment" && selectedObject.id === seg.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "segment" && recentCreatedObject.id === seg.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = seg.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    if (copySource?.type === "segment" && copySource.id === seg.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = seg.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}
