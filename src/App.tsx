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
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ExportPanel } from "./ui/ExportPanel";
import { PropertiesPanel } from "./ui/PropertiesPanel";
import { useGeoStore, type ActiveTool } from "./state/geoStore";
import { CanvasView } from "./view/CanvasView";
import { ObjectBrowser } from "./ui/ObjectBrowser";

type IconProps = {
  size?: number;
  strokeWidth?: number;
};

type ToolDef = {
  icon: ComponentType<IconProps>;
  tooltip: string;
  ariaLabel: string;
};

type ToolGroupId = "move" | "points" | "lines" | "angle" | "circles" | "styles";

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
  parallel_line: { icon: ParallelIcon, tooltip: "Parallel Line", ariaLabel: "Parallel line tool" },
  angle: { icon: AngleIcon, tooltip: "Angle (deg)", ariaLabel: "Angle tool" },
  angle_fixed: { icon: AngleFixedIcon, tooltip: "Angle with Fixed Value (deg)", ariaLabel: "Fixed angle tool" },
  angle_bisector: { icon: AngleBisectorIcon, tooltip: "Internal Angle Bisector", ariaLabel: "Angle bisector tool" },
  circle_cp: { icon: Circle, tooltip: "Circle Center + Point (O)", ariaLabel: "Circle center-through-point tool" },
  circle_3p: { icon: CircleThreePointIcon, tooltip: "Circle through 3 Points", ariaLabel: "Circle through three points tool" },
  circle_fixed: { icon: CircleRadiusIcon, tooltip: "Circle with Fixed Radius", ariaLabel: "Circle with fixed radius tool" },
};

const TOOL_GROUPS: Array<{ id: ToolGroupId; label: string; tools: ActiveTool[] }> = [
  { id: "move", label: "MOVE", tools: ["move"] },
  { id: "points", label: "POINTS", tools: ["point", "midpoint"] },
  { id: "lines", label: "LINES", tools: ["segment", "line2p", "perp_line", "parallel_line", "angle_bisector"] },
  { id: "angle", label: "ANGLE", tools: ["angle", "angle_fixed"] },
  { id: "circles", label: "CIRCLES", tools: ["circle_cp", "circle_3p", "circle_fixed"] },
  { id: "styles", label: "STYLES", tools: ["copyStyle"] },
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
  const deleteSelectedObject = useGeoStore((store) => store.deleteSelectedObject);
  const clearCopyStyle = useGeoStore((store) => store.clearCopyStyle);
  const undo = useGeoStore((store) => store.undo);
  const redo = useGeoStore((store) => store.redo);
  const canUndo = useGeoStore((store) => store.canUndo);
  const canRedo = useGeoStore((store) => store.canRedo);
  const [rightTab, setRightTab] = useState<RightTab>("algebra");

  const [leftWidth, setLeftWidth] = useState(56);
  const [rightWidth, setRightWidth] = useState(312);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [openFlyoutGroup, setOpenFlyoutGroup] = useState<ToolGroupId | null>(null);
  const [groupLastSelected, setGroupLastSelected] = useState<Record<ToolGroupId, ActiveTool>>({
    move: "move",
    points: "point",
    lines: "segment",
    angle: "angle",
    circles: "circle_cp",
    styles: "copyStyle",
  });

  const resizeRef = useRef<ResizeState>({ side: null, startX: 0, leftWidth: 56, rightWidth: 312 });
  const toolbarRef = useRef<HTMLElement | null>(null);

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
              <ObjectBrowser
                scene={scene}
                selectedObject={selectedObject}
                setSelectedObject={setSelectedObject}
              />
            </section>}

            <ExportPanel visible={rightTab === "export"} />
            <PropertiesPanel visible={rightTab === "algebra"} />
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function ParallelIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  const w = size;
  const h = size;
  return (
    <svg viewBox="0 0 24 24" width={w} height={h} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M4 8l14-4" strokeLinecap="round" />
      <path d="M6 16l14-4" strokeLinecap="round" />
    </svg>
  );
}

function AngleIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  const w = size;
  const h = size;
  return (
    <svg viewBox="0 0 24 24" width={w} height={h} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M4 18L12 6L20 18" strokeLinecap="round" />
      <path d="M8.5 15.5a4.5 4.5 0 0 1 7 0" strokeLinecap="round" />
    </svg>
  );
}

function AngleFixedIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  const w = size;
  const h = size;
  return (
    <svg viewBox="0 0 24 24" width={w} height={h} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M4 19h16" />
      <path d="M4 19L11.5 8" />
      <path d="M4 19a8.5 8.5 0 0 1 8.5-8.5" />
      <text x="15.6" y="9.6" fontSize="7.2" fill="currentColor" stroke="none">
        θ
      </text>
    </svg>
  );
}

function AngleBisectorIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  const w = size;
  const h = size;
  return (
    <svg viewBox="0 0 24 24" width={w} height={h} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M4 18L12 6L20 18" strokeLinecap="round" />
      <path d="M12 6L12 18" strokeLinecap="round" />
      <path d="M8.5 15.5a4.5 4.5 0 0 1 7 0" strokeLinecap="round" />
    </svg>
  );
}

function CircleRadiusIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M12 12 L19 12" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function CircleThreePointIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="8" cy="7" r="1.9" fill="currentColor" />
      <circle cx="6.5" cy="14.5" r="1.9" fill="currentColor" />
      <circle cx="16.5" cy="14.5" r="1.9" fill="currentColor" />
    </svg>
  );
}
