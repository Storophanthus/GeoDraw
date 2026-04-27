import {
  createEmptyMathGroup,
  createEmptyParagraph,
  normalizeRichTextDocument,
  type MathNode,
  type RichTextDocument,
  type RichTextInlineMathNode,
  type RichTextInlineNode,
  type RichTextParagraphNode,
} from "./richTextModel";
import { parseMathSourceToNode, serializeMathNodeToTex } from "./math";

export type RichTextSymbolCompletion = {
  id: string;
  trigger: string;
  label: string;
  insertText: string;
};

export const RICH_TEXT_SYMBOL_COMPLETIONS: RichTextSymbolCompletion[] = [
  { id: "alpha", trigger: "\\alpha", label: "\\alpha", insertText: "α" },
  { id: "beta", trigger: "\\beta", label: "\\beta", insertText: "β" },
  { id: "gamma", trigger: "\\gamma", label: "\\gamma", insertText: "γ" },
  { id: "delta", trigger: "\\delta", label: "\\delta", insertText: "δ" },
  { id: "theta", trigger: "\\theta", label: "\\theta", insertText: "θ" },
  { id: "lambda", trigger: "\\lambda", label: "\\lambda", insertText: "λ" },
  { id: "pi", trigger: "\\pi", label: "\\pi", insertText: "π" },
  { id: "sigma", trigger: "\\sigma", label: "\\sigma", insertText: "σ" },
  { id: "bbn", trigger: "\\mathbb{N}", label: "\\mathbb{N}", insertText: "ℕ" },
  { id: "bbz", trigger: "\\mathbb{Z}", label: "\\mathbb{Z}", insertText: "ℤ" },
  { id: "bbq", trigger: "\\mathbb{Q}", label: "\\mathbb{Q}", insertText: "ℚ" },
  { id: "bbr", trigger: "\\mathbb{R}", label: "\\mathbb{R}", insertText: "ℝ" },
  { id: "leq", trigger: "\\leq", label: "\\leq", insertText: "≤" },
  { id: "geq", trigger: "\\geq", label: "\\geq", insertText: "≥" },
  { id: "neq", trigger: "\\neq", label: "\\neq", insertText: "≠" },
  { id: "times", trigger: "\\times", label: "\\times", insertText: "×" },
  { id: "cdot", trigger: "\\cdot", label: "\\cdot", insertText: "·" },
  { id: "pm", trigger: "\\pm", label: "\\pm", insertText: "±" },
  { id: "to", trigger: "\\to", label: "\\to", insertText: "→" },
  { id: "mapsto", trigger: "\\mapsto", label: "\\mapsto", insertText: "↦" },
  { id: "in", trigger: "\\in", label: "\\in", insertText: "∈" },
  { id: "notin", trigger: "\\notin", label: "\\notin", insertText: "∉" },
  { id: "subset", trigger: "\\subset", label: "\\subset", insertText: "⊂" },
  { id: "subseteq", trigger: "\\subseteq", label: "\\subseteq", insertText: "⊆" },
  { id: "supset", trigger: "\\supset", label: "\\supset", insertText: "⊃" },
  { id: "cup", trigger: "\\cup", label: "\\cup", insertText: "∪" },
  { id: "cap", trigger: "\\cap", label: "\\cap", insertText: "∩" },
  { id: "infty", trigger: "\\infty", label: "\\infty", insertText: "∞" },
  { id: "forall", trigger: "\\forall", label: "\\forall", insertText: "∀" },
  { id: "exists", trigger: "\\exists", label: "\\exists", insertText: "∃" },
  { id: "angle", trigger: "\\angle", label: "\\angle", insertText: "∠" },
  { id: "triangle", trigger: "\\triangle", label: "\\triangle", insertText: "△" },
  { id: "circ", trigger: "\\circ", label: "\\circ", insertText: "∘" },
  { id: "degree", trigger: "\\degree", label: "\\degree", insertText: "°" },
  { id: "perp", trigger: "\\perp", label: "\\perp", insertText: "⊥" },
  { id: "parallel", trigger: "\\parallel", label: "\\parallel", insertText: "∥" },
  { id: "sim", trigger: "\\sim", label: "\\sim", insertText: "~" },
  { id: "cong", trigger: "\\cong", label: "\\cong", insertText: "≅" },
  { id: "equiv", trigger: "\\equiv", label: "\\equiv", insertText: "≡" },
  { id: "approx", trigger: "\\approx", label: "\\approx", insertText: "≈" },
];

export function createEmptyDocument(): RichTextDocument {
  return normalizeRichTextDocument({
    kind: "document",
    blocks: [createEmptyParagraph()],
  });
}

function pushTextChild(children: RichTextInlineNode[], text: string): void {
  if (text.length === 0) return;
  const last = children[children.length - 1];
  if (last?.kind === "text") {
    last.text += text;
    return;
  }
  children.push({ kind: "text", text });
}

