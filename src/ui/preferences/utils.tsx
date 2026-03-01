import { type UiCssVariableName, type UiColorProfileId, getUiColorProfileSwatch } from "../../state/colorProfiles";

export function ProfileSwatch({ profileId }: { profileId: UiColorProfileId }) {
    const swatch = getUiColorProfileSwatch(profileId);
    return (
        <span
            className="profileSwatchVisual"
            style={{
                background: swatch.background,
                borderColor: swatch.line,
            }}
            aria-hidden
        >
            <span className="profileSwatchFill" style={{ background: swatch.fill }} />
            <span className="profileSwatchLine" style={{ background: swatch.line }} />
            <span
                className="profileSwatchDot"
                style={{
                    background: swatch.dotFill,
                    borderColor: swatch.dotStroke,
                }}
            />
        </span>
    );
}

export function formatUiCssVariableLabel(name: UiCssVariableName): string {
    const cleaned = name.replace(/^--gd-ui-/, "");
    return cleaned
        .split("-")
        .filter((part) => part.length > 0)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ");
}

export function toColorInputValue(raw: string): string | null {
    const value = raw.trim();
    const shortHex = /^#([0-9a-fA-F]{3})$/.exec(value);
    if (shortHex) {
        const [r, g, b] = shortHex[1].split("").map((digit) => parseInt(digit + digit, 16));
        return rgbToHex(r, g, b);
    }
    const fullHex = /^#([0-9a-fA-F]{6})$/.exec(value);
    if (fullHex) {
        return `#${fullHex[1].toLowerCase()}`;
    }
    const rgb = /^rgba?\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)(?:\s*,\s*([+-]?\d*(?:\.\d+)?))?\s*\)$/i.exec(
        value
    );
    if (rgb) {
        const r = clampColorChannel(Number(rgb[1]));
        const g = clampColorChannel(Number(rgb[2]));
        const b = clampColorChannel(Number(rgb[3]));
        return rgbToHex(r, g, b);
    }
    return null;
}

export function clampColorChannel(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
}


export function parsePositiveNumber(raw: string): number | null {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

export function parseNonNegativeNumber(raw: string): number | null {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
}
