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
import { formatRoundedDisplay } from "./displayFormat";


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
      {selectedNumber.name} = {selectedNumberValue === null ? "undefined" : formatRoundedDisplay(selectedNumberValue, 6)}
    </div>
    {selectedNumber.definition.kind === "slider" && (() => {
      const def = selectedNumber.definition;
      const lo = Math.min(def.min, def.max);
      const hi = Math.max(def.min, def.max);
      const safeStep = Number.isFinite(def.step) && def.step > 0 ? def.step : 0.1;
      const safeValue = Math.min(hi, Math.max(lo, def.value));
      const updateSlider = (patch: Partial<typeof def>) => {
        const merged = { ...def, ...patch };
        const nextLo = Math.min(merged.min, merged.max);
        const nextHi = Math.max(merged.min, merged.max);
        const nextStep = Number.isFinite(merged.step) && merged.step > 0 ? merged.step : safeStep;
        const nextValue = Math.min(nextHi, Math.max(nextLo, merged.value));
        updateSelectedNumberDefinition({
          ...merged,
          min: nextLo,
          max: nextHi,
          step: nextStep,
          value: nextValue,
        });
      };
      return (
        <>
          <div className="controlRow">
            <label className="controlLabel">Slider Type</label>
            <select
              className="selectInput"
              value={def.sliderMode === "radian" ? "degree" : (def.sliderMode ?? "real")}
              onChange={(e) => updateSlider({ sliderMode: e.target.value === "degree" ? "degree" : "real" })}
            >
              <option value="real">Real</option>
              <option value="degree">Degree</option>
            </select>
          </div>
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Value</label>
            <input
              className="sizeSlider"
              type="range"
              min={lo}
              max={hi}
              step={safeStep}
              value={safeValue}
              onChange={(e) => updateSlider({ value: Number(e.target.value) })}
            />
            <input
              className="scaleInputCompact"
              type="number"
              step="any"
              value={safeValue}
              onChange={(e) => updateSlider({ value: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow controlRowWithNumeric">
            <label className="controlLabel">Min</label>
            <input
              className="scaleInputCompact"
              type="number"
              step="any"
              value={def.min}
              onChange={(e) => updateSlider({ min: Number(e.target.value) })}
            />
            <label className="controlLabel">Max</label>
            <input
              className="scaleInputCompact"
              type="number"
              step="any"
              value={def.max}
              onChange={(e) => updateSlider({ max: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Step</label>
            <input
              className="scaleInputCompact"
              type="number"
              min={Number.EPSILON}
              step="any"
              value={safeStep}
              onChange={(e) => updateSlider({ step: Number(e.target.value) })}
            />
          </div>
        </>
      );
    })()}
    <button className="deleteButton" onClick={deleteSelectedObject}>
      Delete
    </button>
  </div>
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
  <div className="toolInfo">
    <div className="subSectionTitle">Text Label</div>
    <div className="statusText">
      Position: ({formatRoundedDisplay(selectedTextLabel.positionWorld.x, 3)}, {formatRoundedDisplay(selectedTextLabel.positionWorld.y, 3)})
    </div>

    <div className="fieldBlock">
      <label className="fieldLabel">Name</label>
      <input
        className="renameInput"
        value={selectedTextLabel.name}
        onChange={(e) => updateSelectedTextLabelFields({ name: e.target.value })}
      />
    </div>

    <div className="fieldBlock">
      <label className="fieldLabel">Text</label>
      <textarea
        className="renameInput"
        value={selectedTextLabel.text}
        rows={3}
        disabled={selectedTextLabel.contentMode === "number" || selectedTextLabel.contentMode === "expression"}
        onChange={(e) => updateSelectedTextLabelFields({ text: e.target.value })}
      />
    </div>

    <div className="controlRow">
      <label className="controlLabel">Content</label>
      <select
        className="selectInput"
        value={
          selectedTextLabel.contentMode === "number"
            ? "number"
            : selectedTextLabel.contentMode === "expression"
              ? "expression"
              : "static"
        }
        onChange={(e) => {
          const nextMode = e.target.value === "number" ? "number" : e.target.value === "expression" ? "expression" : "static";
          const firstNumberId = scene.numbers[0]?.id;
          updateSelectedTextLabelFields({
            contentMode: nextMode,
            ...(nextMode === "number" && !selectedTextLabel.numberId && firstNumberId ? { numberId: firstNumberId } : {}),
            ...(nextMode !== "number" ? { numberId: undefined } : {}),
            ...(nextMode !== "expression" ? { expr: undefined } : {}),
          });
        }}
      >
        <option value="static">Static Text</option>
        <option value="number">Dynamic Number</option>
        <option value="expression">Dynamic Expression</option>
      </select>
    </div>

    {selectedTextLabel.contentMode === "number" && (
      <>
        <div className="controlRow">
          <label className="controlLabel">Number</label>
          <select
            className="selectInput"
            value={selectedTextLabel.numberId ?? ""}
            onChange={(e) => updateSelectedTextLabelFields({ numberId: e.target.value || undefined })}
            disabled={scene.numbers.length === 0}
          >
            {scene.numbers.length === 0 ? (
              <option value="">No numbers</option>
            ) : (
              scene.numbers.map((num) => (
                <option key={num.id} value={num.id}>
                  {num.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="statusText">
          Value: {selectedTextLabelBoundNumberValue === null ? "undefined" : formatRoundedDisplay(selectedTextLabelBoundNumberValue, 6)}
        </div>
      </>
    )}

    {selectedTextLabel.contentMode === "expression" && (
      <>
        <div className="fieldBlock">
          <label className="fieldLabel">Expression</label>
          <input
            className="renameInput"
            value={selectedTextLabel.expr ?? ""}
            onChange={(e) => updateSelectedTextLabelFields({ expr: e.target.value })}
            placeholder="e.g. Distance(A,B)^2"
          />
        </div>
        <div className="statusText">
          Value: {selectedTextLabelExprValue === null ? "undefined" : formatRoundedDisplay(selectedTextLabelExprValue, 6)}
        </div>
      </>
    )}

    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedTextLabel.style.useTex}
        onChange={(e) => updateSelectedTextLabelStyle({ useTex: e.target.checked })}
      />
      Render as TeX
    </label>

    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedTextLabel.visible}
        onChange={(e) => updateSelectedTextLabelFields({ visible: e.target.checked })}
      />
      Visible
    </label>

    <div className="controlRow">
      <label className="controlLabel">Text Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedTextLabel.style.textColor}
        onChange={(e) => updateSelectedTextLabelStyle({ textColor: e.target.value })}
      />
    </div>

    <div className="controlRow controlRowWithNumeric">
      <label className="controlLabel">Text Size</label>
      <input
        className="sizeSlider"
        type="range"
        min={8}
        max={96}
        step={1}
        value={selectedTextLabel.style.textSize}
        onChange={(e) => updateSelectedTextLabelStyle({ textSize: Number(e.target.value) })}
      />
      <input
        className="scaleInputCompact"
        type="number"
        min={8}
        max={96}
        step={1}
        value={selectedTextLabel.style.textSize}
        onChange={(e) => updateSelectedTextLabelStyle({ textSize: Number(e.target.value) })}
      />
    </div>

    <div className="controlRow controlRowWithNumeric">
      <label className="controlLabel">Rotation</label>
      <input
        className="sizeSlider"
        type="range"
        min={-180}
        max={180}
        step={1}
        value={selectedTextLabel.style.rotationDeg ?? 0}
        onChange={(e) => updateSelectedTextLabelStyle({ rotationDeg: Number(e.target.value) })}
      />
      <input
        className="scaleInputCompact"
        type="number"
        min={-360}
        max={360}
        step={1}
        value={selectedTextLabel.style.rotationDeg ?? 0}
        onChange={(e) => updateSelectedTextLabelStyle({ rotationDeg: Number(e.target.value) })}
      />
    </div>

    <button className="deleteButton" onClick={deleteSelectedObject}>
      Delete
    </button>
  </div>
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
    JSON.stringify(a.segmentMarks ?? null) === JSON.stringify(b.segmentMarks ?? null) &&
    JSON.stringify(a.segmentArrowMark ?? null) === JSON.stringify(b.segmentArrowMark ?? null) &&
    JSON.stringify(a.segmentArrowMarks ?? null) === JSON.stringify(b.segmentArrowMarks ?? null)
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
    (a.patternColor ?? "") === (b.patternColor ?? "") &&
    JSON.stringify(a.arrowMark ?? null) === JSON.stringify(b.arrowMark ?? null)
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
    (a.patternColor ?? "") === (b.patternColor ?? "") &&
    JSON.stringify(a.arrowMark ?? null) === JSON.stringify(b.arrowMark ?? null)
  );
}

function angleStyleEqual(a: SceneModel["angles"][number]["style"], b: SceneModel["angles"][number]["style"]): boolean {
  return (
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    (a.strokeDash ?? "solid") === (b.strokeDash ?? "solid") &&
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
    Boolean(a.promoteToSolid) === Boolean(b.promoteToSolid) &&
    JSON.stringify(a.angleMarks ?? null) === JSON.stringify(b.angleMarks ?? null) &&
    JSON.stringify(a.arcArrowMark ?? null) === JSON.stringify(b.arcArrowMark ?? null) &&
    JSON.stringify(a.arcArrowMarks ?? null) === JSON.stringify(b.arcArrowMarks ?? null)
  );
}
