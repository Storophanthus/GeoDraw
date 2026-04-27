
import { type CircleStyle, type SceneCircle } from "../../scene/points";
import { ColorSwatchInput } from "../ColorField";
import { StyleControlGroup } from "../StyleControlGroup";
import { StyleSectionHeader } from "../StyleSectionHeader";
import { ArrowListControl } from "./ArrowListControl";

const FILL_PATTERN_OPTIONS = [
    { value: "", label: "None" },
    { value: "north east lines", label: "North East Lines" },
    { value: "north west lines", label: "North West Lines" },
    { value: "grid", label: "Grid" },
    { value: "crosshatch", label: "Crosshatch" },
    { value: "dots", label: "Dots" },
] as const;

type CircleStyleSectionProps = {
    selectedCircle: SceneCircle;
    selectedStyleAsDefault: boolean;
    onMakeStyleDefaultChange: (checked: boolean) => void;
    updateSelectedCircleStyle: (style: Partial<CircleStyle>) => void;
    updateSelectedCircleFields: (fields: Partial<Pick<SceneCircle, "showLabel" | "labelText" | "labelPosWorld" | "labelGlow" | "visible">>) => void;
};

export function CircleStyleSection({
    selectedCircle,
    selectedStyleAsDefault,
    onMakeStyleDefaultChange,
    updateSelectedCircleStyle,
    updateSelectedCircleFields,
}: CircleStyleSectionProps) {
    const selectedAreaStyle = selectedCircle.style;

    return (
        <div className="cosmeticsBlock">
            <StyleSectionHeader
                title="Circle Style"
                selectedStyleAsDefault={selectedStyleAsDefault}
                onMakeStyleDefaultChange={onMakeStyleDefaultChange}
            />
            <StyleControlGroup title="Stroke">
                <div className="controlRow">
                    <label className="controlLabel">Stroke Color</label>
                    <ColorSwatchInput
                        value={selectedAreaStyle.strokeColor}
                        onChange={(e) => updateSelectedCircleStyle({ strokeColor: e.target.value })}
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
                        onChange={(e) => updateSelectedCircleStyle({ strokeWidth: Number(e.target.value) })}
                    />
                    <input
                        className="scaleInputCompact"
                        type="number"
                        min={0.5}
                        max={6}
                        step={0.1}
                        value={selectedAreaStyle.strokeWidth}
                        onChange={(e) => updateSelectedCircleStyle({ strokeWidth: Number(e.target.value) })}
                    />
                </div>
                <div className="controlRow">
                    <label className="controlLabel">Dash</label>
                    <select
                        className="selectInput"
                        value={selectedAreaStyle.strokeDash}
                        onChange={(e) =>
                            updateSelectedCircleStyle({ strokeDash: e.target.value as "solid" | "dashed" | "dotted" })
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
                        onChange={(e) => updateSelectedCircleStyle({ strokeOpacity: Number(e.target.value) })}
                    />
                </div>
            </StyleControlGroup>

            <StyleControlGroup title="Fill">
                <div className="controlRow">
                    <label className="controlLabel">Fill Color</label>
                    <ColorSwatchInput
                        value={selectedAreaStyle.fillColor ?? "#FFFFFF"}
                        onChange={(e) => updateSelectedCircleStyle({ fillColor: e.target.value })}
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
                            updateSelectedCircleStyle({
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
                        onChange={(e) => updateSelectedCircleStyle({ pattern: e.target.value })}
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
                        <ColorSwatchInput
                            value={selectedAreaStyle.patternColor ?? selectedAreaStyle.strokeColor}
                            onChange={(e) => updateSelectedCircleStyle({ patternColor: e.target.value })}
                        />
                    </div>
                )}
            </StyleControlGroup>

            <StyleControlGroup title="Label">
                <label className="checkboxRow">
                    <input
                        type="checkbox"
                        checked={Boolean(selectedCircle.showLabel)}
                        onChange={(e) => updateSelectedCircleFields({ showLabel: e.target.checked })}
                    />
                    Show Label
                </label>
                {Boolean(selectedCircle.showLabel) && (
                    <>
                        <label className="checkboxRow">
                            <input
                                type="checkbox"
                                checked={selectedCircle.labelGlow !== false}
                                onChange={(e) => updateSelectedCircleFields({ labelGlow: e.target.checked })}
                            />
                            Label Glow
                        </label>
                        <div className="controlRow">
                            <label className="controlLabel">Label Text</label>
                            <input
                                className="renameInput"
                                value={selectedCircle.labelText ?? ""}
                                onChange={(e) => updateSelectedCircleFields({ labelText: e.target.value })}
                            />
                        </div>
                    </>
                )}
            </StyleControlGroup>

            <StyleControlGroup title="Arrow">
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
            </StyleControlGroup>
        </div>
    );
}
