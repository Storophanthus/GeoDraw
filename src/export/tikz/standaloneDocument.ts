export const REQUIRED_PREAMBLE = `\\PassOptionsToPackage{dvipsnames}{xcolor}
\\documentclass[tikz,border=2pt]{standalone}
\\usepackage{tkz-euclide}
\\usepackage{xfp}
\\usepackage{contour}
\\usetikzlibrary{arrows.meta,bending,decorations.markings,patterns,patterns.meta,shapes.geometric}`;

const DVIPS_XCOLOR_PREAMBLE_LINE = "\\usepackage[dvipsnames]{xcolor}";

export function looksLikeFullDocument(text: string): boolean {
  return /\\documentclass\b/.test(text) || /\\begin\{document\}/.test(text);
}

export function buildStandaloneSource(tikzCode: string, optionalPreamble: string): string {
  const trimmed = tikzCode.trim();
  if (looksLikeFullDocument(trimmed)) return tikzCode;
  const extra = optionalPreamble.trim();
  const preamble = extra ? `${REQUIRED_PREAMBLE}\n${extra}` : REQUIRED_PREAMBLE;
  return `${preamble}\n\\begin{document}\n${tikzCode}\n\\end{document}\n`;
}

function normalizeSceneBgHex(rawColor: string | undefined): string | null {
  if (!rawColor) return null;
  const trimmed = rawColor.trim();
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u.exec(trimmed);
  if (!match) return null;
  const hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .slice(0, 3)
      .split("")
      .map((ch) => ch + ch)
      .join("");
    return expanded.toUpperCase();
  }
  if (hex.length === 8) {
    return hex.slice(0, 6).toUpperCase();
  }
  return hex.toUpperCase();
}

function hexToRgbTriplet(hex: string): [number, number, number] | null {
  if (!/^[0-9A-F]{6}$/u.test(hex)) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return [r, g, b];
}

export function deriveDefaultOptionalPreamble(
  tikzCode: string,
  uiCssVariables: Record<string, string> | undefined
): string {
  const shouldIncludeDvipsXcolor = containsDvipsNamedColorUsage(tikzCode);
  const normalizedHex = normalizeSceneBgHex(uiCssVariables?.["--gd-scene-bg"]);
  const hasNonWhiteBg = Boolean(normalizedHex && normalizedHex !== "FFFFFF");
  if (!hasNonWhiteBg && !shouldIncludeDvipsXcolor) return "";

  const rgb = hexToRgbTriplet(hasNonWhiteBg ? (normalizedHex as string) : "FFFFFF");
  if (!rgb) return "";

  const lines: string[] = [];
  if (shouldIncludeDvipsXcolor) lines.push(DVIPS_XCOLOR_PREAMBLE_LINE);
  if (hasNonWhiteBg) {
    lines.push("\\usepackage{pagecolor}");
    lines.push(`\\definecolor{gdPageColor}{RGB}{${rgb.join(",")}}`);
    lines.push("\\pagecolor{gdPageColor}");
  }
  return lines.join("\n");
}

function containsDvipsNamedColorUsage(tikzCode: string): boolean {
  const tokenColorRegex = /\b(?:color|text|fill|draw)\s*=\s*\{?([A-Za-z][A-Za-z0-9!]+)\b/g;
  for (const match of tikzCode.matchAll(tokenColorRegex)) {
    const colorName = match[1];
    if (!colorName || colorName.startsWith("gdC_")) continue;
    if (/[A-Z]/.test(colorName)) return true;
  }

  const customColorDefRegex = /\\definecolor\{([A-Za-z][A-Za-z0-9_!]+)\}\{RGB\}\{/g;
  for (const match of tikzCode.matchAll(customColorDefRegex)) {
    const colorName = match[1];
    if (!colorName || colorName.startsWith("gdC_")) continue;
    if (/[A-Z]/.test(colorName)) return true;
  }

  return false;
}
