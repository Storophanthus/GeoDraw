export const REQUIRED_PREAMBLE = `\\PassOptionsToPackage{dvipsnames}{xcolor}
\\documentclass[tikz,border=2pt]{standalone}
\\usepackage{tkz-euclide}
\\usepackage{xfp}
\\usepackage{contour}
\\usetikzlibrary{arrows.meta,bending,decorations.markings,patterns,patterns.meta,shapes.geometric}`;

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

export function deriveDefaultOptionalPreamble(uiCssVariables: Record<string, string> | undefined): string {
  const normalizedHex = normalizeSceneBgHex(uiCssVariables?.["--gd-scene-bg"]);
  if (!normalizedHex || normalizedHex === "FFFFFF") return "";
  const rgb = hexToRgbTriplet(normalizedHex);
  if (!rgb) return "";
  return `\\usepackage{pagecolor}\n\\definecolor{gdPageColor}{RGB}{${rgb.join(",")}}\n\\pagecolor{gdPageColor}`;
}
