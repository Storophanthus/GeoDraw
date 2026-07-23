import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGeoStore } from "../../state/geoStore";
import {
    UI_COLOR_PROFILE_OPTIONS,
    getUiColorProfileSwatch,
    getUiProfileBaseVariables,
    getUiCssVariables,
    type UiCssVariableName,
    type UiCssVariables,
} from "../../state/colorProfiles";
import { EXPORT_FRIENDLY_COLOR_PRESETS, colorToHex, resolveExportFriendlyColorName } from "../../exportFriendlyColors";
import { ColorSwatchInput } from "../ColorField";
import { ProfileSwatch, formatUiCssVariableLabel } from "./utils";
import { toRgba } from "../colorUtils";

type ThemeCategory = "app" | "panels" | "text" | "accent" | "preview" | "feedback";

const THEME_CATEGORIES: Array<{
    id: ThemeCategory;
    label: string;
    description: string;
    tokens: UiCssVariableName[];
}> = [
    {
        id: "app",
        label: "App",
        description: "Window, toolbar, sidebar, canvas",
        tokens: [
            "--gd-ui-app-bg",
            "--gd-ui-app-text",
            "--gd-ui-toolbar-bg",
            "--gd-ui-sidebar-bg",
            "--gd-ui-canvas-bg",
        ],
    },
    {
        id: "panels",
        label: "Panels",
        description: "Cards, surfaces, borders",
        tokens: [
            "--gd-ui-surface",
            "--gd-ui-surface-soft",
            "--gd-ui-surface-muted",
            "--gd-ui-surface-elevated",
            "--gd-ui-border",
            "--gd-ui-border-soft",
            "--gd-ui-border-panel",
            "--gd-ui-border-strong",
            "--gd-ui-glass-bg",
            "--gd-ui-glass-bg-strong",
        ],
    },
    {
        id: "text",
        label: "Text",
        description: "Labels, headings, icons",
        tokens: [
            "--gd-ui-text-strong",
            "--gd-ui-text",
            "--gd-ui-text-muted",
            "--gd-ui-text-subtle",
            "--gd-ui-title-tone",
            "--gd-ui-icon-tone",
            "--gd-ui-icon-tone-strong",
        ],
    },
    {
        id: "accent",
        label: "Accent",
        description: "Active tabs, focus, selected state",
        tokens: [
            "--gd-ui-accent",
            "--gd-ui-accent-strong",
            "--gd-ui-accent-deeper",
            "--gd-ui-accent-text",
            "--gd-ui-accent-bg",
            "--gd-ui-accent-bg-soft",
            "--gd-ui-accent-bg-strong",
            "--gd-ui-accent-ring",
            "--gd-ui-focus-outline",
            "--gd-ui-focus-outline-strong",
            "--gd-ui-resize-hover",
        ],
    },
    {
        id: "preview",
        label: "Preview",
        description: "Temporary guides and snapping",
        tokens: [
            "--gd-ui-preview-stroke",
            "--gd-ui-preview-stroke-strong",
            "--gd-ui-preview-fill-soft",
            "--gd-ui-preview-fill",
            "--gd-ui-preview-fill-strong",
            "--gd-ui-preview-snap-stroke",
            "--gd-ui-preview-line-width",
        ],
    },
    {
        id: "feedback",
        label: "Status",
        description: "Warnings, success, shadows, overlays",
        tokens: [
            "--gd-ui-danger",
            "--gd-ui-danger-text",
            "--gd-ui-success-text",
            "--gd-ui-overlay-hover",
            "--gd-ui-overlay-shadow",
            "--gd-ui-shadow-soft",
            "--gd-ui-shadow",
            "--gd-ui-shadow-strong",
        ],
    },
];

