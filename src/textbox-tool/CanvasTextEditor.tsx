import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import { DEFAULT_TEXT_EDITOR_COMPLETIONS, type TextEditorCompletionItem } from "./catalog";
import { buildTextEditorModel, type TextEditorSelection } from "./model";
import { expandTextEditorSnippet, type TextEditorSnippetPlaceholder } from "./snippets";
import type { TextLabelRenderMode } from "../scene/points";
import { MixedContentEditableEditor } from "./MixedContentEditableEditor";

type PlaceholderSession = {
  items: TextEditorSnippetPlaceholder[];
  activeIndex: number;
};

export type CanvasTextEditorProps = {
  sessionKey: string;
  editorRef: MutableRefObject<HTMLElement | null>;
  value: string;
  renderMode: TextLabelRenderMode;
  shellStyle: CSSProperties;
  sourceStyle?: CSSProperties;
  shellClassName?: string;
  sourceClassName?: string;
  textColor: string;
  fontSizePx: number;
  minHeightPx: number;
  resizeActive: boolean;
  shouldIgnoreBlur?: () => boolean;
  completions?: TextEditorCompletionItem[];
  onChangeValue: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onResizeStart: (clientX: number, clientY: number) => void;
};

function normalizeSelection(target: HTMLTextAreaElement): TextEditorSelection {
  return {
    start: target.selectionStart ?? 0,
    end: target.selectionEnd ?? 0,
  };
}

