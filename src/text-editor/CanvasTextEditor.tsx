import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MutableRefObject,
} from "react";
import "../text/text-rendering.css";
import {
  DEFAULT_TEXT_EDITOR_COMPLETIONS,
  TEXT_NODE_SYMBOL_COMPLETIONS,
  type TextEditorCompletionItem,
} from "./catalog";
import { buildTextEditorModel, type TextEditorSelection } from "./model";
import { expandTextEditorSnippet, type TextEditorSnippetPlaceholder } from "./snippets";
import "./text-editor.css";

type PlaceholderSession = {
  items: TextEditorSnippetPlaceholder[];
  activeIndex: number;
};

type CanvasEditorKind = "text" | "math";

export type CanvasTextEditorProps = {
  sessionKey: string;
  editorRef: MutableRefObject<HTMLElement | null>;
  value: string;
  editorKind: CanvasEditorKind;
  shellStyle: CSSProperties;
  sourceStyle?: CSSProperties;
  shellClassName?: string;
  sourceClassName?: string;
  textColor: string;
  fontSizePx: number;
  shouldIgnoreBlur?: () => boolean;
  onChangeValue: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

type CompletionListProps = {
  items: TextEditorCompletionItem[];
  activeIndex: number;
  onPick: (item: TextEditorCompletionItem) => void;
};

function normalizeSelection(target: HTMLTextAreaElement): TextEditorSelection {
  return {
    start: target.selectionStart ?? 0,
    end: target.selectionEnd ?? 0,
  };
}

function replaceRange(source: string, start: number, end: number, replacement: string): string {
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function CompletionList({ items, activeIndex, onPick }: CompletionListProps) {
  if (items.length === 0) return null;
  return (
    <div className="gdTextEditorSuggestions">
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

type BaseEditorSurfaceProps = {
  editorRef: MutableRefObject<HTMLElement | null>;
  value: string;
  textColor: string;
  fontSizePx: number;
  textAlign?: "left" | "center" | "right";
  onChangeValue: (value: string) => void;
  onCommit: () => void;
};

function TextNodeEditorSurface({
  editorRef,
  value,
  textColor,
  fontSizePx,
  textAlign = "left",
  onChangeValue,
  onCommit,
}: BaseEditorSurfaceProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const pendingSelectionRef = useRef<TextEditorSelection | null>(null);
  const [selection, setSelection] = useState<TextEditorSelection>({ start: value.length, end: value.length });
  const [activeCompletionIndex, setActiveCompletionIndex] = useState(0);
  const [boxSize, setBoxSize] = useState({ width: 48, height: Math.max(26, Math.ceil(fontSizePx * 1.55)) });
  const model = useMemo(
    () => buildTextEditorModel(value, selection, TEXT_NODE_SYMBOL_COMPLETIONS),
    [selection, value]
  );

  useEffect(() => {
    editorRef.current = inputRef.current;
    return () => {
      if (editorRef.current === inputRef.current) editorRef.current = null;
    };
  }, [editorRef]);

  useEffect(() => {
    setActiveCompletionIndex(0);
  }, [model.query?.text]);

  useEffect(() => {
    if (!pendingSelectionRef.current || !inputRef.current) return;
    const next = pendingSelectionRef.current;
    window.requestAnimationFrame(() => {
      if (!inputRef.current || !next) return;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(next.start, next.end);
      setSelection(next);
      pendingSelectionRef.current = null;
    });
  }, [value]);

  useLayoutEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;
    const rect = measure.getBoundingClientRect();
    setBoxSize({
      width: Math.max(48, Math.ceil(rect.width) + 2),
      height: Math.max(Math.ceil(fontSizePx * 1.55), Math.ceil(rect.height) + 2),
    });
  }, [fontSizePx, value]);

  const queueSelection = (next: TextEditorSelection) => {
    pendingSelectionRef.current = next;
  };

  const applyCompletion = (item: TextEditorCompletionItem) => {
    if (!model.query) return;
    const nextValue = replaceRange(value, model.query.replaceStart, model.query.replaceEnd, item.snippet);
    const caret = model.query.replaceStart + item.snippet.length;
    onChangeValue(nextValue);
    queueSelection({ start: caret, end: caret });
  };

  const syncSelection = (target: HTMLTextAreaElement) => {
    setSelection(normalizeSelection(target));
  };

  return (
    <div className="gdTextNodeEditor">
      <div
        ref={measureRef}
        className="gdTextNodeMeasure"
        style={{
          color: textColor,
          fontSize: `${fontSizePx}px`,
          textAlign,
        }}
      >
        {(value.length > 0 ? value : " ").replace(/\n$/, "\n ")}
      </div>
      <textarea
        ref={inputRef}
        className="gdTextNodeInput"
        value={value}
        placeholder="Type text"
        spellCheck={false}
        wrap="off"
        rows={1}
        style={{
          color: textColor,
          fontSize: `${fontSizePx}px`,
          textAlign,
          width: `${boxSize.width}px`,
          height: `${boxSize.height}px`,
        }}
        onChange={(event) => {
          onChangeValue(event.target.value);
          syncSelection(event.target);
        }}
        onSelect={(event) => syncSelection(event.currentTarget)}
        onKeyUp={(event) => syncSelection(event.currentTarget)}
        onClick={(event) => syncSelection(event.currentTarget)}
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
          if (event.key === "ArrowDown" && model.completions.length > 0) {
            event.preventDefault();
            setActiveCompletionIndex((prev) => (prev + 1) % model.completions.length);
            return;
          }
          if (event.key === "ArrowUp" && model.completions.length > 0) {
            event.preventDefault();
            setActiveCompletionIndex((prev) => (prev - 1 + model.completions.length) % model.completions.length);
            return;
          }
          if ((event.key === "Tab" || event.key === "Enter") && model.completions.length > 0) {
            event.preventDefault();
            const item = model.completions[Math.min(activeCompletionIndex, model.completions.length - 1)];
            if (item) applyCompletion(item);
          }
        }}
      />
      <CompletionList items={model.completions} activeIndex={activeCompletionIndex} onPick={applyCompletion} />
    </div>
  );
}

