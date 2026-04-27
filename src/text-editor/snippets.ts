export type TextEditorSnippetPlaceholder = {
  index: number;
  start: number;
  end: number;
};

export type ExpandedTextEditorSnippet = {
  text: string;
  placeholders: TextEditorSnippetPlaceholder[];
};

const PLACEHOLDER_RE = /\$\{(\d+)(?::([^}]*))?\}/g;

export function expandTextEditorSnippet(template: string): ExpandedTextEditorSnippet {
  const placeholders: TextEditorSnippetPlaceholder[] = [];
  let text = "";
  let lastIndex = 0;

  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const full = match[0];
    const idxRaw = match[1];
    const defaultText = match[2] ?? "";
    const matchIndex = match.index ?? 0;
    text += template.slice(lastIndex, matchIndex);
    const start = text.length;
    text += defaultText;
    const end = text.length;
    placeholders.push({
      index: Number(idxRaw),
      start,
      end,
    });
    lastIndex = matchIndex + full.length;
  }

  text += template.slice(lastIndex);
  placeholders.sort((a, b) => a.index - b.index || a.start - b.start);
  return { text, placeholders };
}
