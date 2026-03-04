import * as React from "react";
import { type LineStyle, type SceneSegment, type SegmentArrowMark, type SegmentMark } from "../../scene/points";
import { ArrowListControl, DEFAULT_SEGMENT_ARROW_MARK } from "./ArrowListControl";
import { DEFAULT_SEGMENT_MARK, SegmentMarkControl } from "./SegmentMarkControl";

type SegmentStyleSectionProps = {
    selectedSegment: SceneSegment;
    updateSelectedSegmentStyle: (style: Partial<LineStyle>) => void;
    updateSelectedSegmentFields: (fields: Partial<Pick<SceneSegment, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
};

export function SegmentStyleSection({
    selectedSegment,
    updateSelectedSegmentStyle,
    updateSelectedSegmentFields,
}: SegmentStyleSectionProps) {
    const resolvedSegmentMarks = React.useMemo(() => {
        const source =
            Array.isArray(selectedSegment.style.segmentMarks) && selectedSegment.style.segmentMarks.length > 0
                ? selectedSegment.style.segmentMarks
                : selectedSegment.style.segmentMark?.enabled
                    ? [selectedSegment.style.segmentMark]
                    : [];
        return source
            .map((mark) => ({
                ...DEFAULT_SEGMENT_MARK,
                ...mark,
            }));
    }, [selectedSegment]);

    const commitSegmentMarks = React.useCallback(
        (nextMarks: SegmentMark[]) => {
            const legacyFallback: SegmentMark = {
                ...DEFAULT_SEGMENT_MARK,
                enabled: false,
                color: selectedSegment.style.strokeColor,
            };
            const legacyPrimary = nextMarks[0] ?? legacyFallback;
            updateSelectedSegmentStyle({
                segmentMarks: nextMarks,
                segmentMark: legacyPrimary,
            });
        },
        [selectedSegment, updateSelectedSegmentStyle]
    );

    return (
        <div className="cosmeticsBlock">
            <div className="subSectionTitle">Segment Style</div>
            <label className="checkboxRow">
                <input
                    type="checkbox"
                    checked={Boolean(selectedSegment.showLabel)}
                    onChange={(e) => updateSelectedSegmentFields({ showLabel: e.target.checked })}
                />
                Show Label
            </label>
            {Boolean(selectedSegment.showLabel) && (
                <div className="controlRow">
                    <label className="controlLabel">Label Text</label>
                    <input
                        className="renameInput"
                        value={selectedSegment.labelText ?? ""}
                        onChange={(e) => updateSelectedSegmentFields({ labelText: e.target.value })}
                    />
                </div>
            )}
            <div className="controlRow">
                <label className="controlLabel">Stroke Color</label>
                <input
                    className="colorInput"
                    type="color"
                    value={selectedSegment.style.strokeColor}
                    onChange={(e) => updateSelectedSegmentStyle({ strokeColor: e.target.value })}
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
                    value={selectedSegment.style.strokeWidth}
                    onChange={(e) => updateSelectedSegmentStyle({ strokeWidth: Number(e.target.value) })}
                />
                <input
                    className="scaleInputCompact"
                    type="number"
                    min={0.5}
                    max={6}
                    step={0.1}
                    value={selectedSegment.style.strokeWidth}
                    onChange={(e) => updateSelectedSegmentStyle({ strokeWidth: Number(e.target.value) })}
                />
            </div>
            <div className="controlRow">
                <label className="controlLabel">Dash</label>
                <select
                    className="selectInput"
                    value={selectedSegment.style.dash}
                    onChange={(e) => updateSelectedSegmentStyle({ dash: e.target.value as "solid" | "dashed" | "dotted" })}
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
                    value={selectedSegment.style.opacity}
                    onChange={(e) => updateSelectedSegmentStyle({ opacity: Number(e.target.value) })}
                />
            </div>
            <div className="subSectionTitle" style={{ marginTop: 10 }}>Marking</div>
            <SegmentMarkControl
                resolvedSegmentMarks={resolvedSegmentMarks}
                commitSegmentMarks={commitSegmentMarks}
                strokeColor={selectedSegment.style.strokeColor}
                strokeWidth={selectedSegment.style.strokeWidth}
                selectedSegmentId={selectedSegment.id}
            />

            <div className="subSectionTitle" style={{ marginTop: 10 }}>
                Arrow Mark
            </div>
            <ArrowListControl<SegmentArrowMark>
                arrows={
                    selectedSegment.style.segmentArrowMarks ??
                    (selectedSegment.style.segmentArrowMark?.enabled
                        ? [
                            {
                                ...DEFAULT_SEGMENT_ARROW_MARK,
                                ...selectedSegment.style.segmentArrowMark,
                            },
                        ]
                        : [])
                }
                createArrow={() => ({ ...DEFAULT_SEGMENT_ARROW_MARK })}
                strokeColor={selectedSegment.style.strokeColor}
                onChange={(newArrows) => updateSelectedSegmentStyle({ segmentArrowMarks: newArrows })}
                renderPlacementControl={({ selectedArrow, updateSelectedArrow }) => (
                    <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                        <label className="controlLabel">Placement</label>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "4px",
                            }}
                        >
                            <button
                                type="button"
                                className="iconButton"
                                onClick={() => updateSelectedArrow({ mode: "mid" })}
                                style={{
                                    height: "32px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--gd-ui-border, #cbd5e1)",
                                    background:
                                        selectedArrow.mode === "mid"
                                            ? "var(--gd-ui-accent, #2563eb)"
                                            : "var(--gd-ui-surface, #fff)",
                                    color:
                                        selectedArrow.mode === "mid"
                                            ? "var(--gd-ui-accent-contrast, #fff)"
                                            : "var(--gd-ui-text, #334155)",
                                }}
                            >
                                Middle
                            </button>
                            <button
                                type="button"
                                className="iconButton"
                                onClick={() => updateSelectedArrow({ mode: "end", distribution: "single" })}
                                style={{
                                    height: "32px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--gd-ui-border, #cbd5e1)",
                                    background:
                                        selectedArrow.mode === "end"
                                            ? "var(--gd-ui-accent, #2563eb)"
                                            : "var(--gd-ui-surface, #fff)",
                                    color:
                                        selectedArrow.mode === "end"
                                            ? "var(--gd-ui-accent-contrast, #fff)"
                                            : "var(--gd-ui-text, #334155)",
                                }}
                            >
                                Endpoint
                            </button>
                        </div>
                    </div>
                )}
            />
        </div>
    );
}