const THEME_TOKEN_LABELS: Partial<Record<UiCssVariableName, string>> = {
    "--gd-ui-app-bg": "App background",
    "--gd-ui-app-text": "App text",
    "--gd-ui-toolbar-bg": "Left toolbar",
    "--gd-ui-sidebar-bg": "Right sidebar",
    "--gd-ui-canvas-bg": "Canvas surround",
    "--gd-ui-surface": "Main surface",
    "--gd-ui-surface-soft": "Soft surface",
    "--gd-ui-surface-muted": "Muted surface",
    "--gd-ui-surface-elevated": "Raised surface",
    "--gd-ui-border": "Default border",
    "--gd-ui-border-soft": "Soft border",
    "--gd-ui-border-panel": "Panel border",
    "--gd-ui-border-strong": "Strong border",
    "--gd-ui-glass-bg": "Translucent panel",
    "--gd-ui-glass-bg-strong": "Modal background",
    "--gd-ui-text-strong": "Strong text",
    "--gd-ui-text": "Body text",
    "--gd-ui-text-muted": "Muted text",
    "--gd-ui-text-subtle": "Subtle text",
    "--gd-ui-title-tone": "Section titles",
    "--gd-ui-icon-tone": "Icon color",
    "--gd-ui-icon-tone-strong": "Active icon color",
    "--gd-ui-accent": "Accent",
    "--gd-ui-accent-strong": "Strong accent",
    "--gd-ui-accent-deeper": "Deep accent",
    "--gd-ui-accent-text": "Accent text",
    "--gd-ui-accent-bg": "Accent background",
    "--gd-ui-accent-bg-soft": "Soft accent background",
    "--gd-ui-accent-bg-strong": "Strong accent background",
    "--gd-ui-accent-ring": "Accent ring",
    "--gd-ui-focus-outline": "Focus outline",
    "--gd-ui-focus-outline-strong": "Strong focus outline",
    "--gd-ui-resize-hover": "Resize hover",
    "--gd-ui-preview-stroke": "Preview line",
    "--gd-ui-preview-stroke-strong": "Strong preview line",
    "--gd-ui-preview-fill-soft": "Soft preview fill",
    "--gd-ui-preview-fill": "Preview fill",
    "--gd-ui-preview-fill-strong": "Strong preview fill",
    "--gd-ui-preview-snap-stroke": "Snap highlight",
    "--gd-ui-preview-line-width": "Preview line width",
    "--gd-ui-danger": "Danger border",
    "--gd-ui-danger-text": "Danger text",
    "--gd-ui-success-text": "Success text",
    "--gd-ui-overlay-hover": "Overlay hover",
    "--gd-ui-overlay-shadow": "Overlay shadow",
    "--gd-ui-shadow-soft": "Soft shadow",
    "--gd-ui-shadow": "Shadow",
    "--gd-ui-shadow-strong": "Strong shadow",
};

const PRESET_LABEL_BY_HEX = new Map(
    EXPORT_FRIENDLY_COLOR_PRESETS.map((preset) => [preset.hex.toLowerCase(), preset.label])
);

function tokenLabel(token: UiCssVariableName): string {
    return THEME_TOKEN_LABELS[token] ?? formatUiCssVariableLabel(token);
}

function isNumericToken(token: UiCssVariableName): boolean {
    return token === "--gd-ui-preview-line-width";
}

function friendlyColorName(raw: string): string {
    const hex = colorToHex(raw);
    if (!hex) return raw.trim() || "No color";
    const presetLabel = PRESET_LABEL_BY_HEX.get(hex.toLowerCase());
    if (presetLabel) return presetLabel;
    const exportName = resolveExportFriendlyColorName(raw);
    if (exportName) return exportName.replace(/([a-z])([A-Z])/g, "$1 $2");
    return raw.trim().startsWith("rgba") ? "Transparent custom color" : "Custom color";
}

function exactColorValue(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith("rgb")) return trimmed;
    return colorToHex(raw)?.toUpperCase() ?? trimmed;
}

function cssVar(vars: UiCssVariables, key: UiCssVariableName): string {
    return vars[key];
}

