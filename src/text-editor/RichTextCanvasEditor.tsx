import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { parseTextLabelRichText } from "../text/textLabelRichText";
import { DEFAULT_TEXT_EDITOR_COMPLETIONS, type TextEditorCompletionItem } from "./catalog";
import { buildMixedTextEditorModel, type TextEditorMathContext } from "./model";
import { expandTextEditorSnippet, type TextEditorSnippetPlaceholder } from "./snippets";
import { TEXT_LABEL_CANVAS_SIZE_SCALE } from "../view/labelOverlays";
import { parseRichTextSourceToDocument, serializeRichTextDocumentToSource } from "./richTextDocument";
import { renderRichTextPreviewHtml } from "./richTextRender";
import type { RichTextDocument, RichTextStyle } from "./richTextModel";
import "./text-editor.css";
import "./richtext.css";

type EditorSelection = { start: number; end: number };

type ActiveMathView = {
  mode: "rendered" | "source";
  caretLocal: number | null;
  caretEdge: "start" | "end" | null;
};

type EditorParagraphSegment =
  | {
      kind: "text";
      sourceStart: number;
      sourceEnd: number;
      content: string;
    }
  | {
      kind: "inline-open";
      sourceStart: number;
      sourceEnd: number;
      content: string;
    }
  | {
      kind: "inline-active-source";
      sourceStart: number;
      sourceEnd: number;
      source: string;
      content: string;
      view: ActiveMathView;
    }
  | {
      kind: "inline-closed";
      sourceStart: number;
      sourceEnd: number;
      content: string;
      source: string;
    };

type EditorParagraphBlock = {
  kind: "paragraph";
  sourceStart: number;
  sourceEnd: number;
  segments: EditorParagraphSegment[];
};

type EditorDisplayBlock = {
  kind: "display-open" | "display-closed" | "display-active-source";
  sourceStart: number;
  sourceEnd: number;
  content: string;
  source: string;
  prefix: string;
  suffix: string;
  view?: ActiveMathView;
};

type EditorBlock = EditorParagraphBlock | EditorDisplayBlock;

type PlaceholderSession = {
  items: TextEditorSnippetPlaceholder[];
  activeIndex: number;
};

const SOURCE_START_ATTR = "data-richtext-source-start";
const SOURCE_END_ATTR = "data-richtext-source-end";
const SOURCE_ATOMIC_ATTR = "data-richtext-source-atomic";

export type RichTextCanvasEditorProps = {
  sessionKey: string;
  document: RichTextDocument;
  style: RichTextStyle;
  shellStyle: CSSProperties;
  onChangeDocument: (document: RichTextDocument) => void;
  onCommit: () => void;
  onCancel: () => void;
  onMeasure?: (bounds: { widthPx: number; heightPx: number }) => void;
};

function resolveDisplayFontSizePx(size: number): number {
  return Math.max(8, size) * TEXT_LABEL_CANVAS_SIZE_SCALE;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MATH_HTML_CACHE_LIMIT = 240;
const mathHtmlCache = new Map<string, string>();

function renderMathSourceHtml(source: string, displayMode: boolean): string {
  const key = `${displayMode ? "display" : "inline"}:${source}`;
  const cached = mathHtmlCache.get(key);
  if (cached !== undefined) return cached;
  const html = renderRichTextPreviewHtml(source, displayMode);
  mathHtmlCache.set(key, html);
  if (mathHtmlCache.size > MATH_HTML_CACHE_LIMIT) {
    const firstKey = mathHtmlCache.keys().next().value;
    if (firstKey) mathHtmlCache.delete(firstKey);
  }
  return html;
}

const COMMANDS_REQUIRING_ARGUMENTS = new Set([
  "\\frac",
  "\\dfrac",
  "\\tfrac",
  "\\sqrt",
  "\\binom",
  "\\text",
  "\\left",
  "\\hat",
  "\\vec",
  "\\overline",
  "\\begin",
  "\\pmod",
]);

const STRUCTURAL_COMMAND_ARGUMENT_COUNTS = new Map<string, number>([
  ["\\frac", 2],
  ["\\dfrac", 2],
  ["\\tfrac", 2],
  ["\\binom", 2],
  ["\\pmod", 1],
  ["\\sqrt", 1],
  ["\\text", 1],
  ["\\hat", 1],
  ["\\vec", 1],
  ["\\overline", 1],
]);

function skipMathWhitespace(source: string, index: number): number {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor] ?? "")) cursor += 1;
  return cursor;
}

