
import { type LineStyle, type SceneLine } from "../../scene/points";

type LineStyleSectionProps = {
    selectedLine: SceneLine;
    updateSelectedLineStyle: (style: Partial<LineStyle>) => void;
    updateSelectedLineFields: (fields: Partial<Pick<SceneLine, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
};

export function LineStyleSection({
    selectedLine,
    updateSelectedLineStyle,
    updateSelectedLineFields,
}: LineStyleSectionProps) {
    return (
        <div className="cosmeticsBlock">
            <div className="subSectionTitle">Line Style</div>
            <label className="checkboxRow">
                <input
                    type="checkbox"
                    checked={Boolean(selectedLine.showLabel)}
                    onChange={(e) => updateSelectedLineFields({ showLabel: e.target.checked })}
                />
                Show Label
            </label>
            {Boolean(selectedLine.showLabel) && (
                <div className="controlRow">
                    <label className="controlLabel">Label Text</label>
                    <input
                        className="renameInput"
                        value={selectedLine.labelText ?? ""}
                        onChange={(e) => updateSelectedLineFields({ labelText: e.target.value })}
                    />
                </div>
            )}
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
    );
}
