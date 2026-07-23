import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ChangeEventHandler,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  colorToHex,
  EXPORT_FRIENDLY_COLOR_PRESETS,
  parseColorToRgb,
  PRIMARY_EXPORT_FRIENDLY_COLOR_PRESETS,
  rgbToHex,
} from "../exportFriendlyColors";
import { loadStoredRecentColors, MAX_RECENT_COLORS, saveStoredRecentColors } from "../state/appPreferences";
import { toColorInputValue } from "./preferences/utils";

function joinClassNames(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const PRIMARY_SWATCHES = PRIMARY_EXPORT_FRIENDLY_COLOR_PRESETS.map((preset) => ({
  id: preset.id,
  hex: preset.hex,
  label: preset.label,
}));

const PRIMARY_IDS = new Set(PRIMARY_EXPORT_FRIENDLY_COLOR_PRESETS.map((preset) => preset.id));

const SECONDARY_SWATCHES = EXPORT_FRIENDLY_COLOR_PRESETS
  .filter((preset) => !PRIMARY_IDS.has(preset.id))
  .map((preset) => ({
    id: preset.id,
    hex: preset.hex,
    label: preset.label,
  }));

type ColorSwatchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  value: string;
  variant?: "panel" | "token";
};

function createColorChangeEvent(nextValue: string): ChangeEvent<HTMLInputElement> {
  return {
    target: { value: nextValue } as EventTarget & HTMLInputElement,
    currentTarget: { value: nextValue } as EventTarget & HTMLInputElement,
  } as ChangeEvent<HTMLInputElement>;
}

