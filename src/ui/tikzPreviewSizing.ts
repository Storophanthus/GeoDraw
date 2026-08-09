export type PreviewFigureSizingValues = {
  scalebox: string;
  trueGlobal: string;
  global: string;
  point: string;
  line: string;
  label: string;
  labelHalo: string;
};

function formatScale(value: number, twoDecimals: boolean): string {
  const normalized = Number(value.toPrecision(15));
  return twoDecimals ? String(Number(normalized.toFixed(2))) : String(normalized);
}

/**
 * Neutral manual sizing expressed in the preview's compensated scale fields.
 * True Zoom is split between the outer scalebox and coordinate scale so the
 * generated figure reproduces the canvas capture without carrying any saved
 * point, line, label, halo, or advanced-transform multiplier.
 */
export function getCanvasCaptureFigureSizing(
  rawCanvasTrueZoom: number | undefined,
  twoDecimals: boolean
): PreviewFigureSizingValues {
  const canvasTrueZoom =
    typeof rawCanvasTrueZoom === "number" && Number.isFinite(rawCanvasTrueZoom)
      ? Math.max(0.05, rawCanvasTrueZoom)
      : 1;
  return {
    scalebox: formatScale(canvasTrueZoom, twoDecimals),
    trueGlobal: "1",
    global: formatScale(1 / canvasTrueZoom, twoDecimals),
    point: "1",
    line: "1",
    label: "1",
    labelHalo: "1",
  };
}
