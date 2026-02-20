import type { ScenePoint } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { drawPointSymbol } from "../pointRender";
import type { DrawableObjectSelection } from "./types";

export type ResolvedPointForRender = { point: ScenePoint; world: { x: number; y: number } };

type PointCategory = "free" | "constrained" | "dependent";

function getPointCategory(point: ScenePoint): PointCategory {
  if (point.kind === "free") return "free";
  if (point.kind === "pointOnLine" || point.kind === "pointOnSegment" || point.kind === "pointOnCircle") {
    return "constrained";
  }
  return "dependent";
}

function getPointCategoryGlowColor(category: PointCategory): string {
  if (category === "free") return "rgba(59,130,246,0.35)";
  if (category === "constrained") return "rgba(16,185,129,0.35)";
  return "rgba(225,29,72,0.42)";
}

export function drawPoints(
  ctx: CanvasRenderingContext2D,
  resolvedPoints: ResolvedPointForRender[],
  selectedObject: DrawableObjectSelection,
  camera: Camera,
  vp: Viewport,
  copySource: DrawableObjectSelection,
  dependencyGlowEnabled: boolean,
  labelHaloColorOverride?: string
): void {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const labelStack = new Map<string, number>();

  for (const { point, world } of resolvedPoints) {
    if (!point.visible) continue;
    const p = camMath.worldToScreen(world, camera, vp);
    const selected = selectedObject?.type === "point" && selectedObject.id === point.id;
    const category = getPointCategory(point);

    if (dependencyGlowEnabled) {
      // Canvas-only visual cue for point category.
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(point.style.sizePx + 3.5, 6.5), 0, Math.PI * 2);
      ctx.strokeStyle = getPointCategoryGlowColor(category);
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = getPointCategoryGlowColor(category);
      ctx.stroke();
      ctx.restore();
    }

    drawPointSymbol(
      ctx,
      point.style.shape,
      p.x,
      p.y,
      point.style.sizePx,
      point.style.fillColor,
      point.style.fillOpacity,
      point.style.strokeColor,
      point.style.strokeWidth,
      point.style.strokeOpacity
    );

    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(point.style.sizePx + 3, 7), 0, Math.PI * 2);
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (copySource?.type === "point" && copySource.id === point.id) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(point.style.sizePx + 4.5, 8), 0, Math.PI * 2);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (point.showLabel === "name" && point.name) {
      const labelOffset = point.style.labelOffsetPx;
      const labelHaloColor = labelHaloColorOverride ?? point.style.labelHaloColor;
      const stackKey = `${Math.round(p.x * 2) / 2}:${Math.round(p.y * 2) / 2}`;
      const stackIndex = labelStack.get(stackKey) ?? 0;
      labelStack.set(stackKey, stackIndex + 1);
      const ring = Math.floor(stackIndex / 8) + 1;
      const angle = (stackIndex % 8) * (Math.PI / 4);
      const spread = stackIndex === 0 ? 0 : 10 * ring;
      const lx = p.x + labelOffset.x + Math.cos(angle) * spread;
      const ly = p.y + labelOffset.y + Math.sin(angle) * spread;
      ctx.font = `${point.style.labelFontPx}px system-ui`;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = labelHaloColor;
      ctx.lineWidth = point.style.labelHaloWidthPx;
      ctx.strokeText(point.name, lx, ly);
      ctx.fillStyle = point.style.labelColor;
      ctx.fillText(point.name, lx, ly);
    }
  }

  ctx.restore();
}
