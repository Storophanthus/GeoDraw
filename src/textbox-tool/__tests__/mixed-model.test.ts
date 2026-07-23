import { DEFAULT_TEXT_EDITOR_COMPLETIONS } from "../catalog";
import { buildMixedTextEditorModel, findTextEditorMathContext } from "../model";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const plain = buildMixedTextEditorModel("Misalkan \\fra", { start: 14, end: 14 }, DEFAULT_TEXT_EDITOR_COMPLETIONS);
assert(plain.completions.length === 0, "plain text should not offer math completions.");
assert(plain.mathContext === null, "plain text should not be treated as math context.");

const openInline = buildMixedTextEditorModel("Misalkan $\\fra", { start: 15, end: 15 }, DEFAULT_TEXT_EDITOR_COMPLETIONS);
assert(openInline.mathContext?.kind === "inline", "open $... should create inline math context.");
assert(openInline.completions[0]?.trigger === "\\frac", "open inline math should resolve \\frac completion.");

const closedInline = findTextEditorMathContext("Misalkan $a^2+1$ dan", { start: 14, end: 14 });
assert(closedInline?.closed === true, "caret inside closed inline math should still resolve math context.");
assert(closedInline?.content === "a^2+1", "closed inline math context should expose inner content.");
assert(closedInline?.end === 16, "closed inline math context should include its closing delimiter.");

const display = findTextEditorMathContext("\\[x^2\\]", { start: 3, end: 3 });
assert(display?.kind === "display", "caret inside \\[...\\] should resolve display math context.");
assert(display?.content === "x^2", "display math context should expose inner content.");

console.log("textbox-mixed-model: ok");
