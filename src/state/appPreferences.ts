import type { AppPreferencesState } from "./slices/storeTypes";
import { UI_CSS_VARIABLE_KEYS, type UiCssVariableName } from "./colorProfiles";

type UiPreferencesState = Pick<AppPreferencesState, "uiColorProfileId" | "uiCssOverrides">;
type ConstructionPreferencesState = Pick<
  AppPreferencesState,
  | "colorProfileId"
  | "gridEnabled"
  | "axesEnabled"
  | "gridSnapEnabled"
  | "pointDefaults"
  | "segmentDefaults"
  | "lineDefaults"
  | "circleDefaults"
  | "polygonDefaults"
  | "angleDefaults"
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
  return value === "vanilla" || value === "grayscale" || value === "beige";
}

function isColorProfileId(value: unknown): value is ConstructionPreferencesState["colorProfileId"] {
  return value === "classic" || value === "grayscale_white_dot" || value === "beige_light";
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
    gridEnabled: state.gridEnabled,
    axesEnabled: state.axesEnabled,
    gridSnapEnabled: state.gridSnapEnabled,
    pointDefaults: state.pointDefaults,
    segmentDefaults: state.segmentDefaults,
    lineDefaults: state.lineDefaults,
    circleDefaults: state.circleDefaults,
    polygonDefaults: state.polygonDefaults,
    angleDefaults: state.angleDefaults,
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
    uiColorProfileId: envelope.value.uiColorProfileId,
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
    !isRecord(value.polygonDefaults) ||
    !isRecord(value.angleDefaults) ||
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
    gridEnabled: value.gridEnabled,
    axesEnabled: value.axesEnabled,
    gridSnapEnabled: value.gridSnapEnabled,
    pointDefaults: value.pointDefaults as ConstructionPreferencesState["pointDefaults"],
    segmentDefaults: value.segmentDefaults as ConstructionPreferencesState["segmentDefaults"],
    lineDefaults: value.lineDefaults as ConstructionPreferencesState["lineDefaults"],
    circleDefaults: value.circleDefaults as ConstructionPreferencesState["circleDefaults"],
    polygonDefaults: value.polygonDefaults as ConstructionPreferencesState["polygonDefaults"],
    angleDefaults: value.angleDefaults as ConstructionPreferencesState["angleDefaults"],
    angleFixedTool: value.angleFixedTool as ConstructionPreferencesState["angleFixedTool"],
    circleFixedTool: value.circleFixedTool as ConstructionPreferencesState["circleFixedTool"],
    regularPolygonTool: value.regularPolygonTool as ConstructionPreferencesState["regularPolygonTool"],
    transformTool: value.transformTool as ConstructionPreferencesState["transformTool"],
    dependencyGlowEnabled: value.dependencyGlowEnabled,
  };
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
