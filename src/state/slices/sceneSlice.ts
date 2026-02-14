import type { AngleStyle, CircleStyle, LineStyle, PointStyle, PolygonStyle } from "../../scene/points";

export const defaultPointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.4,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 18,
  labelHaloWidthPx: 3.5,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

export const defaultSegmentStyle: LineStyle = {
  strokeColor: "#0f766e",
  strokeWidth: 2,
  dash: "solid",
  opacity: 1,
  segmentMark: {
    enabled: false,
    mark: "none",
    pos: 0.5,
    sizePt: 4,
  },
  segmentArrowMark: {
    enabled: false,
    mode: "end",
    direction: "->",
    distribution: "single",
    pos: 0.5,
    startPos: 0.45,
    endPos: 0.55,
    step: 0.05,
    sizeScale: 1,
    lineWidthPt: 8,
  },
};

export const defaultLineStyle: LineStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.6,
  dash: "solid",
  opacity: 1,
};

export const defaultCircleStyle: CircleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.6,
  strokeDash: "solid",
  strokeOpacity: 1,
  fillOpacity: 0,
  pattern: "",
};

export const defaultPolygonStyle: PolygonStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.6,
  strokeDash: "solid",
  strokeOpacity: 1,
  fillColor: "#93c5fd",
  fillOpacity: 0.22,
  pattern: "",
};

export const defaultAngleStyle: AngleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.8,
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 16,
  fillEnabled: false,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
  pattern: "",
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 4,
  markColor: "#334155",
  arcRadius: 0.85,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: true,
  showValue: true,
  promoteToSolid: false,
};

export function createSceneSliceState() {
  return {
    scene: {
      points: [],
      segments: [],
      lines: [],
      circles: [],
      polygons: [],
      angles: [],
      numbers: [],
    },
    nextPointId: 1,
    nextSegmentId: 1,
    nextLineId: 1,
    nextCircleId: 1,
    nextPolygonId: 1,
    nextAngleId: 1,
    nextNumberId: 1,
    pointDefaults: defaultPointStyle,
    segmentDefaults: defaultSegmentStyle,
    lineDefaults: defaultLineStyle,
    circleDefaults: defaultCircleStyle,
    polygonDefaults: defaultPolygonStyle,
    angleDefaults: defaultAngleStyle,
  };
}
