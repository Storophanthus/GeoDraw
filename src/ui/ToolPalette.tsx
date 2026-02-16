import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import type { ActiveTool } from "../state/geoStore";
import {
  IconAngle,
  IconAngleFixed,
  IconBisector,
  IconCircle3Point,
  IconCircleCenterPoint,
  IconCircleRadius,
  IconCopyStyle,
  IconExportClip,
  IconLine,
  IconMidpoint,
  IconMove,
  IconParallel,
  IconPerpendicular,
  IconPoint,
  IconPolygon,
  IconRegularPolygon,
  IconSector,
  IconSegment,
  IconSidebarPanelLeft,
  IconSidebarPanelRight,
  IconTangent,
  IconTranslate,
  IconReflect,
  IconDilate,
} from "./icons";

type IconProps = {
  size?: number;
  strokeWidth?: number;
};

type ToolDef = {
  icon: ComponentType<IconProps>;
  tooltip: string;
  ariaLabel: string;
};

type ToolGroupId = "move" | "points" | "transform" | "lines" | "angle" | "circles" | "styles";

const TOOL_REGISTRY: Record<ActiveTool, ToolDef> = {
  move: { icon: IconMove, tooltip: "Move / Select (V)", ariaLabel: "Move tool" },
  point: { icon: IconPoint, tooltip: "Point (P)", ariaLabel: "Point tool" },
  translate: { icon: IconTranslate, tooltip: "Translate Object", ariaLabel: "Translate tool" },
  reflect: { icon: IconReflect, tooltip: "Reflect Object", ariaLabel: "Reflect tool" },
  dilate: { icon: IconDilate, tooltip: "Dilate Object", ariaLabel: "Dilate tool" },
  copyStyle: { icon: IconCopyStyle, tooltip: "Copy Style (C)", ariaLabel: "Copy style tool" },
  export_clip: { icon: IconExportClip, tooltip: "Export Clip Rectangle", ariaLabel: "Export clip tool" },
  midpoint: { icon: IconMidpoint, tooltip: "Midpoint (M)", ariaLabel: "Midpoint tool" },
  segment: { icon: IconSegment, tooltip: "Segment (S)", ariaLabel: "Segment tool" },
  line2p: { icon: IconLine, tooltip: "Line Through 2 Points (L)", ariaLabel: "Line tool" },
  perp_line: { icon: IconPerpendicular, tooltip: "Perpendicular Line", ariaLabel: "Perpendicular line tool" },
  parallel_line: { icon: IconParallel, tooltip: "Parallel Line", ariaLabel: "Parallel line tool" },
  tangent_line: { icon: IconTangent, tooltip: "Tangent Line", ariaLabel: "Tangent line tool" },
  angle: { icon: IconAngle, tooltip: "Angle (deg)", ariaLabel: "Angle tool" },
  angle_fixed: { icon: IconAngleFixed, tooltip: "Angle with Fixed Value (deg)", ariaLabel: "Fixed angle tool" },
  angle_bisector: { icon: IconBisector, tooltip: "Internal Angle Bisector", ariaLabel: "Angle bisector tool" },
  circle_cp: { icon: IconCircleCenterPoint, tooltip: "Circle Center + Point (O)", ariaLabel: "Circle center-through-point tool" },
  circle_3p: { icon: IconCircle3Point, tooltip: "Circle through 3 Points", ariaLabel: "Circle through three points tool" },
  circle_fixed: { icon: IconCircleRadius, tooltip: "Circle with Fixed Radius", ariaLabel: "Circle with fixed radius tool" },
  polygon: { icon: IconPolygon, tooltip: "Polygon", ariaLabel: "Polygon tool" },
  regular_polygon: { icon: IconRegularPolygon, tooltip: "Regular Polygon", ariaLabel: "Regular polygon tool" },
  sector: { icon: IconSector, tooltip: "Circular Sector", ariaLabel: "Circular sector tool" },
};

const TOOL_GROUPS: Array<{ id: ToolGroupId; label: string; tools: ActiveTool[] }> = [
  { id: "move", label: "MOVE", tools: ["move", "export_clip"] },
  { id: "points", label: "POINTS", tools: ["point", "midpoint"] },
  { id: "lines", label: "LINES", tools: ["segment", "line2p", "perp_line", "parallel_line", "tangent_line", "angle_bisector"] },
  { id: "angle", label: "ANGLE", tools: ["angle", "angle_fixed"] },
  { id: "circles", label: "SHAPES", tools: ["circle_cp", "circle_3p", "circle_fixed", "sector", "polygon", "regular_polygon"] },
  { id: "transform", label: "TRANSFORM", tools: ["translate", "reflect", "dilate"] },
  { id: "styles", label: "STYLES", tools: ["copyStyle"] },
];

type ToolPaletteProps = {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  leftCollapsed: boolean;
  setLeftCollapsed: (next: boolean) => void;
  leftWidth: number;
  collapsedWidth: number;
  onFlyoutVisibilityChange?: (open: boolean) => void;
};

export function ToolPalette({
  activeTool,
  onSelectTool,
  leftCollapsed,
  setLeftCollapsed,
  leftWidth,
  collapsedWidth,
  onFlyoutVisibilityChange,
}: ToolPaletteProps) {
  const [openFlyoutGroup, setOpenFlyoutGroup] = useState<ToolGroupId | null>(null);
  const [groupLastSelected, setGroupLastSelected] = useState<Record<ToolGroupId, ActiveTool>>({
    move: "move",
    points: "point",
    transform: "translate",
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

  useEffect(() => {
    onFlyoutVisibilityChange?.(openFlyoutGroup !== null);
  }, [openFlyoutGroup, onFlyoutVisibilityChange]);

  return (
    <aside
      ref={toolbarRef}
      className={leftCollapsed ? "leftToolbar collapsed" : "leftToolbar"}
      style={{ width: leftCollapsed ? collapsedWidth : leftWidth }}
      aria-label="Tools"
    >
      {leftCollapsed ? (
        <button
          className="sidebarToggleButton"
          onClick={() => setLeftCollapsed(false)}
          aria-label="Expand left sidebar"
        >
          <IconSidebarPanelRight size={16} strokeWidth={2} />
        </button>
      ) : (
        <>
          <button
            className="sidebarToggleButton"
            onClick={() => {
              setOpenFlyoutGroup(null);
              setLeftCollapsed(true);
            }}
            aria-label="Collapse left sidebar"
          >
            <IconSidebarPanelLeft size={16} strokeWidth={2} />
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

  const flyoutTools = tools.filter((tool) => tool !== mainTool);
  const hasFlyout = flyoutTools.length > 0;

  return (
    <div
      className="toolGroupWrap"
      data-group-id={groupId}
      onMouseEnter={() => {
        if (hasFlyout) onOpenFlyout();
      }}
      onMouseLeave={() => onCloseFlyout()}
    >
      <div className={flyoutOpen ? "toolButtonWrap suppressTooltip" : "toolButtonWrap"}>
        <button
          type="button"
          className={activeTool === mainTool ? "toolIconButton active" : "toolIconButton"}
          onClick={() => {
            onCloseFlyout();
            onSelectTool(mainTool);
          }}
          onFocus={() => {
            if (hasFlyout) onOpenFlyout();
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
