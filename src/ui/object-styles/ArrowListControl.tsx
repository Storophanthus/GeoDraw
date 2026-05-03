import * as React from "react";
import { Plus, Copy, Trash2 } from "lucide-react";
import { useClickAway } from "react-use";
import { type PathArrowMark, type SegmentArrowMark, type ArrowDirection, type ArrowTipStyle } from "../../scene/points";
import { ColorSwatchInput } from "../ColorField";

const ARROW_DIRECTION_OPTIONS: Array<{ value: ArrowDirection; label: string }> = [
    { value: "->", label: ">" },
    { value: "<-", label: "<" },
    { value: "<->", label: "< >" },
    { value: ">-<", label: "> <" },
];
const ARROW_TIP_OPTIONS: Array<{ value: ArrowTipStyle; label: string }> = [
    { value: "Stealth", label: "Stealth" },
    { value: "Latex", label: "Latex" },
    { value: "Triangle", label: "Triangle" },
    { value: "Dot", label: "Dot" },
    { value: "OpenDot", label: "Open Dot" },
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
};

export function ArrowListControl<T extends PathArrowMark>({
    arrows,
    onChange,
    strokeColor,
    createArrow,
}: ArrowListControlProps<T>) {
    const makeArrow = React.useCallback(() => {
        if (createArrow) return createArrow();
        return { ...DEFAULT_PATH_ARROW_MARK } as T;
    }, [createArrow]);
    const [selectedByIndex, setSelectedByIndex] = React.useState<number>(0);
    const [isTipPickerOpen, setIsTipPickerOpen] = React.useState(false);
    const tipPickerRef = React.useRef<HTMLDivElement>(null);
    useClickAway(tipPickerRef, () => setIsTipPickerOpen(false));

    const safeArrows = arrows ?? [];

    const actualIndex = Math.max(0, Math.min(selectedByIndex, safeArrows.length - 1));
    const selectedArrow = safeArrows[actualIndex] ?? makeArrow();
    const selectedPlacementMode = (selectedArrow as { mode?: SegmentArrowMark["mode"] }).mode;
    const hasPlacementMode = selectedPlacementMode === "mid" || selectedPlacementMode === "end";
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
                                                height: "36px",
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
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                padding: "0 4px",
                                            }}
                                        >
                                            <ArrowDirectionGlyph direction={direction.value} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="controlRow" style={{ gridTemplateColumns: "100px 1fr" }} ref={tipPickerRef}>
                                <label className="controlLabel">Tip Style</label>
                                <div style={{ position: "relative", width: "100%" }}>
                                    <button
                                        className="shapeButton arrowTipButton"
                                        onClick={() => setIsTipPickerOpen((v) => !v)}
                                        type="button"
                                        style={{ height: "46px", justifyContent: "center", padding: "0 4px" }}
                                    >
                                        <ArrowTipGlyph tip={selectedArrow.tip ?? "Stealth"} />
                                    </button>
                                    {isTipPickerOpen && (
                                        <div className="shapePopover" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: "4px" }}>
                                            {ARROW_TIP_OPTIONS.map((tip) => {
                                                const isActive = tip.value === (selectedArrow.tip ?? "Stealth");
                                                return (
                                                    <button
                                                        key={tip.value}
                                                        className={`shapeCell arrowTipCell ${isActive ? "active" : ""}`}
                                                        onClick={() => {
                                                            updateSelectedArrow({ tip: tip.value });
                                                            setIsTipPickerOpen(false);
                                                        }}
                                                        type="button"
                                                        title={tip.label}
                                                    >
                                                        <ArrowTipGlyph tip={tip.value} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {hasPlacementMode && (
                                <div className="controlRow" style={{ gridTemplateColumns: "74px minmax(0, 1fr)" }}>
                                    <label className="controlLabel">Placement</label>
                                    <div className="arrowIconToggleGrid">
                                        <ArrowIconToggleButton
                                            selected={selectedPlacementMode === "mid"}
                                            onClick={() => updateSelectedArrow({ mode: "mid" })}
                                            title="Middle"
                                        >
                                            <ArrowPlacementGlyph mode="mid" />
                                        </ArrowIconToggleButton>
                                        <ArrowIconToggleButton
                                            selected={selectedPlacementMode === "end"}
                                            onClick={() => updateSelectedArrow({ mode: "end", distribution: "single" })}
                                            title="Endpoint"
                                        >
                                            <ArrowPlacementGlyph mode="end" />
                                        </ArrowIconToggleButton>
                                    </div>
                                </div>
                            )}

                            {!isEndpointPlacement && (
                                <div className="controlRow" style={{ gridTemplateColumns: "74px minmax(0, 1fr)" }}>
                                    <label className="controlLabel">Distribution</label>
                                    <div className="arrowIconToggleGrid">
                                        <ArrowIconToggleButton
                                            selected={(selectedArrow.distribution ?? "single") === "single"}
                                            onClick={() => updateSelectedArrow({ distribution: "single" })}
                                            title="Single"
                                        >
                                            <ArrowDistributionGlyph distribution="single" />
                                        </ArrowIconToggleButton>
                                        <ArrowIconToggleButton
                                            selected={(selectedArrow.distribution ?? "single") === "multi"}
                                            onClick={() => updateSelectedArrow({ distribution: "multi" })}
                                            title="Multi"
                                        >
                                            <ArrowDistributionGlyph distribution="multi" />
                                        </ArrowIconToggleButton>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isEndpointPlacement ? null : selectedArrow.distribution === "multi" ? (
                            <div className="nestedGroup" style={{
                                background: "var(--gd-ui-surface-soft, #f8fafc)",
                                border: "1px solid var(--gd-ui-border-soft, #e2e8f0)",
                                borderRadius: "8px",
                                padding: "9px 10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px"
                            }}>
                                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "48px minmax(0, 1fr) 54px" }}>
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
                                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "48px minmax(0, 1fr) 54px" }}>
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
                                <div className="controlRow controlRowWithNumeric" style={{ marginTop: 0, gridTemplateColumns: "48px minmax(0, 1fr) 54px" }}>
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
                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "64px minmax(0, 1fr) 56px" }}>
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
                            padding: "9px 10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px"
                        }}>
                            <div className="controlRow" style={{ gridTemplateColumns: "74px minmax(0, 1fr)" }}>
                                <label className="controlLabel">Arrow Color</label>
                                <ColorSwatchInput
                                    value={selectedArrow.color ?? strokeColor}
                                    onChange={(e) => updateSelectedArrow({ color: e.target.value })}
                                    style={{ width: "64px", borderRadius: "8px", height: "30px" }}
                                />
                            </div>

                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "64px minmax(0, 1fr) 56px" }}>
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

                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "64px minmax(0, 1fr) 56px" }}>
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

                            <div className="controlRow controlRowWithNumeric" style={{ gridTemplateColumns: "64px minmax(0, 1fr) 56px" }}>
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

