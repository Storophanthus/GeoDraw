import type {
  AngleStyle,
  CircleStyle,
  LineStyle,
  PathArrowMark,
  PointStyle,
  PolygonStyle,
  SceneModel,
} from "../scene/points";

export type ColorProfileId = "classic" | "grayscale_white_dot" | "beige_light" | "dark_mode";
export type UiColorProfileId = "vanilla" | "grayscale" | "beige" | "dark";

export type CanvasColorTheme = {
  backgroundColor: string;
  gridMinorColor: string;
  gridMajorColor: string;
  axisColor: string;
};

export type ColorProfilePalette = CanvasColorTheme & {
  pointStroke: string;
  pointFill: string;
  pointLabel: string;
  pointLabelHalo: string;
  segmentStroke: string;
  lineStroke: string;
  circleStroke: string;
  polygonStroke: string;
  polygonFill: string;
  angleStroke: string;
  angleText: string;
  angleFill: string;
  angleMark: string;
  arrow: string;
  marking: string;
};

export type ColorProfile = {
  id: ColorProfileId;
  label: string;
  palette: ColorProfilePalette;
};

export type SceneStyleDefaults = {
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  polygonDefaults: PolygonStyle;
  angleDefaults: AngleStyle;
};

export const DEFAULT_COLOR_PROFILE_ID: ColorProfileId = "beige_light";
export const DEFAULT_UI_COLOR_PROFILE_ID: UiColorProfileId = "beige";

const DEFAULT_PATH_ARROW_UI = 1.0;
const DEFAULT_PATH_ARROW_LINE_WIDTH_PT = DEFAULT_PATH_ARROW_UI * 8;

export const UI_CSS_VARIABLE_DEFAULTS = {
  "--gd-ui-app-text": "#1f2937",
  "--gd-ui-app-bg": "#f3f5f8",
  "--gd-ui-toolbar-bg": "#eef2f7",
  "--gd-ui-sidebar-bg": "#f3f6fb",
  "--gd-ui-canvas-bg": "#ffffff",
  "--gd-ui-surface": "#ffffff",
  "--gd-ui-surface-soft": "#f8fafc",
  "--gd-ui-surface-muted": "#edf3fa",
  "--gd-ui-surface-elevated": "#f8fbff",
  "--gd-ui-border": "#cbd5e1",
  "--gd-ui-border-soft": "#dbe2ea",
  "--gd-ui-border-panel": "#d7dfe8",
  "--gd-ui-border-strong": "#94a3b8",
  "--gd-ui-text-strong": "#0f172a",
  "--gd-ui-text": "#334155",
  "--gd-ui-text-muted": "#475569",
  "--gd-ui-text-subtle": "#64748b",
  "--gd-ui-accent": "#2563eb",
  "--gd-ui-accent-strong": "#1d4ed8",
  "--gd-ui-accent-deeper": "#1e40af",
  "--gd-ui-accent-text": "#1e3a8a",
  "--gd-ui-accent-bg": "#dbeafe",
  "--gd-ui-accent-bg-soft": "#eef4fb",
  "--gd-ui-accent-bg-strong": "#eff6ff",
  "--gd-ui-preview-stroke": "#0ea5e9",
  "--gd-ui-preview-stroke-strong": "#0284c7",
  "--gd-ui-preview-fill-soft": "rgba(14, 165, 233, 0.08)",
  "--gd-ui-preview-fill": "rgba(14, 165, 233, 0.18)",
  "--gd-ui-preview-fill-strong": "rgba(14, 165, 233, 0.95)",
  "--gd-ui-preview-snap-stroke": "#f97316",
  "--gd-ui-preview-line-width": "1.3",
  "--gd-ui-danger": "#ef4444",
  "--gd-ui-danger-text": "#b91c1c",
  "--gd-ui-success-text": "#0f766e",
  "--gd-ui-icon-tone": "#475569",
  "--gd-ui-icon-tone-strong": "#334155",
  "--gd-ui-title-tone": "#64748b",
  "--gd-ui-focus-outline": "rgba(37, 99, 235, 0.26)",
  "--gd-ui-focus-outline-strong": "rgba(37, 99, 235, 0.34)",
  "--gd-ui-accent-ring": "rgba(37, 99, 235, 0.22)",
  "--gd-ui-overlay-hover": "rgba(248, 250, 252, 0.62)",
  "--gd-ui-overlay-shadow": "rgba(15, 23, 42, 0.12)",
  "--gd-ui-resize-hover": "rgba(59, 130, 246, 0.2)",
  "--gd-ui-shadow-soft": "rgba(15, 23, 42, 0.04)",
  "--gd-ui-shadow": "rgba(15, 23, 42, 0.1)",
  "--gd-ui-shadow-strong": "rgba(15, 23, 42, 0.16)",
  "--gd-ui-glass-bg": "rgba(255, 255, 255, 0.95)",
  "--gd-ui-glass-bg-strong": "rgba(255, 255, 255, 0.97)",
} as const;