function findBracedArgumentEnd(source: string, openIndex: number): number | null {
  if (source[openIndex] !== "{") return null;
  let depth = 0;
  for (let cursor = openIndex; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    const prev = source[cursor - 1] ?? "";
    if (char === "{" && prev !== "\\") depth += 1;
    if (char === "}" && prev !== "\\") {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
  }
  return null;
}

function hasIncompleteStructuralCommand(source: string): boolean {
  let cursor = 0;
  let leftRightDepth = 0;
  while (cursor < source.length) {
    if (source[cursor] !== "\\") {
      cursor += 1;
      continue;
    }
    let commandEnd = cursor + 1;
    while (/[A-Za-z]/.test(source[commandEnd] ?? "")) commandEnd += 1;
    const command = source.slice(cursor, commandEnd);
    if (command === "\\left") {
      leftRightDepth += 1;
      cursor = Math.max(commandEnd, cursor + 1);
      continue;
    }
    if (command === "\\right") {
      if (leftRightDepth === 0) return true;
      leftRightDepth -= 1;
      cursor = Math.max(commandEnd, cursor + 1);
      continue;
    }
    const argumentCount = STRUCTURAL_COMMAND_ARGUMENT_COUNTS.get(command);
    if (!argumentCount) {
      const maybeArgumentCursor = skipMathWhitespace(source, commandEnd);
      if (source[maybeArgumentCursor] === "{" && findBracedArgumentEnd(source, maybeArgumentCursor) === null) {
        return true;
      }
      cursor = Math.max(commandEnd, cursor + 1);
      continue;
    }

    let argumentCursor = commandEnd;
    for (let index = 0; index < argumentCount; index += 1) {
      argumentCursor = skipMathWhitespace(source, argumentCursor);
      if (argumentCursor >= source.length || source[argumentCursor] !== "{") return true;
      const nextArgumentCursor = findBracedArgumentEnd(source, argumentCursor);
      if (nextArgumentCursor === null) return true;
      argumentCursor = nextArgumentCursor;
    }
    cursor = Math.max(argumentCursor, commandEnd);
  }
  return leftRightDepth !== 0;
}

function hasIncompleteTrailingCommand(source: string): boolean {
  const match = /\\[A-Za-z]*$/.exec(source);
  if (!match) return false;
  const command = match[0];
  if (command === "\\") return true;
  if (COMMANDS_REQUIRING_ARGUMENTS.has(command)) return true;
  if (DEFAULT_TEXT_EDITOR_COMPLETIONS.some((item) => item.trigger === command)) return false;
  return DEFAULT_TEXT_EDITOR_COMPLETIONS.some((item) => item.trigger.startsWith(command) && item.trigger !== command);
}

function hasIncompleteMathCommand(source: string): boolean {
  return hasIncompleteTrailingCommand(source) || hasIncompleteStructuralCommand(source);
}

function resolveActiveMathView(
  context: TextEditorMathContext | null,
  selection: EditorSelection
): ActiveMathView {
  if (!context || selection.start !== selection.end) {
    return { mode: "rendered", caretLocal: null, caretEdge: null };
  }
  const caretLocal = Math.max(0, Math.min(selection.start - context.contentStart, context.content.length));
  if (context.content.length === 0 || hasIncompleteMathCommand(context.content)) {
    return { mode: "source", caretLocal, caretEdge: null };
  }
  if (caretLocal <= 0) return { mode: "rendered", caretLocal, caretEdge: "start" };
  if (caretLocal >= context.content.length) return { mode: "rendered", caretLocal, caretEdge: "end" };
  return { mode: "source", caretLocal, caretEdge: null };
}

function findActiveControlSequenceSource(
  context: TextEditorMathContext | null,
  selection: EditorSelection,
  activeView: ActiveMathView
): string | null {
  if (!context || activeView.mode !== "source" || selection.start !== selection.end) return null;
  const caretLocal = Math.max(0, Math.min(selection.start - context.contentStart, context.content.length));
  for (let cursor = caretLocal - 1; cursor >= 0; cursor -= 1) {
    const char = context.content[cursor];
    const prev = context.content[cursor - 1] ?? "";
    if (char === "\\" && prev !== "\\") {
      const afterSlash = context.content[cursor + 1] ?? "";
      if (afterSlash === "" || /[A-Za-z]/.test(afterSlash)) {
        return context.content.slice(cursor, caretLocal);
      }
      return null;
    }
    if (char === "\n" || char === "$") return null;
  }
  return null;
}

function replaceRange(source: string, start: number, end: number, replacement: string): string {
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function adjustPlaceholderSession(
  session: PlaceholderSession | null,
  previousValue: string,
  nextValue: string
): PlaceholderSession | null {
  if (!session) return null;
  const delta = nextValue.length - previousValue.length;
  if (delta === 0) return session;
  return {
    activeIndex: session.activeIndex,
    items: session.items.map((item, index) => {
      if (index < session.activeIndex) return item;
      if (index === session.activeIndex) {
        return {
          ...item,
          end: Math.max(item.start, item.end + delta),
        };
      }
      return {
        ...item,
        start: item.start + delta,
        end: item.end + delta,
      };
    }),
  };
}

function renderActiveMathSourceHtml(source: string, displayMode: boolean): string {
  if (hasIncompleteMathCommand(source)) {
    return `<span class="gdRichTextEditorMathRawSource">${escapeHtml(source.length > 0 ? source : " ")}</span>`;
  }
  const sourceWithVisibleEmptySlots = source.replace(/\{\}/g, "{\\Box}");
  return renderMathSourceHtml(sourceWithVisibleEmptySlots, displayMode);
}

function renderMathCaret(): string {
  return `<span class="gdRichTextEditorMathCaret" aria-hidden="true"></span>`;
}

function isCollapsedSelection(selection: EditorSelection): boolean {
  return selection.start === selection.end;
}

function normalizedSelectionRange(selection: EditorSelection): EditorSelection {
  return selection.start <= selection.end
    ? selection
    : { start: selection.end, end: selection.start };
}

function sourceRangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function renderTextWithSelection(
  content: string,
  sourceStart: number,
  sourceEnd: number,
  selection: EditorSelection
): string {
  if (isCollapsedSelection(selection)) {
    if (selection.start < sourceStart || selection.start > sourceEnd) {
      return `<span class="gdRichTextTextSegment" ${SOURCE_START_ATTR}="${sourceStart}" ${SOURCE_END_ATTR}="${sourceEnd}">${escapeHtml(content)}</span>`;
    }
    const localCaret = Math.max(0, Math.min(selection.start - sourceStart, content.length));
    return `<span class="gdRichTextTextSegment" ${SOURCE_START_ATTR}="${sourceStart}" ${SOURCE_END_ATTR}="${sourceEnd}">${escapeHtml(
      content.slice(0, localCaret)
    )}${renderMathCaret()}${escapeHtml(content.slice(localCaret))}</span>`;
  }

  const range = normalizedSelectionRange(selection);
  if (!sourceRangesOverlap(sourceStart, sourceEnd, range.start, range.end)) {
    return `<span class="gdRichTextTextSegment" ${SOURCE_START_ATTR}="${sourceStart}" ${SOURCE_END_ATTR}="${sourceEnd}">${escapeHtml(content)}</span>`;
  }

  const selectedStart = Math.max(sourceStart, range.start);
  const selectedEnd = Math.min(sourceEnd, range.end);
  const localStart = Math.max(0, selectedStart - sourceStart);
  const localEnd = Math.max(localStart, selectedEnd - sourceStart);

  return `<span class="gdRichTextTextSegment" ${SOURCE_START_ATTR}="${sourceStart}" ${SOURCE_END_ATTR}="${sourceEnd}">${[
    escapeHtml(content.slice(0, localStart)),
    `<span class="gdRichTextEditorSelection">${escapeHtml(content.slice(localStart, localEnd))}</span>`,
    escapeHtml(content.slice(localEnd)),
  ].join("")}</span>`;
}

function renderRawMathSourceWithCaret(source: string, caretLocal: number | null): string {
  if (caretLocal === null) return escapeHtml(source);
  const caret = Math.max(0, Math.min(caretLocal, source.length));
  const before = escapeHtml(source.slice(0, caret));
  const after = escapeHtml(source.slice(caret));
  return `${before}${renderMathCaret()}${after.length > 0 ? after : ""}`;
}

function renderActiveMathHtml(source: string, displayMode: boolean, view: ActiveMathView): string {
  if (view.mode === "source") {
    return `<span class="gdRichTextEditorMathRawSource">${renderRawMathSourceWithCaret(source, view.caretLocal)}</span>`;
  }
  const rendered = renderActiveMathSourceHtml(source, displayMode);
  return `${view.caretEdge === "start" ? renderMathCaret() : ""}${rendered}${
    view.caretEdge === "end" ? renderMathCaret() : ""
  }`;
}

function renderDisplayMathActiveHtml(source: string, view: ActiveMathView): string {
  const caretLocal =
    view.caretLocal === null
      ? view.caretEdge === "start"
        ? 0
        : view.caretEdge === "end"
          ? source.length
          : null
      : view.caretLocal;
  if (view.mode === "source" || source.trim().length === 0 || hasIncompleteMathCommand(source)) {
    return `<div class="gdRichTextDisplayMathRenderRow"><span class="gdRichTextEditorMathRawSource">${renderRawMathSourceWithCaret(
      source,
      caretLocal
    )}</span></div>`;
  }
  const rendered = renderMathSourceHtml(source.replace(/\{\}/g, "{\\Box}"), true);
  return `<div class="gdRichTextDisplayMathRenderRow">${view.caretEdge === "start" ? renderMathCaret() : ""}${rendered}${
    view.caretEdge === "end" ? renderMathCaret() : ""
  }</div>`;
}

function activeContextMatchesSegment(
  context: TextEditorMathContext | null,
  kind: TextEditorMathContext["kind"],
  sourceStart: number,
  sourceEnd: number
): boolean {
  if (!context || context.kind !== kind) return false;
  return sourceStart < context.end && sourceEnd > context.start;
}

function buildParagraphSegments(
  source: string,
  absoluteStart: number,
  activeMathContext: TextEditorMathContext | null,
  selection: EditorSelection
): EditorParagraphSegment[] {
  const segments = parseTextLabelRichText(source, { liveOpenMath: true });
  return segments.map((segment) => {
    const sourceStart = absoluteStart + segment.sourceStart;
    const sourceEnd = absoluteStart + segment.sourceEnd;
    if (segment.kind === "text") {
      return {
        kind: "text",
        sourceStart,
        sourceEnd,
        content: segment.content,
      };
    }
    if (activeContextMatchesSegment(activeMathContext, "inline", sourceStart, sourceEnd)) {
      return {
        kind: "inline-active-source",
        sourceStart,
        sourceEnd,
        source: source.slice(segment.sourceStart, segment.sourceEnd),
        content: segment.content,
        view: resolveActiveMathView(activeMathContext, selection),
      };
    }
    if (segment.open) {
      return {
        kind: "inline-open",
        sourceStart,
        sourceEnd,
        content: segment.content,
      };
    }
    return {
      kind: "inline-closed",
      sourceStart,
      sourceEnd,
      content: segment.content,
      source: source.slice(segment.sourceStart, segment.sourceEnd),
    };
  });
}

function pushParagraphBlocks(
  blocks: EditorBlock[],
  paragraphSource: string,
  paragraphStart: number,
  activeMathContext: TextEditorMathContext | null,
  selection: EditorSelection
): void {
  const lines = paragraphSource.split("\n");
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const start = paragraphStart + offset;
    const end = start + line.length;
    blocks.push({
      kind: "paragraph",
      sourceStart: start,
      sourceEnd: end,
      segments: buildParagraphSegments(line, start, activeMathContext, selection),
    });
    offset += line.length;
    if (index < lines.length - 1) offset += 1;
  }
}

function buildEditorBlocksFromSource(
  source: string,
  activeMathContext: TextEditorMathContext | null = null,
  selection: EditorSelection = { start: 0, end: 0 }
): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  let index = 0;
  let paragraphBuffer = "";
  let paragraphStart = 0;

  const flushParagraphBuffer = (dropTrailingEmpty = false) => {
    if ((dropTrailingEmpty || blocks.length > 0) && paragraphBuffer.length === 0) {
      paragraphStart = index;
      return;
    }
    const paragraphSource =
      dropTrailingEmpty && paragraphBuffer.endsWith("\n") ? paragraphBuffer.slice(0, -1) : paragraphBuffer;
    pushParagraphBlocks(blocks, paragraphSource, paragraphStart, activeMathContext, selection);
    paragraphBuffer = "";
    paragraphStart = index;
  };

  while (index < source.length) {
    const displayOpen = source.startsWith("\\[", index) ? "\\[" : source.startsWith("$$", index) ? "$$" : null;
    if (displayOpen) {
      const closing = displayOpen === "\\[" ? "\\]" : "$$";
      const closeIndex = source.indexOf(closing, index + displayOpen.length);
      flushParagraphBuffer(true);
      if (closeIndex !== -1) {
        const sourceStart = index;
        const sourceEnd = closeIndex + closing.length;
        blocks.push({
          kind: activeContextMatchesSegment(activeMathContext, "display", sourceStart, sourceEnd)
            ? "display-active-source"
            : "display-closed",
          sourceStart,
          sourceEnd,
          content: source.slice(index + displayOpen.length, closeIndex),
          source: source.slice(sourceStart, sourceEnd),
          prefix: displayOpen,
          suffix: closing,
          view: resolveActiveMathView(activeMathContext, selection),
        });
        index = sourceEnd;
        if (source[index] === "\n") index += 1;
        paragraphStart = index;
        continue;
      }
      blocks.push({
        kind: activeContextMatchesSegment(activeMathContext, "display", index, source.length)
          ? "display-active-source"
          : "display-open",
        sourceStart: index,
        sourceEnd: source.length,
        content: source.slice(index + displayOpen.length),
        source: source.slice(index),
        prefix: displayOpen,
        suffix: "",
        view: resolveActiveMathView(activeMathContext, selection),
      });
      return blocks;
    }

    if (paragraphBuffer.length === 0) paragraphStart = index;
    paragraphBuffer += source[index] ?? "";
    index += 1;
  }

  flushParagraphBuffer();
  return blocks.length > 0
    ? blocks
    : [
        {
          kind: "paragraph",
          sourceStart: 0,
          sourceEnd: 0,
          segments: buildParagraphSegments("", 0, activeMathContext, selection),
        },
      ];
}

