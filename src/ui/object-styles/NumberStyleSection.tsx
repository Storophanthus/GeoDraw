import { formatRoundedDisplay } from "../displayFormat";
import type { SceneModel } from "../../scene/points";

type NumberStyleSectionProps = {
    selectedNumber: SceneModel["numbers"][number];
    selectedNumberValue: number | null;
    updateSelectedNumberDefinition: (def: SceneModel["numbers"][number]["definition"]) => void;
    deleteSelectedObject: () => void;
};

export function NumberStyleSection({
    selectedNumber,
    selectedNumberValue,
    updateSelectedNumberDefinition,
    deleteSelectedObject,
}: NumberStyleSectionProps) {
    return (
        <div className="toolInfo">
            <div className="subSectionTitle">Number</div>
            <div className="statusText">
                {selectedNumber.name} = {selectedNumberValue === null ? "undefined" : formatRoundedDisplay(selectedNumberValue, 6)}
            </div>
            {selectedNumber.definition.kind === "slider" && (() => {
                const def = selectedNumber.definition;
                const lo = Math.min(def.min, def.max);
                const hi = Math.max(def.min, def.max);
                const safeStep = Number.isFinite(def.step) && def.step > 0 ? def.step : 0.1;
                const safeValue = Math.min(hi, Math.max(lo, def.value));
                const updateSlider = (patch: Partial<typeof def>) => {
                    const merged = { ...def, ...patch };
                    const nextLo = Math.min(merged.min, merged.max);
                    const nextHi = Math.max(merged.min, merged.max);
                    const nextStep = Number.isFinite(merged.step) && merged.step > 0 ? merged.step : safeStep;
                    const nextValue = Math.min(nextHi, Math.max(nextLo, merged.value));
                    updateSelectedNumberDefinition({
                        ...merged,
                        min: nextLo,
                        max: nextHi,
                        step: nextStep,
                        value: nextValue,
                    });
                };
                return (
                    <>
                        <div className="controlRow">
                            <label className="controlLabel">Slider Type</label>
                            <select
                                className="selectInput"
                                value={def.sliderMode === "radian" ? "degree" : (def.sliderMode ?? "real")}
                                onChange={(e) => updateSlider({ sliderMode: e.target.value === "degree" ? "degree" : "real" })}
                            >
                                <option value="real">Real</option>
                                <option value="degree">Degree</option>
                            </select>
                        </div>
                        <div className="controlRow controlRowWithNumeric">
                            <label className="controlLabel">Value</label>
                            <input
                                className="sizeSlider"
                                type="range"
                                min={lo}
                                max={hi}
                                step={safeStep}
                                value={safeValue}
                                onChange={(e) => updateSlider({ value: Number(e.target.value) })}
                            />
                            <input
                                className="scaleInputCompact"
                                type="number"
                                step="any"
                                value={safeValue}
                                onChange={(e) => updateSlider({ value: Number(e.target.value) })}
                            />
                        </div>
                        <div className="controlRow controlRowWithNumeric">
                            <label className="controlLabel">Min</label>
                            <input
                                className="scaleInputCompact"
                                type="number"
                                step="any"
                                value={def.min}
                                onChange={(e) => updateSlider({ min: Number(e.target.value) })}
                            />
                            <label className="controlLabel">Max</label>
                            <input
                                className="scaleInputCompact"
                                type="number"
                                step="any"
                                value={def.max}
                                onChange={(e) => updateSlider({ max: Number(e.target.value) })}
                            />
                        </div>
                        <div className="controlRow">
                            <label className="controlLabel">Step</label>
                            <input
                                className="scaleInputCompact"
                                type="number"
                                min={Number.EPSILON}
                                step="any"
                                value={safeStep}
                                onChange={(e) => updateSlider({ step: Number(e.target.value) })}
                            />
                        </div>
                    </>
                );
            })()}
            <button className="deleteButton" onClick={deleteSelectedObject}>
                Delete
            </button>
        </div>
    );
}