export type UiCssVariableName = keyof typeof UI_CSS_VARIABLE_DEFAULTS;
export type UiCssVariables = Record<UiCssVariableName, string>;
export const UI_CSS_VARIABLE_KEYS = Object.keys(UI_CSS_VARIABLE_DEFAULTS) as UiCssVariableName[];

const UI_CSS_VARIABLE_PROFILE_OVERRIDES: Record<UiColorProfileId, Partial<UiCssVariables>> = {
  vanilla: {},
  grayscale: {
    "--gd-ui-app-text": "#111111",
    "--gd-ui-app-bg": "#f5f5f5",
    "--gd-ui-toolbar-bg": "#efefef",
    "--gd-ui-sidebar-bg": "#f4f4f4",
    "--gd-ui-canvas-bg": "#ffffff",
    "--gd-ui-surface": "#ffffff",
    "--gd-ui-surface-soft": "#f3f4f6",
    "--gd-ui-surface-muted": "#eceff2",
    "--gd-ui-surface-elevated": "#f8f8f8",
    "--gd-ui-border": "#c5c9cf",
    "--gd-ui-border-soft": "#d9dde3",
    "--gd-ui-border-panel": "#d2d7df",
    "--gd-ui-border-strong": "#8f98a7",
    "--gd-ui-text-strong": "#111111",
    "--gd-ui-text": "#1f2937",
    "--gd-ui-text-muted": "#374151",
    "--gd-ui-text-subtle": "#4b5563",
    "--gd-ui-accent": "#1f2937",
    "--gd-ui-accent-strong": "#111827",
    "--gd-ui-accent-deeper": "#0f172a",
    "--gd-ui-accent-text": "#0f172a",
    "--gd-ui-accent-bg": "#e5e7eb",
    "--gd-ui-accent-bg-soft": "#eef0f2",
    "--gd-ui-accent-bg-strong": "#f3f4f6",
    "--gd-ui-preview-stroke": "#4b5563",
    "--gd-ui-preview-stroke-strong": "#1f2937",
    "--gd-ui-preview-fill-soft": "rgba(75, 85, 99, 0.08)",
    "--gd-ui-preview-fill": "rgba(75, 85, 99, 0.18)",
    "--gd-ui-preview-fill-strong": "rgba(31, 41, 55, 0.95)",
    "--gd-ui-preview-snap-stroke": "#6b7280",
    "--gd-ui-icon-tone": "#4b5563",
    "--gd-ui-icon-tone-strong": "#1f2937",
    "--gd-ui-title-tone": "#4b5563",
    "--gd-ui-focus-outline": "rgba(31, 41, 55, 0.24)",
    "--gd-ui-focus-outline-strong": "rgba(31, 41, 55, 0.32)",
    "--gd-ui-accent-ring": "rgba(31, 41, 55, 0.22)",
    "--gd-ui-overlay-hover": "rgba(255, 255, 255, 0.58)",
    "--gd-ui-resize-hover": "rgba(31, 41, 55, 0.2)",
    "--gd-ui-shadow-soft": "rgba(0, 0, 0, 0.03)",
    "--gd-ui-shadow": "rgba(0, 0, 0, 0.08)",
    "--gd-ui-shadow-strong": "rgba(0, 0, 0, 0.14)",
  },
  beige: {
    "--gd-ui-app-text": "#3d352b",
    "--gd-ui-app-bg": "#f5f1e6",
    "--gd-ui-toolbar-bg": "#efe7d6",
    "--gd-ui-sidebar-bg": "#f3ecdc",
    "--gd-ui-canvas-bg": "#f5f1e6",
    "--gd-ui-surface": "#fffaf0",
    "--gd-ui-surface-soft": "#f8f1e2",
    "--gd-ui-surface-muted": "#ede2cd",
    "--gd-ui-surface-elevated": "#fbf5e8",
    "--gd-ui-border": "#cbbca3",
    "--gd-ui-border-soft": "#ddcfb8",
    "--gd-ui-border-panel": "#d4c5ad",
    "--gd-ui-border-strong": "#9f8b6e",
    "--gd-ui-text-strong": "#2e271f",
    "--gd-ui-text": "#3d352b",
    "--gd-ui-text-muted": "#5a4c3d",
    "--gd-ui-text-subtle": "#6f5f4c",
    "--gd-ui-accent": "#8a5a2b",
    "--gd-ui-accent-strong": "#7a4f24",
    "--gd-ui-accent-deeper": "#623f1e",
    "--gd-ui-accent-text": "#4e3318",
    "--gd-ui-accent-bg": "#ecd8b4",
    "--gd-ui-accent-bg-soft": "#f3e4c8",
    "--gd-ui-accent-bg-strong": "#f8ead2",
    "--gd-ui-preview-stroke": "#8a5a2b",
    "--gd-ui-preview-stroke-strong": "#7a4f24",
    "--gd-ui-preview-fill-soft": "rgba(138, 90, 43, 0.08)",
    "--gd-ui-preview-fill": "rgba(138, 90, 43, 0.18)",
    "--gd-ui-preview-fill-strong": "rgba(122, 79, 36, 0.95)",
    "--gd-ui-preview-snap-stroke": "#d97706",
    "--gd-ui-icon-tone": "#81684b",
    "--gd-ui-icon-tone-strong": "#624a33",
    "--gd-ui-title-tone": "#7a6546",
    "--gd-ui-focus-outline": "rgba(122, 79, 36, 0.28)",
    "--gd-ui-focus-outline-strong": "rgba(122, 79, 36, 0.36)",
    "--gd-ui-accent-ring": "rgba(122, 79, 36, 0.24)",
    "--gd-ui-overlay-hover": "rgba(255, 250, 240, 0.55)",
    "--gd-ui-overlay-shadow": "rgba(59, 43, 24, 0.08)",
    "--gd-ui-resize-hover": "rgba(122, 79, 36, 0.2)",
    "--gd-ui-shadow-soft": "rgba(59, 43, 24, 0.04)",
    "--gd-ui-shadow": "rgba(59, 43, 24, 0.1)",
    "--gd-ui-shadow-strong": "rgba(59, 43, 24, 0.16)",
    "--gd-ui-glass-bg": "rgba(255, 250, 240, 0.95)",
    "--gd-ui-glass-bg-strong": "rgba(255, 250, 240, 0.97)",
  },
  dark: {
    "--gd-ui-app-text": "#e5e7eb",
    "--gd-ui-app-bg": "#0b1220",
    "--gd-ui-toolbar-bg": "#0f172a",
    "--gd-ui-sidebar-bg": "#111827",
    "--gd-ui-canvas-bg": "#0f172a",
    "--gd-ui-surface": "#111827",
    "--gd-ui-surface-soft": "#1f2937",
    "--gd-ui-surface-muted": "#0f172a",
    "--gd-ui-surface-elevated": "#1b2434",
    "--gd-ui-border": "#334155",
    "--gd-ui-border-soft": "#3b4759",
    "--gd-ui-border-panel": "#2a3648",
    "--gd-ui-border-strong": "#64748b",
    "--gd-ui-text-strong": "#f8fafc",
    "--gd-ui-text": "#e2e8f0",
    "--gd-ui-text-muted": "#cbd5e1",
    "--gd-ui-text-subtle": "#94a3b8",
    "--gd-ui-accent": "#60a5fa",
    "--gd-ui-accent-strong": "#3b82f6",
    "--gd-ui-accent-deeper": "#2563eb",
    "--gd-ui-accent-text": "#dbeafe",
    "--gd-ui-accent-bg": "#1e3a8a",
    "--gd-ui-accent-bg-soft": "#1f3765",
    "--gd-ui-accent-bg-strong": "#27457a",
    "--gd-ui-preview-stroke": "#38bdf8",
    "--gd-ui-preview-stroke-strong": "#0ea5e9",
    "--gd-ui-preview-fill-soft": "rgba(56, 189, 248, 0.12)",
    "--gd-ui-preview-fill": "rgba(56, 189, 248, 0.26)",
    "--gd-ui-preview-fill-strong": "rgba(14, 165, 233, 0.95)",
    "--gd-ui-preview-snap-stroke": "#fb923c",
    "--gd-ui-danger-text": "#fca5a5",
    "--gd-ui-success-text": "#5eead4",
    "--gd-ui-icon-tone": "#cbd5e1",
    "--gd-ui-icon-tone-strong": "#f8fafc",
    "--gd-ui-title-tone": "#94a3b8",
    "--gd-ui-focus-outline": "rgba(96, 165, 250, 0.34)",
    "--gd-ui-focus-outline-strong": "rgba(96, 165, 250, 0.44)",
    "--gd-ui-accent-ring": "rgba(96, 165, 250, 0.3)",
    "--gd-ui-overlay-hover": "rgba(15, 23, 42, 0.54)",
    "--gd-ui-overlay-shadow": "rgba(2, 6, 23, 0.55)",
    "--gd-ui-resize-hover": "rgba(56, 189, 248, 0.28)",
    "--gd-ui-shadow-soft": "rgba(0, 0, 0, 0.35)",
    "--gd-ui-shadow": "rgba(0, 0, 0, 0.48)",
    "--gd-ui-shadow-strong": "rgba(0, 0, 0, 0.6)",
    "--gd-ui-glass-bg": "rgba(15, 23, 42, 0.92)",
    "--gd-ui-glass-bg-strong": "rgba(15, 23, 42, 0.96)",
  },
};

