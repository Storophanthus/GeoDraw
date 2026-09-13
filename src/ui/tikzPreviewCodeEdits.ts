import { diffArrays, diffLines, type ChangeObject } from "diff";

type Edit = { start: number; end: number; text: string };
export type PreviewCodeMerge =
  | { ok: true; code: string }
  | { ok: false; message: string };

// Compare complete numbers/dimensions and TeX commands, not individual digits.
// Otherwise changing 2.78pt to 1pt and to 2.90pt could silently produce 1.90pt.
const tokens = (text: string): string[] => text.match(
  /\\[a-zA-Z@]+|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[a-zA-Z]*|[a-zA-Z@]+|[ \t]+|\r?\n|./gu
) ?? [];

function changedRanges(changes: ChangeObject<string>[]): Edit[] {
  const edits: Edit[] = [];
  let offset = 0;
  let pending: Edit | undefined;
  for (const change of changes) {
    if (!change.added && !change.removed) {
      if (pending) edits.push(pending);
      pending = undefined;
      offset += change.value.length;
      continue;
    }
    pending ??= { start: offset, end: offset, text: "" };
    if (change.added) pending.text += change.value;
    else {
      offset += change.value.length;
      pending.end = offset;
    }
  }
  if (pending) edits.push(pending);
  return edits;
}

function editsFrom(base: string, next: string): Edit[] | null {
  // Line anchors prevent matching a repeated numeric value in another label.
  // Refine each changed block so separate options on one line can still merge.
  const lines = diffLines(base, next, { timeout: 100 });
  if (!lines) return null;
  const edits: Edit[] = [];
  for (const block of changedRanges(lines)) {
    const parts = diffArrays(tokens(base.slice(block.start, block.end)), tokens(block.text), {
      timeout: 100,
    });
    if (!parts) return null;
    for (const edit of changedRanges(parts.map((part) => ({ ...part, value: part.value.join("") })))) {
      edits.push({ ...edit, start: block.start + edit.start, end: block.start + edit.end });
    }
  }
  return edits;
}

/** Apply a UI change without discarding handwritten code. Conflicts are atomic:
 * callers keep the editor, generated baseline, parameters and label state.
 * This merges text, not TeX semantics; never guesses how to combine two edits
 * to the same value, or replaces an edited block with regenerated output.
 */
export function mergePreviewTikzCode(
  generatedBefore: string,
  editedCode: string,
  generatedAfter: string
): PreviewCodeMerge {
  if (editedCode === generatedBefore || editedCode === generatedAfter) {
    return { ok: true, code: generatedAfter };
  }
  if (generatedBefore === generatedAfter) return { ok: true, code: editedCode };
  const manual = editsFrom(generatedBefore, editedCode);
  const automatic = editsFrom(generatedBefore, generatedAfter);
  if (!manual || !automatic) {
    return { ok: false, message: "The code changes are too extensive to combine automatically. Your code and settings were kept." };
  }
  const combined = [...manual, ...automatic].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Edit[] = [];
  for (const edit of combined) {
    const previous = merged[merged.length - 1];
    if (previous) {
      if (edit.start === previous.start && edit.end === previous.end && edit.text === previous.text) continue;
      const overlaps = edit.start < previous.end ||
        // Insertions at a replacement boundary have ambiguous ordering.
        (edit.start === previous.end && (previous.start === previous.end || edit.start === edit.end));
      if (overlaps) {
        const offset = edit.start + manual
          .filter((change) => change.end <= edit.start)
          .reduce((delta, change) => delta + change.text.length - (change.end - change.start), 0);
        const line = editedCode.slice(0, offset).split("\n").length;
        return { ok: false, message: `This control also changes code you edited near line ${line}. Your code and settings were kept. Adjust that value in the code, or undo the conflicting edit and try again.` };
      }
    }
    merged.push(edit);
  }
  let cursor = 0;
  const out: string[] = [];
  for (const edit of merged) {
    out.push(generatedBefore.slice(cursor, edit.start), edit.text);
    cursor = edit.end;
  }
  out.push(generatedBefore.slice(cursor));
  return { ok: true, code: out.join("") };
}
