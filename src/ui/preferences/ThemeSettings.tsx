import { useMemo, type CSSProperties } from "react";
import { useGeoStore } from "../../state/geoStore";
import {
    UI_CSS_VARIABLE_KEYS,
    UI_COLOR_PROFILE_OPTIONS,
    getUiColorProfileSwatch,
    getUiProfileBaseVariables,
    getUiCssVariables,
} from "../../state/colorProfiles";
import { ProfileSwatch, formatUiCssVariableLabel, toColorInputValue } from "./utils";
import { toRgba } from "../colorUtils";

export function ThemeSettings() {
    const uiColorProfileId = useGeoStore((state) => state.uiColorProfileId);
    const uiCssOverrides = useGeoStore((state) => state.uiCssOverrides);
    const setUiColorProfile = useGeoStore((state) => state.setUiColorProfile);
    const setUiCssVariable = useGeoStore((state) => state.setUiCssVariable);
    const clearUiCssOverrides = useGeoStore((state) => state.clearUiCssOverrides);

    const uiBaseVariables = useMemo(() => getUiProfileBaseVariables(uiColorProfileId), [uiColorProfileId]);
    const uiEffectiveVariables = useMemo(
        () => getUiCssVariables(uiColorProfileId, uiCssOverrides),
        [uiColorProfileId, uiCssOverrides]
    );
    const uiOverrideCount = useMemo(() => Object.keys(uiCssOverrides).length, [uiCssOverrides]);

    return (
        <>
            <div className="preferencesSectionTitle">UI Theme</div>
            <div className="preferencesSwatchRow" role="radiogroup" aria-label="UI color profile">
                {UI_COLOR_PROFILE_OPTIONS.map((option) => {
                    const swatch = getUiColorProfileSwatch(option.id);
                    const active = option.id === uiColorProfileId;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            title={option.label}
                            className={active ? "profileSwatchButton active" : "profileSwatchButton"}
                            onClick={() => setUiColorProfile(option.id)}
                            style={
                                active
                                    ? ({
                                        "--profile-active-border": swatch.line,
                                        "--profile-active-halo": toRgba(swatch.background, 0.9),
                                    } as CSSProperties)
                                    : undefined
                            }
                        >
                            <ProfileSwatch profileId={option.id} />
                        </button>
                    );
                })}
            </div>

            <div className="preferencesSectionTitle">Full Customize</div>
            <div className="preferencesCustomizeBar">
                <div className="preferencesCustomizeCount">
                    {uiOverrideCount === 0
                        ? "Using preset values"
                        : `${uiOverrideCount} custom token${uiOverrideCount === 1 ? "" : "s"}`}
                </div>
                <button
                    type="button"
                    className="preferencesResetButton"
                    disabled={uiOverrideCount === 0}
                    onClick={() => clearUiCssOverrides()}
                >
                    Reset to preset
                </button>
            </div>

            <div className="preferencesTokenGrid" role="list" aria-label="UI color tokens">
                {UI_CSS_VARIABLE_KEYS.map((tokenName) => {
                    const effectiveValue = uiEffectiveVariables[tokenName];
                    const baseValue = uiBaseVariables[tokenName];
                    const customValue = uiCssOverrides[tokenName];
                    const isCustom = typeof customValue === "string" && customValue.trim().length > 0;
                    const colorPickerValue = toColorInputValue(effectiveValue);
                    return (
                        <div
                            key={tokenName}
                            role="listitem"
                            className={isCustom ? "preferencesTokenRow custom" : "preferencesTokenRow"}
                        >
                            <label className="preferencesTokenLabel" htmlFor={`ui-token-${tokenName}`}>
                                {formatUiCssVariableLabel(tokenName)}
                            </label>
                            <div className="preferencesTokenControls">
                                <input
                                    className="preferencesTokenColor"
                                    type="color"
                                    value={colorPickerValue ?? "#000000"}
                                    disabled={colorPickerValue === null}
                                    onChange={(event) => setUiCssVariable(tokenName, event.target.value)}
                                    aria-label={`${formatUiCssVariableLabel(tokenName)} color picker`}
                                />
                                <input
                                    id={`ui-token-${tokenName}`}
                                    className="preferencesTokenInput"
                                    type="text"
                                    value={effectiveValue}
                                    onChange={(event) => setUiCssVariable(tokenName, event.target.value)}
                                    spellCheck={false}
                                    aria-label={`${formatUiCssVariableLabel(tokenName)} value`}
                                />
                                <button
                                    type="button"
                                    className="preferencesTokenReset"
                                    onClick={() => setUiCssVariable(tokenName, baseValue)}
                                    disabled={!isCustom}
                                    aria-label={`Reset ${formatUiCssVariableLabel(tokenName)} to preset`}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="preferencesHint">
                UI theme is persisted across restarts and is not loaded from scene files.
            </div>
        </>
    );
}