function renderParagraphSegmentHtml(segment: EditorParagraphSegment, selection: EditorSelection): string {
  if (segment.kind === "text") {
    return renderTextWithSelection(segment.content, segment.sourceStart, segment.sourceEnd, selection);
  }
  if (segment.kind === "inline-open") {
    return `<span class="gdRichTextInlineMathActive gdRichTextEditorMathActive">${renderActiveMathSourceHtml(segment.content, false)}</span>`;
  }
  if (segment.kind === "inline-active-source") {
    return `<span class="gdRichTextInlineMathActive gdRichTextEditorMathActive">${renderActiveMathHtml(segment.content, false, segment.view)}</span>`;
  }
  const selected =
    !isCollapsedSelection(selection) &&
    sourceRangesOverlap(segment.sourceStart, segment.sourceEnd, normalizedSelectionRange(selection).start, normalizedSelectionRange(selection).end);
  const before = isCollapsedSelection(selection) && selection.start === segment.sourceStart ? renderMathCaret() : "";
  const after = isCollapsedSelection(selection) && selection.start === segment.sourceEnd ? renderMathCaret() : "";
  const className = selected
    ? "gdRichTextInlineMathClosed gdRichTextEditorMathClosed gdRichTextEditorSelection"
    : "gdRichTextInlineMathClosed gdRichTextEditorMathClosed";
  return `${before}<span class="${className}" ${SOURCE_START_ATTR}="${segment.sourceStart}" ${SOURCE_END_ATTR}="${segment.sourceEnd}" ${SOURCE_ATOMIC_ATTR}="true">${renderMathSourceHtml(
    segment.content,
    false
  )}</span>${after}`;
}

