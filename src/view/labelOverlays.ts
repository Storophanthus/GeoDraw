import katex from "katex";
import type { Vec2 } from "../geo/vec2";
import type { SceneModel, ScenePoint } from "../scene/points";
import type { Camera, Viewport } from "./camera";
import { camera as camMath } from "./camera";

export type ResolvedAngle = {
  angle: SceneModel["angles"][number];
  a: Vec2;
  b: Vec2;
  c: Vec2;
  theta: number;
};

export type PointLabelOverlay = {
  id: string;
  x: number;
  y: number;
  html: string;
  labelFontPx: number;
  labelColor: string;
  labelHaloColor: string;
  labelHaloWidthPx: number;
};

export type AngleLabelOverlay = {
  id: string;
  x: number;
  y: number;
  html: string;
  textSize: number;
  textColor: string;
};

export function getAngleTextRenderSize(rawTextSize: number): number {
  return Math.max(8, rawTextSize * (25 / 16));
}

export function buildAngleLabelTex(
  labelTextRaw: string,
  showLabel: boolean,
  showValue: boolean,
  thetaRad: number
): string | null {
  const custom = (labelTextRaw || "").trim();
  const valueDeg = `${((thetaRad * 180) / Math.PI).toFixed(2)}^{\\circ}`;
  if (!showLabel && !showValue) return null;
  if (showLabel && custom.length > 0) return showValue ? `${custom}=${valueDeg}` : custom;
  if (showValue) return valueDeg;
  return null;
}

export function createPointLabelOverlays(
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  camera: Camera,
  vp: Viewport
): PointLabelOverlay[] {
  return resolvedPoints
    .filter(({ point }) => point.visible && point.showLabel === "caption" && Boolean(point.captionTex))
    .map(({ point, world }) => {
      const screen = camMath.worldToScreen(world, camera, vp);
      const offset = point.style.labelOffsetPx;
      const html = katex.renderToString(point.captionTex || "", {
        throwOnError: false,
        displayMode: false,
        strict: "ignore",
      });
      return {
        id: point.id,
        x: screen.x + offset.x,
        y: screen.y + offset.y,
        html,
        labelFontPx: point.style.labelFontPx,
        labelColor: point.style.labelColor,
        labelHaloColor: point.style.labelHaloColor,
        labelHaloWidthPx: point.style.labelHaloWidthPx,
      };
    });
}

export function createAngleLabelOverlays(
  resolvedAngles: ResolvedAngle[],
  camera: Camera,
  vp: Viewport
): AngleLabelOverlay[] {
  return resolvedAngles
    .filter(({ angle }) => angle.visible)
    .map(({ angle, theta }) => {
      const tex = buildAngleLabelTex(angle.style.labelText, angle.style.showLabel, angle.style.showValue, theta);
      if (!tex) return null;
      const screen = camMath.worldToScreen(angle.style.labelPosWorld, camera, vp);
      const html = katex.renderToString(tex, {
        throwOnError: false,
        displayMode: false,
        strict: "ignore",
      });
      return {
        id: angle.id,
        x: screen.x,
        y: screen.y,
        html,
        textSize: getAngleTextRenderSize(angle.style.textSize),
        textColor: angle.style.textColor,
      };
    })
    .filter((item): item is AngleLabelOverlay => Boolean(item));
}
