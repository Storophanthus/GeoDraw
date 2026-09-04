import type {
  AngleStyle,
  CircleStyle,
  LineStyle,
  PathArrowMark,
  PointStyle,
  PolygonStyle,
  SceneModel,
  SceneTextLabelStyle,
} from "../scene/points";
import type { RichTextStyle } from "../text-editor/richTextModel";

export type ColorProfileId =
  | "classic"
  | "grayscale_white_dot"
  | "beige_light"
  | "dark_mode"
  | "image_palette"
  | "image_palette_vanilla_thin";
export type UiColorProfileId = "vanilla" | "grayscale" | "beige" | "dark" | "image" | "image_palette";

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
  ellipseDefaults: CircleStyle;
  polygonDefaults: PolygonStyle;
  angleDefaults: AngleStyle;
  labelToolDefaults: SceneTextLabelStyle;
  textboxToolDefaults: SceneTextLabelStyle;
  richTextToolDefaults: RichTextStyle;
};

export const DEFAULT_COLOR_PROFILE_ID: ColorProfileId = "beige_light";
export const DEFAULT_UI_COLOR_PROFILE_ID: UiColorProfileId = "beige";

const DEFAULT_PATH_ARROW_UI = 1.0;
const DEFAULT_PATH_ARROW_LINE_WIDTH_PT = DEFAULT_PATH_ARROW_UI * 8;
const VANILLA_THIN_PROFILE_ID = "image_palette_vanilla_thin";
const LIGHT_CANVAS_LABEL_COLORS = new Set([
  "#fff",
  "#ffffff",
  "#fefefe",
  "rgb(255,255,255)",
  "white",
]);
const THIN_PROFILE_STROKE_WIDTHS = {
  pointStrokeWidth: 1.4,
  segmentStrokeWidth: 1.5,
  lineStrokeWidth: 1.25,
  circleStrokeWidth: 1.25,
  ellipseStrokeWidth: 1.25,
  polygonStrokeWidth: 1.25,
  angleStrokeWidth: 0.88,
  segmentMarkSizePt: 6.2,
  angleMarkSize: 6.1,
  arrowLineWidthPt: 6,
} as const;

