import type { SceneModel } from "../scene/points";
import type { PointLabelCanvasMetrics } from "../export/tikz";

/** Capture the browser's text origin, not an estimate based on TeX source length.
 * Values are in unzoomed canvas pixels, just like saved labelOffsetPx. The
 * exporter/session can then reproduce this layout without a DOM of its own.
 */
export function capturePointLabelCanvasMetrics(
  scene: SceneModel,
  trueZoom: number,
  root: ParentNode = document
): Record<string, PointLabelCanvasMetrics> {
  const result: Record<string, PointLabelCanvasMetrics> = {};
  const points = new Map(scene.points.map((point) => [point.id, point]));
  const zoom = Math.max(0.05, trueZoom);
  for (const element of root.querySelectorAll<HTMLElement>(".labelsLayer [data-point-id]")) {
    const point = points.get(element.dataset.pointId ?? "");
    if (!point?.visible || point.showLabel !== "caption") continue;
    const math = element.querySelector<HTMLElement>(".katex");
    const strut = element.querySelector<HTMLElement>(".katex-html > .base > .strut");
    const source = element.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (!math || !strut || source !== point.captionTex) continue;
    const fontPx = Number.parseFloat(getComputedStyle(math).fontSize);
    const verticalAlign = getComputedStyle(strut).verticalAlign;
    // KaTeX's strut includes depth below the math baseline. "baseline" is 0.
    const depthShift = verticalAlign === "baseline" ? 0 : Number.parseFloat(verticalAlign);
    const baselineOffsetPx =
      (strut.getBoundingClientRect().bottom - element.getBoundingClientRect().top) / zoom + depthShift;
    if (!Number.isFinite(fontPx) || fontPx <= 0 || !Number.isFinite(baselineOffsetPx)) continue;
    result[point.id] = { text: point.captionTex, mode: "caption", fontPx, baselineOffsetPx };
  }

  // Canvas-rendered names use textBaseline="middle" and system-ui. Measuring
  // the same text at both baselines gives the actual offset on this platform.
  const ctx = document.createElement("canvas").getContext("2d");
  if (ctx) {
    for (const point of scene.points) {
      if (!point.visible || point.showLabel !== "name" || !point.name) continue;
      const fontPx = point.style.labelFontPx;
      ctx.font = `${fontPx}px system-ui`;
      ctx.textBaseline = "alphabetic";
      const alphabetic = ctx.measureText(point.name).actualBoundingBoxAscent;
      ctx.textBaseline = "middle";
      const baselineOffsetPx = alphabetic - ctx.measureText(point.name).actualBoundingBoxAscent;
      if (!Number.isFinite(baselineOffsetPx)) continue;
      result[point.id] = { text: point.name, mode: "name", fontPx, baselineOffsetPx };
    }
  }
  return result;
}
