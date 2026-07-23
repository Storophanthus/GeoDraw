# Text Tool Porting

`src/text-editor/` is the canonical home for GeoDraw's text editing stack.

It contains both:

- the current rich-text textbox implementation
- the shared text/math editor helpers and legacy lightweight editor pieces

The older folders still exist only as compatibility shims:

- `src/richtext/`
- `src/textbox-tool/`

If another app such as `NoretanCanvas` is porting the current GeoDraw textbox behavior, copy from `src/text-editor/`, not from those shim folders.

## Current Textbox Object

These files power the current rich-text textbox flow:

- `RichTextCanvasEditor.tsx`
- `useRichTextToolController.ts`
- `richTextOverlays.ts`
- `richTextRender.ts`
- `richTextDocument.ts`
- `richTextModel.ts`
- `math.ts`
- `richtext.css`

## Shared Editor Helpers

These files are used by the rich-text editor and can also support lighter-weight text/math editing:

- `CanvasTextEditor.tsx`
- `MixedContentEditableEditor.tsx`
- `MixedTextEditor.tsx`
- `StructuredMathEditor.tsx`
- `catalog.ts`
- `model.ts`
- `snippets.ts`
- `structuredMath.ts`
- `text-editor.css`

## Styling

The text stack no longer depends on `src/App.css`.

Relevant CSS lives beside the text modules:

- `src/text-editor/text-editor.css`
- `src/text-editor/richtext.css`
- `src/text/text-rendering.css`
- `src/view/canvas-labels.css`

The host app should also load KaTeX CSS:

```tsx
import "katex/dist/katex.min.css";
```

## Current Controller Split

- `useRichTextToolController(...)` is the active controller for GeoDraw's current textbox object.
- `useTextboxToolController(...)` is a legacy compatibility shim and intentionally returns no active editor session in GeoDraw.

## Extra Host Pieces

If the host app reuses GeoDraw's overlay layer too, also copy:

- `src/view/CanvasLabelsLayer.tsx`
- `src/view/canvas-labels.css`
- `src/text/text-rendering.css`
