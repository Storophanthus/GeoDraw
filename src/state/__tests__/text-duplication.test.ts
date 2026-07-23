import { createInitialGeoState } from "../slices";
import { createSceneCoreActions } from "../slices/sceneCoreActions";
import type { GeoState } from "../slices/storeTypes";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

let state: GeoState = createInitialGeoState();
const actions = createSceneCoreActions({
  setState(updater) {
    state = updater(state);
  },
});

const textId = actions.createTextLabel({ x: 5, y: 7 }, "label");
state = {
  ...state,
  scene: {
    ...state.scene,
    textLabels: (state.scene.textLabels ?? []).map((label) =>
      label.id === textId ? { ...label, text: "hello", style: { ...label.style, rotationDeg: 15 } } : label
    ),
  },
};

const duplicateTextId = actions.duplicateTextLabel(textId, { x: 0.25, y: -0.25 });
assert(duplicateTextId === "txt_2", "Duplicated text label should use the next text label id.");
const sourceText = state.scene.textLabels?.find((label) => label.id === textId);
const duplicateText = state.scene.textLabels?.find((label) => label.id === duplicateTextId);
assert(Boolean(sourceText && duplicateText), "Text label duplicate should exist.");
assert(duplicateText?.text === "hello", "Text label duplicate should preserve text.");
assert(duplicateText?.style.rotationDeg === 15, "Text label duplicate should preserve style.");
assert(duplicateText?.positionWorld.x === 5.25 && duplicateText.positionWorld.y === 6.75, "Text label duplicate should use the supplied world offset.");
assert(state.selectedObject?.type === "textLabel" && state.selectedObject.id === duplicateTextId, "Text duplicate should become selected.");

const richTextId = actions.createRichTextNode({ x: -3, y: 4 });
const duplicateRichTextId = actions.duplicateRichTextNode(richTextId, { x: 0.25, y: -0.25 });
assert(duplicateRichTextId === "rt_2", "Duplicated rich textbox should use the next rich text id.");
const sourceRichText = state.scene.richTextNodes?.find((node) => node.id === richTextId);
const duplicateRichText = state.scene.richTextNodes?.find((node) => node.id === duplicateRichTextId);
assert(Boolean(sourceRichText && duplicateRichText), "Rich textbox duplicate should exist.");
assert(duplicateRichText?.document !== sourceRichText?.document, "Rich textbox duplicate should deep-clone the document.");
assert(duplicateRichText?.positionWorld.x === -2.75 && duplicateRichText.positionWorld.y === 3.75, "Rich textbox duplicate should use the supplied world offset.");
assert(state.selectedObject?.type === "richText" && state.selectedObject.id === duplicateRichTextId, "Rich textbox duplicate should become selected.");

assert(actions.copyTextObjectToClipboard({ type: "textLabel", id: textId }), "Text label copy should succeed.");
const pastedTextId = actions.pasteTextClipboard({ x: 2, y: 3 });
const pastedText = state.scene.textLabels?.find((label) => label.id === pastedTextId);
assert(pastedText?.text === "hello", "Pasted text label should preserve copied text.");
assert(pastedText?.positionWorld.x === 2 && pastedText.positionWorld.y === 3, "Context paste should use the requested world position.");
assert(state.textClipboard?.pasteCount === 1, "Context paste should advance clipboard paste count.");

assert(actions.copyTextObjectToClipboard({ type: "richText", id: richTextId }), "Rich textbox copy should succeed.");
const pastedRichTextId = actions.pasteTextClipboard(undefined, { x: 0.25, y: -0.25 });
const pastedRichText = state.scene.richTextNodes?.find((node) => node.id === pastedRichTextId);
assert(pastedRichText?.document !== sourceRichText?.document, "Pasted rich textbox should deep-clone the copied document.");
assert(pastedRichText?.positionWorld.x === -2.75 && pastedRichText.positionWorld.y === 3.75, "Keyboard-style paste should offset from the copied origin.");
assert(state.textClipboard?.pasteCount === 1, "Copying a new object should reset paste count before the first paste.");

console.log("text-duplication: ok");
