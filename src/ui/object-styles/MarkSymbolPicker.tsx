import * as React from "react";
import { useClickAway } from "react-use";

export type BasicMarkSymbol = "none" | "|" | "||" | "|||";

type MarkSymbolPickerProps = {
  value: BasicMarkSymbol;
  onChange: (next: BasicMarkSymbol) => void;
  options?: BasicMarkSymbol[];
};

const DEFAULT_OPTIONS: BasicMarkSymbol[] = ["none", "|", "||", "|||"];

export function MarkSymbolPicker({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: MarkSymbolPickerProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  useClickAway(ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button className="shapeButton" onClick={() => setOpen((v) => !v)} type="button">
        <MarkGlyph mark={value} />
      </button>
      {open && (
        <div
          className="shapePopover"
          style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: "4px" }}
        >
          {options.map((mark) => {
            const isActive = mark === value;
            return (
              <button
                key={mark}
                className={`shapeCell ${isActive ? "active" : ""}`}
                onClick={() => {
                  onChange(mark);
                  setOpen(false);
                }}
                type="button"
                title={mark}
              >
                <MarkGlyph mark={mark} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MarkGlyph({ mark }: { mark: BasicMarkSymbol }) {
  if (mark === "none") {
    return (
      <span style={{ fontSize: "14px", fontWeight: "bold", fontFamily: "monospace" }}>
        Ø
      </span>
    );
  }
  return (
    <span style={{ fontSize: "14px", fontWeight: "bold", fontFamily: "monospace" }}>
      {mark}
    </span>
  );
}
