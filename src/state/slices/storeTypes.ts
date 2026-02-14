import type { Vec2 } from "../../geo/vec2";
import type {
  AngleStyle,
  CircleStyle,
  GeometryObjectRef,
  LineLikeObjectRef,
  LineStyle,
  PointStyle,
  PolygonStyle,
  SceneModel,
  SceneNumberDefinition,
  ScenePoint,
  ShowLabelMode,
} from "../../scene/points";
import type { Camera, Viewport } from "../../view/camera";

export type ActiveTool =
  | "move"
  | "point"
  | "copyStyle"
  | "midpoint"
  | "segment"
  | "line2p"
  | "circle_cp"
  | "circle_3p"
  | "circle_fixed"
  | "polygon"
  | "sector"
  | "perp_line"
  | "parallel_line"
  | "tangent_line"
  | "angle_bisector"
  | "angle"
  | "angle_fixed"
  | "export_clip";

export type SelectedObject =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line"; id: string }
  | { type: "circle"; id: string }
  | { type: "polygon"; id: string }
  | { type: "angle"; id: string }
  | { type: "number"; id: string }
  | null;

export type HoveredHit =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line2p"; id: string }
  | { type: "circle"; id: string }
  | { type: "polygon"; id: string }
  | { type: "angle"; id: string }
  | null;

export type PendingSelection =
  | {
    tool: "perp_line" | "parallel_line";
    step: 2;
    first:
    | { type: "point"; id: string }
    | { type: "lineLike"; ref: LineLikeObjectRef };
  }
  | {
    tool: "tangent_line";
    step: 2;
    first:
    | { type: "point"; id: string }
    | { type: "circle"; id: string };
  }
  | {
    tool: "angle_bisector";
    step: 2;
    first: { type: "point"; id: string };
  }
  | {
    tool: "angle_bisector";
    step: 3;
    first: { type: "point"; id: string };
    second: { type: "point"; id: string };
  }
  | {
    tool: "segment" | "line2p" | "circle_cp" | "midpoint";
    step: 2;
    first: { type: "point"; id: string };
  }
  | {
    tool: "polygon";
    step: 2;
    points: Array<{ type: "point"; id: string }>;
  }
  | {
    tool: "circle_3p";
    step: 2;
    first: { type: "point"; id: string };
  }
  | {
    tool: "circle_3p";
    step: 3;
    first: { type: "point"; id: string };
    second: { type: "point"; id: string };
  }
  | {
    tool: "circle_fixed";
    step: 2;
    first: { type: "point"; id: string };
  }
  | {
    tool: "sector";
    step: 2;
    first: { type: "point"; id: string };
  }
  | {
    tool: "sector";
    step: 3;
    first: { type: "point"; id: string };
    second: { type: "point"; id: string };
  }
  | {
    tool: "angle";
    step: 2;
    first: { type: "point"; id: string };
  }
  | {
    tool: "angle";
    step: 3;
    first: { type: "point"; id: string };
    second: { type: "point"; id: string };
  }
  | {
    tool: "angle_fixed";
    step: 2;
    first: { type: "point"; id: string };
  }
  | {
    tool: "angle_fixed";
    step: 3;
    first: { type: "point"; id: string };
    second: { type: "point"; id: string };
  }
  | {
    tool: "export_clip";
    step: 2;
    points: Array<{ type: "world"; world: Vec2 }>;
  }
  | null;

export type ExportClipWorld =
  | { kind: "rect"; xmin: number; xmax: number; ymin: number; ymax: number }
  | { kind: "polygon"; points: Vec2[] };

export type AngleFixedDirection = "CCW" | "CW";

export type GeoState = {
  camera: Camera;
  gridEnabled: boolean;
  axesEnabled: boolean;
  gridSnapEnabled: boolean;
  activeTool: ActiveTool;
  scene: SceneModel;
  selectedObject: SelectedObject;
  recentCreatedObject: SelectedObject;
  hoveredHit: HoveredHit;
  cursorWorld: Vec2 | null;
  pendingSelection: PendingSelection;
  nextPointId: number;
  nextSegmentId: number;
  nextLineId: number;
  nextCircleId: number;
  nextPolygonId: number;
  nextAngleId: number;
  nextNumberId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  polygonDefaults: PolygonStyle;
  angleDefaults: AngleStyle;
  angleFixedTool: {
    angleExpr: string;
    direction: AngleFixedDirection;
  };
  circleFixedTool: {
    radius: string;
  };
  dependencyGlowEnabled: boolean;
  exportClipWorld: ExportClipWorld | null;
  copyStyle: {
    source: SelectedObject;
    pointStyle: PointStyle | null;
    lineStyle: LineStyle | null;
    circleStyle: CircleStyle | null;
    polygonStyle: PolygonStyle | null;
    angleStyle: Partial<AngleStyle> | null;
    showLabel: ShowLabelMode | null;
  };
  canUndo: boolean;
  canRedo: boolean;
};

export type RenameResult = { ok: true; name: string } | { ok: false; error: string };

