export type ExportFriendlyColorPreset = {
  id: string;
  label: string;
  hex: string;
  exportName: string;
};

type ExportFriendlyColorAlias = {
  hex: string;
  exportName: string;
};

type DvipsnamedColor = {
  name: string;
  cmyk: [number, number, number, number];
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

export const PRIMARY_EXPORT_FRIENDLY_COLOR_PRESETS: ExportFriendlyColorPreset[] = [
  { id: "black", label: "Black", hex: "#000000", exportName: "black" },
  { id: "white", label: "White", hex: "#ffffff", exportName: "white" },
  { id: "red", label: "Red", hex: "#ff0000", exportName: "red" },
  { id: "green", label: "Green", hex: "#00ff00", exportName: "green" },
  { id: "blue", label: "Blue", hex: "#0000ff", exportName: "blue" },
  { id: "cyan", label: "Cyan", hex: "#00ffff", exportName: "cyan" },
  { id: "magenta", label: "Magenta", hex: "#ff00ff", exportName: "magenta" },
  { id: "yellow", label: "Yellow", hex: "#ffff00", exportName: "yellow" },
  { id: "orange", label: "Orange", hex: "#ff8000", exportName: "orange" },
  { id: "lime", label: "Lime", hex: "#bfff00", exportName: "lime" },
  { id: "olive", label: "Olive", hex: "#808000", exportName: "olive" },
  { id: "teal", label: "Teal", hex: "#008080", exportName: "teal" },
  { id: "purple", label: "Purple", hex: "#bf0040", exportName: "purple" },
  { id: "violet", label: "Violet", hex: "#800080", exportName: "violet" },
  { id: "brown", label: "Brown", hex: "#bf8040", exportName: "brown" },
  { id: "pink", label: "Pink", hex: "#ffbfbf", exportName: "pink" },
  { id: "darkgray", label: "Dark Gray", hex: "#404040", exportName: "darkgray" },
  { id: "gray", label: "Gray", hex: "#808080", exportName: "gray" },
  { id: "lightgray", label: "Light Gray", hex: "#bfbfbf", exportName: "lightgray" },
];

const DVIPSNAMED_COLOR_DATA: DvipsnamedColor[] = [
  { name: "GreenYellow", cmyk: [0.15, 0, 0.69, 0] },
  { name: "Goldenrod", cmyk: [0, 0.1, 0.84, 0] },
  { name: "Dandelion", cmyk: [0, 0.29, 0.84, 0] },
  { name: "Apricot", cmyk: [0, 0.32, 0.52, 0] },
  { name: "Peach", cmyk: [0, 0.5, 0.7, 0] },
  { name: "Melon", cmyk: [0, 0.46, 0.5, 0] },
  { name: "YellowOrange", cmyk: [0, 0.42, 1, 0] },
  { name: "BurntOrange", cmyk: [0, 0.51, 1, 0] },
  { name: "Bittersweet", cmyk: [0, 0.75, 1, 0.24] },
  { name: "RedOrange", cmyk: [0, 0.77, 0.87, 0] },
  { name: "Mahogany", cmyk: [0, 0.85, 0.87, 0.35] },
  { name: "Maroon", cmyk: [0, 0.87, 0.68, 0.32] },
  { name: "BrickRed", cmyk: [0, 0.89, 0.94, 0.28] },
  { name: "OrangeRed", cmyk: [0, 1, 0.5, 0] },
  { name: "RubineRed", cmyk: [0, 1, 0.13, 0] },
  { name: "WildStrawberry", cmyk: [0, 0.96, 0.39, 0] },
  { name: "Salmon", cmyk: [0, 0.53, 0.38, 0] },
  { name: "CarnationPink", cmyk: [0, 0.63, 0, 0] },
  { name: "VioletRed", cmyk: [0, 0.81, 0, 0] },
  { name: "Rhodamine", cmyk: [0, 0.82, 0, 0] },
  { name: "Mulberry", cmyk: [0.34, 0.9, 0, 0.02] },
  { name: "RedViolet", cmyk: [0.07, 0.9, 0, 0.34] },
  { name: "Fuchsia", cmyk: [0.47, 0.91, 0, 0.08] },
  { name: "Lavender", cmyk: [0, 0.48, 0, 0] },
  { name: "Thistle", cmyk: [0.12, 0.59, 0, 0] },
  { name: "Orchid", cmyk: [0.32, 0.64, 0, 0] },
  { name: "DarkOrchid", cmyk: [0.4, 0.8, 0.2, 0] },
  { name: "Plum", cmyk: [0.5, 1, 0, 0] },
  { name: "RoyalPurple", cmyk: [0.75, 0.9, 0, 0] },
  { name: "BlueViolet", cmyk: [0.86, 0.91, 0, 0.04] },
  { name: "Periwinkle", cmyk: [0.57, 0.55, 0, 0] },
  { name: "CadetBlue", cmyk: [0.62, 0.57, 0.23, 0] },
  { name: "CornflowerBlue", cmyk: [0.65, 0.13, 0, 0] },
  { name: "MidnightBlue", cmyk: [0.98, 0.13, 0, 0.43] },
  { name: "NavyBlue", cmyk: [0.94, 0.54, 0, 0] },
  { name: "RoyalBlue", cmyk: [1, 0.5, 0, 0] },
  { name: "Cerulean", cmyk: [0.94, 0.11, 0, 0] },
  { name: "ProcessBlue", cmyk: [0.96, 0, 0, 0] },
  { name: "SkyBlue", cmyk: [0.62, 0, 0.12, 0] },
  { name: "Turquoise", cmyk: [0.85, 0, 0.2, 0] },
  { name: "TealBlue", cmyk: [0.86, 0, 0.34, 0.02] },
  { name: "Aquamarine", cmyk: [0.82, 0, 0.3, 0] },
  { name: "BlueGreen", cmyk: [0.85, 0, 0.33, 0] },
  { name: "Emerald", cmyk: [1, 0, 0.5, 0] },
  { name: "JungleGreen", cmyk: [0.99, 0, 0.52, 0] },
  { name: "SeaGreen", cmyk: [0.69, 0, 0.5, 0] },
  { name: "ForestGreen", cmyk: [0.91, 0, 0.88, 0.12] },
  { name: "PineGreen", cmyk: [0.92, 0, 0.59, 0.25] },
  { name: "LimeGreen", cmyk: [0.5, 0, 1, 0] },
  { name: "YellowGreen", cmyk: [0.44, 0, 0.74, 0] },
  { name: "SpringGreen", cmyk: [0.26, 0, 0.76, 0] },
  { name: "OliveGreen", cmyk: [0.64, 0, 0.95, 0.4] },
  { name: "RawSienna", cmyk: [0, 0.72, 1, 0.45] },
  { name: "Sepia", cmyk: [0, 0.83, 1, 0.7] },
  { name: "Tan", cmyk: [0.14, 0.42, 0.56, 0] },
];

export const EXPORT_FRIENDLY_COLOR_PRESETS: ExportFriendlyColorPreset[] = (() => {
  const presets = [...PRIMARY_EXPORT_FRIENDLY_COLOR_PRESETS];
  const seenNames = new Set(presets.map((preset) => preset.exportName.toLowerCase()));

  for (const entry of DVIPSNAMED_COLOR_DATA) {
    if (seenNames.has(entry.name.toLowerCase())) continue;
    presets.push({
      id: entry.name.toLowerCase(),
      label: entry.name,
      hex: cmykToHex(...entry.cmyk),
      exportName: entry.name,
    });
    seenNames.add(entry.name.toLowerCase());
  }

  return presets;
})();

const EXPORT_FRIENDLY_COLOR_ALIASES: ExportFriendlyColorAlias[] = [
  { hex: "#e7dcc8", exportName: "brown!25!white" },
  { hex: "#0f172a", exportName: "black" },
  { hex: "#334155", exportName: "darkgray" },
  { hex: "#0f766e", exportName: "teal" },
];

const exportFriendlyNameByHex = new Map<string, string>();
const exportFriendlyHexByName = new Map<string, string>();

for (const preset of EXPORT_FRIENDLY_COLOR_PRESETS) {
  exportFriendlyNameByHex.set(preset.hex, preset.exportName);
  exportFriendlyHexByName.set(preset.exportName.toLowerCase(), preset.hex);
}

for (const alias of EXPORT_FRIENDLY_COLOR_ALIASES) {
  exportFriendlyNameByHex.set(alias.hex, alias.exportName);
  if (!exportFriendlyHexByName.has(alias.exportName.toLowerCase())) {
    exportFriendlyHexByName.set(alias.exportName.toLowerCase(), alias.hex);
  }
}

export const exportFriendlyColorNameByRgbKey: Record<string, string> = Object.fromEntries(
  Array.from(exportFriendlyNameByHex.entries()).map(([hex, exportName]) => [hexToRgbKey(hex), exportName])
);

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function cmykToHex(c: number, m: number, y: number, k: number): string {
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);
  return rgbToHex(r, g, b);
}

