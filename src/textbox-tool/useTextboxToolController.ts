import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { Vec2 } from "../geo/vec2";
import {
  resolveTextLabelAlignment,
  resolveTextLabelBoxHeightPx,
  resolveTextLabelBoxWidthPx,
  resolveTextLabelRenderMode,
  resolveTextLabelToolKind,
  type SceneModel,
  type SceneTextLabelStyle,
} from "../scene/points";
import type { ActiveTool, SelectedObject } from "../state/slices/storeTypes";
import { camera as camMath, type Camera, type Viewport } from "../view/camera";
import type { TextLabelOverlay } from "../view/labelOverlays";

type TextLabelFieldPatch = Partial<
  Pick<NonNullable<SceneModel["textLabels"]>[number], "visible" | "text" | "name" | "positionWorld" | "contentMode" | "numberId" | "expr" | "toolKind">
>;

type TextboxToolControllerParams = {
  activeTool: ActiveTool;
  scene: SceneModel;
  camera: Camera;
  vp: Viewport;
  recentCreatedObject: SelectedObject;
  textLabelOverlays: TextLabelOverlay[];
  setSelectedObject: (selected: SelectedObject) => void;
  updateTextLabelFieldsByIds: (ids: string[], next: TextLabelFieldPatch) => void;
  updateTextLabelStyleByIds: (ids: string[], next: Partial<SceneTextLabelStyle>) => void;
  deleteSelectedObject: () => void;
};

type TextboxResizeState = {
  startClientX: number;
  startClientY: number;
  startWidth: number;
  startMinHeight: number;
};

export type TextboxEditorSession = {
  id: string;
  overlay: TextLabelOverlay;
  value: string;
  renderMode: ReturnType<typeof resolveTextLabelRenderMode>;
  widthPx: number | null;
  minHeightPx: number;
  resizeActive: boolean;
  topLeftScreen: Vec2 | null;
  textAlign: "left" | "center" | "right";
  shellStyle: CSSProperties;
  sourceStyle: CSSProperties;
  setValue: (value: string) => void;
  commit: () => void;
  cancel: () => void;
  onResizeStart: (clientX: number, clientY: number) => void;
  shouldIgnoreBlur: () => boolean;
};

export type TextboxToolControllerResult = {
  editorRef: MutableRefObject<HTMLElement | null>;
  beginTextLabelEditing: (id: string) => boolean;
  visibleTextLabelOverlays: TextLabelOverlay[];
  editorSession: TextboxEditorSession | null;
};

