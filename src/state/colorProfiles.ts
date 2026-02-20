import type {
  AngleStyle,
  CircleStyle,
  LineStyle,
  PathArrowMark,
  PointStyle,
  PolygonStyle,
  SceneModel,
} from "../scene/points";

export type ColorProfileId = "classic" | "grayscale_white_dot" | "beige_light";

export type CanvasColorTheme = {
  backgroundColor: string;
  gridMinorColor: string;
  gridMajorColor: string;
  axisColor: string;
};

export type ColorProfilePalette = CanvasColorTheme & {
  pointStroke: string;
  pointFill: string;
  pointLabel: string;
  pointLabelHalo: string;
  segmentStroke: string;
  lineStroke: string;
  circleStroke: string;
  polygonStroke: string;
  polygonFill: string;
  angleStroke: string;
  angleText: string;
  angleFill: string;
  angleMark: string;
  arrow: string;
  marking: string;
};

export type ColorProfile = {
  id: ColorProfileId;
  label: string;
  palette: ColorProfilePalette;
};

export type SceneStyleDefaults = {
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  polygonDefaults: PolygonStyle;
  angleDefaults: AngleStyle;
};

export const DEFAULT_COLOR_PROFILE_ID: ColorProfileId = "classic";

const DEFAULT_PATH_ARROW_UI = 1.0;
const DEFAULT_PATH_ARROW_LINE_WIDTH_PT = DEFAULT_PATH_ARROW_UI * 8;

const COLOR_PROFILES: readonly ColorProfile[] = [
  {
    id: "classic",
    label: "Classic",
    palette: {
      backgroundColor: "#ffffff",
      gridMinorColor: "#000000",
      gridMajorColor: "#000000",
      axisColor: "#334155",
      pointStroke: "#0f172a",
      pointFill: "#60a5fa",
      pointLabel: "#0f172a",
      pointLabelHalo: "#ffffff",
      segmentStroke: "#0f766e",
      lineStroke: "#334155",
      circleStroke: "#334155",
      polygonStroke: "#334155",
      polygonFill: "#93c5fd",
      angleStroke: "#334155",
      angleText: "#0f172a",
      angleFill: "#93c5fd",
      angleMark: "#334155",
      arrow: "#334155",
      marking: "#334155",
    },
  },
  {
    id: "grayscale_white_dot",
    label: "Grayscale - White Dot",
    palette: {
      backgroundColor: "#ffffff",
      gridMinorColor: "#000000",
      gridMajorColor: "#000000",
      axisColor: "#000000",
      pointStroke: "#000000",
      pointFill: "#ffffff",
      pointLabel: "#000000",
      pointLabelHalo: "#ffffff",
      segmentStroke: "#000000",
      lineStroke: "#000000",
      circleStroke: "#000000",
      polygonStroke: "#000000",
      polygonFill: "#bfbfbf",
      angleStroke: "#000000",
      angleText: "#000000",
      angleFill: "#bfbfbf",
      angleMark: "#000000",
      arrow: "#000000",
      marking: "#000000",
    },
  },
  {
    id: "beige_light",
    label: "Beige - Light",
    palette: {
      backgroundColor: "#f5f1e6",
      gridMinorColor: "#7a6a52",
      gridMajorColor: "#6a5944",
      axisColor: "#4f4638",
      pointStroke: "#000000",
      pointFill: "#ffffff",
      pointLabel: "#000000",
      pointLabelHalo: "#f5f1e6",
      segmentStroke: "#000000",
      lineStroke: "#000000",
      circleStroke: "#000000",
      polygonStroke: "#000000",
      polygonFill: "#e7dcc8",
      angleStroke: "#000000",
      angleText: "#000000",
      angleFill: "#e7dcc8",
      angleMark: "#000000",
      arrow: "#000000",
      marking: "#000000",
    },
  },
] as const;

export const COLOR_PROFILE_OPTIONS: ReadonlyArray<{ id: ColorProfileId; label: string }> = COLOR_PROFILES.map((profile) => ({
  id: profile.id,
  label: profile.label,
}));

export function getColorProfile(profileId: ColorProfileId): ColorProfile {
  const found = COLOR_PROFILES.find((profile) => profile.id === profileId);
  return found ?? COLOR_PROFILES[0];
}

