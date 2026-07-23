import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { parseTextLabelRichText, type TextLabelRichTextSegment } from "../text/textLabelRichText";
import { StructuredMathEditor } from "./StructuredMathEditor";
import "./text-editor.css";
import {
  parseStructuredMathContent,
  serializeStructuredMathContent,
  type StructuredMathDelimiter,
} from "./structuredMath";

type MixedTextEditorProps = {
  sessionKey: string;
  value: string;
  textColor: string;
  fontSizePx: number;
  minHeightPx: number;
  onChangeValue: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

type MixedEditorRenderSegment =
  | { key: string; kind: "text"; content: string; sourceIndex: number; ghost: boolean }
  | {
      key: string;
      kind: "inlineMath" | "displayMath";
      content: string;
      sourceIndex: number;
    };

function serializeSegment(segment: TextLabelRichTextSegment): string {
  if (segment.kind === "text") return segment.content;
  if (segment.kind === "inlineMath") return `$${segment.content}$`;
  return `\\[${segment.content}\\]`;
}

function serializeSegments(segments: TextLabelRichTextSegment[]): string {
  return segments.map(serializeSegment).join("");
}

function createRenderSegments(sourceSegments: TextLabelRichTextSegment[]): MixedEditorRenderSegment[] {
  const renderSegments: MixedEditorRenderSegment[] = [];
  let textSlotIndex = 0;
  let mathSlotIndex = 0;
  sourceSegments.forEach((segment, index) => {
    if (segment.kind === "text") {
      renderSegments.push({
        key: `text-slot-${textSlotIndex}`,
        kind: "text",
        content: segment.content,
        sourceIndex: index,
        ghost: false,
      });
      textSlotIndex += 1;
      return;
    }
    renderSegments.push({
      key: `math-slot-${mathSlotIndex}`,
      kind: segment.kind,
      content: segment.content,
      sourceIndex: index,
    });
    mathSlotIndex += 1;
    const next = sourceSegments[index + 1];
    if (!next || next.kind !== "text") {
      renderSegments.push({
        key: `text-slot-${textSlotIndex}`,
        kind: "text",
        content: "",
        sourceIndex: index,
        ghost: true,
      });
      textSlotIndex += 1;
    }
  });
  if (renderSegments.length === 0) {
    renderSegments.push({
      key: "text-slot-0",
      kind: "text",
      content: "",
      sourceIndex: -1,
      ghost: false,
    });
  }
  return renderSegments;
}

function nextTextRenderIndex(renderSegments: MixedEditorRenderSegment[], currentIndex: number): number | null {
  for (let index = currentIndex + 1; index < renderSegments.length; index += 1) {
    if (renderSegments[index]?.kind === "text") return index;
  }
  return null;
}

function previousTextRenderIndex(renderSegments: MixedEditorRenderSegment[], currentIndex: number): number | null {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (renderSegments[index]?.kind === "text") return index;
  }
  return null;
}

