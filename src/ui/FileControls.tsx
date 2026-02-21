import { FolderOpen, Save, SaveAll, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useGeoStore, getGeoStore } from "../state/geoStore";
import { takeHistorySnapshot, type HistorySnapshot } from "../state/slices/historySlice";
import {
  COLOR_PROFILE_OPTIONS,
  getCanvasColorTheme,
  getUiCssVariables,
  type CanvasColorTheme,
  getUiProfileBaseVariables,
  UI_CSS_VARIABLE_KEYS,
  UI_COLOR_PROFILE_OPTIONS,
  getUiColorProfileSwatch,
  type UiCssVariableName,
  type UiColorProfileId,
} from "../state/colorProfiles";
import {
  captureConstructionPreferences,
  clearStoredConstructionPreferences,
  hasStoredConstructionPreferences,
  loadStoredConstructionPreferences,
  saveStoredConstructionPreferences,
} from "../state/appPreferences";

const MENU_EVENT_FILE_OPEN = "gd-menu-file-open";
const MENU_EVENT_FILE_SAVE = "gd-menu-file-save";
const MENU_EVENT_FILE_SAVE_AS = "gd-menu-file-save-as";

type PickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle[]>;
};

const CANVAS_THEME_KEYS: Array<{ key: keyof CanvasColorTheme; label: string }> = [
  { key: "backgroundColor", label: "Canvas Background" },
  { key: "gridMinorColor", label: "Grid Minor" },
  { key: "gridMajorColor", label: "Grid Major" },
  { key: "axisColor", label: "Axes" },
];

type PreferenceTab = "ui" | "construction" | "presets";

const PREFERENCES_TAB_OPTIONS: Array<{ id: PreferenceTab; label: string }> = [
  { id: "ui", label: "UI Theme" },
  { id: "construction", label: "Construction" },
  { id: "presets", label: "Presets" },
];

