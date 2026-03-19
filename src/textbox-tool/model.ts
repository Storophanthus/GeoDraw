import type { TextEditorCompletionItem } from "./catalog";

export type TextEditorSelection = {
  start: number;
  end: number;
};

export type TextEditorCompletionQuery = {
  text: string;
  replaceStart: number;
  replaceEnd: number;
};

export type TextEditorDiagnostic = {
  id: string;
  severity: "info" | "warning";
  message: string;
};

export type TextEditorModel = {
  query: TextEditorCompletionQuery | null;
  completions: TextEditorCompletionItem[];
  diagnostics: TextEditorDiagnostic[];
};

function scoreCompletion(query: string, item: TextEditorCompletionItem): number {
  const normalizedQuery = query.toLowerCase();
  const haystacks = [item.trigger, item.label, ...(item.keywords ?? [])].map((value) => value.toLowerCase());
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < haystacks.length; i += 1) {
    const haystack = haystacks[i];
    if (haystack === normalizedQuery) best = Math.min(best, 0);
    else if (haystack.startsWith(normalizedQuery)) best = Math.min(best, 1);
    else if (haystack.includes(normalizedQuery)) best = Math.min(best, 2);
  }
  return best;
}

export function findTextEditorCompletionQuery(
  source: string,
  selection: TextEditorSelection
): TextEditorCompletionQuery | null {
  if (selection.start !== selection.end) return null;
  let cursor = selection.start;
  if (cursor < 0 || cursor > source.length) cursor = source.length;
  let start = cursor;
  while (start > 0) {
    const char = source[start - 1];
    if (/[A-Za-z]/.test(char)) {
      start -= 1;
      continue;
    }
    if (char === "\\") {
      start -= 1;
      break;
    }
    return null;
  }
  if (start >= cursor || source[start] !== "\\") return null;
  const text = source.slice(start, cursor);
  return { text, replaceStart: start, replaceEnd: cursor };
}

export function resolveTextEditorCompletions(
  source: string,
  selection: TextEditorSelection,
  catalog: TextEditorCompletionItem[],
  limit = 8
): { query: TextEditorCompletionQuery | null; completions: TextEditorCompletionItem[] } {
  const query = findTextEditorCompletionQuery(source, selection);
  if (!query) return { query: null, completions: [] };
  const ranked = catalog
    .map((item) => ({ item, score: scoreCompletion(query.text, item) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.item.trigger.localeCompare(b.item.trigger))
    .slice(0, limit)
    .map((entry) => entry.item);
  return { query, completions: ranked };
}

export function collectTextEditorDiagnostics(source: string): TextEditorDiagnostic[] {
  const diagnostics: TextEditorDiagnostic[] = [];
  const braceStack: number[] = [];
  let inlineMathOpen = false;
  let displayMathOpen = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1] ?? "";
    const prev = source[i - 1] ?? "";

    if (char === "{" && prev !== "\\") {
      braceStack.push(i);
      continue;
    }
    if (char === "}" && prev !== "\\") {
      if (braceStack.length === 0) {
        diagnostics.push({
          id: `brace-close-${i}`,
          severity: "warning",
          message: "Closing brace has no matching opening brace.",
        });
      } else {
        braceStack.pop();
      }
      continue;
    }
    if (char === "\\" && next === "[") {
      displayMathOpen = true;
      i += 1;
      continue;
    }
    if (char === "\\" && next === "]") {
      if (!displayMathOpen) {
        diagnostics.push({
          id: `display-close-${i}`,
          severity: "warning",
          message: "Display math closes without a matching opening \\[.",
        });
      }
      displayMathOpen = false;
      i += 1;
      continue;
    }
    if (char === "$" && prev !== "\\") {
      inlineMathOpen = !inlineMathOpen;
    }
  }

  for (let i = 0; i < braceStack.length; i += 1) {
    diagnostics.push({
      id: `brace-open-${braceStack[i]}`,
      severity: "warning",
      message: "Opening brace is still unclosed.",
    });
  }
  if (inlineMathOpen) {
    diagnostics.push({
      id: "inline-math-open",
      severity: "info",
      message: "Inline math is still open.",
    });
  }
  if (displayMathOpen) {
    diagnostics.push({
      id: "display-math-open",
      severity: "info",
      message: "Display math is still open.",
    });
  }
  return diagnostics.slice(0, 4);
}

export function buildTextEditorModel(
  source: string,
  selection: TextEditorSelection,
  catalog: TextEditorCompletionItem[]
): TextEditorModel {
  const { query, completions } = resolveTextEditorCompletions(source, selection, catalog);
  return {
    query,
    completions,
    diagnostics: collectTextEditorDiagnostics(source),
  };
}
