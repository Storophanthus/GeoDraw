import { useMemo } from "react";
import { useGeoStore } from "../../state/geoStore";
import { COLOR_PROFILE_OPTIONS, getCanvasColorTheme, type CanvasColorTheme } from "../../state/colorProfiles";
import { toColorInputValue, parseNonNegativeNumber, parsePositiveNumber } from "./utils";

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
                            <div className="preferencesTokenControls">
                                <input
                                    className="preferencesTokenColor"
                                    type="color"
                                    value={toColorInputValue(effectiveValue) ?? "#000000"}
                                    disabled={toColorInputValue(effectiveValue) === null}
                                    onChange={(event) => setCanvasThemeValue(key, event.target.value)}
                                    aria-label={`${label} color picker`}
                                />
                                <input
                                    id={`construction-canvas-${key}`}
                                    className="preferencesTokenInput"
                                    type="text"
                                    value={effectiveValue}
                                    onChange={(event) => setCanvasThemeValue(key, event.target.value)}
                                    spellCheck={false}
                                    aria-label={`${label} value`}
                                />
                                <button
                                    type="button"
                                    className="preferencesTokenReset"
                                    onClick={() => setCanvasThemeValue(key, baseValue)}
                                    disabled={!isCustom}
                                    aria-label={`Reset ${label} to palette`}
                                >
                                    Reset
                                </button>
                            </div>
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
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            className="preferencesTokenColor"
                            type="color"
                            value={toColorInputValue(pointDefaults.fillColor) ?? "#000000"}
                            disabled={toColorInputValue(pointDefaults.fillColor) === null}
                            onChange={(event) => setPointDefault({ fillColor: event.target.value })}
                            aria-label="Point fill color picker"
                        />
                        <input
                            id="construction-point-fill"
                            className="preferencesTokenInput"
                            type="text"
                            value={pointDefaults.fillColor}
                            onChange={(event) => setPointDefault({ fillColor: event.target.value })}
                            spellCheck={false}
                            aria-label="Point fill color"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-point-stroke">
                        Point Stroke
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            className="preferencesTokenColor"
                            type="color"
                            value={toColorInputValue(pointDefaults.strokeColor) ?? "#000000"}
                            disabled={toColorInputValue(pointDefaults.strokeColor) === null}
                            onChange={(event) => setPointDefault({ strokeColor: event.target.value })}
                            aria-label="Point stroke color picker"
                        />
                        <input
                            id="construction-point-stroke"
                            className="preferencesTokenInput"
                            type="text"
                            value={pointDefaults.strokeColor}
                            onChange={(event) => setPointDefault({ strokeColor: event.target.value })}
                            spellCheck={false}
                            aria-label="Point stroke color"
                        />
                    </div>
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
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            className="preferencesTokenColor"
                            type="color"
                            value={toColorInputValue(segmentDefaults.strokeColor) ?? "#000000"}
                            disabled={toColorInputValue(segmentDefaults.strokeColor) === null}
                            onChange={(event) => setSegmentDefault({ strokeColor: event.target.value })}
                            aria-label="Segment color picker"
                        />
                        <input
                            id="construction-segment-stroke"
                            className="preferencesTokenInput"
                            type="text"
                            value={segmentDefaults.strokeColor}
                            onChange={(event) => setSegmentDefault({ strokeColor: event.target.value })}
                            spellCheck={false}
                            aria-label="Segment color"
                        />
                    </div>
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
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            className="preferencesTokenColor"
                            type="color"
                            value={toColorInputValue(lineDefaults.strokeColor) ?? "#000000"}
                            disabled={toColorInputValue(lineDefaults.strokeColor) === null}
                            onChange={(event) => setLineDefault({ strokeColor: event.target.value })}
                            aria-label="Line color picker"
                        />
                        <input
                            id="construction-line-stroke"
                            className="preferencesTokenInput"
                            type="text"
                            value={lineDefaults.strokeColor}
                            onChange={(event) => setLineDefault({ strokeColor: event.target.value })}
                            spellCheck={false}
                            aria-label="Line color"
                        />
                    </div>
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
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            className="preferencesTokenColor"
                            type="color"
                            value={toColorInputValue(circleDefaults.strokeColor) ?? "#000000"}
                            disabled={toColorInputValue(circleDefaults.strokeColor) === null}
                            onChange={(event) => setCircleDefault({ strokeColor: event.target.value })}
                            aria-label="Circle color picker"
                        />
                        <input
                            id="construction-circle-stroke"
                            className="preferencesTokenInput"
                            type="text"
                            value={circleDefaults.strokeColor}
                            onChange={(event) => setCircleDefault({ strokeColor: event.target.value })}
                            spellCheck={false}
                            aria-label="Circle color"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-polygon-fill">
                        Polygon Fill
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            className="preferencesTokenColor"
                            type="color"
                            value={toColorInputValue(polygonDefaults.fillColor ?? "") ?? "#000000"}
                            disabled={toColorInputValue(polygonDefaults.fillColor ?? "") === null}
                            onChange={(event) => setPolygonDefault({ fillColor: event.target.value })}
                            aria-label="Polygon fill color picker"
                        />
                        <input
                            id="construction-polygon-fill"
                            className="preferencesTokenInput"
                            type="text"
                            value={polygonDefaults.fillColor ?? ""}
                            onChange={(event) => setPolygonDefault({ fillColor: event.target.value })}
                            spellCheck={false}
                            aria-label="Polygon fill color"
                        />
                    </div>
                </div>

                <div role="listitem" className="preferencesTokenRow">
                    <label className="preferencesTokenLabel" htmlFor="construction-angle-mark-color">
                        Angle Mark Color
                    </label>
                    <div className="preferencesTokenControls preferencesTokenControlsCompact">
                        <input
                            className="preferencesTokenColor"
                            type="color"
                            value={toColorInputValue(angleDefaults.markColor) ?? "#000000"}
                            disabled={toColorInputValue(angleDefaults.markColor) === null}
                            onChange={(event) => setAngleDefault({ markColor: event.target.value })}
                            aria-label="Angle mark color picker"
                        />
                        <input
                            id="construction-angle-mark-color"
                            className="preferencesTokenInput"
                            type="text"
                            value={angleDefaults.markColor}
                            onChange={(event) => setAngleDefault({ markColor: event.target.value })}
                            spellCheck={false}
                            aria-label="Angle mark color"
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
