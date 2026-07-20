import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useGeoStore } from "../../state/geoStore";
import { persistCurrentConstructionPreferences } from "../../state/constructionPreferencesSync";
import {
    COLOR_PROFILE_OPTIONS,
    buildDefaultStylesForProfile,
    getCanvasColorTheme,
    type CanvasColorTheme,
} from "../../state/colorProfiles";
import type {
    AngleStyle,
    CircleStyle,
    LineStyle,
    PointStyle,
    PolygonStyle,
    SceneRichTextStyle,
    SceneTextLabelStyle,
} from "../../scene/points";
import { EXPORT_FRIENDLY_COLOR_PRESETS, colorToHex, resolveExportFriendlyColorName } from "../../exportFriendlyColors";
import { ColorSwatchInput } from "../ColorField";
import { parseNonNegativeNumber, parsePositiveNumber } from "./utils";

const CANVAS_THEME_KEYS: Array<{ key: keyof CanvasColorTheme; label: string }> = [
    { key: "backgroundColor", label: "Canvas background" },
    { key: "gridMinorColor", label: "Minor grid lines" },
    { key: "gridMajorColor", label: "Major grid lines" },
    { key: "axisColor", label: "Axes" },
];

type ConstructionCategory = "canvas" | "points" | "lines" | "shapes" | "angles" | "text";

const CONSTRUCTION_CATEGORIES: Array<{ id: ConstructionCategory; label: string; description: string }> = [
    { id: "canvas", label: "Canvas", description: "Paper, grid, and axes" },
    { id: "points", label: "Points", description: "Point dots and labels" },
    { id: "lines", label: "Lines", description: "Segments and infinite lines" },
    { id: "shapes", label: "Shapes", description: "Circles and polygons" },
    { id: "angles", label: "Angles", description: "Angle arcs, fills, marks, and values" },
    { id: "text", label: "Text", description: "Labels and textboxes" },
];

const PRESET_LABEL_BY_HEX = new Map(
    EXPORT_FRIENDLY_COLOR_PRESETS.map((preset) => [preset.hex.toLowerCase(), preset.label])
);

function clampPreviewZoom(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(2.4, value));
}

function friendlyColorName(raw: string): string {
    const hex = colorToHex(raw);
    if (!hex) return raw.trim() || "No color";
    const presetLabel = PRESET_LABEL_BY_HEX.get(hex.toLowerCase());
    if (presetLabel) return presetLabel;
    const exportName = resolveExportFriendlyColorName(raw);
    if (exportName) return exportName.replace(/([a-z])([A-Z])/g, "$1 $2");
    return "Custom color";
}

function exactColorValue(raw: string): string {
    return colorToHex(raw)?.toUpperCase() ?? raw.trim();
}

function svgColor(raw: string | undefined, fallback: string): string {
    const trimmed = raw?.trim();
    if (!trimmed) return fallback;
    return trimmed;
}

type PreferenceColorControlProps = {
    label: string;
    value: string;
    onChange: (nextValue: string) => void;
    resetValue?: string;
    onReset?: () => void;
};

