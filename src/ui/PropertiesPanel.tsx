import { useEffect, useMemo, useRef, useState } from "react";
import { resolveAngleRightStatus } from "../domain/rightAngleProvenance";
import { formatRoundedDisplay } from "./displayFormat";
import {
  computeOrientedAngleRad,
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getCircleWorldGeometry,
  getLineWorldAnchors,
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
  const setSelectedPolygonOwnedSegmentsVisible = useGeoStore((store) => store.setSelectedPolygonOwnedSegmentsVisible);
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
  const selectedPolygonOwnedEdgesVisible = useMemo(() => {
    if (!selectedPolygon) return true;
    const ownedSegments = scene.segments.filter(
      (segment) => Array.isArray(segment.ownedByPolygonIds) && segment.ownedByPolygonIds.includes(selectedPolygon.id)
    );
    if (ownedSegments.length === 0) return true;
    return ownedSegments.every((segment) => segment.visible);
  }, [scene.segments, selectedPolygon]);
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
  const selectedLineEquation = useMemo(() => {
    if (!selectedLine) return null;
    const anchors = getLineWorldAnchors(selectedLine, scene);
    if (!anchors) return null;
    return formatLineEquation(anchors.a, anchors.b);
  }, [scene, selectedLine]);
  const selectedCircleEquation = useMemo(() => {
    if (!selectedCircle) return null;
    const geometry = getCircleWorldGeometry(selectedCircle, scene);
    if (!geometry || !Number.isFinite(geometry.radius) || geometry.radius < 0) return null;
    return formatCircleEquation(geometry.center.x, geometry.center.y, geometry.radius);
  }, [scene, selectedCircle]);
  const selectedAngleDegrees = useMemo(() => {
    if (!selectedAngle) return null;
    const aPoint = scene.points.find((point) => point.id === selectedAngle.aId);
    const bPoint = scene.points.find((point) => point.id === selectedAngle.bId);
    const cPoint = scene.points.find((point) => point.id === selectedAngle.cId);
    if (!aPoint || !bPoint || !cPoint) return null;
    const a = getPointWorldPos(aPoint, scene);
    const b = getPointWorldPos(bPoint, scene);
    const c = getPointWorldPos(cPoint, scene);
    if (!a || !b || !c) return null;
    const theta = computeOrientedAngleRad(a, b, c);
    if (theta === null) return null;
    return formatRoundedDisplay((theta * 180) / Math.PI, 2);
  }, [scene, selectedAngle]);
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
  const handleMakeStyleDefaultChange = (checked: boolean) => {
    if (!checked || !selectedStyleKind) return;
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
  };

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
            ? pointLabel(pendingSelection.first.id, pointNameById)
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
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={handleMakeStyleDefaultChange}
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
      {selectedLine && (
        <div className="toolInfo">
          <div className="subSectionTitle">Line</div>
          <div className="detailRow">
            <span className="detailLabel">Equation</span>
            <span>{selectedLineEquation ?? "undefined"}</span>
          </div>
        </div>
      )}
      {selectedCircle && (
        <div className="toolInfo">
          <div className="subSectionTitle">Circle</div>
          <div className="detailRow">
            <span className="detailLabel">Equation</span>
            <span>{selectedCircleEquation ?? "undefined"}</span>
          </div>
        </div>
      )}
      {selectedAngle && (
        <div className="toolInfo">
          <div className="subSectionTitle">Angle</div>
          <div className="detailRow">
            <span className="detailLabel">Value</span>
            <span>{selectedAngleDegrees === null ? "undefined" : `${selectedAngleDegrees}°`}</span>
          </div>
        </div>
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
      {!selectedPoint && selectedStyleKind && (
        <div className="cosmeticsBlock">
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedStyleAsDefault}
              onChange={(e) => handleMakeStyleDefaultChange(e.target.checked)}
            />
            Make this default for this object
          </label>
        </div>
      )}
      <ObjectStyleSections
        selectedPointPresent={Boolean(selectedPoint)}
        selectedSegment={selectedSegment}
        selectedLine={selectedLine}
        selectedCircle={selectedCircle}
        selectedPolygon={selectedPolygon}
        selectedPolygonOwnedEdgesVisible={selectedPolygonOwnedEdgesVisible}
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
        setSelectedPolygonOwnedSegmentsVisible={setSelectedPolygonOwnedSegmentsVisible}
        deleteSelectedObject={deleteSelectedObject}
      />
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

function pointLabel(pointId: string, pointNameById: Map<string, string>): string {
  return pointNameById.get(pointId) ?? pointId;
}

function formatLineEquation(ax: { x: number; y: number }, bx: { x: number; y: number }): string {
  const aCoeffRaw = bx.y - ax.y;
  const bCoeffRaw = ax.x - bx.x;
  const cCoeffRaw = aCoeffRaw * ax.x + bCoeffRaw * ax.y;
  let aCoeff = snapNearZero(aCoeffRaw);
  let bCoeff = snapNearZero(bCoeffRaw);
  let cCoeff = snapNearZero(cCoeffRaw);
  if (Math.abs(aCoeff) <= 1e-12 && Math.abs(bCoeff) <= 1e-12) return "undefined";
  if (aCoeff < -1e-12 || (Math.abs(aCoeff) <= 1e-12 && bCoeff < -1e-12)) {
    aCoeff = -aCoeff;
    bCoeff = -bCoeff;
    cCoeff = -cCoeff;
  }
  const parts: string[] = [];
  appendSignedTerm(parts, aCoeff, "x");
  appendSignedTerm(parts, bCoeff, "y");
  appendSignedTerm(parts, -cCoeff, "");
  const lhs = parts.length > 0 ? parts.join("") : "0";
  return `${lhs}=0`;
}

function formatCircleEquation(cx: number, cy: number, r: number): string {
  const xTerm = formatShiftTerm("x", cx);
  const yTerm = formatShiftTerm("y", cy);
  const radiusText = formatRoundedDisplay(Math.abs(snapNearZero(r)), 2);
  return `(${xTerm})^2+(${yTerm})^2=${radiusText}^2`;
}

function formatShiftTerm(variable: "x" | "y", center: number): string {
  const snapped = snapNearZero(center);
  if (Math.abs(snapped) <= 1e-12) return variable;
  const mag = formatRoundedDisplay(Math.abs(snapped), 2);
  return snapped >= 0 ? `${variable}-${mag}` : `${variable}+${mag}`;
}

function appendSignedTerm(parts: string[], coeff: number, symbol: string): void {
  const snapped = snapNearZero(coeff);
  if (Math.abs(snapped) <= 1e-12) return;
  const sign = snapped < 0 ? "-" : "+";
  const magnitude = formatRoundedDisplay(Math.abs(snapped), 2);
  const body = `${magnitude}${symbol}`;
  if (parts.length === 0) {
    parts.push(snapped < 0 ? `-${body}` : body);
    return;
  }
  parts.push(`${sign}${body}`);
}

function snapNearZero(value: number): number {
  return Math.abs(value) <= 1e-12 ? 0 : value;
}