export const UI_COLOR_PROFILE_OPTIONS: ReadonlyArray<{ id: UiColorProfileId; label: string }> = [
  { id: "vanilla", label: "Vanilla" },
  { id: "grayscale", label: "Grayscale" },
  { id: "beige", label: "Beige" },
  { id: "dark", label: "Dark Mode" },
] as const;

const RECOMMENDED_UI_PROFILE_BY_COLOR_PROFILE: Record<ColorProfileId, UiColorProfileId> = {
  classic: "vanilla",
  grayscale_white_dot: "grayscale",
  beige_light: "beige",
  dark_mode: "dark",
};

export function getRecommendedUiProfileForColorProfile(profileId: ColorProfileId): UiColorProfileId {
  return RECOMMENDED_UI_PROFILE_BY_COLOR_PROFILE[profileId] ?? DEFAULT_UI_COLOR_PROFILE_ID;
}

type UiProfileSwatch = {
  background: string;
  line: string;
  fill: string;
  dotFill: string;
  dotStroke: string;
};

const UI_COLOR_PROFILE_SWATCHES: Record<UiColorProfileId, UiProfileSwatch> = {
  vanilla: {
    background: "#f3f5f8",
    line: "#334155",
    fill: "#dbeafe",
    dotFill: "#60a5fa",
    dotStroke: "#0f172a",
  },
  grayscale: {
    background: "#f5f5f5",
    line: "#1f2937",
    fill: "#e5e7eb",
    dotFill: "#ffffff",
    dotStroke: "#111111",
  },
  beige: {
    background: "#f5f1e6",
    line: "#3d352b",
    fill: "#ecd8b4",
    dotFill: "#fffaf0",
    dotStroke: "#3d352b",
  },
  dark: {
    background: "#0f172a",
    line: "#e2e8f0",
    fill: "#1e3a8a",
    dotFill: "#111827",
    dotStroke: "#f8fafc",
  },
};