function renderEditorBlocksHtml(blocks: EditorBlock[], isEmpty: boolean, selection: EditorSelection): string {
  if (isEmpty) {
    return `<div class="gdRichTextParagraphRow">${renderMathCaret()}<span class="gdRichTextPreviewPlaceholder">Type text</span></div>`;
  }
  return blocks
    .map((block) => {
      if (block.kind === "display-open") {
        return `<div class="gdRichTextDisplayMathActive gdRichTextEditorMathActive">${renderDisplayMathActiveHtml(block.content, {
          mode: "source",
          caretLocal: block.content.length,
          caretEdge: null,
        })}</div>`;
      }
      if (block.kind === "display-active-source") {
        return `<div class="gdRichTextDisplayMathActive gdRichTextEditorMathActive">${renderDisplayMathActiveHtml(
          block.content,
          block.view ?? { mode: "rendered", caretLocal: null, caretEdge: null }
        )}</div>`;
      }
      if (block.kind === "display-closed") {
        const selected =
          !isCollapsedSelection(selection) &&
          sourceRangesOverlap(block.sourceStart, block.sourceEnd, normalizedSelectionRange(selection).start, normalizedSelectionRange(selection).end);
        const className = selected
          ? "gdRichTextDisplayMathClosed gdRichTextEditorMathClosed gdRichTextEditorSelection"
          : "gdRichTextDisplayMathClosed gdRichTextEditorMathClosed";
        return `<div class="${className}" ${SOURCE_START_ATTR}="${block.sourceStart}" ${SOURCE_END_ATTR}="${block.sourceEnd}" ${SOURCE_ATOMIC_ATTR}="true">${renderMathSourceHtml(
          block.content,
          true
        )}</div>`;
      }
      if (block.kind === "paragraph") {
        const content = block.segments.map((segment) => renderParagraphSegmentHtml(segment, selection)).join("");
        if (content.length > 0) {
          return `<div class="gdRichTextParagraphRow" ${SOURCE_START_ATTR}="${block.sourceStart}" ${SOURCE_END_ATTR}="${block.sourceEnd}">${content}</div>`;
        }
        const emptyCaret = isCollapsedSelection(selection) && selection.start === block.sourceStart ? renderMathCaret() : "";
        return `<div class="gdRichTextParagraphRow" ${SOURCE_START_ATTR}="${block.sourceStart}" ${SOURCE_END_ATTR}="${block.sourceEnd}">${emptyCaret || "&nbsp;"}</div>`;
      }
      return "";
    })
    .join("");
}

