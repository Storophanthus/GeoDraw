
import { type ScenePolygon } from "../../scene/points";

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
    updateSelectedPolygonStyle: (style: Partial<ScenePolygon["style"]>) => void;
    updateSelectedPolygonFields: (fields: Partial<Pick<ScenePolygon, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
    setSelectedPolygonOwnedSegmentsVisible: (visible: boolean) => void;
};

export function PolygonStyleSection({
    selectedPolygon,
    selectedPolygonOwnedEdgesVisible,
    updateSelectedPolygonStyle,
    updateSelectedPolygonFields,
    setSelectedPolygonOwnedSegmentsVisible,
}: PolygonStyleSectionProps) {
    const selectedAreaStyle = selectedPolygon.style;

    return (
        <div className="cosmeticsBlock">
            <div className="subSectionTitle">Polygon Style</div>
            <label className="checkboxRow">
                <input
                    type="checkbox"
                    checked={Boolean(selectedPolygon.showLabel)}
                    onChange={(e) => updateSelectedPolygonFields({ showLabel: e.target.checked })}
                />
                Show Label
            </label>
            <label className="checkboxRow">
                <input
                    type="checkbox"
                    checked={selectedPolygonOwnedEdgesVisible}
                    onChange={(e) => setSelectedPolygonOwnedSegmentsVisible(e.target.checked)}
                />
                Show Edges
            </label>
            {Boolean(selectedPolygon.showLabel) && (
                <div className="controlRow">
                    <label className="controlLabel">Label Text</label>
                    <input
                        className="renameInput"
                        value={selectedPolygon.labelText ?? ""}
                        onChange={(e) => updateSelectedPolygonFields({ labelText: e.target.value })}
                    />
                </div>
            )}
            <div className="controlRow">
                <label className="controlLabel">Edge Color</label>
                <input
                    className="colorInput"
                    type="color"
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
            <div className="controlRow">
                <label className="controlLabel">Fill Color</label>
                <input
                    className="colorInput"
                    type="color"
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
                    <input
                        className="colorInput"
                        type="color"
                        value={selectedAreaStyle.patternColor ?? selectedAreaStyle.strokeColor}
                        onChange={(e) => updateSelectedPolygonStyle({ patternColor: e.target.value })}
                    />
                </div>
            )}
        </div>
    );
}
