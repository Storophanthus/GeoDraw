import { FolderOpen, Save, SaveAll, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useGeoStore, getGeoStore } from "../state/geoStore";
import { takeHistorySnapshot, type HistorySnapshot } from "../state/slices/historySlice";
import {
  getUiCssVariables,
  getUiProfileBaseVariables,
  UI_CSS_VARIABLE_KEYS,
  UI_COLOR_PROFILE_OPTIONS,
  getUiColorProfileSwatch,
  type UiCssVariableName,
  type UiColorProfileId,
} from "../state/colorProfiles";

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

export function FileControls() {
  const loadSnapshot = useGeoStore((state) => state.loadSnapshot);
  const uiColorProfileId = useGeoStore((state) => state.uiColorProfileId);
  const uiCssOverrides = useGeoStore((state) => state.uiCssOverrides);
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
  const uiBaseVariables = useMemo(() => getUiProfileBaseVariables(uiColorProfileId), [uiColorProfileId]);
  const uiEffectiveVariables = useMemo(
    () => getUiCssVariables(uiColorProfileId, uiCssOverrides),
    [uiColorProfileId, uiCssOverrides]
  );
  const uiOverrideCount = useMemo(() => Object.keys(uiCssOverrides).length, [uiCssOverrides]);

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
          onClick={() => setPreferencesOpen(true)}
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
                {uiOverrideCount === 0 ? "Using preset values" : `${uiOverrideCount} custom token${uiOverrideCount === 1 ? "" : "s"}`}
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
              This changes UI colors only. Canvas/object palette stays in the left toolbar palette tool.
            </div>
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
