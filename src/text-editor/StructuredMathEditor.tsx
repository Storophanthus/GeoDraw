import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { type StructuredMathDocument } from "./structuredMath";
import "./text-editor.css";

type StructuredMathEditorProps = {
  sessionKey: string;
  document: StructuredMathDocument;
  textColor: string;
  fontSizePx: number;
  minHeightPx: number;
  compact?: boolean;
  onChangeDocument: (document: StructuredMathDocument) => void;
  onCommit: () => void;
  onCancel: () => void;
  onExitForward?: () => void;
  onExitBackward?: () => void;
};

type SlotDescriptor = {
  key: string;
  value: string;
  placeholder: string;
};

function buildSlots(document: StructuredMathDocument): SlotDescriptor[] {
  if (document.kind === "fraction") {
    return [
      { key: "numerator", value: document.numerator, placeholder: "numerator" },
      { key: "denominator", value: document.denominator, placeholder: "denominator" },
    ];
  }
  if (document.kind === "sqrt") {
    return [
      { key: "index", value: document.index ?? "", placeholder: "index" },
      { key: "body", value: document.body, placeholder: "radicand" },
    ];
  }
  if (document.kind === "binom") {
    return [
      { key: "top", value: document.top, placeholder: "top" },
      { key: "bottom", value: document.bottom, placeholder: "bottom" },
    ];
  }
  if (document.kind === "script") {
    return [
      { key: "base", value: document.base, placeholder: "base" },
      { key: "subscript", value: document.subscript ?? "", placeholder: "subscript" },
      { key: "superscript", value: document.superscript ?? "", placeholder: "superscript" },
    ];
  }
  if (document.kind === "matrix") {
    return document.rows.flatMap((row, rowIndex) =>
      row.map((cell, cellIndex) => ({
        key: `r${rowIndex}c${cellIndex}`,
        value: cell,
        placeholder: `${rowIndex + 1},${cellIndex + 1}`,
      }))
    );
  }
  return document.rows.flatMap((row, rowIndex) => [
    { key: `value-${rowIndex}`, value: row.value, placeholder: "value" },
    { key: `condition-${rowIndex}`, value: row.condition, placeholder: "condition" },
  ]);
}

function chooseInitialSlotIndex(document: StructuredMathDocument, slots: SlotDescriptor[]): number {
  const firstEmptyIndex = slots.findIndex((slot) => slot.value.trim().length === 0);
  if (firstEmptyIndex >= 0) return firstEmptyIndex;
  if (document.kind === "script") {
    return document.superscript === null && document.subscript !== null ? 2 : 0;
  }
  return 0;
}

function updateDocumentSlot(document: StructuredMathDocument, slotKey: string, value: string): StructuredMathDocument {
  if (document.kind === "fraction") {
    return {
      ...document,
      numerator: slotKey === "numerator" ? value : document.numerator,
      denominator: slotKey === "denominator" ? value : document.denominator,
    };
  }
  if (document.kind === "sqrt") {
    return {
      ...document,
      index: slotKey === "index" ? value || null : document.index,
      body: slotKey === "body" ? value : document.body,
    };
  }
  if (document.kind === "binom") {
    return {
      ...document,
      top: slotKey === "top" ? value : document.top,
      bottom: slotKey === "bottom" ? value : document.bottom,
    };
  }
  if (document.kind === "script") {
    return {
      ...document,
      base: slotKey === "base" ? value : document.base,
      subscript: slotKey === "subscript" ? value || null : document.subscript,
      superscript: slotKey === "superscript" ? value || null : document.superscript,
    };
  }
  if (document.kind === "matrix") {
    const match = slotKey.match(/^r(\d+)c(\d+)$/);
    if (!match) return document;
    const rowIndex = Number(match[1]);
    const cellIndex = Number(match[2]);
    return {
      ...document,
      rows: document.rows.map((row, currentRow) =>
        currentRow !== rowIndex ? row : row.map((cell, currentCell) => (currentCell === cellIndex ? value : cell))
      ),
    };
  }
  const rowMatch = slotKey.match(/^(value|condition)-(\d+)$/);
  if (!rowMatch) return document;
  const rowIndex = Number(rowMatch[2]);
  return {
    ...document,
    rows: document.rows.map((row, currentRow) =>
      currentRow !== rowIndex
        ? row
        : {
            ...row,
            value: rowMatch[1] === "value" ? value : row.value,
            condition: rowMatch[1] === "condition" ? value : row.condition,
          }
    ),
  };
}