export function getCanvasColorTheme(profileId: ColorProfileId): CanvasColorTheme {
  const palette = getColorProfile(profileId).palette;
  return {
    backgroundColor: palette.backgroundColor,
    gridMinorColor: palette.gridMinorColor,
    gridMajorColor: palette.gridMajorColor,
    axisColor: palette.axisColor,
  };
}

export function buildDefaultStylesForProfile(profileId: ColorProfileId): SceneStyleDefaults {
  const palette = getColorProfile(profileId).palette;
  return {
    pointDefaults: {
      shape: "circle",
      sizePx: 6,
      strokeColor: palette.pointStroke,
      strokeWidth: 1.7,
      strokeOpacity: 1,
      fillColor: palette.pointFill,
      fillOpacity: 1,
      labelFontPx: 18,
      labelHaloWidthPx: 3.5,
      labelHaloColor: palette.pointLabelHalo,
      labelColor: palette.pointLabel,
      labelOffsetPx: { x: 8, y: -8 },
    },
    segmentDefaults: {
      strokeColor: palette.segmentStroke,
      strokeWidth: 2,
      dash: "solid",
      opacity: 1,
      segmentMark: {
        enabled: false,
        mark: "none",
        pos: 0.5,
        sizePt: 4,
        color: palette.marking,
      },
      segmentArrowMark: {
        enabled: false,
        mode: "end",
        direction: "->",
        tip: "Stealth",
        distribution: "single",
        pos: 0.5,
        startPos: 0.45,
        endPos: 0.55,
        step: 0.05,
        sizeScale: DEFAULT_PATH_ARROW_UI,
        lineWidthPt: DEFAULT_PATH_ARROW_LINE_WIDTH_PT,
        arrowLength: 1.0,
        color: palette.arrow,
      },
    },
    lineDefaults: {
      strokeColor: palette.lineStroke,
      strokeWidth: 1.6,
      dash: "solid",
      opacity: 1,
    },
    circleDefaults: {
      strokeColor: palette.circleStroke,
      strokeWidth: 1.6,
      strokeDash: "solid",
      strokeOpacity: 1,
      fillOpacity: 0,
      pattern: "",
      arrowMark: {
        enabled: false,
        direction: "->",
        tip: "Stealth",
        distribution: "single",
        pos: 0.5,
        startPos: 0.45,
        endPos: 0.55,
        step: 0.05,
        sizeScale: DEFAULT_PATH_ARROW_UI,
        lineWidthPt: DEFAULT_PATH_ARROW_LINE_WIDTH_PT,
        color: palette.arrow,
      },
    },
    polygonDefaults: {
      strokeColor: palette.polygonStroke,
      strokeWidth: 1.6,
      strokeDash: "solid",
      strokeOpacity: 1,
      fillColor: palette.polygonFill,
      fillOpacity: 0.22,
      pattern: "",
    },
    angleDefaults: {
      strokeColor: palette.angleStroke,
      strokeWidth: 1,
      strokeDash: "solid",
      strokeOpacity: 1,
      textColor: palette.angleText,
      textSize: 16,
      fillEnabled: false,
      fillColor: palette.angleFill,
      fillOpacity: 0.2,
      pattern: "",
      markStyle: "arc",
      markSymbol: "none",
      arcMultiplicity: 1,
      markPos: 0.5,
      markSize: 7.4,
      markColor: palette.angleMark,
      arcRadius: 1.95,
      labelText: "",
      labelPosWorld: { x: 0, y: 0 },
      showLabel: true,
      showValue: true,
      promoteToSolid: false,
      arcArrowMark: {
        enabled: false,
        direction: "->",
        tip: "Stealth",
        distribution: "single",
        pos: 0.5,
        startPos: 0.45,
        endPos: 0.55,
        step: 0.05,
        sizeScale: DEFAULT_PATH_ARROW_UI,
        lineWidthPt: DEFAULT_PATH_ARROW_LINE_WIDTH_PT,
        color: palette.arrow,
      },
    },
  };
}

