import { DEFAULT_TEXT_EDITOR_COMPLETIONS } from "../catalog";
import { buildTextEditorModel } from "../model";
import { expandTextEditorSnippet } from "../snippets";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const expanded = expandTextEditorSnippet("\\frac{${1}}{${2}}");
assert(expanded.text === "\\frac{}{}", "frac snippet should expand to raw TeX text.");
assert(expanded.placeholders.length === 2, "frac snippet should expose two placeholders.");
assert(expanded.placeholders[0].start === expanded.placeholders[0].end, "first placeholder should be empty.");

const model = buildTextEditorModel("\\fra", { start: 4, end: 4 }, DEFAULT_TEXT_EDITOR_COMPLETIONS);
assert(model.query?.text === "\\fra", "completion query should capture the active TeX command.");
assert(model.completions.length > 0, "completion model should return matching entries.");
assert(model.completions[0].trigger === "\\frac", "frac should be the top completion for \\fra.");

const diagnostics = buildTextEditorModel("$\\frac{a}{b}", { start: 12, end: 12 }, DEFAULT_TEXT_EDITOR_COMPLETIONS);
assert(
  diagnostics.diagnostics.some((item) => item.message.includes("Inline math is still open")),
  "diagnostics should report unclosed inline math."
);

console.log("text-editor-model: ok");