function MathNodeEditorSurface({
  editorRef,
  value,
  textColor,
  fontSizePx,
  onChangeValue,
  onCommit,
}: BaseEditorSurfaceProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const pendingSelectionRef = useRef<TextEditorSelection | null>(null);
  const [selection, setSelection] = useState<TextEditorSelection>({ start: value.length, end: value.length });
  const [placeholderSession, setPlaceholderSession] = useState<PlaceholderSession | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState(0);
  const [boxSize, setBoxSize] = useState({ width: 56, height: Math.max(34, Math.ceil(fontSizePx * 1.8)) });
  const model = useMemo(
    () => buildTextEditorModel(value, selection, DEFAULT_TEXT_EDITOR_COMPLETIONS),
    [selection, value]
  );

  useEffect(() => {
    editorRef.current = inputRef.current;
    return () => {
      if (editorRef.current === inputRef.current) editorRef.current = null;
    };
  }, [editorRef]);

  useEffect(() => {
    setActiveCompletionIndex(0);
  }, [model.query?.text]);

  useEffect(() => {
    if (!pendingSelectionRef.current || !inputRef.current) return;
    const next = pendingSelectionRef.current;
    window.requestAnimationFrame(() => {
      if (!inputRef.current || !next) return;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(next.start, next.end);
      setSelection(next);
      pendingSelectionRef.current = null;
    });
  }, [value]);

  useLayoutEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;
    const rect = measure.getBoundingClientRect();
    setBoxSize({
      width: Math.max(56, Math.ceil(rect.width) + 2),
      height: Math.max(34, Math.ceil(rect.height) + 2),
    });
  }, [fontSizePx, value]);

  const queueSelection = (next: TextEditorSelection) => {
    pendingSelectionRef.current = next;
  };

  const syncSelection = (target: HTMLTextAreaElement) => {
    setSelection(normalizeSelection(target));
  };

  const applyCompletion = (item: TextEditorCompletionItem) => {
    const query = model.query;
    if (!query) return;
    const expanded = expandTextEditorSnippet(item.snippet);
    const nextValue = replaceRange(value, query.replaceStart, query.replaceEnd, expanded.text);
    onChangeValue(nextValue);
    if (expanded.placeholders.length === 0) {
      const caret = query.replaceStart + expanded.text.length;
      queueSelection({ start: caret, end: caret });
      setPlaceholderSession(null);
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

  return (
    <div className="gdMathNodeEditor">
      <div
        ref={measureRef}
        className="gdMathNodeMeasure"
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "pre",
          fontSize: `${fontSizePx}px`,
          color: textColor,
        }}
      >
        {(value.length > 0 ? value : " ").replace(/\n$/, "\n ")}
      </div>
      <textarea
        ref={inputRef}
        className="gdMathNodeInput"
        value={value}
        spellCheck={false}
        rows={1}
        style={{
          color: textColor,
          fontSize: `${fontSizePx}px`,
          width: `${boxSize.width}px`,
          minHeight: `${boxSize.height}px`,
        }}
        onChange={(event) => {
          onChangeValue(event.target.value);
          syncSelection(event.target);
        }}
        onSelect={(event) => syncSelection(event.currentTarget)}
        onKeyUp={(event) => syncSelection(event.currentTarget)}
        onClick={(event) => syncSelection(event.currentTarget)}
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
          if (event.key === "ArrowDown" && model.completions.length > 0) {
            event.preventDefault();
            setActiveCompletionIndex((prev) => (prev + 1) % model.completions.length);
            return;
          }
          if (event.key === "ArrowUp" && model.completions.length > 0) {
            event.preventDefault();
            setActiveCompletionIndex((prev) => (prev - 1 + model.completions.length) % model.completions.length);
            return;
          }
          if (event.key === "Enter" && model.completions.length > 0) {
            event.preventDefault();
            const item = model.completions[Math.min(activeCompletionIndex, model.completions.length - 1)];
            if (item) applyCompletion(item);
            return;
          }
          if (event.key === "Tab") {
            if (model.completions.length > 0) {
              event.preventDefault();
              const item = model.completions[Math.min(activeCompletionIndex, model.completions.length - 1)];
              if (item) applyCompletion(item);
              return;
            }
            if (jumpPlaceholder(event.shiftKey ? -1 : 1)) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            onCommit();
          }
        }}
      />
      <CompletionList items={model.completions} activeIndex={activeCompletionIndex} onPick={applyCompletion} />
    </div>
  );
}

