import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { Vec2 } from "../geo/vec2";
import {
  beginSceneEvalTick,
  endSceneEvalTick,
  resolveTextLabelAlignment,
  resolveTextLabelBoxHeightPx,
  getPointWorldPos,
  resolveTextLabelBoxWidthPx,
  resolveTextLabelRenderMode,
  resolveTextLabelToolKind,
  type ScenePoint,
} from "../scene/points";
import { useGeoStore } from "../state/geoStore";
import type { HistorySnapshot } from "../state/slices/historySlice";
import { getCanvasColorTheme, getUiCssVariables } from "../state/colorProfiles";
import { camera as camMath, type Viewport } from "./camera";
import type { ConstructClickIo } from "./constructClickAdapter";
import { findBestSnap, type SnapCandidate } from "./snapEngine";
import {
  createAngleLabelOverlays,
  createObjectLabelOverlays,
  createPointLabelOverlays,
  createTextLabelOverlays,
} from "./labelOverlays";
import { resolveAngles } from "./angleResolution";
import { CanvasLabelsLayer } from "./CanvasLabelsLayer";
import { renderCanvasFrame } from "./renderFrame";
import { useCanvasInteractionController, type PointerState } from "./useCanvasInteractionController";
import { isValidTarget } from "../tools/toolClick";
import { CanvasTextEditor } from "../text-editor/CanvasTextEditor";
import {
  applyDilationToObject,
  applyInversionToObject,
  applyReflectionToObject,
  applyRotationToObject,
  applyTranslationToObject,
} from "../tools/objectTransforms";
import { snapWorldToRectGrid } from "../render/rectGrid";
import type { PendingPreviewTheme } from "./previews/pendingPreview";

const POINT_HIT_TOLERANCE_PX = 12;
const SEGMENT_HIT_TOLERANCE_PX = 10;
const LINE_HIT_TOLERANCE_PX = 10;
const CIRCLE_HIT_TOLERANCE_PX = 10;
const ANGLE_HIT_TOLERANCE_PX = 20;
const CLICK_EPSILON_PX = 3;
const SNAP_OP_BUDGET_PER_FRAME = 6000;

const GRID_SETTINGS_BASE = {
  rotationRad: 0,
  targetSpacingPx: 40,
  majorEvery: 5,
  minorOpacity: 0.06,
  majorOpacity: 0.12,
  minorWidth: 1,
  majorWidth: 1.5,
};

const ANGLE_STROKE_RENDER_SCALE = 3.25 / 1.8;

function getAngleStrokeRenderWidth(rawStrokeWidth: number): number {
  return rawStrokeWidth * ANGLE_STROKE_RENDER_SCALE;
}

