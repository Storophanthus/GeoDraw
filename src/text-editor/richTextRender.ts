import katex from "katex";
import type { RichTextDocument, RichTextInlineNode, RichTextStyle } from "./richTextModel";
import { extractDisplayMathSource, extractInlineMathSource } from "./richTextDocument";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineNodeHtml(node: RichTextInlineNode): string {
  if (node.kind === "text") return escapeHtml(node.text).replace(/\n/g, "<br/>");
  if (node.kind === "symbol") return `<span class="gdRichTextSymbol">${escapeHtml(node.text)}</span>`;
  return `<span class="gdRichTextInlineMathToken">${renderRichTextPreviewHtml(extractInlineMathSource(node), false)}</span>`;
}

export function renderRichTextDocumentHtml(document: RichTextDocument): string {
  return document.blocks
    .map((block) => {
      if (block.kind === "displayMath") {
        return `<div class="gdRichTextDisplayBlock">${renderRichTextPreviewHtml(extractDisplayMathSource(block), true)}</div>`;
      }
      const content = block.children.map(renderInlineNodeHtml).join("");
      return `<div class="gdRichTextParagraph">${content.length > 0 ? content : "&nbsp;"}</div>`;
    })
    .join("");
}

export function buildRichTextTexSource(document: RichTextDocument): string {
  return document.blocks
    .map((block) => {
      if (block.kind === "displayMath") {
        const tex = extractDisplayMathSource(block);
        return block.delimiter === "bracket" ? `\\[${tex}\\]` : `$$${tex}$$`;
      }
      return block.children
        .map((node) => {
          if (node.kind === "text") return node.text;
          if (node.kind === "symbol") return node.text;
          return `$${extractInlineMathSource(node)}$`;
        })
        .join("");
    })
    .join("\n");
}

export function renderRichTextPreviewHtml(source: string, displayMode = false): string {
  return katex.renderToString(source || "\\,", {
    throwOnError: false,
    displayMode,
    strict: "ignore",
  });
}

export function resolveRichTextCss(style: RichTextStyle) {
  return {
    color: style.textColor,
    fontSize: `${Math.max(8, style.textSize)}px`,
    textAlign: style.textAlign,
  };
}