function withVanillaThinStyle(defaults: SceneStyleDefaults): SceneStyleDefaults {
  const arrowLineWidthPt = THIN_PROFILE_STROKE_WIDTHS.arrowLineWidthPt;
  return {
    ...defaults,
    pointDefaults: {
      ...defaults.pointDefaults,
      strokeWidth: THIN_PROFILE_STROKE_WIDTHS.pointStrokeWidth,
    },
    segmentDefaults: {
      ...defaults.segmentDefaults,
      strokeWidth: THIN_PROFILE_STROKE_WIDTHS.segmentStrokeWidth,
      segmentMark: defaults.segmentDefaults.segmentMark
        ? {
            ...defaults.segmentDefaults.segmentMark,
            sizePt: THIN_PROFILE_STROKE_WIDTHS.segmentMarkSizePt,
            lineWidthPt: arrowLineWidthPt,
          }
        : defaults.segmentDefaults.segmentMark,
      segmentMarks: defaults.segmentDefaults.segmentMarks?.map((mark) => ({
        ...mark,
        sizePt: THIN_PROFILE_STROKE_WIDTHS.segmentMarkSizePt,
      })),
      segmentArrowMark: defaults.segmentDefaults.segmentArrowMark
        ? {
            ...defaults.segmentDefaults.segmentArrowMark,
            lineWidthPt: arrowLineWidthPt,
          }
        : defaults.segmentDefaults.segmentArrowMark,
      segmentArrowMarks: defaults.segmentDefaults.segmentArrowMarks?.map((mark) => ({
        ...mark,
        lineWidthPt: arrowLineWidthPt,
      })),
    },
    lineDefaults: {
      ...defaults.lineDefaults,
      strokeWidth: THIN_PROFILE_STROKE_WIDTHS.lineStrokeWidth,
    },
    circleDefaults: {
      ...defaults.circleDefaults,
      strokeWidth: THIN_PROFILE_STROKE_WIDTHS.circleStrokeWidth,
      arrowMark: defaults.circleDefaults.arrowMark
        ? {
            ...defaults.circleDefaults.arrowMark,
            lineWidthPt: arrowLineWidthPt,
          }
        : defaults.circleDefaults.arrowMark,
      arrowMarks: defaults.circleDefaults.arrowMarks?.map((mark) => ({
        ...mark,
        lineWidthPt: arrowLineWidthPt,
      })),
    },
    ellipseDefaults: {
      ...defaults.ellipseDefaults,
      strokeWidth: THIN_PROFILE_STROKE_WIDTHS.ellipseStrokeWidth,
      arrowMark: defaults.ellipseDefaults.arrowMark
        ? {
            ...defaults.ellipseDefaults.arrowMark,
            lineWidthPt: arrowLineWidthPt,
          }
        : defaults.ellipseDefaults.arrowMark,
      arrowMarks: defaults.ellipseDefaults.arrowMarks?.map((mark) => ({
        ...mark,
        lineWidthPt: arrowLineWidthPt,
      })),
    },
    polygonDefaults: {
      ...defaults.polygonDefaults,
      strokeWidth: THIN_PROFILE_STROKE_WIDTHS.polygonStrokeWidth,
    },
    angleDefaults: {
      ...defaults.angleDefaults,
      strokeWidth: THIN_PROFILE_STROKE_WIDTHS.angleStrokeWidth,
      markSize: THIN_PROFILE_STROKE_WIDTHS.angleMarkSize,
      arcArrowMark: defaults.angleDefaults.arcArrowMark
        ? {
            ...defaults.angleDefaults.arcArrowMark,
            lineWidthPt: arrowLineWidthPt,
          }
        : defaults.angleDefaults.arcArrowMark,
      arcArrowMarks: defaults.angleDefaults.arcArrowMarks?.map((mark) => ({
        ...mark,
        lineWidthPt: arrowLineWidthPt,
      })),
    },
  };
}

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

const IMAGE_THEME_UI_OVERRIDES: Partial<UiCssVariables> = {
  "--gd-ui-app-text": "#292036",
  "--gd-ui-app-bg": "#fefefe",
  "--gd-ui-toolbar-bg": "#fcf5eb",
  "--gd-ui-sidebar-bg": "#f9efde",
  "--gd-ui-canvas-bg": "#fefefe",
  "--gd-ui-surface": "#fffdf9",
  "--gd-ui-surface-soft": "#f4e9d7",
  "--gd-ui-surface-muted": "#e9d8bf",
  "--gd-ui-surface-elevated": "#f2debf",
  "--gd-ui-border": "#ccb28f",
  "--gd-ui-border-soft": "#d5bea3",
  "--gd-ui-border-panel": "#ceb79a",
  "--gd-ui-border-strong": "#8a6f52",
  "--gd-ui-text-strong": "#1b1129",
  "--gd-ui-text": "#30263a",
  "--gd-ui-text-muted": "#5b4d62",
  "--gd-ui-text-subtle": "#726679",
  "--gd-ui-accent": "#3f2f63",
  "--gd-ui-accent-strong": "#322155",
  "--gd-ui-accent-deeper": "#261545",
  "--gd-ui-accent-text": "#26174f",
  "--gd-ui-accent-bg": "#eadff7",
  "--gd-ui-accent-bg-soft": "#f3eaff",
  "--gd-ui-accent-bg-strong": "#d9c9ef",
  "--gd-ui-preview-stroke": "#3f2f63",
  "--gd-ui-preview-stroke-strong": "#2e214a",
  "--gd-ui-preview-fill-soft": "rgba(63, 47, 99, 0.16)",
  "--gd-ui-preview-fill": "rgba(63, 47, 99, 0.26)",
  "--gd-ui-preview-fill-strong": "rgba(46, 33, 74, 0.98)",
  "--gd-ui-preview-snap-stroke": "#d51315",
  "--gd-ui-icon-tone": "#554b61",
  "--gd-ui-icon-tone-strong": "#2e2248",
  "--gd-ui-title-tone": "#675a75",
  "--gd-ui-focus-outline": "rgba(63, 47, 99, 0.45)",
  "--gd-ui-focus-outline-strong": "rgba(63, 47, 99, 0.66)",
  "--gd-ui-accent-ring": "rgba(63, 47, 99, 0.4)",
  "--gd-ui-overlay-hover": "rgba(255, 244, 228, 0.62)",
  "--gd-ui-resize-hover": "rgba(63, 47, 99, 0.2)",
  "--gd-ui-shadow-soft": "rgba(73, 58, 87, 0.1)",
  "--gd-ui-shadow": "rgba(73, 58, 87, 0.2)",
  "--gd-ui-shadow-strong": "rgba(73, 58, 87, 0.34)",
  "--gd-ui-glass-bg": "rgba(255, 251, 246, 0.94)",
  "--gd-ui-glass-bg-strong": "rgba(255, 246, 238, 0.98)",
};

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
  image_palette: IMAGE_THEME_UI_OVERRIDES,
  image: IMAGE_THEME_UI_OVERRIDES,
};

