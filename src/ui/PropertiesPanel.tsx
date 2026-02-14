import { useEffect, useMemo, useRef, useState } from "react";
import { resolveAngleRightStatus } from "../domain/rightAngleProvenance";
import {
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getNumberValue,
  getPointWorldPos,
  type PointStyle,
  type SceneModel,
} from "../scene/points";
import { selectConstructionDescription } from "../state/selectors/constructionDescription";
import { useGeoStore } from "../state/geoStore";
import { NumbersSection } from "./NumbersSection";
import { ObjectStyleSections } from "./ObjectStyleSections";
import { PointPropertiesSection } from "./PointPropertiesSection";
import { ToolInfoSection } from "./ToolInfoSection";


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
  const pendingSelection = useGeoStore((store) => store.pendingSelection);
  const setPointDefaults = useGeoStore((store) => store.setPointDefaults);
  const setSegmentDefaults = useGeoStore((store) => store.setSegmentDefaults);
  const setLineDefaults = useGeoStore((store) => store.setLineDefaults);
  const setCircleDefaults = useGeoStore((store) => store.setCircleDefaults);
  const setPolygonDefaults = useGeoStore((store) => store.setPolygonDefaults);
  const setAngleDefaults = useGeoStore((store) => store.setAngleDefaults);
  const setAngleFixedTool = useGeoStore((store) => store.setAngleFixedTool);
  const setCircleFixedTool = useGeoStore((store) => store.setCircleFixedTool);
  const createCircleFixedRadius = useGeoStore((store) => store.createCircleFixedRadius);
  const clearPendingSelection = useGeoStore((store) => store.clearPendingSelection);
  const updateSelectedPointStyle = useGeoStore((store) => store.updateSelectedPointStyle);
  const updateSelectedPointFields = useGeoStore((store) => store.updateSelectedPointFields);
  const updateSelectedSegmentStyle = useGeoStore((store) => store.updateSelectedSegmentStyle);
  const updateSelectedLineStyle = useGeoStore((store) => store.updateSelectedLineStyle);
  const updateSelectedCircleStyle = useGeoStore((store) => store.updateSelectedCircleStyle);
  const updateSelectedPolygonStyle = useGeoStore((store) => store.updateSelectedPolygonStyle);
  const updateSelectedAngleStyle = useGeoStore((store) => store.updateSelectedAngleStyle);
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
  const selectedPointWorld = useMemo(() => {
    if (!selectedPoint) return null;
    return getPointWorldPos(selectedPoint, scene);
  }, [scene, selectedPoint]);
  const selectedNumberValue = useMemo(() => {
    if (!selectedNumber) return null;
    return getNumberValue(selectedNumber.id, scene);
  }, [scene, selectedNumber]);
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
  const [newNumberExpr, setNewNumberExpr] = useState("n_1+n_2^2");
  const [ratioNumeratorId, setRatioNumeratorId] = useState("");
  const [ratioDenominatorId, setRatioDenominatorId] = useState("");
  const shapePickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNameInput(selectedPoint?.name ?? "");
    setRenameError("");
    setShapePickerOpen(false);
  }, [selectedPoint]);

  useEffect(() => {
    if (scene.numbers.length === 0) {
      setRatioNumeratorId("");
      setRatioDenominatorId("");
      return;
    }
    if (!scene.numbers.some((n) => n.id === ratioNumeratorId)) {
      setRatioNumeratorId(scene.numbers[0].id);
    }
    if (!scene.numbers.some((n) => n.id === ratioDenominatorId)) {
      setRatioDenominatorId(scene.numbers[Math.min(1, scene.numbers.length - 1)].id);
    }
  }, [scene.numbers, ratioNumeratorId, ratioDenominatorId]);

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
  pendingSelection={pendingSelection}
  pendingCircleFixedCenterLabel={
    pendingSelection && pendingSelection.tool === "circle_fixed"
      ? pointLabel(pendingSelection.first.id, pointNameById)
      : null
  }
  createCircleFixedRadius={createCircleFixedRadius}
  clearPendingSelection={clearPendingSelection}