function adjustPlaceholderSession(
  session: PlaceholderSession | null,
  previousValue: string,
  nextValue: string
): PlaceholderSession | null {
  if (!session) return null;
  const active = session.items[session.activeIndex];
  if (!active) return null;
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

export function CanvasTextEditor({
  sessionKey,
  editorRef,
  value,
  renderMode,
  shellStyle,
  sourceStyle,
  shellClassName = "gdTextEditorShell",
  sourceClassName = "gdTextEditorSource",
  textColor,
  fontSizePx,
  minHeightPx,
  resizeActive,
  shouldIgnoreBlur,
  completions = DEFAULT_TEXT_EDITOR_COMPLETIONS,
  onChangeValue,
  onCommit,
  onCancel,
  onResizeStart,
}: CanvasTextEditorProps) {
  void sessionKey;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const blurCommitFrameRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<TextEditorSelection | null>(null);
  const [selection, setSelection] = useState<TextEditorSelection>({
    start: value.length,
    end: value.length,
  });
  const [placeholderSession, setPlaceholderSession] = useState<PlaceholderSession | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState(0);
  const model = renderMode === "mixed" ? null : buildTextEditorModel(value, selection, completions);

  useEffect(() => {
    setActiveCompletionIndex(0);
  }, [model?.query?.text]);

  useEffect(() => {
    if (!model) return;
    if (activeCompletionIndex < model.completions.length) return;
    setActiveCompletionIndex(0);
  }, [activeCompletionIndex, model]);

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    const editor = editorRef.current;
    if (!pending || !editor) return;
    if (!(editor instanceof HTMLTextAreaElement)) return;
    window.requestAnimationFrame(() => {
      const activeEditor = editorRef.current;
      if (!(activeEditor instanceof HTMLTextAreaElement)) return;
      activeEditor.focus();
      activeEditor.setSelectionRange(pending.start, pending.end);
      setSelection(pending);
      pendingSelectionRef.current = null;
    });
  }, [editorRef, value]);

  useEffect(
    () => () => {
      if (blurCommitFrameRef.current !== null) {
        window.cancelAnimationFrame(blurCommitFrameRef.current);
      }
    },
    []
  );

  const queueSelection = (next: TextEditorSelection) => {
    pendingSelectionRef.current = next;
  };

  const applyCompletion = (item: TextEditorCompletionItem) => {
    if (!model?.query) return;
    const expanded = expandTextEditorSnippet(item.snippet);
    const prefix = value.slice(0, model.query.replaceStart);
    const suffix = value.slice(model.query.replaceEnd);
    const nextValue = `${prefix}${expanded.text}${suffix}`;
    const offset = model.query.replaceStart;
    const nextSession =
      expanded.placeholders.length > 0
        ? {
            activeIndex: 0,
            items: expanded.placeholders.map((placeholder) => ({
              ...placeholder,
              start: placeholder.start + offset,
              end: placeholder.end + offset,
            })),
          }
        : null;
    const firstPlaceholder = nextSession?.items[0];
    onChangeValue(nextValue);
    setPlaceholderSession(nextSession);
    if (firstPlaceholder) {
      queueSelection({ start: firstPlaceholder.start, end: firstPlaceholder.end });
      return;
    }
    const cursor = offset + expanded.text.length;
    queueSelection({ start: cursor, end: cursor });
  };

  const jumpPlaceholder = (direction: -1 | 1) => {
    if (!placeholderSession) return false;
    const nextIndex = placeholderSession.activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= placeholderSession.items.length) {
      setPlaceholderSession(null);
      return false;
    }
    const nextSession = {
      ...placeholderSession,
      activeIndex: nextIndex,
    };
    setPlaceholderSession(nextSession);
    const target = nextSession.items[nextIndex];
    queueSelection({ start: target.start, end: target.end });
    return true;
  };

  const handleSelectionChange = (target: HTMLTextAreaElement) => {
    const nextSelection = normalizeSelection(target);
    setSelection(nextSelection);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (event.key === "ArrowDown" && model && model.completions.length > 0) {
      event.preventDefault();
      setActiveCompletionIndex((prev) => (prev + 1) % model.completions.length);
      return;
    }
    if (event.key === "ArrowUp" && model && model.completions.length > 0) {
      event.preventDefault();
      setActiveCompletionIndex((prev) => (prev - 1 + model.completions.length) % model.completions.length);
      return;
    }
    if (event.key === "Tab") {
      if (model && model.completions.length > 0) {
        event.preventDefault();
        const item = model.completions[Math.min(activeCompletionIndex, model.completions.length - 1)];
        if (item) applyCompletion(item);
        return;
      }
      if (jumpPlaceholder(event.shiftKey ? -1 : 1)) {
        event.preventDefault();
      }
    }
  };

  const handleShellBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    if (resizeActive || shouldIgnoreBlur?.()) return;
    if (blurCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(blurCommitFrameRef.current);
    }
    blurCommitFrameRef.current = window.requestAnimationFrame(() => {
      blurCommitFrameRef.current = null;
      const shell = shellRef.current;
      const activeElement = document.activeElement;
      if (shell && activeElement instanceof Node && shell.contains(activeElement)) return;
      if (resizeActive || shouldIgnoreBlur?.()) return;
      onCommit();
    });
  };

  const textareaStyle: CSSProperties & Record<"--gd-text-editor-caret", string> = {
    color: textColor,
    "--gd-text-editor-caret": textColor,
    minHeight: `${minHeightPx}px`,
    fontSize: `${fontSizePx}px`,
    ...(sourceStyle ?? {}),
  };

  return (
    <div
      ref={shellRef}
      className={renderMode === "mixed" ? `${shellClassName} liveMixed` : shellClassName}
      style={shellStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onBlurCapture={handleShellBlurCapture}
    >
      {renderMode === "mixed" ? (
        <MixedContentEditableEditor
          key={sessionKey}
          editorRef={editorRef}
          value={value}
          textColor={textColor}
          fontSizePx={fontSizePx}
          minHeightPx={minHeightPx}
          textAlign={typeof sourceStyle?.textAlign === "string" ? (sourceStyle.textAlign as "left" | "center" | "right") : undefined}
          completions={completions}
          onChangeValue={onChangeValue}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : (
        <textarea
          ref={editorRef as MutableRefObject<HTMLTextAreaElement | null>}
          className={sourceClassName}
          value={value}
          placeholder="Type text"
          spellCheck={false}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChangeValue(nextValue);
            setPlaceholderSession((current) => adjustPlaceholderSession(current, value, nextValue));
            handleSelectionChange(event.target);
          }}
          onSelect={(event) => handleSelectionChange(event.currentTarget)}
          onKeyUp={(event) => handleSelectionChange(event.currentTarget)}
          onClick={(event) => handleSelectionChange(event.currentTarget)}
          onKeyDown={handleKeyDown}
          style={textareaStyle}
        />
      )}
      {model && model.completions.length > 0 && (
          <div className="gdTextEditorSuggestions">
            {model.completions.map((item, index) => (
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
                <span className="gdTextEditorSuggestionDetail">{item.detail}</span>
              </button>
            ))}
          </div>
      )}
      <div
        className={resizeActive ? "canvasTextLabelResizeCorner active" : "canvasTextLabelResizeCorner"}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onResizeStart(event.clientX, event.clientY);
        }}
        title="Drag to resize textbox"
      />
    </div>
  );
}