function rotateScreenVector(x: number, y: number, rotationDeg: number): Vec2 {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function computeTextBoxTopLeftScreen(centerScreen: Vec2, widthPx: number, heightPx: number, rotationDeg: number): Vec2 {
  const offset = rotateScreenVector(-widthPx / 2, -heightPx / 2, rotationDeg);
  return {
    x: centerScreen.x + offset.x,
    y: centerScreen.y + offset.y,
  };
}

function computeTextBoxCenterScreen(topLeftScreen: Vec2, widthPx: number, heightPx: number, rotationDeg: number): Vec2 {
  const offset = rotateScreenVector(widthPx / 2, heightPx / 2, rotationDeg);
  return {
    x: topLeftScreen.x + offset.x,
    y: topLeftScreen.y + offset.y,
  };
}

function clampEditingTextBoxRect(
  topLeftScreen: Vec2,
  widthPx: number,
  heightPx: number,
  vp: Viewport
): { topLeftScreen: Vec2; widthPx: number; heightPx: number } {
  const marginPx = 8;
  const maxWidth = Math.max(80, vp.widthPx - marginPx * 2);
  const maxHeight = Math.max(56, vp.heightPx - marginPx * 2);
  const clampedWidth = Math.max(80, Math.min(maxWidth, widthPx));
  const clampedHeight = Math.max(56, Math.min(maxHeight, heightPx));
  const maxX = Math.max(marginPx, vp.widthPx - marginPx - clampedWidth);
  const maxY = Math.max(marginPx, vp.heightPx - marginPx - clampedHeight);
  return {
    topLeftScreen: {
      x: Math.min(maxX, Math.max(marginPx, topLeftScreen.x)),
      y: Math.min(maxY, Math.max(marginPx, topLeftScreen.y)),
    },
    widthPx: clampedWidth,
    heightPx: clampedHeight,
  };
}

function focusEditableElementToEnd(element: HTMLElement | null): void {
  if (!element) return;
  element.focus();
  if (element instanceof HTMLTextAreaElement) {
    const caret = element.value.length;
    element.setSelectionRange(caret, caret);
    return;
  }
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function useTextboxToolController({
  activeTool,
  scene,
  camera,
  vp,
  recentCreatedObject,
  textLabelOverlays,
  setSelectedObject,
  updateTextLabelFieldsByIds,
  updateTextLabelStyleByIds,
  deleteSelectedObject,
}: TextboxToolControllerParams): TextboxToolControllerResult {
  const editorRef = useRef<HTMLElement | null>(null);
  const textboxResizeStateRef = useRef<TextboxResizeState | null>(null);
  const textboxResizeActiveRef = useRef(false);
  const lastOpenedTextboxIdRef = useRef<string | null>(null);
  const [editingTextLabelId, setEditingTextLabelId] = useState<string | null>(null);
  const [editingTextLabelValue, setEditingTextLabelValue] = useState("");
  const [editingTextLabelOriginalValue, setEditingTextLabelOriginalValue] = useState("");
  const [editingTextLabelIsNew, setEditingTextLabelIsNew] = useState(false);
  const [editingTextLabelWidthPx, setEditingTextLabelWidthPx] = useState<number | null>(null);
  const [editingTextLabelMinHeightPx, setEditingTextLabelMinHeightPx] = useState<number>(56);
  const [editingTextLabelResizeActive, setEditingTextLabelResizeActive] = useState(false);
  const [editingTextLabelTopLeftScreen, setEditingTextLabelTopLeftScreen] = useState<Vec2 | null>(null);

  const editingTextLabelOverlay = useMemo(
    () => (editingTextLabelId ? textLabelOverlays.find((label) => label.id === editingTextLabelId) ?? null : null),
    [editingTextLabelId, textLabelOverlays]
  );
  const editingTextLabel = useMemo(
    () => (editingTextLabelId ? (scene.textLabels ?? []).find((label) => label.id === editingTextLabelId) ?? null : null),
    [editingTextLabelId, scene.textLabels]
  );
  const editingTextLabelRenderMode = useMemo(
    () => (editingTextLabel ? resolveTextLabelRenderMode(editingTextLabel.style) : "plain"),
    [editingTextLabel]
  );
  const editingTextLabelWidth = useMemo(() => {
    if (typeof editingTextLabelWidthPx === "number" && Number.isFinite(editingTextLabelWidthPx)) {
      return Math.max(80, Math.min(960, editingTextLabelWidthPx));
    }
    return editingTextLabelOverlay?.boxWidthPx ?? null;
  }, [editingTextLabelOverlay?.boxWidthPx, editingTextLabelWidthPx]);
  const visibleTextLabelOverlays = useMemo(
    () => (editingTextLabelId ? textLabelOverlays.filter((label) => label.id !== editingTextLabelId) : textLabelOverlays),
    [editingTextLabelId, textLabelOverlays]
  );

  const clearTextLabelEditor = useCallback(() => {
    setEditingTextLabelId(null);
    setEditingTextLabelValue("");
    setEditingTextLabelOriginalValue("");
    setEditingTextLabelIsNew(false);
    setEditingTextLabelWidthPx(null);
    setEditingTextLabelMinHeightPx(56);
    setEditingTextLabelTopLeftScreen(null);
  }, []);

  const beginTextboxEditing = useCallback(
    (labelId: string, isNew: boolean) => {
      const label = (scene.textLabels ?? []).find((item) => item.id === labelId);
      if (!label) return false;
      const widthPx = resolveTextLabelBoxWidthPx(label.style) ?? 220;
      const heightPx = resolveTextLabelBoxHeightPx(label.style) ?? 56;
      const rotationDeg =
        typeof label.style.rotationDeg === "number" && Number.isFinite(label.style.rotationDeg) ? label.style.rotationDeg : 0;
      const centerScreen = camMath.worldToScreen(label.positionWorld, camera, vp);
      const clampedRect = clampEditingTextBoxRect(
        computeTextBoxTopLeftScreen(centerScreen, widthPx, heightPx, rotationDeg),
        widthPx,
        heightPx,
        vp
      );
      setSelectedObject({ type: "textLabel", id: labelId });
      setEditingTextLabelId(labelId);
      setEditingTextLabelValue(label.text);
      setEditingTextLabelOriginalValue(label.text);
      setEditingTextLabelIsNew(isNew);
      setEditingTextLabelWidthPx(clampedRect.widthPx);
      setEditingTextLabelMinHeightPx(clampedRect.heightPx);
      setEditingTextLabelTopLeftScreen(clampedRect.topLeftScreen);
      return true;
    },
    [camera, scene.textLabels, setSelectedObject, vp]
  );

  const beginTextLabelEditing = useCallback(
    (labelId: string): boolean => {
      const label = (scene.textLabels ?? []).find((item) => item.id === labelId);
      if (!label) return false;
      if (resolveTextLabelToolKind(label) !== "textbox") return false;
      return beginTextboxEditing(labelId, false);
    },
    [beginTextboxEditing, scene.textLabels]
  );

  const cancelTextboxEditing = useCallback(() => {
    if (editingTextLabelId && editingTextLabelIsNew && editingTextLabelOriginalValue.length === 0) {
      setSelectedObject({ type: "textLabel", id: editingTextLabelId });
      deleteSelectedObject();
    }
    clearTextLabelEditor();
  }, [
    clearTextLabelEditor,
    deleteSelectedObject,
    editingTextLabelId,
    editingTextLabelIsNew,
    editingTextLabelOriginalValue.length,
    setSelectedObject,
  ]);

  const commitTextboxEditing = useCallback(() => {
    if (!editingTextLabelId) return;
    setSelectedObject({ type: "textLabel", id: editingTextLabelId });
    if (editingTextLabelIsNew && editingTextLabelValue.length === 0) {
      deleteSelectedObject();
      clearTextLabelEditor();
      return;
    }
    const rotationDeg = editingTextLabelOverlay?.rotationDeg ?? 0;
    const finalWidthPx = editingTextLabelWidth ?? 220;
    const finalHeightPx = editingTextLabelMinHeightPx;
    const positionWorld = editingTextLabelTopLeftScreen
      ? camMath.screenToWorld(
          computeTextBoxCenterScreen(editingTextLabelTopLeftScreen, finalWidthPx, finalHeightPx, rotationDeg),
          camera,
          vp
        )
      : undefined;
    updateTextLabelFieldsByIds([editingTextLabelId], {
      text: editingTextLabelValue,
      contentMode: "static",
      toolKind: "textbox",
      positionWorld,
    });
    updateTextLabelStyleByIds([editingTextLabelId], {
      boxWidthPx: editingTextLabelWidth ?? undefined,
      boxHeightPx: editingTextLabelMinHeightPx,
    });
    clearTextLabelEditor();
  }, [
    camera,
    clearTextLabelEditor,
    deleteSelectedObject,
    editingTextLabelId,
    editingTextLabelIsNew,
    editingTextLabelMinHeightPx,
    editingTextLabelOverlay?.rotationDeg,
    editingTextLabelTopLeftScreen,
    editingTextLabelValue,
    editingTextLabelWidth,
    setSelectedObject,
    updateTextLabelFieldsByIds,
    updateTextLabelStyleByIds,
    vp,
  ]);

  const startResize = useCallback(
    (clientX: number, clientY: number) => {
      textboxResizeStateRef.current = {
        startClientX: clientX,
        startClientY: clientY,
        startWidth: editingTextLabelWidth ?? 220,
        startMinHeight: editingTextLabelMinHeightPx,
      };
      textboxResizeActiveRef.current = true;
      setEditingTextLabelResizeActive(true);
    },
    [editingTextLabelMinHeightPx, editingTextLabelWidth]
  );

  useEffect(() => {
    const recentTextboxId = recentCreatedObject?.type === "textLabel" ? recentCreatedObject.id : null;
    if (recentTextboxId === lastOpenedTextboxIdRef.current) return;
    lastOpenedTextboxIdRef.current = recentTextboxId;
    if (activeTool !== "textbox" || !recentTextboxId) return;
    const label = (scene.textLabels ?? []).find((item) => item.id === recentTextboxId);
    if (!label || resolveTextLabelToolKind(label) !== "textbox") return;
    beginTextboxEditing(recentTextboxId, true);
  }, [activeTool, beginTextboxEditing, recentCreatedObject, scene.textLabels]);

  useEffect(() => {
    if (!editingTextLabelId) return;
    const exists = (scene.textLabels ?? []).some((label) => label.id === editingTextLabelId);
    if (!exists) clearTextLabelEditor();
  }, [clearTextLabelEditor, editingTextLabelId, scene.textLabels]);

  useEffect(() => {
    if (!editingTextLabelId || activeTool === "textbox" || activeTool === "move") return;
    commitTextboxEditing();
  }, [activeTool, commitTextboxEditing, editingTextLabelId]);

  useEffect(() => {
    if (!editingTextLabelId) return;
    const editor = editorRef.current;
    if (!editor) return;
    window.requestAnimationFrame(() => {
      focusEditableElementToEnd(editorRef.current);
    });
  }, [editingTextLabelId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!(editor instanceof HTMLTextAreaElement)) return;
    editor.style.height = "0px";
    editor.style.height = `${Math.max(editingTextLabelMinHeightPx, editor.scrollHeight)}px`;
  }, [editingTextLabelMinHeightPx, editingTextLabelValue, editingTextLabelOverlay?.textSize, editingTextLabelWidth]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!(editor instanceof HTMLTextAreaElement)) return;
    const ro = new ResizeObserver(() => {
      const nextWidth = Math.round(editor.getBoundingClientRect().width);
      if (nextWidth <= 0) return;
      setEditingTextLabelWidthPx((prev) => (prev !== nextWidth ? nextWidth : prev));
    });
    ro.observe(editor);
    return () => ro.disconnect();
  }, [editingTextLabelId]);

  useEffect(() => {
    if (!editingTextLabelResizeActive) return;
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = textboxResizeStateRef.current;
      if (!resizeState) return;
      const deltaX = event.clientX - resizeState.startClientX;
      const deltaY = event.clientY - resizeState.startClientY;
      const nextWidth = resizeState.startWidth + deltaX;
      const nextMinHeight = resizeState.startMinHeight + deltaY;
      const clampedRect = clampEditingTextBoxRect(
        editingTextLabelTopLeftScreen ?? { x: 8, y: 8 },
        Math.round(nextWidth),
        Math.round(nextMinHeight),
        vp
      );
      setEditingTextLabelWidthPx(clampedRect.widthPx);
      setEditingTextLabelMinHeightPx(clampedRect.heightPx);
      if (editingTextLabelTopLeftScreen) {
        setEditingTextLabelTopLeftScreen(clampedRect.topLeftScreen);
      }
    };
    const handlePointerUp = () => {
      textboxResizeStateRef.current = null;
      textboxResizeActiveRef.current = false;
      setEditingTextLabelResizeActive(false);
      window.requestAnimationFrame(() => {
        focusEditableElementToEnd(editorRef.current);
      });
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [editingTextLabelResizeActive, editingTextLabelTopLeftScreen, vp]);

  useEffect(() => {
    if (!editingTextLabelId || !editingTextLabelTopLeftScreen) return;
    const clampedRect = clampEditingTextBoxRect(
      editingTextLabelTopLeftScreen,
      editingTextLabelWidth ?? 220,
      editingTextLabelMinHeightPx,
      vp
    );
    const topLeftChanged =
      Math.abs(clampedRect.topLeftScreen.x - editingTextLabelTopLeftScreen.x) > 0.5 ||
      Math.abs(clampedRect.topLeftScreen.y - editingTextLabelTopLeftScreen.y) > 0.5;
    if (topLeftChanged) {
      setEditingTextLabelTopLeftScreen(clampedRect.topLeftScreen);
    }
    if ((editingTextLabelWidth ?? 220) !== clampedRect.widthPx) {
      setEditingTextLabelWidthPx(clampedRect.widthPx);
    }
    if (editingTextLabelMinHeightPx !== clampedRect.heightPx) {
      setEditingTextLabelMinHeightPx(clampedRect.heightPx);
    }
  }, [editingTextLabelId, editingTextLabelMinHeightPx, editingTextLabelTopLeftScreen, editingTextLabelWidth, vp]);

  const editorSession = useMemo<TextboxEditorSession | null>(() => {
    if (!editingTextLabelOverlay) return null;
    return {
      id: editingTextLabelOverlay.id,
      overlay: editingTextLabelOverlay,
      value: editingTextLabelValue,
      renderMode: editingTextLabelRenderMode,
      widthPx: editingTextLabelWidth,
      minHeightPx: editingTextLabelMinHeightPx,
      resizeActive: editingTextLabelResizeActive,
      topLeftScreen: editingTextLabelTopLeftScreen,
      textAlign: resolveTextLabelAlignment(editingTextLabel?.style ?? { textColor: "#111111", textSize: 12, useTex: false }),
      shellStyle: {
        left: 0,
        top: 0,
        width: editingTextLabelWidth ? `${editingTextLabelWidth}px` : undefined,
        transform: editingTextLabelTopLeftScreen
          ? `translate(${editingTextLabelTopLeftScreen.x}px, ${editingTextLabelTopLeftScreen.y}px) rotate(${editingTextLabelOverlay.rotationDeg}deg)`
          : `translate(${editingTextLabelOverlay.x}px, ${editingTextLabelOverlay.y}px) translate(-50%, -50%) rotate(${editingTextLabelOverlay.rotationDeg}deg)`,
        transformOrigin: editingTextLabelTopLeftScreen ? "top left" : "center center",
        fontSize: `${Math.max(8, editingTextLabelOverlay.textSize)}px`,
        color: editingTextLabelOverlay.textColor,
      },
      sourceStyle: {
        textAlign: resolveTextLabelAlignment(editingTextLabel?.style ?? { textColor: "#111111", textSize: 12, useTex: false }),
      },
      setValue: setEditingTextLabelValue,
      commit: commitTextboxEditing,
      cancel: cancelTextboxEditing,
      onResizeStart: startResize,
      shouldIgnoreBlur: () => textboxResizeActiveRef.current,
    };
  }, [
    cancelTextboxEditing,
    commitTextboxEditing,
    editingTextLabel,
    editingTextLabelMinHeightPx,
    editingTextLabelOverlay,
    editingTextLabelRenderMode,
    editingTextLabelResizeActive,
    editingTextLabelTopLeftScreen,
    editingTextLabelValue,
    editingTextLabelWidth,
    startResize,
  ]);

  return {
    editorRef,
    beginTextLabelEditing,
    visibleTextLabelOverlays,
    editorSession,
  };
}
