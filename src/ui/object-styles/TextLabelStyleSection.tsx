import type { SceneModel } from "../../scene/points";
import { formatRoundedDisplay } from "../displayFormat";

type TextLabel = NonNullable<SceneModel["textLabels"]>[number];

type TextLabelStyleSectionProps = {
    selectedTextLabel: TextLabel;
    scene: SceneModel;
    selectedTextLabelBoundNumberValue: number | null;
    selectedTextLabelExprValue: number | null;
    updateSelectedTextLabelFields: (patch: Partial<TextLabel>) => void;
    updateSelectedTextLabelStyle: (patch: Partial<TextLabel["style"]>) => void;
    deleteSelectedObject: () => void;
};

export function TextLabelStyleSection({
    selectedTextLabel,
    scene,
    selectedTextLabelBoundNumberValue,
    selectedTextLabelExprValue,
    updateSelectedTextLabelFields,
    updateSelectedTextLabelStyle,
    deleteSelectedObject,
}: TextLabelStyleSectionProps) {
    return (
        <div className="toolInfo">
            <div className="subSectionTitle">Text Label</div>
            <div className="statusText">
                Position: ({formatRoundedDisplay(selectedTextLabel.positionWorld.x, 3)}, {formatRoundedDisplay(selectedTextLabel.positionWorld.y, 3)})
            </div>

            <div className="fieldBlock">
                <label className="fieldLabel">Name</label>
                <input
                    className="renameInput"
                    value={selectedTextLabel.name}
                    onChange={(e) => updateSelectedTextLabelFields({ name: e.target.value })}
                />
            </div>

            <div className="fieldBlock">
                <label className="fieldLabel">Text</label>
                <textarea
                    className="renameInput"
                    value={selectedTextLabel.text}
                    rows={3}
                    disabled={selectedTextLabel.contentMode === "number" || selectedTextLabel.contentMode === "expression"}
                    onChange={(e) => updateSelectedTextLabelFields({ text: e.target.value })}
                />
            </div>

            <div className="controlRow">
                <label className="controlLabel">Content</label>
                <select
                    className="selectInput"
                    value={
                        selectedTextLabel.contentMode === "number"
                            ? "number"
                            : selectedTextLabel.contentMode === "expression"
                                ? "expression"
                                : "static"
                    }
                    onChange={(e) => {
                        const nextMode = e.target.value === "number" ? "number" : e.target.value === "expression" ? "expression" : "static";
                        const firstNumberId = scene.numbers[0]?.id;
                        updateSelectedTextLabelFields({
                            contentMode: nextMode,
                            ...(nextMode === "number" && !selectedTextLabel.numberId && firstNumberId ? { numberId: firstNumberId } : {}),
                            ...(nextMode !== "number" ? { numberId: undefined } : {}),
                            ...(nextMode !== "expression" ? { expr: undefined } : {}),
                        });
                    }}
                >
                    <option value="static">Static Text</option>
                    <option value="number">Dynamic Number</option>
                    <option value="expression">Dynamic Expression</option>
                </select>
            </div>

            {selectedTextLabel.contentMode === "number" && (
                <>
                    <div className="controlRow">
                        <label className="controlLabel">Number</label>
                        <select
                            className="selectInput"
                            value={selectedTextLabel.numberId ?? ""}
                            onChange={(e) => updateSelectedTextLabelFields({ numberId: e.target.value || undefined })}
                            disabled={scene.numbers.length === 0}
                        >
                            {scene.numbers.length === 0 ? (
                                <option value="">No numbers</option>
                            ) : (
                                scene.numbers.map((num) => (
                                    <option key={num.id} value={num.id}>
                                        {num.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                    <div className="statusText">
                        Value: {selectedTextLabelBoundNumberValue === null ? "undefined" : formatRoundedDisplay(selectedTextLabelBoundNumberValue, 6)}
                    </div>
                </>
            )}

            {selectedTextLabel.contentMode === "expression" && (
                <>
                    <div className="fieldBlock">
                        <label className="fieldLabel">Expression</label>
                        <input
                            className="renameInput"
                            value={selectedTextLabel.expr ?? ""}
                            onChange={(e) => updateSelectedTextLabelFields({ expr: e.target.value })}
                            placeholder="e.g. Distance(A,B)^2"
                        />
                    </div>
                    <div className="statusText">
                        Value: {selectedTextLabelExprValue === null ? "undefined" : formatRoundedDisplay(selectedTextLabelExprValue, 6)}
                    </div>
                </>
            )}

            <label className="checkboxRow">
                <input
                    type="checkbox"
                    checked={selectedTextLabel.style.useTex}
                    onChange={(e) => updateSelectedTextLabelStyle({ useTex: e.target.checked })}
                />
                Render as TeX
            </label>

            <label className="checkboxRow">
                <input
                    type="checkbox"
                    checked={selectedTextLabel.visible}
                    onChange={(e) => updateSelectedTextLabelFields({ visible: e.target.checked })}
                />
                Visible
            </label>

            <div className="controlRow">
                <label className="controlLabel">Text Color</label>
                <input
                    className="colorInput"
                    type="color"
                    value={selectedTextLabel.style.textColor}
                    onChange={(e) => updateSelectedTextLabelStyle({ textColor: e.target.value })}
                />
            </div>

            <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Text Size</label>
                <input
                    className="sizeSlider"
                    type="range"
                    min={8}
                    max={96}
                    step={1}
                    value={selectedTextLabel.style.textSize}
                    onChange={(e) => updateSelectedTextLabelStyle({ textSize: Number(e.target.value) })}
                />
                <input
                    className="scaleInputCompact"
                    type="number"
                    min={8}
                    max={96}
                    step={1}
                    value={selectedTextLabel.style.textSize}
                    onChange={(e) => updateSelectedTextLabelStyle({ textSize: Number(e.target.value) })}
                />
            </div>

            <div className="controlRow controlRowWithNumeric">
                <label className="controlLabel">Rotation</label>
                <input
                    className="sizeSlider"
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={selectedTextLabel.style.rotationDeg ?? 0}
                    onChange={(e) => updateSelectedTextLabelStyle({ rotationDeg: Number(e.target.value) })}
                />
                <input
                    className="scaleInputCompact"
                    type="number"
                    min={-360}
                    max={360}
                    step={1}
                    value={selectedTextLabel.style.rotationDeg ?? 0}
                    onChange={(e) => updateSelectedTextLabelStyle({ rotationDeg: Number(e.target.value) })}
                />
            </div>

            <button className="deleteButton" onClick={deleteSelectedObject}>
                Delete
            </button>
        </div>
    );
}
