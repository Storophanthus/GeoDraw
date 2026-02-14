
import { FolderOpen, Save, SaveAll } from "lucide-react";
import { useRef, useState } from "react";
import { open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useGeoStore, getGeoStore } from "../state/geoStore";
import { takeHistorySnapshot, type HistorySnapshot } from "../state/slices/historySlice";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const tauriPathRef = useRef<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

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
      <div className="canvasTopActions" aria-label="File controls" style={{ left: 16 }}>
        <button className="iconActionButton" onClick={handleOpenClick} title="Open File" aria-label="Open File">
          <FolderOpen size={16} />
        </button>
        <button className="iconActionButton" onClick={handleSave} title="Save File" aria-label="Save File">
          <Save size={16} />
        </button>
        <button className="iconActionButton" onClick={handleSaveAs} title="Save File As..." aria-label="Save File As...">
          <SaveAll size={16} />
        </button>
      </div>
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