export const UI_COLOR_PROFILE_OPTIONS: ReadonlyArray<{ id: UiColorProfileId; label: string }> = [
  { id: "vanilla", label: "Vanilla" },
  { id: "grayscale", label: "Grayscale" },
  { id: "beige", label: "Beige" },
  { id: "dark", label: "Dark Mode" },
  { id: "image_palette", label: "Image Palette" },
] as const;

const RECOMMENDED_UI_PROFILE_BY_COLOR_PROFILE: Record<ColorProfileId, UiColorProfileId> = {
  classic: "vanilla",
  grayscale_white_dot: "grayscale",
  beige_light: "beige",
  dark_mode: "dark",
  image_palette: "image_palette",
  image_palette_vanilla_thin: "vanilla",
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
  image: {
    background: "#fefefe",
    line: "#3f2f63",
    fill: "#e19b8b",
    dotFill: "#0d0d0d",
    dotStroke: "#3f2f63",
  },
  image_palette: {
    background: "#fefefe",
    line: "#3f2f63",
    fill: "#e19b8b",
    dotFill: "#0d0d0d",
    dotStroke: "#3f2f63",
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
    id: "image_palette",
    label: "Image Palette",
    palette: {
      backgroundColor: "#fefefe",
      gridMinorColor: "#ece5d9",
      gridMajorColor: "#7a5f9a",
      axisColor: "#d51315",
      pointStroke: "#fefefe",
      pointFill: "#0d0d0d",
      pointLabel: "#2a1b56",
      pointLabelHalo: "#ffffff",
      segmentStroke: "#403963",
      lineStroke: "#4b3f6d",
      circleStroke: "#403963",
      polygonStroke: "#2c1e58",
      polygonFill: "#e8a295",
      angleStroke: "#2c1e58",
      angleText: "#2a1b56",
      angleFill: "#e8a295",
      angleMark: "#2c1e58",
      arrow: "#403963",
      marking: "#403963",
    },
  },
  {
    id: "image_palette_vanilla_thin",
    label: "Vanilla Standard",
    palette: {
      backgroundColor: "#fefefe",
      gridMinorColor: "#000000",
      gridMajorColor: "#000000",
      axisColor: "#000000",
      pointStroke: "#ffffff",
      pointFill: "#000000",
      pointLabel: "#000000",
      pointLabelHalo: "#ffffff",
      segmentStroke: "#000000",
      lineStroke: "#000000",
      circleStroke: "#000000",
      polygonStroke: "#000000",
      polygonFill: "#e8a295",
      angleStroke: "#000000",
      angleText: "#000000",
      angleFill: "#e8a295",
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

export const COLOR_PROFILE_OPTIONS: ReadonlyArray<{ id: ColorProfileId; label: string }> = COLOR_PROFILES
  .filter((profile) => profile.id !== "image_palette")
  .map((profile) => ({
    id: profile.id,
    label: profile.label,
  }));

export function getColorProfile(profileId: ColorProfileId): ColorProfile {
  const found = COLOR_PROFILES.find((profile) => profile.id === profileId);
  return found ?? COLOR_PROFILES[0];
}

/**
 * Vanilla Standard uses an almost-white canvas, so a white label is never a
 * useful retained customization. Older documents and saved defaults can still
 * contain one; migrate it back to the profile's readable label color.
 */
export function normalizeLabelColorForProfile(color: string, profileId: ColorProfileId): string {
  if (profileId !== VANILLA_THIN_PROFILE_ID) return color;
  const normalized = color.trim().toLowerCase().replace(/\s+/g, "");
  if (!LIGHT_CANVAS_LABEL_COLORS.has(normalized)) return color;
  return getColorProfile(profileId).palette.pointLabel;
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
  const defaults: SceneStyleDefaults = {
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
        sizePt: 8,
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
    ellipseDefaults: {
      strokeColor: palette.circleStroke,
      strokeWidth: 1.6,
      strokeDash: "solid",
      strokeOpacity: 1,
      fillOpacity: 0,
      pattern: "",
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
      labelGlow: false,
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
    labelToolDefaults: {
      textColor: palette.pointLabel,
      textSize: 12,
      useTex: true,
      textMode: "tex",
      textAlign: "center",
      rotationDeg: 0,
      labelGlow: false,
    },
    textboxToolDefaults: {
      textColor: palette.pointLabel,
      textSize: 12,
      useTex: false,
      textMode: "mixed",
      textAlign: "left",
      boxWidthPx: 220,
      rotationDeg: 0,
      labelGlow: false,
    },
    richTextToolDefaults: {
      textColor: palette.pointLabel,
      textSize: 16,
      textAlign: "left",
      rotationDeg: 0,
      labelGlow: false,
    },
  };

  if (profileId === VANILLA_THIN_PROFILE_ID) {
    return withVanillaThinStyle(defaults);
  }

  return defaults;
}

export function applyProfileColorsToDefaults(defaults: SceneStyleDefaults, profileId: ColorProfileId): SceneStyleDefaults {
  const palette = getColorProfile(profileId).palette;
  const recolored: SceneStyleDefaults = {
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
    ellipseDefaults: {
      ...defaults.ellipseDefaults,
      strokeColor: palette.circleStroke,
      fillColor: defaults.ellipseDefaults.fillColor === undefined ? undefined : palette.polygonFill,
      patternColor: defaults.ellipseDefaults.patternColor === undefined ? undefined : palette.polygonFill,
      arrowMark: defaults.ellipseDefaults.arrowMark
        ? { ...defaults.ellipseDefaults.arrowMark, color: palette.arrow }
        : defaults.ellipseDefaults.arrowMark,
      arrowMarks: defaults.ellipseDefaults.arrowMarks?.map((arrow) => ({ ...arrow, color: palette.arrow })),
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
    labelToolDefaults: {
      ...defaults.labelToolDefaults,
      textColor: palette.pointLabel,
    },
    textboxToolDefaults: {
      ...defaults.textboxToolDefaults,
      textColor: palette.pointLabel,
    },
    richTextToolDefaults: {
      ...defaults.richTextToolDefaults,
      textColor: palette.pointLabel,
    },
  };

  if (profileId === VANILLA_THIN_PROFILE_ID) {
    return withVanillaThinStyle(recolored);
  }

  return recolored;
}

/**
 * Migrates saved Vanilla Standard defaults that still carry the legacy image
 * palette. Exact palette matches are updated; user-chosen custom colors remain
 * untouched.
 */
export function normalizeStyleDefaultsForProfile(
  defaults: SceneStyleDefaults,
  profileId: ColorProfileId
): SceneStyleDefaults {
  if (profileId !== VANILLA_THIN_PROFILE_ID) return defaults;
  const fromPalette = getColorProfile("image_palette").palette;
  const toPalette = getColorProfile(VANILLA_THIN_PROFILE_ID).palette;
  return {
    pointDefaults: {
      ...defaults.pointDefaults,
      strokeColor: remapRoleColor(defaults.pointDefaults.strokeColor, fromPalette.pointStroke, toPalette.pointStroke),
      fillColor: remapRoleColor(defaults.pointDefaults.fillColor, fromPalette.pointFill, toPalette.pointFill),
      labelColor: normalizeLabelColorForProfile(
        remapRoleColor(defaults.pointDefaults.labelColor, fromPalette.pointLabel, toPalette.pointLabel),
        profileId
      ),
      labelHaloColor: remapRoleColor(
        defaults.pointDefaults.labelHaloColor,
        fromPalette.pointLabelHalo,
        toPalette.pointLabelHalo
      ),
      labelOffsetPx: { ...defaults.pointDefaults.labelOffsetPx },
    },
    segmentDefaults: {
      ...defaults.segmentDefaults,
      strokeColor: remapRoleColor(
        defaults.segmentDefaults.strokeColor,
        fromPalette.segmentStroke,
        toPalette.segmentStroke
      ),
      segmentMark: defaults.segmentDefaults.segmentMark
        ? {
            ...defaults.segmentDefaults.segmentMark,
            color: remapOptionalRoleColor(
              defaults.segmentDefaults.segmentMark.color,
              fromPalette.marking,
              toPalette.marking
            ),
          }
        : defaults.segmentDefaults.segmentMark,
      segmentMarks: defaults.segmentDefaults.segmentMarks?.map((mark) => ({
        ...mark,
        color: remapOptionalRoleColor(mark.color, fromPalette.marking, toPalette.marking),
      })),
      segmentArrowMark: remapArrowMarkForRole(
        defaults.segmentDefaults.segmentArrowMark,
        fromPalette.arrow,
        toPalette.arrow
      ),
      segmentArrowMarks: defaults.segmentDefaults.segmentArrowMarks?.map((arrow) =>
        remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
      ),
    },
    lineDefaults: {
      ...defaults.lineDefaults,
      strokeColor: remapRoleColor(defaults.lineDefaults.strokeColor, fromPalette.lineStroke, toPalette.lineStroke),
    },
    circleDefaults: {
      ...defaults.circleDefaults,
      strokeColor: remapRoleColor(defaults.circleDefaults.strokeColor, fromPalette.circleStroke, toPalette.circleStroke),
      fillColor: remapOptionalRoleColor(
        defaults.circleDefaults.fillColor,
        fromPalette.polygonFill,
        toPalette.polygonFill
      ),
      patternColor: remapOptionalRoleColor(
        defaults.circleDefaults.patternColor,
        fromPalette.polygonFill,
        toPalette.polygonFill
      ),
      arrowMark: remapArrowMarkForRole(defaults.circleDefaults.arrowMark, fromPalette.arrow, toPalette.arrow),
      arrowMarks: defaults.circleDefaults.arrowMarks?.map((arrow) =>
        remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
      ),
    },
    ellipseDefaults: {
      ...defaults.ellipseDefaults,
      strokeColor: remapRoleColor(defaults.ellipseDefaults.strokeColor, fromPalette.circleStroke, toPalette.circleStroke),
      fillColor: remapOptionalRoleColor(
        defaults.ellipseDefaults.fillColor,
        fromPalette.polygonFill,
        toPalette.polygonFill
      ),
      patternColor: remapOptionalRoleColor(
        defaults.ellipseDefaults.patternColor,
        fromPalette.polygonFill,
        toPalette.polygonFill
      ),
      arrowMark: remapArrowMarkForRole(defaults.ellipseDefaults.arrowMark, fromPalette.arrow, toPalette.arrow),
      arrowMarks: defaults.ellipseDefaults.arrowMarks?.map((arrow) =>
        remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
      ),
    },
    polygonDefaults: {
      ...defaults.polygonDefaults,
      strokeColor: remapRoleColor(
        defaults.polygonDefaults.strokeColor,
        fromPalette.polygonStroke,
        toPalette.polygonStroke
      ),
      fillColor: remapOptionalRoleColor(
        defaults.polygonDefaults.fillColor,
        fromPalette.polygonFill,
        toPalette.polygonFill
      ),
      patternColor: remapOptionalRoleColor(
        defaults.polygonDefaults.patternColor,
        fromPalette.polygonFill,
        toPalette.polygonFill
      ),
      arrowMark: remapArrowMarkForRole(defaults.polygonDefaults.arrowMark, fromPalette.arrow, toPalette.arrow),
    },
    angleDefaults: {
      ...defaults.angleDefaults,
      strokeColor: remapRoleColor(defaults.angleDefaults.strokeColor, fromPalette.angleStroke, toPalette.angleStroke),
      textColor: normalizeLabelColorForProfile(
        remapRoleColor(defaults.angleDefaults.textColor, fromPalette.angleText, toPalette.angleText),
        profileId
      ),
      fillColor: remapRoleColor(defaults.angleDefaults.fillColor, fromPalette.angleFill, toPalette.angleFill),
      patternColor: remapOptionalRoleColor(
        defaults.angleDefaults.patternColor,
        fromPalette.angleFill,
        toPalette.angleFill
      ),
      markColor: remapRoleColor(defaults.angleDefaults.markColor, fromPalette.angleMark, toPalette.angleMark),
      angleMarks: defaults.angleDefaults.angleMarks?.map((mark) => ({
        ...mark,
        markColor: remapOptionalRoleColor(mark.markColor, fromPalette.angleMark, toPalette.angleMark),
      })),
      labelPosWorld: { ...defaults.angleDefaults.labelPosWorld },
      arcArrowMark: remapArrowMarkForRole(defaults.angleDefaults.arcArrowMark, fromPalette.arrow, toPalette.arrow),
      arcArrowMarks: defaults.angleDefaults.arcArrowMarks?.map((arrow) =>
        remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
      ),
    },
    labelToolDefaults: {
      ...defaults.labelToolDefaults,
      textColor: normalizeLabelColorForProfile(
        remapRoleColor(defaults.labelToolDefaults.textColor, fromPalette.pointLabel, toPalette.pointLabel),
        profileId
      ),
    },
    textboxToolDefaults: {
      ...defaults.textboxToolDefaults,
      textColor: normalizeLabelColorForProfile(
        remapRoleColor(defaults.textboxToolDefaults.textColor, fromPalette.pointLabel, toPalette.pointLabel),
        profileId
      ),
    },
    richTextToolDefaults: {
      ...defaults.richTextToolDefaults,
      textColor: normalizeLabelColorForProfile(
        remapRoleColor(defaults.richTextToolDefaults.textColor, fromPalette.pointLabel, toPalette.pointLabel),
        profileId
      ),
    },
  };
}

export function recolorSceneForProfile(scene: SceneModel, fromProfileId: ColorProfileId, toProfileId: ColorProfileId): SceneModel {
  if (fromProfileId === toProfileId) return normalizeSceneLabelColors(scene, toProfileId);
  const fromPalette = getColorProfile(fromProfileId).palette;
  const toPalette = getColorProfile(toProfileId).palette;

  return normalizeSceneLabelColors(remapSceneColors(scene, fromPalette, toPalette), toProfileId);
}

function remapSceneColors(
  scene: SceneModel,
  fromPalette: ColorProfilePalette,
  toPalette: ColorProfilePalette
): SceneModel {
  const recolored: SceneModel = {
    ...scene,
    points: scene.points.map((point) => ({
      ...point,
      style: {
        ...point.style,
        strokeColor: remapRoleColor(point.style.strokeColor, fromPalette.pointStroke, toPalette.pointStroke),
        fillColor: remapRoleColor(point.style.fillColor, fromPalette.pointFill, toPalette.pointFill),
        labelColor: remapRoleColor(point.style.labelColor, fromPalette.pointLabel, toPalette.pointLabel),
        labelHaloColor: remapRoleColor(
          point.style.labelHaloColor,
          fromPalette.pointLabelHalo,
          toPalette.pointLabelHalo
        ),
        labelOffsetPx: { ...point.style.labelOffsetPx },
      },
    })),
    segments: scene.segments.map((segment) => ({
      ...segment,
      style: {
        ...segment.style,
        strokeColor: remapRoleColor(segment.style.strokeColor, fromPalette.segmentStroke, toPalette.segmentStroke),
        segmentMark: segment.style.segmentMark
          ? {
            ...segment.style.segmentMark,
            color: remapOptionalRoleColor(
              segment.style.segmentMark.color,
              fromPalette.marking,
              toPalette.marking
            ),
          }
          : segment.style.segmentMark,
        segmentMarks: segment.style.segmentMarks?.map((mark) => ({
          ...mark,
          color: remapOptionalRoleColor(mark.color, fromPalette.marking, toPalette.marking),
        })),
        segmentArrowMark: remapArrowMarkForRole(
          segment.style.segmentArrowMark,
          fromPalette.arrow,
          toPalette.arrow
        ),
        segmentArrowMarks: segment.style.segmentArrowMarks?.map((arrow) =>
          remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
        ),
      },
    })),
    lines: scene.lines.map((line) => ({
      ...line,
      style: {
        ...line.style,
        strokeColor: remapRoleColor(line.style.strokeColor, fromPalette.lineStroke, toPalette.lineStroke),
      },
    })),
    circles: scene.circles.map((circle) => ({
      ...circle,
      style: {
        ...circle.style,
        strokeColor: remapRoleColor(circle.style.strokeColor, fromPalette.circleStroke, toPalette.circleStroke),
        fillColor: remapOptionalRoleColor(circle.style.fillColor, fromPalette.polygonFill, toPalette.polygonFill),
        patternColor: remapOptionalRoleColor(
          circle.style.patternColor,
          fromPalette.polygonFill,
          toPalette.polygonFill
        ),
        arrowMark: remapArrowMarkForRole(circle.style.arrowMark, fromPalette.arrow, toPalette.arrow),
        arrowMarks: circle.style.arrowMarks?.map((arrow) =>
          remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
        ),
      },
    })),
    ellipses: (scene.ellipses ?? []).map((ellipse) => ({
      ...ellipse,
      style: {
        ...ellipse.style,
        strokeColor: remapRoleColor(ellipse.style.strokeColor, fromPalette.circleStroke, toPalette.circleStroke),
        fillColor: remapOptionalRoleColor(ellipse.style.fillColor, fromPalette.polygonFill, toPalette.polygonFill),
        patternColor: remapOptionalRoleColor(
          ellipse.style.patternColor,
          fromPalette.polygonFill,
          toPalette.polygonFill
        ),
        arrowMark: remapArrowMarkForRole(ellipse.style.arrowMark, fromPalette.arrow, toPalette.arrow),
        arrowMarks: ellipse.style.arrowMarks?.map((arrow) =>
          remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
        ),
      },
    })),
    polygons: scene.polygons.map((polygon) => ({
      ...polygon,
      style: {
        ...polygon.style,
        strokeColor: remapRoleColor(polygon.style.strokeColor, fromPalette.polygonStroke, toPalette.polygonStroke),
        fillColor: remapOptionalRoleColor(polygon.style.fillColor, fromPalette.polygonFill, toPalette.polygonFill),
        patternColor: remapOptionalRoleColor(
          polygon.style.patternColor,
          fromPalette.polygonFill,
          toPalette.polygonFill
        ),
        arrowMark: remapArrowMarkForRole(polygon.style.arrowMark, fromPalette.arrow, toPalette.arrow),
      },
    })),
    angles: scene.angles.map((angle) => ({
      ...angle,
      style: {
        ...angle.style,
        strokeColor: remapRoleColor(angle.style.strokeColor, fromPalette.angleStroke, toPalette.angleStroke),
        textColor: remapRoleColor(angle.style.textColor, fromPalette.angleText, toPalette.angleText),
        fillColor: remapRoleColor(angle.style.fillColor, fromPalette.angleFill, toPalette.angleFill),
        patternColor: remapOptionalRoleColor(
          angle.style.patternColor,
          fromPalette.angleFill,
          toPalette.angleFill
        ),
        markColor: remapRoleColor(angle.style.markColor, fromPalette.angleMark, toPalette.angleMark),
        angleMarks: angle.style.angleMarks?.map((mark) => ({
          ...mark,
          markColor: remapOptionalRoleColor(mark.markColor, fromPalette.angleMark, toPalette.angleMark),
        })),
        labelPosWorld: { ...angle.style.labelPosWorld },
        arcArrowMark: remapArrowMarkForRole(angle.style.arcArrowMark, fromPalette.arrow, toPalette.arrow),
        arcArrowMarks: angle.style.arcArrowMarks?.map((arrow) =>
          remapArrowMarkForRole(arrow, fromPalette.arrow, toPalette.arrow)
        ),
      },
    })),
    textLabels: (scene.textLabels ?? []).map((label) => ({
      ...label,
      style: {
        ...label.style,
        textColor: remapRoleColor(label.style.textColor, fromPalette.pointLabel, toPalette.pointLabel),
      },
    })),
    richTextNodes: (scene.richTextNodes ?? []).map((node) => ({
      ...node,
      style: {
        ...node.style,
        textColor: remapRoleColor(node.style.textColor, fromPalette.pointLabel, toPalette.pointLabel),
      },
    })),
    numbers: [...scene.numbers],
    vectors: scene.vectors ? [...scene.vectors] : undefined,
  };
  return recolored;
}

export function normalizeSceneLabelColors(scene: SceneModel, profileId: ColorProfileId): SceneModel {
  if (profileId !== VANILLA_THIN_PROFILE_ID) return scene;
  const recolored = remapSceneColors(
    scene,
    getColorProfile("image_palette").palette,
    getColorProfile(VANILLA_THIN_PROFILE_ID).palette
  );
  return {
    ...recolored,
    points: recolored.points.map((point) => ({
      ...point,
      style: {
        ...point.style,
        labelColor: normalizeLabelColorForProfile(point.style.labelColor, profileId),
        labelOffsetPx: { ...point.style.labelOffsetPx },
      },
    })),
    angles: recolored.angles.map((angle) => ({
      ...angle,
      style: {
        ...angle.style,
        textColor: normalizeLabelColorForProfile(angle.style.textColor, profileId),
        labelPosWorld: { ...angle.style.labelPosWorld },
      },
    })),
    textLabels: (recolored.textLabels ?? []).map((label) => ({
      ...label,
      style: {
        ...label.style,
        textColor: normalizeLabelColorForProfile(label.style.textColor, profileId),
      },
    })),
    richTextNodes: (recolored.richTextNodes ?? []).map((node) => ({
      ...node,
      style: {
        ...node.style,
        textColor: normalizeLabelColorForProfile(node.style.textColor, profileId),
      },
    })),
  };
}

function remapArrowMarkForRole<T extends PathArrowMark | undefined>(
  arrow: T,
  fromColor: string,
  toColor: string
): T {
  if (!arrow) return arrow;
  return {
    ...arrow,
    color: remapOptionalRoleColor(arrow.color, fromColor, toColor),
  };
}

function remapRoleColor(color: string, fromColor: string, toColor: string): string {
  if (normalizeColorToken(color) !== normalizeColorToken(fromColor)) return color;
  return toColor.trim();
}

function remapOptionalRoleColor(
  color: string | undefined,
  fromColor: string,
  toColor: string
): string | undefined {
  if (!color) return color;
  return remapRoleColor(color, fromColor, toColor);
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
