import { useMemo } from "react";
import { useGeoStore } from "../../state/geoStore";
import { COLOR_PROFILE_OPTIONS, getCanvasColorTheme, type CanvasColorTheme } from "../../state/colorProfiles";
import { ColorTokenField } from "../ColorField";
import { parseNonNegativeNumber, parsePositiveNumber } from "./utils";

const CANVAS_THEME_KEYS: Array<{ key: keyof CanvasColorTheme; label: string }> = [
    { key: "backgroundColor", label: "Canvas Background" },
    { key: "gridMinorColor", label: "Grid Minor" },
    { key: "gridMajorColor", label: "Grid Major" },
    { key: "axisColor", label: "Axes" },
];

export function ConstructionSettings() {
    const applyAppPreferences = useGeoStore((state) => state.applyAppPreferences);
    const colorProfileId = useGeoStore((state) => state.colorProfileId);
    const canvasThemeOverrides = useGeoStore((state) => state.canvasThemeOverrides);
    const pointDefaults = useGeoStore((state) => state.pointDefaults);
    const segmentDefaults = useGeoStore((state) => state.segmentDefaults);
    const lineDefaults = useGeoStore((state) => state.lineDefaults);
    const circleDefaults = useGeoStore((state) => state.circleDefaults);
    const polygonDefaults = useGeoStore((state) => state.polygonDefaults);
    const angleDefaults = useGeoStore((state) => state.angleDefaults);
    const setColorProfile = useGeoStore((state) => state.setColorProfile);

    const canvasTheme = useMemo(
        () => getCanvasColorTheme(colorProfileId, canvasThemeOverrides),
        [colorProfileId, canvasThemeOverrides]
    );
    const canvasOverrideCount = useMemo(() => Object.keys(canvasThemeOverrides).length, [canvasThemeOverrides]);

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

    const setPointDefault = (next: Partial<typeof pointDefaults>) => {
        const labelOffsetPx =
            next.labelOffsetPx !== undefined
                ? { ...next.labelOffsetPx }
                : { ...pointDefaults.labelOffsetPx };
        applyAppPreferences({
            pointDefaults: {
                ...pointDefaults,
                ...next,
                labelOffsetPx,
            },
        });
    };

    const setSegmentDefault = (next: Partial<typeof segmentDefaults>) => {
        applyAppPreferences({
            segmentDefaults: {
                ...segmentDefaults,
                ...next,
            },
        });
    };

    const setLineDefault = (next: Partial<typeof lineDefaults>) => {
        applyAppPreferences({
            lineDefaults: {
                ...lineDefaults,
                ...next,
            },
        });
    };

    const setCircleDefault = (next: Partial<typeof circleDefaults>) => {
        applyAppPreferences({
            circleDefaults: {
                ...circleDefaults,
                ...next,
            },
        });
    };

    const setPolygonDefault = (next: Partial<typeof polygonDefaults>) => {
        applyAppPreferences({
            polygonDefaults: {
                ...polygonDefaults,
                ...next,
            },
        });
    };

    const setAngleDefault = (next: Partial<typeof angleDefaults>) => {
        const labelPosWorld =
            next.labelPosWorld !== undefined
                ? { ...next.labelPosWorld }
                : { ...angleDefaults.labelPosWorld };
        applyAppPreferences({
            angleDefaults: {
                ...angleDefaults,
                ...next,
                labelPosWorld,
            },
        });
    };

    return (
        <>
            <div className="preferencesSectionTitle">Construction Customize</div>
            <div className="preferencesCustomizeBar">
                <div className="preferencesCustomizeCount">
                    {canvasOverrideCount === 0
                        ? "Canvas uses active palette colors"
                        : `${canvasOverrideCount} custom canvas color${canvasOverrideCount === 1 ? "" : "s"}`}
                </div>
                <button
                    type="button"
                    className="preferencesResetButton"
                    disabled={canvasOverrideCount === 0}
                    onClick={resetCanvasThemeOverrides}
                >
                    Reset canvas colors
                </button>
            </div>

            <div className="preferencesTokenGrid" role="list" aria-label="Construction defaults">
                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-profile-select">
                        Construction Palette
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <select
                            id="construction-profile-select"
                            className="preferencesTokenInput"
                            value={colorProfileId}
                            onChange={(event) => setColorProfile(event.target.value as (typeof COLOR_PROFILE_OPTIONS)[number]["id"])}
                            aria-label="Construction palette"
                        >
                            {COLOR_PROFILE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {CANVAS_THEME_KEYS.map(({ key, label }) => {
                    const effectiveValue = canvasTheme[key];
                    const baseValue = getCanvasColorTheme(colorProfileId)[key];
                    const customValue = canvasThemeOverrides[key];
                    const isCustom = typeof customValue === "string" && customValue.trim().length > 0;
                    return (
                        <div
                            key={key}
                            role="listitem"
                            className={isCustom ? "preferencesTokenRow custom" : "preferencesTokenRow"}
                        >
                            <label className="preferencesTokenLabel" htmlFor={`construction-canvas-${key}`}>
                                {label}
                            </label>
                            <ColorTokenField
                                id={`construction-canvas-${key}`}
                                value={effectiveValue}
                                onChange={(nextValue) => setCanvasThemeValue(key, nextValue)}
                                pickerAriaLabel={`${label} color picker`}
                                textAriaLabel={`${label} value`}
                                trailing={
                                    <button
                                        type="button"
                                        className="preferencesTokenReset"
                                        onClick={() => setCanvasThemeValue(key, baseValue)}
                                        disabled={!isCustom}
                                        aria-label={`Reset ${label} to palette`}
                                    >
                                        Reset
                                    </button>
                                }
                            />
                        </div>
                    );
                })}

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-point-size">
                        Point Size
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            id="construction-point-size"
                            className="preferencesTokenInput"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={pointDefaults.sizePx}
                            onChange={(event) => {
                                const nextValue = parsePositiveNumber(event.target.value);
                                if (nextValue === null) return;
                                setPointDefault({ sizePx: nextValue });
                            }}
                            aria-label="Point size"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-point-stroke-width">
                        Point Stroke Width
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            id="construction-point-stroke-width"
                            className="preferencesTokenInput"
                            type="number"
                            step="0.1"
                            min="0"
                            value={pointDefaults.strokeWidth}
                            onChange={(event) => {
                                const nextValue = parseNonNegativeNumber(event.target.value);
                                if (nextValue === null) return;
                                setPointDefault({ strokeWidth: nextValue });
                            }}
                            aria-label="Point stroke width"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-point-fill">
                        Point Fill
                    </label>
                    <ColorTokenField
                        id="construction-point-fill"
                        value={pointDefaults.fillColor}
                        onChange={(nextValue) => setPointDefault({ fillColor: nextValue })}
                        pickerAriaLabel="Point fill color picker"
                        textAriaLabel="Point fill color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-point-stroke">
                        Point Stroke
                    </label>
                    <ColorTokenField
                        id="construction-point-stroke"
                        value={pointDefaults.strokeColor}
                        onChange={(nextValue) => setPointDefault({ strokeColor: nextValue })}
                        pickerAriaLabel="Point stroke color picker"
                        textAriaLabel="Point stroke color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-point-label-color">
                        Point Label
                    </label>
                    <ColorTokenField
                        id="construction-point-label-color"
                        value={pointDefaults.labelColor}
                        onChange={(nextValue) => setPointDefault({ labelColor: nextValue })}
                        pickerAriaLabel="Point label color picker"
                        textAriaLabel="Point label color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-point-label-halo">
                        Point Label Halo
                    </label>
                    <ColorTokenField
                        id="construction-point-label-halo"
                        value={pointDefaults.labelHaloColor}
                        onChange={(nextValue) => setPointDefault({ labelHaloColor: nextValue })}
                        pickerAriaLabel="Point label halo color picker"
                        textAriaLabel="Point label halo color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-segment-stroke-width">
                        Segment Width
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            id="construction-segment-stroke-width"
                            className="preferencesTokenInput"
                            type="number"
                            step="0.1"
                            min="0"
                            value={segmentDefaults.strokeWidth}
                            onChange={(event) => {
                                const nextValue = parseNonNegativeNumber(event.target.value);
                                if (nextValue === null) return;
                                setSegmentDefault({ strokeWidth: nextValue });
                            }}
                            aria-label="Segment width"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-segment-stroke">
                        Segment Color
                    </label>
                    <ColorTokenField
                        id="construction-segment-stroke"
                        value={segmentDefaults.strokeColor}
                        onChange={(nextValue) => setSegmentDefault({ strokeColor: nextValue })}
                        pickerAriaLabel="Segment color picker"
                        textAriaLabel="Segment color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-line-stroke-width">
                        Line Width
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            id="construction-line-stroke-width"
                            className="preferencesTokenInput"
                            type="number"
                            step="0.1"
                            min="0"
                            value={lineDefaults.strokeWidth}
                            onChange={(event) => {
                                const nextValue = parseNonNegativeNumber(event.target.value);
                                if (nextValue === null) return;
                                setLineDefault({ strokeWidth: nextValue });
                            }}
                            aria-label="Line width"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-line-stroke">
                        Line Color
                    </label>
                    <ColorTokenField
                        id="construction-line-stroke"
                        value={lineDefaults.strokeColor}
                        onChange={(nextValue) => setLineDefault({ strokeColor: nextValue })}
                        pickerAriaLabel="Line color picker"
                        textAriaLabel="Line color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-circle-stroke-width">
                        Circle Width
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            id="construction-circle-stroke-width"
                            className="preferencesTokenInput"
                            type="number"
                            step="0.1"
                            min="0"
                            value={circleDefaults.strokeWidth}
                            onChange={(event) => {
                                const nextValue = parseNonNegativeNumber(event.target.value);
                                if (nextValue === null) return;
                                setCircleDefault({ strokeWidth: nextValue });
                            }}
                            aria-label="Circle width"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-circle-stroke">
                        Circle Color
                    </label>
                    <ColorTokenField
                        id="construction-circle-stroke"
                        value={circleDefaults.strokeColor}
                        onChange={(nextValue) => setCircleDefault({ strokeColor: nextValue })}
                        pickerAriaLabel="Circle color picker"
                        textAriaLabel="Circle color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-polygon-fill">
                        Polygon Fill
                    </label>
                    <ColorTokenField
                        id="construction-polygon-fill"
                        value={polygonDefaults.fillColor ?? ""}
                        onChange={(nextValue) => setPolygonDefault({ fillColor: nextValue })}
                        pickerAriaLabel="Polygon fill color picker"
                        textAriaLabel="Polygon fill color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-angle-mark-color">
                        Angle Mark Color
                    </label>
                    <ColorTokenField
                        id="construction-angle-mark-color"
                        value={angleDefaults.markColor}
                        onChange={(nextValue) => setAngleDefault({ markColor: nextValue })}
                        pickerAriaLabel="Angle mark color picker"
                        textAriaLabel="Angle mark color"
                        controlsClassName="preferencesTokenControlsCompact"
                    />
                </div>
            </div>
        </>
    );
}
