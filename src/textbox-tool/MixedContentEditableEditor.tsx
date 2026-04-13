import type { MutableRefObject } from "react";

type DeprecatedMixedContentEditableEditorProps = {
  editorRef: MutableRefObject<HTMLElement | null>;
};

// Deprecated shim kept only to preserve old re-export paths during the text-tool rewrite.
// The new architecture no longer uses this component.
export function MixedContentEditableEditor({ editorRef }: DeprecatedMixedContentEditableEditorProps) {
  void editorRef;
  return null;
}
