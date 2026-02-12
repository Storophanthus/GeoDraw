import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getNumberValue,
  getPointWorldPos,
  type PointShape,
  type PointStyle,
  type SceneModel,
} from "../scene/points";
import { selectConstructionDescription } from "../state/selectors/constructionDescription";
import { useGeoStore } from "../state/geoStore";
import { NumbersSection } from "./NumbersSection";

const SHAPES: PointShape[] = [
  "circle",
  "dot",
  "square",
  "diamond",
  "triUp",
  "triDown",
  "plus",
  "x",
  "cross",
];

const SEGMENT_MARK_OPTIONS = ["none", "|", "||", "|||", "s", "s|", "s||", "x", "o", "oo", "z"] as const;
const SEGMENT_ARROW_DIRECTIONS = ["->", "<-", "<->"] as const;
const SEGMENT_ARROW_DISTRIBUTIONS = ["single", "multi"] as const;
const SEGMENT_ARROW_WIDTH_UI_FACTOR = 8;

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
  const angleDefaults = useGeoStore((store) => store.angleDefaults);
  const angleFixedTool = useGeoStore((store) => store.angleFixedTool);
  const circleFixedTool = useGeoStore((store) => store.circleFixedTool);
  const pendingSelection = useGeoStore((store) => store.pendingSelection);
  const setPointDefaults = useGeoStore((store) => store.setPointDefaults);
  const setSegmentDefaults = useGeoStore((store) => store.setSegmentDefaults);
  const setLineDefaults = useGeoStore((store) => store.setLineDefaults);
  const setCircleDefaults = useGeoStore((store) => store.setCircleDefaults);
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
  const updateSelectedAngleStyle = useGeoStore((store) => store.updateSelectedAngleStyle);
  const updateSelectedSegmentFields = useGeoStore((store) => store.updateSelectedSegmentFields);
  const updateSelectedLineFields = useGeoStore((store) => store.updateSelectedLineFields);
  const updateSelectedCircleFields = useGeoStore((store) => store.updateSelectedCircleFields);
  const updateSelectedAngleFields = useGeoStore((store) => store.updateSelectedAngleFields);
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
  const selectedStyleKind = useMemo<"point" | "segment" | "line" | "circle" | "angle" | null>(() => {
    if (selectedPoint) return "point";
    if (selectedSegment) return "segment";
    if (selectedLine) return "line";
    if (selectedCircle) return "circle";
    if (selectedAngle) return "angle";
    return null;
  }, [selectedAngle, selectedCircle, selectedLine, selectedPoint, selectedSegment]);
  const selectedStyleAsDefault = useMemo(() => {
    if (selectedPoint) return pointStyleEqual(pointDefaults, selectedPoint.style);
    if (selectedSegment) return lineStyleEqual(segmentDefaults, selectedSegment.style);
    if (selectedLine) return lineStyleEqual(lineDefaults, selectedLine.style);
    if (selectedCircle) return circleStyleEqual(circleDefaults, selectedCircle.style);
    if (selectedAngle) return angleStyleEqual(angleDefaults, selectedAngle.style);
    return false;
  }, [
    angleDefaults,
    circleDefaults,
    lineDefaults,
    pointDefaults,
    segmentDefaults,
    selectedAngle,
    selectedCircle,
    selectedLine,
    selectedPoint,
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
{activeTool === "copyStyle" && (
  <div className="toolInfo">
    {copyStyle.source
      ? "Copy Style: click targets to apply (Shift-click to change source)"
      : "Copy Style: click an object to pick source (Shift-click anytime to change source)"}
  </div>
)}
{activeTool === "angle_fixed" && (
  <div className="toolInfo">
    <div className="subSectionTitle">Fixed Angle Tool</div>
    <div className="controlRow">
      <label className="controlLabel">Angle Expr (deg)</label>
      <input
        className="renameInput"
        type="text"
        value={angleFixedTool.angleExpr}
        onChange={(e) => setAngleFixedTool({ angleExpr: e.target.value })}
        placeholder="e.g. 30, 2*gamma, (ABC+15)/2"
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Direction</label>
      <select
        className="selectInput"
        value={angleFixedTool.direction}
        onChange={(e) => setAngleFixedTool({ direction: e.target.value as "CCW" | "CW" })}
      >
        <option value="CCW">CCW</option>
        <option value="CW">CW</option>
      </select>
    </div>
    <div className="statusText">
      {angleFixedPreview.ok
        ? `Resolved: ${angleFixedPreview.valueDeg.toFixed(3)}°`
        : angleFixedPreview.error}
    </div>
    <div className="statusText">Click A (base point), then B (vertex), then click to confirm.</div>
  </div>
)}
{activeTool === "circle_fixed" && (
  <div className="toolInfo">
    <div className="subSectionTitle">Circle with Fixed Radius</div>
    <div className="controlRow">
      <label className="controlLabel">Radius</label>
      <input
        className="renameInput"
        type="text"
        value={circleFixedTool.radius}
        onChange={(e) => setCircleFixedTool({ radius: e.target.value })}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (!pendingSelection || pendingSelection.tool !== "circle_fixed") return;
          const created = createCircleFixedRadius(pendingSelection.first.id, circleFixedTool.radius);
          if (created) clearPendingSelection();
        }}
        placeholder="e.g. 3.5 or r_1/2"
      />
    </div>
    <div className="actionsRow">
      <button
        className="actionButton secondary"
        disabled={
          !pendingSelection ||
          pendingSelection.tool !== "circle_fixed" ||
          !circleFixedPreview.ok ||
          !Number.isFinite(circleFixedPreview.value) ||
          circleFixedPreview.value <= 0
        }
        onClick={() => {
          if (!pendingSelection || pendingSelection.tool !== "circle_fixed") return;
          const created = createCircleFixedRadius(pendingSelection.first.id, circleFixedTool.radius);
          if (created) clearPendingSelection();
        }}
      >
        Create
      </button>
    </div>
    <div className="statusText">
      {pendingSelection && pendingSelection.tool === "circle_fixed"
        ? `Center selected: ${pointLabel(pendingSelection.first.id, pointNameById)}`
        : "Click center point first."}
    </div>
    <div className="statusText">
      {circleFixedPreview.ok && Number.isFinite(circleFixedPreview.value) && circleFixedPreview.value > 0
        ? `Resolved: r = ${circleFixedPreview.value.toFixed(6)}`
        : "Radius must be > 0 (supports expressions like r_1/2)"}
    </div>
  </div>
)}
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
{!selectedPoint && !selectedSegment && !selectedLine && !selectedCircle && !selectedAngle && !selectedNumber && (
  <div className="emptyState">Select an object to edit properties</div>
)}
{!selectedPoint && !selectedAngle && selectedSegment && (
  <div className="cosmeticsBlock">
    <div className="subSectionTitle">Segment Style</div>
    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedSegment.visible}
        onChange={(e) => updateSelectedSegmentFields({ visible: e.target.checked })}
      />
      Show Object
    </label>
    <div className="controlRow">
      <label className="controlLabel">Stroke Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedSegment.style.strokeColor}
        onChange={(e) => updateSelectedSegmentStyle({ strokeColor: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Stroke Width</label>
      <input
        className="sizeSlider"
        type="range"
        min={0.5}
        max={6}
        step={0.1}
        value={selectedSegment.style.strokeWidth}
        onChange={(e) => updateSelectedSegmentStyle({ strokeWidth: Number(e.target.value) })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Dash</label>
      <select
        className="selectInput"
        value={selectedSegment.style.dash}
        onChange={(e) => updateSelectedSegmentStyle({ dash: e.target.value as "solid" | "dashed" | "dotted" })}
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>
    </div>
    <div className="controlRow">
      <label className="controlLabel">Opacity</label>
      <input
        className="sizeSlider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={selectedSegment.style.opacity}
        onChange={(e) => updateSelectedSegmentStyle({ opacity: Number(e.target.value) })}
      />
    </div>
    <details className="detailsSection">
      <summary className="subSectionTitle detailsSummary">Marking</summary>
      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={selectedSegment.style.segmentMark?.enabled ?? false}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentMark: {
                ...(selectedSegment.style.segmentMark ?? {
                  mark: "none",
                  pos: 0.5,
                  sizePt: 4,
                }),
                enabled: e.target.checked,
              },
            })
          }
        />
        Enable segment mark
      </label>
      <div className="controlRow">
        <label className="controlLabel">Mark Type</label>
        <select
          className="selectInput"
          value={selectedSegment.style.segmentMark?.mark ?? "none"}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentMark: {
                ...(selectedSegment.style.segmentMark ?? {
                  enabled: true,
                  pos: 0.5,
                  sizePt: 4,
                }),
                mark: e.target.value as (typeof SEGMENT_MARK_OPTIONS)[number],
              },
            })
          }
        >
                        {SEGMENT_MARK_OPTIONS.map((mark: string) => (
            <option key={mark} value={mark}>
              {mark}
            </option>
          ))}
        </select>
      </div>
      <div className="controlRow">
        <label className="controlLabel">Mark Pos</label>
        <input
          className="sizeSlider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={selectedSegment.style.segmentMark?.pos ?? 0.5}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentMark: {
                ...(selectedSegment.style.segmentMark ?? {
                  enabled: true,
                  mark: "|",
                  sizePt: 4,
                }),
                pos: Number(e.target.value),
              },
            })
          }
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Mark Size</label>
        <input
          className="sizeSlider"
          type="number"
          min={0}
          max={24}
          step={0.1}
          value={selectedSegment.style.segmentMark?.sizePt ?? 4}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentMark: {
                ...(selectedSegment.style.segmentMark ?? {
                  enabled: true,
                  mark: "|",
                  pos: 0.5,
                }),
                sizePt: Number(e.target.value),
              },
            })
          }
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Mark Color</label>
        <input
          className="colorInput"
          type="color"
          value={selectedSegment.style.segmentMark?.color ?? selectedSegment.style.strokeColor}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentMark: {
                ...(selectedSegment.style.segmentMark ?? {
                  enabled: true,
                  mark: "|",
                  pos: 0.5,
                  sizePt: 4,
                }),
                color: e.target.value,
              },
            })
          }
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Mark Width</label>
        <input
          className="sizeSlider"
          type="number"
          min={0}
          max={12}
          step={0.1}
          value={selectedSegment.style.segmentMark?.lineWidthPt ?? 1}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentMark: {
                ...(selectedSegment.style.segmentMark ?? {
                  enabled: true,
                  mark: "|",
                  pos: 0.5,
                  sizePt: 4,
                }),
                lineWidthPt: Number(e.target.value),
              },
            })
          }
        />
      </div>

      <div className="subSectionTitle" style={{ marginTop: 10 }}>Arrow Mark</div>
      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={selectedSegment.style.segmentArrowMark?.enabled ?? false}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentArrowMark: {
                ...(selectedSegment.style.segmentArrowMark ?? {
                  mode: "end",
                  direction: "->",
                  distribution: "single",
                  pos: 0.5,
                  startPos: 0.45,
                  endPos: 0.55,
                  step: 0.05,
                }),
                enabled: e.target.checked,
              },
            })
          }
        />
        Enable arrow mark
      </label>
      <div className="controlRow">
        <label className="controlLabel">Arrow Mode</label>
        <select
          className="selectInput"
          value={selectedSegment.style.segmentArrowMark?.mode ?? "end"}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentArrowMark: {
                ...(selectedSegment.style.segmentArrowMark ?? {
                  enabled: true,
                  direction: "->",
                  distribution: "single",
                  pos: 0.5,
                  startPos: 0.45,
                  endPos: 0.55,
                  step: 0.05,
                }),
                mode: e.target.value as "end" | "mid",
              },
            })
          }
        >
          <option value="end">End arrow</option>
          <option value="mid">Mid arrow</option>
        </select>
      </div>
      <div className="controlRow">
        <label className="controlLabel">Direction</label>
        <select
          className="selectInput"
          value={selectedSegment.style.segmentArrowMark?.direction ?? "->"}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentArrowMark: {
                ...(selectedSegment.style.segmentArrowMark ?? {
                  enabled: true,
                  mode: "end",
                  distribution: "single",
                  pos: 0.5,
                  startPos: 0.45,
                  endPos: 0.55,
                  step: 0.05,
                }),
                direction: e.target.value as (typeof SEGMENT_ARROW_DIRECTIONS)[number],
              },
            })
          }
        >
                        {SEGMENT_ARROW_DIRECTIONS.map((direction: string) => (
            <option key={direction} value={direction}>
              {direction}
            </option>
          ))}
        </select>
      </div>
      <div className="controlRow">
        <label className="controlLabel">Arrow Pos</label>
        <input
          className="sizeSlider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={
            selectedSegment.style.segmentArrowMark?.pos ??
            selectedSegment.style.segmentMark?.pos ??
            0.5
          }
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentArrowMark: {
                ...(selectedSegment.style.segmentArrowMark ?? {
                  enabled: true,
                  mode: "mid",
                  direction: "->",
                  distribution: "single",
                  startPos: 0.45,
                  endPos: 0.55,
                  step: 0.05,
                }),
                pos: Number(e.target.value),
              },
            })
          }
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Arrow Color</label>
        <input
          className="colorInput"
          type="color"
          value={selectedSegment.style.segmentArrowMark?.color ?? selectedSegment.style.strokeColor}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentArrowMark: {
                ...(selectedSegment.style.segmentArrowMark ?? {
                  enabled: true,
                  mode: "end",
                  direction: "->",
                  distribution: "single",
                  pos: 0.5,
                  startPos: 0.45,
                  endPos: 0.55,
                  step: 0.05,
                }),
                color: e.target.value,
              },
            })
          }
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Arrow Width</label>
        <input
          className="sizeSlider"
          type="number"
          min={0}
          max={12}
          step={0.05}
          value={(selectedSegment.style.segmentArrowMark?.lineWidthPt ?? SEGMENT_ARROW_WIDTH_UI_FACTOR) / SEGMENT_ARROW_WIDTH_UI_FACTOR}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentArrowMark: {
                ...(selectedSegment.style.segmentArrowMark ?? {
                  enabled: true,
                  mode: "end",
                  direction: "->",
                  distribution: "single",
                  pos: 0.5,
                  startPos: 0.45,
                  endPos: 0.55,
                  step: 0.05,
                }),
                lineWidthPt: Number(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
              },
            })
          }
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Arrow Size</label>
        <input
          className="sizeSlider"
          type="number"
          min={0.2}
          max={8}
          step={0.1}
          value={selectedSegment.style.segmentArrowMark?.sizeScale ?? 1}
          onChange={(e) =>
            updateSelectedSegmentStyle({
              segmentArrowMark: {
                ...(selectedSegment.style.segmentArrowMark ?? {
                  enabled: true,
                  mode: "end",
                  direction: "->",
                  distribution: "single",
                  pos: 0.5,
                  startPos: 0.45,
                  endPos: 0.55,
                  step: 0.05,
                  lineWidthPt: SEGMENT_ARROW_WIDTH_UI_FACTOR,
                }),
                sizeScale: Number(e.target.value),
              },
            })
          }
        />
      </div>
      {selectedSegment.style.segmentArrowMark?.mode === "mid" && (
        <>
          <div className="controlRow">
            <label className="controlLabel">Distribution</label>
            <select
              className="selectInput"
              value={selectedSegment.style.segmentArrowMark?.distribution ?? "single"}
              onChange={(e) =>
                updateSelectedSegmentStyle({
                  segmentArrowMark: {
                    ...(selectedSegment.style.segmentArrowMark ?? {
                      enabled: true,
                      mode: "mid",
                      direction: "->",
                      pos: 0.5,
                      startPos: 0.45,
                      endPos: 0.55,
                      step: 0.05,
                    }),
                    distribution: e.target.value as (typeof SEGMENT_ARROW_DISTRIBUTIONS)[number],
                  },
                })
              }
            >
                            {SEGMENT_ARROW_DISTRIBUTIONS.map((distribution: string) => (
                <option key={distribution} value={distribution}>
                  {distribution}
                </option>
              ))}
            </select>
          </div>
          {((selectedSegment.style.segmentArrowMark?.distribution ?? "single") === "multi") && (
            <>
              <div className="controlRow">
                <label className="controlLabel">Start</label>
                <input
                  className="sizeSlider"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedSegment.style.segmentArrowMark?.startPos ?? 0.45}
                  onChange={(e) =>
                    updateSelectedSegmentStyle({
                      segmentArrowMark: {
                        ...(selectedSegment.style.segmentArrowMark ?? {
                          enabled: true,
                          mode: "mid",
                          direction: "->",
                          distribution: "multi",
                          endPos: 0.55,
                          step: 0.05,
                        }),
                        startPos: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="controlRow">
                <label className="controlLabel">End</label>
                <input
                  className="sizeSlider"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedSegment.style.segmentArrowMark?.endPos ?? 0.55}
                  onChange={(e) =>
                    updateSelectedSegmentStyle({
                      segmentArrowMark: {
                        ...(selectedSegment.style.segmentArrowMark ?? {
                          enabled: true,
                          mode: "mid",
                          direction: "->",
                          distribution: "multi",
                          startPos: 0.45,
                          step: 0.05,
                        }),
                        endPos: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="controlRow">
                <label className="controlLabel">Step</label>
                <input
                  className="sizeSlider"
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.01}
                  value={selectedSegment.style.segmentArrowMark?.step ?? 0.05}
                  onChange={(e) =>
                    updateSelectedSegmentStyle({
                      segmentArrowMark: {
                        ...(selectedSegment.style.segmentArrowMark ?? {
                          enabled: true,
                          mode: "mid",
                          direction: "->",
                          distribution: "multi",
                          startPos: 0.45,
                          endPos: 0.55,
                        }),
                        step: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </>
          )}
        </>
      )}
    </details>
  </div>
)}
{!selectedPoint && !selectedAngle && selectedLine && (
  <div className="cosmeticsBlock">
    <div className="subSectionTitle">Line Style</div>
    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedLine.visible}
        onChange={(e) => updateSelectedLineFields({ visible: e.target.checked })}
      />
      Show Object
    </label>
    <div className="controlRow">
      <label className="controlLabel">Stroke Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedLine.style.strokeColor}
        onChange={(e) => updateSelectedLineStyle({ strokeColor: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Stroke Width</label>
      <input
        className="sizeSlider"
        type="range"
        min={0.5}
        max={6}
        step={0.1}
        value={selectedLine.style.strokeWidth}
        onChange={(e) => updateSelectedLineStyle({ strokeWidth: Number(e.target.value) })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Dash</label>
      <select
        className="selectInput"
        value={selectedLine.style.dash}
        onChange={(e) => updateSelectedLineStyle({ dash: e.target.value as "solid" | "dashed" | "dotted" })}
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>
    </div>
    <div className="controlRow">
      <label className="controlLabel">Opacity</label>
      <input
        className="sizeSlider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={selectedLine.style.opacity}
        onChange={(e) => updateSelectedLineStyle({ opacity: Number(e.target.value) })}
      />
    </div>
  </div>
)}
{!selectedPoint && !selectedAngle && selectedCircle && (
  <div className="cosmeticsBlock">
    <div className="subSectionTitle">Circle Style</div>
    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedCircle.visible}
        onChange={(e) => updateSelectedCircleFields({ visible: e.target.checked })}
      />
      Show Object
    </label>
    <div className="controlRow">
      <label className="controlLabel">Stroke Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedCircle.style.strokeColor}
        onChange={(e) => updateSelectedCircleStyle({ strokeColor: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Stroke Width</label>
      <input
        className="sizeSlider"
        type="range"
        min={0.5}
        max={6}
        step={0.1}
        value={selectedCircle.style.strokeWidth}
        onChange={(e) => updateSelectedCircleStyle({ strokeWidth: Number(e.target.value) })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Dash</label>
      <select
        className="selectInput"
        value={selectedCircle.style.strokeDash}
        onChange={(e) => updateSelectedCircleStyle({ strokeDash: e.target.value as "solid" | "dashed" | "dotted" })}
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>
    </div>
    <div className="controlRow">
      <label className="controlLabel">Stroke Opacity</label>
      <input
        className="sizeSlider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={selectedCircle.style.strokeOpacity}
        onChange={(e) => updateSelectedCircleStyle({ strokeOpacity: Number(e.target.value) })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Fill Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedCircle.style.fillColor ?? "#000000"}
        onChange={(e) => updateSelectedCircleStyle({ fillColor: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Fill Opacity</label>
      <input
        className="sizeSlider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={selectedCircle.style.fillOpacity ?? 0}
        onChange={(e) => updateSelectedCircleStyle({ fillOpacity: Number(e.target.value) })}
      />
    </div>
  </div>
)}
{selectedPoint && (
  <>
    <div className="detailRow">
      <span className="detailLabel">Position</span>
      <span>
        ({formatNumber(selectedPointWorld?.x ?? 0)}, {formatNumber(selectedPointWorld?.y ?? 0)})
      </span>
    </div>

    <div className="fieldBlock">
      <label className="fieldLabel">Name</label>
      <div className="renameRow">
        <input
          className="renameInput"
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value);
            setRenameError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyRename();
            }
          }}
        />
        <button className="actionButton" onClick={applyRename}>
          Apply
        </button>
      </div>
    </div>

    <div className="fieldBlock">
      <label className="fieldLabel">Caption (TeX)</label>
      <input
        className="renameInput"
        value={selectedPoint.captionTex}
        onChange={(e) => updateSelectedPointFields({ captionTex: e.target.value })}
      />
    </div>

    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedPoint.visible}
        onChange={(e) => updateSelectedPointFields({ visible: e.target.checked })}
      />
      Show Object
    </label>

    <div className="fieldBlock">
      <label className="fieldLabel">Show Label</label>
      <select
        className="selectInput"
        value={selectedPoint.showLabel}
        onChange={(e) =>
          updateSelectedPointFields({ showLabel: e.target.value as "none" | "name" | "caption" })
        }
      >
        <option value="none">None</option>
        <option value="name">Name</option>
        <option value="caption">Caption</option>
      </select>
    </div>

    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={Boolean(selectedPoint.locked)}
        onChange={(e) => updateSelectedPointFields({ locked: e.target.checked })}
      />
      Fix Object
    </label>

    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={Boolean(selectedPoint.auxiliary)}
        onChange={(e) => updateSelectedPointFields({ auxiliary: e.target.checked })}
      />
      Auxiliary Object
    </label>

    {renameError && <div className="errorText">{renameError}</div>}

    <button className="deleteButton" onClick={deleteSelectedObject}>
      Delete
    </button>

    <div className="cosmeticsBlock">
      <div className="subSectionTitle">Point Style</div>

      <div className="fieldBlock" ref={shapePickerRef}>
        <label className="fieldLabel">Shape</label>
        <button
          className="shapeButton"
                        onClick={() => setShapePickerOpen((v: boolean) => !v)}
          type="button"
        >
          <ShapeGlyph shape={selectedPoint.style.shape} />
          <span>{selectedPoint.style.shape}</span>
        </button>
        {shapePickerOpen && (
          <div className="shapePopover">
                          {SHAPES.map((shape: PointShape) => (
              <button
                key={shape}
                className={shape === selectedPoint.style.shape ? "shapeCell active" : "shapeCell"}
                onClick={() => {
                  updateSelectedPointStyle({ shape });
                  setShapePickerOpen(false);
                }}
                type="button"
              >
                <ShapeGlyph shape={shape} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="controlRow">
        <label className="controlLabel">Size</label>
        <input
          className="sizeSlider"
          type="range"
          min={2}
          max={18}
          value={selectedPoint.style.sizePx}
          onChange={(e) => updateSelectedPointStyle({ sizePx: Number(e.target.value) })}
        />
      </div>

      <div className="controlRow">
        <label className="controlLabel">Stroke Color</label>
        <input
          className="colorInput"
          type="color"
          value={selectedPoint.style.strokeColor}
          onChange={(e) => updateSelectedPointStyle({ strokeColor: e.target.value })}
        />
      </div>

      <div className="controlRow">
        <label className="controlLabel">Stroke Width</label>
        <input
          className="sizeSlider"
          type="range"
          min={0.5}
          max={6}
          step={0.1}
          value={selectedPoint.style.strokeWidth}
          onChange={(e) => updateSelectedPointStyle({ strokeWidth: Number(e.target.value) })}
        />
      </div>

      <div className="controlRow">
        <label className="controlLabel">Stroke Opacity</label>
        <input
          className="sizeSlider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={selectedPoint.style.strokeOpacity}
          onChange={(e) => updateSelectedPointStyle({ strokeOpacity: Number(e.target.value) })}
        />
      </div>

      <div className="controlRow">
        <label className="controlLabel">Fill Color</label>
        <input
          className="colorInput"
          type="color"
          value={selectedPoint.style.fillColor}
          onChange={(e) => updateSelectedPointStyle({ fillColor: e.target.value })}
        />
      </div>

      <div className="controlRow">
        <label className="controlLabel">Fill Opacity</label>
        <input
          className="sizeSlider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={selectedPoint.style.fillOpacity}
          onChange={(e) => updateSelectedPointStyle({ fillOpacity: Number(e.target.value) })}
        />
      </div>
    </div>
  </>
)}

{!selectedPoint && selectedAngle && (
  <div className="cosmeticsBlock">
    <div className="subSectionTitle">Angle Style</div>
    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedAngle.visible}
        onChange={(e) => updateSelectedAngleFields({ visible: e.target.checked })}
      />
      Show Object
    </label>
    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedAngle.style.showLabel}
        onChange={(e) => updateSelectedAngleStyle({ showLabel: e.target.checked })}
      />
      Show Label
    </label>
    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedAngle.style.showValue}
        onChange={(e) => updateSelectedAngleStyle({ showValue: e.target.checked })}
      />
      Show Value (deg)
    </label>
    <div className="controlRow">
      <label className="controlLabel">Label Text</label>
      <input
        className="renameInput"
        value={selectedAngle.style.labelText}
        onChange={(e) => updateSelectedAngleStyle({ labelText: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Mark</label>
      <select
        className="selectInput"
        value={selectedAngle.style.markStyle}
        onChange={(e) => updateSelectedAngleStyle({ markStyle: e.target.value as "arc" | "right" | "none" })}
      >
        <option value="arc">Arc</option>
        <option value="right">Right</option>
        <option value="none">None</option>
      </select>
    </div>
    <div className="controlRow">
      <label className="controlLabel">Arc Radius</label>
      <input
        className="sizeSlider"
        type="range"
        min={0.2}
        max={4}
        step={0.05}
        value={selectedAngle.style.arcRadius}
        onChange={(e) => updateSelectedAngleStyle({ arcRadius: Number(e.target.value) })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Stroke Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedAngle.style.strokeColor}
        onChange={(e) => updateSelectedAngleStyle({ strokeColor: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Stroke Width</label>
      <input
        className="sizeSlider"
        type="range"
        min={0.5}
        max={6}
        step={0.1}
        value={selectedAngle.style.strokeWidth}
        onChange={(e) => updateSelectedAngleStyle({ strokeWidth: Number(e.target.value) })}
      />
    </div>
    <label className="checkboxRow">
      <input
        type="checkbox"
        checked={selectedAngle.style.fillEnabled}
        onChange={(e) => updateSelectedAngleStyle({ fillEnabled: e.target.checked })}
      />
      Fill Angle
    </label>
    <div className="controlRow">
      <label className="controlLabel">Fill Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedAngle.style.fillColor}
        onChange={(e) => updateSelectedAngleStyle({ fillColor: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Fill Opacity</label>
      <input
        className="sizeSlider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={selectedAngle.style.fillOpacity}
        onChange={(e) => updateSelectedAngleStyle({ fillOpacity: Number(e.target.value) })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Text Color</label>
      <input
        className="colorInput"
        type="color"
        value={selectedAngle.style.textColor}
        onChange={(e) => updateSelectedAngleStyle({ textColor: e.target.value })}
      />
    </div>
    <div className="controlRow">
      <label className="controlLabel">Text Size</label>
      <input
        className="sizeSlider"
        type="range"
        min={8}
        max={42}
        step={1}
        value={selectedAngle.style.textSize}
        onChange={(e) => updateSelectedAngleStyle({ textSize: Number(e.target.value) })}
      />
    </div>
    <button className="deleteButton" onClick={deleteSelectedObject}>
      Delete
    </button>
  </div>
)}

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

function formatNumber(value: number): string {
  return value.toFixed(3);
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
    (a.fillOpacity ?? 0) === (b.fillOpacity ?? 0)
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
    a.arcRadius === b.arcRadius &&
    a.labelText === b.labelText &&
    a.showLabel === b.showLabel &&
    a.showValue === b.showValue
  );
}

function ShapeGlyph({ shape }: { shape: PointShape }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
      {shape === "circle" && <circle cx="10" cy="10" r="5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />}
      {shape === "dot" && <circle cx="10" cy="10" r="2.2" fill="currentColor" />}
      {shape === "square" && <rect x="5" y="5" width="10" height="10" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />}
      {shape === "diamond" && <path d="M10 4 L16 10 L10 16 L4 10 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />}
      {shape === "triUp" && <path d="M10 4 L16 15 L4 15 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />}
      {shape === "triDown" && <path d="M4 5 L16 5 L10 16 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />}
      {shape === "plus" && <path d="M10 4 L10 16 M4 10 L16 10" stroke="currentColor" strokeWidth="1.8" />}
      {shape === "x" && <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.8" />}
      {shape === "cross" && <path d="M5 5 L15 15 M15 5 L5 15 M10 4 L10 16 M4 10 L16 10" stroke="currentColor" strokeWidth="1.4" />}
    </svg>
  );
}
