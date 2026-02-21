import type { Vec2 } from "../geo/vec2";
import type { SceneModel, ScenePoint } from "../scene/points";
import { camera as camMath, type Camera, type Viewport } from "./camera";

export type ResolvedPoint = { point: ScenePoint; world: Vec2 };
export type ResolvedAngle = { angle: SceneModel["angles"][number]; a: Vec2; b: Vec2; c: Vec2; theta: number };
export type ObjectLabelHit = { type: "segment" | "line" | "circle" | "polygon"; id: string };

export function hitTestPointLabel(
  screenPoint: Vec2,
  points: ResolvedPoint[],
  camera: Camera,
  vp: Viewport,
  defaultOffset: Vec2
): string | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const { point, world } = points[i];
    if (!point.visible || point.showLabel === "none") continue;
    const p = camMath.worldToScreen(world, camera, vp);
    const labelOffset = point.style.labelOffsetPx ?? defaultOffset;
    const labelText = point.showLabel === "name" ? point.name : point.captionTex;
    if (!labelText) continue;
    const fontPx = point.style.labelFontPx ?? 16;
    const x = p.x + labelOffset.x - 2;
    const y = p.y + labelOffset.y - fontPx * 0.65;
    const w = Math.max(18, labelText.length * (fontPx * 0.58) + 8);
    const h = Math.max(16, fontPx * 1.2);
    if (screenPoint.x >= x && screenPoint.x <= x + w && screenPoint.y >= y && screenPoint.y <= y + h) {
      return point.id;
    }
  }
  return null;
}

export function hitTestAngleLabelHandle(
  screenPoint: Vec2,
  resolvedAngles: ResolvedAngle[],
  camera: Camera,
  vp: Viewport,
  toRenderTextSize: (rawTextSize: number) => number
): string | null {
  for (let i = resolvedAngles.length - 1; i >= 0; i -= 1) {
    const entry = resolvedAngles[i];
    if (!entry.angle.visible) continue;
    const labelScreen = camMath.worldToScreen(entry.angle.style.labelPosWorld, camera, vp);
    const grabRadius = Math.max(16, toRenderTextSize(entry.angle.style.textSize) * 0.8);
    const d = Math.hypot(screenPoint.x - labelScreen.x, screenPoint.y - labelScreen.y);
    if (d <= grabRadius) return entry.angle.id;
  }
  return null;
}

export function hitTestPointLabelFromDom(
  clientX: number,
  clientY: number,
  labelsLayer: HTMLDivElement | null
): string | null {
  if (!labelsLayer) return null;
  const labels = labelsLayer.querySelectorAll<HTMLElement>(".pointLabel[data-point-id]");
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const el = labels[i];
    const rect = el.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return el.dataset.pointId ?? null;
    }
  }
  return null;
}

export function hitTestObjectLabelFromDom(
  clientX: number,
  clientY: number,
  labelsLayer: HTMLDivElement | null
): ObjectLabelHit | null {
  if (!labelsLayer) return null;
  const labels = labelsLayer.querySelectorAll<HTMLElement>(".pointLabel[data-object-type][data-object-id]");
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const el = labels[i];
    const rect = el.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
    const objectType = el.dataset.objectType;
    const objectId = el.dataset.objectId;
    if (!objectId) continue;
    if (objectType !== "segment" && objectType !== "line" && objectType !== "circle" && objectType !== "polygon") continue;
    return {
      type: objectType,
      id: objectId,
    };
  }
  return null;
}
