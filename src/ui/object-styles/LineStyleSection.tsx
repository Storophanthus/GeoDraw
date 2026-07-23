
import { type LineStyle, type SceneLine } from "../../scene/points";
import { ColorSwatchInput } from "../ColorField";
import { StyleControlGroup, StyleControlTabbedGroups } from "../StyleControlGroup";
import { StyleSectionHeader } from "../StyleSectionHeader";

type LineStyleSectionProps = {
    selectedLine: SceneLine;
    selectedStyleAsDefault: boolean;
    onMakeStyleDefaultChange: (checked: boolean) => void;
    updateSelectedLineStyle: (style: Partial<LineStyle>) => void;
    updateSelectedLineFields: (fields: Partial<Pick<SceneLine, "showLabel" | "labelText" | "labelPosWorld" | "labelGlow" | "visible">>) => void;
    canConvertToSegment: boolean;
    convertSelectedLineToSegment: () => void;
    mode?: "object" | "toolDefault";
};

export function LineStyleSection({
    selectedLine,
    selectedStyleAsDefault,
    onMakeStyleDefaultChange,
    updateSelectedLineStyle,
    updateSelectedLineFields,
    canConvertToSegment,
    convertSelectedLineToSegment,
    mode = "object",
}: LineStyleSectionProps) {
    return (
        <div className="cosmeticsBlock">
            <StyleSectionHeader
                title="Line Style"
                selectedStyleAsDefault={selectedStyleAsDefault}
                onMakeStyleDefaultChange={onMakeStyleDefaultChange}
                mode={mode}
            />
            <StyleControlTabbedGroups>
            {mode === "object" && (
                <StyleControlGroup title="Line">
                    <button
                        type="button"
                        className="actionButton secondary"
                        style={{ width: "100%" }}
                        onClick={convertSelectedLineToSegment}
                        disabled={!canConvertToSegment}
                        title={canConvertToSegment ? "Hide this line and create segment AB with same style" : "Available for Line(A,B) only"}
                    >
                        Convert
                    </button>
                </StyleControlGroup>
            )}

            <StyleControlGroup title="Stroke">
                <div className="controlRow">
                    <label className="controlLabel">Stroke Color</label>
                    <ColorSwatchInput
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
            </StyleControlGroup>

            <StyleControlGroup title="Label">
                <label className="checkboxRow">
                    <input
                        type="checkbox"
                        checked={Boolean(selectedLine.showLabel)}
                        onChange={(e) => updateSelectedLineFields({ showLabel: e.target.checked })}
                    />
                    Show Label
                </label>
                {Boolean(selectedLine.showLabel) && (
                    <>
                        <label className="checkboxRow">
                            <input
                                type="checkbox"
                                checked={selectedLine.labelGlow !== false}
                                onChange={(e) => updateSelectedLineFields({ labelGlow: e.target.checked })}
                            />
                            Label Glow
                        </label>
                        {mode === "object" && (
                            <div className="controlRow">
                                <label className="controlLabel">Label Text</label>
                                <input
                                    className="renameInput"
                                    value={selectedLine.labelText ?? ""}
                                    onChange={(e) => updateSelectedLineFields({ labelText: e.target.value })}
                                />
                            </div>
                        )}
                    </>
                )}
            </StyleControlGroup>
            </StyleControlTabbedGroups>
        </div>
    );
}