const COLOR_PROFILES: readonly ColorProfile[] = [
  {
    id: "classic",
    label: "Classic",
    palette: {
      backgroundColor: "#ffffff",
      gridMinorColor: "#000000",
      gridMajorColor: "#000000",
      axisColor: "#334155",
      pointStroke: "#0f172a",
      pointFill: "#60a5fa",
      pointLabel: "#0f172a",
      pointLabelHalo: "#ffffff",
      segmentStroke: "#0f766e",
      lineStroke: "#334155",
      circleStroke: "#334155",
      polygonStroke: "#334155",
      polygonFill: "#93c5fd",
      angleStroke: "#334155",
      angleText: "#0f172a",
      angleFill: "#93c5fd",
      angleMark: "#334155",
      arrow: "#334155",
      marking: "#334155",
    },
  },
  {
    id: "grayscale_white_dot",
    label: "Grayscale - White Dot",
    palette: {
      backgroundColor: "#ffffff",
      gridMinorColor: "#000000",
      gridMajorColor: "#000000",
      axisColor: "#000000",
      pointStroke: "#000000",
      pointFill: "#ffffff",
      pointLabel: "#000000",
      pointLabelHalo: "#ffffff",
      segmentStroke: "#000000",
      lineStroke: "#000000",
      circleStroke: "#000000",
      polygonStroke: "#000000",
      polygonFill: "#bfbfbf",
      angleStroke: "#000000",
      angleText: "#000000",
      angleFill: "#bfbfbf",
      angleMark: "#000000",
      arrow: "#000000",
      marking: "#000000",
    },
  },
  {
    id: "beige_light",
    label: "Beige - Light",
    palette: {
      backgroundColor: "#f5f1e6",
      gridMinorColor: "#7a6a52",
      gridMajorColor: "#6a5944",
      axisColor: "#4f4638",
      pointStroke: "#000000",
      pointFill: "#ffffff",
      pointLabel: "#000000",
      pointLabelHalo: "#f5f1e6",
      segmentStroke: "#000000",
      lineStroke: "#000000",
      circleStroke: "#000000",
      polygonStroke: "#000000",
      polygonFill: "#e7dcc8",
      angleStroke: "#000000",
      angleText: "#000000",
      angleFill: "#e7dcc8",
      angleMark: "#000000",
      arrow: "#000000",
      marking: "#000000",
    },
  },
  {
    id: "dark_mode",
    label: "Dark Mode",
    palette: {
      backgroundColor: "#0f141d",
      gridMinorColor: "#293447",
      gridMajorColor: "#3e4d66",
      axisColor: "#94a3b8",
      pointStroke: "#e2e8f0",
      pointFill: "#0f141d",
      pointLabel: "#f8fafc",
      pointLabelHalo: "#0f141d",
      segmentStroke: "#e2e8f0",
      lineStroke: "#cbd5e1",
      circleStroke: "#cbd5e1",
      polygonStroke: "#cbd5e1",
      polygonFill: "#22b8e6",
      angleStroke: "#cbd5e1",
      angleText: "#f8fafc",
      angleFill: "#22b8e6",
      angleMark: "#cbd5e1",
      arrow: "#e2e8f0",
      marking: "#e2e8f0",
    },
  },
] as const;