export type GeoActions = {
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedObject: (selected: SelectedObject) => void;
  setHoveredHit: (hit: HoveredHit) => void;
  setCursorWorld: (world: Vec2 | null) => void;
  setPendingSelection: (next: PendingSelection) => void;
  clearPendingSelection: () => void;
  panByScreenDelta: (delta: Vec2) => void;
  zoomAtScreenPoint: (vp: Viewport, pScreen: Vec2, zoomFactor: number) => void;
  fitViewToScene: (vp: Viewport) => void;

  createFreePoint: (world: Vec2) => string;
  createMidpointFromPoints: (aId: string, bId: string) => string | null;
  createMidpointFromSegment: (segId: string) => string | null;
  createSegment: (aId: string, bId: string) => string | null;
  createLine: (aId: string, bId: string) => string | null;
  createPerpendicularLine: (throughId: string, base: LineLikeObjectRef) => string | null;
  createParallelLine: (throughId: string, base: LineLikeObjectRef) => string | null;
  createTangentLines: (throughId: string, circleId: string) => string[];
  createAngleBisectorLine: (aId: string, bId: string, cId: string) => string | null;
  createAngle: (aId: string, bId: string, cId: string) => string | null;
  createSector: (centerId: string, startId: string, endId: string) => string | null;
  createAngleFixed: (
    vertexId: string,
    basePointId: string,
    angleExpr: string,
    direction: AngleFixedDirection
  ) => { pointId: string; lineId: string; angleId: string } | null;
  createCircle: (centerId: string, throughId: string) => string | null;
  createAuxiliaryCircle: (centerId: string, throughId: string) => string | null;
  createCircleThreePoint: (aId: string, bId: string, cId: string) => string | null;
  createCircleFixedRadius: (centerId: string, radiusExpr: string) => string | null;
  createPolygon: (pointIds: string[]) => string | null;
  createPointOnLine: (lineId: string, s: number) => string | null;
  createPointOnSegment: (segId: string, u: number) => string | null;
  createPointOnCircle: (circleId: string, t: number) => string | null;
  createPointByRotation: (
    centerId: string,
    basePointId: string,
    angleDeg: number,
    direction: AngleFixedDirection,
    angleExpr?: string
  ) => string | null;
  createCircleCenterPoint: (circleId: string) => string | null;
  createIntersectionPoint: (objA: GeometryObjectRef, objB: GeometryObjectRef, preferredWorld: Vec2) => string | null;
  createNumber: (definition: SceneNumberDefinition, preferredName?: string) => string | null;

  movePointTo: (id: string, world: Vec2) => void;
  movePointLabelBy: (id: string, deltaPx: Vec2) => void;
  moveAngleLabelTo: (id: string, world: Vec2) => void;

  setPointDefaults: (next: Partial<PointStyle>) => void;
  setSegmentDefaults: (next: Partial<LineStyle>) => void;
  setLineDefaults: (next: Partial<LineStyle>) => void;
  setCircleDefaults: (next: Partial<CircleStyle>) => void;
  setPolygonDefaults: (next: Partial<PolygonStyle>) => void;
  setAngleDefaults: (next: Partial<AngleStyle>) => void;
  setAngleFixedTool: (next: Partial<GeoState["angleFixedTool"]>) => void;
  setCircleFixedTool: (next: Partial<GeoState["circleFixedTool"]>) => void;
  setGridEnabled: (enabled: boolean) => void;
  setAxesEnabled: (enabled: boolean) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setDependencyGlowEnabled: (enabled: boolean) => void;
  setExportClipWorld: (clip: ExportClipWorld | null) => void;
  clearExportClipWorld: () => void;
  updateSelectedPointStyle: (next: Partial<PointStyle>) => void;
  updateSelectedPointFields: (
    next: Partial<Pick<ScenePoint, "captionTex" | "visible" | "showLabel" | "locked" | "auxiliary">>
  ) => void;
  updateSelectedSegmentStyle: (next: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (next: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (next: Partial<CircleStyle>) => void;
  updateSelectedPolygonStyle: (next: Partial<PolygonStyle>) => void;
  updateSelectedAngleStyle: (next: Partial<AngleStyle>) => void;
  updateSelectedSegmentFields: (next: Partial<Pick<SceneModel["segments"][number], "visible" | "showLabel">>) => void;
  updateSelectedLineFields: (next: Partial<Pick<SceneModel["lines"][number], "visible">>) => void;
  updateSelectedCircleFields: (next: Partial<Pick<SceneModel["circles"][number], "visible">>) => void;
  updateSelectedPolygonFields: (next: Partial<Pick<SceneModel["polygons"][number], "visible">>) => void;
  updateSelectedAngleFields: (next: Partial<Pick<SceneModel["angles"][number], "visible">>) => void;
  setObjectVisibility: (
    obj: Exclude<SelectedObject, null>,
    visible: boolean
  ) => void;

  renameSelectedPoint: (nextNameRaw: string) => RenameResult;
  deleteSelectedObject: () => void;
  setCopyStyleSource: (obj: Exclude<SelectedObject, null>) => void;
  applyCopyStyleTo: (obj: Exclude<SelectedObject, null>) => void;
  clearCopyStyle: () => void;
  undo: () => void;
  redo: () => void;
  loadSnapshot: (snapshot: import("./historySlice").HistorySnapshot) => void;
};

export type GeoStore = GeoState & GeoActions;
