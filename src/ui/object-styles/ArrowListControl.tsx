import * as React from "react";
import { Plus, Copy, Trash2 } from "lucide-react";
import { type PathArrowMark, type SegmentArrowMark, type ArrowDirection, type ArrowTipStyle } from "../../scene/points";

const ARROW_DIRECTION_OPTIONS: Array<{ value: ArrowDirection; label: string }> = [
    { value: "->", label: "─▶" },
    { value: "<-", label: "◀─" },
    { value: "<->", label: "◀─▶" },
    { value: ">-<", label: "▶─◀" },
];
const ARROW_TIP_OPTIONS: Array<{ value: ArrowTipStyle; label: string }> = [
    { value: "Stealth", label: "─➤" },
    { value: "Latex", label: "─❯" },
    { value: "Triangle", label: "─▶" },
];

export const DEFAULT_PATH_ARROW_UI = 1.0;
export const DEFAULT_PATH_ARROW_LINE_WIDTH_PT = 8.0;
export const DEFAULT_PATH_ARROW_MARK: PathArrowMark = {
    enabled: true,
    direction: "->",
    tip: "Stealth",
    distribution: "single",
    pos: 0.5,
    startPos: 0.45,
    endPos: 0.55,
    step: 0.05,
    sizeScale: DEFAULT_PATH_ARROW_UI,
    lineWidthPt: DEFAULT_PATH_ARROW_LINE_WIDTH_PT,
    arrowLength: 1.0,
};
export const DEFAULT_SEGMENT_ARROW_MARK: SegmentArrowMark = {
    ...DEFAULT_PATH_ARROW_MARK,
    mode: "end",
};

export const SEGMENT_ARROW_WIDTH_UI_FACTOR = 8;

export function isPairArrowDirection(direction: ArrowDirection | undefined): boolean {
    return direction === "<->" || direction === ">-<";
}

export function clampArrowWidthUi(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_PATH_ARROW_UI;
    return Math.max(0, Math.min(12, value));
}

export function parseArrowWidthUi(raw: string): number {
    return clampArrowWidthUi(Number(raw));
}

export type ArrowListControlProps<T extends PathArrowMark> = {
    arrows: T[] | undefined;
    onChange: (arrows: T[]) => void;
    strokeColor: string;
    createArrow?: () => T;
    renderPlacementControl?: (args: {
        selectedArrow: T;
        updateSelectedArrow: (updates: Record<string, unknown>) => void;
    }) => React.ReactNode;
};

