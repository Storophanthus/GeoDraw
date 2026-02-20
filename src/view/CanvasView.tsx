import { useEffect, useMemo, useRef, useState } from "react";
import type { Vec2 } from "../geo/vec2";
import {
  beginSceneEvalTick,
  endSceneEvalTick,
  getPointWorldPos,
  type ScenePoint,
} from "../scene/points";
import { useGeoStore } from "../state/geoStore";
import { getCanvasColorTheme } from "../state/colorProfiles";
import type { Viewport } from "./camera";
import type { ConstructClickIo } from "./constructClickAdapter";
import { findBestSnap, type SnapCandidate } from "./snapEngine";
import {
  createAngleLabelOverlays,
  createPointLabelOverlays,
} from "./labelOverlays";
import { resolveAngles } from "./angleResolution";
import { CanvasLabelsLayer } from "./CanvasLabelsLayer";
import { renderCanvasFrame } from "./renderFrame";
import { useCanvasInteractionController, type PointerState } from "./useCanvasInteractionController";
import { isValidTarget } from "../tools/toolClick";
import { applyDilationToObject, applyReflectionToObject, applyTranslationToObject } from "../tools/objectTransforms";
import { snapWorldToRectGrid } from "../render/rectGrid";

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

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerState>({
    active: false,
    pid: -1,
    mode: "idle",
    pointId: null,
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

  const camera = useGeoStore((store) => store.camera);
  const activeTool = useGeoStore((store) => store.activeTool);
  const scene = useGeoStore((store) => store.scene);
  const colorProfileId = useGeoStore((store) => store.colorProfileId);
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
  const movePointLabelBy = useGeoStore((store) => store.movePointLabelBy);
  const moveAngleLabelTo = useGeoStore((store) => store.moveAngleLabelTo);
  const setCopyStyleSource = useGeoStore((store) => store.setCopyStyleSource);
  const applyCopyStyleTo = useGeoStore((store) => store.applyCopyStyleTo);
  const setExportClipWorld = useGeoStore((store) => store.setExportClipWorld);
  const setObjectVisibility = useGeoStore((store) => store.setObjectVisibility);
  const angleFixedTool = useGeoStore((store) => store.angleFixedTool);
  const circleFixedTool = useGeoStore((store) => store.circleFixedTool);
  const regularPolygonTool = useGeoStore((store) => store.regularPolygonTool);
  const transformTool = useGeoStore((store) => store.transformTool);

  const [vp, setVp] = useState<Viewport>({ widthPx: 800, heightPx: 600 });
  const [hoverScreen, setHoverScreen] = useState<Vec2 | null>(null);
  const [snapDisabled, setSnapDisabled] = useState(false);
  const canvasTheme = useMemo(() => getCanvasColorTheme(colorProfileId), [colorProfileId]);
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
    () => ({
      setPendingSelection,
      clearPendingSelection,
      createFreePoint,
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
          createPointByDilation,
          createPointByReflection,
          createPointOnLine,
          createSegment,
          createLine,
          createAngleBisectorLine,
          createCircle,
          createCircleThreePoint,
          createCircleFixedRadius,
          createPolygon,
          createAngle,
          createSector,
          setObjectVisibility,
        }),
      transformObjectByDilation: (source, centerId, factorExpr) =>
        applyDilationToObject(source, centerId, factorExpr, {
          scene,
          createPointByTranslation,
          createPointByDilation,
          createPointByReflection,
          createPointOnLine,
          createSegment,
          createLine,
          createAngleBisectorLine,
          createCircle,
          createCircleThreePoint,
          createCircleFixedRadius,
          createPolygon,
          createAngle,
          createSector,
          setObjectVisibility,
        }),
      transformObjectByReflection: (source, axis) =>
        applyReflectionToObject(source, axis, {
          scene,
          createPointByTranslation,
          createPointByDilation,
          createPointByReflection,
          createPointOnLine,
          createSegment,
          createLine,
          createAngleBisectorLine,
          createCircle,
          createCircleThreePoint,
          createCircleFixedRadius,
          createPolygon,
          createAngle,
          createSector,
          setObjectVisibility,
        }),
      createCircleCenterPoint,
      createIntersectionPoint,
      setSelectedObject,
      setCopyStyleSource,
      applyCopyStyleTo,
      setExportClipWorld,
      getPointWorldById: (id) => {
        const point = scene.points.find((p) => p.id === id);
        return point ? getPointWorldPos(point, scene) : null;
      },
      gridSnapEnabled: effectiveGridSnapEnabled,
      snapWorldToGrid: (world) => snapWorldToRectGrid(world, camera, gridSettings),
    }),
    [
      setPendingSelection,
      clearPendingSelection,
      createFreePoint,
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

  const hoverSnap: SnapCandidate | null = useMemo(() => {
    if (!hoverScreen) return null;
    if (snapDisabled) return null;
    return findBestSnap(hoverScreen, camera, vp, scene, POINT_HIT_TOLERANCE_PX, SNAP_OP_BUDGET_PER_FRAME);
  }, [hoverScreen, scene, snapDisabled]);

  const hoveredTargetValid = isValidTarget(activeTool, pendingSelection, hoveredHit);

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
      const selectedDrawableObject = selectedObject?.type === "number" ? null : selectedObject;
      const recentDrawableObject = recentCreatedObject?.type === "number" ? null : recentCreatedObject;
      const copySourceDrawable = copyStyle.source?.type === "number" ? null : copyStyle.source;
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
      movePointLabelBy,
      moveAngleLabelTo,
      setHoverScreen,
      setSnapDisabled,
      setCursorWorld,
      setHoveredHit,
      setSelectedObject,
      clearPendingSelection,
      zoomAtScreenPoint,
    },
  });

  return (
    <div className="canvasStack">
      <canvas ref={canvasRef} className="drawingCanvas" />
      <CanvasLabelsLayer
        labelsLayerRef={labelsLayerRef}
        labelOverlays={labelOverlays}
        angleLabelOverlays={angleLabelOverlays}
      />
    </div>
  );
}
