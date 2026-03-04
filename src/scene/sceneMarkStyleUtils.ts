import type { AngleMark, AngleStyle, LineStyle, SegmentMark } from "./points";

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function roundDecimal(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeArcMultiplicity(value: unknown): 1 | 2 | 3 {
  const n = Number(value);
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

function normalizeSegmentMark(mark: SegmentMark): SegmentMark {
  return {
    ...mark,
    enabled: Boolean(mark.enabled),
    mark: mark.mark,
    pos: Number.isFinite(mark.pos) ? clampUnit(mark.pos) : 0.5,
    sizePt: Number.isFinite(mark.sizePt) ? Math.max(0.1, mark.sizePt) : 4,
    lineWidthPt:
      typeof mark.lineWidthPt === "number" && Number.isFinite(mark.lineWidthPt) && mark.lineWidthPt > 0
        ? mark.lineWidthPt
        : undefined,
    distribution: mark.distribution === "multi" ? "multi" : "single",
    startPos: Number.isFinite(mark.startPos) ? clampUnit(mark.startPos as number) : undefined,
    endPos: Number.isFinite(mark.endPos) ? clampUnit(mark.endPos as number) : undefined,
    step: Number.isFinite(mark.step) ? Math.max(0.001, Math.min(1, mark.step as number)) : undefined,
  };
}

export function resolveSegmentMarks(style: Pick<LineStyle, "segmentMark" | "segmentMarks">): SegmentMark[] {
  const source =
    Array.isArray(style.segmentMarks) && style.segmentMarks.length > 0
      ? style.segmentMarks
      : style.segmentMark
        ? [style.segmentMark]
        : [];
  const out: SegmentMark[] = [];
  for (const raw of source) {
    if (!raw) continue;
    const normalized = normalizeSegmentMark(raw);
    if (!normalized.enabled || normalized.mark === "none") continue;
    out.push(normalized);
  }
  return out;
}

export function collectSegmentMarkPositions(
  mark: Pick<SegmentMark, "distribution" | "pos" | "startPos" | "endPos" | "step">,
  fallbackPos = 0.5
): number[] {
  const distribution = mark.distribution ?? "single";
  if (distribution !== "multi") {
    const pos = Number.isFinite(mark.pos) ? (mark.pos as number) : fallbackPos;
    return [clampUnit(pos)];
  }
  let start = Number.isFinite(mark.startPos) ? clampUnit(mark.startPos as number) : 0.45;
  let end = Number.isFinite(mark.endPos) ? clampUnit(mark.endPos as number) : 0.55;
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  const step = Number.isFinite(mark.step) ? Math.max(0.001, Math.min(1, mark.step as number)) : 0.05;
  const out: number[] = [];
  // Compute each sample from start + i*step to avoid cumulative float drift.
  for (let i = 0; i < 500; i += 1) {
    const t = start + i * step;
    if (t > end + 1e-9) break;
    out.push(clampUnit(roundDecimal(t, 12)));
  }
  if (out.length === 0) out.push(clampUnit(Number.isFinite(mark.pos) ? (mark.pos as number) : fallbackPos));
  return out;
}

export function resolveSegmentMarkAnchorPos(style: Pick<LineStyle, "segmentMark" | "segmentMarks">, fallbackPos = 0.5): number {
  const marks = resolveSegmentMarks(style);
  if (marks.length === 0) return clampUnit(fallbackPos);
  return clampUnit(marks[0].pos);
}

function normalizeAngleMark(mark: AngleMark): AngleMark {
  return {
    enabled: Boolean(mark.enabled),
    arcMultiplicity: normalizeArcMultiplicity(mark.arcMultiplicity),
    markSymbol: mark.markSymbol ?? "none",
    markPos: Number.isFinite(mark.markPos) ? clampUnit(mark.markPos) : 0.5,
    markSize: Number.isFinite(mark.markSize) ? Math.max(0.1, mark.markSize) : 4,
    markColor: mark.markColor,
  };
}

export function resolveAngleMarks(style: AngleStyle): AngleMark[] {
  if (style.markStyle === "none") return [];
  const source =
    Array.isArray(style.angleMarks) && style.angleMarks.length > 0
      ? style.angleMarks
      : [
          {
            enabled: true,
            arcMultiplicity: normalizeArcMultiplicity(style.arcMultiplicity),
            markSymbol: style.markSymbol ?? "none",
            markPos: Number.isFinite(style.markPos) ? style.markPos : 0.5,
            markSize: Number.isFinite(style.markSize) ? style.markSize : 4,
            markColor: style.markColor,
          },
        ];
  const out: AngleMark[] = [];
  for (const raw of source) {
    if (!raw) continue;
    const normalized = normalizeAngleMark(raw);
    if (!normalized.enabled) continue;
    out.push(normalized);
  }
  return out;
}