export const COLOR_PROFILE_OPTIONS: ReadonlyArray<{ id: ColorProfileId; label: string }> = COLOR_PROFILES.map((profile) => ({
  id: profile.id,
  label: profile.label,
}));

export function getColorProfile(profileId: ColorProfileId): ColorProfile {
  const found = COLOR_PROFILES.find((profile) => profile.id === profileId);
  return found ?? COLOR_PROFILES[0];
}

export function getCanvasColorTheme(profileId: ColorProfileId, overrides?: Partial<CanvasColorTheme>): CanvasColorTheme {
  const palette = getColorProfile(profileId).palette;
  const base: CanvasColorTheme = {
    backgroundColor: palette.backgroundColor,
    gridMinorColor: palette.gridMinorColor,
    gridMajorColor: palette.gridMajorColor,
    axisColor: palette.axisColor,
  };
  if (!overrides) return base;
  return {
    backgroundColor: normalizeCanvasColorOverride(overrides.backgroundColor, base.backgroundColor),
    gridMinorColor: normalizeCanvasColorOverride(overrides.gridMinorColor, base.gridMinorColor),
    gridMajorColor: normalizeCanvasColorOverride(overrides.gridMajorColor, base.gridMajorColor),
    axisColor: normalizeCanvasColorOverride(overrides.axisColor, base.axisColor),
  };
}

export function getUiProfileBaseVariables(profileId: UiColorProfileId): UiCssVariables {
  const overrides = UI_CSS_VARIABLE_PROFILE_OVERRIDES[profileId] ?? {};
  return {
    ...UI_CSS_VARIABLE_DEFAULTS,
    ...overrides,
  };
}

export function getUiCssVariables(
  profileId: UiColorProfileId,
  customOverrides?: Partial<UiCssVariables>
): UiCssVariables {
  const base = getUiProfileBaseVariables(profileId);
  if (!customOverrides) return base;
  const merged: UiCssVariables = { ...base };
  for (const key of UI_CSS_VARIABLE_KEYS) {
    const value = customOverrides[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized) continue;
    merged[key] = normalized;
  }
  return merged;
}