export function applyProfileColorsToDefaults(defaults: SceneStyleDefaults, profileId: ColorProfileId): SceneStyleDefaults {
  const palette = getColorProfile(profileId).palette;
  return {
    pointDefaults: {
      ...defaults.pointDefaults,
      strokeColor: palette.pointStroke,
      fillColor: palette.pointFill,
      labelColor: palette.pointLabel,
      labelHaloColor: palette.pointLabelHalo,
      labelOffsetPx: { ...defaults.pointDefaults.labelOffsetPx },
    },
    segmentDefaults: {
      ...defaults.segmentDefaults,
      strokeColor: palette.segmentStroke,
      segmentMark: defaults.segmentDefaults.segmentMark
        ? { ...defaults.segmentDefaults.segmentMark, color: palette.marking }
        : defaults.segmentDefaults.segmentMark,
      segmentArrowMark: defaults.segmentDefaults.segmentArrowMark
        ? { ...defaults.segmentDefaults.segmentArrowMark, color: palette.arrow }
        : defaults.segmentDefaults.segmentArrowMark,
      segmentArrowMarks: defaults.segmentDefaults.segmentArrowMarks?.map((arrow) => ({
        ...arrow,
        color: palette.arrow,
      })),
    },
    lineDefaults: {
      ...defaults.lineDefaults,
      strokeColor: palette.lineStroke,
    },
    circleDefaults: {
      ...defaults.circleDefaults,
      strokeColor: palette.circleStroke,
      fillColor: defaults.circleDefaults.fillColor === undefined ? undefined : palette.polygonFill,
      arrowMark: defaults.circleDefaults.arrowMark
        ? { ...defaults.circleDefaults.arrowMark, color: palette.arrow }
        : defaults.circleDefaults.arrowMark,
      arrowMarks: defaults.circleDefaults.arrowMarks?.map((arrow) => ({ ...arrow, color: palette.arrow })),
    },
    polygonDefaults: {
      ...defaults.polygonDefaults,
      strokeColor: palette.polygonStroke,
      fillColor: defaults.polygonDefaults.fillColor === undefined ? undefined : palette.polygonFill,
      arrowMark: defaults.polygonDefaults.arrowMark
        ? { ...defaults.polygonDefaults.arrowMark, color: palette.arrow }
        : defaults.polygonDefaults.arrowMark,
    },
    angleDefaults: {
      ...defaults.angleDefaults,
      strokeColor: palette.angleStroke,
      textColor: palette.angleText,
      fillColor: palette.angleFill,
      markColor: palette.angleMark,
      labelPosWorld: { ...defaults.angleDefaults.labelPosWorld },
      arcArrowMark: defaults.angleDefaults.arcArrowMark
        ? { ...defaults.angleDefaults.arcArrowMark, color: palette.arrow }
        : defaults.angleDefaults.arcArrowMark,
      arcArrowMarks: defaults.angleDefaults.arcArrowMarks?.map((arrow) => ({ ...arrow, color: palette.arrow })),
    },
  };
}