export function MixedTextEditor({
  sessionKey,
  value,
  textColor,
  fontSizePx,
  minHeightPx,
  onChangeValue,
  onCommit,
  onCancel,
}: MixedTextEditorProps) {
  const parsedSegments = useMemo(() => parseTextLabelRichText(value, { liveOpenMath: true }), [value]);
  const renderSegments = useMemo(() => createRenderSegments(parsedSegments), [parsedSegments]);
  const textRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const target = textRefs.current.find((item) => item);
      if (!target) return;
      target.focus();
      const cursor = target.value.length;
      target.setSelectionRange(cursor, cursor);
    });
  }, [sessionKey]);

  useEffect(() => {
    textRefs.current.forEach((node) => {
      if (!node) return;
      node.style.height = "0px";
      node.style.height = `${Math.max(32, node.scrollHeight)}px`;
    });
  }, [renderSegments]);

  const handleTextChange = (renderIndex: number, nextContent: string) => {
    const renderSegment = renderSegments[renderIndex];
    if (!renderSegment || renderSegment.kind !== "text") return;
    if (renderSegment.sourceIndex < 0) {
      onChangeValue(nextContent);
      return;
    }
    if (renderSegment.ghost) {
      const prefixSegments = parsedSegments.slice(0, renderSegment.sourceIndex + 1);
      const nextValue = `${serializeSegments(prefixSegments)}${nextContent}`;
      onChangeValue(nextValue);
      return;
    }
    const nextSegments = parsedSegments.map((segment, index) =>
      index === renderSegment.sourceIndex && segment.kind === "text" ? { ...segment, content: nextContent } : segment
    );
    onChangeValue(serializeSegments(nextSegments));
  };

  const handleMathChange = (renderIndex: number, nextContent: string) => {
    const renderSegment = renderSegments[renderIndex];
    if (!renderSegment || (renderSegment.kind !== "inlineMath" && renderSegment.kind !== "displayMath")) return;
    const nextSegments = parsedSegments.map((segment, index) =>
      index === renderSegment.sourceIndex && segment.kind !== "text" ? { ...segment, content: nextContent } : segment
    );
    onChangeValue(serializeSegments(nextSegments));
  };

  const focusTextRenderIndex = (renderIndex: number | null) => {
    if (renderIndex === null) {
      onCommit();
      return;
    }
    window.requestAnimationFrame(() => {
      const target = textRefs.current[renderIndex];
      if (!target) return;
      target.focus();
      const cursor = target.value.length;
      target.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div
      className="gdMixedTextSurface"
      style={{ color: textColor, fontSize: `${fontSizePx}px`, minHeight: `${minHeightPx}px` }}
    >
      {renderSegments.map((segment, renderIndex) => {
        if (segment.kind === "text") {
          return (
            <textarea
              key={segment.key}
              ref={(node) => {
                textRefs.current[renderIndex] = node;
              }}
              className={segment.ghost ? "gdMixedTextBlock ghost" : "gdMixedTextBlock"}
              value={segment.content}
              placeholder={segment.ghost ? "continue typing..." : "type text"}
              spellCheck={false}
              onChange={(event) => handleTextChange(renderIndex, event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  onCommit();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancel();
                }
              }}
            />
          );
        }

        const delimiter: StructuredMathDelimiter = segment.kind === "displayMath" ? "display" : "inline";
        const structured = parseStructuredMathContent(segment.content, delimiter);
        if (structured) {
          return (
            <StructuredMathEditor
              key={segment.key}
              sessionKey={`${sessionKey}:${segment.key}`}
              document={structured}
              textColor={textColor}
              fontSizePx={fontSizePx}
              minHeightPx={Math.max(44, Math.round(minHeightPx * 0.6))}
              compact
              onChangeDocument={(nextDocument) => handleMathChange(renderIndex, serializeStructuredMathContent(nextDocument))}
              onCommit={onCommit}
              onCancel={onCancel}
              onExitForward={() => focusTextRenderIndex(nextTextRenderIndex(renderSegments, renderIndex))}
              onExitBackward={() => focusTextRenderIndex(previousTextRenderIndex(renderSegments, renderIndex))}
            />
          );
        }

        return (
          <textarea
            key={segment.key}
            className={segment.kind === "displayMath" ? "gdMixedMathBlock display" : "gdMixedMathBlock"}
            value={segment.content}
            placeholder={segment.kind === "displayMath" ? "display math" : "math"}
            spellCheck={false}
            onChange={(event) => handleMathChange(renderIndex, event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
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
              if (event.key === "Tab") {
                event.preventDefault();
                focusTextRenderIndex(
                  event.shiftKey
                    ? previousTextRenderIndex(renderSegments, renderIndex)
                    : nextTextRenderIndex(renderSegments, renderIndex)
                );
              }
            }}
          />
        );
      })}
    </div>
  );
}