function findOpenInlineMathAtCaret(source: string, caret: number): { sourceEnd: number } | null {
  const blocks = buildEditorBlocksFromSource(source);
  for (const block of blocks) {
    if (block.kind !== "paragraph") continue;
    for (const segment of block.segments) {
      if (segment.kind === "inline-open" && segment.sourceEnd === caret) {
        return { sourceEnd: segment.sourceEnd };
      }
    }
  }
  return null;
}

function numericSourceAttr(element: HTMLElement, name: string): number | null {
  const raw = element.getAttribute(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function findSourceElement(node: Node | null, root: HTMLElement): HTMLElement | null {
  if (!node) return null;
  const element =
    node instanceof HTMLElement
      ? node
      : node.parentElement instanceof HTMLElement
        ? node.parentElement
        : null;
  const match = element?.closest<HTMLElement>(`[${SOURCE_START_ATTR}][${SOURCE_END_ATTR}]`) ?? null;
  return match && root.contains(match) ? match : null;
}

function textOffsetWithin(container: HTMLElement, targetNode: Node, targetOffset: number): number {
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    const text = current.textContent ?? "";
    if (current === targetNode) return total + Math.max(0, Math.min(targetOffset, text.length));
    total += text.length;
    current = walker.nextNode();
  }
  return total;
}

function sourceOffsetFromElementFallback(element: HTMLElement, clientX: number): number | null {
  const start = numericSourceAttr(element, SOURCE_START_ATTR);
  const end = numericSourceAttr(element, SOURCE_END_ATTR);
  if (start === null || end === null) return null;
  if (element.getAttribute(SOURCE_ATOMIC_ATTR) === "true") {
    const rect = element.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? start : end;
  }
  return clientX < element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2 ? start : end;
}

function sourceOffsetFromPoint(root: HTMLElement, clientX: number, clientY: number): number | null {
  const docWithCaret = root.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  let node: Node | null = null;
  let offset = 0;
  const position = docWithCaret.caretPositionFromPoint?.(clientX, clientY) ?? null;
  if (position) {
    node = position.offsetNode;
    offset = position.offset;
  } else {
    const range = docWithCaret.caretRangeFromPoint?.(clientX, clientY) ?? null;
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }

  if (node && root.contains(node)) {
    const sourceElement = findSourceElement(node, root);
    if (sourceElement) {
      const fallback = sourceOffsetFromElementFallback(sourceElement, clientX);
      if (sourceElement.getAttribute(SOURCE_ATOMIC_ATTR) === "true" || !(node instanceof Text)) return fallback;
      const start = numericSourceAttr(sourceElement, SOURCE_START_ATTR);
      const end = numericSourceAttr(sourceElement, SOURCE_END_ATTR);
      if (start === null || end === null) return fallback;
      return Math.max(start, Math.min(end, start + textOffsetWithin(sourceElement, node, offset)));
    }
  }

  const hit = root.ownerDocument.elementFromPoint(clientX, clientY);
  const sourceElement = findSourceElement(hit, root);
  return sourceElement ? sourceOffsetFromElementFallback(sourceElement, clientX) : null;
}

type CompletionListProps = {
  items: TextEditorCompletionItem[];
  activeIndex: number;
  queryText: string | null;
  onPick: (item: TextEditorCompletionItem) => void;
};

function CompletionList({ items, activeIndex, queryText, onPick }: CompletionListProps) {
  if (items.length === 0 && !queryText) return null;
  const visibleQuery = queryText?.startsWith("\\") ? queryText.slice(1) : queryText;
  return (
    <div className="gdTextEditorSuggestions gdRichTextEditorSuggestions">
      {visibleQuery ? (
        <div className="gdRichTextSuggestionQuery" aria-label="Typed command">
          <span>{visibleQuery}</span>
          <span className="gdRichTextSuggestionQueryCaret" aria-hidden="true" />
        </div>
      ) : null}
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={index === activeIndex ? "gdTextEditorSuggestion active" : "gdTextEditorSuggestion"}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item);
          }}
        >
          <span className="gdTextEditorSuggestionTrigger">{item.label}</span>
          <span className="gdTextEditorSuggestionDetail">{item.detail}</span>
        </button>
      ))}
    </div>
  );
}

