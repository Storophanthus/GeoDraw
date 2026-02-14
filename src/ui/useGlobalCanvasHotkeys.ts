import { useEffect } from "react";
import type { ActiveTool } from "../state/geoStore";

type GlobalHotkeysOptions = {
  activeTool: ActiveTool;
  onSetMoveTool: () => void;
  onClearCopyStyle: () => void;
  onDeleteSelectedObject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
};

export function useGlobalCanvasHotkeys({
  activeTool,
  onSetMoveTool,
  onClearCopyStyle,
  onDeleteSelectedObject,
  onUndo,
  onRedo,
  onFitView,
}: GlobalHotkeysOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTextInput =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable === true;
      if (isTextInput) return;

      if (e.key === "Escape" && activeTool === "copyStyle") {
        e.preventDefault();
        onClearCopyStyle();
        onSetMoveTool();
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        onRedo();
        return;
      }
      if (!mod && !e.altKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        onFitView();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDeleteSelectedObject();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeTool,
    onClearCopyStyle,
    onDeleteSelectedObject,
    onFitView,
    onRedo,
    onSetMoveTool,
    onUndo,
  ]);
}
