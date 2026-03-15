import katex from "katex";
import type { Vec2 } from "../geo/vec2";
import {
  resolveTextLabelAlignment,
  resolveTextLabelBoxWidthPx,
  resolveTextLabelBoxHeightPx,
  resolveTextLabelDisplayText,
  resolveTextLabelRenderMode,
  type SceneModel,
  type ScenePoint,
  type TextLabelRenderMode,
} from "../scene/points";
import {
  defaultObjectLabelPosWorld,
  defaultObjectLabelText,
  isFiniteLabelPosWorld,
  resolveObjectLabelText,
} from "../scene/objectLabels";
import { parseTextLabelRichText } from "../text/textLabelRichText";
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

export type ObjectLabelOverlay = {
  type: "segment" | "line" | "circle" | "polygon";
  id: string;
  x: number;
  y: number;
  html: string;
  textSize: number;
  textColor: string;
};

export type TextLabelOverlay = {
  id: string;
  x: number;
  y: number;
  html: string;
  textSize: number;
  textColor: string;
  rotationDeg: number;
  renderMode: TextLabelRenderMode;
  textAlign: "left" | "center" | "right";
  boxWidthPx: number | null;
  boxHeightPx: number | null;
};

// Keep free text-label size visually closer to exported TikZ font size.
export const TEXT_LABEL_CANVAS_SIZE_SCALE = 1.8;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMixedTextLabelHtml(source: string, liveOpenMath = false): string {
  const segments = parseTextLabelRichText(source, { liveOpenMath });
  if (segments.length === 0) return '<span class="gdTextLabelMixed"></span>';
  const html = segments
    .map((segment) => {
      if (segment.kind === "text") {
        return escapeHtml(segment.content).replace(/\n/g, "<br/>");
      }
      if (segment.kind === "inlineMath") {
        const html = katex.renderToString(segment.content || "\\,", {
          throwOnError: false,
          displayMode: false,
          strict: "ignore",
        });
        return `<span class="${segment.open ? "gdTextLabelInlineMath active" : "gdTextLabelInlineMath"}">${html}</span>`;
      }
      return `<span class="${segment.open ? "gdTextLabelDisplayMath active" : "gdTextLabelDisplayMath"}">${katex.renderToString(segment.content || "\\,", {
        throwOnError: false,
        displayMode: true,
        strict: "ignore",
      })}</span>`;
    })
    .join("");
  return `<span class="gdTextLabelMixed">${html}</span>`;
}

export function renderEditableMixedTextLabelHtml(source: string, activeOffset?: number): string {
  const segments = parseTextLabelRichText(source, { liveOpenMath: true });
  if (segments.length === 0) return '<span class="gdTextLabelMixed editor"></span>';
  const html = segments
    .map((segment) => {
      if (segment.kind === "text") {
        return escapeHtml(segment.content).replace(/\n/g, "<br/>");
      }
      const raw = escapeHtml(source.slice(segment.sourceStart, segment.sourceEnd)).replace(/\n/g, "<br/>");
      const isActive =
        typeof activeOffset === "number" && activeOffset >= segment.activeStart && activeOffset <= segment.activeEnd;
      if (isActive || segment.open) {
        const className = segment.kind === "inlineMath" ? "gdTextLabelInlineMath" : "gdTextLabelDisplayMath";
        return `<span class="${className} active">${raw}</span>`;
      }
      const rendered = katex.renderToString(segment.content || "\\,", {
        throwOnError: false,
        displayMode: segment.kind === "displayMath",
        strict: "ignore",
      });
      if (segment.kind === "displayMath") {
        return `<span class="gdEditableMathWrap display"><span class="gdEditableMathSource">${raw}</span><span class="gdEditableMathRender display">${rendered}</span></span>`;
      }
      return `<span class="gdEditableMathWrap"><span class="gdEditableMathSource">${raw}</span><span class="gdEditableMathRender">${rendered}</span></span>`;
    })
    .join("");
  return `<span class="gdTextLabelMixed editor">${html}</span>`;
}

export function renderTextLabelHtml(
  source: string,
  renderMode: TextLabelRenderMode,
  options: { liveOpenMath?: boolean } = {}
): string {
  if (renderMode === "tex") {
    return katex.renderToString(source || "\\text{}", {
      throwOnError: false,
      displayMode: false,
      strict: "ignore",
    });
  }
  if (renderMode === "mixed") {
    return renderMixedTextLabelHtml(source, options.liveOpenMath);
  }
  return `<span>${escapeHtml(source).replace(/\n/g, "<br/>")}</span>`;
}

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
  const valueDeg = `${formatAngleDegreesValue((thetaRad * 180) / Math.PI)}^{\\circ}`;
  if (!showLabel && !showValue) return null;
  if (showLabel && custom.length > 0) return showValue ? `${custom}=${valueDeg}` : custom;
  if (showValue) return valueDeg;
  return null;
}

