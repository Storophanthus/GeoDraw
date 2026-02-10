import {
  Circle,
  ChevronLeft,
  ChevronRight,
  Dot,
  GitMerge,
  Minus,
  MousePointer2,
  Paintbrush2,
  Redo2,
  Slash,
  Undo2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { exportConstructionSnapshot } from "./export/constructionSnapshot";
import { exportTikzWithOptions } from "./export/tikz";
import {
  getPointWorldPos,
  type GeometryObjectRef,
  type PointShape,
  type PointStyle,
  type SceneModel,
  type ScenePoint,
} from "./scene/points";
import { useGeoStore, type ActiveTool } from "./state/geoStore";
import type { Camera } from "./view/camera";
import { CanvasView } from "./view/CanvasView";

type IconProps = {
  size?: number;
  strokeWidth?: number;
};

type ToolDef = {
  icon: ComponentType<IconProps>;
  tooltip: string;
  ariaLabel: string;
};

type ToolGroupId = "move" | "points" | "lines" | "circles" | "styles";

type ResizeState = {
  side: "left" | "right" | null;
  startX: number;
  leftWidth: number;
  rightWidth: number;
};

type RightTab = "algebra" | "export";

const TOOL_REGISTRY: Record<ActiveTool, ToolDef> = {
  move: { icon: MousePointer2, tooltip: "Move / Select (V)", ariaLabel: "Move tool" },
  point: { icon: Dot, tooltip: "Point (P)", ariaLabel: "Point tool" },
  copyStyle: { icon: Paintbrush2, tooltip: "Copy Style (C)", ariaLabel: "Copy style tool" },
  midpoint: { icon: GitMerge, tooltip: "Midpoint (M)", ariaLabel: "Midpoint tool" },
  segment: { icon: Minus, tooltip: "Segment (S)", ariaLabel: "Segment tool" },
  line2p: { icon: Slash, tooltip: "Line Through 2 Points (L)", ariaLabel: "Line tool" },
  perp_line: { icon: PerpendicularIcon, tooltip: "Perpendicular Line", ariaLabel: "Perpendicular line tool" },
  circle_cp: { icon: Circle, tooltip: "Circle Center + Point (O)", ariaLabel: "Circle center-through-point tool" },
};

const TOOL_GROUPS: Array<{ id: ToolGroupId; label: string; tools: ActiveTool[] }> = [
  { id: "move", label: "MOVE", tools: ["move"] },
  { id: "points", label: "POINTS", tools: ["point", "midpoint"] },
  { id: "lines", label: "LINES", tools: ["segment", "line2p", "perp_line"] },
  { id: "circles", label: "CIRCLES", tools: ["circle_cp"] },
  { id: "styles", label: "STYLES", tools: ["copyStyle"] },
];

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

const LEFT_MIN = 48;
const LEFT_MAX = 240;
const RIGHT_MIN = 240;
const RIGHT_MAX = 560;
const COLLAPSED_W = 18;
const LONG_PRESS_MS = 250;

export default function App() {
  const activeTool = useGeoStore((store) => store.activeTool);
  const setActiveTool = useGeoStore((store) => store.setActiveTool);

  const scene = useGeoStore((store) => store.scene);
  const camera = useGeoStore((store) => store.camera);
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const renameSelectedPoint = useGeoStore((store) => store.renameSelectedPoint);
  const deleteSelectedObject = useGeoStore((store) => store.deleteSelectedObject);
  const clearCopyStyle = useGeoStore((store) => store.clearCopyStyle);
  const undo = useGeoStore((store) => store.undo);
  const redo = useGeoStore((store) => store.redo);
  const canUndo = useGeoStore((store) => store.canUndo);
  const canRedo = useGeoStore((store) => store.canRedo);
  const recentCreatedObject = useGeoStore((store) => store.recentCreatedObject);
  const copyStyle = useGeoStore((store) => store.copyStyle);
  const pointDefaults = useGeoStore((store) => store.pointDefaults);
  const setPointDefaults = useGeoStore((store) => store.setPointDefaults);
  const updateSelectedPointStyle = useGeoStore((store) => store.updateSelectedPointStyle);
  const updateSelectedPointFields = useGeoStore((store) => store.updateSelectedPointFields);
  const updateSelectedSegmentStyle = useGeoStore((store) => store.updateSelectedSegmentStyle);
  const updateSelectedLineStyle = useGeoStore((store) => store.updateSelectedLineStyle);
  const updateSelectedCircleStyle = useGeoStore((store) => store.updateSelectedCircleStyle);
  const updateSelectedSegmentFields = useGeoStore((store) => store.updateSelectedSegmentFields);
  const updateSelectedLineFields = useGeoStore((store) => store.updateSelectedLineFields);
  const updateSelectedCircleFields = useGeoStore((store) => store.updateSelectedCircleFields);

  const selectedPointId = selectedObject?.type === "point" ? selectedObject.id : null;
  const selectedPoint = useMemo(
    () => scene.points.find((point) => point.id === selectedPointId) ?? null,
    [scene.points, selectedPointId]
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
  const selectedPointWorld = useMemo(() => {
    if (!selectedPoint) return null;
    return getPointWorldPos(selectedPoint, scene);
  }, [scene, selectedPoint]);
  const latestCreatedPoint = useMemo(() => {
    if (recentCreatedObject?.type !== "point") return null;
    return scene.points.find((point) => point.id === recentCreatedObject.id) ?? null;
  }, [recentCreatedObject, scene.points]);
  const latestPointAsDefault = useMemo(() => {
    if (!latestCreatedPoint) return false;
    return pointStyleEqual(pointDefaults, latestCreatedPoint.style);
  }, [latestCreatedPoint, pointDefaults]);
  const pointNameById = useMemo(() => new Map(scene.points.map((p) => [p.id, p.name])), [scene.points]);
  const lineById = useMemo(() => new Map(scene.lines.map((l) => [l.id, l])), [scene.lines]);
  const segmentById = useMemo(() => new Map(scene.segments.map((s) => [s.id, s])), [scene.segments]);
  const circleById = useMemo(() => new Map(scene.circles.map((c) => [c.id, c])), [scene.circles]);
  const selectedConstructionText = useMemo(
    () =>
      describeSelectedConstruction(
        selectedObject,
        scene,
        pointNameById,
        lineById,
        segmentById,
        circleById
      ),
    [circleById, lineById, pointNameById, scene, segmentById, selectedObject]
  );

  const [nameInput, setNameInput] = useState("");
  const [renameError, setRenameError] = useState("");
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [tikzText, setTikzText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [tikzCopied, setTikzCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("algebra");
  const [exportUseCurrentView, setExportUseCurrentView] = useState(false);
  const [exportMatchCanvas, setExportMatchCanvas] = useState(true);
  const [exportGlobalScale, setExportGlobalScale] = useState("1");
  const [exportPointScale, setExportPointScale] = useState("1");
  const [exportLineScale, setExportLineScale] = useState("1");
  const [lastTikzSceneRef, setLastTikzSceneRef] = useState<SceneModel | null>(null);
  const [lastTikzOptionSig, setLastTikzOptionSig] = useState("");
  const [lastTikzGeneratedAt, setLastTikzGeneratedAt] = useState<number | null>(null);

  const shapePickerRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(56);
  const [rightWidth, setRightWidth] = useState(312);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [openFlyoutGroup, setOpenFlyoutGroup] = useState<ToolGroupId | null>(null);
  const [groupLastSelected, setGroupLastSelected] = useState<Record<ToolGroupId, ActiveTool>>({
    move: "move",
    points: "point",
    lines: "segment",
    circles: "circle_cp",
    styles: "copyStyle",
  });

  const resizeRef = useRef<ResizeState>({ side: null, startX: 0, leftWidth: 56, rightWidth: 312 });
  const toolbarRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    const groupId = getGroupIdForTool(activeTool);
    if (!groupId) return;
    setGroupLastSelected((prev) => (prev[groupId] === activeTool ? prev : { ...prev, [groupId]: activeTool }));
  }, [activeTool]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTextInput =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable === true;
      if (isTextInput) return;

      if (e.key === "Escape" && openFlyoutGroup) {
        e.preventDefault();
        setOpenFlyoutGroup(null);
        return;
      }

      if (e.key === "Escape" && activeTool === "copyStyle") {
        e.preventDefault();
        clearCopyStyle();
        setActiveTool("move");
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedObject();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, clearCopyStyle, deleteSelectedObject, openFlyoutGroup, redo, setActiveTool, undo]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!toolbarRef.current) return;
      if (!toolbarRef.current.contains(e.target as Node)) {
        setOpenFlyoutGroup(null);
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = resizeRef.current;
      if (!st.side) return;

      const dx = e.clientX - st.startX;
      if (st.side === "left") {
        setLeftWidth(clamp(st.leftWidth + dx, LEFT_MIN, LEFT_MAX));
      } else {
        setRightWidth(clamp(st.rightWidth - dx, RIGHT_MIN, RIGHT_MAX));
      }
    };

    const onUp = () => {
      if (!resizeRef.current.side) return;
      resizeRef.current.side = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startResize = (side: "left" | "right") => (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((side === "left" && leftCollapsed) || (side === "right" && rightCollapsed)) return;
    resizeRef.current = {
      side,
      startX: e.clientX,
      leftWidth,
      rightWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const applyRename = () => {
    const result = renameSelectedPoint(nameInput);
    if (!result.ok) {
      setRenameError(result.error);
      return;
    }
    setNameInput(result.name);
    setRenameError("");
  };

  const generateTikz = () => {
    try {
      const pointScale = Number(exportPointScale);
      const lineScale = Number(exportLineScale);
      const globalScale = Number(exportGlobalScale);
      const optionSig = `${exportUseCurrentView}|${exportMatchCanvas}|${exportGlobalScale}|${exportPointScale}|${exportLineScale}|${camera.pos.x}|${camera.pos.y}|${camera.zoom}`;
      const viewport = exportUseCurrentView
        ? getViewportFromCamera(
            camera,
            leftCollapsed ? COLLAPSED_W : leftWidth,
            rightCollapsed ? COLLAPSED_W : rightWidth
          )
        : undefined;
      setTikzText(
        exportTikzWithOptions(scene, {
          viewport,
          worldToTikzScale: Number.isFinite(globalScale) ? globalScale : 1,
          pointScale: Number.isFinite(pointScale) ? pointScale : 1,
          lineScale: Number.isFinite(lineScale) ? lineScale : 1,
          screenPxPerWorld: camera.zoom,
          matchCanvas: exportMatchCanvas,
        })
      );
      setLastTikzSceneRef(scene);
      setLastTikzOptionSig(optionSig);
      setLastTikzGeneratedAt(Date.now());
      setTikzCopied(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown exporter error";
      setTikzText(`% Export failed: ${message}`);
      setTikzCopied(false);
    }
  };

  const currentTikzOptionSig = `${exportUseCurrentView}|${exportMatchCanvas}|${exportGlobalScale}|${exportPointScale}|${exportLineScale}|${camera.pos.x}|${camera.pos.y}|${camera.zoom}`;
  const tikzOutdated = Boolean(tikzText) && (lastTikzSceneRef !== scene || lastTikzOptionSig !== currentTikzOptionSig);
  const tikzStatusText =
    !tikzText
      ? "Not generated yet."
      : tikzOutdated
        ? "Outdated: scene/options changed. Regenerate TikZ."
        : `Up to date${lastTikzGeneratedAt ? ` · Generated ${new Date(lastTikzGeneratedAt).toLocaleTimeString()}` : ""}`;

  const generateConstructionSnapshot = () => {
    try {
      setJsonText(exportConstructionSnapshot(scene));
      setJsonCopied(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown snapshot exporter error";
      setJsonText(`{ \"error\": ${JSON.stringify(message)} }`);
      setJsonCopied(false);
    }
  };

  const copyTikz = async () => {
    if (!tikzText) return;
    try {
      await navigator.clipboard.writeText(tikzText);
      setTikzCopied(true);
      window.setTimeout(() => setTikzCopied(false), 1200);
    } catch {
      setTikzCopied(false);
    }
  };

  const copyJson = async () => {
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1200);
    } catch {
      setJsonCopied(false);
    }
  };

  return (
    <div className="appShell">
      <aside
        ref={toolbarRef}
        className={leftCollapsed ? "leftToolbar collapsed" : "leftToolbar"}
        style={{ width: leftCollapsed ? COLLAPSED_W : leftWidth }}
        aria-label="Tools"
      >
        {leftCollapsed ? (
          <button className="collapseButton" onClick={() => setLeftCollapsed(false)} aria-label="Expand left sidebar">
            <ChevronRight size={14} />
          </button>
        ) : (
          <>
            <button
              className="collapseButton"
              onClick={() => {
                setOpenFlyoutGroup(null);
                setLeftCollapsed(true);
              }}
              aria-label="Collapse left sidebar"
            >
              <ChevronLeft size={14} />
            </button>

            {TOOL_GROUPS.map((group, idx) => {
              const mainTool = groupLastSelected[group.id];
              return (
                <div key={group.id} className="toolGroupBlock">
                  {idx > 0 && <div className="toolGroupDivider" />}
                  <div className="toolGroupLabel">{group.label}</div>
                  <ToolGroupButton
                    groupId={group.id}
                    mainTool={mainTool}
                    tools={group.tools}
                    activeTool={activeTool}
                    flyoutOpen={openFlyoutGroup === group.id}
                    onOpenFlyout={() => setOpenFlyoutGroup(group.id)}
                    onCloseFlyout={() => setOpenFlyoutGroup(null)}
                    onSelectTool={(tool) => {
                      setGroupLastSelected((prev) => ({ ...prev, [group.id]: tool }));
                      setActiveTool(tool);
                    }}
                  />
                </div>
              );
            })}
          </>
        )}
      </aside>

      <div className="resizeHandle left" onPointerDown={startResize("left")} />

      <main className="canvasPane">
        <div className="canvasTopActions" aria-label="History controls">
          <button className="iconActionButton" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo">
            <Undo2 size={16} />
          </button>
          <button
            className="iconActionButton"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Shift+Ctrl/Cmd+Z or Ctrl/Cmd+Y)"
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
        </div>
        <CanvasView />
      </main>

      <div className="resizeHandle right" onPointerDown={startResize("right")} />

      <aside
        className={rightCollapsed ? "rightSidebar collapsed" : "rightSidebar"}
        style={{ width: rightCollapsed ? COLLAPSED_W : rightWidth }}
      >
        {rightCollapsed ? (
          <button className="collapseButton" onClick={() => setRightCollapsed(false)} aria-label="Expand right sidebar">
            <ChevronLeft size={14} />
          </button>
        ) : (
          <>
            <div className="rightTopRow">
              <button className="collapseButton" onClick={() => setRightCollapsed(true)} aria-label="Collapse right sidebar">
                <ChevronRight size={14} />
              </button>
            </div>

            <section className="sidebarSection">
              <div className="rightTabs" role="tablist" aria-label="Right panel tabs">
                <button
                  type="button"
                  role="tab"
                  className={rightTab === "algebra" ? "rightTabButton active" : "rightTabButton"}
                  aria-selected={rightTab === "algebra"}
                  onClick={() => setRightTab("algebra")}
                >
                  Objects
                </button>
                <button
                  type="button"
                  role="tab"
                  className={rightTab === "export" ? "rightTabButton active" : "rightTabButton"}
                  aria-selected={rightTab === "export"}
                  onClick={() => setRightTab("export")}
                >
                  Export
                </button>
              </div>
            </section>

            {rightTab === "algebra" && <section className="sidebarSection">
              <h2 className="sectionTitle">Objects</h2>
              <div className="objectList">
                {scene.points.length === 0 &&
                  scene.segments.length === 0 &&
                  scene.lines.length === 0 &&
                  scene.circles.length === 0 && (
                  <div className="emptyState">No objects</div>
                )}
                {scene.points.map((point) => (
                  <button
                    key={point.id}
                    className={
                      selectedObject?.type === "point" && selectedObject.id === point.id
                        ? "objectItem active"
                        : "objectItem"
                    }
                    onClick={() => setSelectedObject({ type: "point", id: point.id })}
                  >
                    Point {point.name}
                  </button>
                ))}
                {scene.segments.map((segment) => (
                  <button
                    key={segment.id}
                    className={
                      selectedObject?.type === "segment" && selectedObject.id === segment.id
                        ? "objectItem active"
                        : "objectItem"
                    }
                    onClick={() => setSelectedObject({ type: "segment", id: segment.id })}
                  >
                    Segment {segment.id}
                  </button>
                ))}
                {scene.lines.map((line) => (
                  <button
                    key={line.id}
                    className={
                      selectedObject?.type === "line" && selectedObject.id === line.id
                        ? "objectItem active"
                        : "objectItem"
                    }
                    onClick={() => setSelectedObject({ type: "line", id: line.id })}
                  >
                    Line {line.id}
                  </button>
                ))}
                {scene.circles.map((circle) => (
                  <button
                    key={circle.id}
                    className={
                      selectedObject?.type === "circle" && selectedObject.id === circle.id
                        ? "objectItem active"
                        : "objectItem"
                    }
                    onClick={() => setSelectedObject({ type: "circle", id: circle.id })}
                  >
                    Circle {circle.id}
                  </button>
                ))}
              </div>
            </section>}

            {rightTab === "export" && <section className="sidebarSection">
              <div className="sectionHeaderRow">
                <h2 className="sectionTitle">Export</h2>
              </div>
              <div className="optionsBlock">
                <label className="checkboxRow">
                  <input
                    type="checkbox"
                    checked={exportUseCurrentView}
                    onChange={(e) => setExportUseCurrentView(e.target.checked)}
                  />
                  Use current camera viewport
                </label>
                <label className="checkboxRow">
                  <input
                    type="checkbox"
                    checked={exportMatchCanvas}
                    onChange={(e) => setExportMatchCanvas(e.target.checked)}
                  />
                  Match canvas size conversion
                </label>
              </div>
              <div className="scaleBlock">
                <label className="controlRow">
                  <span>Global Scale</span>
                  <input
                    type="number"
                    min={0.1}
                    max={6}
                    step={0.05}
                    value={exportGlobalScale}
                    onChange={(e) => setExportGlobalScale(e.target.value)}
                  />
                </label>
                <label className="controlRow">
                  <span>Point Scale</span>
                  <input
                    type="number"
                    min={0.1}
                    max={4}
                    step={0.05}
                    value={exportPointScale}
                    onChange={(e) => setExportPointScale(e.target.value)}
                  />
                </label>
                <label className="controlRow">
                  <span>Line Scale</span>
                  <input
                    type="number"
                    min={0.1}
                    max={4}
                    step={0.05}
                    value={exportLineScale}
                    onChange={(e) => setExportLineScale(e.target.value)}
                  />
                </label>
              </div>
              <div className="actionsRow">
                <button className="actionButton primary" onClick={generateTikz}>
                  {tikzOutdated ? "Regenerate TikZ" : "Generate TikZ"}
                </button>
                <button className="actionButton secondary" onClick={copyTikz} disabled={!tikzText}>
                  {tikzCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="statusText">{tikzStatusText}</div>
              <textarea
                className="exportTextarea"
                value={tikzText}
                onChange={(e) => setTikzText(e.target.value)}
                placeholder="Click Generate TikZ to export"
                spellCheck={false}
              />
            </section>}

            {rightTab === "export" && <section className="sidebarSection">
              <h2 className="sectionTitle">Model JSON</h2>
              <div className="actionsRow">
                <button className="actionButton primary" onClick={generateConstructionSnapshot}>
                  Generate JSON
                </button>
                <button className="actionButton secondary" onClick={copyJson} disabled={!jsonText}>
                  {jsonCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <textarea
                className="exportTextarea exportTextareaCompact"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder="Click Generate JSON to produce model export"
                spellCheck={false}
              />
            </section>}

            {rightTab === "algebra" && <section className="sidebarSection">
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
              {!selectedPoint && !selectedSegment && !selectedLine && !selectedCircle && (
                <div className="emptyState">Select a point to edit point properties</div>
              )}
              {!selectedPoint && selectedSegment && (
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
                </div>
              )}
              {!selectedPoint && selectedLine && (
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
              {!selectedPoint && selectedCircle && (
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
                        onClick={() => setShapePickerOpen((v) => !v)}
                        type="button"
                      >
                        <ShapeGlyph shape={selectedPoint.style.shape} />
                        <span>{selectedPoint.style.shape}</span>
                      </button>
                      {shapePickerOpen && (
                        <div className="shapePopover">
                          {SHAPES.map((shape) => (
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

              <div className="cosmeticsBlock">
                <label className="checkboxRow">
                  <input
                    type="checkbox"
                    checked={latestPointAsDefault}
                    disabled={!latestCreatedPoint}
                    onChange={(e) => {
                      if (!e.target.checked || !latestCreatedPoint) return;
                      setPointDefaults({
                        ...latestCreatedPoint.style,
                        labelOffsetPx: { ...latestCreatedPoint.style.labelOffsetPx },
                      });
                    }}
                  />
                  Make this default for new points
                </label>
              </div>
            </section>}
          </>
        )}
      </aside>
    </div>
  );
}

function describeSelectedConstruction(
  selectedObject: { type: "point" | "segment" | "line" | "circle"; id: string } | null,
  scene: SceneModel,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string | null {
  if (!selectedObject) return null;
  if (selectedObject.type === "line") {
    const line = lineById.get(selectedObject.id);
    if (!line) return `Line ${selectedObject.id}`;
    if (line.kind === "perpendicular") {
      const baseText =
        line.base.type === "line"
          ? (() => {
              const baseLine = lineById.get(line.base.id);
              return baseLine && baseLine.kind !== "perpendicular"
                ? `line through ${pointLabel(baseLine.aId, pointNameById)} and ${pointLabel(baseLine.bId, pointNameById)}`
                : `line ${line.base.id}`;
            })()
          : (() => {
              const baseSeg = segmentById.get(line.base.id);
              return baseSeg
                ? `segment ${pointLabel(baseSeg.aId, pointNameById)}${pointLabel(baseSeg.bId, pointNameById)}`
                : `segment ${line.base.id}`;
            })();
      return `Perpendicular line through ${pointLabel(line.throughId, pointNameById)} to ${baseText}.`;
    }
    return `Line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}.`;
  }
  if (selectedObject.type === "segment") {
    const segment = segmentById.get(selectedObject.id);
    if (!segment) return `Segment ${selectedObject.id}`;
    return `Segment from ${pointLabel(segment.aId, pointNameById)} to ${pointLabel(segment.bId, pointNameById)}.`;
  }
  if (selectedObject.type === "circle") {
    const circle = circleById.get(selectedObject.id);
    if (!circle) return `Circle ${selectedObject.id}`;
    return `Circle with center ${pointLabel(circle.centerId, pointNameById)} through ${pointLabel(circle.throughId, pointNameById)}.`;
  }

  const point = scene.points.find((item) => item.id === selectedObject.id);
  if (!point) return null;
  return describePointConstruction(point, pointNameById, lineById, segmentById, circleById);
}

function describePointConstruction(
  point: ScenePoint,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string {
  if (point.kind === "free") return `Free point ${point.name}.`;
  if (point.kind === "midpointPoints") {
    return `Midpoint of ${pointLabel(point.aId, pointNameById)} and ${pointLabel(point.bId, pointNameById)}.`;
  }
  if (point.kind === "midpointSegment") {
    const seg = segmentById.get(point.segId);
    if (!seg) return `Midpoint of segment ${point.segId}.`;
    return `Midpoint of segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}.`;
  }
  if (point.kind === "pointOnLine") {
    const line = lineById.get(point.lineId);
    if (!line) return `Point on line ${point.lineId}.`;
    if (line.kind === "perpendicular") {
      return `Point on line through ${pointLabel(line.throughId, pointNameById)} perpendicular to ${describeObjectRef(
        line.base,
        pointNameById,
        lineById,
        segmentById,
        circleById
      )}.`;
    }
    return `Point on line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}.`;
  }
  if (point.kind === "pointOnSegment") {
    const seg = segmentById.get(point.segId);
    if (!seg) return `Point on segment ${point.segId}.`;
    return `Point on segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}.`;
  }
  if (point.kind === "pointOnCircle") {
    const circle = circleById.get(point.circleId);
    if (!circle) return `Point on circle ${point.circleId}.`;
    return `Point on circle centered at ${pointLabel(circle.centerId, pointNameById)} through ${pointLabel(
      circle.throughId,
      pointNameById
    )}.`;
  }
  if (point.kind === "circleLineIntersectionPoint") {
    const circle = circleById.get(point.circleId);
    const line = lineById.get(point.lineId);
    const circleText = circle
      ? `circle centered at ${pointLabel(circle.centerId, pointNameById)} through ${pointLabel(
          circle.throughId,
          pointNameById
        )}`
      : `circle ${point.circleId}`;
    const lineText = line
      ? line.kind === "perpendicular"
        ? `line through ${pointLabel(line.throughId, pointNameById)} perpendicular to ${describeObjectRef(
            line.base,
            pointNameById,
            lineById,
            segmentById,
            circleById
          )}`
        : `line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}`
      : `line ${point.lineId}`;
    return `Intersection of ${lineText} with ${circleText}.`;
  }
  return `Intersection of ${describeObjectRef(point.objA, pointNameById, lineById, segmentById, circleById)} and ${describeObjectRef(
    point.objB,
    pointNameById,
    lineById,
    segmentById,
    circleById
  )}.`;
}

function describeObjectRef(
  ref: GeometryObjectRef,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string {
  if (ref.type === "line") {
    const line = lineById.get(ref.id);
    if (line?.kind === "perpendicular") {
      return `line through ${pointLabel(line.throughId, pointNameById)} perpendicular to ${describeObjectRef(
        line.base,
        pointNameById,
        lineById,
        segmentById,
        circleById
      )}`;
    }
    return line
      ? `line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}`
      : `line ${ref.id}`;
  }
  if (ref.type === "segment") {
    const seg = segmentById.get(ref.id);
    return seg
      ? `segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}`
      : `segment ${ref.id}`;
  }
  const circle = circleById.get(ref.id);
  return circle
    ? `circle centered at ${pointLabel(circle.centerId, pointNameById)} through ${pointLabel(circle.throughId, pointNameById)}`
    : `circle ${ref.id}`;
}

function pointLabel(pointId: string, pointNameById: Map<string, string>): string {
  return pointNameById.get(pointId) ?? pointId;
}

function getGroupIdForTool(tool: ActiveTool): ToolGroupId | null {
  for (const group of TOOL_GROUPS) {
    if (group.tools.includes(tool)) return group.id;
  }
  return null;
}

type ToolGroupButtonProps = {
  groupId: ToolGroupId;
  mainTool: ActiveTool;
  tools: ActiveTool[];
  activeTool: ActiveTool;
  flyoutOpen: boolean;
  onOpenFlyout: () => void;
  onCloseFlyout: () => void;
  onSelectTool: (tool: ActiveTool) => void;
};

function ToolGroupButton({
  groupId,
  mainTool,
  tools,
  activeTool,
  flyoutOpen,
  onOpenFlyout,
  onCloseFlyout,
  onSelectTool,
}: ToolGroupButtonProps) {
  const mainDef = TOOL_REGISTRY[mainTool];
  const MainIcon = mainDef.icon;
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOpenedRef = useRef(false);

  const clearPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    clearPressTimer();
    longPressOpenedRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressOpenedRef.current = true;
      onOpenFlyout();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const openedByLongPress = longPressOpenedRef.current;
    clearPressTimer();
    if (!openedByLongPress) {
      if (activeTool === mainTool) {
        if (flyoutOpen) onCloseFlyout();
        else onOpenFlyout();
      } else {
        onCloseFlyout();
        onSelectTool(mainTool);
      }
    }
    longPressOpenedRef.current = false;
  };

  const onContextMenu = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    clearPressTimer();
    longPressOpenedRef.current = false;
    onOpenFlyout();
  };

  const flyoutTools = tools.filter((tool) => tool !== mainTool);

  return (
    <div className="toolGroupWrap" data-group-id={groupId}>
      <div className="toolButtonWrap">
        <button
          type="button"
          className={activeTool === mainTool ? "toolIconButton active" : "toolIconButton"}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={clearPressTimer}
          onPointerLeave={clearPressTimer}
          onContextMenu={onContextMenu}
          onClick={(e) => {
            if (e.detail !== 0) return;
            onCloseFlyout();
            onSelectTool(mainTool);
          }}
          aria-label={mainDef.ariaLabel}
        >
          <MainIcon size={18} strokeWidth={2} />
        </button>
        <span className="toolTooltip" role="tooltip">
          {mainDef.tooltip}
        </span>
      </div>

      {flyoutOpen && flyoutTools.length > 0 && (
        <div className="toolFlyout" role="menu" aria-label={`${groupId} tools`}>
          {flyoutTools.map((tool) => {
            const def = TOOL_REGISTRY[tool];
            const Icon = def.icon;
            return (
              <div key={tool} className="toolButtonWrap">
                <button
                  type="button"
                  className={activeTool === tool ? "toolIconButton active" : "toolIconButton"}
                  onClick={() => {
                    onSelectTool(tool);
                    onCloseFlyout();
                  }}
                  aria-label={def.ariaLabel}
                  role="menuitem"
                >
                  <Icon size={18} strokeWidth={2} />
                </button>
                <span className="toolTooltip" role="tooltip">
                  {def.tooltip}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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

function getViewportFromCamera(
  camera: Camera,
  leftPanelPx: number,
  rightPanelPx: number
): { xmin: number; xmax: number; ymin: number; ymax: number } | undefined {
  if (typeof window === "undefined") return undefined;
  const widthPx = Math.max(240, window.innerWidth - leftPanelPx - rightPanelPx);
  const heightPx = Math.max(180, window.innerHeight);
  const halfWorldW = widthPx / (2 * Math.max(1e-6, camera.zoom));
  const halfWorldH = heightPx / (2 * Math.max(1e-6, camera.zoom));
  return {
    xmin: camera.pos.x - halfWorldW,
    xmax: camera.pos.x + halfWorldW,
    ymin: camera.pos.y - halfWorldH,
    ymax: camera.pos.y + halfWorldH,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function PerpendicularIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  const w = size;
  const h = size;
  return (
    <svg viewBox="0 0 24 24" width={w} height={h} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M4 6h14" strokeLinecap="round" />
      <path d="M10 6v12" strokeLinecap="round" />
      <path d="M10 14h8" strokeLinecap="round" />
    </svg>
  );
}
