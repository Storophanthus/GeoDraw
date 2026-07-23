import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useGeoStore, type ActiveTool } from "../state/geoStore";
import { persistCurrentConstructionPreferences } from "../state/constructionPreferencesSync";
import { COLOR_PROFILE_OPTIONS, getColorProfile } from "../state/colorProfiles";
import { ConstructionProfileSwatch } from "./ConstructionProfileSwatch";
import { ToolGroupButton } from "./ToolGroupButton";
import { toRgba } from "./colorUtils";
import { MousePointer2, Paintbrush, Type, Crop, Scissors, Hash } from "lucide-react";
import {
  IconAngle,
  IconAngleFixed,
  IconBisector,
  IconCircle3Point,
  IconCircleCenterPoint,
  IconCircleRadius,
  IconEllipseFociPoint,
  IconLine,
  IconMidpoint,
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
  IconRotate,
  IconReflect,
  IconDilate,
  IconInvert,
} from "./icons";

type IconProps = {
  size?: number;
  strokeWidth?: number;
};

function IconTextbox({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M7 9h10" />
      <path d="M7 13h6" />
    </svg>
  );
}

export type ToolDef = {
  icon: ComponentType<IconProps>;
  tooltip: string;
  ariaLabel: string;
};

export type ToolGroupId = "move" | "points" | "transform" | "lines" | "angle" | "circles" | "styles";

export const TOOL_REGISTRY: Record<ActiveTool, ToolDef> = {
  move: { icon: MousePointer2, tooltip: "Move / Select (V)", ariaLabel: "Move tool" },
  point: { icon: IconPoint, tooltip: "Point (P)", ariaLabel: "Point tool" },
  translate: { icon: IconTranslate, tooltip: "Translate Object", ariaLabel: "Translate tool" },
  rotate: { icon: IconRotate, tooltip: "Rotate Object", ariaLabel: "Rotate tool" },
  reflect: { icon: IconReflect, tooltip: "Reflect Object", ariaLabel: "Reflect tool" },
  dilate: { icon: IconDilate, tooltip: "Homothety (Dilate)", ariaLabel: "Dilate tool" },
  invert: { icon: IconInvert, tooltip: "Invert Point/Line/Circle", ariaLabel: "Invert tool" },
  copyStyle: { icon: Paintbrush, tooltip: "Copy Style (C)", ariaLabel: "Copy style tool" },
  label: { icon: Type, tooltip: "Label Tool", ariaLabel: "Label tool" },
  textbox: { icon: IconTextbox, tooltip: "Textbox Tool", ariaLabel: "Textbox tool" },
  export_clip_rect: { icon: Crop, tooltip: "Crop Area – Box", ariaLabel: "Crop area (box) tool" },
  export_clip: { icon: Scissors, tooltip: "Crop Area – Freeform", ariaLabel: "Crop area (freeform) tool" },
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
  ellipse_foci_point: { icon: IconEllipseFociPoint, tooltip: "Ellipse: 2 Foci + Point", ariaLabel: "Ellipse foci-through-point tool" },
  polygon: { icon: IconPolygon, tooltip: "Polygon", ariaLabel: "Polygon tool" },
  regular_polygon: { icon: IconRegularPolygon, tooltip: "Regular Polygon", ariaLabel: "Regular polygon tool" },
  sector: { icon: IconSector, tooltip: "Circular Sector", ariaLabel: "Circular sector tool" },
};

