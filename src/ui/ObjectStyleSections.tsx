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
  SegmentArrowMark,
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
const DEFAULT_SEGMENT_ARROW_MARK: SegmentArrowMark = {
  ...DEFAULT_PATH_ARROW_MARK,
  mode: "end",
};

function isPairArrowDirection(direction: ArrowDirection | undefined): boolean {
  return direction === "<->" || direction === ">-<";
}





function clampArrowWidthUi(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PATH_ARROW_UI;
  return Math.max(0, Math.min(12, value));
}

function parseArrowWidthUi(raw: string): number {
  return clampArrowWidthUi(Number(raw));
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

type ArrowListControlProps<T extends PathArrowMark> = {
  arrows: T[] | undefined;
  onChange: (arrows: T[]) => void;
  strokeColor: string;
  createArrow?: () => T;
  renderPlacementControl?: (args: {
    selectedArrow: T;
    updateSelectedArrow: (updates: Record<string, unknown>) => void;
  }) => React.ReactNode;
};

function ArrowListControl<T extends PathArrowMark>({
  arrows,
  onChange,
  strokeColor,
  createArrow,
  renderPlacementControl,
}: ArrowListControlProps<T>) {
  const makeArrow = React.useCallback(() => {
    if (createArrow) return createArrow();
    return { ...DEFAULT_PATH_ARROW_MARK } as T;
  }, [createArrow]);
  // Local state to track which arrow is being edited
  const [selectedByIndex, setSelectedByIndex] = React.useState<number>(0);
  const safeArrows = arrows ?? [];

  // Ensure we clamp the selection if the list shrank
  const actualIndex = Math.max(0, Math.min(selectedByIndex, safeArrows.length - 1));
  const selectedArrow = safeArrows[actualIndex] ?? makeArrow();
  const selectedPlacementMode = (selectedArrow as { mode?: SegmentArrowMark["mode"] }).mode;
  const isEndpointPlacement = selectedPlacementMode === "end";

  const updateSelectedArrow = (updates: Record<string, unknown>) => {
    const newArrows = [...safeArrows];
    if (newArrows.length === 0) return;
    newArrows[actualIndex] = { ...newArrows[actualIndex], ...(updates as Partial<T>) };
    onChange(newArrows);
  };

  const addArrow = () => {
    const newArrows = [...safeArrows, makeArrow()];
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
              borderColor: "var(--gd-ui-border, #cbd5e1)",
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

          <div style={{ display: "flex", gap: "1px", background: "var(--gd-ui-border, #cbd5e1)", padding: "1px", borderRadius: "6px", overflow: "hidden" }}>
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
                background: "var(--gd-ui-surface, #fff)",
                cursor: "pointer"
              }}
            >
              <Plus size={15} color="var(--gd-ui-text, #334155)" />
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
                background: "var(--gd-ui-surface, #fff)",
                cursor: safeArrows.length === 0 ? "not-allowed" : "pointer",
                opacity: safeArrows.length === 0 ? 0.6 : 1
              }}
            >
              <Copy size={14} color="var(--gd-ui-text, #334155)" />
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
                background: "var(--gd-ui-surface, #fff)",
                cursor: safeArrows.length === 0 ? "not-allowed" : "pointer",
                opacity: safeArrows.length === 0 ? 0.6 : 1
              }}
            >
              <Trash2 size={14} color={safeArrows.length === 0 ? "var(--gd-ui-border-strong, #94a3b8)" : "var(--gd-ui-danger-text, #b91c1c)"} />
            </button>
          </div>
        </div>
      </div>

      {
        safeArrows.length > 0 && (
          <div className="arrowDetail" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Detail Header */}
            <div style={{ paddingBottom: "8px", borderBottom: "1px solid var(--gd-ui-border-soft, #e2e8f0)", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gd-ui-text-subtle, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Editing Arrow {actualIndex + 1}
              </span>
            </div>

            {/* Group 1: Configuration */}
            <div className="controlGroup">
              {/* Direction */}
              <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                <label className="controlLabel">Direction</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px",
                  }}
                >
                  {ARROW_DIRECTION_OPTIONS.filter((opt) => !isPairArrowDirection(opt.value)).map((direction) => (
                    <button
                      key={direction.value}
                      type="button"
                      className="iconButton"
                      onClick={() => updateSelectedArrow({ direction: direction.value })}
                      style={{
                        height: "32px",
                        borderRadius: "6px",
                        border: "1px solid var(--gd-ui-border, #cbd5e1)",
                        background:
                          selectedArrow.direction === direction.value
                            ? "var(--gd-ui-accent, #2563eb)"
                            : "var(--gd-ui-surface, #fff)",
                        color:
                          selectedArrow.direction === direction.value
                            ? "var(--gd-ui-accent-contrast, #fff)"
                            : "var(--gd-ui-text, #334155)",
                      }}
                    >
                      {direction.label}
                    </button>
                  ))}
                </div>
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

              {renderPlacementControl?.({ selectedArrow, updateSelectedArrow })}

              {/* Distribution */}
              {!isEndpointPlacement && (
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
              )}
            </div>

            {/* Group 2: Sub-panel for Positioning */}
            {isEndpointPlacement ? (
              <div className="nestedGroup" style={{
                background: "var(--gd-ui-surface-soft, #f8fafc)",
                border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
                borderRadius: "8px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <span style={{ fontSize: "12px", color: "var(--gd-ui-text-subtle, #64748b)" }}>
                  Endpoint placement anchors arrow tips to segment ends.
                </span>
              </div>
            ) : selectedArrow.distribution === "multi" ? (
              <div className="nestedGroup" style={{
                background: "var(--gd-ui-surface-soft, #f8fafc)", /* subtle tint */
                border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
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
              background: "var(--gd-ui-surface-soft, #f8fafc)",
              border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
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
            <ArrowListControl<SegmentArrowMark>
              arrows={
                selectedSegment.style.segmentArrowMarks ??
                (selectedSegment.style.segmentArrowMark?.enabled
                  ? [
                    {
                      ...DEFAULT_SEGMENT_ARROW_MARK,
                      ...selectedSegment.style.segmentArrowMark,
                    },
                  ]
                  : [])
              }
              createArrow={() => ({ ...DEFAULT_SEGMENT_ARROW_MARK })}
              strokeColor={selectedSegment.style.strokeColor}
              onChange={(newArrows) => updateSelectedSegmentStyle({ segmentArrowMarks: newArrows })}
              renderPlacementControl={({ selectedArrow, updateSelectedArrow }) => (
                <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                  <label className="controlLabel">Placement</label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px",
                    }}
                  >
                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => updateSelectedArrow({ mode: "mid" })}
                      style={{
                        height: "32px",
                        borderRadius: "6px",
                        border: "1px solid var(--gd-ui-border, #cbd5e1)",
                        background:
                          selectedArrow.mode === "mid"
                            ? "var(--gd-ui-accent, #2563eb)"
                            : "var(--gd-ui-surface, #fff)",
                        color:
                          selectedArrow.mode === "mid"
                            ? "var(--gd-ui-accent-contrast, #fff)"
                            : "var(--gd-ui-text, #334155)",
                      }}
                    >
                      Middle
                    </button>
                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => updateSelectedArrow({ mode: "end", distribution: "single" })}
                      style={{
                        height: "32px",
                        borderRadius: "6px",
                        border: "1px solid var(--gd-ui-border, #cbd5e1)",
                        background:
                          selectedArrow.mode === "end"
                            ? "var(--gd-ui-accent, #2563eb)"
                            : "var(--gd-ui-surface, #fff)",
                        color:
                          selectedArrow.mode === "end"
                            ? "var(--gd-ui-accent-contrast, #fff)"
                            : "var(--gd-ui-text, #334155)",
                      }}
                    >
                      Endpoint
                    </button>
                  </div>
                </div>
              )}
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
              <ArrowListControl
                arrows={
                  selectedCircle.style.arrowMarks ??
                  (selectedCircle.style.arrowMark?.enabled
                    ? [selectedCircle.style.arrowMark]
                    : [])
                }
                strokeColor={selectedCircle.style.strokeColor}
                onChange={(newArrows) => updateSelectedCircleStyle({ arrowMarks: newArrows })}
              />
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
            <ArrowListControl
              arrows={
                selectedAngle.style.arcArrowMarks ??
                (selectedAngle.style.arcArrowMark?.enabled
                  ? [selectedAngle.style.arcArrowMark]
                  : [])
              }
              strokeColor={selectedAngle.style.strokeColor}
              onChange={(newArrows) => updateSelectedAngleStyle({ arcArrowMarks: newArrows })}
            />
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
