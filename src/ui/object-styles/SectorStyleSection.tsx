import * as React from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { type AngleMark, type AngleMarkSymbol, type AngleStyle, type PathArrowMark, type SceneAngle } from "../../scene/points";
import { ArrowListControl, DEFAULT_PATH_ARROW_MARK } from "./ArrowListControl";
import { MarkSymbolPicker } from "./MarkSymbolPicker";

const FILL_PATTERN_OPTIONS = [
  { value: "", label: "None" },
  { value: "north east lines", label: "North East Lines" },
  { value: "north west lines", label: "North West Lines" },
  { value: "grid", label: "Grid" },
  { value: "crosshatch", label: "Crosshatch" },
  { value: "dots", label: "Dots" },
] as const;

const DEFAULT_SECTOR_MARK: AngleMark = {
  enabled: true,
  arcMultiplicity: 1,
  markSymbol: "|",
  markPos: 0.5,
  markSize: 5.2,
  distribution: "single",
  startPos: 0.45,
  endPos: 0.55,
  step: 0.05,
};

const SECTOR_BAR_SYMBOLS: AngleMarkSymbol[] = ["|", "||", "|||"];

type SectorStyleSectionProps = {
  selectedSector: SceneAngle;
  updateSelectedAngleStyle: (style: Partial<AngleStyle>) => void;
  deleteSelectedObject: () => void;
};