function numericCssVar(vars: UiCssVariables, key: UiCssVariableName, fallback: number): number {
    const parsed = Number(vars[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function ThemeColorControl({
    token,
    value,
    baseValue,
    onChange,
}: {
    token: UiCssVariableName;
    value: string;
    baseValue: string;
    onChange: (nextValue: string) => void;
}) {
    const isCustom = value.trim() !== baseValue.trim();
    return (
        <div className="constructionPreferenceControl">
            <div className="constructionPreferenceControlText">
                <div className="constructionPreferenceControlLabel">{tokenLabel(token)}</div>
                <div className="constructionPreferenceColorName">{friendlyColorName(value)}</div>
            </div>
            <div className="constructionPreferenceColorControl">
                <ColorSwatchInput
                    variant="token"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={`${tokenLabel(token)} color`}
                />
                <span className="constructionPreferenceExactColor" title={exactColorValue(value)}>
                    {exactColorValue(value)}
                </span>
                <button
                    type="button"
                    className="preferencesTokenReset"
                    onClick={() => onChange(baseValue)}
                    disabled={!isCustom}
                    aria-label={`Reset ${tokenLabel(token)} to preset`}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

function ThemeValueControl({
    token,
    value,
    baseValue,
    onChange,
}: {
    token: UiCssVariableName;
    value: string;
    baseValue: string;
    onChange: (nextValue: string) => void;
}) {
    const isCustom = value.trim() !== baseValue.trim();
    return (
        <div className="constructionPreferenceControl">
            <div className="constructionPreferenceControlText">
                <div className="constructionPreferenceControlLabel">{tokenLabel(token)}</div>
            </div>
            <div className="themePreferenceValueControl">
                <input
                    className="preferencesTokenInput constructionPreferenceNumberInput"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={tokenLabel(token)}
                />
                <button
                    type="button"
                    className="preferencesTokenReset"
                    onClick={() => onChange(baseValue)}
                    disabled={!isCustom}
                    aria-label={`Reset ${tokenLabel(token)} to preset`}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

function ThemeCategoryPane({
    children,
}: {
    children: ReactNode;
}) {
    return <>{children}</>;
}

export function ThemeSettings() {
    const uiColorProfileId = useGeoStore((state) => state.uiColorProfileId);
    const uiCssOverrides = useGeoStore((state) => state.uiCssOverrides);
    const setUiColorProfile = useGeoStore((state) => state.setUiColorProfile);
    const setUiCssVariable = useGeoStore((state) => state.setUiCssVariable);
    const clearUiCssOverrides = useGeoStore((state) => state.clearUiCssOverrides);
    const [category, setCategory] = useState<ThemeCategory>("app");

    const uiBaseVariables = useMemo(() => getUiProfileBaseVariables(uiColorProfileId), [uiColorProfileId]);
    const uiEffectiveVariables = useMemo(
        () => getUiCssVariables(uiColorProfileId, uiCssOverrides),
        [uiColorProfileId, uiCssOverrides]
    );
    const uiOverrideCount = useMemo(() => Object.keys(uiCssOverrides).length, [uiCssOverrides]);
    const activeCategory = THEME_CATEGORIES.find((item) => item.id === category) ?? THEME_CATEGORIES[0];
    const activeCategoryOverrideCount = activeCategory.tokens.filter((token) => {
        const value = uiCssOverrides[token];
        return typeof value === "string" && value.trim().length > 0;
    }).length;

    const resetActiveCategory = () => {
        for (const token of activeCategory.tokens) {
            setUiCssVariable(token, uiBaseVariables[token]);
        }
    };

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

            <div className="preferencesSectionTitle">Customize UI</div>
            <div className="preferencesCustomizeBar">
                <div className="preferencesCustomizeCount">
                    {uiOverrideCount === 0
                        ? "Using preset values"
                        : `${uiOverrideCount} custom UI value${uiOverrideCount === 1 ? "" : "s"}`}
                </div>
                <button
                    type="button"
                    className="preferencesResetButton"
                    disabled={uiOverrideCount === 0}
                    onClick={() => clearUiCssOverrides()}
                >
                    Reset all UI
                </button>
            </div>

            <div className="constructionPreferenceLayout">
                <div className="constructionPreferenceCategoryList" role="tablist" aria-label="UI preference categories">
                    {THEME_CATEGORIES.map((item) => (
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
                                disabled={activeCategoryOverrideCount === 0}
                                onClick={resetActiveCategory}
                            >
                                Reset to default
                            </button>
                        </div>
                        <ThemeCategoryPane>
                            {activeCategory.tokens.map((token) =>
                                isNumericToken(token) ? (
                                    <ThemeValueControl
                                        key={token}
                                        token={token}
                                        value={uiEffectiveVariables[token]}
                                        baseValue={uiBaseVariables[token]}
                                        onChange={(nextValue) => setUiCssVariable(token, nextValue)}
                                    />
                                ) : (
                                    <ThemeColorControl
                                        key={token}
                                        token={token}
                                        value={uiEffectiveVariables[token]}
                                        baseValue={uiBaseVariables[token]}
                                        onChange={(nextValue) => setUiCssVariable(token, nextValue)}
                                    />
                                )
                            )}
                        </ThemeCategoryPane>
                    </div>
                    <UiThemePreferencePreview category={category} vars={uiEffectiveVariables} />
                </div>
            </div>

            <div className="preferencesHint">
                UI theme is persisted across restarts and is not loaded from scene files.
            </div>
        </>
    );
}

function UiThemePreferencePreview({ category, vars }: { category: ThemeCategory; vars: UiCssVariables }) {
    const previewLineWidth = Math.max(1, numericCssVar(vars, "--gd-ui-preview-line-width", 1.3) * 2);
    const activeCategory = THEME_CATEGORIES.find((item) => item.id === category) ?? THEME_CATEGORIES[0];

    return (
        <aside className="constructionPreviewPanel" aria-label={`${activeCategory.label} UI preview`}>
            <div className="constructionPreviewToolbar">
                <div className="constructionPreviewTitle">Preview</div>
            </div>
            <div
                className="uiThemePreviewMock"
                style={{
                    background: cssVar(vars, "--gd-ui-app-bg"),
                    color: cssVar(vars, "--gd-ui-app-text"),
                    borderColor: cssVar(vars, "--gd-ui-border-panel"),
                    boxShadow: `0 10px 24px ${cssVar(vars, "--gd-ui-shadow")}`,
                }}
            >
                <div className="uiThemePreviewToolbarMock" style={{ background: cssVar(vars, "--gd-ui-toolbar-bg"), borderColor: cssVar(vars, "--gd-ui-border-soft") }}>
                    <span style={{ background: cssVar(vars, "--gd-ui-icon-tone-strong") }} />
                    <span style={{ background: cssVar(vars, "--gd-ui-icon-tone") }} />
                    <span style={{ background: cssVar(vars, "--gd-ui-accent") }} />
                </div>
                <div className="uiThemePreviewBodyMock">
                    <div className="uiThemePreviewSidebarMock" style={{ background: cssVar(vars, "--gd-ui-sidebar-bg"), borderColor: cssVar(vars, "--gd-ui-border-soft") }}>
                        <div
                            className="uiThemePreviewTabMock active"
                            style={{
                                background: cssVar(vars, "--gd-ui-accent-bg"),
                                color: cssVar(vars, "--gd-ui-accent-text"),
                                borderColor: cssVar(vars, "--gd-ui-accent"),
                                boxShadow: `0 0 0 3px ${cssVar(vars, "--gd-ui-accent-ring")}`,
                            }}
                        >
                            Properties
                        </div>
                        <div className="uiThemePreviewTabMock" style={{ background: cssVar(vars, "--gd-ui-surface-soft"), color: cssVar(vars, "--gd-ui-text-muted"), borderColor: cssVar(vars, "--gd-ui-border") }}>
                            Export
                        </div>
                        <div className="uiThemePreviewCardMock" style={{ background: cssVar(vars, "--gd-ui-surface"), borderColor: cssVar(vars, "--gd-ui-border") }}>
                            <strong style={{ color: cssVar(vars, "--gd-ui-text-strong") }}>Stroke</strong>
                            <span style={{ color: cssVar(vars, "--gd-ui-text-subtle") }}>Color and width</span>
                        </div>
                    </div>
                    <div className="uiThemePreviewCanvasMock" style={{ background: cssVar(vars, "--gd-ui-canvas-bg"), borderColor: cssVar(vars, "--gd-ui-border-panel") }}>
                        <svg viewBox="0 0 160 112" role="img" aria-label="UI preview drawing">
                            <path
                                d="M24 84 L70 42 L132 74"
                                fill={cssVar(vars, "--gd-ui-preview-fill")}
                                stroke={cssVar(vars, "--gd-ui-preview-stroke")}
                                strokeWidth={previewLineWidth}
                                strokeLinejoin="round"
                            />
                            <circle cx="70" cy="42" r="7" fill={cssVar(vars, "--gd-ui-preview-fill-strong")} stroke={cssVar(vars, "--gd-ui-preview-stroke-strong")} strokeWidth="2" />
                            <circle cx="132" cy="74" r="6" fill={cssVar(vars, "--gd-ui-preview-fill-soft")} stroke={cssVar(vars, "--gd-ui-preview-snap-stroke")} strokeWidth="2.5" />
                        </svg>
                    </div>
                </div>
                <div className="uiThemePreviewFooterMock" style={{ background: cssVar(vars, "--gd-ui-surface-elevated"), borderColor: cssVar(vars, "--gd-ui-border-soft") }}>
                    <span style={{ color: cssVar(vars, "--gd-ui-success-text") }}>Saved</span>
                    <span style={{ color: cssVar(vars, "--gd-ui-danger-text") }}>Warning</span>
                </div>
            </div>
            <div className="constructionPreviewCaption">
                {activeCategory.label} changes update the mock interface immediately.
            </div>
        </aside>
    );
}
