import { useCallback, useRef, type CSSProperties, type MutableRefObject } from "react";
import type { SceneModel, SceneTextLabelStyle } from "../scene/points";
import type { ActiveTool, SelectedObject } from "../state/slices/storeTypes";
import type { TextLabelOverlay } from "../view/labelOverlays";

type TextLabelFieldPatch = Partial<
  Pick<
    NonNullable<SceneModel["textLabels"]>[number],
    "visible" | "text" | "name" | "positionWorld" | "contentMode" | "numberId" | "expr" | "toolKind"
  >
>;

type TextboxToolControllerParams = {
  activeTool: ActiveTool;
  scene: SceneModel;
  recentCreatedObject: SelectedObject;
  textLabelOverlays: TextLabelOverlay[];
  setSelectedObject: (selected: SelectedObject) => void;
  updateTextLabelFieldsByIds: (ids: string[], next: TextLabelFieldPatch) => void;
  updateTextLabelStyleByIds: (ids: string[], next: Partial<SceneTextLabelStyle>) => void;
  deleteSelectedObject: () => void;
};

export type TextboxEditorSession = {
  id: string;
  overlay: TextLabelOverlay;
  value: string;
  editorKind: "text" | "math";
  shellStyle: CSSProperties;
  sourceStyle: CSSProperties;
  setValue: (value: string) => void;
  commit: () => void;
  cancel: () => void;
  shouldIgnoreBlur: () => boolean;
};

export type TextboxToolControllerResult = {
  editorRef: MutableRefObject<HTMLElement | null>;
  beginTextLabelEditing: (id: string) => boolean;
  visibleTextLabelOverlays: TextLabelOverlay[];
  editorSession: TextboxEditorSession | null;
};

export function useTextboxToolController({
  textLabelOverlays,
}: TextboxToolControllerParams): TextboxToolControllerResult {
  const editorRef = useRef<HTMLElement | null>(null);

  // The textbox tool now uses the rich-text controller. This legacy controller must not
  // take over SceneTextLabel/Label Tool editing.
  const beginTextLabelEditing = useCallback(() => false, []);

  return {
    editorRef,
    beginTextLabelEditing,
    visibleTextLabelOverlays: textLabelOverlays,
    editorSession: null,
  };
}