export function RichTextCanvasEditor({
  sessionKey,
  document,
  style,
  shellStyle,
  onChangeDocument,
  onCommit,
  onMeasure,
}: RichTextCanvasEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sourceRef = useRef(serializeRichTextDocumentToSource(document));
  const pendingSelectionRef = useRef<EditorSelection | null>(null);
  const pointerSelectionAnchorRef = useRef<number | null>(null);
  const [source, setSource] = useState(() => sourceRef.current);
  const [selection, setSelection] = useState<EditorSelection>(() => {
    const end = sourceRef.current.length;
    return { start: end, end };
  });
  const selectionRef = useRef<EditorSelection>(selection);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState(0);
  const [placeholderSession, setPlaceholderSession] = useState<PlaceholderSession | null>(null);

  useLayoutEffect(() => {
    const initial = serializeRichTextDocumentToSource(document);
    const initialSelection = { start: initial.length, end: initial.length };
    sourceRef.current = initial;
    selectionRef.current = initialSelection;
    pendingSelectionRef.current = initialSelection;
    setSelection(initialSelection);
    setPlaceholderSession(null);
    setSource(initial);
  }, [sessionKey]);

  const editorModel = useMemo(
    () => buildMixedTextEditorModel(source, selection, DEFAULT_TEXT_EDITOR_COMPLETIONS),
    [selection, source]
  );
  const activeMathView = useMemo(
    () => resolveActiveMathView(editorModel.mathContext, selection),
    [editorModel.mathContext, selection]
  );
  const commandTruthText = useMemo(
    () => editorModel.query?.text ?? findActiveControlSequenceSource(editorModel.mathContext, selection, activeMathView),
    [activeMathView, editorModel.mathContext, editorModel.query?.text, selection]
  );
  const blocks = useMemo(
    () => buildEditorBlocksFromSource(source, editorModel.mathContext, selection),
    [editorModel.mathContext, selection, source]
  );
  const previewHtml = useMemo(
    () => renderEditorBlocksHtml(blocks, source.length === 0, selection),
    [blocks, selection, source.length]
  );

  useEffect(() => {
    setActiveCompletionIndex(0);
  }, [editorModel.query?.text]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && pendingSelectionRef.current) {
      const next = pendingSelectionRef.current;
      textarea.focus();
      textarea.setSelectionRange(next.start, next.end);
      pendingSelectionRef.current = null;
    }
  }, [selection]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !onMeasure) return;
    const rect = root.getBoundingClientRect();
    onMeasure({ widthPx: rect.width, heightPx: rect.height });
  }, [activeMathView.mode, onMeasure, source, style.textSize]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
  }, [sessionKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && root.contains(event.target)) return;
      onCommit();
    };
    root.ownerDocument.addEventListener("pointerdown", handlePointerDown, true);
    return () => root.ownerDocument.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onCommit]);

  const commitSourceToDocument = (nextSource: string) => {
    sourceRef.current = nextSource;
    setSource(nextSource);
    onChangeDocument(parseRichTextSourceToDocument(nextSource));
  };

  const syncSelectionFromTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const nextSelection = { start: textarea.selectionStart, end: textarea.selectionEnd };
    const current = selectionRef.current;
    if (current.start === nextSelection.start && current.end === nextSelection.end) return;
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  };

  const queueSelection = (nextSelection: EditorSelection) => {
    const current = selectionRef.current;
    if (current.start === nextSelection.start && current.end === nextSelection.end) {
      pendingSelectionRef.current = nextSelection;
      return;
    }
    selectionRef.current = nextSelection;
    pendingSelectionRef.current = nextSelection;
    setSelection(nextSelection);
  };

  const handleSourceChange = (nextSource: string, nextSelection: EditorSelection) => {
    setPlaceholderSession((current) => adjustPlaceholderSession(current, sourceRef.current, nextSource));
    queueSelection(nextSelection);
    commitSourceToDocument(nextSource);
  };

  const applyCompletion = (item: TextEditorCompletionItem) => {
    const query = editorModel.query;
    if (!query) return;
    const expanded = expandTextEditorSnippet(item.snippet);
    const shouldFinalizeControlWord =
      expanded.placeholders.length === 0 &&
      /^\\[A-Za-z]+$/.test(expanded.text) &&
      !COMMANDS_REQUIRING_ARGUMENTS.has(expanded.text);
    const replacementText = shouldFinalizeControlWord ? `${expanded.text} ` : expanded.text;
    const replaceEnd =
      shouldFinalizeControlWord && /\s/.test(sourceRef.current[query.replaceEnd] ?? "")
        ? query.replaceEnd + 1
        : query.replaceEnd;
    const nextSource = replaceRange(sourceRef.current, query.replaceStart, replaceEnd, replacementText);
    if (expanded.placeholders.length === 0) {
      const caret = query.replaceStart + replacementText.length;
      setPlaceholderSession(null);
      queueSelection({ start: caret, end: caret });
      commitSourceToDocument(nextSource);
      return;
    }
    const nextSession = {
      activeIndex: 0,
      items: expanded.placeholders.map((placeholder) => ({
        ...placeholder,
        start: placeholder.start + query.replaceStart,
        end: placeholder.end + query.replaceStart,
      })),
    };
    setPlaceholderSession(nextSession);
    const first = nextSession.items[0];
    queueSelection({ start: first.start, end: first.end });
    commitSourceToDocument(nextSource);
  };

  const jumpPlaceholder = (direction: -1 | 1): boolean => {
    if (!placeholderSession) return false;
    const nextIndex = placeholderSession.activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= placeholderSession.items.length) {
      setPlaceholderSession(null);
      return false;
    }
    const nextSession = { ...placeholderSession, activeIndex: nextIndex };
    setPlaceholderSession(nextSession);
    const item = nextSession.items[nextIndex];
    queueSelection({ start: item.start, end: item.end });
    return true;
  };

  const closeOpenInlineMathAtCaret = (): boolean => {
    const textarea = textareaRef.current;
    if (!textarea) return false;
    if (textarea.selectionStart !== textarea.selectionEnd) return false;
    const openInline = findOpenInlineMathAtCaret(sourceRef.current, textarea.selectionStart);
    if (!openInline) return false;
    const nextSource = `${sourceRef.current.slice(0, openInline.sourceEnd)}$${sourceRef.current.slice(openInline.sourceEnd)}`;
    const nextCaret = openInline.sourceEnd + 1;
    queueSelection({ start: nextCaret, end: nextCaret });
    commitSourceToDocument(nextSource);
    return true;
  };

  const moveAcrossMathBoundary = (direction: "left" | "right"): boolean => {
    const textarea = textareaRef.current;
    const context = editorModel.mathContext;
    if (!textarea || !context) return false;
    if (textarea.selectionStart !== textarea.selectionEnd) return false;
    const caret = textarea.selectionStart;
    if (direction === "left" && caret === context.contentStart) {
      queueSelection({ start: context.start, end: context.start });
      return true;
    }
    if (direction === "right" && context.closed && caret === context.contentEnd) {
      queueSelection({ start: context.end, end: context.end });
      return true;
    }
    return false;
  };

  const focusInput = () => {
    textareaRef.current?.focus();
  };

  const updatePointerSelection = (event: ReactPointerEvent<HTMLDivElement>, mode: "start" | "extend"): boolean => {
    const preview = previewRef.current;
    if (!preview) return false;
    const offset = sourceOffsetFromPoint(preview, event.clientX, event.clientY);
    if (offset === null) return false;
    const anchor = mode === "start" ? offset : pointerSelectionAnchorRef.current ?? offset;
    if (mode === "start") pointerSelectionAnchorRef.current = offset;
    queueSelection({ start: anchor, end: offset });
    focusInput();
    return true;
  };

  const editorStyle = {
    ...shellStyle,
    color: style.textColor,
    fontSize: `${resolveDisplayFontSizePx(style.textSize)}px`,
    textAlign: style.textAlign,
    "--gd-rich-text-caret": "transparent",
  } as CSSProperties & Record<"--gd-rich-text-caret", string>;

  return (
    <div
      ref={rootRef}
      className="gdRichTextEditorShell gdRichTextEditorHost"
      style={editorStyle}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="gdRichTextEditorBody">
        <div
          ref={previewRef}
          className="gdRichTextEditorPreview"
          aria-hidden
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            if (!updatePointerSelection(event, "start")) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (pointerSelectionAnchorRef.current === null || (event.buttons & 1) === 0) return;
            if (!updatePointerSelection(event, "extend")) return;
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            if (pointerSelectionAnchorRef.current === null) return;
            updatePointerSelection(event, "extend");
            pointerSelectionAnchorRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerCancel={(event) => {
            pointerSelectionAnchorRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        <textarea
          ref={textareaRef}
          className="gdRichTextSourceInput"
          value={source}
          spellCheck={false}
          wrap="off"
          rows={Math.max(1, source.split("\n").length)}
          onChange={(event) =>
            handleSourceChange(event.target.value, {
              start: event.target.selectionStart,
              end: event.target.selectionEnd,
            })
          }
          onSelect={syncSelectionFromTextarea}
          onKeyUp={syncSelectionFromTextarea}
          onClick={syncSelectionFromTextarea}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCommit();
              return;
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onCommit();
              return;
            }
            if (event.key === "ArrowDown" && editorModel.completions.length > 0) {
              event.preventDefault();
              setActiveCompletionIndex((prev) => (prev + 1) % editorModel.completions.length);
              return;
            }
            if (event.key === "ArrowUp" && editorModel.completions.length > 0) {
              event.preventDefault();
              setActiveCompletionIndex((prev) => (prev - 1 + editorModel.completions.length) % editorModel.completions.length);
              return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && editorModel.completions.length > 0) {
              event.preventDefault();
              const item = editorModel.completions[Math.min(activeCompletionIndex, editorModel.completions.length - 1)];
              if (item) applyCompletion(item);
              return;
            }
            if (event.key === "Tab" && jumpPlaceholder(event.shiftKey ? -1 : 1)) {
              event.preventDefault();
              return;
            }
            if (event.key === "ArrowLeft" && moveAcrossMathBoundary("left")) {
              event.preventDefault();
              return;
            }
            if (event.key === "ArrowRight" && moveAcrossMathBoundary("right")) {
              event.preventDefault();
              return;
            }
            if (event.key === "ArrowRight" && closeOpenInlineMathAtCaret()) {
              event.preventDefault();
            }
          }}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (nextTarget instanceof Node && event.currentTarget.parentElement?.contains(nextTarget)) return;
            onCommit();
          }}
        />
        <CompletionList
          items={editorModel.completions}
          activeIndex={activeCompletionIndex}
          queryText={commandTruthText}
          onPick={applyCompletion}
        />
      </div>
    </div>
  );
}
