import { useMemo, useRef, useState } from "react";
import type {
  AngleStyle,
  CircleStyle,
  LineStyle,
  PointStyle,
  SceneAngle,
  SceneCircle,
  SceneEllipse,
  SceneLine,
  SceneModel,
  ScenePoint,
  ScenePolygon,
  SceneRichTextStyle,
  SceneSegment,
  SceneTextLabelStyle,
} from "../scene/points";
import type { ObjectLabelDefaults } from "../state/slices/storeTypes";
import { PointPropertiesSection } from "./PointPropertiesSection";
import { AngleStyleSection } from "./object-styles/AngleStyleSection";
import { CircleStyleSection } from "./object-styles/CircleStyleSection";
import { LineStyleSection } from "./object-styles/LineStyleSection";
import { PolygonStyleSection } from "./object-styles/PolygonStyleSection";
import { RichTextStyleSection } from "./object-styles/RichTextStyleSection";
import { SectorStyleSection } from "./object-styles/SectorStyleSection";
import { SegmentStyleSection } from "./object-styles/SegmentStyleSection";
import { TextLabelStyleSection } from "./object-styles/TextLabelStyleSection";
import type { ToolDefaultKind } from "./toolPreconfigure";

type ToolDefaultStyleSectionsProps = {
  kind: ToolDefaultKind | null;
  scene: SceneModel;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  ellipseDefaults: CircleStyle;
  polygonDefaults: ScenePolygon["style"];
  angleDefaults: AngleStyle;
  objectLabelDefaults: ObjectLabelDefaults;
  labelToolDefaults: SceneTextLabelStyle;
  richTextToolDefaults: SceneRichTextStyle;
  setPointDefaults: (next: Partial<PointStyle>) => void;
  setSegmentDefaults: (next: Partial<LineStyle>) => void;
  setLineDefaults: (next: Partial<LineStyle>) => void;
  setCircleDefaults: (next: Partial<CircleStyle>) => void;
  setEllipseDefaults: (next: Partial<CircleStyle>) => void;
  setPolygonDefaults: (next: Partial<ScenePolygon["style"]>) => void;
  setAngleDefaults: (next: Partial<AngleStyle>) => void;
  setObjectLabelDefaults: (next: Partial<ObjectLabelDefaults>) => void;
  setLabelToolDefaults: (next: Partial<SceneTextLabelStyle>) => void;
  setRichTextToolDefaults: (next: Partial<SceneRichTextStyle>) => void;
};

