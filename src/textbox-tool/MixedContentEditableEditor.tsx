import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
} from "react";
import katex from "katex";
import { DEFAULT_TEXT_EDITOR_COMPLETIONS, type TextEditorCompletionItem } from "./catalog";
import { resolveTextEditorCompletions, type TextEditorSelection } from "./model";
import { expandTextEditorSnippet, type TextEditorSnippetPlaceholder } from "./snippets";

type MixedContentEditableEditorProps = {
  editorRef: MutableRefObject<HTMLElement | null>;
  value: string;
  textColor: string;
  fontSizePx: number;
  minHeightPx: number;
  textAlign?: "left" | "center" | "right";
  completions?: TextEditorCompletionItem[];
  onChangeValue: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

type EditorNode =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "math"; text: string; display: boolean };

type PlaceholderSession = {
  items: TextEditorSnippetPlaceholder[];
  activeIndex: number;
};

type MathCompletionState = {
  query: { text: string; replaceStart: number; replaceEnd: number };
  completions: TextEditorCompletionItem[];
};

const CARET_SENTINEL = "\u200b";

function createIdFactory() {
  let counter = 0;
  return () => `textbox-node-${counter++}`;
}

function parseSourceToNodes(source: string, nextId: () => string): EditorNode[] {
  const nodes: EditorNode[] = [];
  let mode: "text" | "inlineMath" | "displayMath" = "text";
  let buffer = "";

  const pushText = (text: string) => {
    if (text.length === 0) return;
    nodes.push({ id: nextId(), kind: "text", text });
  };

  const pushMath = (text: string, display: boolean) => {
    nodes.push({ id: nextId(), kind: "math", text, display });
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (mode === "text") {
      if (char === "\\" && next === "[") {
        pushText(buffer);
        buffer = "";
        mode = "displayMath";
        index += 1;
        continue;
      }
      if (char === "\\") {
        if (next === "$" || next === "[" || next === "]" || next === "\\") {
          buffer += next;
          index += 1;
          continue;
        }
      }
      if (char === "$") {
        pushText(buffer);
        buffer = "";
        mode = "inlineMath";
        continue;
      }
      buffer += char;
      continue;
    }

    if (mode === "inlineMath") {
      if (char === "\\" && next === "$") {
        buffer += "\\$";
        index += 1;
        continue;
      }
      if (char === "$") {
        pushMath(buffer, false);
        buffer = "";
        mode = "text";
        continue;
      }
      buffer += char;
      continue;
    }

    if (char === "\\" && next === "]") {
      pushMath(buffer, true);
      buffer = "";
      mode = "text";
      index += 1;
      continue;
    }
    buffer += char;
  }

  if (mode === "text") {
    pushText(buffer);
  } else {
    pushMath(buffer, mode === "displayMath");
  }

  if (nodes.length === 0) {
    nodes.push({ id: nextId(), kind: "text", text: "" });
  }

  return nodes;
}

function serializeNodes(nodes: EditorNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === "text") return node.text;
      return node.display ? `\\[${node.text}\\]` : `$${node.text}$`;
    })
    .join("");
}

function normalizeNodes(nodes: EditorNode[], nextId: () => string): EditorNode[] {
  const normalized: EditorNode[] = [];
  for (const node of nodes) {
    if (node.kind === "text") {
      const last = normalized[normalized.length - 1];
      if (last?.kind === "text") {
        last.text += node.text;
      } else if (node.text.length > 0 || normalized.length === 0) {
        normalized.push({ ...node });
      }
      continue;
    }
    normalized.push({ ...node });
  }
  if (normalized.length === 0) {
    normalized.push({ id: nextId(), kind: "text", text: "" });
    return normalized;
  }
  if (normalized[normalized.length - 1]?.kind === "math") {
    normalized.push({ id: nextId(), kind: "text", text: "" });
  }
  return normalized;
}

function renderCompletionPreview(item: TextEditorCompletionItem): string {
  const latex = item.snippet
    .replace(/\$\{\d+(?::([^}]*))?\}/g, (_match, defaultText: string | undefined) => defaultText ?? "\\square")
    .replace(/\n/g, " ");
  return katex.renderToString(latex, {
    throwOnError: false,
    displayMode: latex.includes("\\begin{"),
    strict: "ignore",
  });
}

function renderMathNode(node: Extract<EditorNode, { kind: "math" }>): string {
  return katex.renderToString(node.text || "\\,", {
    throwOnError: false,
    displayMode: node.display,
    strict: "ignore",
  });
}

function stripCaretSentinels(text: string): string {
  return text.split(CARET_SENTINEL).join("");
}

