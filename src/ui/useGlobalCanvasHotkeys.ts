import { useEffect } from "react";
import { useRef } from "react";
import type { ActiveTool } from "../state/geoStore";
import type { SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";
import type { Vec2 } from "../geo/vec2";
import { resolveRecentToolShortcut, shouldTrackRecentNonMoveTool } from "./toolHotkeyState";

type TextLabelClipboardPayload = {
  text: string;
  toolKind?: "label" | "textbox";
  contentMode?: "static" | "number" | "expression";
  numberId?: string;
  expr?: string;
  visible: boolean;
  style: {
    textColor: string;
    textSize: number;
    useTex: boolean;
    textMode?: "tex" | "plain" | "mixed";
    rotationDeg?: number;
  };
};

type GlobalHotkeysOptions = {
  activeTool: ActiveTool;
  selectedObject: SelectedObject;
  textLabels: NonNullable<SceneModel["textLabels"]>;
  onSelectTool: (tool: ActiveTool) => void;
  onSetMoveTool: () => void;
  onClearCopyStyle: () => void;
  onDeleteSelectedObject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onPasteTextLabel: (payload: TextLabelClipboardPayload, world: Vec2) => void;
};

export function useGlobalCanvasHotkeys({
  activeTool,
  selectedObject,
  textLabels,
  onSelectTool,
  onSetMoveTool,
  onClearCopyStyle,
  onDeleteSelectedObject,
  onUndo,
  onRedo,
  onFitView,
  onPasteTextLabel,
}: GlobalHotkeysOptions) {
  const copiedTextLabelRef = useRef<{
    payload: TextLabelClipboardPayload;
    origin: Vec2;
    pasteCount: number;
  } | null>(null);
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
        if (selectedObject?.type !== "textLabel") return;
        const label = textLabels.find((item) => item.id === selectedObject.id);
        if (!label) return;
        copiedTextLabelRef.current = {
          payload: {
            text: label.text,
            toolKind: label.toolKind,
            contentMode: label.contentMode ?? "static",
            numberId: label.numberId,
            expr: label.expr,
            visible: label.visible,
            style: { ...label.style },
          },
          origin: { ...label.positionWorld },
          pasteCount: 0,
        };
        e.preventDefault();
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "v") {
        const copied = copiedTextLabelRef.current;
        if (!copied) return;
        const nextPasteCount = copied.pasteCount + 1;
        copied.pasteCount = nextPasteCount;
        const step = 0.35;
        onPasteTextLabel(copied.payload, {
          x: copied.origin.x + step * nextPasteCount,
          y: copied.origin.y - step * nextPasteCount,
        });
        e.preventDefault();
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
    selectedObject,
    textLabels,
    onSelectTool,
    onClearCopyStyle,
    onDeleteSelectedObject,
    onFitView,
    onPasteTextLabel,
    onRedo,
    onSetMoveTool,
    onUndo,
  ]);
}