const TOOL_GROUPS: Array<{ id: ToolGroupId; label: string; tools: ActiveTool[] }> = [
  { id: "move", label: "MOVE", tools: ["move", "export_clip_rect", "export_clip"] },
  { id: "points", label: "POINTS", tools: ["point", "midpoint"] },
  { id: "lines", label: "LINES", tools: ["segment", "line2p", "perp_line", "parallel_line", "tangent_line", "angle_bisector"] },
  { id: "angle", label: "ANGLE", tools: ["angle", "angle_fixed"] },
  { id: "circles", label: "SHAPES", tools: ["circle_cp", "circle_3p", "circle_fixed", "ellipse_foci_point", "sector", "polygon", "regular_polygon"] },
  { id: "transform", label: "TRANSFORM", tools: ["translate", "rotate", "reflect", "dilate", "invert"] },
  { id: "styles", label: "STYLES", tools: ["copyStyle", "label", "textbox"] },
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
  const colorProfileId = useGeoStore((store) => store.colorProfileId);
  const setColorProfile = useGeoStore((store) => store.setColorProfile);
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const createNumber = useGeoStore((store) => store.createNumber);
  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const activeProfilePalette = getColorProfile(colorProfileId).palette;
  const [openFlyoutGroup, setOpenFlyoutGroup] = useState<ToolGroupId | null>(null);
  const [profileFlyoutOpen, setProfileFlyoutOpen] = useState(false);
  const [numberFlyoutOpen, setNumberFlyoutOpen] = useState(false);
  const [numberName, setNumberName] = useState("");
  const [numberValue, setNumberValue] = useState("1");
  const [numberMin, setNumberMin] = useState("0");
  const [numberMax, setNumberMax] = useState("10");
  const [numberStep, setNumberStep] = useState("0.1");
  const [numberMode, setNumberMode] = useState<"real" | "degree">("real");
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
        setProfileFlyoutOpen(false);
        setNumberFlyoutOpen(false);
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
      if (e.key === "Escape" && (openFlyoutGroup || profileFlyoutOpen || numberFlyoutOpen)) {
        e.preventDefault();
        setOpenFlyoutGroup(null);
        setProfileFlyoutOpen(false);
        setNumberFlyoutOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [numberFlyoutOpen, openFlyoutGroup, profileFlyoutOpen]);

  useEffect(() => {
    onFlyoutVisibilityChange?.(openFlyoutGroup !== null || profileFlyoutOpen || numberFlyoutOpen);
  }, [numberFlyoutOpen, openFlyoutGroup, onFlyoutVisibilityChange, profileFlyoutOpen]);

  const createAndSelectNumber = (
    definition:
      | { kind: "slider"; value: number; min: number; max: number; step: number; sliderMode?: "real" | "degree" | "radian" }
      | { kind: "segmentLength"; segId: string }
      | { kind: "circleRadius"; circleId: string }
      | { kind: "circleArea"; circleId: string }
      | { kind: "polygonPerimeter"; polygonId: string }
      | { kind: "polygonArea"; polygonId: string }
      | { kind: "angleDegrees"; angleId: string },
    preferredName?: string
  ) => {
    const id = createNumber(definition, preferredName);
    if (!id) return;
    setSelectedObject({ type: "number", id });
    setNumberName("");
    setNumberFlyoutOpen(false);
  };

  const handleCreateSlider = () => {
    const value = Number(numberValue);
    const min = Number(numberMin);
    const max = Number(numberMax);
    const step = Number(numberStep);
    if (![value, min, max, step].every(Number.isFinite)) return;
    if (!(step > 0)) return;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    createAndSelectNumber({
      kind: "slider",
      value: Math.min(hi, Math.max(lo, value)),
      min: lo,
      max: hi,
      step,
      sliderMode: numberMode,
    }, numberName);
  };

  const selectedSegmentId = selectedObject?.type === "segment" ? selectedObject.id : null;
  const selectedCircleId = selectedObject?.type === "circle" ? selectedObject.id : null;
  const selectedPolygonId = selectedObject?.type === "polygon" ? selectedObject.id : null;
  const selectedAngleId = selectedObject?.type === "angle" ? selectedObject.id : null;

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
              setProfileFlyoutOpen(false);
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

          <div className="toolGroupBlock toolNumberSection">
            <div className="toolGroupDivider" />
            <div className="toolGroupLabel">VALUE</div>
            <div className="toolGroupWrap">
              <div className={numberFlyoutOpen ? "toolButtonWrap suppressTooltip" : "toolButtonWrap"}>
                <button
                  type="button"
                  className={numberFlyoutOpen ? "toolIconButton active" : "toolIconButton"}
                  onClick={() => {
                    setOpenFlyoutGroup(null);
                    setProfileFlyoutOpen(false);
                    setNumberFlyoutOpen((prev) => !prev);
                  }}
                  aria-label="Number tools"
                >
                  <Hash size={18} strokeWidth={2} />
                </button>
                <span className="toolTooltip" role="tooltip">
                  Number tools
                </span>
              </div>
            </div>
          </div>

          <div className="toolGroupBlock toolProfileSection">
            <div className="toolGroupDivider" />
            <div className="toolGroupLabel">PALETTE</div>
            <div
              className="toolGroupWrap profileGroupWrap"
              onMouseEnter={() => setProfileFlyoutOpen(true)}
              onMouseLeave={() => setProfileFlyoutOpen(false)}
            >
              <div className={profileFlyoutOpen ? "toolButtonWrap suppressTooltip" : "toolButtonWrap"}>
                <button
                  type="button"
                  className="profileSwatchButton active"
                  onFocus={() => setProfileFlyoutOpen(true)}
                  aria-label="Color palette"
                  style={
                    {
                      "--profile-active-border": activeProfilePalette.lineStroke,
                      "--profile-active-halo": toRgba(activeProfilePalette.backgroundColor, 0.9),
                    } as CSSProperties
                  }
                >
                  <ConstructionProfileSwatch profileId={colorProfileId} />
                </button>
                <span className="toolTooltip" role="tooltip">
                  Color palette
                </span>
              </div>
              {profileFlyoutOpen && (
                <div className="toolFlyout profilePaletteFlyout" role="menu" aria-label="Color profile options">
                  {COLOR_PROFILE_OPTIONS.filter((option) => option.id !== colorProfileId).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="profileSwatchButton"
                      onClick={() => {
                        setColorProfile(option.id);
                        persistCurrentConstructionPreferences();
                        setProfileFlyoutOpen(false);
                      }}
                      title={option.label}
                      aria-label={`Color profile: ${option.label}`}
                      role="menuitem"
                    >
                      <ConstructionProfileSwatch profileId={option.id} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {numberFlyoutOpen && (
        <div
          className="toolModalBackdrop"
          onMouseDown={() => setNumberFlyoutOpen(false)}
          role="presentation"
        >
          <div
            className="toolModalCard toolQuickPanel"
            role="dialog"
            aria-modal="true"
            aria-label="Number tools"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="toolModalTitle">Number</div>
            <div className="toolQuickGrid">
              <label className="toolQuickField toolQuickFieldFull">
                <span>Name</span>
                <input
                  className="renameInput"
                  type="text"
                  value={numberName}
                  onChange={(e) => setNumberName(e.target.value)}
                  placeholder="auto"
                />
              </label>
              <label className="toolQuickField">
                <span>Val</span>
                <input
                  className="renameInput"
                  type="text"
                  value={numberValue}
                  onChange={(e) => setNumberValue(e.target.value)}
                  placeholder="1"
                />
              </label>
              <label className="toolQuickField">
                <span>Type</span>
                <select
                  className="selectInput"
                  value={numberMode}
                  onChange={(e) => setNumberMode(e.target.value === "degree" ? "degree" : "real")}
                >
                  <option value="real">Real</option>
                  <option value="degree">Deg</option>
                </select>
              </label>
              <label className="toolQuickField">
                <span>Min</span>
                <input
                  className="renameInput"
                  type="text"
                  value={numberMin}
                  onChange={(e) => setNumberMin(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="toolQuickField">
                <span>Max</span>
                <input
                  className="renameInput"
                  type="text"
                  value={numberMax}
                  onChange={(e) => setNumberMax(e.target.value)}
                  placeholder={numberMode === "degree" ? "360" : "10"}
                />
              </label>
              <label className="toolQuickField toolQuickFieldFull">
                <span>Step</span>
                <input
                  className="renameInput"
                  type="text"
                  value={numberStep}
                  onChange={(e) => setNumberStep(e.target.value)}
                  placeholder={numberMode === "degree" ? "1" : "0.1"}
                />
              </label>
            </div>
            <div className="toolQuickActions">
              <button type="button" className="actionButton secondary" onClick={handleCreateSlider}>
                Add
              </button>
              {selectedSegmentId && (
                <button
                  type="button"
                  className="actionButton secondary"
                  onClick={() => createAndSelectNumber({ kind: "segmentLength", segId: selectedSegmentId }, numberName)}
                >
                  Len
                </button>
              )}
              {selectedCircleId && (
                <button
                  type="button"
                  className="actionButton secondary"
                  onClick={() => createAndSelectNumber({ kind: "circleRadius", circleId: selectedCircleId }, numberName)}
                >
                  Rad
                </button>
              )}
              {selectedCircleId && (
                <button
                  type="button"
                  className="actionButton secondary"
                  onClick={() => createAndSelectNumber({ kind: "circleArea", circleId: selectedCircleId }, numberName)}
                >
                  Area
                </button>
              )}
              {selectedPolygonId && (
                <button
                  type="button"
                  className="actionButton secondary"
                  onClick={() => createAndSelectNumber({ kind: "polygonPerimeter", polygonId: selectedPolygonId }, numberName)}
                >
                  Perim
                </button>
              )}
              {selectedPolygonId && (
                <button
                  type="button"
                  className="actionButton secondary"
                  onClick={() => createAndSelectNumber({ kind: "polygonArea", polygonId: selectedPolygonId }, numberName)}
                >
                  Area
                </button>
              )}
              {selectedAngleId && (
                <button
                  type="button"
                  className="actionButton secondary"
                  onClick={() => createAndSelectNumber({ kind: "angleDegrees", angleId: selectedAngleId }, numberName)}
                >
                  Ang
                </button>
              )}
            </div>
          </div>
        </div>
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