function getLogicalTextLength(text: string, domOffset = text.length): number {
  let logicalLength = 0;
  for (let index = 0; index < Math.min(domOffset, text.length); index += 1) {
    if (text[index] !== CARET_SENTINEL) {
      logicalLength += 1;
    }
  }
  return logicalLength;
}

function getDomOffsetFromLogicalText(text: string, logicalOffset: number): number {
  if (text.length === 0) return 0;
  let logicalCount = 0;
  let sawSentinel = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === CARET_SENTINEL) {
      sawSentinel = true;
      continue;
    }
    if (logicalCount === logicalOffset) {
      return index;
    }
    logicalCount += 1;
    if (logicalCount === logicalOffset) {
      return index + 1;
    }
  }
  return sawSentinel ? text.length : Math.min(logicalOffset, text.length);
}

function readEditableText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return stripCaretSentinels(node.textContent ?? "");
  if (node instanceof HTMLBRElement) return "\n";
  return Array.from(node.childNodes).map(readEditableText).join("");
}

function getNodeLogicalLength(node: Node): number {
  return readEditableText(node).length;
}

function serializeBoundaryOffset(root: HTMLElement, targetNode: Node, targetOffset: number): number {
  let logicalOffset = 0;

  const visit = (node: Node): boolean => {
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        logicalOffset += getLogicalTextLength(node.textContent ?? "", targetOffset);
        return true;
      }
      if (node instanceof HTMLElement) {
        const children = Array.from(node.childNodes);
        for (let index = 0; index < Math.min(targetOffset, children.length); index += 1) {
          logicalOffset += getNodeLogicalLength(children[index]!);
        }
        return true;
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      logicalOffset += getLogicalTextLength(node.textContent ?? "");
      return false;
    }
    if (node instanceof HTMLBRElement) {
      logicalOffset += 1;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (visit(child)) return true;
    }
    return false;
  };

  visit(root);
  return logicalOffset;
}

function serializeSelection(root: HTMLElement): TextEditorSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return {
    start: serializeBoundaryOffset(root, range.startContainer, range.startOffset),
    end: serializeBoundaryOffset(root, range.endContainer, range.endOffset),
  };
}

function restoreSelection(root: HTMLElement, selectionValue: TextEditorSelection): void {
  const selection = window.getSelection();
  if (!selection) return;

  const findBoundary = (targetOffset: number): { node: Node; offset: number } | null => {
    if (root.childNodes.length === 0) {
      return { node: root, offset: 0 };
    }
    let remaining = targetOffset;
    let fallback: { node: Node; offset: number } | null = null;

    const walk = (node: Node): { node: Node; offset: number } | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        const logicalLength = getLogicalTextLength(text);
        fallback = { node, offset: getDomOffsetFromLogicalText(text, logicalLength) };
        if (remaining <= logicalLength) {
          return { node, offset: getDomOffsetFromLogicalText(text, remaining) };
        }
        remaining -= logicalLength;
        return null;
      }
      if (node instanceof HTMLBRElement) {
        const parent = node.parentNode;
        if (!parent) return null;
        const index = Array.from(parent.childNodes).indexOf(node);
        if (remaining <= 1) return { node: parent, offset: Math.max(0, index) };
        remaining -= 1;
        return null;
      }
      for (const child of Array.from(node.childNodes)) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };

    return walk(root) ?? fallback;
  };

  const start = findBoundary(selectionValue.start);
  const end = findBoundary(selectionValue.end);
  if (!start || !end) return;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function replaceRange(source: string, selection: TextEditorSelection, replacement: string): { text: string; selection: TextEditorSelection } {
  const start = Math.max(0, Math.min(selection.start, selection.end));
  const end = Math.max(start, Math.max(selection.start, selection.end));
  const text = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
  const caret = start + replacement.length;
  return {
    text,
    selection: { start: caret, end: caret },
  };
}

function resolveTextOffsetFromPoint(element: HTMLElement, event: MouseEvent<HTMLElement>): number {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (typeof doc.caretPositionFromPoint === "function") {
    const caret = doc.caretPositionFromPoint(event.clientX, event.clientY);
    if (caret && element.contains(caret.offsetNode)) {
      return serializeBoundaryOffset(element, caret.offsetNode, caret.offset);
    }
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(event.clientX, event.clientY);
    if (range && element.contains(range.startContainer)) {
      return serializeBoundaryOffset(element, range.startContainer, range.startOffset);
    }
  }
  return readEditableText(element).length;
}