export function ToolDefaultStyleSections({
  kind,
  scene,
  pointDefaults,
  segmentDefaults,
  lineDefaults,
  circleDefaults,
  ellipseDefaults,
  polygonDefaults,
  angleDefaults,
  objectLabelDefaults,
  labelToolDefaults,
  richTextToolDefaults,
  setPointDefaults,
  setSegmentDefaults,
  setLineDefaults,
  setCircleDefaults,
  setEllipseDefaults,
  setPolygonDefaults,
  setAngleDefaults,
  setObjectLabelDefaults,
  setLabelToolDefaults,
  setRichTextToolDefaults,
}: ToolDefaultStyleSectionsProps) {
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const shapePickerRef = useRef<HTMLDivElement | null>(null);

  const point = useMemo<ScenePoint>(
    () => ({
      id: "__tool_default_point__",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: objectLabelDefaults.point,
      position: { x: 0, y: 0 },
      style: pointDefaults,
    }),
    [objectLabelDefaults.point, pointDefaults]
  );

  const segment = useMemo<SceneSegment>(
    () => ({
      id: "__tool_default_segment__",
      aId: "__tool_default_a__",
      bId: "__tool_default_b__",
      visible: true,
      showLabel: objectLabelDefaults.segment,
      labelGlow: objectLabelDefaults.segmentGlow ?? true,
      style: segmentDefaults,
    }),
    [objectLabelDefaults.segment, objectLabelDefaults.segmentGlow, segmentDefaults]
  );

  const line = useMemo<SceneLine>(
    () => ({
      id: "__tool_default_line__",
      kind: "twoPoint",
      aId: "__tool_default_a__",
      bId: "__tool_default_b__",
      visible: true,
      showLabel: objectLabelDefaults.line,
      labelGlow: objectLabelDefaults.lineGlow ?? true,
      style: lineDefaults,
    }),
    [lineDefaults, objectLabelDefaults.line, objectLabelDefaults.lineGlow]
  );

  const circle = useMemo<SceneCircle>(
    () => ({
      id: "__tool_default_circle__",
      kind: "twoPoint",
      centerId: "__tool_default_center__",
      throughId: "__tool_default_through__",
      visible: true,
      showLabel: objectLabelDefaults.circle,
      labelGlow: objectLabelDefaults.circleGlow ?? true,
      style: circleDefaults,
    }),
    [circleDefaults, objectLabelDefaults.circle, objectLabelDefaults.circleGlow]
  );

  const ellipse = useMemo<SceneEllipse>(
    () => ({
      id: "__tool_default_ellipse__",
      kind: "fociPoint",
      focusAId: "__tool_default_a__",
      focusBId: "__tool_default_b__",
      throughId: "__tool_default_c__",
      visible: true,
      showLabel: objectLabelDefaults.ellipse,
      labelGlow: objectLabelDefaults.ellipseGlow ?? true,
      style: ellipseDefaults,
    }),
    [ellipseDefaults, objectLabelDefaults.ellipse, objectLabelDefaults.ellipseGlow]
  );

  const polygon = useMemo<ScenePolygon>(
    () => ({
      id: "__tool_default_polygon__",
      pointIds: ["__tool_default_a__", "__tool_default_b__", "__tool_default_c__"],
      visible: true,
      showLabel: objectLabelDefaults.polygon,
      labelGlow: objectLabelDefaults.polygonGlow ?? true,
      style: polygonDefaults,
    }),
    [objectLabelDefaults.polygon, objectLabelDefaults.polygonGlow, polygonDefaults]
  );

  const angle = useMemo<SceneAngle>(
    () => ({
      id: "__tool_default_angle__",
      kind: "angle",
      aId: "__tool_default_a__",
      bId: "__tool_default_b__",
      cId: "__tool_default_c__",
      visible: true,
      style: angleDefaults,
    }),
    [angleDefaults]
  );

  const sector = useMemo<SceneAngle>(
    () => ({
      id: "__tool_default_sector__",
      kind: "sector",
      aId: "__tool_default_a__",
      bId: "__tool_default_b__",
      cId: "__tool_default_c__",
      visible: true,
      style: angleDefaults,
    }),
    [angleDefaults]
  );

  const textLabel = useMemo<NonNullable<SceneModel["textLabels"]>[number]>(
    () => ({
      id: "__tool_default_text_label__",
      name: "Text",
      text: "Text",
      toolKind: "label",
      contentMode: "static",
      visible: true,
      positionWorld: { x: 0, y: 0 },
      style: labelToolDefaults,
    }),
    [labelToolDefaults]
  );

  const richText = useMemo<NonNullable<SceneModel["richTextNodes"]>[number]>(
    () => ({
      id: "__tool_default_rich_text__",
      type: "richText",
      name: "Textbox",
      visible: true,
      positionWorld: { x: 0, y: 0 },
      style: richTextToolDefaults,
      document: {
        kind: "document",
        blocks: [
          {
            kind: "paragraph",
            textAlign: richTextToolDefaults.textAlign ?? "left",
            children: [{ kind: "text", text: "" }],
          },
        ],
      },
      boundsPx: { widthPx: 100, heightPx: 20 },
    }),
    [richTextToolDefaults]
  );

  if (kind === "point") {
    return (
      <PointPropertiesSection
        selectedPoint={point}
        selectedPointWorld={null}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        nameInput=""
        setNameInput={() => {}}
        renameError=""
        setRenameError={() => {}}
        applyRename={() => {}}
        shapePickerOpen={shapePickerOpen}
        setShapePickerOpen={setShapePickerOpen}
        shapePickerRef={shapePickerRef}
        updateSelectedPointFields={(fields) => {
          if (fields.showLabel !== undefined) setObjectLabelDefaults({ point: fields.showLabel });
        }}
        updateSelectedPointStyle={setPointDefaults}
        deleteSelectedObject={() => {}}
        mode="toolDefault"
      />
    );
  }

  if (kind === "segment") {
    return (
      <SegmentStyleSection
        selectedSegment={segment}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedSegmentStyle={setSegmentDefaults}
        updateSelectedSegmentFields={(fields) => {
          if (fields.showLabel !== undefined) setObjectLabelDefaults({ segment: Boolean(fields.showLabel) });
          if (fields.labelGlow !== undefined) setObjectLabelDefaults({ segmentGlow: fields.labelGlow });
        }}
        mode="toolDefault"
      />
    );
  }

  if (kind === "line") {
    return (
      <LineStyleSection
        selectedLine={line}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedLineStyle={setLineDefaults}
        updateSelectedLineFields={(fields) => {
          if (fields.showLabel !== undefined) setObjectLabelDefaults({ line: Boolean(fields.showLabel) });
          if (fields.labelGlow !== undefined) setObjectLabelDefaults({ lineGlow: fields.labelGlow });
        }}
        canConvertToSegment={false}
        convertSelectedLineToSegment={() => {}}
        mode="toolDefault"
      />
    );
  }

  if (kind === "circle") {
    return (
      <CircleStyleSection
        selectedCircle={circle}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedCircleStyle={setCircleDefaults}
        updateSelectedCircleFields={(fields) => {
          if (fields.showLabel !== undefined) setObjectLabelDefaults({ circle: Boolean(fields.showLabel) });
          if (fields.labelGlow !== undefined) setObjectLabelDefaults({ circleGlow: fields.labelGlow });
        }}
        mode="toolDefault"
      />
    );
  }

  if (kind === "ellipse") {
    return (
      <CircleStyleSection
        selectedCircle={ellipse}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedCircleStyle={setEllipseDefaults}
        updateSelectedCircleFields={(fields) => {
          if (fields.showLabel !== undefined) setObjectLabelDefaults({ ellipse: Boolean(fields.showLabel) });
          if (fields.labelGlow !== undefined) setObjectLabelDefaults({ ellipseGlow: fields.labelGlow });
        }}
        mode="toolDefault"
        title="Ellipse Style"
        showArrow={false}
      />
    );
  }

  if (kind === "polygon") {
    return (
      <PolygonStyleSection
        selectedPolygon={polygon}
        selectedPolygonOwnedEdgesVisible
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedPolygonStyle={setPolygonDefaults}
        updateSelectedPolygonFields={(fields) => {
          if (fields.showLabel !== undefined) setObjectLabelDefaults({ polygon: Boolean(fields.showLabel) });
          if (fields.labelGlow !== undefined) setObjectLabelDefaults({ polygonGlow: fields.labelGlow });
        }}
        setSelectedPolygonOwnedSegmentsVisible={() => {}}
        mode="toolDefault"
      />
    );
  }

  if (kind === "angle") {
    return (
      <AngleStyleSection
        selectedAngle={angle}
        selectedAngleRightStatus="none"
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedAngleStyle={setAngleDefaults}
        deleteSelectedObject={() => {}}
        mode="toolDefault"
      />
    );
  }

  if (kind === "sector") {
    return (
      <SectorStyleSection
        selectedSector={sector}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedAngleStyle={setAngleDefaults}
        deleteSelectedObject={() => {}}
        mode="toolDefault"
      />
    );
  }

  if (kind === "textLabel") {
    return (
      <TextLabelStyleSection
        selectedTextLabel={textLabel}
        scene={scene}
        selectedTextLabelBoundNumberValue={null}
        selectedTextLabelExprValue={null}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedTextLabelFields={() => {}}
        updateSelectedTextLabelStyle={setLabelToolDefaults}
        deleteSelectedObject={() => {}}
        mode="toolDefault"
      />
    );
  }

  if (kind === "richText") {
    return (
      <RichTextStyleSection
        selectedRichText={richText}
        selectedStyleAsDefault
        onMakeStyleDefaultChange={() => {}}
        updateSelectedRichTextFields={() => {}}
        updateSelectedRichTextStyle={setRichTextToolDefaults}
        updateSelectedRichTextDocument={() => {}}
        deleteSelectedObject={() => {}}
        mode="toolDefault"
      />
    );
  }

  return null;
}
