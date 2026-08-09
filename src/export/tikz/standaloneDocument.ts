const REQUIRED_PREAMBLE_PREFIX = "\\PassOptionsToPackage{dvipsnames}{xcolor}";
const REQUIRED_TIKZ_LIBRARIES =
  "\\usetikzlibrary{arrows,arrows.meta,bending,calc,decorations.markings,patterns,patterns.meta,positioning,shapes.geometric,shapes.misc,through}";

const DVIPS_XCOLOR_PREAMBLE_LINE = "\\usepackage[dvipsnames]{xcolor}";

export function looksLikeFullDocument(text: string): boolean {
  return /\\documentclass\b/.test(text) || /\\begin\{document\}/.test(text);
}

export function buildStandaloneSource(tikzCode: string, optionalPreamble: string): string {
  const trimmed = tikzCode.trim();
  if (looksLikeFullDocument(trimmed)) return tikzCode;
  const extra = optionalPreamble.trim();
  const requiredPreamble = buildRequiredPreamble(tikzCode);
  const preamble = extra ? `${requiredPreamble}\n${extra}` : requiredPreamble;
  return `${preamble}\n\\begin{document}\n${tikzCode}\n\\end{document}\n`;
}

export function buildRequiredPreamble(tikzCode: string): string {
  const hasExplicitCanvasBounds = /\\path\s*\[[^\]]*\buse as bounding box\b[^\]]*\]/u.test(tikzCode);
  const usesTkzEuclide = /\\tkz[A-Za-z@]+/u.test(tikzCode);
  const usesScalebox = /\\scalebox\s*\{/u.test(tikzCode);
  const border = hasExplicitCanvasBounds ? "0pt" : "2pt";
  return [
    REQUIRED_PREAMBLE_PREFIX,
    usesScalebox
      ? `\\documentclass[border=${border}]{standalone}`
      : `\\documentclass[tikz,border=${border}]{standalone}`,
    ...(usesScalebox ? ["\\usepackage{tikz}"] : []),
    ...(usesTkzEuclide ? ["\\usepackage{tkz-euclide}"] : []),
    ...(usesScalebox ? ["\\usepackage{graphicx}"] : []),
    "\\usepackage{xfp}",
    "\\usepackage{contour}",
    REQUIRED_TIKZ_LIBRARIES,
  ].join("\n");
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
  uiCssVariables: Record<string, string> | undefined,
  options: { preferDvipsNames?: boolean } = {}
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
    if (options.preferDvipsNames) {
      const pageColorName = resolveNearestDvipsColorName(`rgb(${rgb.join(",")})`) ?? "white";
      lines.push(`\\pagecolor{${pageColorName}}`);
    } else {
      lines.push(`\\definecolor{gdPageColor}{RGB}{${rgb.join(",")}}`);
      lines.push("\\pagecolor{gdPageColor}");
    }
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
import { resolveNearestDvipsColorName } from "../../exportFriendlyColors";
