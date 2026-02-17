import type {
  ArrowDirection,
  ArrowTipStyle,
  AngleMarkSymbol,
  AngleStyle,
  CircleStyle,
  LineStyle,
  PathArrowMark,
  SceneAngle,
  SceneCircle,
  SceneLine,
  ScenePolygon,
  SceneSegment,
} from "../scene/points";
import * as React from "react";

const SEGMENT_MARK_OPTIONS = ["none", "|", "||", "|||", "s", "s|", "s||", "x", "o", "oo", "z"] as const;
const ARROW_DIRECTION_OPTIONS: Array<{ value: ArrowDirection; label: string }> = [
  { value: "->", label: "─▶" },
  { value: "<-", label: "◀─" },
  { value: "<->", label: "◀─▶" },
  { value: ">-<", label: "▶─◀" },
];
const ARROW_TIP_OPTIONS: Array<{ value: ArrowTipStyle; label: string }> = [
  { value: "Stealth", label: "─➤" },
  { value: "Latex", label: "─❯" },
  { value: "Triangle", label: "─▶" },
];
const SEGMENT_ARROW_DISTRIBUTIONS = ["single", "multi"] as const;
const FILL_PATTERN_OPTIONS = [
  { value: "", label: "None" },
  { value: "north east lines", label: "North East Lines" },
  { value: "north west lines", label: "North West Lines" },
  { value: "grid", label: "Grid" },
  { value: "crosshatch", label: "Crosshatch" },
  { value: "dots", label: "Dots" },
] as const;
const SEGMENT_ARROW_WIDTH_UI_FACTOR = 8;
const DEFAULT_PATH_ARROW_UI = 1.0;
const DEFAULT_PATH_ARROW_LINE_WIDTH_PT = 8.0;
const DEFAULT_PATH_ARROW_MARK: PathArrowMark = {
  enabled: true,
  direction: "->",
  tip: "Stealth",
  distribution: "single",
  pos: 0.5,
  startPos: 0.45,
  endPos: 0.55,
  step: 0.05,
  sizeScale: DEFAULT_PATH_ARROW_UI,
  lineWidthPt: DEFAULT_PATH_ARROW_LINE_WIDTH_PT,
  arrowLength: 1.0,
};

function isPairArrowDirection(direction: ArrowDirection | undefined): boolean {
  return direction === "<->" || direction === ">-<";
}

function resolveAutoArrowPairGapPx(lineWidthPt: number | undefined, sizeScale: number | undefined): number {
  const storedPt =
    typeof lineWidthPt === "number" && Number.isFinite(lineWidthPt) && lineWidthPt > 0
      ? lineWidthPt
      : DEFAULT_PATH_ARROW_LINE_WIDTH_PT;
  const widthUi = Math.max(0.2, Math.min(12, storedPt / SEGMENT_ARROW_WIDTH_UI_FACTOR));
  const scale = Math.max(0.2, Math.min(8, sizeScale ?? DEFAULT_PATH_ARROW_UI));
  const widthScale = Math.sqrt(widthUi);
  // Base length 16.8px * scale (1.0 default) matches calibration.
  const headSize = Math.max(4, 16.8 * scale);
  // Increased multiplier to 2.4 to ensure <-> arrows don't overlap.
  return Math.max(3, Math.max(headSize * 1.45, headSize * 1.05 * widthScale));
}

function resolveArrowGapControlValue(
  arrow: Pick<PathArrowMark, "pairGapPx" | "lineWidthPt" | "sizeScale"> | undefined
): number {
  if (arrow && typeof arrow.pairGapPx === "number" && Number.isFinite(arrow.pairGapPx) && arrow.pairGapPx >= 0) {
    return arrow.pairGapPx;
  }
  return resolveAutoArrowPairGapPx(arrow?.lineWidthPt, arrow?.sizeScale);
}

function clampArrowWidthUi(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PATH_ARROW_UI;
  return Math.max(0, Math.min(12, value));
}

