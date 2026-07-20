import type { AppPreferencesState } from "./slices/storeTypes";
import { UI_CSS_VARIABLE_KEYS, type UiCssVariableName } from "./colorProfiles";

type UiPreferencesState = Pick<AppPreferencesState, "uiColorProfileId" | "uiCssOverrides">;
type ConstructionPreferencesState = Pick<
  AppPreferencesState,
  | "colorProfileId"
  | "canvasThemeOverrides"
  | "gridEnabled"
  | "axesEnabled"
  | "gridSnapEnabled"
  | "pointDefaults"
  | "segmentDefaults"
  | "lineDefaults"
  | "circleDefaults"
  | "ellipseDefaults"
  | "polygonDefaults"
  | "angleDefaults"
  | "objectLabelDefaults"
  | "labelToolDefaults"
  | "textboxToolDefaults"
  | "richTextToolDefaults"
  | "angleFixedTool"
  | "circleFixedTool"
  | "regularPolygonTool"
  | "transformTool"
  | "dependencyGlowEnabled"
>;

type StoredEnvelope<T> = {
  version: 1;
  value: T;
};

const UI_PREFERENCES_KEY = "geodraw.ui-preferences.v1";
const CONSTRUCTION_PREFERENCES_KEY = "geodraw.construction-preferences.v1";