function parseParagraphChildrenFromSource(source: string): RichTextInlineNode[] {
  const children: RichTextInlineNode[] = [];
  let index = 0;
  let buffer = "";
  while (index < source.length) {
    const ch = source[index];
    if (ch === "$") {
      const closing = source.indexOf("$", index + 1);
      if (closing === -1) {
        buffer += ch;
        index += 1;
        continue;
      }
      pushTextChild(children, buffer);
      buffer = "";
      const mathSource = source.slice(index + 1, closing);
      children.push({
        kind: "inlineMath",
        math: parseMathSourceToNode(mathSource),
        source: mathSource,
      });
      index = closing + 1;
      continue;
    }
    buffer += ch;
    index += 1;
  }
  pushTextChild(children, buffer);
  if (children.length === 0) {
    children.push({ kind: "text", text: "" });
  }
  return children;
}

export function parseRichTextSourceToDocument(sourceRaw: string): RichTextDocument {
  const source = sourceRaw.replace(/\r\n?/g, "\n");
  const blocks: RichTextDocument["blocks"] = [];
  let index = 0;
  let paragraphBuffer = "";

  const flushParagraphBuffer = (dropTrailingEmpty = false) => {
    if ((dropTrailingEmpty || blocks.length > 0) && paragraphBuffer.length === 0) return;
    const paragraphs = paragraphBuffer.split("\n");
    if (dropTrailingEmpty && paragraphs.length > 1 && paragraphs[paragraphs.length - 1] === "") {
      paragraphs.pop();
    }
    for (const paragraphSource of paragraphs) {
      blocks.push({
        kind: "paragraph",
        children: parseParagraphChildrenFromSource(paragraphSource),
      });
    }
    paragraphBuffer = "";
  };

  while (index < source.length) {
    if (source.startsWith("\\[", index)) {
      const closing = source.indexOf("\\]", index + 2);
      if (closing !== -1) {
        flushParagraphBuffer(true);
        const mathSource = source.slice(index + 2, closing);
        blocks.push({
          kind: "displayMath",
          math: parseMathSourceToNode(mathSource),
          source: mathSource,
          delimiter: "bracket",
        });
        index = closing + 2;
        if (source[index] === "\n") index += 1;
        continue;
      }
    }
    if (source.startsWith("$$", index)) {
      const closing = source.indexOf("$$", index + 2);
      if (closing !== -1) {
        flushParagraphBuffer(true);
        const mathSource = source.slice(index + 2, closing);
        blocks.push({
          kind: "displayMath",
          math: parseMathSourceToNode(mathSource),
          source: mathSource,
          delimiter: "dollar",
        });
        index = closing + 2;
        if (source[index] === "\n") index += 1;
        continue;
      }
    }
    paragraphBuffer += source[index];
    index += 1;
  }

  flushParagraphBuffer();
  return normalizeRichTextDocument({
    kind: "document",
    blocks: blocks.length > 0 ? blocks : [createEmptyParagraph()],
  });
}

export function serializeRichTextDocumentToSource(document: RichTextDocument): string {
  return document.blocks
    .map((block) => {
      if (block.kind === "displayMath") {
        const tex = extractDisplayMathSource(block);
        return block.delimiter === "bracket" ? `\\[${tex}\\]` : `$$${tex}$$`;
      }
      return block.children
        .map((child) => {
          if (child.kind === "text") return child.text;
          if (child.kind === "symbol") return child.text;
          return `$${extractInlineMathSource(child)}$`;
        })
        .join("");
    })
    .join("\n");
}

export function serializeRichTextDocumentToTex(document: RichTextDocument): string {
  return serializeRichTextDocumentToSource(document);
}

export function updateParagraphTextChild(
  document: RichTextDocument,
  blockIndex: number,
  inlineIndex: number,
  nextText: string
): RichTextDocument {
  const blocks = document.blocks.map((block, idx) => {
    if (idx !== blockIndex || block.kind !== "paragraph") return block;
    return {
      kind: "paragraph",
      children: block.children.map((child, childIdx) =>
        childIdx === inlineIndex && child.kind === "text" ? { kind: "text", text: nextText } : child
      ),
    } satisfies RichTextParagraphNode;
  });
  return normalizeRichTextDocument({ kind: "document", blocks });
}

export function replaceTextCommandWithSymbol(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  completion: RichTextSymbolCompletion
): { text: string; caret: number } {
  const query = findSlashQuery(text, selectionStart);
  if (!query) {
    const next = `${text.slice(0, selectionStart)}${completion.insertText}${text.slice(selectionEnd)}`;
    const caret = selectionStart + completion.insertText.length;
    return { text: next, caret };
  }
  const next = `${text.slice(0, query.start)}${completion.insertText}${text.slice(query.end)}`;
  const caret = query.start + completion.insertText.length;
  return { text: next, caret };
}

