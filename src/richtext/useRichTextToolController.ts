import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Camera, Viewport } from "../view/camera";
import type { ActiveTool, SelectedObject } from "../state/slices/storeTypes";
import type { SceneModel, SceneRichTextNode, SceneRichTextStyle } from "../scene/points";
import { cloneRichTextDocument } from "./model";
import type { RichTextDocument } from "./model";
import type { RichTextOverlay } from "./overlays";

type RichTextFieldPatch = Partial<Pick<SceneRichTextNode, "visible" | "name" | "positionWorld" | "boundsPx">>;

type ControllerParams = {
  activeTool: ActiveTool;
  scene: SceneModel;
  camera: Camera;
  vp: Viewport;
  recentCreatedObject: SelectedObject;
  richTextOverlays: RichTextOverlay[];
  setSelectedObject: (selected: SelectedObject) => void;
  updateRichTextFieldsByIds: (ids: string[], patch: RichTextFieldPatch) => void;
  updateRichTextStyleByIds: (ids: string[], patch: Partial<SceneRichTextStyle>) => void;
  updateRichTextDocumentByIds: (ids: string[], document: RichTextDocument) => void;
  deleteSelectedObject: () => void;
};

export type RichTextEditorSession = {
  id: string;
  overlay: RichTextOverlay;
  document: RichTextDocument;
  style: SceneRichTextStyle;
  shellStyle: CSSProperties;
  setDocument: (document: RichTextDocument) => void;
  commit: () => void;
  cancel: () => void;
  setMeasuredBounds: (bounds: { widthPx: number; heightPx: number }) => void;
};

export type RichTextControllerResult = {
  beginRichTextEditing: (id: string) => boolean;
  visibleRichTextOverlays: RichTextOverlay[];
  editorSession: RichTextEditorSession | null;
};

export function useRichTextToolController({
  activeTool,
  scene,
  camera,
  vp,
  recentCreatedObject,
  richTextOverlays,
  setSelectedObject,
  updateRichTextFieldsByIds,
  updateRichTextStyleByIds,
  updateRichTextDocumentByIds,
  deleteSelectedObject,
}: ControllerParams): RichTextControllerResult {
  void camera;
  void vp;
  void updateRichTextStyleByIds;
  const lastOpenedIdRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDocument, setDraftDocument] = useState<RichTextDocument | null>(null);
  const draftDocumentRef = useRef<RichTextDocument | null>(null);
  const [originalDocument, setOriginalDocument] = useState<RichTextDocument | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [measuredBounds, setMeasuredBounds] = useState<{ widthPx: number; heightPx: number } | null>(null);

  const editingNode = useMemo(
    () => (editingId ? (scene.richTextNodes ?? []).find((node) => node.id === editingId) ?? null : null),
    [editingId, scene.richTextNodes]
  );
  const editingOverlay = useMemo(
    () => (editingId ? richTextOverlays.find((overlay) => overlay.id === editingId) ?? null : null),
    [editingId, richTextOverlays]
  );

  const visibleRichTextOverlays = useMemo(
    () => (editingId ? richTextOverlays.filter((overlay) => overlay.id !== editingId) : richTextOverlays),
    [editingId, richTextOverlays]
  );

  const clearSession = useCallback(() => {
    setEditingId(null);
    setDraftDocument(null);
    draftDocumentRef.current = null;
    setOriginalDocument(null);
    setIsNew(false);
    setMeasuredBounds(null);
  }, []);

  const commitEditing = useCallback(() => {
    const documentToCommit = draftDocumentRef.current ?? draftDocument;
    if (!editingId || !documentToCommit) return;
    const serialized = JSON.stringify(documentToCommit);
    if (isNew && serialized === JSON.stringify(originalDocument)) {
      setSelectedObject({ type: "richText", id: editingId });
    }
    updateRichTextDocumentByIds([editingId], documentToCommit);
    if (measuredBounds) {
      updateRichTextFieldsByIds([editingId], { boundsPx: measuredBounds });
    }
    setSelectedObject({ type: "richText", id: editingId });
    clearSession();
  }, [clearSession, draftDocument, editingId, isNew, measuredBounds, originalDocument, setSelectedObject, updateRichTextDocumentByIds, updateRichTextFieldsByIds]);

  const cancelEditing = useCallback(() => {
    if (!editingId) return;
    const currentDraft = draftDocumentRef.current ?? draftDocument;
    if (isNew && originalDocument && JSON.stringify(originalDocument) === JSON.stringify(currentDraft)) {
      setSelectedObject({ type: "richText", id: editingId });
      deleteSelectedObject();
    } else if (originalDocument) {
      updateRichTextDocumentByIds([editingId], originalDocument);
    }
    clearSession();
  }, [clearSession, deleteSelectedObject, draftDocument, editingId, isNew, originalDocument, setSelectedObject, updateRichTextDocumentByIds]);

  const beginRichTextEditing = useCallback(
    (id: string, created = false): boolean => {
      const node = (scene.richTextNodes ?? []).find((item) => item.id === id);
      if (!node) return false;
      setSelectedObject({ type: "richText", id });
      setEditingId(id);
      const nextDocument = cloneRichTextDocument(node.document);
      const original = cloneRichTextDocument(node.document);
      draftDocumentRef.current = nextDocument;
      setDraftDocument(nextDocument);
      setOriginalDocument(original);
      setIsNew(created);
      return true;
    },
    [scene.richTextNodes, setSelectedObject]
  );

  useEffect(() => {
    const recentId = recentCreatedObject?.type === "richText" ? recentCreatedObject.id : null;
    if (!recentId || recentId === lastOpenedIdRef.current) return;
    lastOpenedIdRef.current = recentId;
    if (activeTool === "textbox") {
      beginRichTextEditing(recentId, true);
    }
  }, [activeTool, beginRichTextEditing, recentCreatedObject]);

  useEffect(() => {
    if (!editingId) return;
    const exists = (scene.richTextNodes ?? []).some((node) => node.id === editingId);
    if (!exists) clearSession();
  }, [clearSession, editingId, scene.richTextNodes]);

  useEffect(() => {
    if (!editingId) return;
    if (activeTool === "textbox" || activeTool === "move") return;
    commitEditing();
  }, [activeTool, commitEditing, editingId]);

  const setDraftDocumentAndSync = useCallback(
    (document: RichTextDocument) => {
      draftDocumentRef.current = document;
      setDraftDocument(document);
      if (!editingId) return;
      updateRichTextDocumentByIds([editingId], document);
    },
    [editingId, updateRichTextDocumentByIds]
  );

  const editorSession = useMemo<RichTextEditorSession | null>(() => {
    if (!editingNode || !editingOverlay || !draftDocument) return null;
    return {
      id: editingNode.id,
      overlay: editingOverlay,
      document: draftDocument,
      style: editingNode.style,
      shellStyle: {
        left: 0,
        top: 0,
        transform: `translate(${editingOverlay.x}px, ${editingOverlay.y}px) rotate(${editingOverlay.rotationDeg}deg)`,
        transformOrigin: "top left",
      },
      setDocument: setDraftDocumentAndSync,
      commit: commitEditing,
      cancel: cancelEditing,
      setMeasuredBounds: setMeasuredBounds,
    };
  }, [cancelEditing, commitEditing, draftDocument, editingNode, editingOverlay, setDraftDocumentAndSync]);

  return {
    beginRichTextEditing: (id: string) => beginRichTextEditing(id, false),
    visibleRichTextOverlays,
    editorSession,
  };
}