export function MixedContentEditableEditor({
  editorRef,
  value,
  textColor,
  fontSizePx,
  minHeightPx,
  textAlign = "left",
  completions = DEFAULT_TEXT_EDITOR_COMPLETIONS,
  onChangeValue,
  onCommit,
  onCancel,
}: MixedContentEditableEditorProps) {
  const idFactoryRef = useRef(createIdFactory());
  const nextId = idFactoryRef.current;
  const initialNodesRef = useRef<EditorNode[] | null>(null);
  if (!initialNodesRef.current) {
    initialNodesRef.current = normalizeNodes(parseSourceToNodes(value, nextId), nextId);
  }
  const [nodes, setNodes] = useState<EditorNode[]>(() => initialNodesRef.current!);
  const [activeNodeId, setActiveNodeId] = useState<string>(() => initialNodesRef.current![initialNodesRef.current!.length - 1]!.id);
  const [activeSelection, setActiveSelection] = useState<TextEditorSelection>({ start: 0, end: 0 });
  const [placeholderSession, setPlaceholderSession] = useState<PlaceholderSession | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState(0);
  const activeEditorRef = useRef<HTMLSpanElement | null>(null);
  const pendingSelectionRef = useRef<TextEditorSelection | null>(null);

  const activeNode = useMemo(() => nodes.find((node) => node.id === activeNodeId) ?? nodes[nodes.length - 1]!, [activeNodeId, nodes]);
  const mathCompletionState = useMemo<MathCompletionState | null>(() => {
    if (activeNode.kind !== "math") return null;
    if (activeSelection.start !== activeSelection.end) return null;
    const { query, completions: resolved } = resolveTextEditorCompletions(activeNode.text, activeSelection, completions);
    if (!query || resolved.length === 0) return null;
    return { query, completions: resolved };
  }, [activeNode, activeSelection, completions]);

  useEffect(() => {
    editorRef.current = activeEditorRef.current;
    return () => {
      if (editorRef.current === activeEditorRef.current) editorRef.current = null;
    };
  }, [editorRef, activeNodeId]);

  useLayoutEffect(() => {
    const editor = activeEditorRef.current;
    if (!editor) return;
    const desiredDomText = activeNode.text.length === 0 ? CARET_SENTINEL : activeNode.text;
    if ((editor.textContent ?? "") !== desiredDomText) {
      editor.textContent = desiredDomText;
    }
    const pending = pendingSelectionRef.current ?? activeSelection;
    restoreSelection(editor, pending);
    pendingSelectionRef.current = null;
    editor.focus();
  }, [activeNode, activeSelection]);

  useEffect(() => {
    setActiveCompletionIndex(0);
  }, [mathCompletionState?.query.text]);

  const commitNodes = (nextNodesInput: EditorNode[], nextActiveNodeId: string, nextSelection: TextEditorSelection) => {
    const nextNodes = normalizeNodes(nextNodesInput, nextId);
    setNodes(nextNodes);
    setActiveNodeId(nextActiveNodeId);
    setActiveSelection(nextSelection);
    pendingSelectionRef.current = nextSelection;
    setPlaceholderSession(null);
    onChangeValue(serializeNodes(nextNodes));
  };

  const updateActiveNodeText = (text: string, nextSelection: TextEditorSelection = activeSelection) => {
    const nextNodes = nodes.map((node) => (node.id === activeNode.id ? { ...node, text } : node));
    setNodes(nextNodes);
    setActiveSelection(nextSelection);
    pendingSelectionRef.current = nextSelection;
    onChangeValue(serializeNodes(nextNodes));
  };

  const syncSelectionFromActiveEditor = () => {
    const editor = activeEditorRef.current;
    if (!editor) return;
    const selection = serializeSelection(editor);
    if (!selection) return;
    setActiveSelection(selection);
  };

  const syncActiveNodeFromDom = () => {
    const editor = activeEditorRef.current;
    if (!editor) return;
    const text = readEditableText(editor);
    const selection = serializeSelection(editor) ?? activeSelection;
    setActiveSelection(selection);
    setNodes((current) => {
      const nextNodes = current.map((node) => (node.id === activeNode.id ? { ...node, text } : node));
      onChangeValue(serializeNodes(nextNodes));
      return nextNodes;
    });
  };

  const activateNode = (nodeId: string, selection: TextEditorSelection) => {
    setActiveNodeId(nodeId);
    setActiveSelection(selection);
    pendingSelectionRef.current = selection;
    setPlaceholderSession(null);
  };

  const activatePreviousNode = () => {
    const index = nodes.findIndex((node) => node.id === activeNode.id);
    if (index <= 0) return false;
    const previous = nodes[index - 1]!;
    const caret = previous.text.length;
    activateNode(previous.id, { start: caret, end: caret });
    return true;
  };

  const activateNextNode = () => {
    const index = nodes.findIndex((node) => node.id === activeNode.id);
    if (index < 0 || index >= nodes.length - 1) return false;
    const next = nodes[index + 1]!;
    activateNode(next.id, { start: 0, end: 0 });
    return true;
  };

  const enterMathMode = () => {
    if (activeNode.kind !== "text") return;
    const start = Math.max(0, Math.min(activeSelection.start, activeSelection.end));
    const end = Math.max(start, Math.max(activeSelection.start, activeSelection.end));
    const before = activeNode.text.slice(0, start);
    const selected = activeNode.text.slice(start, end);
    const after = activeNode.text.slice(end);
    const mathNode: EditorNode = { id: nextId(), kind: "math", text: selected, display: false };
    const replacement: EditorNode[] = [];
    if (before.length > 0) replacement.push({ id: activeNode.id, kind: "text", text: before });
    replacement.push(mathNode);
    const trailingTextNode: EditorNode = { id: nextId(), kind: "text", text: after };
    replacement.push(trailingTextNode);
    const index = nodes.findIndex((node) => node.id === activeNode.id);
    const nextNodes = [...nodes.slice(0, index), ...replacement, ...nodes.slice(index + 1)];
    commitNodes(nextNodes, mathNode.id, { start: selected.length, end: selected.length });
  };

  const exitMathMode = () => {
    if (activeNode.kind !== "math") return;
    const index = nodes.findIndex((node) => node.id === activeNode.id);
    const next = nodes[index + 1];
    if (next?.kind === "text") {
      activateNode(next.id, { start: 0, end: 0 });
      return;
    }
    const textNode: EditorNode = { id: nextId(), kind: "text", text: "" };
    const nextNodes = [...nodes.slice(0, index + 1), textNode, ...nodes.slice(index + 1)];
    commitNodes(nextNodes, textNode.id, { start: 0, end: 0 });
  };

  const applyCompletion = (item: TextEditorCompletionItem) => {
    if (activeNode.kind !== "math" || !mathCompletionState) return;
    const expanded = expandTextEditorSnippet(item.snippet);
    const replaced = replaceRange(
      activeNode.text,
      {
        start: mathCompletionState.query.replaceStart,
        end: mathCompletionState.query.replaceEnd,
      },
      expanded.text
    );
    const nextNodes = nodes.map((node) => (node.id === activeNode.id ? { ...node, text: replaced.text } : node));
    const nextSession =
      expanded.placeholders.length > 0
        ? {
            activeIndex: 0,
            items: expanded.placeholders,
          }
        : null;
    const nextSelection =
      nextSession?.items[0]
        ? { start: nextSession.items[0].start, end: nextSession.items[0].end }
        : replaced.selection;
    setNodes(nextNodes);
    setPlaceholderSession(nextSession);
    setActiveSelection(nextSelection);
    pendingSelectionRef.current = nextSelection;
    onChangeValue(serializeNodes(nextNodes));
  };

  const jumpPlaceholder = (direction: -1 | 1) => {
    if (!placeholderSession) return false;
    const nextIndex = placeholderSession.activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= placeholderSession.items.length) {
      setPlaceholderSession(null);
      return false;
    }
    const nextSession = { ...placeholderSession, activeIndex: nextIndex };
    const target = nextSession.items[nextIndex]!;
    setPlaceholderSession(nextSession);
    activateNode(activeNode.id, { start: target.start, end: target.end });
    return true;
  };

  const removeEmptyMathNodeIfPossible = () => {
    if (activeNode.kind !== "math" || activeNode.text.length > 0 || activeSelection.start !== 0 || activeSelection.end !== 0) {
      return false;
    }
    const index = nodes.findIndex((node) => node.id === activeNode.id);
    if (index < 0) return false;
    const previous = nodes[index - 1];
    const next = nodes[index + 1];
    const nextNodes = nodes.filter((node) => node.id !== activeNode.id);
    if (previous?.kind === "text") {
      commitNodes(nextNodes, previous.id, { start: previous.text.length, end: previous.text.length });
      return true;
    }
    if (next?.kind === "text") {
      commitNodes(nextNodes, next.id, { start: 0, end: 0 });
      return true;
    }
    const textNode: EditorNode = { id: nextId(), kind: "text", text: "" };
    commitNodes([...nextNodes.slice(0, index), textNode, ...nextNodes.slice(index)], textNode.id, { start: 0, end: 0 });
    return true;
  };

  const isEmpty = nodes.length === 1 && nodes[0]?.kind === "text" && nodes[0].text.length === 0;

  return (
    <>
      <div
        className={isEmpty ? "gdTextToolComposer empty" : "gdTextToolComposer"}
        data-placeholder="Type text. Use $ for math."
        style={{
          color: textColor,
          fontSize: `${fontSizePx}px`,
          minHeight: `${minHeightPx}px`,
          textAlign,
        }}
      >
        {nodes.map((node) => {
          const isActive = node.id === activeNode.id;
          if (isActive) {
            const className =
              node.kind === "math" ? "gdTextToolRun gdTextToolRunActive gdTextToolRunMath" : "gdTextToolRun gdTextToolRunActive";
            return (
              <span
                key={node.id}
                ref={activeEditorRef}
                className={className}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={() => syncActiveNodeFromDom()}
                onKeyUp={() => syncSelectionFromActiveEditor()}
                onMouseUp={() => syncSelectionFromActiveEditor()}
                onPaste={(event: ClipboardEvent<HTMLSpanElement>) => {
                  event.preventDefault();
                  const pasted = event.clipboardData.getData("text/plain");
                  const replaced = replaceRange(activeNode.text, activeSelection, pasted);
                  updateActiveNodeText(replaced.text, replaced.selection);
                }}
                onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    onCommit();
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancel();
                    return;
                  }
                  if (node.kind === "text" && event.key === "$") {
                    event.preventDefault();
                    enterMathMode();
                    return;
                  }
                  if (node.kind === "math" && event.key === "$") {
                    event.preventDefault();
                    exitMathMode();
                    return;
                  }
                  if (mathCompletionState && event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveCompletionIndex((prev) => (prev + 1) % mathCompletionState.completions.length);
                    return;
                  }
                  if (mathCompletionState && event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveCompletionIndex(
                      (prev) => (prev - 1 + mathCompletionState.completions.length) % mathCompletionState.completions.length
                    );
                    return;
                  }
                  if (mathCompletionState && event.key === "Enter") {
                    event.preventDefault();
                    const item =
                      mathCompletionState.completions[
                        Math.min(activeCompletionIndex, mathCompletionState.completions.length - 1)
                      ];
                    if (item) applyCompletion(item);
                    return;
                  }
                  if (event.key === "Tab") {
                    event.preventDefault();
                    if (jumpPlaceholder(event.shiftKey ? -1 : 1)) return;
                    if (node.kind === "math") {
                      exitMathMode();
                    }
                    return;
                  }
                  if (event.key === "ArrowLeft" && activeSelection.start === 0 && activeSelection.end === 0) {
                    if (activatePreviousNode()) event.preventDefault();
                    return;
                  }
                  if (
                    event.key === "ArrowRight" &&
                    activeSelection.start === node.text.length &&
                    activeSelection.end === node.text.length
                  ) {
                    if (activateNextNode()) event.preventDefault();
                    return;
                  }
                  if (event.key === "Backspace" && removeEmptyMathNodeIfPossible()) {
                    event.preventDefault();
                    return;
                  }
                }}
              />
            );
          }

          if (node.kind === "text") {
            return (
              <span
                key={node.id}
                className="gdTextToolRun"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const target = event.currentTarget;
                  const caret = resolveTextOffsetFromPoint(target, event);
                  activateNode(node.id, { start: caret, end: caret });
                }}
              >
                {node.text}
              </span>
            );
          }

          return (
            <span
              key={node.id}
              className={node.display ? "gdTextToolRun gdTextToolRunRenderedMath display" : "gdTextToolRun gdTextToolRunRenderedMath"}
              onMouseDown={(event) => {
                event.preventDefault();
                const caret = node.text.length;
                activateNode(node.id, { start: caret, end: caret });
              }}
              dangerouslySetInnerHTML={{ __html: renderMathNode(node) }}
            />
          );
        })}
      </div>
      {activeNode.kind === "math" && mathCompletionState && mathCompletionState.completions.length > 0 && (
        <div className="gdTextEditorSuggestions">
          {mathCompletionState.completions.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === activeCompletionIndex ? "gdTextEditorSuggestion active" : "gdTextEditorSuggestion"}
              onMouseDown={(event) => {
                event.preventDefault();
                applyCompletion(item);
              }}
            >
              <span className="gdTextEditorSuggestionTrigger">{item.label}</span>
              <span
                className="gdTextEditorSuggestionPreview"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: renderCompletionPreview(item) }}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