export function getUiColorProfileSwatch(profileId: UiColorProfileId): UiProfileSwatch {
  return UI_COLOR_PROFILE_SWATCHES[profileId] ?? UI_COLOR_PROFILE_SWATCHES[DEFAULT_UI_COLOR_PROFILE_ID];
}

export function buildDefaultStylesForProfile(profileId: ColorProfileId): SceneStyleDefaults {
  const palette = getColorProfile(profileId).palette;
  return {
    pointDefaults: {
      shape: "circle",
      sizePx: 6,
      strokeColor: palette.pointStroke,
      strokeWidth: 1.7,
      strokeOpacity: 1,
      fillColor: palette.pointFill,
      fillOpacity: 1,
      labelFontPx: 18,
      labelHaloWidthPx: 3.5,
      labelHaloColor: palette.pointLabelHalo,
      labelColor: palette.pointLabel,
      labelOffsetPx: { x: 8, y: -8 },
    },
    segmentDefaults: {
      strokeColor: palette.segmentStroke,
      strokeWidth: 2,
      dash: "solid",
      opacity: 1,
      segmentMark: {
        enabled: false,
        mark: "none",
        pos: 0.5,
        sizePt: 4,
        color: palette.marking,
      },
      segmentArrowMark: {
        enabled: false,
        mode: "end",
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
        color: palette.arrow,
      },
    },
    lineDefaults: {
      strokeColor: palette.lineStroke,
      strokeWidth: 1.6,
      dash: "solid",
      opacity: 1,
    },
    circleDefaults: {
      strokeColor: palette.circleStroke,
      strokeWidth: 1.6,
      strokeDash: "solid",
      strokeOpacity: 1,
      fillOpacity: 0,
      pattern: "",
      arrowMark: {
        enabled: false,
        direction: "->",
        tip: "Stealth",
        distribution: "single",
        pos: 0.5,
        startPos: 0.45,
        endPos: 0.55,
        step: 0.05,
        sizeScale: DEFAULT_PATH_ARROW_UI,
        lineWidthPt: DEFAULT_PATH_ARROW_LINE_WIDTH_PT,
        color: palette.arrow,
      },
    },
    polygonDefaults: {
      strokeColor: palette.polygonStroke,
      strokeWidth: 1.6,
      strokeDash: "solid",
      strokeOpacity: 1,
      fillColor: palette.polygonFill,
      fillOpacity: 0.22,
      pattern: "",
    },
    angleDefaults: {
      strokeColor: palette.angleStroke,
      strokeWidth: 1,
      strokeDash: "solid",
      strokeOpacity: 1,
      textColor: palette.angleText,
      textSize: 16,
      fillEnabled: false,
      fillColor: palette.angleFill,
      fillOpacity: 0.2,
      pattern: "",
      markStyle: "arc",
      markSymbol: "none",
      arcMultiplicity: 1,
      markPos: 0.5,
      markSize: 7.4,
      markColor: palette.angleMark,
      arcRadius: 1.95,
      labelText: "",
      labelPosWorld: { x: 0, y: 0 },
      showLabel: true,
      showValue: true,
      promoteToSolid: false,
      arcArrowMark: {
        enabled: false,
        direction: "->",
        tip: "Stealth",
        distribution: "single",
        pos: 0.5,
        startPos: 0.45,
        endPos: 0.55,
        step: 0.05,
        sizeScale: DEFAULT_PATH_ARROW_UI,
        lineWidthPt: DEFAULT_PATH_ARROW_LINE_WIDTH_PT,
        color: palette.arrow,
      },
    },
  };
}

