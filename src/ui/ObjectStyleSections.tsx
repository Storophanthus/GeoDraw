
import {
  type AngleStyle,
  type CircleStyle,
  type LineStyle,
  type SceneAngle,
  type SceneCircle,
  type SceneLine,
  type ScenePolygon,
  type SceneSegment,
} from "../scene/points";

import { AngleStyleSection } from "./object-styles/AngleStyleSection";
import { CircleStyleSection } from "./object-styles/CircleStyleSection";
import { LineStyleSection } from "./object-styles/LineStyleSection";
import { PolygonStyleSection } from "./object-styles/PolygonStyleSection";
import { SegmentStyleSection } from "./object-styles/SegmentStyleSection";

type ObjectStyleSectionsProps = {
  selectedPointPresent: boolean;
  selectedSegment: SceneSegment | null;
  selectedLine: SceneLine | null;
  selectedCircle: SceneCircle | null;
  selectedPolygon: ScenePolygon | null;
  selectedPolygonOwnedEdgesVisible: boolean;
  selectedAngle: SceneAngle | null;
  selectedAngleRightStatus: "none" | "approx" | "exact";
  updateSelectedSegmentStyle: (style: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (style: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (style: Partial<CircleStyle>) => void;
  updateSelectedPolygonStyle: (style: Partial<ScenePolygon["style"]>) => void;
  updateSelectedAngleStyle: (style: Partial<AngleStyle>) => void;
  updateSelectedSegmentFields: (fields: Partial<Pick<SceneSegment, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
  updateSelectedLineFields: (fields: Partial<Pick<SceneLine, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
  updateSelectedCircleFields: (fields: Partial<Pick<SceneCircle, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
  updateSelectedPolygonFields: (fields: Partial<Pick<ScenePolygon, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
  setSelectedPolygonOwnedSegmentsVisible: (visible: boolean) => void;
  deleteSelectedObject: () => void;
};

export function ObjectStyleSections({
  selectedPointPresent,
  selectedSegment,
  selectedLine,
  selectedCircle,
  selectedPolygon,
  selectedPolygonOwnedEdgesVisible,
  selectedAngle,
  selectedAngleRightStatus,
  updateSelectedSegmentStyle,
  updateSelectedLineStyle,
  updateSelectedCircleStyle,
  updateSelectedPolygonStyle,
  updateSelectedAngleStyle,
  updateSelectedSegmentFields,
  updateSelectedLineFields,
  updateSelectedCircleFields,
  updateSelectedPolygonFields,
  setSelectedPolygonOwnedSegmentsVisible,
  deleteSelectedObject,
}: ObjectStyleSectionsProps) {
  return (
    <>
      {!selectedPointPresent && !selectedAngle && selectedSegment && (
        <SegmentStyleSection
          selectedSegment={selectedSegment}
          updateSelectedSegmentStyle={updateSelectedSegmentStyle}
          updateSelectedSegmentFields={updateSelectedSegmentFields}
        />
      )}

      {!selectedPointPresent && !selectedAngle && selectedLine && (
        <LineStyleSection
          selectedLine={selectedLine}
          updateSelectedLineStyle={updateSelectedLineStyle}
          updateSelectedLineFields={updateSelectedLineFields}
        />
      )}

      {!selectedPointPresent && !selectedAngle && selectedPolygon && (
        <PolygonStyleSection
          selectedPolygon={selectedPolygon}
          selectedPolygonOwnedEdgesVisible={selectedPolygonOwnedEdgesVisible}
          updateSelectedPolygonStyle={updateSelectedPolygonStyle}
          updateSelectedPolygonFields={updateSelectedPolygonFields}
          setSelectedPolygonOwnedSegmentsVisible={setSelectedPolygonOwnedSegmentsVisible}
        />
      )}

      {!selectedPointPresent && !selectedAngle && !selectedPolygon && selectedCircle && (
        <CircleStyleSection
          selectedCircle={selectedCircle}
          updateSelectedCircleStyle={updateSelectedCircleStyle}
          updateSelectedCircleFields={updateSelectedCircleFields}
        />
      )}

      {!selectedPointPresent && selectedAngle && (
        <AngleStyleSection
          selectedAngle={selectedAngle}
          selectedAngleRightStatus={selectedAngleRightStatus}
          updateSelectedAngleStyle={updateSelectedAngleStyle}
          deleteSelectedObject={deleteSelectedObject}
        />
      )}
    </>
  );
}