function PreferenceColorControl({ label, value, onChange, resetValue, onReset }: PreferenceColorControlProps) {
    const normalizedValue = value.trim();
    const normalizedReset = resetValue?.trim();
    const canReset = Boolean(onReset && normalizedReset && normalizedValue !== normalizedReset);

    return (
        <div className="constructionPreferenceControl">
            <div className="constructionPreferenceControlText">
                <div className="constructionPreferenceControlLabel">{label}</div>
                <div className="constructionPreferenceColorName">{friendlyColorName(value)}</div>
            </div>
            <div className="constructionPreferenceColorControl">
                <ColorSwatchInput
                    variant="token"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={`${label} color`}
                />
                <span className="constructionPreferenceExactColor" title={exactColorValue(value)}>
                    {exactColorValue(value)}
                </span>
                {onReset && (
                    <button
                        type="button"
                        className="preferencesTokenReset"
                        onClick={onReset}
                        disabled={!canReset}
                        aria-label={`Reset ${label}`}
                    >
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
}

type PreferenceNumberControlProps = {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step: number;
    onChange: (nextValue: number) => void;
    parse?: (raw: string) => number | null;
};

function PreferenceNumberControl({
    label,
    value,
    min,
    max,
    step,
    onChange,
    parse = parseNonNegativeNumber,
}: PreferenceNumberControlProps) {
    return (
        <div className="constructionPreferenceControl">
            <div className="constructionPreferenceControlText">
                <div className="constructionPreferenceControlLabel">{label}</div>
            </div>
            <input
                className="preferencesTokenInput constructionPreferenceNumberInput"
                type="number"
                step={step}
                min={min}
                max={max}
                value={value}
                onChange={(event) => {
                    const nextValue = parse(event.target.value);
                    if (nextValue === null) return;
                    onChange(max === undefined ? nextValue : Math.min(max, nextValue));
                }}
                aria-label={label}
            />
        </div>
    );
}

function PreferenceCheckboxControl({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="constructionPreferenceCheckbox">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
            <span>{label}</span>
        </label>
    );
}

function PreferenceSelectControl({
    label,
    value,
    onChange,
    children,
}: {
    label: string;
    value: string;
    onChange: (nextValue: string) => void;
    children: ReactNode;
}) {
    return (
        <div className="constructionPreferenceControl">
            <div className="constructionPreferenceControlText">
                <div className="constructionPreferenceControlLabel">{label}</div>
            </div>
            <select
                className="preferencesTokenInput"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-label={label}
            >
                {children}
            </select>
        </div>
    );
}

export function ConstructionSettings() {
    const applyAppPreferencesAction = useGeoStore((state) => state.applyAppPreferences);
    const colorProfileId = useGeoStore((state) => state.colorProfileId);
    const canvasThemeOverrides = useGeoStore((state) => state.canvasThemeOverrides);
    const pointDefaults = useGeoStore((state) => state.pointDefaults);
    const segmentDefaults = useGeoStore((state) => state.segmentDefaults);
    const lineDefaults = useGeoStore((state) => state.lineDefaults);
    const circleDefaults = useGeoStore((state) => state.circleDefaults);
    const ellipseDefaults = useGeoStore((state) => state.ellipseDefaults);
    const polygonDefaults = useGeoStore((state) => state.polygonDefaults);
    const angleDefaults = useGeoStore((state) => state.angleDefaults);
    const labelToolDefaults = useGeoStore((state) => state.labelToolDefaults);
    const textboxToolDefaults = useGeoStore((state) => state.textboxToolDefaults);
    const richTextToolDefaults = useGeoStore((state) => state.richTextToolDefaults);
    const setColorProfileAction = useGeoStore((state) => state.setColorProfile);
    const [category, setCategory] = useState<ConstructionCategory>("canvas");

    // Edits made in this dialog become the preferred defaults for new tabs and
    // the next app start, so persist them right after applying to the store.
    const applyAppPreferences = (next: Parameters<typeof applyAppPreferencesAction>[0]) => {
        applyAppPreferencesAction(next);
        persistCurrentConstructionPreferences();
    };
    const setColorProfile = (profileId: Parameters<typeof setColorProfileAction>[0]) => {
        setColorProfileAction(profileId);
        persistCurrentConstructionPreferences();
    };

    const canvasTheme = useMemo(
        () => getCanvasColorTheme(colorProfileId, canvasThemeOverrides),
        [colorProfileId, canvasThemeOverrides]
    );
    const defaultStyles = useMemo(() => buildDefaultStylesForProfile(colorProfileId), [colorProfileId]);
    const canvasOverrideCount = useMemo(() => Object.keys(canvasThemeOverrides).length, [canvasThemeOverrides]);
    const activeCategory = CONSTRUCTION_CATEGORIES.find((item) => item.id === category) ?? CONSTRUCTION_CATEGORIES[0];

    const setCanvasThemeValue = (key: keyof CanvasColorTheme, value: string) => {
        const nextOverrides = { ...canvasThemeOverrides };
        const normalized = value.trim();
        const baseValue = getCanvasColorTheme(colorProfileId)[key];
        if (!normalized || normalized === baseValue) {
            delete nextOverrides[key];
        } else {
            nextOverrides[key] = normalized;
        }
        applyAppPreferences({ canvasThemeOverrides: nextOverrides });
    };

    const resetCanvasThemeOverrides = () => {
        if (canvasOverrideCount === 0) return;
        applyAppPreferences({ canvasThemeOverrides: {} });
    };

    const resetActiveCategory = () => {
        if (category === "canvas") {
            resetCanvasThemeOverrides();
            return;
        }
        if (category === "points") {
            applyAppPreferences({ pointDefaults: defaultStyles.pointDefaults });
            return;
        }
        if (category === "lines") {
            applyAppPreferences({
                segmentDefaults: defaultStyles.segmentDefaults,
                lineDefaults: defaultStyles.lineDefaults,
            });
            return;
        }
        if (category === "shapes") {
            applyAppPreferences({
                circleDefaults: defaultStyles.circleDefaults,
                ellipseDefaults: defaultStyles.ellipseDefaults,
                polygonDefaults: defaultStyles.polygonDefaults,
            });
            return;
        }
        if (category === "angles") {
            applyAppPreferences({ angleDefaults: defaultStyles.angleDefaults });
            return;
        }
        applyAppPreferences({
            labelToolDefaults: defaultStyles.labelToolDefaults,
            textboxToolDefaults: defaultStyles.textboxToolDefaults,
            richTextToolDefaults: defaultStyles.richTextToolDefaults,
        });
    };

    const setPointDefault = (next: Partial<typeof pointDefaults>) => {
        applyAppPreferences({
            pointDefaults: {
                ...pointDefaults,
                ...next,
                labelOffsetPx: next.labelOffsetPx !== undefined ? { ...next.labelOffsetPx } : { ...pointDefaults.labelOffsetPx },
            },
        });
    };
    const setSegmentDefault = (next: Partial<typeof segmentDefaults>) => {
        applyAppPreferences({ segmentDefaults: { ...segmentDefaults, ...next } });
    };
    const setLineDefault = (next: Partial<typeof lineDefaults>) => {
        applyAppPreferences({ lineDefaults: { ...lineDefaults, ...next } });
    };
    const setCircleDefault = (next: Partial<typeof circleDefaults>) => {
        applyAppPreferences({ circleDefaults: { ...circleDefaults, ...next } });
    };
    const setEllipseDefault = (next: Partial<typeof ellipseDefaults>) => {
        applyAppPreferences({ ellipseDefaults: { ...ellipseDefaults, ...next } });
    };
    const setPolygonDefault = (next: Partial<typeof polygonDefaults>) => {
        applyAppPreferences({ polygonDefaults: { ...polygonDefaults, ...next } });
    };
    const setAngleDefault = (next: Partial<typeof angleDefaults>) => {
        applyAppPreferences({
            angleDefaults: {
                ...angleDefaults,
                ...next,
                labelPosWorld: next.labelPosWorld !== undefined ? { ...next.labelPosWorld } : { ...angleDefaults.labelPosWorld },
            },
        });
    };
    const setLabelToolDefault = (next: Partial<typeof labelToolDefaults>) => {
        applyAppPreferences({ labelToolDefaults: { ...labelToolDefaults, ...next } });
    };
    const setTextboxToolDefault = (next: Partial<typeof textboxToolDefaults>) => {
        applyAppPreferences({ textboxToolDefaults: { ...textboxToolDefaults, ...next } });
    };
    const setRichTextToolDefault = (next: Partial<typeof richTextToolDefaults>) => {
        applyAppPreferences({ richTextToolDefaults: { ...richTextToolDefaults, ...next } });
    };

    const renderControls = () => {
        if (category === "canvas") {
            return (
                <>
                    <PreferenceSelectControl
                        label="Construction palette"
                        value={colorProfileId}
                        onChange={(nextValue) => setColorProfile(nextValue as (typeof COLOR_PROFILE_OPTIONS)[number]["id"])}
                    >
                        {COLOR_PROFILE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </PreferenceSelectControl>
                    <div className="constructionPreferenceStatus">
                        {canvasOverrideCount === 0
                            ? "Canvas uses the active palette."
                            : `${canvasOverrideCount} canvas color${canvasOverrideCount === 1 ? "" : "s"} customized.`}
                    </div>
                    {CANVAS_THEME_KEYS.map(({ key, label }) => {
                        const baseValue = getCanvasColorTheme(colorProfileId)[key];
                        return (
                            <PreferenceColorControl
                                key={key}
                                label={label}
                                value={canvasTheme[key]}
                                resetValue={baseValue}
                                onChange={(nextValue) => setCanvasThemeValue(key, nextValue)}
                                onReset={() => setCanvasThemeValue(key, baseValue)}
                            />
                        );
                    })}
                </>
            );
        }

        if (category === "points") {
            return (
                <>
                    <PreferenceNumberControl label="Point size" value={pointDefaults.sizePx} min={0.1} step={0.1} parse={parsePositiveNumber} onChange={(nextValue) => setPointDefault({ sizePx: nextValue })} />
                    <PreferenceNumberControl label="Point outline width" value={pointDefaults.strokeWidth} min={0} step={0.1} onChange={(nextValue) => setPointDefault({ strokeWidth: nextValue })} />
                    <PreferenceColorControl label="Point fill" value={pointDefaults.fillColor} onChange={(nextValue) => setPointDefault({ fillColor: nextValue })} />
                    <PreferenceColorControl label="Point outline" value={pointDefaults.strokeColor} onChange={(nextValue) => setPointDefault({ strokeColor: nextValue })} />
                    <PreferenceColorControl label="Point label text" value={pointDefaults.labelColor} onChange={(nextValue) => setPointDefault({ labelColor: nextValue })} />
                    <PreferenceColorControl label="Point label glow" value={pointDefaults.labelHaloColor} onChange={(nextValue) => setPointDefault({ labelHaloColor: nextValue })} />
                </>
            );
        }

        if (category === "lines") {
            return (
                <>
                    <PreferenceNumberControl label="Segment width" value={segmentDefaults.strokeWidth} min={0} step={0.1} onChange={(nextValue) => setSegmentDefault({ strokeWidth: nextValue })} />
                    <PreferenceColorControl label="Segment color" value={segmentDefaults.strokeColor} onChange={(nextValue) => setSegmentDefault({ strokeColor: nextValue })} />
                    <PreferenceNumberControl label="Line width" value={lineDefaults.strokeWidth} min={0} step={0.1} onChange={(nextValue) => setLineDefault({ strokeWidth: nextValue })} />
                    <PreferenceColorControl label="Line color" value={lineDefaults.strokeColor} onChange={(nextValue) => setLineDefault({ strokeColor: nextValue })} />
                </>
            );
        }

        if (category === "shapes") {
            return (
                <>
                    <PreferenceNumberControl label="Circle outline width" value={circleDefaults.strokeWidth} min={0} step={0.1} onChange={(nextValue) => setCircleDefault({ strokeWidth: nextValue })} />
                    <PreferenceColorControl label="Circle outline" value={circleDefaults.strokeColor} onChange={(nextValue) => setCircleDefault({ strokeColor: nextValue })} />
                    <PreferenceColorControl label="Circle fill" value={circleDefaults.fillColor ?? "#ffffff"} onChange={(nextValue) => setCircleDefault({ fillColor: nextValue })} />
                    <PreferenceNumberControl label="Circle fill opacity" value={circleDefaults.fillOpacity ?? 0} min={0} max={1} step={0.05} onChange={(nextValue) => setCircleDefault({ fillOpacity: nextValue })} />
                    <PreferenceNumberControl label="Ellipse outline width" value={ellipseDefaults.strokeWidth} min={0} step={0.1} onChange={(nextValue) => setEllipseDefault({ strokeWidth: nextValue })} />
                    <PreferenceColorControl label="Ellipse outline" value={ellipseDefaults.strokeColor} onChange={(nextValue) => setEllipseDefault({ strokeColor: nextValue })} />
                    <PreferenceColorControl label="Ellipse fill" value={ellipseDefaults.fillColor ?? "#ffffff"} onChange={(nextValue) => setEllipseDefault({ fillColor: nextValue })} />
                    <PreferenceNumberControl label="Ellipse fill opacity" value={ellipseDefaults.fillOpacity ?? 0} min={0} max={1} step={0.05} onChange={(nextValue) => setEllipseDefault({ fillOpacity: nextValue })} />
                    <PreferenceNumberControl label="Polygon edge width" value={polygonDefaults.strokeWidth} min={0} step={0.1} onChange={(nextValue) => setPolygonDefault({ strokeWidth: nextValue })} />
                    <PreferenceColorControl label="Polygon edge" value={polygonDefaults.strokeColor} onChange={(nextValue) => setPolygonDefault({ strokeColor: nextValue })} />
                    <PreferenceColorControl label="Polygon fill" value={polygonDefaults.fillColor ?? "#ffffff"} onChange={(nextValue) => setPolygonDefault({ fillColor: nextValue })} />
                    <PreferenceNumberControl label="Polygon fill opacity" value={polygonDefaults.fillOpacity ?? 0} min={0} max={1} step={0.05} onChange={(nextValue) => setPolygonDefault({ fillOpacity: nextValue })} />
                </>
            );
        }

        if (category === "angles") {
            return (
                <>
                    <PreferenceNumberControl label="Arc radius" value={angleDefaults.arcRadius} min={0.2} step={0.05} parse={parsePositiveNumber} onChange={(nextValue) => setAngleDefault({ arcRadius: nextValue })} />
                    <PreferenceNumberControl label="Arc width" value={angleDefaults.strokeWidth} min={0} step={0.1} onChange={(nextValue) => setAngleDefault({ strokeWidth: nextValue })} />
                    <PreferenceColorControl label="Arc color" value={angleDefaults.strokeColor} onChange={(nextValue) => setAngleDefault({ strokeColor: nextValue })} />
                    <PreferenceColorControl label="Value text" value={angleDefaults.textColor} onChange={(nextValue) => setAngleDefault({ textColor: nextValue })} />
                    <PreferenceCheckboxControl label="Fill angles by default" checked={Boolean(angleDefaults.fillEnabled)} onChange={(checked) => setAngleDefault({ fillEnabled: checked })} />
                    <PreferenceColorControl label="Angle fill" value={angleDefaults.fillColor} onChange={(nextValue) => setAngleDefault({ fillColor: nextValue })} />
                    <PreferenceColorControl label="Angle mark" value={angleDefaults.markColor} onChange={(nextValue) => setAngleDefault({ markColor: nextValue })} />
                </>
            );
        }

        return (
            <>
                <PreferenceColorControl label="Label tool text" value={labelToolDefaults.textColor} onChange={(nextValue) => setLabelToolDefault({ textColor: nextValue })} />
                <PreferenceNumberControl label="Label tool size" value={labelToolDefaults.textSize} min={1} step={1} parse={parsePositiveNumber} onChange={(nextValue) => setLabelToolDefault({ textSize: nextValue })} />
                <PreferenceColorControl label="Textbox text" value={textboxToolDefaults.textColor} onChange={(nextValue) => setTextboxToolDefault({ textColor: nextValue })} />
                <PreferenceNumberControl label="Textbox size" value={textboxToolDefaults.textSize} min={1} step={1} parse={parsePositiveNumber} onChange={(nextValue) => setTextboxToolDefault({ textSize: nextValue })} />
                <PreferenceColorControl label="Rich textbox text" value={richTextToolDefaults.textColor} onChange={(nextValue) => setRichTextToolDefault({ textColor: nextValue })} />
                <PreferenceNumberControl label="Rich textbox size" value={richTextToolDefaults.textSize} min={1} step={1} parse={parsePositiveNumber} onChange={(nextValue) => setRichTextToolDefault({ textSize: nextValue })} />
            </>
        );
    };

    return (
        <>
            <div className="preferencesSectionTitle">Construction Defaults</div>
            <div className="preferencesHint">
                Pick a category, then change the controls while watching the preview.
            </div>
            <div className="constructionPreferenceLayout">
                <div className="constructionPreferenceCategoryList" role="tablist" aria-label="Construction preference categories">
                    {CONSTRUCTION_CATEGORIES.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={category === item.id}
                            className={category === item.id ? "constructionPreferenceCategory active" : "constructionPreferenceCategory"}
                            onClick={() => setCategory(item.id)}
                        >
                            <span>{item.label}</span>
                            <small>{item.description}</small>
                        </button>
                    ))}
                </div>
                <div className="constructionPreferenceEditor">
                    <div className="constructionPreferenceControls">
                        <div className="constructionPreferencePaneHeader">
                            <div className="constructionPreferencePaneTitle">{activeCategory.label}</div>
                            <button
                                type="button"
                                className="preferencesResetButton"
                                disabled={category === "canvas" && canvasOverrideCount === 0}
                                onClick={resetActiveCategory}
                            >
                                Reset to default
                            </button>
                        </div>
                        {renderControls()}
                    </div>
                    <ConstructionPreferencePreview
                        category={category}
                        canvasTheme={canvasTheme}
                        pointDefaults={pointDefaults}
                        segmentDefaults={segmentDefaults}
                        lineDefaults={lineDefaults}
                        circleDefaults={circleDefaults}
                        ellipseDefaults={ellipseDefaults}
                        polygonDefaults={polygonDefaults}
                        angleDefaults={angleDefaults}
                        labelToolDefaults={labelToolDefaults}
                        textboxToolDefaults={textboxToolDefaults}
                        richTextToolDefaults={richTextToolDefaults}
                    />
                </div>
            </div>
        </>
    );
}

type ConstructionPreferencePreviewProps = {
    category: ConstructionCategory;
    canvasTheme: CanvasColorTheme;
    pointDefaults: PointStyle;
    segmentDefaults: LineStyle;
    lineDefaults: LineStyle;
    circleDefaults: CircleStyle;
    ellipseDefaults: CircleStyle;
    polygonDefaults: PolygonStyle;
    angleDefaults: AngleStyle;
    labelToolDefaults: SceneTextLabelStyle;
    textboxToolDefaults: SceneTextLabelStyle;
    richTextToolDefaults: SceneRichTextStyle;
};

function ConstructionPreferencePreview({
    category,
    canvasTheme,
    pointDefaults,
    segmentDefaults,
    lineDefaults,
    circleDefaults,
    ellipseDefaults,
    polygonDefaults,
    angleDefaults,
    labelToolDefaults,
    textboxToolDefaults,
    richTextToolDefaults,
}: ConstructionPreferencePreviewProps) {
    const title = CONSTRUCTION_CATEGORIES.find((item) => item.id === category)?.label ?? "Preview";
    const defaultZoom = category === "canvas" ? 1 : 1.3;
    const [zoom, setZoom] = useState(defaultZoom);
    const viewWidth = 280 / zoom;
    const viewHeight = 180 / zoom;
    const viewBox = `${140 - viewWidth / 2} ${90 - viewHeight / 2} ${viewWidth} ${viewHeight}`;

    useEffect(() => {
        setZoom(defaultZoom);
    }, [defaultZoom]);

    const nudgeZoom = (factor: number) => {
        setZoom((current) => clampPreviewZoom(current * factor));
    };

    return (
        <aside className="constructionPreviewPanel" aria-label={`${title} preview`}>
            <div className="constructionPreviewToolbar">
                <div className="constructionPreviewTitle">Preview</div>
                <div className="constructionPreviewZoomControls" aria-label="Preview zoom controls">
                    <button type="button" onClick={() => nudgeZoom(0.88)} aria-label="Zoom out preview">-</button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button type="button" onClick={() => nudgeZoom(1.12)} aria-label="Zoom in preview">+</button>
                </div>
            </div>
            <svg
                className="constructionPreviewSvg"
                viewBox={viewBox}
                role="img"
                aria-label={`${title} style preview`}
                onWheel={(event) => {
                    event.preventDefault();
                    nudgeZoom(event.deltaY < 0 ? 1.12 : 0.88);
                }}
            >
                <rect width="280" height="180" fill={svgColor(canvasTheme.backgroundColor, "#ffffff")} />
                {category === "canvas" && <PreviewGrid canvasTheme={canvasTheme} />}
                {category === "canvas" && <CanvasPreview canvasTheme={canvasTheme} />}
                {category === "points" && <PointPreview pointDefaults={pointDefaults} />}
                {category === "lines" && <LinePreview segmentDefaults={segmentDefaults} lineDefaults={lineDefaults} />}
                {category === "shapes" && <ShapePreview circleDefaults={circleDefaults} ellipseDefaults={ellipseDefaults} polygonDefaults={polygonDefaults} />}
                {category === "angles" && <AnglePreview angleDefaults={angleDefaults} />}
                {category === "text" && (
                    <TextPreview
                        labelToolDefaults={labelToolDefaults}
                        textboxToolDefaults={textboxToolDefaults}
                        richTextToolDefaults={richTextToolDefaults}
                    />
                )}
            </svg>
            <div className="constructionPreviewCaption">{title} changes update here immediately. Scroll over the preview to zoom.</div>
        </aside>
    );
}

function PreviewGrid({ canvasTheme }: { canvasTheme: CanvasColorTheme }) {
    const minor = svgColor(canvasTheme.gridMinorColor, "#e5e7eb");
    const major = svgColor(canvasTheme.gridMajorColor, "#cbd5e1");
    const axis = svgColor(canvasTheme.axisColor, "#94a3b8");
    return (
        <g>
            {Array.from({ length: 8 }, (_, i) => (
                <line key={`v-${i}`} x1={20 + i * 35} y1="0" x2={20 + i * 35} y2="180" stroke={minor} strokeWidth="1" />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
                <line key={`h-${i}`} x1="0" y1={20 + i * 35} x2="280" y2={20 + i * 35} stroke={minor} strokeWidth="1" />
            ))}
            <line x1="0" y1="90" x2="280" y2="90" stroke={axis} strokeWidth="1.6" />
            <line x1="140" y1="0" x2="140" y2="180" stroke={axis} strokeWidth="1.6" />
            <line x1="0" y1="55" x2="280" y2="55" stroke={major} strokeWidth="1.2" opacity="0.8" />
            <line x1="70" y1="0" x2="70" y2="180" stroke={major} strokeWidth="1.2" opacity="0.8" />
        </g>
    );
}

function CanvasPreview({ canvasTheme }: { canvasTheme: CanvasColorTheme }) {
    return (
        <g>
            <rect x="34" y="34" width="212" height="112" fill="none" stroke={svgColor(canvasTheme.axisColor, "#94a3b8")} strokeWidth="2" strokeDasharray="7 6" />
            <text x="48" y="132" fill={svgColor(canvasTheme.axisColor, "#64748b")} fontSize="14" fontWeight="700">
                canvas grid
            </text>
        </g>
    );
}

function PointPreview({ pointDefaults }: { pointDefaults: ConstructionPreferencePreviewProps["pointDefaults"] }) {
    const x = 140;
    const y = 90;
    const r = Math.max(2, Math.min(18, pointDefaults.sizePx));
    return (
        <g>
            <circle
                cx={x}
                cy={y}
                r={r}
                fill={svgColor(pointDefaults.fillColor, "#ffffff")}
                fillOpacity={pointDefaults.fillOpacity}
                stroke={svgColor(pointDefaults.strokeColor, "#000000")}
                strokeWidth={Math.max(0.8, pointDefaults.strokeWidth)}
            />
            <text
                x={x + 20}
                y={y - 16}
                fontSize={pointDefaults.labelFontPx}
                fill={svgColor(pointDefaults.labelColor, "#000000")}
                stroke={svgColor(pointDefaults.labelHaloColor, "#ffffff")}
                strokeWidth={pointDefaults.labelHaloWidthPx}
                paintOrder="stroke"
                fontWeight="700"
            >
                A
            </text>
        </g>
    );
}

function LinePreview({
    segmentDefaults,
    lineDefaults,
}: {
    segmentDefaults: ConstructionPreferencePreviewProps["segmentDefaults"];
    lineDefaults: ConstructionPreferencePreviewProps["lineDefaults"];
}) {
    return (
        <g>
            <line
                x1="46"
                y1="58"
                x2="234"
                y2="36"
                stroke={svgColor(lineDefaults.strokeColor, "#000000")}
                strokeWidth={Math.max(1, lineDefaults.strokeWidth)}
                opacity={lineDefaults.opacity}
                strokeLinecap="round"
                strokeDasharray={lineDefaults.dash === "dashed" ? "10 8" : lineDefaults.dash === "dotted" ? "2 8" : undefined}
            />
            <text x="48" y="82" fill={svgColor(lineDefaults.strokeColor, "#000000")} fontSize="13" fontWeight="700">
                line
            </text>
            <line
                x1="70"
                y1="130"
                x2="210"
                y2="112"
                stroke={svgColor(segmentDefaults.strokeColor, "#000000")}
                strokeWidth={Math.max(1, segmentDefaults.strokeWidth)}
                opacity={segmentDefaults.opacity}
                strokeLinecap="round"
                strokeDasharray={segmentDefaults.dash === "dashed" ? "10 8" : segmentDefaults.dash === "dotted" ? "2 8" : undefined}
            />
            <circle cx="70" cy="130" r="4.5" fill={svgColor(segmentDefaults.strokeColor, "#000000")} />
            <circle cx="210" cy="112" r="4.5" fill={svgColor(segmentDefaults.strokeColor, "#000000")} />
            <text x="76" y="154" fill={svgColor(segmentDefaults.strokeColor, "#000000")} fontSize="13" fontWeight="700">
                segment
            </text>
        </g>
    );
}

function ShapePreview({
    circleDefaults,
    ellipseDefaults,
    polygonDefaults,
}: {
    circleDefaults: ConstructionPreferencePreviewProps["circleDefaults"];
    ellipseDefaults: ConstructionPreferencePreviewProps["ellipseDefaults"];
    polygonDefaults: ConstructionPreferencePreviewProps["polygonDefaults"];
}) {
    return (
        <g>
            <circle
                cx="96"
                cy="88"
                r="44"
                fill={svgColor(circleDefaults.fillColor, "#ffffff")}
                fillOpacity={circleDefaults.fillOpacity ?? 0}
                stroke={svgColor(circleDefaults.strokeColor, "#000000")}
                strokeWidth={Math.max(1, circleDefaults.strokeWidth)}
                strokeDasharray={circleDefaults.strokeDash === "dashed" ? "10 8" : circleDefaults.strokeDash === "dotted" ? "2 8" : undefined}
            />
            <polygon
                points="166,126 192,48 242,104"
                fill={svgColor(polygonDefaults.fillColor, "#ffffff")}
                fillOpacity={polygonDefaults.fillOpacity ?? 0}
                stroke={svgColor(polygonDefaults.strokeColor, "#000000")}
                strokeWidth={Math.max(1, polygonDefaults.strokeWidth)}
                strokeLinejoin="round"
                strokeDasharray={polygonDefaults.strokeDash === "dashed" ? "10 8" : polygonDefaults.strokeDash === "dotted" ? "2 8" : undefined}
            />
            <ellipse
                cx="176"
                cy="74"
                rx="34"
                ry="20"
                fill={svgColor(ellipseDefaults.fillColor, "#ffffff")}
                fillOpacity={ellipseDefaults.fillOpacity ?? 0}
                stroke={svgColor(ellipseDefaults.strokeColor, "#000000")}
                strokeWidth={Math.max(1, ellipseDefaults.strokeWidth)}
                strokeDasharray={ellipseDefaults.strokeDash === "dashed" ? "10 8" : ellipseDefaults.strokeDash === "dotted" ? "2 8" : undefined}
            />
        </g>
    );
}

function AnglePreview({ angleDefaults }: { angleDefaults: ConstructionPreferencePreviewProps["angleDefaults"] }) {
    const fillOpacity = angleDefaults.fillEnabled ? angleDefaults.fillOpacity : 0;
    return (
        <g>
            <path
                d="M52 126 L112 126 L210 70"
                fill="none"
                stroke={svgColor(angleDefaults.strokeColor, "#000000")}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M112 126 L70 126 A42 42 0 0 1 148 105 Z"
                fill={svgColor(angleDefaults.fillColor, "#ffffff")}
                fillOpacity={fillOpacity}
                stroke="none"
            />
            <path
                d="M70 126 A42 42 0 0 1 148 105"
                fill="none"
                stroke={svgColor(angleDefaults.strokeColor, "#000000")}
                strokeWidth={Math.max(1, angleDefaults.strokeWidth * 1.6)}
                strokeLinecap="round"
            />
            <path d="M100 111 L112 111" stroke={svgColor(angleDefaults.markColor, "#000000")} strokeWidth="3" strokeLinecap="round" />
            <text x="130" y="88" fontSize={angleDefaults.textSize} fill={svgColor(angleDefaults.textColor, "#000000")} fontWeight="700">
                62°
            </text>
        </g>
    );
}

function TextPreview({
    labelToolDefaults,
    textboxToolDefaults,
    richTextToolDefaults,
}: {
    labelToolDefaults: ConstructionPreferencePreviewProps["labelToolDefaults"];
    textboxToolDefaults: ConstructionPreferencePreviewProps["textboxToolDefaults"];
    richTextToolDefaults: ConstructionPreferencePreviewProps["richTextToolDefaults"];
}) {
    return (
        <g>
            <text x="44" y="62" fontSize={labelToolDefaults.textSize + 6} fill={svgColor(labelToolDefaults.textColor, "#000000")} fontWeight="700">
                Label
            </text>
            <rect x="38" y="84" width="204" height="50" rx="8" fill="rgba(255,255,255,0.58)" stroke="rgba(0,0,0,0.16)" />
            <text x="54" y="114" fontSize={textboxToolDefaults.textSize + 6} fill={svgColor(textboxToolDefaults.textColor, "#000000")}>
                Textbox
            </text>
            <text x="54" y="154" fontSize={richTextToolDefaults.textSize} fill={svgColor(richTextToolDefaults.textColor, "#000000")}>
                Rich text
            </text>
        </g>
    );
}