function ArrowTipGlyph({ tip }: { tip: ArrowTipStyle }) {
    const resolvedTip = tip ?? "Stealth";
    return (
        <svg className="arrowControlGlyph arrowTipGlyph" viewBox="0 0 80 48" aria-hidden="true">
            {resolvedTip === "Dot" ? (
                <circle cx="44" cy="24" r="9.5" fill="currentColor" />
            ) : resolvedTip === "OpenDot" ? (
                <circle cx="44" cy="24" r="9" fill="none" stroke="currentColor" strokeWidth="4.5" />
            ) : resolvedTip === "Latex" ? (
                <path d="M58 24 L24 9 M58 24 L24 39" fill="none" stroke="currentColor" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
            ) : resolvedTip === "Triangle" ? (
                <path d="M61 24 L22 7 L22 41 Z" fill="currentColor" />
            ) : (
                <path d="M62 24 L21 7 L36 24 L21 41 Z" fill="currentColor" />
            )}
        </svg>
    );
}

function ArrowDirectionGlyph({ direction }: { direction: ArrowDirection }) {
    const leftHead = <path d="M24 16 L58 4 L46 16 L58 28 Z" fill="currentColor" />;
    const rightHead = <path d="M88 16 L54 4 L66 16 L54 28 Z" fill="currentColor" />;
    return (
        <svg className="arrowControlGlyph" viewBox="0 0 112 32" aria-hidden="true">
            {(direction === "<-" || direction === "<->" || direction === ">-<") && leftHead}
            {(direction === "->" || direction === "<->" || direction === ">-<") && rightHead}
        </svg>
    );
}

function ArrowIconToggleButton({
    selected,
    onClick,
    title,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            className={`arrowIconToggleButton ${selected ? "active" : ""}`}
            onClick={onClick}
            title={title}
            aria-label={title}
        >
            {children}
        </button>
    );
}

function ArrowPlacementGlyph({ mode }: { mode: NonNullable<SegmentArrowMark["mode"]> }) {
    return (
        <svg className="arrowIconToggleSvg" viewBox="0 0 88 32" aria-hidden="true">
            <line x1="7" y1="16" x2="81" y2="16" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="7" cy="16" r="3.4" fill="currentColor" />
            <circle cx="81" cy="16" r="3.4" fill="currentColor" opacity={mode === "end" ? 0 : 1} />
            {mode === "mid" ? (
                <path d="M51 16 L35 7.5 L35 24.5 Z" fill="currentColor" />
            ) : (
                <path d="M84 16 L64 6.5 L64 25.5 Z" fill="currentColor" />
            )}
        </svg>
    );
}

function ArrowDistributionGlyph({ distribution }: { distribution: NonNullable<PathArrowMark["distribution"]> }) {
    const arrow = (cx: number) => <path key={cx} d={`M${cx + 8} 16 L${cx - 6} 8 L${cx - 6} 24 Z`} fill="currentColor" />;
    return (
        <svg className="arrowIconToggleSvg" viewBox="0 0 88 32" aria-hidden="true">
            <line x1="7" y1="16" x2="81" y2="16" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
            {distribution === "single" ? arrow(44) : [arrow(27), arrow(44), arrow(61)]}
        </svg>
    );
}