export function recolorSceneForProfile(scene: SceneModel, fromProfileId: ColorProfileId, toProfileId: ColorProfileId): SceneModel {
  if (fromProfileId === toProfileId) return scene;
  const fromPalette = getColorProfile(fromProfileId).palette;
  const toPalette = getColorProfile(toProfileId).palette;
  const colorMap = buildColorRemap(fromPalette, toPalette);

  return {
    ...scene,
    points: scene.points.map((point) => ({
      ...point,
      style: {
        ...point.style,
        strokeColor: remapColor(point.style.strokeColor, colorMap),
        fillColor: remapColor(point.style.fillColor, colorMap),
        labelColor: remapColor(point.style.labelColor, colorMap),
        labelHaloColor: remapColor(point.style.labelHaloColor, colorMap),
        labelOffsetPx: { ...point.style.labelOffsetPx },
      },
    })),
    segments: scene.segments.map((segment) => ({
      ...segment,
      style: {
        ...segment.style,
        strokeColor: remapColor(segment.style.strokeColor, colorMap),
        segmentMark: segment.style.segmentMark
          ? {
            ...segment.style.segmentMark,
            color: remapOptionalColor(segment.style.segmentMark.color, colorMap),
          }
          : segment.style.segmentMark,
        segmentArrowMark: remapArrowMark(segment.style.segmentArrowMark, colorMap),
        segmentArrowMarks: segment.style.segmentArrowMarks?.map((arrow) => remapArrowMark(arrow, colorMap)),
      },
    })),
    lines: scene.lines.map((line) => ({
      ...line,
      style: {
        ...line.style,
        strokeColor: remapColor(line.style.strokeColor, colorMap),
      },
    })),
    circles: scene.circles.map((circle) => ({
      ...circle,
      style: {
        ...circle.style,
        strokeColor: remapColor(circle.style.strokeColor, colorMap),
        fillColor: remapOptionalColor(circle.style.fillColor, colorMap),
        patternColor: remapOptionalColor(circle.style.patternColor, colorMap),
        arrowMark: remapArrowMark(circle.style.arrowMark, colorMap),
        arrowMarks: circle.style.arrowMarks?.map((arrow) => remapArrowMark(arrow, colorMap)),
      },
    })),
    polygons: scene.polygons.map((polygon) => ({
      ...polygon,
      style: {
        ...polygon.style,
        strokeColor: remapColor(polygon.style.strokeColor, colorMap),
        fillColor: remapOptionalColor(polygon.style.fillColor, colorMap),
        patternColor: remapOptionalColor(polygon.style.patternColor, colorMap),
        arrowMark: remapArrowMark(polygon.style.arrowMark, colorMap),
      },
    })),
    angles: scene.angles.map((angle) => ({
      ...angle,
      style: {
        ...angle.style,
        strokeColor: remapColor(angle.style.strokeColor, colorMap),
        textColor: remapColor(angle.style.textColor, colorMap),
        fillColor: remapColor(angle.style.fillColor, colorMap),
        patternColor: remapOptionalColor(angle.style.patternColor, colorMap),
        markColor: remapColor(angle.style.markColor, colorMap),
        labelPosWorld: { ...angle.style.labelPosWorld },
        arcArrowMark: remapArrowMark(angle.style.arcArrowMark, colorMap),
        arcArrowMarks: angle.style.arcArrowMarks?.map((arrow) => remapArrowMark(arrow, colorMap)),
      },
    })),
    numbers: [...scene.numbers],
    vectors: scene.vectors ? [...scene.vectors] : undefined,
  };
}

function remapArrowMark<T extends PathArrowMark | undefined>(arrow: T, colorMap: Map<string, string>): T {
  if (!arrow) return arrow;
  return {
    ...arrow,
    color: remapOptionalColor(arrow.color, colorMap),
  };
}

function buildColorRemap(fromPalette: ColorProfilePalette, toPalette: ColorProfilePalette): Map<string, string> {
  const pairs: Array<[string, string]> = [
    [fromPalette.pointStroke, toPalette.pointStroke],
    [fromPalette.pointFill, toPalette.pointFill],
    [fromPalette.pointLabel, toPalette.pointLabel],
    [fromPalette.pointLabelHalo, toPalette.pointLabelHalo],
    [fromPalette.segmentStroke, toPalette.segmentStroke],
    [fromPalette.lineStroke, toPalette.lineStroke],
    [fromPalette.circleStroke, toPalette.circleStroke],
    [fromPalette.polygonStroke, toPalette.polygonStroke],
    [fromPalette.polygonFill, toPalette.polygonFill],
    [fromPalette.angleStroke, toPalette.angleStroke],
    [fromPalette.angleText, toPalette.angleText],
    [fromPalette.angleFill, toPalette.angleFill],
    [fromPalette.angleMark, toPalette.angleMark],
    [fromPalette.arrow, toPalette.arrow],
    [fromPalette.marking, toPalette.marking],
  ];
  const colorMap = new Map<string, string>();
  for (const [from, to] of pairs) {
    const fromKey = normalizeColorToken(from);
    const toValue = to.trim();
    if (!fromKey || !toValue) continue;
    if (!colorMap.has(fromKey)) {
      colorMap.set(fromKey, toValue);
      continue;
    }
    if (normalizeColorToken(colorMap.get(fromKey) ?? "") === normalizeColorToken(toValue)) continue;
  }
  return colorMap;
}

function remapColor(color: string, colorMap: Map<string, string>): string {
  const mapped = colorMap.get(normalizeColorToken(color));
  return mapped ?? color;
}

function remapOptionalColor(color: string | undefined, colorMap: Map<string, string>): string | undefined {
  if (!color) return color;
  return remapColor(color, colorMap);
}

function normalizeColorToken(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}