export function ColorSwatchInput({
  value,
  variant = "panel",
  className,
  disabled,
  onChange,
  style,
  ...props
}: ColorSwatchInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const resolvedHex = toColorInputValue(value);
  const pickerValue = resolvedHex ?? "#000000";
  const displayText = resolvedHex ? resolvedHex.toUpperCase() : value;
  const nativeChange = onChange as ChangeEventHandler<HTMLInputElement> | undefined;
  const rgb = parseColorToRgb(pickerValue) ?? { r: 0, g: 0, b: 0 };

  useEffect(() => {
    if (open) setRecentColors(loadStoredRecentColors());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updatePopoverPosition = () => {
      const trigger = rootRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const gutter = 12;
      const width = popoverRect.width || 248;
      const height = popoverRect.height || 248;

      let left = triggerRect.left;
      if (left + width > window.innerWidth - gutter) {
        left = window.innerWidth - width - gutter;
      }
      left = Math.max(gutter, left);

      let top = triggerRect.bottom + 10;
      const fitsBelow = top + height <= window.innerHeight - gutter;
      const fitsAbove = triggerRect.top - 10 - height >= gutter;
      if (!fitsBelow && fitsAbove) {
        top = triggerRect.top - height - 10;
      } else if (!fitsBelow) {
        top = Math.max(gutter, window.innerHeight - height - gutter);
      }

      setPopoverStyle({
        position: "fixed",
        left,
        top,
      });
    };

    const raf = requestAnimationFrame(updatePopoverPosition);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, variant]);

  const recordRecentColor = (hex: string) => {
    const next = [hex, ...loadStoredRecentColors().filter((existing) => existing !== hex)].slice(
      0,
      MAX_RECENT_COLORS
    );
    saveStoredRecentColors(next);
    setRecentColors(next);
  };

  const commitValue = (nextValue: string) => {
    nativeChange?.(createColorChangeEvent(nextValue));
    const hex = colorToHex(nextValue);
    if (hex) recordRecentColor(hex);
  };

  const commitChannel = (channel: "r" | "g" | "b", raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(0, Math.min(255, Math.round(parsed)));
    const nextRgb = { ...rgb, [channel]: clamped };
    commitValue(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  const openNativePicker = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      nativeInputRef.current?.click();
    });
  };

  return (
    <div ref={rootRef} className={joinClassNames("colorField", open && "colorFieldOpen")}>
      <button
        type="button"
        className={joinClassNames(
          "colorFieldTrigger",
          variant === "token" ? "preferencesTokenColor" : "colorFieldPill",
          className
        )}
        style={style as CSSProperties | undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-label={props["aria-label"] ?? "Choose color"}
        title={variant === "panel" ? value : undefined}
      >
        <span className="colorFieldSwatch" style={{ background: pickerValue }} aria-hidden />
        {variant === "panel" && <span className="colorFieldHexText">{displayText}</span>}
      </button>

      <input
        ref={nativeInputRef}
        className="colorFieldNativeInput"
        type="color"
        value={pickerValue}
        disabled={disabled}
        onChange={(event) => {
          nativeChange?.(event);
          recordRecentColor(event.target.value);
          setOpen(false);
        }}
        tabIndex={-1}
        aria-hidden
      />

      {open &&
        !disabled &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className={joinClassNames(
              "colorFieldPopover",
              "colorFieldPopoverFloating",
              variant === "token" ? "colorFieldPopoverToken" : "colorFieldPopoverPanel"
            )}
            style={popoverStyle ?? undefined}
          >
            <div className="colorFieldSection colorFieldSectionRgb">
              <div className="colorFieldSectionLabel">RGB</div>
              <div className="colorFieldRgbRow">
                <label className="colorFieldRgbField">
                  <span>R</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    step={1}
                    value={rgb.r}
                    onChange={(e) => commitChannel("r", e.target.value)}
                    aria-label="Red"
                  />
                </label>
                <label className="colorFieldRgbField">
                  <span>G</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    step={1}
                    value={rgb.g}
                    onChange={(e) => commitChannel("g", e.target.value)}
                    aria-label="Green"
                  />
                </label>
                <label className="colorFieldRgbField">
                  <span>B</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    step={1}
                    value={rgb.b}
                    onChange={(e) => commitChannel("b", e.target.value)}
                    aria-label="Blue"
                  />
                </label>
              </div>
            </div>
            {recentColors.length > 0 && (
              <div className="colorFieldSection colorFieldSectionRecent">
                <div className="colorFieldSectionLabel">Recent</div>
                <div className="colorFieldPresetGrid">
                  {recentColors.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={joinClassNames("colorFieldPreset", hex === pickerValue && "colorFieldPresetActive")}
                      onClick={() => {
                        commitValue(hex);
                        setOpen(false);
                      }}
                      title={hex.toUpperCase()}
                      aria-label={hex.toUpperCase()}
                    >
                      <span className="colorFieldPresetSwatch" style={{ background: hex }} aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="colorFieldSection colorFieldSectionPrimary">
              <div className="colorFieldSectionLabel">Main</div>
              <div className="colorFieldPrimaryGrid">
                {PRIMARY_SWATCHES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={joinClassNames(
                      "colorFieldPreset",
                      preset.hex === pickerValue && "colorFieldPresetActive"
                    )}
                    onClick={() => {
                      commitValue(preset.hex);
                      setOpen(false);
                    }}
                    title={preset.label}
                    aria-label={preset.label}
                  >
                    <span className="colorFieldPresetSwatch" style={{ background: preset.hex }} aria-hidden />
                  </button>
                ))}
              </div>
            </div>
            <div className="colorFieldSection colorFieldSectionSecondary">
              <div className="colorFieldSectionLabel">Named</div>
              <div className="colorFieldPresetGrid">
                {SECONDARY_SWATCHES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={joinClassNames(
                      "colorFieldPreset",
                      preset.hex === pickerValue && "colorFieldPresetActive"
                    )}
                    onClick={() => {
                      commitValue(preset.hex);
                      setOpen(false);
                    }}
                    title={preset.label}
                    aria-label={preset.label}
                  >
                    <span className="colorFieldPresetSwatch" style={{ background: preset.hex }} aria-hidden />
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="colorFieldMoreButton" onClick={openNativePicker}>
              Custom…
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

type ColorTokenFieldProps = {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  pickerAriaLabel: string;
  textAriaLabel: string;
  trailing?: ReactNode;
  spellCheck?: boolean;
  controlsClassName?: string;
};

export function ColorTokenField({
  id,
  value,
  onChange,
  pickerAriaLabel,
  textAriaLabel,
  trailing,
  spellCheck = false,
  controlsClassName,
}: ColorTokenFieldProps) {
  return (
    <div className={joinClassNames("preferencesTokenControls", controlsClassName)}>
      <ColorSwatchInput
        variant="token"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={pickerAriaLabel}
      />
      <input
        id={id}
        className="preferencesTokenInput"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={spellCheck}
        aria-label={textAriaLabel}
      />
      {trailing}
    </div>
  );
}
