import type { AngleStyle, CircleStyle, LineStyle, PointStyle, PolygonStyle } from "../../scene/points";
import {
  buildDefaultStylesForProfile,
  DEFAULT_COLOR_PROFILE_ID,
} from "../colorProfiles";

const profileDefaults = buildDefaultStylesForProfile(DEFAULT_COLOR_PROFILE_ID);

export const defaultPointStyle: PointStyle = profileDefaults.pointDefaults;
export const defaultSegmentStyle: LineStyle = profileDefaults.segmentDefaults;
export const defaultLineStyle: LineStyle = profileDefaults.lineDefaults;
export const defaultCircleStyle: CircleStyle = profileDefaults.circleDefaults;
export const defaultPolygonStyle: PolygonStyle = profileDefaults.polygonDefaults;
export const defaultAngleStyle: AngleStyle = profileDefaults.angleDefaults;

export function createSceneSliceState() {
  return {
    scene: {
      points: [],
      vectors: [],
      segments: [],
      lines: [],
      circles: [],
      polygons: [],
      angles: [],
      numbers: [],
      textLabels: [],
    },
    nextPointId: 1,
    nextSegmentId: 1,
    nextLineId: 1,
    nextCircleId: 1,
    nextPolygonId: 1,
    nextAngleId: 1,
    nextNumberId: 1,
    nextVectorId: 1,
    nextTextLabelId: 1,
    pointDefaults: defaultPointStyle,
    segmentDefaults: defaultSegmentStyle,
    lineDefaults: defaultLineStyle,
    circleDefaults: defaultCircleStyle,
    polygonDefaults: defaultPolygonStyle,
    angleDefaults: defaultAngleStyle,
  };
}
