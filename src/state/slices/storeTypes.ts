import type { Vec2 } from "../../geo/vec2";
import type {
  AngleStyle,
  CircleStyle,
  GeometryObjectRef,
  LineLikeObjectRef,
  ReflectionObjectRef,
  LineStyle,
  PointStyle,
  PolygonStyle,
  SceneGeometryLayerRef,
  SceneModel,
  SceneNumberDefinition,
  ScenePoint,
  SceneRichTextStyle,
  SceneTextLabelStyle,
  ShowLabelMode,
  TextLabelToolKind,
  TriangleCenterKind,
} from "../../scene/points";
import type { Camera, Viewport } from "../../view/camera";
import type {
  CanvasColorTheme,
  ColorProfileId,
  UiColorProfileId,
  UiCssVariableName,
  UiCssVariables,
} from "../colorProfiles";

export type ActiveTool =
  | "move"
  | "point"
  | "translate"
  | "rotate"
  | "reflect"
  | "dilate"
  | "invert"
  | "copyStyle"
  | "label"
  | "textbox"
  | "midpoint"
  | "segment"
  | "line2p"
  | "circle_cp"
  | "circle_3p"
  | "circle_fixed"
  | "polygon"
  | "regular_polygon"
  | "sector"
  | "perp_line"
  | "parallel_line"
  | "tangent_line"
  | "angle_bisector"
  | "angle"
  | "angle_fixed"
  | "export_clip"
  | "export_clip_rect";

export type SelectedObject =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line"; id: string }
  | { type: "circle"; id: string }
  | { type: "polygon"; id: string }
  | { type: "angle"; id: string }
  | { type: "textLabel"; id: string }
  | { type: "richText"; id: string }
  | { type: "number"; id: string }
  | null;

export type TextEditTarget = {
  type: "textLabel" | "richText";
  id: string;
};

export type TextEditRequest = (TextEditTarget & { requestId: number }) | null;

export type TextClipboardObjectTarget = {
  type: "textLabel" | "richText";
  id: string;
};

export type TextClipboardPayload =
  | {
      type: "textLabel";
      text: string;
      toolKind?: TextLabelToolKind;
      contentMode?: "static" | "number" | "expression";
      numberId?: string;
      expr?: string;
      visible: boolean;
      style: SceneTextLabelStyle;
    }
  | {
      type: "richText";
      visible: boolean;
      document: NonNullable<SceneModel["richTextNodes"]>[number]["document"];
      style: SceneRichTextStyle;
      boundsPx?: NonNullable<SceneModel["richTextNodes"]>[number]["boundsPx"];
    };

export type TextClipboardState = {
  payload: TextClipboardPayload;
  origin: Vec2;
  pasteCount: number;
} | null;

export type HoveredHit =
  | { type: "point"; id: string }
  | { type: "segment"; id: string }
  | { type: "line2p"; id: string }
  | { type: "circle"; id: string }
  | { type: "polygon"; id: string }
  | { type: "angle"; id: string }
  | null;

export type TransformToolMode = "translate" | "rotate" | "dilate" | "reflect" | "invert";

