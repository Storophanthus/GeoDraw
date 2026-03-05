import * as React from "react";
import { type AngleMark, type AngleStyle, type SceneAngle } from "../../scene/points";
import { AngleMarkControl, DEFAULT_ANGLE_MARK } from "./AngleMarkControl";

const FILL_PATTERN_OPTIONS = [
  { value: "", label: "None" },
  { value: "north east lines", label: "North East Lines" },
  { value: "north west lines", label: "North West Lines" },
  { value: "grid", label: "Grid" },
  { value: "crosshatch", label: "Crosshatch" },
  { value: "dots", label: "Dots" },
] as const;

type AngleStyleSectionProps = {
  selectedAngle: SceneAngle;
  selectedAngleRightStatus: "none" | "exact" | "approx";
  updateSelectedAngleStyle: (style: Partial<AngleStyle>) => void;
  deleteSelectedObject: () => void;
};

export function AngleStyleSection({
  selectedAngle,
  selectedAngleRightStatus,
  updateSelectedAngleStyle,
  deleteSelectedObject,
}: AngleStyleSectionProps) {
  if (selectedAngle.kind === "sector") return null;

  const selectedAngleIsRight = selectedAngleRightStatus !== "none";
  const selectedAngleIsRightExact = selectedAngleRightStatus === "exact";

  const resolvedAngleMarks = React.useMemo(() => {
    if (selectedAngle.style.markStyle === "none") return [];
    const source =
      Array.isArray(selectedAngle.style.angleMarks) && selectedAngle.style.angleMarks.length > 0
        ? selectedAngle.style.angleMarks
        : selectedAngle.style.markStyle === "arc"
          ? [
              {
                enabled: true,
                arcMultiplicity: selectedAngle.style.arcMultiplicity ?? 1,
                markSymbol: selectedAngle.style.markSymbol ?? "none",
                markPos: selectedAngle.style.markPos ?? 0.5,
                markSize: selectedAngle.style.markSize ?? 7.4,
                markColor: selectedAngle.style.markColor,
              },
            ]
          : [];
    return source.map((mark) => ({
      ...DEFAULT_ANGLE_MARK,
      ...mark,
    }));
  }, [selectedAngle]);

  const commitAngleMarks = React.useCallback(
    (nextMarks: AngleMark[]) => {
      const primary = nextMarks[0] ?? DEFAULT_ANGLE_MARK;
      updateSelectedAngleStyle({
        markStyle: nextMarks.length > 0 ? "arc" : "none",
        angleMarks: nextMarks,
        arcMultiplicity: primary.arcMultiplicity,
        markSymbol: primary.markSymbol,
        markPos: primary.markPos,
        markSize: primary.markSize,
        markColor: primary.markColor ?? selectedAngle.style.markColor,
      });
    },
    [selectedAngle, updateSelectedAngleStyle]
  );

  return (
    <div className="cosmeticsBlock">
      <div className="subSectionTitle">Angle Style</div>
      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={Boolean(selectedAngle.style.showLabel)}
          onChange={(e) => updateSelectedAngleStyle({ showLabel: e.target.checked })}
        />
        Show Label
      </label>
      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={Boolean(selectedAngle.style.showValue)}
          onChange={(e) => updateSelectedAngleStyle({ showValue: e.target.checked })}
        />
        Show Value (deg)
      </label>
      <div className="controlRow">
        <label className="controlLabel">Label Text</label>
        <input
          className="renameInput"
          value={selectedAngle.style.labelText ?? ""}
          onChange={(e) => updateSelectedAngleStyle({ labelText: e.target.value })}
        />
      </div>
      {selectedAngleIsRight ? (
        <div className="controlRow">
          <label className="controlLabel">Mark</label>
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
        </div>
      ) : null}
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
      {!selectedAngleIsRight && (
        <AngleMarkControl
          resolvedAngleMarks={resolvedAngleMarks}
          commitAngleMarks={commitAngleMarks}
          strokeColor={selectedAngle.style.strokeColor}
          markColorFromStyle={selectedAngle.style.markColor}
          selectedAngleId={selectedAngle.id}
        />
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
      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={Boolean(selectedAngle.style.fillEnabled)}
          onChange={(e) => updateSelectedAngleStyle({ fillEnabled: e.target.checked })}
        />
        Fill Angle
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
  );
}
