import * as React from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { type SegmentMark } from "../../scene/points";

export const SEGMENT_MARK_OPTIONS = ["none", "|", "||", "|||", "s", "s|", "s||", "x", "o", "oo", "z"] as const;

export const DEFAULT_SEGMENT_MARK: SegmentMark = {
    enabled: true,
    mark: "|",
    pos: 0.5,
    sizePt: 4,
    distribution: "single",
    startPos: 0.45,
    endPos: 0.55,
    step: 0.05,
};

type SegmentMarkControlProps = {
    resolvedSegmentMarks: SegmentMark[];
    commitSegmentMarks: (nextMarks: SegmentMark[]) => void;
    strokeColor: string;
    strokeWidth: number;
    selectedSegmentId: string;
};

export function SegmentMarkControl({
    resolvedSegmentMarks,
    commitSegmentMarks,
    strokeColor,
    strokeWidth,
    selectedSegmentId,
}: SegmentMarkControlProps) {
    const [selectedSegmentMarkIndex, setSelectedSegmentMarkIndex] = React.useState(0);

    React.useEffect(() => {
        setSelectedSegmentMarkIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, resolvedSegmentMarks.length - 1))));
    }, [resolvedSegmentMarks.length, selectedSegmentId]);

    const selectedSegmentMark = resolvedSegmentMarks[selectedSegmentMarkIndex] ?? null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="arrowListHeader" style={{ display: "grid", gridTemplateColumns: "max-content 1fr", alignItems: "center", gap: "8px" }}>
                <label className="controlLabel">Mark List</label>
                <div className="arrowListButtons" style={{ display: "flex", gap: "6px" }}>
                    <select
                        className="selectInput"
                        value={resolvedSegmentMarks.length === 0 ? "" : selectedSegmentMarkIndex}
                        onChange={(e) => setSelectedSegmentMarkIndex(Number(e.target.value))}
                        disabled={resolvedSegmentMarks.length === 0}
                        style={{
                            height: "30px",
                            borderRadius: "6px",
                            borderColor: "var(--gd-ui-border, #cbd5e1)",
                            padding: "0 2px 0 6px",
                            flex: 1,
                            fontSize: "13px",
                            minWidth: "42px",
                        }}
                    >
                        {resolvedSegmentMarks.map((_, i) => (
                            <option key={i} value={i}>
                                {i + 1}
                            </option>
                        ))}
                    </select>
                    <div style={{ display: "flex", gap: "1px", background: "var(--gd-ui-border, #cbd5e1)", padding: "1px", borderRadius: "6px", overflow: "hidden" }}>
                        <button
                            type="button"
                            className="iconButton"
                            title="Add mark"
                            onClick={() => {
                                const nextMarks = [
                                    ...resolvedSegmentMarks,
                                    { ...DEFAULT_SEGMENT_MARK, color: strokeColor },
                                ];
                                commitSegmentMarks(nextMarks);
                                setSelectedSegmentMarkIndex(nextMarks.length - 1);
                            }}
                            style={{
                                height: "28px",
                                width: "30px",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "none",
                                borderRadius: "4px 0 0 4px",
                                background: "var(--gd-ui-surface, #fff)",
                                cursor: "pointer",
                            }}
                        >
                            <Plus size={15} color="var(--gd-ui-text, #334155)" />
                        </button>
                        <button
                            type="button"
                            className="iconButton"
                            title="Duplicate mark"
                            disabled={!selectedSegmentMark}
                            onClick={() => {
                                if (!selectedSegmentMark) return;
                                const nextMarks = [...resolvedSegmentMarks, { ...selectedSegmentMark }];
                                commitSegmentMarks(nextMarks);
                                setSelectedSegmentMarkIndex(nextMarks.length - 1);
                            }}
                            style={{
                                height: "28px",
                                width: "30px",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "none",
                                background: "var(--gd-ui-surface, #fff)",
                                cursor: selectedSegmentMark ? "pointer" : "not-allowed",
                                opacity: selectedSegmentMark ? 1 : 0.6,
                            }}
                        >
                            <Copy size={14} color="var(--gd-ui-text, #334155)" />
                        </button>
                        <button
                            type="button"
                            className="iconButton"
                            title="Remove mark"
                            disabled={!selectedSegmentMark}
                            onClick={() => {
                                if (!selectedSegmentMark) return;
                                const nextMarks = resolvedSegmentMarks.filter((_, i) => i !== selectedSegmentMarkIndex);
                                commitSegmentMarks(nextMarks);
                                setSelectedSegmentMarkIndex(Math.max(0, selectedSegmentMarkIndex - 1));
                            }}
                            style={{
                                height: "28px",
                                width: "30px",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "none",
                                borderRadius: "0 4px 4px 0",
                                background: "var(--gd-ui-surface, #fff)",
                                cursor: selectedSegmentMark ? "pointer" : "not-allowed",
                                opacity: selectedSegmentMark ? 1 : 0.6,
                            }}
                        >
                            <Trash2 size={14} color="var(--gd-ui-danger-text, #b91c1c)" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedSegmentMark ? (
                <>
                    <div className="controlRow">
                        <label className="controlLabel">Mark Type</label>
                        <select
                            className="selectInput"
                            value={selectedSegmentMark.mark}
                            onChange={(e) => {
                                const nextMark = e.target.value as (typeof SEGMENT_MARK_OPTIONS)[number];
                                if (nextMark === "none") {
                                    const nextMarks = resolvedSegmentMarks.filter((_, i) => i !== selectedSegmentMarkIndex);
                                    commitSegmentMarks(nextMarks);
                                    setSelectedSegmentMarkIndex((prev) => Math.max(0, Math.min(prev, nextMarks.length - 1)));
                                    return;
                                }
                                const nextMarks = [...resolvedSegmentMarks];
                                nextMarks[selectedSegmentMarkIndex] = {
                                    ...selectedSegmentMark,
                                    enabled: true,
                                    mark: nextMark,
                                };
                                commitSegmentMarks(nextMarks);
                            }}
                        >
                            {SEGMENT_MARK_OPTIONS.map((mark: string) => (
                                <option key={mark} value={mark}>
                                    {mark}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="controlRow">
                        <label className="controlLabel">Distribution</label>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "4px",
                            }}
                        >
                            {(["single", "multi"] as const).map((distribution) => (
                                <button
                                    key={distribution}
                                    type="button"
                                    className="iconButton"
                                    onClick={() => {
                                        const nextMarks = [...resolvedSegmentMarks];
                                        nextMarks[selectedSegmentMarkIndex] = {
                                            ...selectedSegmentMark,
                                            distribution,
                                            startPos: selectedSegmentMark.startPos ?? 0.45,
                                            endPos: selectedSegmentMark.endPos ?? 0.55,
                                            step: selectedSegmentMark.step ?? 0.05,
                                        };
                                        commitSegmentMarks(nextMarks);
                                    }}
                                    style={{
                                        height: "32px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--gd-ui-border, #cbd5e1)",
                                        background:
                                            (selectedSegmentMark.distribution ?? "single") === distribution
                                                ? "var(--gd-ui-accent, #2563eb)"
                                                : "var(--gd-ui-surface, #fff)",
                                        color:
                                            (selectedSegmentMark.distribution ?? "single") === distribution
                                                ? "var(--gd-ui-accent-contrast, #fff)"
                                                : "var(--gd-ui-text, #334155)",
                                    }}
                                >
                                    {distribution === "single" ? "Single" : "Multi"}
                                </button>
                            ))}
                        </div>
                    </div>
                    {(selectedSegmentMark.distribution ?? "single") === "multi" ? (
                        <div className="nestedGroup" style={{
                            background: "var(--gd-ui-surface-soft, #f8fafc)",
                            border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
                            borderRadius: "8px",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px"
                        }}>
                            <div className="controlRow controlRowWithNumeric">
                                <label className="controlLabel">Start</label>
                                <input
                                    className="sizeSlider"
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={selectedSegmentMark.startPos ?? 0.45}
                                    onChange={(e) => {
                                        const nextMarks = [...resolvedSegmentMarks];
                                        nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, startPos: Number(e.target.value) };
                                        commitSegmentMarks(nextMarks);
                                    }}
                                />
                                <input
                                    className="scaleInputCompact"
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={selectedSegmentMark.startPos ?? 0.45}
                                    onChange={(e) => {
                                        const nextMarks = [...resolvedSegmentMarks];
                                        nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, startPos: Number(e.target.value) };
                                        commitSegmentMarks(nextMarks);
                                    }}
                                />
                            </div>
                            <div className="controlRow controlRowWithNumeric">
                                <label className="controlLabel">End</label>
                                <input
                                    className="sizeSlider"
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={selectedSegmentMark.endPos ?? 0.55}
                                    onChange={(e) => {
                                        const nextMarks = [...resolvedSegmentMarks];
                                        nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, endPos: Number(e.target.value) };
                                        commitSegmentMarks(nextMarks);
                                    }}
                                />
                                <input
                                    className="scaleInputCompact"
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={selectedSegmentMark.endPos ?? 0.55}
                                    onChange={(e) => {
                                        const nextMarks = [...resolvedSegmentMarks];
                                        nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, endPos: Number(e.target.value) };
                                        commitSegmentMarks(nextMarks);
                                    }}
                                />
                            </div>
                            <div className="controlRow controlRowWithNumeric">
                                <label className="controlLabel">Step</label>
                                <input
                                    className="sizeSlider"
                                    type="range"
                                    min={0.01}
                                    max={0.5}
                                    step={0.01}
                                    value={selectedSegmentMark.step ?? 0.05}
                                    onChange={(e) => {
                                        const nextMarks = [...resolvedSegmentMarks];
                                        nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, step: Number(e.target.value) };
                                        commitSegmentMarks(nextMarks);
                                    }}
                                />
                                <input
                                    className="scaleInputCompact"
                                    type="number"
                                    min={0.001}
                                    max={1}
                                    step={0.01}
                                    value={selectedSegmentMark.step ?? 0.05}
                                    onChange={(e) => {
                                        const nextMarks = [...resolvedSegmentMarks];
                                        nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, step: Number(e.target.value) };
                                        commitSegmentMarks(nextMarks);
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="controlRow">
                            <label className="controlLabel">Mark Pos</label>
                            <input
                                className="sizeSlider"
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={selectedSegmentMark.pos}
                                onChange={(e) => {
                                    const nextMarks = [...resolvedSegmentMarks];
                                    nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, pos: Number(e.target.value) };
                                    commitSegmentMarks(nextMarks);
                                }}
                            />
                        </div>
                    )}
                    <div className="controlRow controlRowWithNumeric">
                        <label className="controlLabel">Mark Size</label>
                        <input
                            className="sizeSlider"
                            type="range"
                            min={0}
                            max={24}
                            step={0.1}
                            value={selectedSegmentMark.sizePt}
                            onChange={(e) => {
                                const nextMarks = [...resolvedSegmentMarks];
                                nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, sizePt: Number(e.target.value) };
                                commitSegmentMarks(nextMarks);
                            }}
                        />
                        <input
                            className="scaleInputCompact"
                            type="number"
                            min={0}
                            max={24}
                            step={0.1}
                            value={selectedSegmentMark.sizePt}
                            onChange={(e) => {
                                const nextMarks = [...resolvedSegmentMarks];
                                nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, sizePt: Number(e.target.value) };
                                commitSegmentMarks(nextMarks);
                            }}
                        />
                    </div>
                    <div className="controlRow">
                        <label className="controlLabel">Mark Color</label>
                        <input
                            className="colorInput"
                            type="color"
                            value={selectedSegmentMark.color ?? strokeColor}
                            onChange={(e) => {
                                const nextMarks = [...resolvedSegmentMarks];
                                nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, color: e.target.value };
                                commitSegmentMarks(nextMarks);
                            }}
                        />
                    </div>
                    <div className="controlRow controlRowWithNumeric">
                        <label className="controlLabel">Mark Width</label>
                        <input
                            className="sizeSlider"
                            type="range"
                            min={0}
                            max={12}
                            step={0.1}
                            value={selectedSegmentMark.lineWidthPt ?? strokeWidth}
                            onChange={(e) => {
                                const nextMarks = [...resolvedSegmentMarks];
                                nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, lineWidthPt: Number(e.target.value) };
                                commitSegmentMarks(nextMarks);
                            }}
                        />
                        <input
                            className="scaleInputCompact"
                            type="number"
                            min={0}
                            max={12}
                            step={0.1}
                            value={selectedSegmentMark.lineWidthPt ?? strokeWidth}
                            onChange={(e) => {
                                const nextMarks = [...resolvedSegmentMarks];
                                nextMarks[selectedSegmentMarkIndex] = { ...selectedSegmentMark, lineWidthPt: Number(e.target.value) };
                                commitSegmentMarks(nextMarks);
                            }}
                        />
                    </div>
                </>
            ) : (
                <div className="controlRow">
                    <label className="controlLabel">Mark List</label>
                    <span style={{ color: "var(--gd-ui-muted-text, #64748b)", fontSize: "12px" }}>
                        Add a mark to start.
                    </span>
                </div>
            )}
        </div>
    );
}