function readStoredEnvelope<T>(key: string): StoredEnvelope<T> | null {
  if (typeof window === "undefined" || !("localStorage" in window)) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEnvelope<T>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;
    if (!("value" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredEnvelope<T>(key: string, value: T): boolean {
  if (typeof window === "undefined" || !("localStorage" in window)) return false;
  try {
    const payload: StoredEnvelope<T> = { version: 1, value };
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeUiOverrides(raw: unknown): UiPreferencesState["uiCssOverrides"] {
  if (!isRecord(raw)) return {};
  const out: UiPreferencesState["uiCssOverrides"] = {};
  for (const key of UI_CSS_VARIABLE_KEYS) {
    const value = raw[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized) continue;
    out[key as UiCssVariableName] = normalized;
  }
  return out;
}

function isUiProfileId(value: unknown): value is UiPreferencesState["uiColorProfileId"] {
  return (
    value === "vanilla" ||
    value === "grayscale" ||
    value === "beige" ||
    value === "dark" ||
    value === "image" ||
    value === "image_palette"
  );
}

function normalizeUiProfileId(raw: UiPreferencesState["uiColorProfileId"]): UiPreferencesState["uiColorProfileId"] {
  return raw === "image" ? "image_palette" : raw;
}

function isColorProfileId(value: unknown): value is ConstructionPreferencesState["colorProfileId"] {
  return (
    value === "classic" ||
    value === "grayscale_white_dot" ||
    value === "beige_light" ||
    value === "dark_mode" ||
    value === "image_palette" ||
    value === "image_palette_vanilla_thin"
  );
}

function normalizeCanvasThemeOverrides(raw: unknown): ConstructionPreferencesState["canvasThemeOverrides"] {
  if (!isRecord(raw)) return {};
  const out: ConstructionPreferencesState["canvasThemeOverrides"] = {};
  const backgroundColor = raw.backgroundColor;
  if (typeof backgroundColor === "string" && backgroundColor.trim().length > 0) {
    out.backgroundColor = backgroundColor.trim();
  }
  const gridMinorColor = raw.gridMinorColor;
  if (typeof gridMinorColor === "string" && gridMinorColor.trim().length > 0) {
    out.gridMinorColor = gridMinorColor.trim();
  }
  const gridMajorColor = raw.gridMajorColor;
  if (typeof gridMajorColor === "string" && gridMajorColor.trim().length > 0) {
    out.gridMajorColor = gridMajorColor.trim();
  }
  const axisColor = raw.axisColor;
  if (typeof axisColor === "string" && axisColor.trim().length > 0) {
    out.axisColor = axisColor.trim();
  }
  return out;
}

function normalizeObjectLabelDefaults(raw: unknown): ConstructionPreferencesState["objectLabelDefaults"] {
  if (!isRecord(raw)) {
    return {
      point: "name",
      segment: false,
      line: false,
      circle: false,
      ellipse: false,
      polygon: false,
      segmentGlow: true,
      lineGlow: true,
      circleGlow: true,
      ellipseGlow: true,
      polygonGlow: true,
    };
  }
  const point = raw.point === "none" || raw.point === "caption" ? raw.point : "name";
  return {
    point,
    segment: typeof raw.segment === "boolean" ? raw.segment : false,
    line: typeof raw.line === "boolean" ? raw.line : false,
    circle: typeof raw.circle === "boolean" ? raw.circle : false,
    ellipse: typeof raw.ellipse === "boolean" ? raw.ellipse : false,
    polygon: typeof raw.polygon === "boolean" ? raw.polygon : false,
    segmentGlow: typeof raw.segmentGlow === "boolean" ? raw.segmentGlow : true,
    lineGlow: typeof raw.lineGlow === "boolean" ? raw.lineGlow : true,
    circleGlow: typeof raw.circleGlow === "boolean" ? raw.circleGlow : true,
    ellipseGlow: typeof raw.ellipseGlow === "boolean" ? raw.ellipseGlow : true,
    polygonGlow: typeof raw.polygonGlow === "boolean" ? raw.polygonGlow : true,
  };
}

export function captureUiPreferences(state: UiPreferencesState): UiPreferencesState {
  return {
    uiColorProfileId: state.uiColorProfileId,
    uiCssOverrides: { ...state.uiCssOverrides },
  };
}

export function captureConstructionPreferences(state: ConstructionPreferencesState): ConstructionPreferencesState {
  return structuredClone({
    colorProfileId: state.colorProfileId,
    canvasThemeOverrides: { ...state.canvasThemeOverrides },
    gridEnabled: state.gridEnabled,
    axesEnabled: state.axesEnabled,
    gridSnapEnabled: state.gridSnapEnabled,
    pointDefaults: state.pointDefaults,
    segmentDefaults: state.segmentDefaults,
    lineDefaults: state.lineDefaults,
    circleDefaults: state.circleDefaults,
    ellipseDefaults: state.ellipseDefaults,
    polygonDefaults: state.polygonDefaults,
    angleDefaults: state.angleDefaults,
    objectLabelDefaults: state.objectLabelDefaults,
    labelToolDefaults: state.labelToolDefaults,
    textboxToolDefaults: state.textboxToolDefaults,
    richTextToolDefaults: state.richTextToolDefaults,
    angleFixedTool: state.angleFixedTool,
    circleFixedTool: state.circleFixedTool,
    regularPolygonTool: state.regularPolygonTool,
    transformTool: state.transformTool,
    dependencyGlowEnabled: state.dependencyGlowEnabled,
  });
}

export function saveStoredUiPreferences(state: UiPreferencesState): boolean {
  return writeStoredEnvelope(UI_PREFERENCES_KEY, captureUiPreferences(state));
}

export function loadStoredUiPreferences(): UiPreferencesState | null {
  const envelope = readStoredEnvelope<unknown>(UI_PREFERENCES_KEY);
  if (!envelope || !isRecord(envelope.value)) return null;
  if (!isUiProfileId(envelope.value.uiColorProfileId)) return null;
  return {
    uiColorProfileId: normalizeUiProfileId(envelope.value.uiColorProfileId),
    uiCssOverrides: normalizeUiOverrides(envelope.value.uiCssOverrides),
  };
}

export function saveStoredConstructionPreferences(state: ConstructionPreferencesState): boolean {
  return writeStoredEnvelope(CONSTRUCTION_PREFERENCES_KEY, captureConstructionPreferences(state));
}

export function loadStoredConstructionPreferences(): ConstructionPreferencesState | null {
  const envelope = readStoredEnvelope<unknown>(CONSTRUCTION_PREFERENCES_KEY);
  if (!envelope || !isRecord(envelope.value)) return null;
  const value = envelope.value;
  if (!isColorProfileId(value.colorProfileId)) return null;
  if (
    !isRecord(value.pointDefaults) ||
    !isRecord(value.segmentDefaults) ||
    !isRecord(value.lineDefaults) ||
    !isRecord(value.circleDefaults) ||
    (value.ellipseDefaults !== undefined && !isRecord(value.ellipseDefaults)) ||
    !isRecord(value.polygonDefaults) ||
    !isRecord(value.angleDefaults) ||
    (value.labelToolDefaults !== undefined && !isRecord(value.labelToolDefaults)) ||
    (value.textboxToolDefaults !== undefined && !isRecord(value.textboxToolDefaults)) ||
    (value.richTextToolDefaults !== undefined && !isRecord(value.richTextToolDefaults)) ||
    !isRecord(value.angleFixedTool) ||
    !isRecord(value.circleFixedTool) ||
    !isRecord(value.regularPolygonTool) ||
    !isRecord(value.transformTool)
  ) {
    return null;
  }
  if (
    typeof value.gridEnabled !== "boolean" ||
    typeof value.axesEnabled !== "boolean" ||
    typeof value.gridSnapEnabled !== "boolean" ||
    typeof value.dependencyGlowEnabled !== "boolean"
  ) {
    return null;
  }

  return {
    colorProfileId: value.colorProfileId,
    canvasThemeOverrides: normalizeCanvasThemeOverrides(value.canvasThemeOverrides),
    gridEnabled: value.gridEnabled,
    axesEnabled: value.axesEnabled,
    gridSnapEnabled: value.gridSnapEnabled,
    pointDefaults: value.pointDefaults as ConstructionPreferencesState["pointDefaults"],
    segmentDefaults: value.segmentDefaults as ConstructionPreferencesState["segmentDefaults"],
    lineDefaults: value.lineDefaults as ConstructionPreferencesState["lineDefaults"],
    circleDefaults: value.circleDefaults as ConstructionPreferencesState["circleDefaults"],
    ellipseDefaults: (value.ellipseDefaults ?? value.circleDefaults) as ConstructionPreferencesState["ellipseDefaults"],
    polygonDefaults: value.polygonDefaults as ConstructionPreferencesState["polygonDefaults"],
    angleDefaults: value.angleDefaults as ConstructionPreferencesState["angleDefaults"],
    objectLabelDefaults: normalizeObjectLabelDefaults(value.objectLabelDefaults),
    labelToolDefaults: value.labelToolDefaults as ConstructionPreferencesState["labelToolDefaults"],
    textboxToolDefaults: value.textboxToolDefaults as ConstructionPreferencesState["textboxToolDefaults"],
    richTextToolDefaults: value.richTextToolDefaults as ConstructionPreferencesState["richTextToolDefaults"],
    angleFixedTool: value.angleFixedTool as ConstructionPreferencesState["angleFixedTool"],
    circleFixedTool: value.circleFixedTool as ConstructionPreferencesState["circleFixedTool"],
    regularPolygonTool: value.regularPolygonTool as ConstructionPreferencesState["regularPolygonTool"],
    transformTool: value.transformTool as ConstructionPreferencesState["transformTool"],
    dependencyGlowEnabled: value.dependencyGlowEnabled,
  };
}

export type ExportEmitTkzSetupMode = "auto" | "on" | "off";
export type ExportTikzMode = "visualExact" | "reconstructible";

export type ExportPreferencesState = {
  useCurrentView: boolean;
  compactCode: boolean;
  emitTkzSetup: ExportEmitTkzSetupMode;
  labelGlow: boolean;
  tikzExportMode: ExportTikzMode;
  globalScale: string;
  pointScale: string;
  lineScale: string;
  labelScale: string;
};

const EXPORT_PREFERENCES_KEY = "geodraw.export-preferences.v1";

export const DEFAULT_EXPORT_PREFERENCES: ExportPreferencesState = {
  useCurrentView: true,
  compactCode: true,
  emitTkzSetup: "auto",
  labelGlow: true,
  tikzExportMode: "visualExact",
  globalScale: "1",
  pointScale: "1",
  lineScale: "1",
  labelScale: "1",
};

function normalizeBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

function normalizeEmitTkzSetup(raw: unknown): ExportEmitTkzSetupMode {
  return raw === "on" || raw === "off" ? raw : "auto";
}

function normalizeTikzExportMode(raw: unknown): ExportTikzMode {
  return raw === "reconstructible" ? "reconstructible" : "visualExact";
}

function normalizeScaleString(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0.05 || value > 10) return fallback;
  return raw;
}

// Unlike UI/construction prefs, a bad field falls back to its own default instead of invalidating the whole envelope.
export function loadStoredExportPreferences(): ExportPreferencesState {
  const envelope = readStoredEnvelope<unknown>(EXPORT_PREFERENCES_KEY);
  const raw = envelope && isRecord(envelope.value) ? envelope.value : {};
  return {
    useCurrentView: normalizeBoolean(raw.useCurrentView, DEFAULT_EXPORT_PREFERENCES.useCurrentView),
    compactCode: normalizeBoolean(raw.compactCode, DEFAULT_EXPORT_PREFERENCES.compactCode),
    emitTkzSetup: normalizeEmitTkzSetup(raw.emitTkzSetup),
    labelGlow: normalizeBoolean(raw.labelGlow, DEFAULT_EXPORT_PREFERENCES.labelGlow),
    tikzExportMode: normalizeTikzExportMode(raw.tikzExportMode),
    globalScale: normalizeScaleString(raw.globalScale, DEFAULT_EXPORT_PREFERENCES.globalScale),
    pointScale: normalizeScaleString(raw.pointScale, DEFAULT_EXPORT_PREFERENCES.pointScale),
    lineScale: normalizeScaleString(raw.lineScale, DEFAULT_EXPORT_PREFERENCES.lineScale),
    labelScale: normalizeScaleString(raw.labelScale, DEFAULT_EXPORT_PREFERENCES.labelScale),
  };
}

export function saveStoredExportPreferences(state: ExportPreferencesState): boolean {
  return writeStoredEnvelope(EXPORT_PREFERENCES_KEY, state);
}

export function hasStoredConstructionPreferences(): boolean {
  return Boolean(readStoredEnvelope(CONSTRUCTION_PREFERENCES_KEY));
}

export function clearStoredConstructionPreferences(): boolean {
  if (typeof window === "undefined" || !("localStorage" in window)) return false;
  try {
    window.localStorage.removeItem(CONSTRUCTION_PREFERENCES_KEY);
    return true;
  } catch {
    return false;
  }
}

export type OnboardingFlags = {
  emptyCanvasHintDismissed: boolean;
};

const ONBOARDING_KEY = "geodraw.onboarding.v1";

export const DEFAULT_ONBOARDING_FLAGS: OnboardingFlags = {
  emptyCanvasHintDismissed: false,
};

export function loadStoredOnboardingFlags(): OnboardingFlags {
  const envelope = readStoredEnvelope<unknown>(ONBOARDING_KEY);
  const raw = envelope && isRecord(envelope.value) ? envelope.value : {};
  return {
    emptyCanvasHintDismissed: normalizeBoolean(raw.emptyCanvasHintDismissed, DEFAULT_ONBOARDING_FLAGS.emptyCanvasHintDismissed),
  };
}

export function saveStoredOnboardingFlags(flags: OnboardingFlags): boolean {
  return writeStoredEnvelope(ONBOARDING_KEY, flags);
}
