
import { type ScenePolygon } from "../../scene/points";
import { ColorSwatchInput } from "../ColorField";
import { StyleControlGroup } from "../StyleControlGroup";
import { StyleSectionHeader } from "../StyleSectionHeader";

const FILL_PATTERN_OPTIONS = [
    { value: "", label: "None" },
    { value: "north east lines", label: "North East Lines" },
    { value: "north west lines", label: "North West Lines" },
    { value: "grid", label: "Grid" },
    { value: "crosshatch", label: "Crosshatch" },
    { value: "dots", label: "Dots" },
] as const;

type PolygonStyleSectionProps = {
    selectedPolygon: ScenePolygon;
    selectedPolygonOwnedEdgesVisible: boolean;
    selectedStyleAsDefault: boolean;
    onMakeStyleDefaultChange: (checked: boolean) => void;
    updateSelectedPolygonStyle: (style: Partial<ScenePolygon["style"]>) => void;
    updateSelectedPolygonFields: (fields: Partial<Pick<ScenePolygon, "showLabel" | "labelText" | "labelPosWorld" | "labelGlow" | "visible">>) => void;
    setSelectedPolygonOwnedSegmentsVisible: (visible: boolean) => void;
};

export function PolygonStyleSection({
    selectedPolygon,
    selectedPolygonOwnedEdgesVisible,
    selectedStyleAsDefault,
    onMakeStyleDefaultChange,
    updateSelectedPolygonStyle,
    updateSelectedPolygonFields,
    setSelectedPolygonOwnedSegmentsVisible,
}: PolygonStyleSectionProps) {
    const selectedAreaStyle = selectedPolygon.style;

    return (
        <div className="cosmeticsBlock">
            <StyleSectionHeader
                title="Polygon Style"
                selectedStyleAsDefault={selectedStyleAsDefault}
                onMakeStyleDefaultChange={onMakeStyleDefaultChange}
            />
            <StyleControlGroup title="Edges">
                <label className="checkboxRow">
                    <input
                        type="checkbox"
                        checked={selectedPolygonOwnedEdgesVisible}
                        onChange={(e) => setSelectedPolygonOwnedSegmentsVisible(e.target.checked)}
                    />
                    Show Edges
                </label>
                <div className="controlRow">
                    <label className="controlLabel">Edge Color</label>
                    <ColorSwatchInput
                        value={selectedAreaStyle.strokeColor}
                        onChange={(e) => updateSelectedPolygonStyle({ strokeColor: e.target.value })}
                    />
                </div>
                <div className="controlRow controlRowWithNumeric">
                    <label className="controlLabel">Edge Width</label>
                    <input
                        className="sizeSlider"
                        type="range"
                        min={0.5}
                        max={6}
                        step={0.1}
                        value={selectedAreaStyle.strokeWidth}
                        onChange={(e) => updateSelectedPolygonStyle({ strokeWidth: Number(e.target.value) })}
                    />
                    <input
                        className="scaleInputCompact"
                        type="number"
                        min={0.5}
                        max={6}
                        step={0.1}
                        value={selectedAreaStyle.strokeWidth}
                        onChange={(e) => updateSelectedPolygonStyle({ strokeWidth: Number(e.target.value) })}
                    />
                </div>
                <div className="controlRow">
                    <label className="controlLabel">Edge Dash</label>
                    <select
                        className="selectInput"
                        value={selectedAreaStyle.strokeDash}
                        onChange={(e) =>
                            updateSelectedPolygonStyle({ strokeDash: e.target.value as "solid" | "dashed" | "dotted" })
                        }
                    >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                    </select>
                </div>
                <div className="controlRow">
                    <label className="controlLabel">Edge Opacity</label>
                    <input
                        className="sizeSlider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedAreaStyle.strokeOpacity}
                        onChange={(e) => updateSelectedPolygonStyle({ strokeOpacity: Number(e.target.value) })}
                    />
                </div>
            </StyleControlGroup>

            <StyleControlGroup title="Fill">
                <div className="controlRow">
                    <label className="controlLabel">Fill Color</label>
                    <ColorSwatchInput
                        value={selectedAreaStyle.fillColor ?? "#FFFFFF"}
                        onChange={(e) => updateSelectedPolygonStyle({ fillColor: e.target.value })}
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
                            updateSelectedPolygonStyle({
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
                        onChange={(e) => updateSelectedPolygonStyle({ pattern: e.target.value })}
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
                            onChange={(e) => updateSelectedPolygonStyle({ patternColor: e.target.value })}
                        />
                    </div>
                )}
            </StyleControlGroup>

            <StyleControlGroup title="Label">
                <label className="checkboxRow">
                    <input
                        type="checkbox"
                        checked={Boolean(selectedPolygon.showLabel)}
                        onChange={(e) => updateSelectedPolygonFields({ showLabel: e.target.checked })}
                    />
                    Show Label
                </label>
                {Boolean(selectedPolygon.showLabel) && (
                    <>
                        <label className="checkboxRow">
                            <input
                                type="checkbox"
                                checked={selectedPolygon.labelGlow !== false}
                                onChange={(e) => updateSelectedPolygonFields({ labelGlow: e.target.checked })}
                            />
                            Label Glow
                        </label>
                        <div className="controlRow">
                            <label className="controlLabel">Label Text</label>
                            <input
                                className="renameInput"
                                value={selectedPolygon.labelText ?? ""}
                                onChange={(e) => updateSelectedPolygonFields({ labelText: e.target.value })}
                            />
                        </div>
                    </>
                )}
            </StyleControlGroup>
        </div>
    );
}