export function normalizeHexColor(raw: string): string | null {
  const trimmed = raw.trim();
  const shortHex = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortHex) {
    return `#${shortHex[1]
      .split("")
      .map((digit) => digit + digit)
      .join("")
      .toLowerCase()}`;
  }
  const fullHex = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (fullHex) {
    return `#${fullHex[1].toLowerCase()}`;
  }
  return null;
}

export function parseColorToRgb(raw: string): Rgb | null {
  const namedHex = exportFriendlyHexByName.get(raw.trim().toLowerCase());
  if (namedHex) {
    return hexToRgb(namedHex);
  }

  const hex = normalizeHexColor(raw);
  if (hex) {
    return hexToRgb(hex);
  }

  const rgb = /^rgba?\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)(?:\s*,\s*([+-]?\d*(?:\.\d+)?))?\s*\)$/i.exec(
    raw.trim()
  );
  if (!rgb) return null;
  return {
    r: clampChannel(Number(rgb[1])),
    g: clampChannel(Number(rgb[2])),
    b: clampChannel(Number(rgb[3])),
  };
}

export function colorToHex(raw: string): string | null {
  const rgb = parseColorToRgb(raw);
  if (!rgb) return null;
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function resolveExportFriendlyColorName(raw: string): string | null {
  const named = exportFriendlyHexByName.get(raw.trim().toLowerCase());
  if (named) {
    return exportFriendlyNameByHex.get(named) ?? null;
  }

  const hex = colorToHex(raw);
  if (!hex) return null;
  return exportFriendlyNameByHex.get(hex) ?? null;
}

export function hexToRgbKey(hex: string): string {
  const rgb = hexToRgb(hex);
  return `${rgb.r},${rgb.g},${rgb.b}`;
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHexColor(hex) ?? "#000000";
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}
