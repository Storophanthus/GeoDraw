import * as React from "react";
import { type LineStyle, type SceneSegment, type SegmentArrowMark, type SegmentMark } from "../../scene/points";
import { ColorSwatchInput } from "../ColorField";
import { StyleControlGroup } from "../StyleControlGroup";
import { StyleSectionHeader } from "../StyleSectionHeader";
import { ArrowListControl, DEFAULT_SEGMENT_ARROW_MARK } from "./ArrowListControl";
import { DEFAULT_SEGMENT_MARK, SegmentMarkControl } from "./SegmentMarkControl";

type SegmentStyleSectionProps = {
    selectedSegment: SceneSegment;
    selectedStyleAsDefault: boolean;
    onMakeStyleDefaultChange: (checked: boolean) => void;
    updateSelectedSegmentStyle: (style: Partial<LineStyle>) => void;
};

export function SegmentStyleSection({
    selectedSegment,
    selectedStyleAsDefault,
    onMakeStyleDefaultChange,
    updateSelectedSegmentStyle,
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
            <StyleSectionHeader
                title="Segment Style"
                selectedStyleAsDefault={selectedStyleAsDefault}
                onMakeStyleDefaultChange={onMakeStyleDefaultChange}
            />
            <StyleControlGroup title="Stroke">
                <div className="controlRow">
                    <label className="controlLabel">Stroke Color</label>
                    <ColorSwatchInput
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
            </StyleControlGroup>

            <StyleControlGroup title="Mark">
                <SegmentMarkControl
                    resolvedSegmentMarks={resolvedSegmentMarks}
                    commitSegmentMarks={commitSegmentMarks}
                    strokeColor={selectedSegment.style.strokeColor}
                    strokeWidth={selectedSegment.style.strokeWidth}
                    selectedSegmentId={selectedSegment.id}
                />
            </StyleControlGroup>

            <StyleControlGroup title="Arrow">
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
                />
            </StyleControlGroup>
        </div>
    );
}
