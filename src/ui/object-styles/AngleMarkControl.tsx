import * as React from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { type AngleMark } from "../../scene/points";
import { MarkSymbolPicker } from "./MarkSymbolPicker";

export const DEFAULT_ANGLE_MARK: AngleMark = {
    enabled: true,
    arcMultiplicity: 1,
    markSymbol: "none",
    markPos: 0.5,
    markSize: 7.4,
};

type AngleMarkControlProps = {
    resolvedAngleMarks: AngleMark[];
    commitAngleMarks: (nextMarks: AngleMark[]) => void;
    strokeColor: string;
    markColorFromStyle: string | undefined;
    selectedAngleId: string;
};

export function AngleMarkControl({
    resolvedAngleMarks,
    commitAngleMarks,
    strokeColor,
    markColorFromStyle,
    selectedAngleId,
}: AngleMarkControlProps) {
    const [selectedAngleMarkIndex, setSelectedAngleMarkIndex] = React.useState(0);

    React.useEffect(() => {
        setSelectedAngleMarkIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, resolvedAngleMarks.length - 1))));
    }, [resolvedAngleMarks.length, selectedAngleId]);

    const selectedAngleMark = resolvedAngleMarks[selectedAngleMarkIndex] ?? null;

    return (
        <div style={{ paddingLeft: "12px", borderLeft: "2px solid var(--gd-ui-border-soft, #e2e8f0)", marginTop: "4px" }}>
            <div
                className="arrowListHeader"
                style={{ display: "grid", gridTemplateColumns: "max-content 1fr", alignItems: "center", gap: "8px", marginTop: "6px" }}
            >
                <label className="controlLabel">Arc Marks</label>
                <div className="arrowListButtons" style={{ display: "flex", gap: "6px" }}>
                    <select
                        className="selectInput"
                        value={resolvedAngleMarks.length === 0 ? "" : selectedAngleMarkIndex}
                        onChange={(e) => setSelectedAngleMarkIndex(Number(e.target.value))}
                        disabled={resolvedAngleMarks.length === 0}
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
                        {resolvedAngleMarks.map((_, i) => (
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
                                    ...resolvedAngleMarks,
                                    { ...DEFAULT_ANGLE_MARK, markColor: markColorFromStyle },
                                ];
                                commitAngleMarks(nextMarks);
                                setSelectedAngleMarkIndex(nextMarks.length - 1);
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
                            disabled={!selectedAngleMark}
                            onClick={() => {
                                if (!selectedAngleMark) return;
                                const nextMarks = [...resolvedAngleMarks, { ...selectedAngleMark }];
                                commitAngleMarks(nextMarks);
                                setSelectedAngleMarkIndex(nextMarks.length - 1);
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
                                cursor: selectedAngleMark ? "pointer" : "not-allowed",
                                opacity: selectedAngleMark ? 1 : 0.6,
                            }}
                        >
                            <Copy size={14} color="var(--gd-ui-text, #334155)" />
                        </button>
                        <button
                            type="button"
                            className="iconButton"
                            title="Remove mark"
                            disabled={!selectedAngleMark}
                            onClick={() => {
                                if (!selectedAngleMark) return;
                                const nextMarks = resolvedAngleMarks.filter((_, i) => i !== selectedAngleMarkIndex);
                                commitAngleMarks(nextMarks);
                                setSelectedAngleMarkIndex(Math.max(0, selectedAngleMarkIndex - 1));
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
                                cursor: selectedAngleMark ? "pointer" : "not-allowed",
                                opacity: selectedAngleMark ? 1 : 0.6,
                            }}
                        >
                            <Trash2 size={14} color="var(--gd-ui-danger-text, #b91c1c)" />
                        </button>
                    </div>
                </div>
            </div>
            {selectedAngleMark ? (
                <>
                    <label className="checkboxRow">
                        <input
                            type="checkbox"
                            checked={selectedAngleMark.enabled}
                            onChange={(e) => {
                                const nextMarks = [...resolvedAngleMarks];
                                nextMarks[selectedAngleMarkIndex] = { ...selectedAngleMark, enabled: e.target.checked };
                                commitAngleMarks(nextMarks);
                            }}
                        />
                        Enable selected mark
                    </label>
                    <div className="controlRow">
                        <label className="controlLabel">Arc Count</label>
                        <select
                            className="selectInput"
                            value={selectedAngleMark.arcMultiplicity ?? 1}
                            onChange={(e) => {
                                const multiplicity = e.target.value === "3" ? 3 : e.target.value === "2" ? 2 : 1;
                                const nextMarks = [...resolvedAngleMarks];
                                nextMarks[selectedAngleMarkIndex] = { ...selectedAngleMark, arcMultiplicity: multiplicity };
                                commitAngleMarks(nextMarks);
                            }}
                        >
                            <option value="1">Single</option>
                            <option value="2">Double</option>
                            <option value="3">Triple</option>
                        </select>
                    </div>
                    <div className="controlRow">
                        <label className="controlLabel">Bar Symbol</label>
                        <MarkSymbolPicker
                            value={(selectedAngleMark.markSymbol ?? "none") as "none" | "|" | "||" | "|||"}
                            onChange={(markSymbol) => {
                                const nextMarks = [...resolvedAngleMarks];
                                nextMarks[selectedAngleMarkIndex] = {
                                    ...selectedAngleMark,
                                    markSymbol,
                                };
                                commitAngleMarks(nextMarks);
                            }}
                        />
                    </div>
                    <div className="controlRow">
                        <label className="controlLabel">Mark Position</label>
                        <input
                            className="sizeSlider"
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={selectedAngleMark.markPos ?? 0.5}
                            onChange={(e) => {
                                const nextMarks = [...resolvedAngleMarks];
                                nextMarks[selectedAngleMarkIndex] = { ...selectedAngleMark, markPos: Number(e.target.value) };
                                commitAngleMarks(nextMarks);
                            }}
                        />
                    </div>
                    <div className="controlRow controlRowWithNumeric">
                        <label className="controlLabel">Mark Size</label>
                        <input
                            className="sizeSlider"
                            type="range"
                            min={1}
                            max={20}
                            step={0.1}
                            value={selectedAngleMark.markSize ?? 7.4}
                            onChange={(e) => {
                                const nextMarks = [...resolvedAngleMarks];
                                nextMarks[selectedAngleMarkIndex] = { ...selectedAngleMark, markSize: Number(e.target.value) };
                                commitAngleMarks(nextMarks);
                            }}
                        />
                        <input
                            className="scaleInputCompact"
                            type="number"
                            min={1}
                            max={20}
                            step={0.1}
                            value={selectedAngleMark.markSize ?? 7.4}
                            onChange={(e) => {
                                const nextMarks = [...resolvedAngleMarks];
                                nextMarks[selectedAngleMarkIndex] = { ...selectedAngleMark, markSize: Number(e.target.value) };
                                commitAngleMarks(nextMarks);
                            }}
                        />
                    </div>
                    <div className="controlRow">
                        <label className="controlLabel">Mark Color</label>
                        <input
                            className="colorInput"
                            type="color"
                            value={selectedAngleMark.markColor ?? markColorFromStyle ?? strokeColor}
                            onChange={(e) => {
                                const nextMarks = [...resolvedAngleMarks];
                                nextMarks[selectedAngleMarkIndex] = { ...selectedAngleMark, markColor: e.target.value };
                                commitAngleMarks(nextMarks);
                            }}
                        />
                    </div>
                </>
            ) : (
                <div className="controlRow">
                    <label className="controlLabel">Arc Marks</label>
                    <span style={{ color: "var(--gd-ui-muted-text, #64748b)", fontSize: "12px" }}>
                        Add a mark to start.
                    </span>
                </div>
            )}
        </div>
    );
}
