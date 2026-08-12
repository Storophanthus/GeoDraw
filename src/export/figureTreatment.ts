export type FigureTreatmentMode = "canvas" | "general" | "veryCloseup";
export type FigureTreatmentSelection = FigureTreatmentMode | "custom";

export type FigureTreatmentScalePair = {
  scaleboxScale: number;
  globalScale: number;
};

export type SavedFigureTreatment = FigureTreatmentScalePair & {
  mode: FigureTreatmentMode;
};

export const VERY_CLOSEUP_TREATMENT_FACTOR = 2.5;
// Fixed-size details should grow more gently than the geometric close-up. At a
// 2.15x Canvas treatment these curves yield about 1.3x visible points, labels,
// and segment-mark dimensions, while keeping the visible halo near 1.08x. The
// independent PDF-preview multipliers remain available on top of the treatment.
export const FIGURE_TREATMENT_POINT_EXPONENT = 0.35;
export const FIGURE_TREATMENT_LABEL_EXPONENT = 0.35;
export const FIGURE_TREATMENT_MARK_EXPONENT = 0.35;
export const FIGURE_TREATMENT_HALO_EXPONENT = 0.1;

function positiveScale(value: number | undefined, fallback = 1): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function normalizeFigureTreatmentMode(raw: unknown): FigureTreatmentMode {
  return raw === "general" || raw === "veryCloseup" ? raw : "canvas";
}

export function getFigureTreatmentFactor(
  mode: FigureTreatmentMode,
  rawCanvasTrueZoom: number | undefined
): number {
  if (mode === "general") return 1;
  if (mode === "veryCloseup") return VERY_CLOSEUP_TREATMENT_FACTOR;
  return Math.max(0.05, positiveScale(rawCanvasTrueZoom));
}

function getFigureTreatmentCompensation(
  rawFactor: number | undefined,
  visibleExponent: number
): number {
  const factor = positiveScale(rawFactor);
  return factor ** (visibleExponent - 1);
}

export function getFigureTreatmentPointCompensation(rawFactor: number | undefined): number {
  return getFigureTreatmentCompensation(rawFactor, FIGURE_TREATMENT_POINT_EXPONENT);
}

export function getFigureTreatmentLabelCompensation(rawFactor: number | undefined): number {
  return getFigureTreatmentCompensation(rawFactor, FIGURE_TREATMENT_LABEL_EXPONENT);
}

export function getFigureTreatmentMarkCompensation(rawFactor: number | undefined): number {
  return getFigureTreatmentCompensation(rawFactor, FIGURE_TREATMENT_MARK_EXPONENT);
}

export function getFigureTreatmentHaloCompensation(rawFactor: number | undefined): number {
  return getFigureTreatmentCompensation(rawFactor, FIGURE_TREATMENT_HALO_EXPONENT);
}

/**
 * Applies a publication treatment as a reciprocal outer/inner scale pair.
 * The product remains invariant, so switching treatment changes the visual
 * weight of points, strokes, labels, halos, and marks without changing the
 * geometric footprint of the figure.
 */
export function applyFigureTreatment(
  baseScaleboxScale: number,
  baseGlobalScale: number,
  mode: FigureTreatmentMode,
  canvasTrueZoom: number | undefined
): FigureTreatmentScalePair {
  const factor = getFigureTreatmentFactor(mode, canvasTrueZoom);
  return {
    scaleboxScale: positiveScale(baseScaleboxScale) * factor,
    globalScale: positiveScale(baseGlobalScale) / factor,
  };
}

export function removeFigureTreatment(
  scaleboxScale: number,
  globalScale: number,
  mode: FigureTreatmentMode,
  canvasTrueZoom: number | undefined
): FigureTreatmentScalePair {
  const factor = getFigureTreatmentFactor(mode, canvasTrueZoom);
  return {
    scaleboxScale: positiveScale(scaleboxScale) / factor,
    globalScale: positiveScale(globalScale) * factor,
  };
}

export function resolveSavedFigureTreatment(
  selection: FigureTreatmentSelection,
  currentScaleboxScale: number,
  currentGlobalScale: number,
  baseScaleboxScale: number,
  baseGlobalScale: number,
  canvasTrueZoom: number | undefined
): SavedFigureTreatment {
  if (selection === "custom") {
    return {
      mode: "canvas",
      ...removeFigureTreatment(
        currentScaleboxScale,
        currentGlobalScale,
        "canvas",
        canvasTrueZoom
      ),
    };
  }
  return {
    mode: selection,
    scaleboxScale: positiveScale(baseScaleboxScale),
    globalScale: positiveScale(baseGlobalScale),
  };
}
