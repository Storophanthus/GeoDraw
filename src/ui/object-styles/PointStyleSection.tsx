
import { type PointStyle, type ScenePoint } from "../../scene/points";

const POINT_MARK_OPTIONS = ["x", "+", "o", "bullet", "square"] as const;

type PointStyleSectionProps = {
    selectedPoint: ScenePoint;
    updateSelectedPointStyle: (style: Partial<PointStyle>) => void;
    updateSelectedPointFields: (fields: Partial<Pick<ScenePoint, "showLabel" | "captionTex" | "visible">>) => void;
};

export function PointStyleSection({
    selectedPoint,
    updateSelectedPointStyle,
    updateSelectedPointFields,
}: PointStyleSectionProps) {
    return (
        <div className="cosmeticsBlock">
            <div className="subSectionTitle">Point Style</div>
            <label className="checkboxRow">
                <input
                    type="checkbox"
                    checked={selectedPoint.showLabel !== "none"}
                    onChange={(e) => updateSelectedPointFields({ showLabel: e.target.checked ? "caption" : "none" })}
                />
                Show Label
            </label>
            {selectedPoint.showLabel !== "none" && (
                <div className="controlRow">
                    <label className="controlLabel">Label Text</label>
                    <input
                        className="renameInput"
                        value={selectedPoint.captionTex ?? selectedPoint.name}
                        onChange={(e) => updateSelectedPointFields({ captionTex: e.target.value })}
                    />
                </div>
            )}
            <div className="controlRow">
                <label className="controlLabel">Color</label>
                <input
                    className="colorInput"
                    type="color"
                    value={selectedPoint.style.fillColor}
                    onChange={(e) => updateSelectedPointStyle({ fillColor: e.target.value })}
                />
            </div>
            <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Size</label>
                <input
                    className="sizeSlider"
                    type="range"
                    min={2}
                    max={16}
                    step={0.5}
                    value={selectedPoint.style.sizePx}
                    onChange={(e) => updateSelectedPointStyle({ sizePx: Number(e.target.value) })}
                />
                <input
                    className="scaleInputCompact"
                    type="number"
                    min={2}
                    max={16}
                    step={0.5}
                    value={selectedPoint.style.sizePx}
                    onChange={(e) => updateSelectedPointStyle({ sizePx: Number(e.target.value) })}
                />
            </div>
            <div className="controlRow">
                <label className="controlLabel">Mark</label>
                <select
                    className="selectInput"
                    value={selectedPoint.style.shape}
                    onChange={(e) => updateSelectedPointStyle({ shape: e.target.value as any })}
                >
                    {POINT_MARK_OPTIONS.map((shape) => (
                        <option key={shape} value={shape}>
                            {shape}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