export type TransformableObjectRef = {
  type: "point" | "segment" | "line" | "circle" | "polygon" | "angle";
  id: string;
};

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
    tool: "translate";
    step: 2;
    source: TransformableObjectRef;
  }
  | {
    tool: "translate";
    step: 3;
    source: TransformableObjectRef;
    from: { type: "point"; id: string };
  }
  | {
    tool: "reflect";
    step: 2;
    source: TransformableObjectRef;
  }
  | {
    tool: "rotate";
    step: 2;
    source: TransformableObjectRef;
  }
  | {
    tool: "dilate";
    step: 2;
    source: TransformableObjectRef;
  }
  | {
    tool: "invert";
    step: 2;
    source: TransformableObjectRef;
  }
  | {
    tool: "polygon";
    step: 2;
    points: Array<{ type: "point"; id: string }>;
  }
  | {
    tool: "regular_polygon";
    step: 2;
    first: { type: "point"; id: string };
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
  | {
    tool: "export_clip_rect";
    step: 2;
    first: { type: "world"; world: Vec2 };
  }
  | null;

export type ExportClipWorld =
  | { kind: "rect"; xmin: number; xmax: number; ymin: number; ymax: number }
  | { kind: "polygon"; points: Vec2[] };

export type AngleFixedDirection = "CCW" | "CW";

export type ObjectLabelDefaults = {
  point: ShowLabelMode;
  segment: boolean;
  line: boolean;
  circle: boolean;
  polygon: boolean;
  segmentGlow?: boolean;
  lineGlow?: boolean;
  circleGlow?: boolean;
  polygonGlow?: boolean;
};

export type PropertiesPanelIntent = "object" | "toolDefault";

export type GeoState = {
  camera: Camera;
  colorProfileId: ColorProfileId;
  canvasThemeOverrides: Partial<CanvasColorTheme>;
  uiColorProfileId: UiColorProfileId;
  uiCssOverrides: Partial<UiCssVariables>;
  gridEnabled: boolean;
  axesEnabled: boolean;
  gridSnapEnabled: boolean;
  activeTool: ActiveTool;
  toolActivationVersion: number;
  propertiesPanelIntent: PropertiesPanelIntent;
  scene: SceneModel;
  selectedObject: SelectedObject;
  recentCreatedObject: SelectedObject;
  textEditRequest: TextEditRequest;
  textClipboard: TextClipboardState;
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
  nextVectorId: number;
  nextTextLabelId: number;
  nextRichTextId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  polygonDefaults: PolygonStyle;
  angleDefaults: AngleStyle;
  objectLabelDefaults: ObjectLabelDefaults;
  labelToolDefaults: SceneTextLabelStyle;
  textboxToolDefaults: SceneTextLabelStyle;
  richTextToolDefaults: SceneRichTextStyle;
  angleFixedTool: {
    angleExpr: string;
    direction: AngleFixedDirection;
  };
  circleFixedTool: {
    radius: string;
  };
  regularPolygonTool: {
    sides: number;
    direction: AngleFixedDirection;
  };
  transformTool: {
    mode: TransformToolMode;
    angleExpr: string;
    direction: AngleFixedDirection;
    factorExpr: string;
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
    textLabelStyle: SceneTextLabelStyle | null;
    richTextStyle: SceneRichTextStyle | null;
    pointShowLabel: ShowLabelMode | null;
    objectShowLabel: boolean | null;
    objectLabelGlow: boolean | null;
  };
  canUndo: boolean;
  canRedo: boolean;
};

export type AppPreferencesState = Pick<
  GeoState,
  | "colorProfileId"
  | "canvasThemeOverrides"
  | "uiColorProfileId"
  | "uiCssOverrides"
  | "gridEnabled"
  | "axesEnabled"
  | "gridSnapEnabled"
  | "pointDefaults"
  | "segmentDefaults"
  | "lineDefaults"
  | "circleDefaults"
  | "polygonDefaults"
  | "angleDefaults"
  | "objectLabelDefaults"
  | "labelToolDefaults"
  | "textboxToolDefaults"
  | "richTextToolDefaults"
  | "angleFixedTool"
  | "circleFixedTool"
  | "regularPolygonTool"
  | "transformTool"
  | "dependencyGlowEnabled"
>;

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
  createCircleTangentLines: (circleAId: string, circleBId: string) => string[];
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
  createRegularPolygon: (aId: string, bId: string, sides: number, direction: AngleFixedDirection) => string | null;
  createPointOnLine: (lineId: string, s: number) => string | null;
  createPointOnSegment: (segId: string, u: number) => string | null;
  createPointOnCircle: (circleId: string, t: number, options?: { sectorArcId?: string }) => string | null;
  createPointByRotation: (
    centerId: string,
    basePointId: string,
    angleDeg: number,
    direction: AngleFixedDirection,
    angleExpr?: string
  ) => string | null;
  createPointByTranslation: (pointId: string, fromId: string, toId: string) => string | null;
  createPointByDilation: (pointId: string, centerId: string, factorExpr: string) => string | null;
  createPointByReflection: (pointId: string, axis: ReflectionObjectRef) => string | null;
  createPointByProjection: (pointId: string, axisAId: string, axisBId: string) => string | null;
  createCircleCenterPoint: (circleId: string) => string | null;
  createTriangleCenterPoint: (centerKind: TriangleCenterKind, aId: string, bId: string, cId: string) => string | null;
  createIntersectionPoint: (objA: GeometryObjectRef, objB: GeometryObjectRef, preferredWorld: Vec2) => string | null;
  createNumber: (definition: SceneNumberDefinition, preferredName?: string) => string | null;
  createTextLabel: (world: Vec2, preset?: TextLabelToolKind) => string;
  createRichTextNode: (world: Vec2) => string;
  duplicateTextLabel: (id: string, offsetWorld?: Vec2) => string | null;
  duplicateRichTextNode: (id: string, offsetWorld?: Vec2) => string | null;
  copyTextObjectToClipboard: (target: TextClipboardObjectTarget) => boolean;
  pasteTextClipboard: (world?: Vec2, offsetWorld?: Vec2) => string | null;
  migrateTextLabelToRichTextNode: (id: string) => string | null;
  requestTextEdit: (target: TextEditTarget) => void;
  clearTextEditRequest: (requestId: number) => void;

  movePointTo: (id: string, world: Vec2) => void;
  movePolygonByWorldDelta: (id: string, deltaWorld: Vec2) => void;
  movePointLabelBy: (id: string, deltaPx: Vec2) => void;
  moveAngleLabelTo: (id: string, world: Vec2) => void;
  moveObjectLabelTo: (obj: { type: "segment" | "line" | "circle" | "polygon" | "angle"; id: string }, world: Vec2) => void;
  moveTextLabelTo: (id: string, world: Vec2) => void;
  moveTextLabelByWorldDelta: (id: string, deltaWorld: Vec2) => void;
  moveRichTextNodeTo: (id: string, world: Vec2) => void;
  moveRichTextNodeByWorldDelta: (id: string, deltaWorld: Vec2) => void;
  enableObjectLabel: (obj: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }) => void;

  setPointDefaults: (next: Partial<PointStyle>) => void;
  setSegmentDefaults: (next: Partial<LineStyle>) => void;
  setLineDefaults: (next: Partial<LineStyle>) => void;
  setCircleDefaults: (next: Partial<CircleStyle>) => void;
  setPolygonDefaults: (next: Partial<PolygonStyle>) => void;
  setAngleDefaults: (next: Partial<AngleStyle>) => void;
  setObjectLabelDefaults: (next: Partial<ObjectLabelDefaults>) => void;
  setLabelToolDefaults: (next: Partial<SceneTextLabelStyle>) => void;
  setTextboxToolDefaults: (next: Partial<SceneTextLabelStyle>) => void;
  setRichTextToolDefaults: (next: Partial<SceneRichTextStyle>) => void;
  setAngleFixedTool: (next: Partial<GeoState["angleFixedTool"]>) => void;
  setCircleFixedTool: (next: Partial<GeoState["circleFixedTool"]>) => void;
  setRegularPolygonTool: (next: Partial<GeoState["regularPolygonTool"]>) => void;
  setTransformTool: (next: Partial<GeoState["transformTool"]>) => void;
  setGridEnabled: (enabled: boolean) => void;
  setAxesEnabled: (enabled: boolean) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setColorProfile: (profileId: ColorProfileId) => void;
  setUiColorProfile: (profileId: UiColorProfileId) => void;
  setUiCssVariable: (name: UiCssVariableName, value: string) => void;
  clearUiCssOverrides: () => void;
  applyAppPreferences: (next: Partial<AppPreferencesState>) => void;
  setDependencyGlowEnabled: (enabled: boolean) => void;
  setExportClipWorld: (clip: ExportClipWorld | null) => void;
  clearExportClipWorld: () => void;
  updateSelectedPointStyle: (next: Partial<PointStyle>) => void;
  updateSelectedPointFields: (
    next: Partial<Pick<ScenePoint, "captionTex" | "visible" | "showLabel" | "locked" | "auxiliary">>
  ) => void;
  updatePointStyleByIds: (ids: string[], next: Partial<PointStyle>) => void;
  updatePointFieldsByIds: (
    ids: string[],
    next: Partial<Pick<ScenePoint, "captionTex" | "visible" | "showLabel" | "locked" | "auxiliary">>
  ) => void;
  updateSelectedSegmentStyle: (next: Partial<LineStyle>) => void;
  updateSegmentStyleByIds: (ids: string[], next: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (next: Partial<LineStyle>) => void;
  updateLineStyleByIds: (ids: string[], next: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (next: Partial<CircleStyle>) => void;
  updateCircleStyleByIds: (ids: string[], next: Partial<CircleStyle>) => void;
  updateSelectedPolygonStyle: (next: Partial<PolygonStyle>) => void;
  updatePolygonStyleByIds: (ids: string[], next: Partial<PolygonStyle>) => void;
  updateSelectedAngleStyle: (next: Partial<AngleStyle>) => void;
  updateAngleStyleByIds: (ids: string[], next: Partial<AngleStyle>) => void;
  updateSelectedSegmentFields: (
    next: Partial<Pick<SceneModel["segments"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  updateSegmentFieldsByIds: (
    ids: string[],
    next: Partial<Pick<SceneModel["segments"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  updateSelectedLineFields: (
    next: Partial<Pick<SceneModel["lines"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  convertSelectedLineToSegment: () => string | null;
  convertLinesToSegmentsByIds: (ids: string[]) => string[];
  updateLineFieldsByIds: (
    ids: string[],
    next: Partial<Pick<SceneModel["lines"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  updateSelectedCircleFields: (
    next: Partial<Pick<SceneModel["circles"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  updateCircleFieldsByIds: (
    ids: string[],
    next: Partial<Pick<SceneModel["circles"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  updateSelectedPolygonFields: (
    next: Partial<Pick<SceneModel["polygons"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  updatePolygonFieldsByIds: (
    ids: string[],
    next: Partial<Pick<SceneModel["polygons"][number], "visible" | "showLabel" | "labelText" | "labelPosWorld" | "labelGlow">>
  ) => void;
  setSelectedPolygonOwnedSegmentsVisible: (visible: boolean) => void;
  updateSelectedAngleFields: (next: Partial<Pick<SceneModel["angles"][number], "visible">>) => void;
  updateAngleFieldsByIds: (
    ids: string[],
    next: Partial<Pick<SceneModel["angles"][number], "visible">>
  ) => void;
  updateSelectedNumberDefinition: (next: SceneNumberDefinition) => void;
  updateSelectedTextLabelFields: (
    next: Partial<
      Pick<NonNullable<SceneModel["textLabels"]>[number], "visible" | "text" | "name" | "positionWorld" | "contentMode" | "numberId" | "expr" | "toolKind">
    >
  ) => void;
  updateTextLabelFieldsByIds: (
    ids: string[],
    next: Partial<
      Pick<NonNullable<SceneModel["textLabels"]>[number], "visible" | "text" | "name" | "positionWorld" | "contentMode" | "numberId" | "expr" | "toolKind">
    >
  ) => void;
  updateSelectedTextLabelStyle: (next: Partial<SceneTextLabelStyle>) => void;
  updateTextLabelStyleByIds: (ids: string[], next: Partial<SceneTextLabelStyle>) => void;
  updateSelectedRichTextFields: (
    next: Partial<Pick<NonNullable<SceneModel["richTextNodes"]>[number], "visible" | "name" | "positionWorld" | "boundsPx">>
  ) => void;
  updateRichTextFieldsByIds: (
    ids: string[],
    next: Partial<Pick<NonNullable<SceneModel["richTextNodes"]>[number], "visible" | "name" | "positionWorld" | "boundsPx">>
  ) => void;
  updateSelectedRichTextStyle: (next: Partial<SceneRichTextStyle>) => void;
  updateRichTextStyleByIds: (ids: string[], next: Partial<SceneRichTextStyle>) => void;
  updateSelectedRichTextDocument: (document: NonNullable<SceneModel["richTextNodes"]>[number]["document"]) => void;
  updateRichTextDocumentByIds: (ids: string[], document: NonNullable<SceneModel["richTextNodes"]>[number]["document"]) => void;
  setObjectVisibility: (
    obj: Exclude<SelectedObject, null>,
    visible: boolean
  ) => void;
  setObjectsVisibility: (
    objects: Array<Exclude<SelectedObject, null>>,
    visible: boolean
  ) => void;
  reorderGeometryLayerInTab: (
    dragged: SceneGeometryLayerRef,
    target: SceneGeometryLayerRef,
    tab: "lines" | "circles" | "angles",
    placement: "before" | "after"
  ) => void;

  renameSelectedPoint: (nextNameRaw: string) => RenameResult;
  deleteSelectedObject: () => void;
  deleteObjects: (objects: Array<Exclude<SelectedObject, null>>) => void;
  setCopyStyleSource: (obj: Exclude<SelectedObject, null>) => void;
  applyCopyStyleTo: (obj: Exclude<SelectedObject, null>) => void;
  applyCopyStyleToMany: (objects: Array<Exclude<SelectedObject, null>>) => void;
  clearCopyStyle: () => void;
  undo: () => void;
  redo: () => void;
  loadSnapshot: (snapshot: import("./historySlice").HistorySnapshot) => void;
};

export type GeoStore = GeoState & GeoActions;