/>
{selectedNumber && (
  <div className="toolInfo">
    <div className="subSectionTitle">Number</div>
    <div className="statusText">
      {selectedNumber.name} = {selectedNumberValue === null ? "undefined" : selectedNumberValue.toFixed(6)}
    </div>
    <button className="deleteButton" onClick={deleteSelectedObject}>
      Delete
    </button>
  </div>
)}
{!selectedPoint && !selectedSegment && !selectedLine && !selectedCircle && !selectedPolygon && !selectedAngle && !selectedNumber && (
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
  newNumberExpr={newNumberExpr}
  setNewNumberExpr={setNewNumberExpr}
  ratioNumeratorId={ratioNumeratorId}
  setRatioNumeratorId={setRatioNumeratorId}
  ratioDenominatorId={ratioDenominatorId}
  setRatioDenominatorId={setRatioDenominatorId}
  numbers={scene.numbers}
  selectedSegmentId={selectedSegment?.id ?? null}
  selectedCircleId={selectedCircle?.id ?? null}
  selectedAngleId={selectedAngle?.id ?? null}
  createNumber={createNumber}
/>
    </section>
  );
}

function pointLabel(pointId: string, pointNameById: Map<string, string>): string {
  return pointNameById.get(pointId) ?? pointId;
}

function pointStyleEqual(a: PointStyle, b: PointStyle): boolean {
  return (
    a.shape === b.shape &&
    a.sizePx === b.sizePx &&
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    a.strokeOpacity === b.strokeOpacity &&
    a.fillColor === b.fillColor &&
    a.fillOpacity === b.fillOpacity &&
    a.labelFontPx === b.labelFontPx &&
    a.labelHaloWidthPx === b.labelHaloWidthPx &&
    a.labelHaloColor === b.labelHaloColor &&
    a.labelColor === b.labelColor &&
    a.labelOffsetPx.x === b.labelOffsetPx.x &&
    a.labelOffsetPx.y === b.labelOffsetPx.y
  );
}

function lineStyleEqual(a: SceneModel["segments"][number]["style"], b: SceneModel["segments"][number]["style"]): boolean {
  return (
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    a.dash === b.dash &&
    a.opacity === b.opacity &&
    JSON.stringify(a.segmentMark ?? null) === JSON.stringify(b.segmentMark ?? null) &&
    JSON.stringify(a.segmentArrowMark ?? null) === JSON.stringify(b.segmentArrowMark ?? null)
  );
}

function circleStyleEqual(a: SceneModel["circles"][number]["style"], b: SceneModel["circles"][number]["style"]): boolean {
  return (
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    a.strokeDash === b.strokeDash &&
    a.strokeOpacity === b.strokeOpacity &&
    (a.fillColor ?? "") === (b.fillColor ?? "") &&
    (a.fillOpacity ?? 0) === (b.fillOpacity ?? 0) &&
    (a.pattern ?? "") === (b.pattern ?? "") &&
    (a.patternColor ?? "") === (b.patternColor ?? "")
  );
}

function polygonStyleEqual(a: SceneModel["polygons"][number]["style"], b: SceneModel["polygons"][number]["style"]): boolean {
  return (
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    a.strokeDash === b.strokeDash &&
    a.strokeOpacity === b.strokeOpacity &&
    (a.fillColor ?? "") === (b.fillColor ?? "") &&
    (a.fillOpacity ?? 0) === (b.fillOpacity ?? 0) &&
    (a.pattern ?? "") === (b.pattern ?? "") &&
    (a.patternColor ?? "") === (b.patternColor ?? "")
  );
}

function angleStyleEqual(a: SceneModel["angles"][number]["style"], b: SceneModel["angles"][number]["style"]): boolean {
  return (
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    a.strokeOpacity === b.strokeOpacity &&
    a.textColor === b.textColor &&
    a.textSize === b.textSize &&
    a.fillEnabled === b.fillEnabled &&
    a.fillColor === b.fillColor &&
    a.fillOpacity === b.fillOpacity &&
    a.markStyle === b.markStyle &&
    a.markSymbol === b.markSymbol &&
    a.arcMultiplicity === b.arcMultiplicity &&
    a.markPos === b.markPos &&
    a.markSize === b.markSize &&
    a.markColor === b.markColor &&
    a.arcRadius === b.arcRadius &&
    a.labelText === b.labelText &&
    a.showLabel === b.showLabel &&
    a.showValue === b.showValue &&
    Boolean(a.promoteToSolid) === Boolean(b.promoteToSolid)
  );
}
