import { FolderOpen, Save, SaveAll, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { PreferencesDialog } from "./preferences/PreferencesDialog";
import { useFileOperations } from "./file-controls/useFileOperations";

const MENU_EVENT_FILE_OPEN = "gd-menu-file-open";
const MENU_EVENT_FILE_SAVE = "gd-menu-file-save";
const MENU_EVENT_FILE_SAVE_AS = "gd-menu-file-save-as";

export function FileControls() {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { fileInputRef, handleSave, handleSaveAs, handleOpenClick, handleFileChange } = useFileOperations();

  const openActionRef = useRef<() => Promise<void>>(async () => { });
  const saveActionRef = useRef<() => Promise<void>>(async () => { });
  const saveAsActionRef = useRef<() => Promise<void>>(async () => { });

  openActionRef.current = handleOpenClick;
  saveActionRef.current = handleSave;
  saveAsActionRef.current = handleSaveAs;

  useEffect(() => {
    const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object);
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

      <PreferencesDialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />

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
