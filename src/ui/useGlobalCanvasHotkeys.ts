import { useEffect } from "react";
import { useRef } from "react";
import type { ActiveTool } from "../state/geoStore";
import type { SelectedObject, TextClipboardObjectTarget } from "../state/slices/storeTypes";
import { TOOL_KEY_SHORTCUTS, resolveRecentToolShortcut, shouldTrackRecentNonMoveTool } from "./toolHotkeyState";

type GlobalHotkeysOptions = {
  activeTool: ActiveTool;
  selectedObject: SelectedObject;
  onSelectTool: (tool: ActiveTool) => void;
  onSetMoveTool: () => void;
  onClearCopyStyle: () => void;
  onDeleteSelectedObject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onCopyTextObjectToClipboard: (target: TextClipboardObjectTarget) => boolean;
  onPasteTextClipboard: () => string | null;
};

export function useGlobalCanvasHotkeys({
  activeTool,
  selectedObject,
  onSelectTool,
  onSetMoveTool,
  onClearCopyStyle,
  onDeleteSelectedObject,
  onUndo,
  onRedo,
  onFitView,
  onCopyTextObjectToClipboard,
  onPasteTextClipboard,
}: GlobalHotkeysOptions) {
  const recentNonMoveToolRef = useRef<ActiveTool | null>(null);

  useEffect(() => {
    if (!shouldTrackRecentNonMoveTool(activeTool)) return;
    recentNonMoveToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTextInput =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable === true;
      if (isTextInput) return;
      if (target?.closest?.('[role="dialog"]')) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (activeTool === "copyStyle") {
          onClearCopyStyle();
        }
        onSetMoveTool();
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "Tab") {
        const nextTool = resolveRecentToolShortcut(activeTool, recentNonMoveToolRef.current);
        if (!nextTool || nextTool === activeTool) return;
        e.preventDefault();
        onSelectTool(nextTool);
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
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "c") {
        if (selectedObject?.type !== "textLabel" && selectedObject?.type !== "richText") return;
        if (onCopyTextObjectToClipboard(selectedObject)) e.preventDefault();
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "v") {
        if (onPasteTextClipboard()) e.preventDefault();
        return;
      }
      if (!mod && !e.altKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        onFitView();
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const tool = TOOL_KEY_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          if (tool !== activeTool) onSelectTool(tool);
          return;
        }
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
    selectedObject,
    onSelectTool,
    onCopyTextObjectToClipboard,
    onClearCopyStyle,
    onDeleteSelectedObject,
    onFitView,
    onPasteTextClipboard,
    onRedo,
    onSetMoveTool,
    onUndo,
  ]);
}
