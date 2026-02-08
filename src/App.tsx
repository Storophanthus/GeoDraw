import {
  Circle,
  ChevronLeft,
  ChevronRight,
  Dot,
  GitMerge,
  Minus,
  MousePointer2,
  Paintbrush2,
  Slash,
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
import { getPointWorldPos, type PointShape } from "./scene/points";
import { useGeoStore, type ActiveTool } from "./state/geoStore";
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

const TOOL_REGISTRY: Record<ActiveTool, ToolDef> = {
  move: { icon: MousePointer2, tooltip: "Move / Select (V)", ariaLabel: "Move tool" },
  point: { icon: Dot, tooltip: "Point (P)", ariaLabel: "Point tool" },
  copyStyle: { icon: Paintbrush2, tooltip: "Copy Style (C)", ariaLabel: "Copy style tool" },
  midpoint: { icon: GitMerge, tooltip: "Midpoint (M)", ariaLabel: "Midpoint tool" },
  segment: { icon: Minus, tooltip: "Segment (S)", ariaLabel: "Segment tool" },
  line2p: { icon: Slash, tooltip: "Line Through 2 Points (L)", ariaLabel: "Line tool" },
  circle_cp: { icon: Circle, tooltip: "Circle Center + Point (O)", ariaLabel: "Circle center-through-point tool" },
};

const TOOL_GROUPS: Array<{ id: ToolGroupId; label: string; tools: ActiveTool[] }> = [
  { id: "move", label: "MOVE", tools: ["move"] },
  { id: "points", label: "POINTS", tools: ["point", "midpoint"] },
  { id: "lines", label: "LINES", tools: ["segment", "line2p"] },
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
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const renameSelectedPoint = useGeoStore((store) => store.renameSelectedPoint);
  const deleteSelectedObject = useGeoStore((store) => store.deleteSelectedObject);
  const clearCopyStyle = useGeoStore((store) => store.clearCopyStyle);
  const copyStyle = useGeoStore((store) => store.copyStyle);
  const pointDefaults = useGeoStore((store) => store.pointDefaults);
  const setPointDefaults = useGeoStore((store) => store.setPointDefaults);
  const updateSelectedPointStyle = useGeoStore((store) => store.updateSelectedPointStyle);
  const updateSelectedPointFields = useGeoStore((store) => store.updateSelectedPointFields);

  const selectedPointId = selectedObject?.type === "point" ? selectedObject.id : null;
  const selectedNonPointType =
    selectedObject && selectedObject.type !== "point" ? selectedObject.type : null;
  const selectedPoint = useMemo(
    () => scene.points.find((point) => point.id === selectedPointId) ?? null,
    [scene.points, selectedPointId]
  );
  const selectedPointWorld = useMemo(() => {
    if (!selectedPoint) return null;
    return getPointWorldPos(selectedPoint, scene);
  }, [scene, selectedPoint]);

  const [nameInput, setNameInput] = useState("");
  const [renameError, setRenameError] = useState("");
  const [shapePickerOpen, setShapePickerOpen] = useState(false);

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

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedObject();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, clearCopyStyle, deleteSelectedObject, openFlyoutGroup, setActiveTool]);

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
              <h2 className="sectionTitle">Algebra</h2>
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
            </section>

            <section className="sidebarSection">
              <h2 className="sectionTitle">Properties</h2>
              {activeTool === "copyStyle" && (
                <div className="toolInfo">
                  {copyStyle.source
                    ? "Copy Style: click targets to apply (Shift-click to change source)"
                    : "Copy Style: click an object to pick source (Shift-click anytime to change source)"}
                </div>
              )}
              {!selectedPoint && !selectedNonPointType && (
                <div className="emptyState">Select a point to edit point properties</div>
              )}
              {!selectedPoint && selectedNonPointType && (
                <div className="emptyState">
                  {selectedNonPointType === "segment"
                    ? "Segment selected. Point properties are shown when a point is selected."
                    : selectedNonPointType === "line"
                      ? "Line selected. Point properties are shown when a point is selected."
                      : "Circle selected. Point properties are shown when a point is selected."}
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
                <div className="subSectionTitle">Defaults For New Points</div>
                <div className="controlRow">
                  <label className="controlLabel">Size</label>
                  <input
                    className="sizeSlider"
                    type="range"
                    min={2}
                    max={18}
                    value={pointDefaults.sizePx}
                    onChange={(e) => setPointDefaults({ sizePx: Number(e.target.value) })}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  );
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