export function ArrowListControl<T extends PathArrowMark>({
    arrows,
    onChange,
    strokeColor,
    createArrow,
    renderPlacementControl,
}: ArrowListControlProps<T>) {
    const makeArrow = React.useCallback(() => {
        if (createArrow) return createArrow();
        return { ...DEFAULT_PATH_ARROW_MARK } as T;
    }, [createArrow]);
    const [selectedByIndex, setSelectedByIndex] = React.useState<number>(0);
    const safeArrows = arrows ?? [];

    const actualIndex = Math.max(0, Math.min(selectedByIndex, safeArrows.length - 1));
    const selectedArrow = safeArrows[actualIndex] ?? makeArrow();
    const selectedPlacementMode = (selectedArrow as { mode?: SegmentArrowMark["mode"] }).mode;
    const isEndpointPlacement = selectedPlacementMode === "end";

    const updateSelectedArrow = (updates: Record<string, unknown>) => {
        const newArrows = [...safeArrows];
        if (newArrows.length === 0) return;
        newArrows[actualIndex] = { ...newArrows[actualIndex], ...(updates as Partial<T>) };
        onChange(newArrows);
    };

    const addArrow = () => {
        const newArrows = [...safeArrows, makeArrow()];
        onChange(newArrows);
        setSelectedByIndex(newArrows.length - 1);
    };

    const removeArrow = () => {
        if (safeArrows.length === 0) return;
        const newArrows = safeArrows.filter((_, i) => i !== actualIndex);
        onChange(newArrows);
        setSelectedByIndex(Math.max(0, actualIndex - 1));
    };

    const duplicateArrow = () => {
        if (safeArrows.length === 0) return;
        const arrowToCopy = safeArrows[actualIndex];
        const newArrows = [...safeArrows, { ...arrowToCopy }];
        onChange(newArrows);
        setSelectedByIndex(newArrows.length - 1);
    };

    return (
        <div className="arrowListControl" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="arrowListHeader" style={{ display: "grid", gridTemplateColumns: "max-content 1fr", alignItems: "center", gap: "8px" }}>
                <label className="controlLabel">Arrow List</label>
                <div className="arrowListButtons" style={{ display: "flex", gap: "6px" }}>
                    <select
                        className="selectInput"
                        value={safeArrows.length === 0 ? "" : actualIndex}
                        onChange={(e) => setSelectedByIndex(Number(e.target.value))}
                        disabled={safeArrows.length === 0}
                        style={{
                            height: "30px",
                            borderRadius: "6px",
                            borderColor: "var(--gd-ui-border, #cbd5e1)",
                            padding: "0 2px 0 6px",
                            flex: 1,
                            fontSize: "13px",
                            minWidth: "42px"
                        }}
                    >
                        {safeArrows.map((_, i) => (
                            <option key={i} value={i}>
                                {i + 1}
                            </option>
                        ))}
                    </select>

                    <div style={{ display: "flex", gap: "1px", background: "var(--gd-ui-border, #cbd5e1)", padding: "1px", borderRadius: "6px", overflow: "hidden" }}>
                        <button
                            className="iconButton"
                            onClick={addArrow}
                            title="Add arrow"
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
                                cursor: "pointer"
                            }}
                        >
                            <Plus size={15} color="var(--gd-ui-text, #334155)" />
                        </button>
                        <button
                            className="iconButton"
                            onClick={duplicateArrow}
                            title="Duplicate arrow"
                            disabled={safeArrows.length === 0}
                            style={{
                                height: "28px",
                                width: "30px",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "none",
                                background: "var(--gd-ui-surface, #fff)",
                                cursor: safeArrows.length === 0 ? "not-allowed" : "pointer",
                                opacity: safeArrows.length === 0 ? 0.6 : 1
                            }}
                        >
                            <Copy size={14} color="var(--gd-ui-text, #334155)" />
                        </button>
                        <button
                            className="iconButton"
                            onClick={removeArrow}
                            disabled={safeArrows.length === 0}
                            title={safeArrows.length === 0 ? "No arrows to remove" : "Remove arrow"}
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
                                cursor: safeArrows.length === 0 ? "not-allowed" : "pointer",
                                opacity: safeArrows.length === 0 ? 0.6 : 1
                            }}
                        >
                            <Trash2 size={14} color={safeArrows.length === 0 ? "var(--gd-ui-border-strong, #94a3b8)" : "var(--gd-ui-danger-text, #b91c1c)"} />
                        </button>
                    </div>
                </div>
            </div>

            {
                safeArrows.length > 0 && (
                    <div className="arrowDetail" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ paddingBottom: "8px", borderBottom: "1px solid var(--gd-ui-border-soft, #e2e8f0)", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gd-ui-text-subtle, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Editing Arrow {actualIndex + 1}
                            </span>
                        </div>

                        <div className="controlGroup">
                            <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                                <label className="controlLabel">Direction</label>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "4px",
                                    }}
                                >
                                    {ARROW_DIRECTION_OPTIONS.filter((opt) => !isPairArrowDirection(opt.value)).map((direction) => (
                                        <button
                                            key={direction.value}
                                            type="button"
                                            className="iconButton"
                                            onClick={() => updateSelectedArrow({ direction: direction.value })}
                                            style={{
                                                height: "32px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--gd-ui-border, #cbd5e1)",
                                                background:
                                                    selectedArrow.direction === direction.value
                                                        ? "var(--gd-ui-accent, #2563eb)"
                                                        : "var(--gd-ui-surface, #fff)",
                                                color:
                                                    selectedArrow.direction === direction.value
                                                        ? "var(--gd-ui-accent-contrast, #fff)"
                                                        : "var(--gd-ui-text, #334155)",
                                            }}
                                        >
                                            {direction.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                                <label className="controlLabel">Tip Style</label>
                                <select
                                    className="selectInput arrowIconSelect"
                                    value={selectedArrow.tip ?? "Stealth"}
                                    onChange={(e) => updateSelectedArrow({ tip: e.target.value as ArrowTipStyle })}
                                    style={{ height: "32px", borderRadius: "6px" }}
                                >
                                    {ARROW_TIP_OPTIONS.map((tip) => (
                                        <option key={tip.value} value={tip.value}>
                                            {tip.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {renderPlacementControl?.({ selectedArrow, updateSelectedArrow })}

                            {!isEndpointPlacement && (
                                <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                                    <label className="controlLabel">Distribution</label>
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
                                            onClick={() => updateSelectedArrow({ distribution: "single" })}
                                            style={{
                                                height: "32px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--gd-ui-border, #cbd5e1)",
                                                background:
                                                    (selectedArrow.distribution ?? "single") === "single"
                                                        ? "var(--gd-ui-accent, #2563eb)"
                                                        : "var(--gd-ui-surface, #fff)",
                                                color:
                                                    (selectedArrow.distribution ?? "single") === "single"
                                                        ? "var(--gd-ui-accent-contrast, #fff)"
                                                        : "var(--gd-ui-text, #334155)",
                                            }}
                                        >
                                            Single
                                        </button>
                                        <button
                                            type="button"
                                            className="iconButton"
                                            onClick={() => updateSelectedArrow({ distribution: "multi" })}
                                            style={{
                                                height: "32px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--gd-ui-border, #cbd5e1)",
                                                background:
                                                    (selectedArrow.distribution ?? "single") === "multi"
                                                        ? "var(--gd-ui-accent, #2563eb)"
                                                        : "var(--gd-ui-surface, #fff)",
                                                color:
                                                    (selectedArrow.distribution ?? "single") === "multi"
                                                        ? "var(--gd-ui-accent-contrast, #fff)"
                                                        : "var(--gd-ui-text, #334155)",
                                            }}
                                        >
                                            Multi
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isEndpointPlacement ? (
                            <div className="nestedGroup" style={{
                                background: "var(--gd-ui-surface-soft, #f8fafc)",
                                border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
                                borderRadius: "8px",
                                padding: "10px 12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px"
                            }}>
                                <span style={{ fontSize: "12px", color: "var(--gd-ui-text-subtle, #64748b)" }}>
                                    Endpoint placement anchors arrow tips to segment ends.
                                </span>
                            </div>
                        ) : selectedArrow.distribution === "multi" ? (
                            <div className="nestedGroup" style={{
                                background: "var(--gd-ui-surface-soft, #f8fafc)",
                                border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
                                borderRadius: "8px",
                                padding: "10px 12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px"
                            }}>
                                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "88px 1fr 68px" }}>
                                    <label className="controlLabel">Start</label>
                                    <input
                                        className="sizeSlider"
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedArrow.startPos ?? 0.45}
                                        onChange={(e) => updateSelectedArrow({ startPos: Number(e.target.value) })}
                                    />
                                    <input
                                        className="scaleInputCompact"
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedArrow.startPos ?? 0.45}
                                        onChange={(e) => updateSelectedArrow({ startPos: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "88px 1fr 68px" }}>
                                    <label className="controlLabel">End</label>
                                    <input
                                        className="sizeSlider"
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedArrow.endPos ?? 0.55}
                                        onChange={(e) => updateSelectedArrow({ endPos: Number(e.target.value) })}
                                    />
                                    <input
                                        className="scaleInputCompact"
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedArrow.endPos ?? 0.55}
                                        onChange={(e) => updateSelectedArrow({ endPos: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "88px 1fr 68px" }}>
                                    <label className="controlLabel">Step</label>
                                    <input
                                        className="sizeSlider"
                                        type="range"
                                        min={0.01}
                                        max={0.5}
                                        step={0.01}
                                        value={selectedArrow.step ?? 0.05}
                                        onChange={(e) => updateSelectedArrow({ step: Number(e.target.value) })}
                                    />
                                    <input
                                        className="scaleInputCompact"
                                        type="number"
                                        min={0.01}
                                        max={0.5}
                                        step={0.01}
                                        value={selectedArrow.step ?? 0.05}
                                        onChange={(e) => updateSelectedArrow({ step: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                                <label className="controlLabel">Arrow Pos</label>
                                <input
                                    className="sizeSlider"
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={selectedArrow.pos ?? 0.5}
                                    onChange={(e) => updateSelectedArrow({ pos: Number(e.target.value) })}
                                />
                                <input
                                    className="scaleInputCompact"
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={selectedArrow.pos ?? 0.5}
                                    onChange={(e) => updateSelectedArrow({ pos: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        <div className="controlGroup nestedGroup" style={{
                            background: "var(--gd-ui-surface-soft, #f8fafc)",
                            border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
                            borderRadius: "8px",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                        }}>
                            <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }}>
                                <label className="controlLabel">Arrow Color</label>
                                <input
                                    className="colorInput"
                                    type="color"
                                    value={selectedArrow.color ?? strokeColor}
                                    onChange={(e) => updateSelectedArrow({ color: e.target.value })}
                                    style={{ width: "100%", borderRadius: "6px", height: "32px" }}
                                />
                            </div>

                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                                <label className="controlLabel">Width</label>
                                <input
                                    className="sizeSlider"
                                    type="range"
                                    min={0.2}
                                    max={12}
                                    step={0.05}
                                    value={(selectedArrow.lineWidthPt ?? DEFAULT_PATH_ARROW_LINE_WIDTH_PT) / SEGMENT_ARROW_WIDTH_UI_FACTOR}
                                    onChange={(e) =>
                                        updateSelectedArrow({
                                            lineWidthPt: parseArrowWidthUi(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
                                        })
                                    }
                                />
                                <input
                                    className="scaleInputCompact"
                                    type="number"
                                    min={0}
                                    max={12}
                                    step={0.05}
                                    value={(selectedArrow.lineWidthPt ?? DEFAULT_PATH_ARROW_LINE_WIDTH_PT) / SEGMENT_ARROW_WIDTH_UI_FACTOR}
                                    onChange={(e) =>
                                        updateSelectedArrow({
                                            lineWidthPt: parseArrowWidthUi(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
                                        })
                                    }
                                />
                            </div>

                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                                <label className="controlLabel">Size</label>
                                <input
                                    className="sizeSlider"
                                    type="range"
                                    min={0.2}
                                    max={8}
                                    step={0.1}
                                    value={selectedArrow.sizeScale ?? DEFAULT_PATH_ARROW_UI}
                                    onChange={(e) => updateSelectedArrow({ sizeScale: Number(e.target.value) })}
                                />
                                <input
                                    className="scaleInputCompact"
                                    type="number"
                                    min={0.2}
                                    max={8}
                                    step={0.1}
                                    value={selectedArrow.sizeScale ?? DEFAULT_PATH_ARROW_UI}
                                    onChange={(e) => updateSelectedArrow({ sizeScale: Number(e.target.value) })}
                                />
                            </div>

                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "100px 1fr 70px" }}>
                                <label className="controlLabel">Length</label>
                                <input
                                    className="sizeSlider"
                                    type="range"
                                    min={0.2}
                                    max={4}
                                    step={0.1}
                                    value={selectedArrow.arrowLength ?? 1.0}
                                    onChange={(e) => updateSelectedArrow({ arrowLength: Number(e.target.value) })}
                                />
                                <input
                                    className="scaleInputCompact"
                                    type="number"
                                    min={0.2}
                                    max={4}
                                    step={0.1}
                                    value={selectedArrow.arrowLength ?? 1.0}
                                    onChange={(e) => updateSelectedArrow({ arrowLength: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