export function StructuredMathEditor({
  sessionKey,
  document,
  textColor,
  fontSizePx,
  minHeightPx,
  compact = false,
  onChangeDocument,
  onCommit,
  onCancel,
  onExitForward,
  onExitBackward,
}: StructuredMathEditorProps) {
  const inputRefs = useRef<Array<HTMLInputElement | HTMLTextAreaElement | null>>([]);
  const autoFocusKeyRef = useRef<string>("");
  const slots = useMemo(() => buildSlots(document), [document]);

  useEffect(() => {
    const autoFocusKey = `${sessionKey}:${document.kind}:${document.delimiter}`;
    if (autoFocusKeyRef.current === autoFocusKey) return;
    autoFocusKeyRef.current = autoFocusKey;
    window.requestAnimationFrame(() => {
      const target = inputRefs.current[chooseInitialSlotIndex(document, slots)] ?? inputRefs.current[0];
      if (!target) return;
      target.focus();
      const cursor = target.value.length;
      target.setSelectionRange(cursor, cursor);
    });
  }, [document.delimiter, document.kind, sessionKey, slots]);

  const moveToSlot = (index: number, direction: -1 | 1) => {
    if (index < 0) {
      onExitBackward?.();
      return;
    }
    if (index >= slots.length) {
      onExitForward?.();
      return;
    }
    const target = inputRefs.current[index];
    if (!target) {
      if (direction > 0) onExitForward?.();
      else onExitBackward?.();
      return;
    }
    target.focus();
    target.select();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => {
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
      moveToSlot(index + (event.shiftKey ? -1 : 1), event.shiftKey ? -1 : 1);
    }
  };

  const sharedStyle = { color: textColor, fontSize: `${fontSizePx}px`, minHeight: `${minHeightPx}px` };
  const shellClassName = compact ? "gdStructuredMathSurface compact" : "gdStructuredMathSurface";

  if (document.kind === "fraction") {
    return (
      <div className={`${shellClassName} gdStructuredMathFraction`} style={sharedStyle}>
        {slots.map((slot, index) => (
          <div key={slot.key} className={slot.key === "numerator" ? "gdStructuredMathCellTop" : "gdStructuredMathCellBottom"}>
            {slot.key === "denominator" && <div className="gdStructuredMathBar" />}
            <input
              ref={(node) => {
                inputRefs.current[index] = node;
              }}
              className="gdStructuredMathSlot"
              value={slot.value}
              placeholder={slot.placeholder}
              spellCheck={false}
              onChange={(event) => onChangeDocument(updateDocumentSlot(document, slot.key, event.target.value))}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
          </div>
        ))}
      </div>
    );
  }

  if (document.kind === "sqrt") {
    return (
      <div className={`${shellClassName} gdStructuredMathSqrt`} style={sharedStyle}>
        <input
          ref={(node) => {
            inputRefs.current[0] = node;
          }}
          className="gdStructuredMathSlot gdStructuredMathIndexSlot"
          value={slots[0]?.value ?? ""}
          placeholder="index"
          spellCheck={false}
          onChange={(event) => onChangeDocument(updateDocumentSlot(document, "index", event.target.value))}
          onKeyDown={(event) => handleKeyDown(event, 0)}
        />
        <span className="gdStructuredMathRootGlyph">√</span>
        <input
          ref={(node) => {
            inputRefs.current[1] = node;
          }}
          className="gdStructuredMathSlot gdStructuredMathRadicand"
          value={slots[1]?.value ?? ""}
          placeholder="radicand"
          spellCheck={false}
          onChange={(event) => onChangeDocument(updateDocumentSlot(document, "body", event.target.value))}
          onKeyDown={(event) => handleKeyDown(event, 1)}
        />
      </div>
    );
  }

  if (document.kind === "binom") {
    return (
      <div className={`${shellClassName} gdStructuredMathBinom`} style={sharedStyle}>
        <span className="gdStructuredMathParen">(</span>
        <div className="gdStructuredMathStack">
          {slots.map((slot, index) => (
            <input
              key={slot.key}
              ref={(node) => {
                inputRefs.current[index] = node;
              }}
              className="gdStructuredMathSlot"
              value={slot.value}
              placeholder={slot.placeholder}
              spellCheck={false}
              onChange={(event) => onChangeDocument(updateDocumentSlot(document, slot.key, event.target.value))}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
          ))}
        </div>
        <span className="gdStructuredMathParen">)</span>
      </div>
    );
  }

  if (document.kind === "script") {
    return (
      <div className={`${shellClassName} gdStructuredMathScript`} style={sharedStyle}>
        <input
          ref={(node) => {
            inputRefs.current[0] = node;
          }}
          className="gdStructuredMathSlot gdStructuredMathBaseSlot"
          value={slots[0]?.value ?? ""}
          placeholder="base"
          spellCheck={false}
          onChange={(event) => onChangeDocument(updateDocumentSlot(document, "base", event.target.value))}
          onKeyDown={(event) => handleKeyDown(event, 0)}
        />
        <div className="gdStructuredMathScriptStack">
          <input
            ref={(node) => {
              inputRefs.current[1] = node;
            }}
            className="gdStructuredMathSlot gdStructuredMathScriptSlot"
            value={slots[1]?.value ?? ""}
            placeholder="sub"
            spellCheck={false}
            onChange={(event) => onChangeDocument(updateDocumentSlot(document, "subscript", event.target.value))}
            onKeyDown={(event) => handleKeyDown(event, 1)}
          />
          <input
            ref={(node) => {
              inputRefs.current[2] = node;
            }}
            className="gdStructuredMathSlot gdStructuredMathScriptSlot"
            value={slots[2]?.value ?? ""}
            placeholder="sup"
            spellCheck={false}
            onChange={(event) => onChangeDocument(updateDocumentSlot(document, "superscript", event.target.value))}
            onKeyDown={(event) => handleKeyDown(event, 2)}
          />
        </div>
      </div>
    );
  }

  if (document.kind === "matrix") {
    return (
      <div className={`${shellClassName} gdStructuredMathMatrix`} style={sharedStyle}>
        <span className="gdStructuredMathParen">{document.env === "bmatrix" ? "[" : "("}</span>
        <div
          className="gdStructuredMathGrid"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, document.rows[0]?.length ?? 1)}, minmax(56px, 1fr))` }}
        >
          {slots.map((slot, index) => (
            <input
              key={slot.key}
              ref={(node) => {
                inputRefs.current[index] = node;
              }}
              className="gdStructuredMathSlot"
              value={slot.value}
              placeholder={slot.placeholder}
              spellCheck={false}
              onChange={(event) => onChangeDocument(updateDocumentSlot(document, slot.key, event.target.value))}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
          ))}
        </div>
        <span className="gdStructuredMathParen">{document.env === "bmatrix" ? "]" : ")"}</span>
      </div>
    );
  }

  return (
    <div className={`${shellClassName} gdStructuredMathCases`} style={sharedStyle}>
      <span className="gdStructuredMathBrace">{`{`}</span>
      <div className="gdStructuredMathCasesRows">
        {document.rows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="gdStructuredMathCaseRow">
            <input
              ref={(node) => {
                inputRefs.current[rowIndex * 2] = node;
              }}
              className="gdStructuredMathSlot"
              value={row.value}
              placeholder="value"
              spellCheck={false}
              onChange={(event) => onChangeDocument(updateDocumentSlot(document, `value-${rowIndex}`, event.target.value))}
              onKeyDown={(event) => handleKeyDown(event, rowIndex * 2)}
            />
            <input
              ref={(node) => {
                inputRefs.current[rowIndex * 2 + 1] = node;
              }}
              className="gdStructuredMathSlot"
              value={row.condition}
              placeholder="condition"
              spellCheck={false}
              onChange={(event) =>
                onChangeDocument(updateDocumentSlot(document, `condition-${rowIndex}`, event.target.value))
              }
              onKeyDown={(event) => handleKeyDown(event, rowIndex * 2 + 1)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