export function findSlashQuery(text: string, caret: number): { start: number; end: number; query: string } | null {
  const left = text.slice(0, caret);
  const match = /\\[A-Za-z{}]*$/.exec(left);
  if (!match) return null;
  const query = match[0];
  return {
    start: caret - query.length,
    end: caret,
    query,
  };
}

export function findMatchingSymbolCompletions(query: string): RichTextSymbolCompletion[] {
  if (!query.startsWith("\\")) return [];
  const lower = query.toLowerCase();
  return RICH_TEXT_SYMBOL_COMPLETIONS.filter((item) => item.trigger.toLowerCase().startsWith(lower));
}

export function insertInlineMathAfterTextSplit(
  document: RichTextDocument,
  blockIndex: number,
  inlineIndex: number,
  caret: number
): { document: RichTextDocument; nextInlineIndex: number } {
  const block = document.blocks[blockIndex];
  if (!block || block.kind !== "paragraph") return { document, nextInlineIndex: inlineIndex };
  const child = block.children[inlineIndex];
  if (!child || child.kind !== "text") return { document, nextInlineIndex: inlineIndex };
  const before = child.text.slice(0, caret);
  const after = child.text.slice(caret);
  const children: RichTextInlineNode[] = [
    ...block.children.slice(0, inlineIndex),
    { kind: "text", text: before },
    { kind: "inlineMath", math: createEmptyMathGroup(), source: "" } satisfies RichTextInlineMathNode,
    { kind: "text", text: after },
    ...block.children.slice(inlineIndex + 1),
  ];
  const blocks = document.blocks.map((item, idx) =>
    idx === blockIndex ? ({ kind: "paragraph", children } satisfies RichTextParagraphNode) : item
  );
  return {
    document: normalizeRichTextDocument({ kind: "document", blocks }),
    nextInlineIndex: inlineIndex + 1,
  };
}

export function insertDisplayMathAfterParagraph(
  document: RichTextDocument,
  blockIndex: number
): { document: RichTextDocument; nextBlockIndex: number } {
  const blocks = [...document.blocks];
  blocks.splice(blockIndex + 1, 0, { kind: "displayMath", math: createEmptyMathGroup(), source: "" }, createEmptyParagraph());
  return {
    document: normalizeRichTextDocument({ kind: "document", blocks }),
    nextBlockIndex: blockIndex + 1,
  };
}

export function splitParagraphAtSelection(
  document: RichTextDocument,
  blockIndex: number,
  inlineIndex: number,
  caret: number
): { document: RichTextDocument; nextBlockIndex: number } {
  const block = document.blocks[blockIndex];
  if (!block || block.kind !== "paragraph") return { document, nextBlockIndex: blockIndex };
  const child = block.children[inlineIndex];
  if (!child || child.kind !== "text") return { document, nextBlockIndex: blockIndex };
  const before = child.text.slice(0, caret);
  const after = child.text.slice(caret);
  const beforeChildren = [...block.children.slice(0, inlineIndex), { kind: "text" as const, text: before }];
  const afterChildren = [{ kind: "text" as const, text: after }, ...block.children.slice(inlineIndex + 1)];
  const blocks = [
    ...document.blocks.slice(0, blockIndex),
    { kind: "paragraph", children: beforeChildren } satisfies RichTextParagraphNode,
    { kind: "paragraph", children: afterChildren } satisfies RichTextParagraphNode,
    ...document.blocks.slice(blockIndex + 1),
  ];
  return {
    document: normalizeRichTextDocument({ kind: "document", blocks }),
    nextBlockIndex: blockIndex + 1,
  };
}

export function updateInlineMathNode(
  document: RichTextDocument,
  blockIndex: number,
  inlineIndex: number,
  source: string
): RichTextDocument {
  const blocks = document.blocks.map((block, idx) => {
    if (idx !== blockIndex || block.kind !== "paragraph") return block;
    return {
      kind: "paragraph",
      children: block.children.map((child, childIdx) =>
        childIdx === inlineIndex && child.kind === "inlineMath"
          ? { kind: "inlineMath" as const, math: parseMathSourceToNode(source), source }
          : child
      ),
    } satisfies RichTextParagraphNode;
  });
  return normalizeRichTextDocument({ kind: "document", blocks });
}

export function updateDisplayMathNode(
  document: RichTextDocument,
  blockIndex: number,
  source: string
): RichTextDocument {
  const blocks = document.blocks.map((block, idx) =>
    idx === blockIndex && block.kind === "displayMath"
      ? { kind: "displayMath" as const, math: parseMathSourceToNode(source), source, delimiter: block.delimiter }
      : block
  );
  return normalizeRichTextDocument({ kind: "document", blocks });
}

export function extractInlineMathSource(node: RichTextInlineMathNode): string {
  return typeof node.source === "string" ? node.source : serializeMathNodeToTex(node.math);
}

export function extractDisplayMathSource(node: { math: MathNode; source?: string }): string {
  return typeof node.source === "string" ? node.source : serializeMathNodeToTex(node.math);
}