export function SectorStyleSection({
  selectedSector,
  updateSelectedAngleStyle,
  deleteSelectedObject,
}: SectorStyleSectionProps) {
  if (selectedSector.kind !== "sector") return null;

  const [selectedSectorMarkIndex, setSelectedSectorMarkIndex] = React.useState(0);

  const resolvedSectorMarks = React.useMemo(() => {
    const source = Array.isArray(selectedSector.style.angleMarks) ? selectedSector.style.angleMarks : [];
    if (source.length === 0) {
      // Sector starts with empty mark list by default.
      // Keep backward compatibility: if legacy top-level sector mark exists, expose it.
      const legacySymbol = selectedSector.style.markSymbol ?? "none";
      if (selectedSector.style.markStyle === "arc" && legacySymbol !== "none") {
        return [
          {
            ...DEFAULT_SECTOR_MARK,
            enabled: true,
            markSymbol: legacySymbol,
            markPos: selectedSector.style.markPos ?? 0.5,
            markSize: selectedSector.style.markSize ?? 5.2,
            markColor: selectedSector.style.markColor ?? selectedSector.style.strokeColor,
          },
        ];
      }
      return [];
    }
    return source.map((mark) => ({
      ...DEFAULT_SECTOR_MARK,
      ...mark,
      arcMultiplicity: 1 as const,
      markSymbol: mark.markSymbol ?? selectedSector.style.markSymbol ?? "|",
      markPos: Number.isFinite(mark.markPos) ? mark.markPos : 0.5,
      markSize: Number.isFinite(mark.markSize) ? mark.markSize : 5.2,
      markColor: mark.markColor ?? selectedSector.style.markColor ?? selectedSector.style.strokeColor,
    }));
  }, [selectedSector]);

  React.useEffect(() => {
    setSelectedSectorMarkIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, resolvedSectorMarks.length - 1))));
  }, [resolvedSectorMarks.length, selectedSector.id]);

  const selectedSectorMark = resolvedSectorMarks[selectedSectorMarkIndex] ?? null;

  const commitSectorMarks = React.useCallback(
    (nextMarks: AngleMark[]) => {
      const normalized = nextMarks.map((mark) => ({ ...DEFAULT_SECTOR_MARK, ...mark, arcMultiplicity: 1 as const }));
      const first = normalized[0];
      const hasVisibleMark = normalized.some((mark) => mark.enabled && mark.markSymbol !== "none");
      updateSelectedAngleStyle({
        markStyle: hasVisibleMark ? "arc" : "none",
        angleMarks: normalized,
        arcMultiplicity: 1,
        markSymbol: first?.markSymbol ?? "none",
        markPos: first?.markPos ?? 0.5,
        markSize: first?.markSize ?? 5.2,
        markColor: first?.markColor ?? selectedSector.style.strokeColor,
      });
    },
    [selectedSector.style.strokeColor, updateSelectedAngleStyle]
  );

  return (
    <div className="cosmeticsBlock">
      <div className="subSectionTitle">Sector Style</div>
      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={Boolean(selectedSector.style.showLabel)}
          onChange={(e) => updateSelectedAngleStyle({ showLabel: e.target.checked })}
        />
        Show Label
      </label>
      <div className="controlRow">
        <label className="controlLabel">Label Text</label>
        <input
          className="renameInput"
          value={selectedSector.style.labelText ?? ""}
          onChange={(e) => updateSelectedAngleStyle({ labelText: e.target.value })}
        />
      </div>

      <div className="subSectionTitle" style={{ marginTop: 10 }}>
        Arc Mark
      </div>
      <div
        className="arrowListHeader"
        style={{ display: "grid", gridTemplateColumns: "max-content 1fr", alignItems: "center", gap: "8px", marginTop: "4px" }}
      >
        <label className="controlLabel">Mark List</label>
        <div className="arrowListButtons" style={{ display: "flex", gap: "6px" }}>
          <select
            className="selectInput"
            value={resolvedSectorMarks.length === 0 ? "" : selectedSectorMarkIndex}
            onChange={(e) => setSelectedSectorMarkIndex(Number(e.target.value))}
            disabled={resolvedSectorMarks.length === 0}
            style={{
              height: "30px",
              borderRadius: "6px",
              borderColor: "var(--gd-ui-border, #cbd5e1)",
              padding: "0 2px 0 6px",
              flex: 1,
              fontSize: "13px",
              minWidth: "42px",
            }}
          >
            {resolvedSectorMarks.map((_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
          <div
            style={{
              display: "flex",
              gap: "1px",
              background: "var(--gd-ui-border, #cbd5e1)",
              padding: "1px",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              className="iconButton"
              title="Add mark"
              onClick={() => {
                const nextMarks = [...resolvedSectorMarks, { ...DEFAULT_SECTOR_MARK, markColor: selectedSector.style.strokeColor }];
                commitSectorMarks(nextMarks);
                setSelectedSectorMarkIndex(nextMarks.length - 1);
              }}
              style={{
                height: "28px",
                width: "30px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "4px 0 0 4px",
                background: "var(--gd-ui-surface, #fff)",
                cursor: "pointer",
              }}
            >
              <Plus size={15} color="var(--gd-ui-text, #334155)" />
            </button>
            <button
              type="button"
              className="iconButton"
              title="Duplicate mark"
              disabled={!selectedSectorMark}
              onClick={() => {
                if (!selectedSectorMark) return;
                const nextMarks = [...resolvedSectorMarks, { ...selectedSectorMark }];
                commitSectorMarks(nextMarks);
                setSelectedSectorMarkIndex(nextMarks.length - 1);
              }}
              style={{
                height: "28px",
                width: "30px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "var(--gd-ui-surface, #fff)",
                cursor: selectedSectorMark ? "pointer" : "not-allowed",
                opacity: selectedSectorMark ? 1 : 0.6,
              }}
            >
              <Copy size={14} color="var(--gd-ui-text, #334155)" />
            </button>
            <button
              type="button"
              className="iconButton"
              title="Remove mark"
              disabled={!selectedSectorMark}
              onClick={() => {
                if (!selectedSectorMark) return;
                const nextMarks = resolvedSectorMarks.filter((_, i) => i !== selectedSectorMarkIndex);
                commitSectorMarks(nextMarks);
                setSelectedSectorMarkIndex(Math.max(0, selectedSectorMarkIndex - 1));
              }}
              style={{
                height: "28px",
                width: "30px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "0 4px 4px 0",
                background: "var(--gd-ui-surface, #fff)",
                cursor: selectedSectorMark ? "pointer" : "not-allowed",
                opacity: selectedSectorMark ? 1 : 0.6,
              }}
            >
              <Trash2 size={14} color="var(--gd-ui-danger-text, #b91c1c)" />
            </button>
          </div>
        </div>
      </div>
      {selectedSectorMark ? (
        <>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedSectorMark.enabled}
              onChange={(e) => {
                const nextMarks = [...resolvedSectorMarks];
                nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, enabled: e.target.checked };
                commitSectorMarks(nextMarks);
              }}
            />
            Enable selected mark
          </label>
          <div className="controlRow">
            <label className="controlLabel">Bar Symbol</label>
            <MarkSymbolPicker
              value={(selectedSectorMark.markSymbol === "none" ? "|" : selectedSectorMark.markSymbol) as "|" | "||" | "|||"}
              options={SECTOR_BAR_SYMBOLS as ("none" | "|" | "||" | "|||")[]}
              onChange={(markSymbol) => {
                if (markSymbol === "none") return;
                const nextMarks: AngleMark[] = [...resolvedSectorMarks];
                nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, markSymbol: markSymbol as AngleMarkSymbol };
                commitSectorMarks(nextMarks);
              }}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Distribution</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px",
              }}
            >
              {(["single", "multi"] as const).map((distribution) => (
                <button
                  key={distribution}
                  type="button"
                  className="iconButton"
                  onClick={() => {
                    const nextMarks = [...resolvedSectorMarks];
                    nextMarks[selectedSectorMarkIndex] = {
                      ...selectedSectorMark,
                      distribution,
                      startPos: selectedSectorMark.startPos ?? 0.45,
                      endPos: selectedSectorMark.endPos ?? 0.55,
                      step: selectedSectorMark.step ?? 0.05,
                    };
                    commitSectorMarks(nextMarks);
                  }}
                  style={{
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid var(--gd-ui-border, #cbd5e1)",
                    background:
                      (selectedSectorMark.distribution ?? "single") === distribution
                        ? "var(--gd-ui-accent, #2563eb)"
                        : "var(--gd-ui-surface, #fff)",
                    color:
                      (selectedSectorMark.distribution ?? "single") === distribution
                        ? "var(--gd-ui-accent-contrast, #fff)"
                        : "var(--gd-ui-text, #334155)",
                  }}
                >
                  {distribution === "single" ? "Single" : "Multi"}
                </button>
              ))}
            </div>
          </div>
          {(selectedSectorMark.distribution ?? "single") === "multi" ? (
            <div
              className="nestedGroup"
              style={{
                background: "var(--gd-ui-surface-soft, #f8fafc)",
                border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
                borderRadius: "8px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Start</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedSectorMark.startPos ?? 0.45}
                  onChange={(e) => {
                    const nextMarks = [...resolvedSectorMarks];
                    nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, startPos: Number(e.target.value) };
                    commitSectorMarks(nextMarks);
                  }}
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedSectorMark.startPos ?? 0.45}
                  onChange={(e) => {
                    const nextMarks = [...resolvedSectorMarks];
                    nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, startPos: Number(e.target.value) };
                    commitSectorMarks(nextMarks);
                  }}
                />
              </div>
              <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">End</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedSectorMark.endPos ?? 0.55}
                  onChange={(e) => {
                    const nextMarks = [...resolvedSectorMarks];
                    nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, endPos: Number(e.target.value) };
                    commitSectorMarks(nextMarks);
                  }}
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedSectorMark.endPos ?? 0.55}
                  onChange={(e) => {
                    const nextMarks = [...resolvedSectorMarks];
                    nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, endPos: Number(e.target.value) };
                    commitSectorMarks(nextMarks);
                  }}
                />
              </div>
              <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Step</label>
                <input
                  className="sizeSlider"
                  type="range"
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  value={selectedSectorMark.step ?? 0.05}
                  onChange={(e) => {
                    const nextMarks = [...resolvedSectorMarks];
                    nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, step: Number(e.target.value) };
                    commitSectorMarks(nextMarks);
                  }}
                />
                <input
                  className="scaleInputCompact"
                  type="number"
                  min={0.001}
                  max={1}
                  step={0.01}
                  value={selectedSectorMark.step ?? 0.05}
                  onChange={(e) => {
                    const nextMarks = [...resolvedSectorMarks];
                    nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, step: Number(e.target.value) };
                    commitSectorMarks(nextMarks);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="controlRow">
              <label className="controlLabel">Mark Position</label>
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedSectorMark.markPos ?? 0.5}
                onChange={(e) => {
                  const nextMarks = [...resolvedSectorMarks];
                  nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, markPos: Number(e.target.value) };
                  commitSectorMarks(nextMarks);
                }}
              />
            </div>
          )}
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Mark Size</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.2}
              max={20}
              step={0.1}
              value={selectedSectorMark.markSize ?? 5.2}
              onChange={(e) => {
                const nextMarks = [...resolvedSectorMarks];
                nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, markSize: Number(e.target.value) };
                commitSectorMarks(nextMarks);
              }}
            />
            <input
              className="scaleInputCompact"
              type="number"
              min={0.2}
              max={20}
              step={0.1}
              value={selectedSectorMark.markSize ?? 5.2}
              onChange={(e) => {
                const nextMarks = [...resolvedSectorMarks];
                nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, markSize: Number(e.target.value) };
                commitSectorMarks(nextMarks);
              }}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Mark Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedSectorMark.markColor ?? selectedSector.style.strokeColor}
              onChange={(e) => {
                const nextMarks = [...resolvedSectorMarks];
                nextMarks[selectedSectorMarkIndex] = { ...selectedSectorMark, markColor: e.target.value };
                commitSectorMarks(nextMarks);
              }}
            />
          </div>
        </>
      ) : (
        <div className="controlRow">
          <label className="controlLabel">Arc Marks</label>
          <span style={{ color: "var(--gd-ui-muted-text, #64748b)", fontSize: "12px" }}>Add a mark to start.</span>
        </div>
      )}

      <div className="controlRow">
        <label className="controlLabel">Stroke Color</label>
        <input
          className="colorInput"
          type="color"
          value={selectedSector.style.strokeColor}
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
          value={selectedSector.style.strokeWidth}
          onChange={(e) => updateSelectedAngleStyle({ strokeWidth: Number(e.target.value) })}
        />
        <input
          className="scaleInputCompact"
          type="number"
          min={0.5}
          max={6}
          step={0.1}
          value={selectedSector.style.strokeWidth}
          onChange={(e) => updateSelectedAngleStyle({ strokeWidth: Number(e.target.value) })}
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Dash</label>
        <select
          className="selectInput"
          value={selectedSector.style.strokeDash ?? "solid"}
          onChange={(e) => updateSelectedAngleStyle({ strokeDash: e.target.value as "solid" | "dashed" | "dotted" })}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </div>

      <div className="subSectionTitle" style={{ marginTop: 10 }}>
        Arc Arrow
      </div>
      <ArrowListControl<PathArrowMark>
        arrows={
          selectedSector.style.arcArrowMarks ??
          (selectedSector.style.arcArrowMark?.enabled
            ? [
                {
                  ...DEFAULT_PATH_ARROW_MARK,
                  ...selectedSector.style.arcArrowMark,
                },
              ]
            : [])
        }
        createArrow={() => ({ ...DEFAULT_PATH_ARROW_MARK })}
        strokeColor={selectedSector.style.strokeColor}
        onChange={(newArrows) => updateSelectedAngleStyle({ arcArrowMarks: newArrows })}
      />

      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={Boolean(selectedSector.style.fillEnabled)}
          onChange={(e) => updateSelectedAngleStyle({ fillEnabled: e.target.checked })}
        />
        Fill Sector
      </label>
      <div className="controlRow">
        <label className="controlLabel">Fill Color</label>
        <input
          className="colorInput"
          type="color"
          value={selectedSector.style.fillColor}
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
          value={selectedSector.style.fillOpacity}
          onChange={(e) => updateSelectedAngleStyle({ fillOpacity: Number(e.target.value) })}
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Fill Pattern</label>
        <select
          className="selectInput"
          value={selectedSector.style.pattern ?? ""}
          onChange={(e) => updateSelectedAngleStyle({ pattern: e.target.value })}
        >
          {FILL_PATTERN_OPTIONS.map((opt) => (
            <option key={opt.value || "none"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {(selectedSector.style.pattern ?? "") !== "" && (
        <div className="controlRow">
          <label className="controlLabel">Pattern Color</label>
          <input
            className="colorInput"
            type="color"
            value={selectedSector.style.patternColor ?? selectedSector.style.strokeColor}
            onChange={(e) => updateSelectedAngleStyle({ patternColor: e.target.value })}
          />
        </div>
      )}
      <div className="controlRow">
        <label className="controlLabel">Text Color</label>
        <input
          className="colorInput"
          type="color"
          value={selectedSector.style.textColor}
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
          value={selectedSector.style.textSize}
          onChange={(e) => updateSelectedAngleStyle({ textSize: Number(e.target.value) })}
        />
        <input
          className="scaleInputCompact"
          type="number"
          min={8}
          max={32}
          step={1}
          value={selectedSector.style.textSize}
          onChange={(e) => updateSelectedAngleStyle({ textSize: Number(e.target.value) })}
        />
      </div>
      <button className="deleteButton" onClick={deleteSelectedObject}>
        Delete
      </button>
    </div>
  );
}
