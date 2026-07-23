import { useRef } from "react";
import { open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useGeoStore } from "../../state/geoStore";
import type { HistorySnapshot } from "../../state/slices/historySlice";
import type { DocumentFilePatch, DocumentFileState } from "../useDocumentTabs";

export type PickerWindow = Window & {
    showSaveFilePicker?: (options?: {
        suggestedName?: string;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: {
        multiple?: boolean;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle[]>;
};

export function isValidSnapshot(data: unknown): data is HistorySnapshot {
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
    if (scene.labels !== undefined && !Array.isArray(scene.labels)) return false;
    return true;
}

export type UseFileOperationsOptions = {
    activeFile: DocumentFileState;
    updateActiveDocumentFile: (patch: DocumentFilePatch) => void;
    openSnapshotAsDocument: (snapshot: HistorySnapshot, file?: DocumentFilePatch) => void;
    buildActiveSnapshotJson: () => string;
};

export function useFileOperations({
    activeFile,
    updateActiveDocumentFile,
    openSnapshotAsDocument,
    buildActiveSnapshotJson,
}: UseFileOperationsOptions) {
    const fitViewToScene = useGeoStore((state) => state.fitViewToScene);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
        updateActiveDocumentFile({ fileHandle: handle, savedName: handle.name, tauriPath: null });
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

    const scheduleFitView = () => {
        const run = () => {
            const canvas = document.querySelector<HTMLCanvasElement>(".drawingCanvas");
            const rect = canvas?.getBoundingClientRect();
            const widthPx = rect?.width && rect.width > 1 ? rect.width : window.innerWidth;
            const heightPx = rect?.height && rect.height > 1 ? rect.height : window.innerHeight;
            fitViewToScene({ widthPx, heightPx });
        };
        requestAnimationFrame(() => requestAnimationFrame(run));
    };

    const parseSnapshotText = (text: string): HistorySnapshot => {
        const parsed = JSON.parse(text) as HistorySnapshot;
        if (!isValidSnapshot(parsed)) {
            throw new Error("Invalid GeoDraw file structure");
        }
        return parsed;
    };

    const openSnapshotText = (text: string, file: DocumentFilePatch) => {
        const snapshot = parseSnapshotText(text);
        openSnapshotAsDocument(snapshot, file);
        scheduleFitView();
    };

    const handleSaveAs = async () => {
        const json = buildActiveSnapshotJson();
        if (isTauri()) {
            try {
                const path = await tauriSave({
                    defaultPath: activeFile.savedName ?? defaultFileName(),
                    filters: [{ name: "GeoDraw File", extensions: ["geodraw", "json"] }],
                });
                if (!path) return;
                const normalizedPath = normalizeTauriPath(path);
                await writeTextFile(normalizedPath, json);
                updateActiveDocumentFile({
                    fileHandle: null,
                    savedName: baseName(normalizedPath),
                    tauriPath: normalizedPath,
                });
                return;
            } catch (err) {
                console.error("Failed to save file:", err);
                alert("Save failed. Check folder permissions and try again.");
                return;
            }
        }

        const picker = (window as PickerWindow).showSaveFilePicker;
        if (!picker) {
            const fileName = activeFile.savedName ?? defaultFileName();
            downloadFallback(json, fileName);
            updateActiveDocumentFile({ fileHandle: null, savedName: fileName, tauriPath: null });
            return;
        }
        try {
            const handle = await picker({
                suggestedName: activeFile.savedName ?? defaultFileName(),
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
        const json = buildActiveSnapshotJson();
        if (isTauri()) {
            const path = activeFile.tauriPath;
            if (path) {
                try {
                    await writeTextFile(path, json);
                    return;
                } catch (err) {
                    console.error("Failed to save file:", err);
                }
            }
            await handleSaveAs();
            return;
        }

        const handle = activeFile.fileHandle;
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
                openSnapshotText(text, {
                    fileHandle: null,
                    savedName: baseName(normalizedPath),
                    tauriPath: normalizedPath,
                });
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
            openSnapshotText(text, { fileHandle: handle, savedName: file.name, tauriPath: null });
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
                openSnapshotText(text, { fileHandle: null, savedName: file.name, tauriPath: null });
            } catch (err) {
                console.error("Failed to load file:", err);
                alert("Failed to load file. It might be corrupted or invalid.");
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    return {
        fileInputRef,
        handleSave,
        handleSaveAs,
        handleOpenClick,
        handleFileChange,
    };
}