export function applyProfileColorsToDefaults(defaults: SceneStyleDefaults, profileId: ColorProfileId): SceneStyleDefaults {
  const palette = getColorProfile(profileId).palette;
  return {
    pointDefaults: {
      ...defaults.pointDefaults,
      strokeColor: palette.pointStroke,
      fillColor: palette.pointFill,
      labelColor: palette.pointLabel,
      labelHaloColor: palette.pointLabelHalo,
      labelOffsetPx: { ...defaults.pointDefaults.labelOffsetPx },
    },
    segmentDefaults: {
      ...defaults.segmentDefaults,
      strokeColor: palette.segmentStroke,
      segmentMark: defaults.segmentDefaults.segmentMark
        ? { ...defaults.segmentDefaults.segmentMark, color: palette.marking }
        : defaults.segmentDefaults.segmentMark,
      segmentMarks: defaults.segmentDefaults.segmentMarks?.map((mark) => ({
        ...mark,
        color: mark.color === undefined ? undefined : palette.marking,
      })),
      segmentArrowMark: defaults.segmentDefaults.segmentArrowMark
        ? { ...defaults.segmentDefaults.segmentArrowMark, color: palette.arrow }
        : defaults.segmentDefaults.segmentArrowMark,
      segmentArrowMarks: defaults.segmentDefaults.segmentArrowMarks?.map((arrow) => ({
        ...arrow,
        color: palette.arrow,
      })),
    },
    lineDefaults: {
      ...defaults.lineDefaults,
      strokeColor: palette.lineStroke,
    },
    circleDefaults: {
      ...defaults.circleDefaults,
      strokeColor: palette.circleStroke,
      fillColor: defaults.circleDefaults.fillColor === undefined ? undefined : palette.polygonFill,
      arrowMark: defaults.circleDefaults.arrowMark
        ? { ...defaults.circleDefaults.arrowMark, color: palette.arrow }
        : defaults.circleDefaults.arrowMark,
      arrowMarks: defaults.circleDefaults.arrowMarks?.map((arrow) => ({ ...arrow, color: palette.arrow })),
    },
    polygonDefaults: {
      ...defaults.polygonDefaults,
      strokeColor: palette.polygonStroke,
      fillColor: defaults.polygonDefaults.fillColor === undefined ? undefined : palette.polygonFill,
      arrowMark: defaults.polygonDefaults.arrowMark
        ? { ...defaults.polygonDefaults.arrowMark, color: palette.arrow }
        : defaults.polygonDefaults.arrowMark,
    },
    angleDefaults: {
      ...defaults.angleDefaults,
      strokeColor: palette.angleStroke,
      textColor: palette.angleText,
      fillColor: palette.angleFill,
      markColor: palette.angleMark,
      labelPosWorld: { ...defaults.angleDefaults.labelPosWorld },
      angleMarks: defaults.angleDefaults.angleMarks?.map((mark) => ({
        ...mark,
        markColor: mark.markColor === undefined ? undefined : palette.angleMark,
      })),
      arcArrowMark: defaults.angleDefaults.arcArrowMark
        ? { ...defaults.angleDefaults.arcArrowMark, color: palette.arrow }
        : defaults.angleDefaults.arcArrowMark,
      arcArrowMarks: defaults.angleDefaults.arcArrowMarks?.map((arrow) => ({ ...arrow, color: palette.arrow })),
    },
  };
}

