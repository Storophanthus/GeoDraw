
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
import { SectorStyleSection } from "./object-styles/SectorStyleSection";
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
  updateSelectedLineFields: (fields: Partial<Pick<SceneLine, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
  canConvertSelectedLineToSegment: boolean;
  convertSelectedLineToSegment: () => void;
  updateSelectedPolygonFields: (fields: Partial<Pick<ScenePolygon, "showLabel" | "labelText" | "labelPosWorld" | "visible">>) => void;
  setSelectedPolygonOwnedSegmentsVisible: (visible: boolean) => void;
  selectedStyleAsDefault: boolean;
  onMakeStyleDefaultChange: (checked: boolean) => void;
  deleteSelectedObject: () => void;
  deleteLabel?: string;
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
  updateSelectedLineFields,
  canConvertSelectedLineToSegment,
  convertSelectedLineToSegment,
  updateSelectedPolygonFields,
  setSelectedPolygonOwnedSegmentsVisible,
  selectedStyleAsDefault,
  onMakeStyleDefaultChange,
  deleteSelectedObject,
  deleteLabel = "Delete",
}: ObjectStyleSectionsProps) {
  return (
    <>
      {!selectedPointPresent && !selectedAngle && selectedSegment && (
        <SegmentStyleSection
          selectedSegment={selectedSegment}
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={onMakeStyleDefaultChange}
          updateSelectedSegmentStyle={updateSelectedSegmentStyle}
        />
      )}

      {!selectedPointPresent && !selectedAngle && selectedLine && (
        <LineStyleSection
          selectedLine={selectedLine}
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={onMakeStyleDefaultChange}
          updateSelectedLineStyle={updateSelectedLineStyle}
          updateSelectedLineFields={updateSelectedLineFields}
          canConvertToSegment={canConvertSelectedLineToSegment}
          convertSelectedLineToSegment={convertSelectedLineToSegment}
        />
      )}

      {!selectedPointPresent && !selectedAngle && selectedPolygon && (
        <PolygonStyleSection
          selectedPolygon={selectedPolygon}
          selectedPolygonOwnedEdgesVisible={selectedPolygonOwnedEdgesVisible}
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={onMakeStyleDefaultChange}
          updateSelectedPolygonStyle={updateSelectedPolygonStyle}
          updateSelectedPolygonFields={updateSelectedPolygonFields}
          setSelectedPolygonOwnedSegmentsVisible={setSelectedPolygonOwnedSegmentsVisible}
        />
      )}

      {!selectedPointPresent && !selectedAngle && !selectedPolygon && selectedCircle && (
        <CircleStyleSection
          selectedCircle={selectedCircle}
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={onMakeStyleDefaultChange}
          updateSelectedCircleStyle={updateSelectedCircleStyle}
        />
      )}

      {!selectedPointPresent && selectedAngle && selectedAngle.kind !== "sector" && (
        <AngleStyleSection
          selectedAngle={selectedAngle}
          selectedAngleRightStatus={selectedAngleRightStatus}
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={onMakeStyleDefaultChange}
          updateSelectedAngleStyle={updateSelectedAngleStyle}
          deleteSelectedObject={deleteSelectedObject}
          deleteLabel={deleteLabel}
        />
      )}

      {!selectedPointPresent && selectedAngle && selectedAngle.kind === "sector" && (
        <SectorStyleSection
          selectedSector={selectedAngle}
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={onMakeStyleDefaultChange}
          updateSelectedAngleStyle={updateSelectedAngleStyle}
          deleteSelectedObject={deleteSelectedObject}
          deleteLabel={deleteLabel}
        />
      )}
    </>
  );
}