function parsePositiveNumber(raw: string, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function rotateScreenVector(x: number, y: number, rotationDeg: number): Vec2 {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function computeTextBoxTopLeftScreen(centerScreen: Vec2, widthPx: number, heightPx: number, rotationDeg: number): Vec2 {
  const offset = rotateScreenVector(-widthPx / 2, -heightPx / 2, rotationDeg);
  return {
    x: centerScreen.x + offset.x,
    y: centerScreen.y + offset.y,
  };
}

function computeTextBoxCenterScreen(topLeftScreen: Vec2, widthPx: number, heightPx: number, rotationDeg: number): Vec2 {
  const offset = rotateScreenVector(widthPx / 2, heightPx / 2, rotationDeg);
  return {
    x: topLeftScreen.x + offset.x,
    y: topLeftScreen.y + offset.y,
  };
}

function clampEditingTextBoxRect(
  topLeftScreen: Vec2,
  widthPx: number,
  heightPx: number,
  vp: Viewport
): { topLeftScreen: Vec2; widthPx: number; heightPx: number } {
  const marginPx = 8;
  const maxWidth = Math.max(80, vp.widthPx - marginPx * 2);
  const maxHeight = Math.max(56, vp.heightPx - marginPx * 2);
  const clampedWidth = Math.max(80, Math.min(maxWidth, widthPx));
  const clampedHeight = Math.max(56, Math.min(maxHeight, heightPx));
  const maxX = Math.max(marginPx, vp.widthPx - marginPx - clampedWidth);
  const maxY = Math.max(marginPx, vp.heightPx - marginPx - clampedHeight);
  return {
    topLeftScreen: {
      x: Math.min(maxX, Math.max(marginPx, topLeftScreen.x)),
      y: Math.min(maxY, Math.max(marginPx, topLeftScreen.y)),
    },
    widthPx: clampedWidth,
    heightPx: clampedHeight,
  };
}

function focusEditableElementToEnd(element: HTMLElement | null): void {
  if (!element) return;
  element.focus();
  if (element instanceof HTMLTextAreaElement) {
    const caret = element.value.length;
    element.setSelectionRange(caret, caret);
    return;
  }
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerState>({
    active: false,
    pid: -1,
    mode: "idle",
    pointId: null,
    objectType: null,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const dragFrameRef = useRef<number | null>(null);
  const dragPanDeltaRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragLabelDeltaRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragPointScreenRef = useRef<Vec2 | null>(null);
  const dragPointIdRef = useRef<string | null>(null);
  const dragAngleLabelScreenRef = useRef<Vec2 | null>(null);
  const editorRef = useRef<HTMLElement | null>(null);
  const textboxResizeStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startMinHeight: number;
  } | null>(null);
  const textboxResizeActiveRef = useRef(false);
  const lastOpenedTextboxIdRef = useRef<string | null>(null);
  const lastTextboxSelectionEditRef = useRef<string | null>(null);

  const camera = useGeoStore((store) => store.camera);
  const activeTool = useGeoStore((store) => store.activeTool);
  const scene = useGeoStore((store) => store.scene);
  const colorProfileId = useGeoStore((store) => store.colorProfileId);
  const canvasThemeOverrides = useGeoStore((store) => store.canvasThemeOverrides);
  const uiColorProfileId = useGeoStore((store) => store.uiColorProfileId);
  const uiCssOverrides = useGeoStore((store) => store.uiCssOverrides);
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const recentCreatedObject = useGeoStore((store) => store.recentCreatedObject);
  const hoveredHit = useGeoStore((store) => store.hoveredHit);
  const cursorWorld = useGeoStore((store) => store.cursorWorld);
  const pendingSelection = useGeoStore((store) => store.pendingSelection);
  const copyStyle = useGeoStore((store) => store.copyStyle);
  const pointDefaults = useGeoStore((store) => store.pointDefaults);
  const angleDefaults = useGeoStore((store) => store.angleDefaults);
  const dependencyGlowEnabled = useGeoStore((store) => store.dependencyGlowEnabled);
  const exportClipWorld = useGeoStore((store) => store.exportClipWorld);
  const gridEnabled = useGeoStore((store) => store.gridEnabled);
  const axesEnabled = useGeoStore((store) => store.axesEnabled);
  const gridSnapEnabled = useGeoStore((store) => store.gridSnapEnabled);
  const effectiveGridSnapEnabled = gridEnabled && gridSnapEnabled;

  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const setHoveredHit = useGeoStore((store) => store.setHoveredHit);
  const setCursorWorld = useGeoStore((store) => store.setCursorWorld);
  const setPendingSelection = useGeoStore((store) => store.setPendingSelection);
  const clearPendingSelection = useGeoStore((store) => store.clearPendingSelection);
  const panByScreenDelta = useGeoStore((store) => store.panByScreenDelta);
  const zoomAtScreenPoint = useGeoStore((store) => store.zoomAtScreenPoint);
  const createFreePoint = useGeoStore((store) => store.createFreePoint);
  const createTextLabel = useGeoStore((store) => store.createTextLabel);
  const createSegment = useGeoStore((store) => store.createSegment);
  const createLine = useGeoStore((store) => store.createLine);
  const createPolygon = useGeoStore((store) => store.createPolygon);
  const createRegularPolygon = useGeoStore((store) => store.createRegularPolygon);
  const createCircle = useGeoStore((store) => store.createCircle);
  const createAuxiliaryCircle = useGeoStore((store) => store.createAuxiliaryCircle);
  const createCircleThreePoint = useGeoStore((store) => store.createCircleThreePoint);
  const createCircleFixedRadius = useGeoStore((store) => store.createCircleFixedRadius);
  const createPerpendicularLine = useGeoStore((store) => store.createPerpendicularLine);
  const createParallelLine = useGeoStore((store) => store.createParallelLine);
  const createTangentLines = useGeoStore((store) => store.createTangentLines);
  const createCircleTangentLines = useGeoStore((store) => store.createCircleTangentLines);
  const createAngleBisectorLine = useGeoStore((store) => store.createAngleBisectorLine);
  const createAngle = useGeoStore((store) => store.createAngle);
  const createSector = useGeoStore((store) => store.createSector);
  const createAngleFixed = useGeoStore((store) => store.createAngleFixed);
  const createMidpointFromPoints = useGeoStore((store) => store.createMidpointFromPoints);
  const createMidpointFromSegment = useGeoStore((store) => store.createMidpointFromSegment);
  const createPointOnLine = useGeoStore((store) => store.createPointOnLine);
  const createPointOnSegment = useGeoStore((store) => store.createPointOnSegment);
  const createPointOnCircle = useGeoStore((store) => store.createPointOnCircle);
  const createPointByTranslation = useGeoStore((store) => store.createPointByTranslation);
  const createPointByRotation = useGeoStore((store) => store.createPointByRotation);
  const createPointByDilation = useGeoStore((store) => store.createPointByDilation);
  const createPointByReflection = useGeoStore((store) => store.createPointByReflection);
  const createCircleCenterPoint = useGeoStore((store) => store.createCircleCenterPoint);
  const createIntersectionPoint = useGeoStore((store) => store.createIntersectionPoint);
  const movePointTo = useGeoStore((store) => store.movePointTo);
  const movePolygonByWorldDelta = useGeoStore((store) => store.movePolygonByWorldDelta);
  const movePointLabelBy = useGeoStore((store) => store.movePointLabelBy);
  const moveAngleLabelTo = useGeoStore((store) => store.moveAngleLabelTo);
  const moveObjectLabelTo = useGeoStore((store) => store.moveObjectLabelTo);
  const moveTextLabelTo = useGeoStore((store) => store.moveTextLabelTo);
  const moveTextLabelByWorldDelta = useGeoStore((store) => store.moveTextLabelByWorldDelta);
  const enableObjectLabel = useGeoStore((store) => store.enableObjectLabel);
  const setCopyStyleSource = useGeoStore((store) => store.setCopyStyleSource);
  const applyCopyStyleTo = useGeoStore((store) => store.applyCopyStyleTo);
  const setExportClipWorld = useGeoStore((store) => store.setExportClipWorld);
  const setObjectVisibility = useGeoStore((store) => store.setObjectVisibility);
  const updateTextLabelFieldsByIds = useGeoStore((store) => store.updateTextLabelFieldsByIds);
  const updateTextLabelStyleByIds = useGeoStore((store) => store.updateTextLabelStyleByIds);
  const deleteSelectedObject = useGeoStore((store) => store.deleteSelectedObject);
  const loadSnapshot = useGeoStore((store) => store.loadSnapshot);
  const fitViewToScene = useGeoStore((store) => store.fitViewToScene);
  const angleFixedTool = useGeoStore((store) => store.angleFixedTool);
  const circleFixedTool = useGeoStore((store) => store.circleFixedTool);
  const regularPolygonTool = useGeoStore((store) => store.regularPolygonTool);
  const transformTool = useGeoStore((store) => store.transformTool);

  const [vp, setVp] = useState<Viewport>({ widthPx: 800, heightPx: 600 });
  const [hoverScreen, setHoverScreen] = useState<Vec2 | null>(null);
  const [snapDisabled, setSnapDisabled] = useState(false);
  const [dropTargetActive, setDropTargetActive] = useState(false);
  const [editingTextLabelId, setEditingTextLabelId] = useState<string | null>(null);
  const [editingTextLabelValue, setEditingTextLabelValue] = useState("");
  const [editingTextLabelOriginalValue, setEditingTextLabelOriginalValue] = useState("");
  const [editingTextLabelIsNew, setEditingTextLabelIsNew] = useState(false);
  const [editingTextLabelWidthPx, setEditingTextLabelWidthPx] = useState<number | null>(null);
  const [editingTextLabelMinHeightPx, setEditingTextLabelMinHeightPx] = useState<number>(56);
  const [editingTextLabelResizeActive, setEditingTextLabelResizeActive] = useState(false);
  const [editingTextLabelTopLeftScreen, setEditingTextLabelTopLeftScreen] = useState<Vec2 | null>(null);
  const isTauriRuntime = useMemo(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object),
    []
  );
  const canvasTheme = useMemo(
    () => getCanvasColorTheme(colorProfileId, canvasThemeOverrides),
    [colorProfileId, canvasThemeOverrides]
  );
  const uiCssVariables = useMemo(
    () => getUiCssVariables(uiColorProfileId, uiCssOverrides),
    [uiColorProfileId, uiCssOverrides]
  );
  const previewTheme = useMemo<PendingPreviewTheme>(
    () => ({
      stroke: uiCssVariables["--gd-ui-preview-stroke"],
      strokeStrong: uiCssVariables["--gd-ui-preview-stroke-strong"],
      fillSoft: uiCssVariables["--gd-ui-preview-fill-soft"],
      fill: uiCssVariables["--gd-ui-preview-fill"],
      fillStrong: uiCssVariables["--gd-ui-preview-fill-strong"],
      snapStroke: uiCssVariables["--gd-ui-preview-snap-stroke"],
      lineWidthPx: parsePositiveNumber(uiCssVariables["--gd-ui-preview-line-width"], 1.3),
    }),
    [uiCssVariables]
  );
  const gridSettings = useMemo(
    () => ({
      ...GRID_SETTINGS_BASE,
      enabled: gridEnabled,
      showAxes: axesEnabled,
    }),
    [gridEnabled, axesEnabled]
  );
  const hitTolerances = useMemo(
    () => ({
      point: POINT_HIT_TOLERANCE_PX,
      angle: ANGLE_HIT_TOLERANCE_PX,
      segment: SEGMENT_HIT_TOLERANCE_PX,
      line: LINE_HIT_TOLERANCE_PX,
      circle: CIRCLE_HIT_TOLERANCE_PX,
    }),
    []
  );
  const constructClickIo = useMemo<ConstructClickIo>(
    () => {
      const cloneObjectStyle = (
        source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string },
        target: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }
      ) => {
        setCopyStyleSource(source);
        applyCopyStyleTo(target);
      };
      return {
        setPendingSelection,
        clearPendingSelection,
        createFreePoint,
        createTextLabel,
        createSegment,
        createLine,
        createPolygon,
        createRegularPolygon,
        createCircle,
        createAuxiliaryCircle,
        createCircleThreePoint,
        createCircleFixedRadius,
        createPerpendicularLine,
        createParallelLine,
        createTangentLines,
        createCircleTangentLines,
        createAngleBisectorLine,
        createAngle,
        createSector,
        createAngleFixed,
        createMidpointFromPoints,
        createMidpointFromSegment,
        createPointOnLine,
        createPointOnSegment,
        createPointOnCircle,
        createPointByTranslation,
        createPointByRotation,
        createPointByDilation,
        createPointByReflection,
        transformObjectByTranslation: (source, fromId, toId) =>
          applyTranslationToObject(source, fromId, toId, {
            scene,
            createPointByTranslation,
            createPointByRotation,
            createPointByDilation,
            createPointByReflection,
            createPointOnLine,
            createPointOnCircle,
            createSegment,
            createLine,
            createAngleBisectorLine,
            createCircle,
            createCircleThreePoint,
            createCircleFixedRadius,
            createCircleCenterPoint,
            createPolygon,
            createAngle,
            createSector,
            setObjectVisibility,
            cloneObjectStyle,
          }),
        transformObjectByRotation: (source, centerId, angleExpr, direction) =>
          applyRotationToObject(source, centerId, angleExpr, direction, {
            scene,
            createPointByTranslation,
            createPointByRotation,
            createPointByDilation,
            createPointByReflection,
            createPointOnLine,
            createPointOnCircle,
            createSegment,
            createLine,
            createAngleBisectorLine,
            createCircle,
            createCircleThreePoint,
            createCircleFixedRadius,
            createCircleCenterPoint,
            createPolygon,
            createAngle,
            createSector,
            setObjectVisibility,
            cloneObjectStyle,
          }),
        transformObjectByDilation: (source, centerId, factorExpr) =>
          applyDilationToObject(source, centerId, factorExpr, {
            scene,
            createPointByTranslation,
            createPointByRotation,
            createPointByDilation,
            createPointByReflection,
            createPointOnLine,
            createPointOnCircle,
            createSegment,
            createLine,
            createAngleBisectorLine,
            createCircle,
            createCircleThreePoint,
            createCircleFixedRadius,
            createCircleCenterPoint,
            createPolygon,
            createAngle,
            createSector,
            setObjectVisibility,
            cloneObjectStyle,
          }),
        transformObjectByReflection: (source, axis) =>
          applyReflectionToObject(source, axis, {
            scene,
            createPointByTranslation,
            createPointByRotation,
            createPointByDilation,
            createPointByReflection,
            createPointOnLine,
            createPointOnCircle,
            createSegment,
            createLine,
            createAngleBisectorLine,
            createCircle,
            createCircleThreePoint,
            createCircleFixedRadius,
            createCircleCenterPoint,
            createPolygon,
            createAngle,
            createSector,
            setObjectVisibility,
            cloneObjectStyle,
          }),
        transformObjectByInversion: (source, inversionCircleId) =>
          applyInversionToObject(source, inversionCircleId, {
            scene,
            createPointByTranslation,
            createPointByRotation,
            createPointByDilation,
            createPointByReflection,
            createPointOnLine,
            createPointOnCircle,
            createSegment,
            createLine,
            createAngleBisectorLine,
            createCircle,
            createCircleThreePoint,
            createCircleFixedRadius,
            createCircleCenterPoint,
            createPolygon,
            createAngle,
            createSector,
            setObjectVisibility,
            cloneObjectStyle,
          }),
        createCircleCenterPoint,
        createIntersectionPoint,
        setSelectedObject,
        setCopyStyleSource,
        applyCopyStyleTo,
        enableObjectLabel,
        setExportClipWorld,
        getPointWorldById: (id) => {
          const point = scene.points.find((p) => p.id === id);
          return point ? getPointWorldPos(point, scene) : null;
        },
        gridSnapEnabled: effectiveGridSnapEnabled,
        snapWorldToGrid: (world) => snapWorldToRectGrid(world, camera, gridSettings),
      };
    },
    [
      setPendingSelection,
      clearPendingSelection,
      createFreePoint,
      createTextLabel,
      createSegment,
      createLine,
      createPolygon,
      createRegularPolygon,
      createCircle,
      createAuxiliaryCircle,
      createCircleThreePoint,
      createCircleFixedRadius,
      createPerpendicularLine,
      createParallelLine,
      createTangentLines,
      createCircleTangentLines,
      createAngleBisectorLine,
      createAngle,
      createSector,
      createAngleFixed,
      createMidpointFromPoints,
      createMidpointFromSegment,
      createPointOnLine,
      createPointOnSegment,
      createPointOnCircle,
      createPointByTranslation,
      createPointByRotation,
      createPointByDilation,
      createPointByReflection,
      createCircleCenterPoint,
      createIntersectionPoint,
      setSelectedObject,
      setCopyStyleSource,
      applyCopyStyleTo,
      enableObjectLabel,
      setExportClipWorld,
      setObjectVisibility,
      effectiveGridSnapEnabled,
      camera,
      gridSettings,
      scene,
    ]
  );

  const resolvedPoints = useMemo(
    () => {
      beginSceneEvalTick(scene);
      try {
        return scene.points
          .map((point) => {
            const world = getPointWorldPos(point, scene);
            if (!world) return null;
            return { point, world };
          })
          .filter((item): item is { point: ScenePoint; world: Vec2 } => Boolean(item));
      } finally {
        endSceneEvalTick(scene);
      }
    },
    [scene]
  );

  const resolvedAngles = useMemo(() => resolveAngles(scene), [scene]);

  const labelOverlays = useMemo(
    () => createPointLabelOverlays(resolvedPoints, camera, vp, canvasTheme.backgroundColor),
    [resolvedPoints, camera, vp, canvasTheme.backgroundColor]
  );
  const angleLabelOverlays = useMemo(
    () => createAngleLabelOverlays(resolvedAngles, camera, vp),
    [resolvedAngles, camera, vp]
  );
  const objectLabelOverlays = useMemo(
    () => createObjectLabelOverlays(scene, camera, vp),
    [scene, camera, vp]
  );
  const textLabelOverlays = useMemo(
    () => createTextLabelOverlays(scene, camera, vp),
    [scene, camera, vp]
  );
  const editingTextLabelOverlay = useMemo(
    () => (editingTextLabelId ? textLabelOverlays.find((label) => label.id === editingTextLabelId) ?? null : null),
    [editingTextLabelId, textLabelOverlays]
  );
  const editingTextLabel = useMemo(
    () => (editingTextLabelId ? (scene.textLabels ?? []).find((label) => label.id === editingTextLabelId) ?? null : null),
    [editingTextLabelId, scene.textLabels]
  );
  const editingTextLabelRenderMode = useMemo(
    () => (editingTextLabel ? resolveTextLabelRenderMode(editingTextLabel.style) : "plain"),
    [editingTextLabel]
  );
  const editingTextLabelWidth = useMemo(() => {
    if (typeof editingTextLabelWidthPx === "number" && Number.isFinite(editingTextLabelWidthPx)) {
      return Math.max(80, Math.min(960, editingTextLabelWidthPx));
    }
    return editingTextLabelOverlay?.boxWidthPx ?? null;
  }, [editingTextLabelOverlay?.boxWidthPx, editingTextLabelWidthPx]);
  const visibleTextLabelOverlays = useMemo(
    () => (editingTextLabelId ? textLabelOverlays.filter((label) => label.id !== editingTextLabelId) : textLabelOverlays),
    [editingTextLabelId, textLabelOverlays]
  );

  const hoverSnap: SnapCandidate | null = useMemo(() => {
    if (!hoverScreen) return null;
    if (snapDisabled) return null;
    return findBestSnap(hoverScreen, camera, vp, scene, POINT_HIT_TOLERANCE_PX, SNAP_OP_BUDGET_PER_FRAME);
  }, [hoverScreen, scene, snapDisabled]);

  const hoveredTargetValid = isValidTarget(activeTool, pendingSelection, hoveredHit, hoverSnap);

  const clearTextLabelEditor = useCallback(() => {
    setEditingTextLabelId(null);
    setEditingTextLabelValue("");
    setEditingTextLabelOriginalValue("");
    setEditingTextLabelIsNew(false);
    setEditingTextLabelWidthPx(null);
    setEditingTextLabelMinHeightPx(56);
    setEditingTextLabelTopLeftScreen(null);
  }, []);

  const beginTextboxEditing = useCallback(
    (labelId: string, isNew: boolean) => {
      const label = (scene.textLabels ?? []).find((item) => item.id === labelId);
      if (!label) return;
      const widthPx = resolveTextLabelBoxWidthPx(label.style) ?? 220;
      const heightPx = resolveTextLabelBoxHeightPx(label.style) ?? 56;
      const rotationDeg =
        typeof label.style.rotationDeg === "number" && Number.isFinite(label.style.rotationDeg) ? label.style.rotationDeg : 0;
      const centerScreen = camMath.worldToScreen(label.positionWorld, camera, vp);
      const clampedRect = clampEditingTextBoxRect(
        computeTextBoxTopLeftScreen(centerScreen, widthPx, heightPx, rotationDeg),
        widthPx,
        heightPx,
        vp
      );
      lastTextboxSelectionEditRef.current = labelId;
      setSelectedObject({ type: "textLabel", id: labelId });
      setEditingTextLabelId(labelId);
      setEditingTextLabelValue(label.text);
      setEditingTextLabelOriginalValue(label.text);
      setEditingTextLabelIsNew(isNew);
      setEditingTextLabelWidthPx(clampedRect.widthPx);
      setEditingTextLabelMinHeightPx(clampedRect.heightPx);
      setEditingTextLabelTopLeftScreen(clampedRect.topLeftScreen);
    },
    [camera, scene.textLabels, setSelectedObject, vp]
  );

  const beginTextboxEditingFromCanvas = useCallback(
    (labelId: string): boolean => {
      const label = (scene.textLabels ?? []).find((item) => item.id === labelId);
      if (!label) return false;
      if (resolveTextLabelToolKind(label) !== "textbox") return false;
      beginTextboxEditing(labelId, false);
      return true;
    },
    [beginTextboxEditing, scene.textLabels]
  );

  const cancelTextboxEditing = useCallback(() => {
    if (editingTextLabelId && editingTextLabelIsNew && editingTextLabelOriginalValue.length === 0) {
      setSelectedObject({ type: "textLabel", id: editingTextLabelId });
      deleteSelectedObject();
    }
    clearTextLabelEditor();
  }, [
    clearTextLabelEditor,
    deleteSelectedObject,
    editingTextLabelId,
    editingTextLabelIsNew,
    editingTextLabelOriginalValue.length,
    setSelectedObject,
  ]);

  const commitTextboxEditing = useCallback(() => {
    if (!editingTextLabelId) return;
    setSelectedObject({ type: "textLabel", id: editingTextLabelId });
    if (editingTextLabelIsNew && editingTextLabelValue.length === 0) {
      deleteSelectedObject();
      clearTextLabelEditor();
      return;
    }
    const rotationDeg = editingTextLabelOverlay?.rotationDeg ?? 0;
    const finalWidthPx = editingTextLabelWidth ?? 220;
    const finalHeightPx = editingTextLabelMinHeightPx;
    const positionWorld = editingTextLabelTopLeftScreen
      ? camMath.screenToWorld(
          computeTextBoxCenterScreen(editingTextLabelTopLeftScreen, finalWidthPx, finalHeightPx, rotationDeg),
          camera,
          vp
        )
      : undefined;
    updateTextLabelFieldsByIds([editingTextLabelId], {
      text: editingTextLabelValue,
      contentMode: "static",
      toolKind: "textbox",
      positionWorld,
    });
    updateTextLabelStyleByIds([editingTextLabelId], {
      boxWidthPx: editingTextLabelWidth ?? undefined,
      boxHeightPx: editingTextLabelMinHeightPx,
    });
    clearTextLabelEditor();
  }, [
    clearTextLabelEditor,
    deleteSelectedObject,
    editingTextLabelId,
    editingTextLabelIsNew,
    editingTextLabelOverlay?.rotationDeg,
    editingTextLabelTopLeftScreen,
    editingTextLabelValue,
    editingTextLabelWidth,
    editingTextLabelMinHeightPx,
    camera,
    setSelectedObject,
    updateTextLabelFieldsByIds,
    updateTextLabelStyleByIds,
    vp,
  ]);

  useEffect(() => {
    if (activeTool !== "textbox") return;
    if (!recentCreatedObject || recentCreatedObject.type !== "textLabel") return;
    if (recentCreatedObject.id === lastOpenedTextboxIdRef.current) return;
    const label = (scene.textLabels ?? []).find((item) => item.id === recentCreatedObject.id);
    if (!label || resolveTextLabelToolKind(label) !== "textbox") return;
    lastOpenedTextboxIdRef.current = recentCreatedObject.id;
    beginTextboxEditing(recentCreatedObject.id, true);
  }, [activeTool, beginTextboxEditing, recentCreatedObject, scene.textLabels]);

  useEffect(() => {
    if (activeTool !== "textbox") {
      lastTextboxSelectionEditRef.current = null;
      return;
    }
    if (!selectedObject || selectedObject.type !== "textLabel") {
      lastTextboxSelectionEditRef.current = null;
      return;
    }
    if (recentCreatedObject?.type === "textLabel" && recentCreatedObject.id === selectedObject.id) return;
    const label = (scene.textLabels ?? []).find((item) => item.id === selectedObject.id);
    if (!label || resolveTextLabelToolKind(label) !== "textbox") return;
    if (editingTextLabelId === selectedObject.id) return;
    if (lastTextboxSelectionEditRef.current === selectedObject.id) return;
    beginTextboxEditing(selectedObject.id, false);
  }, [activeTool, beginTextboxEditing, editingTextLabelId, recentCreatedObject, scene.textLabels, selectedObject]);

  useEffect(() => {
    if (!editingTextLabelId) return;
    const exists = (scene.textLabels ?? []).some((label) => label.id === editingTextLabelId);
    if (!exists) clearTextLabelEditor();
  }, [clearTextLabelEditor, editingTextLabelId, scene.textLabels]);

  useEffect(() => {
    if (!editingTextLabelId || activeTool === "textbox") return;
    commitTextboxEditing();
  }, [activeTool, commitTextboxEditing, editingTextLabelId]);

  useEffect(() => {
    if (!editingTextLabelId) return;
    const editor = editorRef.current;
    if (!editor) return;
    window.requestAnimationFrame(() => {
      focusEditableElementToEnd(editorRef.current);
    });
  }, [editingTextLabelId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!(editor instanceof HTMLTextAreaElement)) return;
    editor.style.height = "0px";
    editor.style.height = `${Math.max(editingTextLabelMinHeightPx, editor.scrollHeight)}px`;
  }, [editingTextLabelMinHeightPx, editingTextLabelValue, editingTextLabelOverlay?.textSize, editingTextLabelWidth]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!(editor instanceof HTMLTextAreaElement)) return;
    const ro = new ResizeObserver(() => {
      const nextWidth = Math.round(editor.getBoundingClientRect().width);
      if (nextWidth <= 0) return;
      setEditingTextLabelWidthPx((prev) => (prev !== nextWidth ? nextWidth : prev));
    });
    ro.observe(editor);
    return () => ro.disconnect();
  }, [editingTextLabelId]);

  useEffect(() => {
    if (!editingTextLabelResizeActive) return;
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = textboxResizeStateRef.current;
      if (!resizeState) return;
      const deltaX = event.clientX - resizeState.startClientX;
      const deltaY = event.clientY - resizeState.startClientY;
      const nextWidth = resizeState.startWidth + deltaX;
      const nextMinHeight = resizeState.startMinHeight + deltaY;
      const clampedRect = clampEditingTextBoxRect(
        editingTextLabelTopLeftScreen ?? { x: 8, y: 8 },
        Math.round(nextWidth),
        Math.round(nextMinHeight),
        vp
      );
      setEditingTextLabelWidthPx(clampedRect.widthPx);
      setEditingTextLabelMinHeightPx(clampedRect.heightPx);
      if (editingTextLabelTopLeftScreen) {
        setEditingTextLabelTopLeftScreen(clampedRect.topLeftScreen);
      }
    };
    const handlePointerUp = () => {
      textboxResizeStateRef.current = null;
      textboxResizeActiveRef.current = false;
      setEditingTextLabelResizeActive(false);
      window.requestAnimationFrame(() => {
        focusEditableElementToEnd(editorRef.current);
      });
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [editingTextLabelResizeActive, editingTextLabelTopLeftScreen, vp]);

  useEffect(() => {
    if (!editingTextLabelId || !editingTextLabelTopLeftScreen) return;
    const clampedRect = clampEditingTextBoxRect(
      editingTextLabelTopLeftScreen,
      editingTextLabelWidth ?? 220,
      editingTextLabelMinHeightPx,
      vp
    );
    const topLeftChanged =
      Math.abs(clampedRect.topLeftScreen.x - editingTextLabelTopLeftScreen.x) > 0.5 ||
      Math.abs(clampedRect.topLeftScreen.y - editingTextLabelTopLeftScreen.y) > 0.5;
    if (topLeftChanged) {
      setEditingTextLabelTopLeftScreen(clampedRect.topLeftScreen);
    }
    if ((editingTextLabelWidth ?? 220) !== clampedRect.widthPx) {
      setEditingTextLabelWidthPx(clampedRect.widthPx);
    }
    if (editingTextLabelMinHeightPx !== clampedRect.heightPx) {
      setEditingTextLabelMinHeightPx(clampedRect.heightPx);
    }
  }, [editingTextLabelId, editingTextLabelMinHeightPx, editingTextLabelTopLeftScreen, editingTextLabelWidth, vp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      setVp({ widthPx: rect.width, heightPx: rect.height });
    });

    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingSelection) {
          e.preventDefault();
          clearPendingSelection();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearPendingSelection, pendingSelection]);

  const dpr = window.devicePixelRatio || 1;

  const draw = useMemo(
    () => () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const selectedDrawableObject = selectedObject?.type === "number" || selectedObject?.type === "textLabel" ? null : selectedObject;
      const recentDrawableObject = recentCreatedObject?.type === "number" || recentCreatedObject?.type === "textLabel" ? null : recentCreatedObject;
      const copySourceDrawable = copyStyle.source?.type === "number" || copyStyle.source?.type === "textLabel" ? null : copyStyle.source;
      renderCanvasFrame({
        canvas,
        scene,
        camera,
        vp,
        dpr,
        gridSettings,
        canvasTheme,
        activeTool,
        pendingSelection,
        cursorWorld,
        hoverScreen,
        hoverSnap,
        hoveredHit,
        hoveredTargetValid,
        resolvedPoints,
        resolvedAngles,
        angleFixedTool,
        regularPolygonTool,
        circleFixedTool,
        transformTool,
        anglePreviewArcRadius: angleDefaults.arcRadius,
        pendingPreviewTolerances: {
          linePx: LINE_HIT_TOLERANCE_PX,
          segmentPx: SEGMENT_HIT_TOLERANCE_PX,
        },
        previewTheme,
        selectedDrawableObject,
        recentDrawableObject,
        copySourceDrawable,
        dependencyGlowEnabled,
        exportClipWorld,
        getAngleStrokeRenderWidth,
      });
    },
    [
      activeTool,
      angleFixedTool,
      angleDefaults.arcRadius,
      camera,
      copyStyle.source,
      cursorWorld,
      dpr,
      hoverSnap,
      hoverScreen,
      hoveredHit,
      hoveredTargetValid,
      pendingSelection,
      recentCreatedObject,
      resolvedPoints,
      resolvedAngles,
      previewTheme,
      scene,
      selectedObject,
      dependencyGlowEnabled,
      exportClipWorld,
      gridSettings,
      canvasTheme,
      circleFixedTool,
      regularPolygonTool,
      transformTool,
      vp,
    ]
  );

  useEffect(() => {
    draw();
  }, [draw]);

  useCanvasInteractionController({
    canvasRef,
    labelsLayerRef,
    pointerRef,
    dragBuffers: {
      dragFrameRef,
      dragPanDeltaRef,
      dragLabelDeltaRef,
      dragPointScreenRef,
      dragPointIdRef,
      dragAngleLabelScreenRef,
    },
    activeTool,
    pendingSelection,
    copyStyleSource: copyStyle.source,
    scene,
    camera,
    vp,
    resolvedPoints,
    resolvedAngles,
    hoveredHit,
    selectedObject,
    pointLabelOffsetPx: pointDefaults.labelOffsetPx,
    angleFixedTool,
    regularPolygonTool,
    circleFixedTool,
    transformTool,
    constructClickIo,
    tolerances: hitTolerances,
    clickEpsilonPx: CLICK_EPSILON_PX,
    actions: {
      panByScreenDelta,
      movePointTo,
      movePolygonByWorldDelta,
      movePointLabelBy,
      moveAngleLabelTo,
      moveObjectLabelTo,
      moveTextLabelTo,
      moveTextLabelByWorldDelta,
      setHoverScreen,
      setSnapDisabled,
      setCursorWorld,
      setHoveredHit,
      setSelectedObject,
      beginTextLabelEditing: beginTextboxEditingFromCanvas,
      clearPendingSelection,
      zoomAtScreenPoint,
    },
  });

  const scheduleFitView = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        const rect = canvas?.getBoundingClientRect();
        const widthPx = rect?.width && rect.width > 1 ? rect.width : window.innerWidth;
        const heightPx = rect?.height && rect.height > 1 ? rect.height : window.innerHeight;
        fitViewToScene({ widthPx, heightPx });
      });
    });
  }, [fitViewToScene]);

  const loadDroppedSnapshotText = useCallback(
    (text: string, source: string) => {
      try {
        const parsed = JSON.parse(text) as HistorySnapshot;
        if (!isValidSnapshotPayload(parsed)) {
          alert("Unsupported file format. Use a GeoDraw .geodraw/.json snapshot file.");
          return;
        }
        loadSnapshot(parsed);
        scheduleFitView();
      } catch (err) {
        console.error(`Failed to open dropped file (${source}):`, err);
        alert("Failed to open dropped file. It may be corrupted or incompatible.");
      }
    },
    [loadSnapshot, scheduleFitView]
  );

  useEffect(() => {
    if (!isTauriRuntime) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void getCurrentWindow()
      .onDragDropEvent(async (event) => {
        if (disposed) return;
        const payload = event.payload;
        if (payload.type === "enter") {
          if (payload.paths.some(isSupportedSnapshotPath)) {
            setDropTargetActive(true);
          }
          return;
        }
        if (payload.type === "over") return;
        if (payload.type === "leave") {
          setDropTargetActive(false);
          return;
        }
        setDropTargetActive(false);
        const path = payload.paths.find(isSupportedSnapshotPath);
        if (!path) return;
        try {
          const text = await readTextFile(path);
          if (disposed) return;
          loadDroppedSnapshotText(text, path);
        } catch (err) {
          console.error("Failed to read dropped file path:", err);
          alert("Failed to open dropped file. Check file permissions and try again.");
        }
      })
      .then((off) => {
        if (disposed) {
          off();
        } else {
          unlisten = off;
        }
      })
      .catch((err) => {
        console.error("Failed to register desktop drag-drop listener:", err);
      });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [isTauriRuntime, loadDroppedSnapshotText]);

  const handleCanvasDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !hasFileDragPayload(dataTransfer)) return;
    const files = dataTransfer.files;
    if (files.length > 0 && !Array.from(files).some(isSupportedSnapshotFile)) return;
    event.preventDefault();
    dataTransfer.dropEffect = "copy";
    setDropTargetActive(true);
  };

  const handleCanvasDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !hasFileDragPayload(dataTransfer)) return;
    event.preventDefault();
    setDropTargetActive(true);
  };

  const handleCanvasDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDropTargetActive(false);
  };

  const handleCanvasDrop = async (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetActive(false);
    const files = collectDroppedFiles(event.dataTransfer);
    if (!files || files.length === 0) return;
    const file = Array.from(files).find(isSupportedSnapshotFile);
    if (!file) return;
    const text = await file.text();
    loadDroppedSnapshotText(text, file.name);
  };

  return (
    <div
      className={dropTargetActive ? "canvasStack canvasStackDropActive" : "canvasStack"}
      onDragEnter={handleCanvasDragEnter}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={(event) => void handleCanvasDrop(event)}
    >
      <canvas ref={canvasRef} className="drawingCanvas" />
      <CanvasLabelsLayer
        labelsLayerRef={labelsLayerRef}
        labelOverlays={labelOverlays}
        angleLabelOverlays={angleLabelOverlays}
        objectLabelOverlays={objectLabelOverlays}
        textLabelOverlays={visibleTextLabelOverlays}
        selectedTextLabelId={selectedObject?.type === "textLabel" ? selectedObject.id : null}
      />
      {editingTextLabelOverlay && (
        <CanvasTextEditor
          sessionKey={editingTextLabelOverlay.id}
          editorRef={editorRef}
          value={editingTextLabelValue}
          renderMode={editingTextLabelRenderMode}
          textColor={editingTextLabelOverlay.textColor}
          fontSizePx={Math.max(8, editingTextLabelOverlay.textSize)}
          minHeightPx={editingTextLabelMinHeightPx}
          resizeActive={editingTextLabelResizeActive}
          shouldIgnoreBlur={() => textboxResizeActiveRef.current}
          sourceStyle={{
            textAlign: resolveTextLabelAlignment(editingTextLabel?.style ?? { textColor: "#111111", textSize: 12, useTex: false }),
          }}
          onChangeValue={setEditingTextLabelValue}
          onCommit={commitTextboxEditing}
          onCancel={cancelTextboxEditing}
          onResizeStart={(clientX, clientY) => {
            textboxResizeStateRef.current = {
              startClientX: clientX,
              startClientY: clientY,
              startWidth: editingTextLabelWidth ?? 220,
              startMinHeight: editingTextLabelMinHeightPx,
            };
            textboxResizeActiveRef.current = true;
            setEditingTextLabelResizeActive(true);
          }}
          shellStyle={{
            left: 0,
            top: 0,
            width: editingTextLabelWidth ? `${editingTextLabelWidth}px` : undefined,
            transform: editingTextLabelTopLeftScreen
              ? `translate(${editingTextLabelTopLeftScreen.x}px, ${editingTextLabelTopLeftScreen.y}px) rotate(${editingTextLabelOverlay.rotationDeg}deg)`
              : `translate(${editingTextLabelOverlay.x}px, ${editingTextLabelOverlay.y}px) translate(-50%, -50%) rotate(${editingTextLabelOverlay.rotationDeg}deg)`,
            transformOrigin: editingTextLabelTopLeftScreen ? "top left" : "center center",
            fontSize: `${Math.max(8, editingTextLabelOverlay.textSize)}px`,
            color: editingTextLabelOverlay.textColor,
          }}
        />
      )}
    </div>
  );
}

function isSupportedSnapshotFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".geodraw") || name.endsWith(".json");
}

function isSupportedSnapshotPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return normalized.endsWith(".geodraw") || normalized.endsWith(".json");
}

function hasFileDragPayload(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.files.length > 0) return true;
  if (Array.from(dataTransfer.items).some((item) => item.kind === "file")) return true;
  return Array.from(dataTransfer.types ?? []).includes("Files");
}

function collectDroppedFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];
  const directFiles = Array.from(dataTransfer.files ?? []);
  if (directFiles.length > 0) return directFiles;
  return Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function isValidSnapshotPayload(data: unknown): data is HistorySnapshot {
  if (!data || typeof data !== "object") return false;
  const root = data as Record<string, unknown>;
  if (!root.scene || typeof root.scene !== "object") return false;
  if (typeof root.activeTool !== "string") return false;
  const scene = root.scene as Record<string, unknown>;
  if (!Array.isArray(scene.points)) return false;
  if (!Array.isArray(scene.lines)) return false;
  if (!Array.isArray(scene.circles)) return false;
  if (!Array.isArray(scene.segments)) return false;
  if (scene.angles !== undefined && !Array.isArray(scene.angles)) return false;
  if (scene.numbers !== undefined && !Array.isArray(scene.numbers)) return false;
  if (scene.labels !== undefined && !Array.isArray(scene.labels)) return false;
  return true;
}