export function recolorSceneForProfile(scene: SceneModel, fromProfileId: ColorProfileId, toProfileId: ColorProfileId): SceneModel {
  if (fromProfileId === toProfileId) return scene;
  const fromPalette = getColorProfile(fromProfileId).palette;
  const toPalette = getColorProfile(toProfileId).palette;
  const colorMap = buildColorRemap(fromPalette, toPalette);

  return {
    ...scene,
    points: scene.points.map((point) => ({
      ...point,
      style: {
        ...point.style,
        strokeColor: remapColor(point.style.strokeColor, colorMap),
        fillColor: remapColor(point.style.fillColor, colorMap),
        labelColor: remapColor(point.style.labelColor, colorMap),
        labelHaloColor: remapColor(point.style.labelHaloColor, colorMap),
        labelOffsetPx: { ...point.style.labelOffsetPx },
      },
    })),
    segments: scene.segments.map((segment) => ({
      ...segment,
      style: {
        ...segment.style,
        strokeColor: remapColor(segment.style.strokeColor, colorMap),
        segmentMark: segment.style.segmentMark
          ? {
            ...segment.style.segmentMark,
            color: remapOptionalColor(segment.style.segmentMark.color, colorMap),
          }
          : segment.style.segmentMark,
        segmentMarks: segment.style.segmentMarks?.map((mark) => ({
          ...mark,
          color: remapOptionalColor(mark.color, colorMap),
        })),
        segmentArrowMark: remapArrowMark(segment.style.segmentArrowMark, colorMap),
        segmentArrowMarks: segment.style.segmentArrowMarks?.map((arrow) => remapArrowMark(arrow, colorMap)),
      },
    })),
    lines: scene.lines.map((line) => ({
      ...line,
      style: {
        ...line.style,
        strokeColor: remapColor(line.style.strokeColor, colorMap),
      },
    })),
    circles: scene.circles.map((circle) => ({
      ...circle,
      style: {
        ...circle.style,
        strokeColor: remapColor(circle.style.strokeColor, colorMap),
        fillColor: remapOptionalColor(circle.style.fillColor, colorMap),
        patternColor: remapOptionalColor(circle.style.patternColor, colorMap),
        arrowMark: remapArrowMark(circle.style.arrowMark, colorMap),
        arrowMarks: circle.style.arrowMarks?.map((arrow) => remapArrowMark(arrow, colorMap)),
      },
    })),
    polygons: scene.polygons.map((polygon) => ({
      ...polygon,
      style: {
        ...polygon.style,
        strokeColor: remapColor(polygon.style.strokeColor, colorMap),
        fillColor: remapOptionalColor(polygon.style.fillColor, colorMap),
        patternColor: remapOptionalColor(polygon.style.patternColor, colorMap),
        arrowMark: remapArrowMark(polygon.style.arrowMark, colorMap),
      },
    })),
    angles: scene.angles.map((angle) => ({
      ...angle,
      style: {
        ...angle.style,
        strokeColor: remapColor(angle.style.strokeColor, colorMap),
        textColor: remapColor(angle.style.textColor, colorMap),
        fillColor: remapColor(angle.style.fillColor, colorMap),
        patternColor: remapOptionalColor(angle.style.patternColor, colorMap),
        markColor: remapColor(angle.style.markColor, colorMap),
        angleMarks: angle.style.angleMarks?.map((mark) => ({
          ...mark,
          markColor: remapOptionalColor(mark.markColor, colorMap),
        })),
        labelPosWorld: { ...angle.style.labelPosWorld },
        arcArrowMark: remapArrowMark(angle.style.arcArrowMark, colorMap),
        arcArrowMarks: angle.style.arcArrowMarks?.map((arrow) => remapArrowMark(arrow, colorMap)),
      },
    })),
    textLabels: (scene.textLabels ?? []).map((label) => ({
      ...label,
      style: {
        ...label.style,
        textColor: remapColor(label.style.textColor, colorMap),
      },
    })),
    numbers: [...scene.numbers],
    vectors: scene.vectors ? [...scene.vectors] : undefined,
  };
}

function remapArrowMark<T extends PathArrowMark | undefined>(arrow: T, colorMap: Map<string, string>): T {
  if (!arrow) return arrow;
  return {
    ...arrow,
    color: remapOptionalColor(arrow.color, colorMap),
  };
}

function buildColorRemap(fromPalette: ColorProfilePalette, toPalette: ColorProfilePalette): Map<string, string> {
  const pairs: Array<[string, string]> = [
    [fromPalette.pointStroke, toPalette.pointStroke],
    [fromPalette.pointFill, toPalette.pointFill],
    [fromPalette.pointLabel, toPalette.pointLabel],
    [fromPalette.pointLabelHalo, toPalette.pointLabelHalo],
    [fromPalette.segmentStroke, toPalette.segmentStroke],
    [fromPalette.lineStroke, toPalette.lineStroke],
    [fromPalette.circleStroke, toPalette.circleStroke],
    [fromPalette.polygonStroke, toPalette.polygonStroke],
    [fromPalette.polygonFill, toPalette.polygonFill],
    [fromPalette.angleStroke, toPalette.angleStroke],
    [fromPalette.angleText, toPalette.angleText],
    [fromPalette.angleFill, toPalette.angleFill],
    [fromPalette.angleMark, toPalette.angleMark],
    [fromPalette.arrow, toPalette.arrow],
    [fromPalette.marking, toPalette.marking],
  ];
  const colorMap = new Map<string, string>();
  for (const [from, to] of pairs) {
    const fromKey = normalizeColorToken(from);
    const toValue = to.trim();
    if (!fromKey || !toValue) continue;
    if (!colorMap.has(fromKey)) {
      colorMap.set(fromKey, toValue);
      continue;
    }
    if (normalizeColorToken(colorMap.get(fromKey) ?? "") === normalizeColorToken(toValue)) continue;
  }
  return colorMap;
}

function remapColor(color: string, colorMap: Map<string, string>): string {
  const mapped = colorMap.get(normalizeColorToken(color));
  return mapped ?? color;
}

function remapOptionalColor(color: string | undefined, colorMap: Map<string, string>): string | undefined {
  if (!color) return color;
  return remapColor(color, colorMap);
}

function normalizeColorToken(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}

function normalizeCanvasColorOverride(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}
