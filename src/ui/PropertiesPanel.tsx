import { useEffect, useMemo, useRef, useState } from "react";
import { resolveAngleRightStatus } from "../domain/rightAngleProvenance";
import {
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getNumberValue,
  getPointWorldPos,
} from "../scene/points";
import { selectConstructionDescription } from "../state/selectors/constructionDescription";
import { useGeoStore } from "../state/geoStore";
import { NumberStyleSection } from "./object-styles/NumberStyleSection";
import { TextLabelStyleSection } from "./object-styles/TextLabelStyleSection";
import { NumbersSection } from "./NumbersSection";
import { ObjectStyleSections } from "./ObjectStyleSections";
import { PointPropertiesSection } from "./PointPropertiesSection";
import { ToolInfoSection } from "./ToolInfoSection";
import {
  angleStyleEqual,
  circleStyleEqual,
  lineStyleEqual,
  pointStyleEqual,
  polygonStyleEqual,
} from "./object-styles/styleComparisons";

export function PropertiesPanel({ visible }: { visible: boolean }) {
  const activeTool = useGeoStore((store) => store.activeTool);
  const scene = useGeoStore((store) => store.scene);
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const renameSelectedPoint = useGeoStore((store) => store.renameSelectedPoint);
  const deleteSelectedObject = useGeoStore((store) => store.deleteSelectedObject);
  const copyStyle = useGeoStore((store) => store.copyStyle);
  const pointDefaults = useGeoStore((store) => store.pointDefaults);
  const segmentDefaults = useGeoStore((store) => store.segmentDefaults);
  const lineDefaults = useGeoStore((store) => store.lineDefaults);
  const circleDefaults = useGeoStore((store) => store.circleDefaults);
  const polygonDefaults = useGeoStore((store) => store.polygonDefaults);
  const angleDefaults = useGeoStore((store) => store.angleDefaults);
  const angleFixedTool = useGeoStore((store) => store.angleFixedTool);
  const circleFixedTool = useGeoStore((store) => store.circleFixedTool);
  const regularPolygonTool = useGeoStore((store) => store.regularPolygonTool);
  const transformTool = useGeoStore((store) => store.transformTool);
  const pendingSelection = useGeoStore((store) => store.pendingSelection);
  const setPointDefaults = useGeoStore((store) => store.setPointDefaults);
  const setSegmentDefaults = useGeoStore((store) => store.setSegmentDefaults);
  const setLineDefaults = useGeoStore((store) => store.setLineDefaults);
  const setCircleDefaults = useGeoStore((store) => store.setCircleDefaults);
  const setPolygonDefaults = useGeoStore((store) => store.setPolygonDefaults);
  const setAngleDefaults = useGeoStore((store) => store.setAngleDefaults);
  const setAngleFixedTool = useGeoStore((store) => store.setAngleFixedTool);
  const setCircleFixedTool = useGeoStore((store) => store.setCircleFixedTool);
  const setRegularPolygonTool = useGeoStore((store) => store.setRegularPolygonTool);
  const setTransformTool = useGeoStore((store) => store.setTransformTool);
  const createCircleFixedRadius = useGeoStore((store) => store.createCircleFixedRadius);
  const clearPendingSelection = useGeoStore((store) => store.clearPendingSelection);
  const updateSelectedPointStyle = useGeoStore((store) => store.updateSelectedPointStyle);
  const updateSelectedPointFields = useGeoStore((store) => store.updateSelectedPointFields);
  const updateSelectedSegmentStyle = useGeoStore((store) => store.updateSelectedSegmentStyle);
  const updateSelectedLineStyle = useGeoStore((store) => store.updateSelectedLineStyle);
  const updateSelectedCircleStyle = useGeoStore((store) => store.updateSelectedCircleStyle);
  const updateSelectedPolygonStyle = useGeoStore((store) => store.updateSelectedPolygonStyle);
  const updateSelectedAngleStyle = useGeoStore((store) => store.updateSelectedAngleStyle);
  const updateSelectedSegmentFields = useGeoStore((store) => store.updateSelectedSegmentFields);
  const updateSelectedLineFields = useGeoStore((store) => store.updateSelectedLineFields);
  const updateSelectedCircleFields = useGeoStore((store) => store.updateSelectedCircleFields);
  const updateSelectedPolygonFields = useGeoStore((store) => store.updateSelectedPolygonFields);
  const updateSelectedNumberDefinition = useGeoStore((store) => store.updateSelectedNumberDefinition);
  const updateSelectedTextLabelFields = useGeoStore((store) => store.updateSelectedTextLabelFields);
  const updateSelectedTextLabelStyle = useGeoStore((store) => store.updateSelectedTextLabelStyle);
  const createNumber = useGeoStore((store) => store.createNumber);

  const selectedPoint = useMemo(
    () => (selectedObject?.type === "point" ? scene.points.find((point) => point.id === selectedObject.id) ?? null : null),
    [scene.points, selectedObject]
  );
  const selectedSegment = useMemo(
    () => (selectedObject?.type === "segment" ? scene.segments.find((item) => item.id === selectedObject.id) ?? null : null),
    [scene.segments, selectedObject]
  );
  const selectedLine = useMemo(
    () => (selectedObject?.type === "line" ? scene.lines.find((item) => item.id === selectedObject.id) ?? null : null),
    [scene.lines, selectedObject]
  );
  const selectedCircle = useMemo(
    () => (selectedObject?.type === "circle" ? scene.circles.find((item) => item.id === selectedObject.id) ?? null : null),
    [scene.circles, selectedObject]
  );
  const selectedPolygon = useMemo(
    () => (selectedObject?.type === "polygon" ? scene.polygons.find((item) => item.id === selectedObject.id) ?? null : null),
    [scene.polygons, selectedObject]
  );
  const selectedAngle = useMemo(
    () => (selectedObject?.type === "angle" ? scene.angles.find((item) => item.id === selectedObject.id) ?? null : null),
    [scene.angles, selectedObject]
  );
  const selectedNumber = useMemo(
    () => (selectedObject?.type === "number" ? scene.numbers.find((item) => item.id === selectedObject.id) ?? null : null),
    [scene.numbers, selectedObject]
  );
  const selectedTextLabel = useMemo(
    () => (selectedObject?.type === "textLabel" ? (scene.textLabels ?? []).find((item) => item.id === selectedObject.id) ?? null : null),
    [scene.textLabels, selectedObject]
  );
  const selectedPointWorld = useMemo(() => {
    if (!selectedPoint) return null;
    return getPointWorldPos(selectedPoint, scene);
  }, [scene, selectedPoint]);
  const selectedNumberValue = useMemo(() => {
    if (!selectedNumber) return null;
    return getNumberValue(selectedNumber.id, scene);
  }, [scene, selectedNumber]);
  const selectedTextLabelBoundNumberValue = useMemo(() => {
    if (!selectedTextLabel || selectedTextLabel.contentMode !== "number" || !selectedTextLabel.numberId) return null;
    return getNumberValue(selectedTextLabel.numberId, scene);
  }, [scene, selectedTextLabel]);
  const selectedTextLabelExprValue = useMemo(() => {
    if (!selectedTextLabel || selectedTextLabel.contentMode !== "expression") return null;
    const expr = selectedTextLabel.expr?.trim() ?? "";
    if (!expr) return null;
    const out = evaluateNumberExpression(scene, expr);
    return out.ok ? out.value : null;
  }, [scene, selectedTextLabel]);
  const pointNameById = useMemo(() => new Map(scene.points.map((p) => [p.id, p.name])), [scene.points]);
  const selectedConstructionText = useMemo(
    () => selectConstructionDescription(selectedObject, scene),
    [scene, selectedObject]
  );
  const angleFixedPreview = useMemo(
    () => evaluateAngleExpressionDegrees(scene, angleFixedTool.angleExpr),
    [scene, angleFixedTool.angleExpr]
  );
  const circleFixedPreview = useMemo(
    () => evaluateNumberExpression(scene, circleFixedTool.radius),
    [scene, circleFixedTool.radius]
  );
  const transformFactorPreview = useMemo(
    () => evaluateNumberExpression(scene, transformTool.factorExpr),
    [scene, transformTool.factorExpr]
  );
  const transformAnglePreview = useMemo(
    () => evaluateAngleExpressionDegrees(scene, transformTool.angleExpr),
    [scene, transformTool.angleExpr]
  );
  const selectedStyleKind = useMemo<"point" | "segment" | "line" | "circle" | "polygon" | "angle" | null>(() => {
    if (selectedPoint) return "point";
    if (selectedSegment) return "segment";
    if (selectedLine) return "line";
    if (selectedCircle) return "circle";
    if (selectedPolygon) return "polygon";
    if (selectedAngle) return "angle";
    return null;
  }, [selectedAngle, selectedCircle, selectedLine, selectedPoint, selectedPolygon, selectedSegment]);
  const selectedAngleRightStatus = useMemo<"none" | "approx" | "exact">(
    () => (selectedAngle ? resolveAngleRightStatus(scene, selectedAngle) : "none"),
    [scene, selectedAngle]
  );
  const selectedStyleAsDefault = useMemo(() => {
    if (selectedPoint) return pointStyleEqual(pointDefaults, selectedPoint.style);
    if (selectedSegment) return lineStyleEqual(segmentDefaults, selectedSegment.style);
    if (selectedLine) return lineStyleEqual(lineDefaults, selectedLine.style);
    if (selectedCircle) return circleStyleEqual(circleDefaults, selectedCircle.style);
    if (selectedPolygon) return polygonStyleEqual(polygonDefaults, selectedPolygon.style);
    if (selectedAngle) return angleStyleEqual(angleDefaults, selectedAngle.style);
    return false;
  }, [
    angleDefaults,
    circleDefaults,
    lineDefaults,
    pointDefaults,
    polygonDefaults,
    segmentDefaults,
    selectedAngle,
    selectedCircle,
    selectedLine,
    selectedPoint,
    selectedPolygon,
    selectedSegment,
  ]);

  const [nameInput, setNameInput] = useState("");
  const [renameError, setRenameError] = useState("");
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [newNumberValue, setNewNumberValue] = useState("1");
  const [newSliderMin, setNewSliderMin] = useState("0");
  const [newSliderMax, setNewSliderMax] = useState("10");
  const [newSliderStep, setNewSliderStep] = useState("0.1");
  const [newSliderMode, setNewSliderMode] = useState<"real" | "degree">("real");
  const shapePickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNameInput(selectedPoint?.name ?? "");
    setRenameError("");
    setShapePickerOpen(false);
  }, [selectedPoint]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!shapePickerRef.current) return;
      if (!shapePickerRef.current.contains(e.target as Node)) {
        setShapePickerOpen(false);
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  const applyRename = () => {
    const result = renameSelectedPoint(nameInput);
    if (!result.ok) {
      setRenameError(result.error);
      return;
    }
    setNameInput(result.name);
    setRenameError("");
  };

  if (!visible) return null;

  return (
    <section className="sidebarSection">
      <h2 className="sectionTitle">Properties</h2>
      {selectedConstructionText && (
        <div className="constructionInfo">
          <div className="constructionTitle">Construction</div>
          <div>{selectedConstructionText}</div>
        </div>
      )}
      <ToolInfoSection
        activeTool={activeTool}
        copyStyleHasSource={Boolean(copyStyle.source)}
        angleFixedExpr={angleFixedTool.angleExpr}
        angleFixedDirection={angleFixedTool.direction}
        setAngleFixedTool={setAngleFixedTool}
        angleFixedPreview={angleFixedPreview}
        circleFixedRadius={circleFixedTool.radius}
        setCircleFixedTool={setCircleFixedTool}
        circleFixedPreview={circleFixedPreview}
        regularPolygonSides={regularPolygonTool.sides}
        regularPolygonDirection={regularPolygonTool.direction}
        setRegularPolygonTool={setRegularPolygonTool}
        transformFactorExpr={transformTool.factorExpr}
        transformAngleExpr={transformTool.angleExpr}
        transformDirection={transformTool.direction}
        setTransformTool={setTransformTool}
        transformFactorPreview={transformFactorPreview}
        transformAnglePreview={transformAnglePreview}
        pendingSelection={pendingSelection}
        pendingCircleFixedCenterLabel={
          pendingSelection && pendingSelection.tool === "circle_fixed"
            ? (pointNameById.get(pendingSelection.first.id) ?? pendingSelection.first.id)
            : null
        }
        createCircleFixedRadius={createCircleFixedRadius}
        clearPendingSelection={clearPendingSelection}
      />
      {selectedNumber && (
        <NumberStyleSection
          selectedNumber={selectedNumber}
          selectedNumberValue={selectedNumberValue}
          updateSelectedNumberDefinition={updateSelectedNumberDefinition}
          deleteSelectedObject={deleteSelectedObject}
        />
      )}
      {!selectedPoint && !selectedSegment && !selectedLine && !selectedCircle && !selectedPolygon && !selectedAngle && !selectedTextLabel && !selectedNumber && (
        <div className="emptyState">Select an object to edit properties</div>
      )}
      {selectedPoint && (
        <PointPropertiesSection
          selectedPoint={selectedPoint}
          selectedPointWorld={selectedPointWorld}
          nameInput={nameInput}
          setNameInput={setNameInput}
          renameError={renameError}
          setRenameError={setRenameError}
          applyRename={applyRename}
          shapePickerOpen={shapePickerOpen}
          setShapePickerOpen={setShapePickerOpen}
          shapePickerRef={shapePickerRef}
          updateSelectedPointFields={updateSelectedPointFields}
          updateSelectedPointStyle={updateSelectedPointStyle}
          deleteSelectedObject={deleteSelectedObject}
        />
      )}
      {selectedTextLabel && (
        <TextLabelStyleSection
          selectedTextLabel={selectedTextLabel}
          scene={scene}
          selectedTextLabelBoundNumberValue={selectedTextLabelBoundNumberValue}
          selectedTextLabelExprValue={selectedTextLabelExprValue}
          updateSelectedTextLabelFields={updateSelectedTextLabelFields}
          updateSelectedTextLabelStyle={updateSelectedTextLabelStyle}
          deleteSelectedObject={deleteSelectedObject}
        />
      )}
      <ObjectStyleSections
        selectedPointPresent={Boolean(selectedPoint)}
        selectedSegment={selectedSegment}
        selectedLine={selectedLine}
        selectedCircle={selectedCircle}
        selectedPolygon={selectedPolygon}
        selectedAngle={selectedAngle}
        selectedAngleRightStatus={selectedAngleRightStatus}
        updateSelectedSegmentStyle={updateSelectedSegmentStyle}
        updateSelectedLineStyle={updateSelectedLineStyle}
        updateSelectedCircleStyle={updateSelectedCircleStyle}
        updateSelectedPolygonStyle={updateSelectedPolygonStyle}
        updateSelectedAngleStyle={updateSelectedAngleStyle}
        updateSelectedSegmentFields={updateSelectedSegmentFields}
        updateSelectedLineFields={updateSelectedLineFields}
        updateSelectedCircleFields={updateSelectedCircleFields}
        updateSelectedPolygonFields={updateSelectedPolygonFields}
        deleteSelectedObject={deleteSelectedObject}
      />

      <div className="cosmeticsBlock">
        <label className="checkboxRow">
          <input
            type="checkbox"
            checked={selectedStyleAsDefault}
            disabled={!selectedStyleKind}
            onChange={(e) => {
              if (!e.target.checked || !selectedStyleKind) return;
              if (selectedStyleKind === "point" && selectedPoint) {
                setPointDefaults({
                  ...selectedPoint.style,
                  labelOffsetPx: { ...selectedPoint.style.labelOffsetPx },
                });
                return;
              }
              if (selectedStyleKind === "segment" && selectedSegment) {
                setSegmentDefaults({ ...selectedSegment.style });
                return;
              }
              if (selectedStyleKind === "line" && selectedLine) {
                setLineDefaults({ ...selectedLine.style });
                return;
              }
              if (selectedStyleKind === "circle" && selectedCircle) {
                setCircleDefaults({ ...selectedCircle.style });
                return;
              }
              if (selectedStyleKind === "polygon" && selectedPolygon) {
                setPolygonDefaults({ ...selectedPolygon.style });
                return;
              }
              if (selectedStyleKind === "angle" && selectedAngle) {
                setAngleDefaults({
                  ...selectedAngle.style,
                  labelPosWorld: { ...angleDefaults.labelPosWorld },
                });
              }
            }}
          />
          Make this default for this object
        </label>
      </div>

      <NumbersSection
        newNumberValue={newNumberValue}
        setNewNumberValue={setNewNumberValue}
        newSliderMin={newSliderMin}
        setNewSliderMin={setNewSliderMin}
        newSliderMax={newSliderMax}
        setNewSliderMax={setNewSliderMax}
        newSliderStep={newSliderStep}
        setNewSliderStep={setNewSliderStep}
        newSliderMode={newSliderMode}
        setNewSliderMode={(next) => {
          setNewSliderMode(next);
          if (next === "degree") {
            setNewSliderMin("0");
            setNewSliderMax("360");
            setNewSliderStep("1");
            setNewNumberValue("0");
          } else {
            setNewSliderMin("0");
            setNewSliderMax("10");
            setNewSliderStep("0.1");
            setNewNumberValue("1");
          }
        }}
        selectedSegmentId={selectedSegment?.id ?? null}
        selectedCircleId={selectedCircle?.id ?? null}
        selectedAngleId={selectedAngle?.id ?? null}
        createNumber={createNumber}
      />
    </section>
  );
}