export function FileControls() {
  const loadSnapshot = useGeoStore((state) => state.loadSnapshot);
  const applyAppPreferences = useGeoStore((state) => state.applyAppPreferences);
  const colorProfileId = useGeoStore((state) => state.colorProfileId);
  const canvasThemeOverrides = useGeoStore((state) => state.canvasThemeOverrides);
  const uiColorProfileId = useGeoStore((state) => state.uiColorProfileId);
  const uiCssOverrides = useGeoStore((state) => state.uiCssOverrides);
  const gridEnabled = useGeoStore((state) => state.gridEnabled);
  const axesEnabled = useGeoStore((state) => state.axesEnabled);
  const gridSnapEnabled = useGeoStore((state) => state.gridSnapEnabled);
  const pointDefaults = useGeoStore((state) => state.pointDefaults);
  const segmentDefaults = useGeoStore((state) => state.segmentDefaults);
  const lineDefaults = useGeoStore((state) => state.lineDefaults);
  const circleDefaults = useGeoStore((state) => state.circleDefaults);
  const polygonDefaults = useGeoStore((state) => state.polygonDefaults);
  const angleDefaults = useGeoStore((state) => state.angleDefaults);
  const angleFixedTool = useGeoStore((state) => state.angleFixedTool);
  const circleFixedTool = useGeoStore((state) => state.circleFixedTool);
  const regularPolygonTool = useGeoStore((state) => state.regularPolygonTool);
  const transformTool = useGeoStore((state) => state.transformTool);
  const dependencyGlowEnabled = useGeoStore((state) => state.dependencyGlowEnabled);
  const setColorProfile = useGeoStore((state) => state.setColorProfile);
  const setUiColorProfile = useGeoStore((state) => state.setUiColorProfile);
  const setUiCssVariable = useGeoStore((state) => state.setUiCssVariable);
  const clearUiCssOverrides = useGeoStore((state) => state.clearUiCssOverrides);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const tauriPathRef = useRef<string | null>(null);
  const preferencesDialogRef = useRef<HTMLElement | null>(null);

  const openActionRef = useRef<() => Promise<void>>(async () => {});
  const saveActionRef = useRef<() => Promise<void>>(async () => {});
  const saveAsActionRef = useRef<() => Promise<void>>(async () => {});

  const [savedName, setSavedName] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesTab, setPreferencesTab] = useState<PreferenceTab>("ui");
  const [constructionPresetStatus, setConstructionPresetStatus] = useState<string>("");
  const [hasConstructionPreset, setHasConstructionPreset] = useState(() => hasStoredConstructionPreferences());
  const uiBaseVariables = useMemo(() => getUiProfileBaseVariables(uiColorProfileId), [uiColorProfileId]);
  const uiEffectiveVariables = useMemo(
    () => getUiCssVariables(uiColorProfileId, uiCssOverrides),
    [uiColorProfileId, uiCssOverrides]
  );
  const uiOverrideCount = useMemo(() => Object.keys(uiCssOverrides).length, [uiCssOverrides]);
  const canvasTheme = useMemo(
    () => getCanvasColorTheme(colorProfileId, canvasThemeOverrides),
    [colorProfileId, canvasThemeOverrides]
  );
  const canvasOverrideCount = useMemo(() => Object.keys(canvasThemeOverrides).length, [canvasThemeOverrides]);
  const currentConstructionPreferences = useMemo(
    () =>
      captureConstructionPreferences({
        colorProfileId,
        canvasThemeOverrides,
        gridEnabled,
        axesEnabled,
        gridSnapEnabled,
        pointDefaults,
        segmentDefaults,
        lineDefaults,
        circleDefaults,
        polygonDefaults,
        angleDefaults,
        angleFixedTool,
        circleFixedTool,
        regularPolygonTool,
        transformTool,
        dependencyGlowEnabled,
      }),
    [
      colorProfileId,
      canvasThemeOverrides,
      gridEnabled,
      axesEnabled,
      gridSnapEnabled,
      pointDefaults,
      segmentDefaults,
      lineDefaults,
      circleDefaults,
      polygonDefaults,
      angleDefaults,
      angleFixedTool,
      circleFixedTool,
      regularPolygonTool,
      transformTool,
      dependencyGlowEnabled,
    ]
  );

  const buildSnapshotJson = (): string => {
    const state = getGeoStore();
    return JSON.stringify(takeHistorySnapshot(state), null, 2);
  };

  const defaultFileName = () => `geodraw-${new Date().toISOString().slice(0, 10)}.geodraw`;

  const downloadFallback = (json: string, fileName: string) => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveToHandle = async (handle: FileSystemFileHandle, json: string) => {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    fileHandleRef.current = handle;
    setSavedName(handle.name);
  };

  const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object);

  const normalizeTauriPath = (path: string): string => {
    const trimmed = path.trim();
    if (trimmed.startsWith("file://")) {
      const withoutScheme = trimmed.replace(/^file:\/\//, "");
      return decodeURIComponent(withoutScheme);
    }
    return trimmed;
  };

  const baseName = (path: string): string => {
    const norm = path.replace(/\\/g, "/");
    const idx = norm.lastIndexOf("/");
    return idx >= 0 ? norm.slice(idx + 1) : norm;
  };

  const handleSaveAs = async () => {
    const json = buildSnapshotJson();
    if (isTauri()) {
      try {
        const path = await tauriSave({
          defaultPath: savedName ?? defaultFileName(),
          filters: [{ name: "GeoDraw File", extensions: ["geodraw", "json"] }],
        });
        if (!path) return;
        const normalizedPath = normalizeTauriPath(path);
        await writeTextFile(normalizedPath, json);
        tauriPathRef.current = normalizedPath;
        setSavedName(baseName(normalizedPath));
        return;
      } catch (err) {
        console.error("Failed to save file:", err);
        alert("Save failed. Check folder permissions and try again.");
        return;
      }
    }

    const picker = (window as PickerWindow).showSaveFilePicker;
    if (!picker) {
      downloadFallback(json, savedName ?? defaultFileName());
      return;
    }
    try {
      const handle = await picker({
        suggestedName: savedName ?? defaultFileName(),
        types: [
          {
            description: "GeoDraw File",
            accept: { "application/json": [".geodraw", ".json"] },
          },
        ],
      });
      await saveToHandle(handle, json);
    } catch {
      // user cancelled
    }
  };

  const handleSave = async () => {
    const json = buildSnapshotJson();
    if (isTauri()) {
      const path = tauriPathRef.current;
      if (path) {
        try {
          await writeTextFile(path, json);
          return;
        } catch (err) {
          console.error("Failed to save file:", err);
          // fallback save-as
        }
      }
      await handleSaveAs();
      return;
    }

    const handle = fileHandleRef.current;
    if (handle) {
      try {
        await saveToHandle(handle, json);
        return;
      } catch {
        // permission/path changed, fallback to Save As
      }
    }
    await handleSaveAs();
  };

  const parseAndLoadText = (text: string, fileName?: string) => {
    const parsed = JSON.parse(text) as HistorySnapshot;
    if (!isValidSnapshot(parsed)) {
      throw new Error("Invalid GeoDraw file structure");
    }
    loadSnapshot(parsed);
    if (fileName) setSavedName(fileName);
  };

  const handleOpenClick = async () => {
    if (isTauri()) {
      try {
        const path = await tauriOpen({
          multiple: false,
          filters: [{ name: "GeoDraw File", extensions: ["geodraw", "json"] }],
        });
        if (!path || Array.isArray(path)) return;
        const normalizedPath = normalizeTauriPath(path);
        const text = await readTextFile(normalizedPath);
        parseAndLoadText(text, baseName(normalizedPath));
        tauriPathRef.current = normalizedPath;
        fileHandleRef.current = null;
        return;
      } catch (err) {
        if (err) {
          console.error("Failed to open file:", err);
        }
        return;
      }
    }

    const picker = (window as PickerWindow).showOpenFilePicker;
    if (!picker) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const handles = await picker({
        multiple: false,
        types: [
          {
            description: "GeoDraw File",
            accept: { "application/json": [".geodraw", ".json"] },
          },
        ],
      });
      const handle = handles[0];
      if (!handle) return;
      const file = await handle.getFile();
      const text = await file.text();
      parseAndLoadText(text, file.name);
      fileHandleRef.current = handle;
    } catch (err) {
      if (err) {
        console.error("Failed to open file:", err);
      }
    }
  };

  openActionRef.current = handleOpenClick;
  saveActionRef.current = handleSave;
  saveAsActionRef.current = handleSaveAs;

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const register = async () => {
      const specs: Array<[string, () => void]> = [
        [MENU_EVENT_FILE_OPEN, () => void openActionRef.current()],
        [MENU_EVENT_FILE_SAVE, () => void saveActionRef.current()],
        [MENU_EVENT_FILE_SAVE_AS, () => void saveAsActionRef.current()],
      ];

      for (const [eventName, handler] of specs) {
        const unlisten = await listen(eventName, handler);
        if (disposed) {
          unlisten();
        } else {
          unlisteners.push(unlisten);
        }
      }
    };

    void register();

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    if (!preferencesOpen) return;

    setHasConstructionPreset(hasStoredConstructionPreferences());

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (preferencesDialogRef.current && !preferencesDialogRef.current.contains(target)) {
        setPreferencesOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreferencesOpen(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [preferencesOpen]);

  const saveConstructionPreset = () => {
    const ok = saveStoredConstructionPreferences(currentConstructionPreferences);
    if (!ok) {
      setConstructionPresetStatus("Could not save preset (storage unavailable).");
      return;
    }
    setHasConstructionPreset(true);
    setConstructionPresetStatus("Saved current construction settings as preferred preset.");
  };

  const loadConstructionPreset = () => {
    const preset = loadStoredConstructionPreferences();
    if (!preset) {
      setHasConstructionPreset(false);
      setConstructionPresetStatus("No preferred preset found.");
      return;
    }
    applyAppPreferences(preset);
    setHasConstructionPreset(true);
    setConstructionPresetStatus("Loaded preferred construction preset.");
  };

  const clearConstructionPreset = () => {
    const ok = clearStoredConstructionPreferences();
    if (!ok) {
      setConstructionPresetStatus("Could not clear preset (storage unavailable).");
      return;
    }
    setHasConstructionPreset(false);
    setConstructionPresetStatus("Cleared preferred construction preset.");
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        parseAndLoadText(text, file.name);
        fileHandleRef.current = null;
      } catch (err) {
        console.error("Failed to load file:", err);
        alert("Failed to load file. It might be corrupted or invalid.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="canvasTopActions canvasTopActionsLeft" aria-label="File controls">
        <button className="iconActionButton" onClick={() => void handleOpenClick()} title="Open File" aria-label="Open File">
          <FolderOpen size={16} />
        </button>
        <button className="iconActionButton" onClick={() => void handleSave()} title="Save File" aria-label="Save File">
          <Save size={16} />
        </button>
        <button className="iconActionButton" onClick={() => void handleSaveAs()} title="Save File As..." aria-label="Save File As...">
          <SaveAll size={16} />
        </button>
        <button
          className="iconActionButton"
          onClick={() => {
            setPreferencesTab("ui");
            setPreferencesOpen(true);
          }}
          title="Preferences"
          aria-label="Preferences"
        >
          <Settings size={16} />
        </button>
      </div>

      {preferencesOpen && (
        <div className="preferencesOverlay" role="presentation">
          <section className="preferencesModal" role="dialog" aria-label="Preferences" ref={preferencesDialogRef}>
            <div className="preferencesModalHeader">
              <h2 className="preferencesModalTitle">Preferences</h2>
              <button
                type="button"
                className="preferencesCloseButton"
                onClick={() => setPreferencesOpen(false)}
                aria-label="Close preferences"
              >
                <X size={14} />
              </button>
            </div>

            <div className="preferencesTabs" role="tablist" aria-label="Preferences categories">
              {PREFERENCES_TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={preferencesTab === tab.id}
                  className={preferencesTab === tab.id ? "preferencesTabButton active" : "preferencesTabButton"}
                  onClick={() => setPreferencesTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {preferencesTab === "ui" && (
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
            )}

            {preferencesTab === "construction" && (
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
            )}

            {preferencesTab === "presets" && (
              <>
                <div className="preferencesSectionTitle">Construction Preset</div>
                <div className="preferencesPresetActions">
                  <button
                    type="button"
                    className="preferencesResetButton"
                    onClick={saveConstructionPreset}
                  >
                    Save Current as Preferred
                  </button>
                  <button
                    type="button"
                    className="preferencesResetButton"
                    onClick={loadConstructionPreset}
                    disabled={!hasConstructionPreset}
                  >
                    Load Preferred
                  </button>
                  <button
                    type="button"
                    className="preferencesResetButton"
                    onClick={clearConstructionPreset}
                    disabled={!hasConstructionPreset}
                  >
                    Clear Preferred
                  </button>
                </div>
                <div className="preferencesPresetStatus">
                  {constructionPresetStatus || (hasConstructionPreset ? "Preferred preset is saved." : "No preferred preset saved yet.")}
                </div>

                <div className="preferencesHint">
                  UI theme is persisted across restarts and is not loaded from scene files.
                </div>
                <div className="preferencesHint">
                  Construction preset saves palette/default styles/tool defaults so you can re-apply them after opening any file.
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".geodraw,.json"
        style={{ display: "none" }}
      />
    </>
  );
}

function ProfileSwatch({ profileId }: { profileId: UiColorProfileId }) {
  const swatch = getUiColorProfileSwatch(profileId);
  return (
    <span
      className="profileSwatchVisual"
      style={{
        background: swatch.background,
        borderColor: swatch.line,
      }}
      aria-hidden
    >
      <span className="profileSwatchFill" style={{ background: swatch.fill }} />
      <span className="profileSwatchLine" style={{ background: swatch.line }} />
      <span
        className="profileSwatchDot"
        style={{
          background: swatch.dotFill,
          borderColor: swatch.dotStroke,
        }}
      />
    </span>
  );
}

function formatUiCssVariableLabel(name: UiCssVariableName): string {
  const cleaned = name.replace(/^--gd-ui-/, "");
  return cleaned
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function toColorInputValue(raw: string): string | null {
  const value = raw.trim();
  const shortHex = /^#([0-9a-fA-F]{3})$/.exec(value);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split("").map((digit) => parseInt(digit + digit, 16));
    return rgbToHex(r, g, b);
  }
  const fullHex = /^#([0-9a-fA-F]{6})$/.exec(value);
  if (fullHex) {
    return `#${fullHex[1].toLowerCase()}`;
  }
  const rgb = /^rgba?\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)(?:\s*,\s*([+-]?\d*(?:\.\d+)?))?\s*\)$/i.exec(
    value
  );
  if (rgb) {
    const r = clampColorChannel(Number(rgb[1]));
    const g = clampColorChannel(Number(rgb[2]));
    const b = clampColorChannel(Number(rgb[3]));
    return rgbToHex(r, g, b);
  }
  return null;
}

function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function toRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const match3 = /^#([0-9a-fA-F]{3})$/.exec(hex);
  if (match3) {
    const [r, g, b] = match3[1].split("").map((digit) => parseInt(digit + digit, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match6 = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (match6) {
    const raw = match6[1];
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function parsePositiveNumber(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseNonNegativeNumber(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function isValidSnapshot(data: unknown): data is HistorySnapshot {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (!obj.scene || typeof obj.scene !== "object") return false;
  if (typeof obj.activeTool !== "string") return false;
  const scene = obj.scene as Record<string, unknown>;
  if (!Array.isArray(scene.points)) return false;
  if (!Array.isArray(scene.lines)) return false;
  if (!Array.isArray(scene.circles)) return false;
  if (!Array.isArray(scene.segments)) return false;
  if (scene.angles !== undefined && !Array.isArray(scene.angles)) return false;
  if (scene.numbers !== undefined && !Array.isArray(scene.numbers)) return false;
  return true;
}