function formatAngleDegreesValue(degRaw: number): string {
  if (!Number.isFinite(degRaw)) return "0";
  const deg = ((degRaw % 360) + 360) % 360;
  const nearest5 = Math.round(deg / 5) * 5;
  if (Math.abs(deg - nearest5) <= 1e-3) {
    return String(nearest5);
  }
  return deg.toFixed(2);
}

export function createPointLabelOverlays(
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  camera: Camera,
  vp: Viewport,
  labelHaloColorOverride?: string
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
        labelHaloColor: labelHaloColorOverride ?? point.style.labelHaloColor,
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

function buildObjectLabelOverlay(
  type: ObjectLabelOverlay["type"],
  id: string,
  visible: boolean,
  showLabel: boolean | undefined,
  labelTextRaw: string | undefined,
  labelPosWorldRaw: Vec2 | undefined,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  textColor: string,
  textSize: number
): ObjectLabelOverlay | null {
  if (!visible || !showLabel) return null;
  const fallbackText = defaultObjectLabelText({ type, id }, scene);
  const text = resolveObjectLabelText(labelTextRaw, fallbackText);
  const fallbackPos = defaultObjectLabelPosWorld({ type, id }, scene);
  const labelPosWorld = isFiniteLabelPosWorld(labelPosWorldRaw) ? labelPosWorldRaw : fallbackPos;
  if (!labelPosWorld) return null;
  const screen = camMath.worldToScreen(labelPosWorld, camera, vp);
  const html = katex.renderToString(text, {
    throwOnError: false,
    displayMode: false,
    strict: "ignore",
  });
  return {
    type,
    id,
    x: screen.x,
    y: screen.y,
    html,
    textSize,
    textColor,
  };
}

export function createObjectLabelOverlays(
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
): ObjectLabelOverlay[] {
  const overlays: ObjectLabelOverlay[] = [];
  for (const segment of scene.segments) {
    const overlay = buildObjectLabelOverlay(
      "segment",
      segment.id,
      segment.visible,
      segment.showLabel,
      segment.labelText,
      segment.labelPosWorld,
      scene,
      camera,
      vp,
      segment.style.strokeColor,
      16
    );
    if (overlay) overlays.push(overlay);
  }
  for (const line of scene.lines) {
    const overlay = buildObjectLabelOverlay(
      "line",
      line.id,
      line.visible,
      line.showLabel,
      line.labelText,
      line.labelPosWorld,
      scene,
      camera,
      vp,
      line.style.strokeColor,
      16
    );
    if (overlay) overlays.push(overlay);
  }
  for (const circle of scene.circles) {
    const overlay = buildObjectLabelOverlay(
      "circle",
      circle.id,
      circle.visible,
      circle.showLabel,
      circle.labelText,
      circle.labelPosWorld,
      scene,
      camera,
      vp,
      circle.style.strokeColor,
      16
    );
    if (overlay) overlays.push(overlay);
  }
  for (const polygon of scene.polygons) {
    const overlay = buildObjectLabelOverlay(
      "polygon",
      polygon.id,
      polygon.visible,
      polygon.showLabel,
      polygon.labelText,
      polygon.labelPosWorld,
      scene,
      camera,
      vp,
      polygon.style.strokeColor,
      16
    );
    if (overlay) overlays.push(overlay);
  }
  return overlays;
}

export function createTextLabelOverlays(
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
): TextLabelOverlay[] {
  const overlays: TextLabelOverlay[] = [];
  const labels = scene.textLabels ?? [];
  for (const label of labels) {
    if (!label.visible) continue;
    const screen = camMath.worldToScreen(label.positionWorld, camera, vp);
    const displayText = resolveTextLabelDisplayText(label, scene);
    const renderMode = resolveTextLabelRenderMode(label.style);
    const html = renderTextLabelHtml(displayText, renderMode);
    overlays.push({
      id: label.id,
      x: screen.x,
      y: screen.y,
      html,
      textSize: Math.max(8, label.style.textSize) * TEXT_LABEL_CANVAS_SIZE_SCALE,
      textColor: label.style.textColor,
      rotationDeg:
        typeof label.style.rotationDeg === "number" && Number.isFinite(label.style.rotationDeg)
          ? label.style.rotationDeg
          : 0,
      renderMode,
      textAlign: resolveTextLabelAlignment(label.style),
      boxWidthPx: resolveTextLabelBoxWidthPx(label.style),
      boxHeightPx: resolveTextLabelBoxHeightPx(label.style),
    });
  }
  return overlays;
}