export function CanvasTextEditor({
  sessionKey,
  editorRef,
  value,
  editorKind,
  shellStyle,
  sourceStyle,
  shellClassName = "gdTextEditorShell",
  textColor,
  fontSizePx,
  shouldIgnoreBlur,
  onChangeValue,
  onCommit,
  onCancel,
}: CanvasTextEditorProps) {
  void sessionKey;
  void onCancel;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const blurCommitFrameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (blurCommitFrameRef.current !== null) {
        window.cancelAnimationFrame(blurCommitFrameRef.current);
      }
    },
    []
  );

  const handleShellBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    if (shouldIgnoreBlur?.()) return;
    if (blurCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(blurCommitFrameRef.current);
    }
    blurCommitFrameRef.current = window.requestAnimationFrame(() => {
      blurCommitFrameRef.current = null;
      const shell = shellRef.current;
      const activeElement = document.activeElement;
      if (shell && activeElement instanceof Node && shell.contains(activeElement)) return;
      if (shouldIgnoreBlur?.()) return;
      onCommit();
    });
  };

  return (
    <div
      ref={shellRef}
      className={`${shellClassName} ${editorKind === "math" ? "mathNode" : "textNode"}`}
      style={{
        ...shellStyle,
        ...(sourceStyle ?? {}),
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onBlurCapture={handleShellBlurCapture}
    >
      {editorKind === "math" ? (
        <MathNodeEditorSurface
          editorRef={editorRef}
          value={value}
          textColor={textColor}
          fontSizePx={fontSizePx}
          onChangeValue={onChangeValue}
          onCommit={onCommit}
        />
      ) : (
        <TextNodeEditorSurface
          editorRef={editorRef}
          value={value}
          textColor={textColor}
          fontSizePx={fontSizePx}
          textAlign={typeof sourceStyle?.textAlign === "string" ? (sourceStyle.textAlign as "left" | "center" | "right") : "left"}
          onChangeValue={onChangeValue}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}
