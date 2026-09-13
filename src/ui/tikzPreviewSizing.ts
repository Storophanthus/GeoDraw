import type { TikzExportParams } from "../export/buildTikzExportText";
import type { FigureTreatmentMode, FigureTreatmentSelection } from "../export/figureTreatment";

export type PreviewFigureSizingValues = {
  scalebox: string;
  trueGlobal: string;
  global: string;
  point: string;
  line: string;
  label: string;
  labelHalo: string;
};

export type PreviewSizingEdits = Partial<PreviewFigureSizingValues & {
  twoDecimals: boolean;
  dvipsNames: boolean;
  figureTreatmentFactor: number;
  figureTreatmentMode: FigureTreatmentMode;
}>;

/** A scale edit changes only that scale, never the captured style calibration.
 * Keep unedited values at full precision instead of reading rounded UI fields.
 */
export function applyPreviewSizingEdits(params: TikzExportParams, edits: PreviewSizingEdits): TikzExportParams {
  const next = { ...params };
  const scales = {
    scalebox: "scaleboxScale", trueGlobal: "trueGlobalScale", global: "globalScale",
    point: "pointScale", line: "lineScale", label: "labelScale", labelHalo: "labelHaloScale",
  } as const;
  for (const key of Object.keys(scales) as Array<keyof typeof scales>) {
    if (edits[key] !== undefined) next[scales[key]] = Number(edits[key]);
  }
  if (edits.twoDecimals !== undefined) next.roundNumbersToTwoDecimals = edits.twoDecimals;
  if (edits.dvipsNames !== undefined) next.preferDvipsNames = edits.dvipsNames;
  if (edits.figureTreatmentFactor !== undefined) next.figureTreatmentFactor = edits.figureTreatmentFactor;
  if (edits.figureTreatmentMode !== undefined) {
    next.figureTreatmentMode = edits.figureTreatmentMode;
    next.figureTreatmentCustomized = false;
  } else if (next.scaleboxScale !== params.scaleboxScale || next.globalScale !== params.globalScale) {
    next.figureTreatmentCustomized = true;
  }
  return next;
}

export function getPreviewTreatmentSelection(params: TikzExportParams): FigureTreatmentSelection {
  return params.figureTreatmentCustomized ? "custom" : params.figureTreatmentMode ?? "custom";
}

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
