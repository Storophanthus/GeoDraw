import { getPointWorldPos, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { resolveCanvasFillStyle } from "../patternFill";
import { applyStrokeDash } from "../strokeStyle";
import type { DrawableObjectSelection } from "./types";

function edgeKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`;
}

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
  const ownedEdgeVisibility = new Map<string, boolean>();
  for (const seg of scene.segments) {
    if (!Array.isArray(seg.ownedByPolygonIds) || seg.ownedByPolygonIds.length === 0) continue;
    const key = edgeKey(seg.aId, seg.bId);
    for (const polygonId of seg.ownedByPolygonIds) {
      const scopedKey = `${polygonId}::${key}`;
      const prev = ownedEdgeVisibility.get(scopedKey);
      ownedEdgeVisibility.set(scopedKey, prev === undefined ? seg.visible : prev || seg.visible);
    }
  }

  for (const polygon of scene.polygons) {
    if (!polygon.visible || polygon.pointIds.length < 3) continue;
    const worldPoints = polygon.pointIds.map((id) => {
      const point = scene.points.find((candidate) => candidate.id === id);
      return point ? getPointWorldPos(point, scene) : null;
    });
    if (worldPoints.some((world) => !world)) continue;
    const screenPoints = worldPoints.map((world) => camMath.worldToScreen(world!, camera, vp));

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
    for (let i = 0; i < polygon.pointIds.length; i += 1) {
      const nextIndex = (i + 1) % polygon.pointIds.length;
      const scopedKey = `${polygon.id}::${edgeKey(polygon.pointIds[i], polygon.pointIds[nextIndex])}`;
      const edgeVisible = ownedEdgeVisibility.has(scopedKey) ? Boolean(ownedEdgeVisibility.get(scopedKey)) : true;
      if (!edgeVisible) continue;
      ctx.beginPath();
      ctx.moveTo(screenPoints[i].x, screenPoints[i].y);
      ctx.lineTo(screenPoints[nextIndex].x, screenPoints[nextIndex].y);
      ctx.stroke();
    }

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