function parseArrowWidthUi(raw: string): number {
  return clampArrowWidthUi(Number(raw));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function recenterArrowRange(pos: number, startPos: number, endPos: number): { startPos: number; endPos: number } {
  const center = clamp01(pos);
  let start = clamp01(startPos);
  let end = clamp01(endPos);
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  const span = Math.max(0, Math.min(1, end - start));
  let nextStart = center - span * 0.5;
  let nextEnd = center + span * 0.5;
  if (nextStart < 0) {
    nextEnd -= nextStart;
    nextStart = 0;
  }
  if (nextEnd > 1) {
    nextStart -= nextEnd - 1;
    nextEnd = 1;
  }
  return { startPos: clamp01(nextStart), endPos: clamp01(nextEnd) };
}

const ARC_VARIANT_OPTIONS = [
  { value: "vanilla", label: "Vanilla Arc" },
  { value: "bars1", label: 'Arc + "|"' },
  { value: "bars2", label: 'Arc + "||"' },
  { value: "bars3", label: 'Arc + "|||"' },
  { value: "double", label: "Double Arc" },
  { value: "triple", label: "Triple Arc" },
  { value: "none", label: "None" },
] as const;

type ObjectStyleSectionsProps = {
  selectedPointPresent: boolean;
  selectedSegment: SceneSegment | null;
  selectedLine: SceneLine | null;
  selectedCircle: SceneCircle | null;
  selectedPolygon: ScenePolygon | null;
  selectedAngle: SceneAngle | null;
  selectedAngleRightStatus: "none" | "approx" | "exact";
  updateSelectedSegmentStyle: (style: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (style: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (style: Partial<CircleStyle>) => void;
  updateSelectedPolygonStyle: (style: Partial<ScenePolygon["style"]>) => void;
  updateSelectedAngleStyle: (style: Partial<AngleStyle>) => void;
  deleteSelectedObject: () => void;

};

import { Trash2, Plus, Copy } from "lucide-react";

function ArrowListControl({
  arrows,
  onChange,
  strokeColor,
}: {
  arrows: PathArrowMark[] | undefined;
  onChange: (arrows: PathArrowMark[]) => void;
  strokeColor: string;
}) {
  // Local state to track which arrow is being edited
  const [selectedByIndex, setSelectedByIndex] = React.useState<number>(0);
  const safeArrows = arrows ?? [];

  // Ensure we clamp the selection if the list shrank
  const actualIndex = Math.max(0, Math.min(selectedByIndex, safeArrows.length - 1));
  const selectedArrow = safeArrows[actualIndex] ?? DEFAULT_PATH_ARROW_MARK;

  const updateSelectedArrow = (updates: Partial<PathArrowMark>) => {
    const newArrows = [...safeArrows];
    if (newArrows.length === 0) return;
    newArrows[actualIndex] = { ...newArrows[actualIndex], ...updates };
    onChange(newArrows);
  };

  const addArrow = () => {
    const newArrows = [...safeArrows, { ...DEFAULT_PATH_ARROW_MARK }];
    onChange(newArrows);
    setSelectedByIndex(newArrows.length - 1);
  };

  const removeArrow = () => {
    if (safeArrows.length === 0) return;
    const newArrows = safeArrows.filter((_, i) => i !== actualIndex);
    onChange(newArrows);
    // Auto-select the previous one or clamp
    setSelectedByIndex(Math.max(0, actualIndex - 1));
  };

  const duplicateArrow = () => {
    if (safeArrows.length === 0) return;
    const arrowToCopy = safeArrows[actualIndex];
    const newArrows = [...safeArrows, { ...arrowToCopy }];
    onChange(newArrows);
    setSelectedByIndex(newArrows.length - 1);
  };

  // If list is empty (shouldn't happen with migration, but for safety), init it
  // If list is empty (shouldn't happen with migration, but for safety), init it
  // User Feedback: "allow 0 arrows". Removing enforcement of min 1 arrow.
  /*
  React.useEffect(() => {
    if (!arrows || arrows.length === 0) {
      onChange([{ ...DEFAULT_PATH_ARROW_MARK }]);
    }
  }, [arrows, onChange]);
  */

  return (
    <div className="arrowListControl" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Master Row: Arrow List */}
      <div className="arrowListHeader" style={{ display: "grid", gridTemplateColumns: "100px 1fr", alignItems: "center", gap: "10px" }}>
        <label className="controlLabel">Arrow List</label>
        <div className="arrowListButtons" style={{ display: "flex", gap: "6px" }}>
          <select
            className="selectInput"
            value={actualIndex}
            onChange={(e) => setSelectedByIndex(Number(e.target.value))}
            disabled={safeArrows.length === 0}
            style={{
              height: "32px",
              borderRadius: "6px",
              borderColor: "#cbd5e1",
              padding: "0 8px",
              flex: 1,
              fontSize: "13px"
            }}
          >
            {safeArrows.map((_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: "1px", background: "#cbd5e1", padding: "1px", borderRadius: "6px", overflow: "hidden" }}>
            <button
              className="iconButton"
              onClick={addArrow}
              title="Add arrow"
              style={{
                height: "30px",
                width: "32px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "4px 0 0 4px",
                background: "#fff",
                cursor: "pointer"
              }}
            >
              <Plus size={15} color="#334155" />
            </button>
            <button
              className="iconButton"
              onClick={duplicateArrow}
              title="Duplicate arrow"
              disabled={safeArrows.length === 0}
              style={{
                height: "30px",
                width: "32px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "#fff",
                cursor: safeArrows.length === 0 ? "not-allowed" : "pointer",
                opacity: safeArrows.length === 0 ? 0.6 : 1
              }}
            >
              <Copy size={14} color="#334155" />
            </button>
            <button
              className="iconButton"
              onClick={removeArrow}
              disabled={safeArrows.length === 0}
              title={safeArrows.length === 0 ? "No arrows to remove" : "Remove arrow"}
              style={{
                height: "30px",
                width: "32px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "0 4px 4px 0",
                background: "#fff",
                cursor: safeArrows.length === 0 ? "not-allowed" : "pointer",
                opacity: safeArrows.length === 0 ? 0.6 : 1
              }}
            >
              <Trash2 size={14} color={safeArrows.length === 0 ? "#94a3b8" : "#b91c1c"} />
            </button>
          </div>
        </div>
      </div>

      {
        safeArrows.length > 0 && (
          <div className="arrowDetail" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Detail Header */}
            <div style={{ paddingBottom: "8px", borderBottom: "1px solid #e2e8f0", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Editing Arrow {actualIndex + 1}
              </span>
            </div>

            {/* Group 1: Configuration */}
            <div className="controlGroup">
              {/* Direction */}
              <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                <label className="controlLabel">Direction</label>
                <select
                  className="selectInput arrowIconSelect"
                  value={selectedArrow.direction}
                  onChange={(e) => updateSelectedArrow({ direction: e.target.value as ArrowDirection })}
                  style={{ height: "32px", borderRadius: "6px" }}
                >
                  {ARROW_DIRECTION_OPTIONS.filter((opt) => !isPairArrowDirection(opt.value)).map((direction) => (
                    <option key={direction.value} value={direction.value}>
                      {direction.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tip Style */}
              <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                <label className="controlLabel">Tip Style</label>
                <select
                  className="selectInput arrowIconSelect"
                  value={selectedArrow.tip ?? "Stealth"}
                  onChange={(e) => updateSelectedArrow({ tip: e.target.value as ArrowTipStyle })}
                  style={{ height: "32px", borderRadius: "6px" }}
                >
                  {ARROW_TIP_OPTIONS.map((tip) => (
                    <option key={tip.value} value={tip.value}>
                      {tip.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Distribution */}
              <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                <label className="controlLabel">Distribution</label>
                <select
                  className="selectInput"
                  value={selectedArrow.distribution ?? "single"}
                  onChange={(e) => updateSelectedArrow({ distribution: e.target.value as "single" | "multi" })}
                  style={{ height: "32px", borderRadius: "6px" }}
                >
                  <option value="single">Single</option>
                  <option value="multi">Multi</option>
                </select>
              </div>
            </div>

            {/* Group 2: Sub-panel for Positioning */}
            {selectedArrow.distribution === "multi" ? (
              <div className="nestedGroup" style={{
                background: "#f8fafca6", /* subtle tint */
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "88px 1fr 68px" }}>
                  <label className="controlLabel">Start</label>
                  <input
                    className="sizeSlider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedArrow.startPos ?? 0.45}
                    onChange={(e) => updateSelectedArrow({ startPos: Number(e.target.value) })}
                  />
                  <input
                    className="scaleInputCompact"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedArrow.startPos ?? 0.45}
                    onChange={(e) => updateSelectedArrow({ startPos: Number(e.target.value) })}
                  />
                </div>
                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "88px 1fr 68px" }}>
                  <label className="controlLabel">End</label>
                  <input
                    className="sizeSlider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedArrow.endPos ?? 0.55}
                    onChange={(e) => updateSelectedArrow({ endPos: Number(e.target.value) })}
                  />
                  <input
                    className="scaleInputCompact"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedArrow.endPos ?? 0.55}
                    onChange={(e) => updateSelectedArrow({ endPos: Number(e.target.value) })}
                  />
                </div>
                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "88px 1fr 68px" }}>
                  <label className="controlLabel">Step</label>
                  <input
                    className="sizeSlider"
                    type="range"
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    value={selectedArrow.step ?? 0.05}
                    onChange={(e) => updateSelectedArrow({ step: Number(e.target.value) })}
                  />
                  <input
                    className="scaleInputCompact"
                    type="number"
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    value={selectedArrow.step ?? 0.05}
                    onChange={(e) => updateSelectedArrow({ step: Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              /* Single Position Control */
              <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                <label className="controlLabel">Arrow Pos</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedArrow.pos ?? 0.5}
                  onChange={(e) => updateSelectedArrow({ pos: Number(e.target.value) })}
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedArrow.pos ?? 0.5}
                  onChange={(e) => updateSelectedArrow({ pos: Number(e.target.value) })}
                />
              </div>
            )}

            {/* Group 3: Appearance */}
            <div className="controlGroup nestedGroup" style={{
              background: "#f8fafca6",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                <label className="controlLabel">Arrow Color</label>
                <input
                  className="colorInput"
                  type="color"
                  value={selectedArrow.color ?? strokeColor}
                  onChange={(e) => updateSelectedArrow({ color: e.target.value })}
                  style={{ width: "100%", borderRadius: "6px", height: "32px" }}
                />
              </div>

              <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                <label className="controlLabel">Width</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.2}
                  max={12}
                  step={0.05}
                  value={(selectedArrow.lineWidthPt ?? DEFAULT_PATH_ARROW_LINE_WIDTH_PT) / SEGMENT_ARROW_WIDTH_UI_FACTOR}
                  onChange={(e) =>
                    updateSelectedArrow({
                      lineWidthPt: parseArrowWidthUi(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
                    })
                  }
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0}
                  max={12}
                  step={0.05}
                  value={(selectedArrow.lineWidthPt ?? DEFAULT_PATH_ARROW_LINE_WIDTH_PT) / SEGMENT_ARROW_WIDTH_UI_FACTOR}
                  onChange={(e) =>
                    updateSelectedArrow({
                      lineWidthPt: parseArrowWidthUi(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
                    })
                  }
                />
              </div>

              <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                <label className="controlLabel">Size</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.2}
                  max={8}
                  step={0.1}
                  value={selectedArrow.sizeScale ?? DEFAULT_PATH_ARROW_UI}
                  onChange={(e) => updateSelectedArrow({ sizeScale: Number(e.target.value) })}
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0.2}
                  max={8}
                  step={0.1}
                  value={selectedArrow.sizeScale ?? DEFAULT_PATH_ARROW_UI}
                  onChange={(e) => updateSelectedArrow({ sizeScale: Number(e.target.value) })}
                />
              </div>

              <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                <label className="controlLabel">Length</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={selectedArrow.arrowLength ?? 1.0}
                  onChange={(e) => updateSelectedArrow({ arrowLength: Number(e.target.value) })}
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={selectedArrow.arrowLength ?? 1.0}
                  onChange={(e) => updateSelectedArrow({ arrowLength: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export function ObjectStyleSections({
  selectedPointPresent,
  selectedSegment,
  selectedLine,
  selectedCircle,
  selectedPolygon,
  selectedAngle,
  selectedAngleRightStatus,
  updateSelectedSegmentStyle,
  updateSelectedLineStyle,
  updateSelectedCircleStyle,
  updateSelectedPolygonStyle,
  updateSelectedAngleStyle,
  deleteSelectedObject,
}: ObjectStyleSectionsProps) {
  const selectedAngleIsRight = selectedAngleRightStatus !== "none";
  const selectedAngleIsRightExact = selectedAngleRightStatus === "exact";
  const selectedAngleIsSector = selectedAngle?.kind === "sector";
  const selectedAreaStyle = selectedPolygon ? selectedPolygon.style : selectedCircle?.style;
  const updateSelectedAreaStyle = (style: Partial<CircleStyle>) => {
    if (selectedPolygon) {
      updateSelectedPolygonStyle(style);
      return;
    }
    updateSelectedCircleStyle(style);
  };
  const areaArrowDefaults = selectedCircle?.style.arrowMark ?? DEFAULT_PATH_ARROW_MARK;
  const angleArrowDefaults = selectedAngle?.style.arcArrowMark ?? DEFAULT_PATH_ARROW_MARK;
  const angleArcVariant =
    selectedAngle?.style.markStyle === "none"
      ? "none"
      : selectedAngle?.style.arcMultiplicity === 3
        ? "triple"
        : selectedAngle?.style.arcMultiplicity === 2
          ? "double"
          : selectedAngle?.style.markSymbol === "|||"
            ? "bars3"
            : selectedAngle?.style.markSymbol === "||"
              ? "bars2"
              : selectedAngle?.style.markSymbol === "|"
                ? "bars1"
                : "vanilla";

  const updateAngleArcVariant = (variant: string) => {
    if (!selectedAngle) return;
    if (variant === "none") {
      updateSelectedAngleStyle({ markStyle: "none" });
      return;
    }
    if (variant === "double") {
      updateSelectedAngleStyle({ markStyle: "arc", arcMultiplicity: 2, markSymbol: "none" });
      return;
    }
    if (variant === "triple") {
      updateSelectedAngleStyle({ markStyle: "arc", arcMultiplicity: 3, markSymbol: "none" });
      return;
    }
    const markSymbol: AngleMarkSymbol =
      variant === "bars1" ? "|" : variant === "bars2" ? "||" : variant === "bars3" ? "|||" : "none";
    updateSelectedAngleStyle({ markStyle: "arc", arcMultiplicity: 1, markSymbol });
  };

  return (
    <>
      {!selectedPointPresent && !selectedAngle && selectedSegment && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">Segment Style</div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedSegment.style.strokeColor}
              onChange={(e) => updateSelectedSegmentStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedSegment.style.strokeWidth}
              onChange={(e) => updateSelectedSegmentStyle({ strokeWidth: Number(e.target.value) })}
            />
            <input
              className="scaleInputCompact"
              type="number"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedSegment.style.strokeWidth}
              onChange={(e) => updateSelectedSegmentStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Dash</label>
            <select
              className="selectInput"
              value={selectedSegment.style.dash}
              onChange={(e) => updateSelectedSegmentStyle({ dash: e.target.value as "solid" | "dashed" | "dotted" })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedSegment.style.opacity}
              onChange={(e) => updateSelectedSegmentStyle({ opacity: Number(e.target.value) })}
            />
          </div>
          <details className="detailsSection">
            <summary className="subSectionTitle detailsSummary">Marking</summary>
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={selectedSegment.style.segmentMark?.enabled ?? false}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        mark: "none",
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      enabled: e.target.checked,
                    },
                  })
                }
              />
              Enable segment mark
            </label>
            <div className="controlRow">
              <label className="controlLabel">Mark Type</label>
              <select
                className="selectInput"
                value={selectedSegment.style.segmentMark?.mark ?? "none"}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      mark: e.target.value as (typeof SEGMENT_MARK_OPTIONS)[number],
                    },
                  })
                }
              >
                {SEGMENT_MARK_OPTIONS.map((mark: string) => (
                  <option key={mark} value={mark}>
                    {mark}
                  </option>
                ))}
              </select>
            </div>
            <div className="controlRow">
              <label className="controlLabel">Mark Pos</label>
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedSegment.style.segmentMark?.pos ?? 0.5}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        sizePt: 4,
                      }),
                      pos: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="controlRow controlRowWithNumeric">
              <label className="controlLabel">Mark Size</label>
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={selectedSegment.style.segmentMark?.sizePt ?? 4}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                      }),
                      sizePt: Number(e.target.value),
                    },
                  })
                }
              />
              <input
                className="scaleInputCompact"
                type="number"
                min={0}
                max={24}
                step={0.1}
                value={selectedSegment.style.segmentMark?.sizePt ?? 4}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                      }),
                      sizePt: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="controlRow">
              <label className="controlLabel">Mark Color</label>
              <input
                className="colorInput"
                type="color"
                value={selectedSegment.style.segmentMark?.color ?? selectedSegment.style.strokeColor}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      color: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="controlRow controlRowWithNumeric">
              <label className="controlLabel">Mark Width</label>
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={12}
                step={0.1}
                value={selectedSegment.style.segmentMark?.lineWidthPt ?? selectedSegment.style.strokeWidth}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      lineWidthPt: Number(e.target.value),
                    },
                  })
                }
              />
              <input
                className="scaleInputCompact"
                type="number"
                min={0}
                max={12}
                step={0.1}
                value={selectedSegment.style.segmentMark?.lineWidthPt ?? selectedSegment.style.strokeWidth}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      lineWidthPt: Number(e.target.value),
                    },
                  })
                }
              />
            </div>

            <div className="subSectionTitle" style={{ marginTop: 10 }}>
              Arrow Mark
            </div>
            <ArrowListControl
              arrows={
                selectedSegment.style.segmentArrowMarks ??
                (selectedSegment.style.segmentArrowMark
                  ? [
                    {
                      ...DEFAULT_PATH_ARROW_MARK,
                      ...selectedSegment.style.segmentArrowMark,
                      // Map segment-specific 'mode' to something PathArrowMark handles if needed,
                      // or just rely on common properties. PathArrowMark doesn't have 'mode'.
                      // For now we assume 'mid' behavior for the list.
                      // If we need to support 'end' arrows in the new system, we might need a property for it,
                      // or simpler: deprecate 'mode' and just use 'pos=1' or 'pos=0'.
                    } as PathArrowMark,
                  ]
                  : [])
              }
              strokeColor={selectedSegment.style.strokeColor}
              onChange={(newArrows) => {
                // Convert back to SegmentArrowMark[] if needed, but we defined segmentArrowMarks as SegmentArrowMark[]
                // which extends PathArrowMark slightly (adds mode?).
                // Let's check SceneModel again. PathArrowMark doesn't have 'mode'. SegmentArrowMark does.
                // We should probably strip 'mode' and rely on 'pos' for new system, or cast.
                // For this refactor, we cast to any to satisfy the callback, assuming we migrate away from 'mode'.
                const castArrows = newArrows.map((a) => ({
                  ...a,
                  mode: "mid", // Default to mid for list-based arrows
                })) as any[];
                updateSelectedSegmentStyle({ segmentArrowMarks: castArrows });
              }}
            />
          </details>
        </div>
      )}

      {!selectedPointPresent && !selectedAngle && selectedLine && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">Line Style</div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedLine.style.strokeColor}
              onChange={(e) => updateSelectedLineStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedLine.style.strokeWidth}
              onChange={(e) => updateSelectedLineStyle({ strokeWidth: Number(e.target.value) })}
            />
            <input
              className="scaleInputCompact"
              type="number"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedLine.style.strokeWidth}
              onChange={(e) => updateSelectedLineStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Dash</label>
            <select
              className="selectInput"
              value={selectedLine.style.dash}
              onChange={(e) => updateSelectedLineStyle({ dash: e.target.value as "solid" | "dashed" | "dotted" })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedLine.style.opacity}
              onChange={(e) => updateSelectedLineStyle({ opacity: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {!selectedPointPresent && !selectedAngle && selectedAreaStyle && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">{selectedPolygon ? "Polygon Style" : "Circle Style"}</div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAreaStyle.strokeColor}
              onChange={(e) => updateSelectedAreaStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedAreaStyle.strokeWidth}
              onChange={(e) => updateSelectedAreaStyle({ strokeWidth: Number(e.target.value) })}
            />
            <input
              className="scaleInputCompact"
              type="number"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedAreaStyle.strokeWidth}
              onChange={(e) => updateSelectedAreaStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Dash</label>
            <select
              className="selectInput"
              value={selectedAreaStyle.strokeDash}
              onChange={(e) =>
                updateSelectedAreaStyle({ strokeDash: e.target.value as "solid" | "dashed" | "dotted" })
              }
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedAreaStyle.strokeOpacity}
              onChange={(e) => updateSelectedAreaStyle({ strokeOpacity: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAreaStyle.fillColor ?? "#FFFFFF"}
              onChange={(e) => updateSelectedAreaStyle({ fillColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedAreaStyle.fillOpacity ?? 0}
              onChange={(e) =>
                updateSelectedAreaStyle({
                  fillOpacity: Number(e.target.value),
                  fillColor: selectedAreaStyle.fillColor ?? "#FFFFFF",
                })
              }
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Pattern</label>
            <select
              className="selectInput"
              value={selectedAreaStyle.pattern ?? ""}
              onChange={(e) => updateSelectedAreaStyle({ pattern: e.target.value })}
            >
              {FILL_PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(selectedAreaStyle.pattern ?? "") !== "" && (
            <div className="controlRow">
              <label className="controlLabel">Pattern Color</label>
              <input
                className="colorInput"
                type="color"
                value={selectedAreaStyle.patternColor ?? selectedAreaStyle.strokeColor}
                onChange={(e) => updateSelectedAreaStyle({ patternColor: e.target.value })}
              />
            </div>
          )}
          {!selectedPolygon && selectedCircle && (
            <details className="detailsSection">
              <summary className="subSectionTitle detailsSummary">Arrow Mark</summary>
              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={selectedCircle.style.arrowMark?.enabled ?? false}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                Enable circle arrow
              </label>
              <div className="controlRow">
                <label className="controlLabel">Direction</label>
                <select
                  className="selectInput arrowIconSelect"
                  value={selectedCircle.style.arrowMark?.direction ?? "->"}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        direction: e.target.value as ArrowDirection,
                      },
                    })
                  }
                >
                  {ARROW_DIRECTION_OPTIONS.map((direction) => (
                    <option key={direction.value} value={direction.value}>
                      {direction.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="controlRow">
                <label className="controlLabel">Tip Style</label>
                <select
                  className="selectInput arrowIconSelect"
                  value={selectedCircle.style.arrowMark?.tip ?? "Stealth"}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        tip: e.target.value as ArrowTipStyle,
                      },
                    })
                  }
                >
                  {ARROW_TIP_OPTIONS.map((tip) => (
                    <option key={tip.value} value={tip.value}>
                      {tip.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="controlRow">
                <label className="controlLabel">Arrow Pos</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedCircle.style.arrowMark?.pos ?? 0.5}
                  onChange={(e) => {
                    const pos = Number(e.target.value);
                    const arrow = selectedCircle.style.arrowMark ?? areaArrowDefaults;
                    const recentered =
                      (arrow.distribution ?? "single") === "multi"
                        ? recenterArrowRange(pos, arrow.startPos ?? 0.45, arrow.endPos ?? 0.55)
                        : null;
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...arrow,
                        ...(recentered ?? {}),
                        pos,
                      },
                    });
                  }}
                />
              </div>
              <div className="controlRow">
                <label className="controlLabel">Arrow Color</label>
                <input
                  className="colorInput"
                  type="color"
                  value={selectedCircle.style.arrowMark?.color ?? selectedCircle.style.strokeColor}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        color: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Arrow Width</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.2}
                  max={12}
                  step={0.05}
                  value={
                    (selectedCircle.style.arrowMark?.lineWidthPt ?? DEFAULT_PATH_ARROW_LINE_WIDTH_PT) /
                    SEGMENT_ARROW_WIDTH_UI_FACTOR
                  }
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        lineWidthPt: parseArrowWidthUi(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
                      },
                    })
                  }
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0}
                  max={12}
                  step={0.05}
                  value={
                    (selectedCircle.style.arrowMark?.lineWidthPt ?? DEFAULT_PATH_ARROW_LINE_WIDTH_PT) /
                    SEGMENT_ARROW_WIDTH_UI_FACTOR
                  }
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        lineWidthPt: parseArrowWidthUi(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
                      },
                    })
                  }
                />
              </div>
              <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Arrow Size</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.2}
                  max={8}
                  step={0.1}
                  value={selectedCircle.style.arrowMark?.sizeScale ?? DEFAULT_PATH_ARROW_UI}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        sizeScale: Number(e.target.value),
                      },
                    })
                  }
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0.2}
                  max={8}
                  step={0.1}
                  value={selectedCircle.style.arrowMark?.sizeScale ?? DEFAULT_PATH_ARROW_UI}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        sizeScale: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Arrow Length</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={selectedCircle.style.arrowMark?.arrowLength ?? 1.0}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        arrowLength: Number(e.target.value),
                      },
                    })
                  }
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={selectedCircle.style.arrowMark?.arrowLength ?? 1.0}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        arrowLength: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              {isPairArrowDirection(selectedCircle.style.arrowMark?.direction ?? "->") && (
                <>
                  <label className="checkboxRow">
                    <input
                      type="checkbox"
                      checked={selectedCircle.style.arrowMark?.pairGapPx === undefined}
                      onChange={(e) =>
                        updateSelectedCircleStyle({
                          arrowMark: {
                            ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                            pairGapPx: e.target.checked ? undefined : resolveArrowGapControlValue(selectedCircle.style.arrowMark),
                          },
                        })
                      }
                    />
                    Auto Gap
                  </label>
                  <div className="controlRow controlRowWithNumeric">
                    <label className="controlLabel">Arrow Gap</label>
                    <input
                      className="sizeSlider"
                      type="range"
                      min={0}
                      max={120}
                      step={0.5}
                      disabled={selectedCircle.style.arrowMark?.pairGapPx === undefined}
                      value={resolveArrowGapControlValue(selectedCircle.style.arrowMark)}
                      onChange={(e) =>
                        updateSelectedCircleStyle({
                          arrowMark: {
                            ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                            pairGapPx: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <input
                      className="scaleInputCompact"
                      type="number"
                      min={0}
                      max={120}
                      step={0.5}
                      disabled={selectedCircle.style.arrowMark?.pairGapPx === undefined}
                      value={resolveArrowGapControlValue(selectedCircle.style.arrowMark)}
                      onChange={(e) =>
                        updateSelectedCircleStyle({
                          arrowMark: {
                            ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                            pairGapPx: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </>
              )}
              <div className="controlRow">
                <label className="controlLabel">Distribution</label>
                <select
                  className="selectInput"
                  value={selectedCircle.style.arrowMark?.distribution ?? "single"}
                  onChange={(e) =>
                    updateSelectedCircleStyle({
                      arrowMark: {
                        ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                        distribution: e.target.value as (typeof SEGMENT_ARROW_DISTRIBUTIONS)[number],
                      },
                    })
                  }
                >
                  {SEGMENT_ARROW_DISTRIBUTIONS.map((distribution) => (
                    <option key={distribution} value={distribution}>
                      {distribution}
                    </option>
                  ))}
                </select>
              </div>
              {(selectedCircle.style.arrowMark?.distribution ?? "single") === "multi" && (
                <>
                  <div className="controlRow">
                    <label className="controlLabel">Start</label>
                    <input
                      className="sizeSlider"
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedCircle.style.arrowMark?.startPos ?? 0.45}
                      onChange={(e) =>
                        updateSelectedCircleStyle({
                          arrowMark: {
                            ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                            startPos: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="controlRow">
                    <label className="controlLabel">End</label>
                    <input
                      className="sizeSlider"
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedCircle.style.arrowMark?.endPos ?? 0.55}
                      onChange={(e) =>
                        updateSelectedCircleStyle({
                          arrowMark: {
                            ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                            endPos: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="controlRow">
                    <label className="controlLabel">Step</label>
                    <input
                      className="sizeSlider"
                      type="number"
                      min={0.01}
                      max={1}
                      step={0.01}
                      value={selectedCircle.style.arrowMark?.step ?? 0.05}
                      onChange={(e) =>
                        updateSelectedCircleStyle({
                          arrowMark: {
                            ...(selectedCircle.style.arrowMark ?? areaArrowDefaults),
                            step: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="controlRow controlRowWithNumeric">
                    <label className="controlLabel">Arrow Length</label>
                    <input
                      className="sizeSlider"
                      type="range"
                      min={0.1}
                      max={4}
                      step={0.1}
                      value={selectedAreaStyle?.arrowMark?.arrowLength ?? 1.0}
                      onChange={(e) =>
                        updateSelectedAreaStyle({
                          arrowMark: {
                            ...(selectedAreaStyle?.arrowMark ?? DEFAULT_PATH_ARROW_MARK),
                            arrowLength: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <input
                      className="scaleInputCompact"
                      type="number"
                      min={0.1}
                      max={4}
                      step={0.1}
                      value={selectedAreaStyle?.arrowMark?.arrowLength ?? 1.0}
                      onChange={(e) =>
                        updateSelectedAreaStyle({
                          arrowMark: {
                            ...(selectedAreaStyle?.arrowMark ?? DEFAULT_PATH_ARROW_MARK),
                            arrowLength: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </>
              )}
            </details>
          )}
        </div>
      )}

      {!selectedPointPresent && selectedAngle && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">{selectedAngleIsSector ? "Sector Style" : "Angle Style"}</div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedAngle.style.showLabel}
              onChange={(e) => updateSelectedAngleStyle({ showLabel: e.target.checked })}
            />
            Show Label
          </label>
          {!selectedAngleIsSector && (
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={selectedAngle.style.showValue}
                onChange={(e) => updateSelectedAngleStyle({ showValue: e.target.checked })}
              />
              Show Value (deg)
            </label>
          )}
          <div className="controlRow">
            <label className="controlLabel">Label Text</label>
            <input
              className="renameInput"
              value={selectedAngle.style.labelText}
              onChange={(e) => updateSelectedAngleStyle({ labelText: e.target.value })}
            />
          </div>
          {!selectedAngleIsSector && (
            <>
              <div className="controlRow">
                <label className="controlLabel">Mark</label>
                {selectedAngleIsRight ? (
                  <select
                    className="selectInput"
                    value={
                      selectedAngle.style.markStyle === "none"
                        ? "none"
                        : selectedAngle.style.markStyle === "right" || selectedAngle.style.markStyle === "arc"
                          ? "rightSquare"
                          : selectedAngle.style.markStyle
                    }
                    onChange={(e) =>
                      updateSelectedAngleStyle({
                        markStyle: e.target.value as "rightSquare" | "rightArcDot" | "none",
                        arcMultiplicity: 1,
                        markSymbol: "none",
                      })
                    }
                  >
                    <option value="rightSquare">RightSquare</option>
                    <option value="rightArcDot">RightArcDot</option>
                    <option value="none">None</option>
                  </select>
                ) : (
                  <select className="selectInput" value={angleArcVariant} onChange={(e) => updateAngleArcVariant(e.target.value)}>
                    {ARC_VARIANT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {selectedAngleIsRight && (
                <label className="checkboxRow">
                  <input
                    type="checkbox"
                    checked={selectedAngleIsRightExact || Boolean(selectedAngle.style.promoteToSolid)}
                    disabled={selectedAngleIsRightExact}
                    onChange={(e) => updateSelectedAngleStyle({ promoteToSolid: e.target.checked })}
                  />
                  Promote to solid
                </label>
              )}
              <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Arc Radius</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.2}
                  max={5.5}
                  step={0.05}
                  value={selectedAngle.style.arcRadius}
                  onChange={(e) => updateSelectedAngleStyle({ arcRadius: Number(e.target.value) })}
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0.2}
                  max={5.5}
                  step={0.05}
                  value={selectedAngle.style.arcRadius}
                  onChange={(e) => updateSelectedAngleStyle({ arcRadius: Number(e.target.value) })}
                />
              </div>
              {!selectedAngleIsRight && (
                <>
                  <div className="controlRow">
                    <label className="controlLabel">Mark Position</label>
                    <input
                      className="sizeSlider"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedAngle.style.markPos ?? 0.5}
                      onChange={(e) => updateSelectedAngleStyle({ markPos: Number(e.target.value) })}
                    />
                  </div>
                  <div className="controlRow controlRowWithNumeric">
                    <label className="controlLabel">Mark Size</label>
                    <input
                      className="sizeSlider"
                      type="range"
                      min={1}
                      max={20}
                      step={0.1}
                      value={selectedAngle.style.markSize ?? 4}
                      onChange={(e) => updateSelectedAngleStyle({ markSize: Number(e.target.value) })}
                    />
                    <input
                      className="scaleInputCompact"
                      type="number"
                      min={1}
                      max={20}
                      step={0.1}
                      value={selectedAngle.style.markSize ?? 4}
                      onChange={(e) => updateSelectedAngleStyle({ markSize: Number(e.target.value) })}
                    />
                  </div>
                  <div className="controlRow">
                    <label className="controlLabel">Mark Color</label>
                    <input
                      className="colorInput"
                      type="color"
                      value={selectedAngle.style.markColor ?? selectedAngle.style.strokeColor}
                      onChange={(e) => updateSelectedAngleStyle({ markColor: e.target.value })}
                    />
                  </div>
                </>
              )}
            </>
          )}
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAngle.style.strokeColor}
              onChange={(e) => updateSelectedAngleStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedAngle.style.strokeWidth}
              onChange={(e) => updateSelectedAngleStyle({ strokeWidth: Number(e.target.value) })}
            />
            <input
              className="scaleInputCompact"
              type="number"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedAngle.style.strokeWidth}
              onChange={(e) => updateSelectedAngleStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          {selectedAngleIsSector && (
            <div className="controlRow">
              <label className="controlLabel">Dash</label>
              <select
                className="selectInput"
                value={selectedAngle.style.strokeDash ?? "solid"}
                onChange={(e) =>
                  updateSelectedAngleStyle({ strokeDash: e.target.value as "solid" | "dashed" | "dotted" })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
          )}
          <details className="detailsSection">
            <summary className="subSectionTitle detailsSummary">Arc Arrow</summary>
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={selectedAngle.style.arcArrowMark?.enabled ?? false}
                onChange={(e) =>
                  updateSelectedAngleStyle({
                    arcArrowMark: {
                      ...(selectedAngle.style.arcArrowMark ?? angleArrowDefaults),
                      enabled: e.target.checked,
                    },
                  })
                }
              />
              Enable arc arrow
            </label>
            <ArrowListControl
              arrows={selectedAngle.style.arcArrowMark ? [selectedAngle.style.arcArrowMark] : []}
              strokeColor={selectedAngle.style.strokeColor}
              onChange={(newArrows) =>
                updateSelectedAngleStyle({ arcArrowMark: newArrows.length > 0 ? newArrows[0] : undefined })
              }
            />
            <div className="controlRow">
              <label className="controlLabel">Distribution</label>
              <select
                className="selectInput"
                value={selectedAngle.style.arcArrowMark?.distribution ?? "single"}
                onChange={(e) =>
                  updateSelectedAngleStyle({
                    arcArrowMark: {
                      ...(selectedAngle.style.arcArrowMark ?? angleArrowDefaults),
                      distribution: e.target.value as (typeof SEGMENT_ARROW_DISTRIBUTIONS)[number],
                    },
                  })
                }
              >
                {SEGMENT_ARROW_DISTRIBUTIONS.map((distribution) => (
                  <option key={distribution} value={distribution}>
                    {distribution}
                  </option>
                ))}
              </select>
            </div>
            {(selectedAngle.style.arcArrowMark?.distribution ?? "single") === "multi" && (
              <>
                <div className="controlRow">
                  <label className="controlLabel">Start</label>
                  <input
                    className="sizeSlider"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedAngle.style.arcArrowMark?.startPos ?? 0.45}
                    onChange={(e) =>
                      updateSelectedAngleStyle({
                        arcArrowMark: {
                          ...(selectedAngle.style.arcArrowMark ?? angleArrowDefaults),
                          startPos: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="controlRow">
                  <label className="controlLabel">End</label>
                  <input
                    className="sizeSlider"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedAngle.style.arcArrowMark?.endPos ?? 0.55}
                    onChange={(e) =>
                      updateSelectedAngleStyle({
                        arcArrowMark: {
                          ...(selectedAngle.style.arcArrowMark ?? angleArrowDefaults),
                          endPos: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="controlRow">
                  <label className="controlLabel">Step</label>
                  <input
                    className="sizeSlider"
                    type="number"
                    min={0.01}
                    max={1}
                    step={0.01}
                    value={selectedAngle.style.arcArrowMark?.step ?? 0.05}
                    onChange={(e) =>
                      updateSelectedAngleStyle({
                        arcArrowMark: {
                          ...(selectedAngle.style.arcArrowMark ?? angleArrowDefaults),
                          step: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </>
            )}
          </details>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedAngle.style.fillEnabled}
              onChange={(e) => updateSelectedAngleStyle({ fillEnabled: e.target.checked })}
            />
            {selectedAngleIsSector ? "Fill Sector" : "Fill Angle"}
          </label>
          <div className="controlRow">
            <label className="controlLabel">Fill Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAngle.style.fillColor}
              onChange={(e) => updateSelectedAngleStyle({ fillColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={0.6}
              step={0.01}
              value={selectedAngle.style.fillOpacity}
              onChange={(e) => updateSelectedAngleStyle({ fillOpacity: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Pattern</label>
            <select
              className="selectInput"
              value={selectedAngle.style.pattern ?? ""}
              onChange={(e) => updateSelectedAngleStyle({ pattern: e.target.value })}
            >
              {FILL_PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(selectedAngle.style.pattern ?? "") !== "" && (
            <div className="controlRow">
              <label className="controlLabel">Pattern Color</label>
              <input
                className="colorInput"
                type="color"
                value={selectedAngle.style.patternColor ?? selectedAngle.style.strokeColor}
                onChange={(e) => updateSelectedAngleStyle({ patternColor: e.target.value })}
              />
            </div>
          )}
          <div className="controlRow">
            <label className="controlLabel">Text Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAngle.style.textColor}
              onChange={(e) => updateSelectedAngleStyle({ textColor: e.target.value })}
            />
          </div>
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Text Size</label>
            <input
              className="sizeSlider"
              type="range"
              min={8}
              max={32}
              step={1}
              value={selectedAngle.style.textSize}
              onChange={(e) => updateSelectedAngleStyle({ textSize: Number(e.target.value) })}
            />
            <input
              className="scaleInputCompact"
              type="number"
              min={8}
              max={32}
              step={1}
              value={selectedAngle.style.textSize}
              onChange={(e) => updateSelectedAngleStyle({ textSize: Number(e.target.value) })}
            />
          </div>
          <button className="deleteButton" onClick={deleteSelectedObject}>
            Delete
          </button>
        </div>
      )}
    </>
  );
}
