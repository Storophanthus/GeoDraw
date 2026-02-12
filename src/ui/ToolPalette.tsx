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
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ActiveTool } from "../state/geoStore";

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

const LONG_PRESS_MS = 250;

type ToolPaletteProps = {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  leftCollapsed: boolean;
  setLeftCollapsed: (next: boolean) => void;
  leftWidth: number;
  collapsedWidth: number;
};

export function ToolPalette({
  activeTool,
  onSelectTool,
  leftCollapsed,
  setLeftCollapsed,
  leftWidth,
  collapsedWidth,
}: ToolPaletteProps) {
  const [openFlyoutGroup, setOpenFlyoutGroup] = useState<ToolGroupId | null>(null);
  const [groupLastSelected, setGroupLastSelected] = useState<Record<ToolGroupId, ActiveTool>>({
    move: "move",
    points: "point",
    lines: "segment",
    angle: "angle",
    circles: "circle_cp",
    styles: "copyStyle",
  });

  const toolbarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const groupId = getGroupIdForTool(activeTool);
    if (!groupId) return;
    setGroupLastSelected((prev) => (prev[groupId] === activeTool ? prev : { ...prev, [groupId]: activeTool }));
  }, [activeTool]);

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
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTextInput =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable === true;
      if (isTextInput) return;
      if (e.key === "Escape" && openFlyoutGroup) {
        e.preventDefault();
        setOpenFlyoutGroup(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openFlyoutGroup]);

  return (
    <aside
      ref={toolbarRef}
      className={leftCollapsed ? "leftToolbar collapsed" : "leftToolbar"}
      style={{ width: leftCollapsed ? collapsedWidth : leftWidth }}
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
                    onSelectTool(tool);
                  }}
                />
              </div>
            );
          })}
        </>
      )}
    </aside>
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
