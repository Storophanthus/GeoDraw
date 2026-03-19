# Textbox Tool Porting

This folder is the portable textbox-tool slice.

If you want to move it into another project such as `NoretanCanvas`, the real implementation you want is:

- `src/textbox-tool/useTextboxToolController.ts`
- `src/textbox-tool/CanvasTextEditor.tsx`
- `src/textbox-tool/MixedContentEditableEditor.tsx`
- `src/textbox-tool/catalog.ts`
- `src/textbox-tool/model.ts`
- `src/textbox-tool/snippets.ts`

The files under `src/text-editor/` are only compatibility wrappers now.

## What The Host App Must Provide

`useTextboxToolController(...)` expects these host-side inputs:

- `activeTool`
- `scene`
- `camera`
- `vp`
- `recentCreatedObject`
- `textLabelOverlays`
- `setSelectedObject(...)`
- `updateTextLabelFieldsByIds(...)`
- `updateTextLabelStyleByIds(...)`
- `deleteSelectedObject()`

That means the host app must already have:

- a scene model with `textLabels`
- a camera + viewport model
- a selection model
- a way to update text-label fields/styles
- a way to delete the selected object
- a text-label overlay builder

## Required Scene Shape

The controller assumes each text label has at least:

- `id`
- `text`
- `positionWorld`
- `contentMode`
- `toolKind`
- `style`

The style needs at least:

- `textColor`
- `textSize`
- `rotationDeg?`
- `boxWidthPx?`
- `boxHeightPx?`
- `textAlign?`
- fields needed by your `resolveTextLabelRenderMode(...)`

## Required Helpers

Right now the slice imports these GeoDraw-specific helpers:

- `resolveTextLabelAlignment(...)`
- `resolveTextLabelBoxHeightPx(...)`
- `resolveTextLabelBoxWidthPx(...)`
- `resolveTextLabelRenderMode(...)`
- `resolveTextLabelToolKind(...)`
- `camMath.worldToScreen(...)`
- `camMath.screenToWorld(...)`

For another project, you have two sane choices:

1. Keep the same helper names and provide compatible implementations.
2. Replace those imports with a small local adapter layer inside `src/textbox-tool/`.

For `NoretanCanvas`, option `2` is cleaner.

## Required Overlay Shape

`textLabelOverlays` must provide at least:

- `id`
- `x`
- `y`
- `textSize`
- `textColor`
- `rotationDeg`
- `renderMode`
- `textAlign`
- `boxWidthPx`
- `boxHeightPx`

The controller uses overlays for:

- locating the editor shell on canvas
- editor font/color
- hiding the active overlay while editing

## Minimal Wiring

In the host canvas view:

```tsx
const textboxTool = useTextboxToolController({
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
});
```

Then:

1. Pass `textboxTool.beginTextLabelEditing` into your canvas interaction layer.
2. Render `textboxTool.visibleTextLabelOverlays` instead of the raw full overlay list.
3. If `textboxTool.editorSession` exists, render `CanvasTextEditor`.

Example:

```tsx
{textboxTool.editorSession && (
  <CanvasTextEditor
    sessionKey={textboxTool.editorSession.id}
    editorRef={textboxTool.editorRef}
    value={textboxTool.editorSession.value}
    renderMode={textboxTool.editorSession.renderMode}
    textColor={textboxTool.editorSession.overlay.textColor}
    fontSizePx={Math.max(8, textboxTool.editorSession.overlay.textSize)}
    minHeightPx={textboxTool.editorSession.minHeightPx}
    resizeActive={textboxTool.editorSession.resizeActive}
    shouldIgnoreBlur={textboxTool.editorSession.shouldIgnoreBlur}
    sourceStyle={textboxTool.editorSession.sourceStyle}
    onChangeValue={textboxTool.editorSession.setValue}
    onCommit={textboxTool.editorSession.commit}
    onCancel={textboxTool.editorSession.cancel}
    onResizeStart={textboxTool.editorSession.onResizeStart}
    shellStyle={textboxTool.editorSession.shellStyle}
  />
)}
```

## Current Behavior Owned By This Slice

This slice now owns:

- begin edit
- commit edit
- cancel edit
- click/double-click entry callback
- newly created textbox auto-open
- resize state
- viewport clamping
- focus restore
- visible overlay filtering while editing
- auto-commit when switching away from `move` / `textbox`

So if `NoretanCanvas` already has its own version of any of those, decide which side owns it before merging.

## Non-Portable Parts

These are still app-specific and should stay outside the slice:

- how text labels are created
- general canvas pointer routing
- global selection semantics
- scene persistence/history
- export pipeline
- overlay generation

## Recommended Next Step For NoretanCanvas

Create one host adapter file, for example:

- `src/textbox-tool/hostAdapter.ts`

That file should translate `NoretanCanvas` types/helpers into the exact shape expected by `useTextboxToolController(...)`.

That keeps the slice portable and prevents GeoDraw-specific imports from leaking across the other project.
