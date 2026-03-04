import { useEffect } from "react";
import type { RefObject } from "react";
import type { Vec2 } from "../geo/vec2";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import type { Camera, Viewport } from "./camera";
import { camera as camMath } from "./camera";
import { runConstructClickAdapter, type ConstructClickIo } from "./constructClickAdapter";
import { applyBufferedDragUpdate } from "./pointerDragInteraction";
import { bindCanvasEventLifecycle } from "./canvasEventLifecycle";
import {
  createDragBufferAccess,
  createHoveredHitResolver,
  createReadScreen,
} from "./canvasInteractionHelpers";
import { getAngleTextRenderSize, type ResolvedAngle } from "./labelOverlays";
import { createCanvasAuxHandlers, createPointerHandlers } from "./pointerEventController";
import {
  computeCanvasCursor,
  decideMovePointerDown,
  shouldCancelOnCanvasDoubleClick,
  type PointerMode,
} from "./pointerInteraction";
import { hitTestAngleLabelHandle, hitTestObjectLabelFromDom, hitTestPointLabel, hitTestPointLabelFromDom, hitTestTextLabelFromDom } from "./labelHit";
import {
  hitTestAngleId as engineHitTestAngleId,
  hitTestCircleId as engineHitTestCircleId,
  hitTestLineId as engineHitTestLineId,
  hitTestPolygonId as engineHitTestPolygonId,
  hitTestPointId as engineHitTestPointId,
  hitTestSegmentId as engineHitTestSegmentId,
} from "../engine";
import type { SceneModel, ScenePoint } from "../scene/points";
import type {
  AngleFixedToolState,
  CircleFixedToolState,
  RegularPolygonToolState,
  TransformToolState,
} from "./previews/pendingPreview";

export type PointerState = {
  active: boolean;
  pid: number;
  mode: PointerMode;
  pointId: string | null;
  objectType: "point" | "angle" | "segment" | "line" | "circle" | "polygon" | "textLabel" | null;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type DragBufferRefs = {
  dragFrameRef: RefObject<number | null>;
  dragPanDeltaRef: RefObject<Vec2>;
  dragLabelDeltaRef: RefObject<Vec2>;
  dragPointScreenRef: RefObject<Vec2 | null>;
  dragPointIdRef: RefObject<string | null>;
  dragAngleLabelScreenRef: RefObject<Vec2 | null>;
};

type InteractionActions = {
  panByScreenDelta: (delta: Vec2) => void;
  movePointTo: (id: string, world: Vec2) => void;
  movePolygonByWorldDelta: (id: string, deltaWorld: Vec2) => void;
  movePointLabelBy: (id: string, deltaScreenPx: Vec2) => void;
  moveAngleLabelTo: (id: string, world: Vec2) => void;
  moveObjectLabelTo: (obj: { type: "segment" | "line" | "circle" | "polygon"; id: string }, world: Vec2) => void;
  moveTextLabelTo: (id: string, world: Vec2) => void;
  setHoverScreen: (value: Vec2 | null) => void;
  setSnapDisabled: (value: boolean) => void;
  setCursorWorld: (value: Vec2 | null) => void;
  setHoveredHit: (hit: HoveredHit) => void;
  setSelectedObject: (selected: { type: "point" | "line" | "segment" | "circle" | "polygon" | "angle" | "textLabel" | "number"; id: string } | null) => void;
  clearPendingSelection: () => void;
  zoomAtScreenPoint: (vp: Viewport, screen: Vec2, zoomFactor: number) => void;
};

type InteractionDeps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  labelsLayerRef: RefObject<HTMLDivElement | null>;
  pointerRef: RefObject<PointerState>;
  dragBuffers: DragBufferRefs;
  activeTool: ActiveTool;
  pendingSelection: PendingSelection;
  copyStyleSource: { type: "point" | "line" | "segment" | "circle" | "polygon" | "angle" | "textLabel" | "number"; id: string } | null;
  scene: SceneModel;
  camera: Camera;
  vp: Viewport;
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>;
  resolvedAngles: ResolvedAngle[];
  hoveredHit: HoveredHit;
  pointLabelOffsetPx: Vec2;
  angleFixedTool: AngleFixedToolState;
  circleFixedTool: CircleFixedToolState;
  regularPolygonTool: RegularPolygonToolState;
  transformTool: TransformToolState;
  constructClickIo: ConstructClickIo;
  tolerances: { point: number; angle: number; segment: number; line: number; circle: number };
  clickEpsilonPx: number;
  actions: InteractionActions;
};

export function useCanvasInteractionController(deps: InteractionDeps) {
  const {
    canvasRef,
    labelsLayerRef,
    pointerRef,
    dragBuffers,
    activeTool,
    pendingSelection,
    copyStyleSource,
    scene,
    camera,
    vp,
    resolvedPoints,
    resolvedAngles,
    hoveredHit,
    pointLabelOffsetPx,
    angleFixedTool,
    circleFixedTool,
    regularPolygonTool,
    transformTool,
    constructClickIo,
    tolerances,
    clickEpsilonPx,
    actions,
  } = deps;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const readScreen = createReadScreen(canvas);
    const computeHoveredHit = createHoveredHitResolver({
      resolvedPoints,
      resolvedAngles,
      scene,
      camera,
      vp,
      tolerances,
    });

    const applyCursor = (nextHovered: HoveredHit, modeOverride?: PointerMode) => {
      const mode = modeOverride ?? pointerRef.current.mode;
      canvas.style.cursor = computeCanvasCursor(activeTool, mode, nextHovered, pendingSelection);
    };

    const flushDragUpdate = () => {
      dragBuffers.dragFrameRef.current = null;
      const st = pointerRef.current;
      applyBufferedDragUpdate(
        st,
        {
          getPanDelta: () => dragBuffers.dragPanDeltaRef.current,
          setPanDelta: (next) => {
            dragBuffers.dragPanDeltaRef.current = next;
          },
          getLabelDelta: () => dragBuffers.dragLabelDeltaRef.current,
          setLabelDelta: (next) => {
            dragBuffers.dragLabelDeltaRef.current = next;
          },
          getPointScreen: () => dragBuffers.dragPointScreenRef.current,
          setPointScreen: (next) => {
            dragBuffers.dragPointScreenRef.current = next;
          },
          getPointId: () => dragBuffers.dragPointIdRef.current,
          setPointId: (next) => {
            dragBuffers.dragPointIdRef.current = next;
          },
          getAngleLabelScreen: () => dragBuffers.dragAngleLabelScreenRef.current,
          setAngleLabelScreen: (next) => {
            dragBuffers.dragAngleLabelScreenRef.current = next;
          },
        },
        {
          panByScreenDelta: actions.panByScreenDelta,
          movePointTo: actions.movePointTo,
          movePolygonByWorldDelta: actions.movePolygonByWorldDelta,
          movePointLabelBy: actions.movePointLabelBy,
          moveAngleLabelTo: actions.moveAngleLabelTo,
          moveObjectLabelTo: actions.moveObjectLabelTo,
          moveTextLabelTo: actions.moveTextLabelTo,
          screenToWorld: (screen) => camMath.screenToWorld(screen, camera, vp),
          screenDeltaToWorldDelta: (delta) => {
            const world0 = camMath.screenToWorld({ x: 0, y: 0 }, camera, vp);
            const world1 = camMath.screenToWorld(delta, camera, vp);
            return {
              x: world1.x - world0.x,
              y: world1.y - world0.y,
            };
          },
        }
      );
    };

    const scheduleDragUpdate = () => {
      if (dragBuffers.dragFrameRef.current !== null) return;
      dragBuffers.dragFrameRef.current = window.requestAnimationFrame(flushDragUpdate);
    };

    applyCursor(hoveredHit);

    const dragBufferAccess = createDragBufferAccess({
      dragPanDeltaRef: dragBuffers.dragPanDeltaRef,
      dragLabelDeltaRef: dragBuffers.dragLabelDeltaRef,
      dragPointScreenRef: dragBuffers.dragPointScreenRef,
      dragPointIdRef: dragBuffers.dragPointIdRef,
      dragAngleLabelScreenRef: dragBuffers.dragAngleLabelScreenRef,
    });

    const { onDown, onMove, finish, cancelPendingHoverUpdate } = createPointerHandlers({
      canvas,
      activeTool,
      pendingSelection,
      pointerRef,
      dragFrameRef: dragBuffers.dragFrameRef,
      dragBuffers: dragBufferAccess,
      clickEpsilonPx,
      readScreen,
      computeHoveredHit,
      applyCursor,
      scheduleDragUpdate,
      flushDragUpdate,
      setHoverScreen: actions.setHoverScreen,
      setSnapDisabled: actions.setSnapDisabled,
      setCursorWorldFromScreen: (screen) => actions.setCursorWorld(camMath.screenToWorld(screen, camera, vp)),
      setHoveredHit: actions.setHoveredHit,
      setSelectedObject: actions.setSelectedObject,
      resolveHits: (screen, e) => ({
        hitTextLabelId: hitTestTextLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current),
        hitPointId: engineHitTestPointId(screen, resolvedPoints, camera, vp, tolerances.point),
        hitLabelId:
          hitTestPointLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current) ??
          hitTestPointLabel(screen, resolvedPoints, camera, vp, pointLabelOffsetPx),
        hitAngleLabelId: hitTestAngleLabelHandle(screen, resolvedAngles, camera, vp, getAngleTextRenderSize),
        hitAngleId: engineHitTestAngleId(screen, resolvedAngles, camera, vp, tolerances.angle),
        hitSegmentId: engineHitTestSegmentId(screen, scene, camera, vp, tolerances.segment),
        hitPolygonId: engineHitTestPolygonId(screen, scene, camera, vp, tolerances.segment),
        hitLineId: engineHitTestLineId(screen, scene, camera, vp, tolerances.line),
        hitCircleId: engineHitTestCircleId(screen, scene, camera, vp, tolerances.circle),
        hitObjectLabel: hitTestObjectLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current),
      }),
      decideMovePointerDown: (hits) =>
        decideMovePointerDown({
          ...hits,
          scenePoints: scene.points,
        }),
      onToolClickRelease: (screen, e, hits) =>
        runConstructClickAdapter({
          screen,
          pointerEvent: e,
          preHitTextLabelId: hits.hitTextLabelId ?? null,
          activeTool,
          pendingSelection,
          copyStyleSource,
          scene,
          resolvedPoints,
          camera,
          vp,
          angleFixedTool,
          regularPolygonTool,
          transformTool,
          tolerances,
          io: constructClickIo,
        }),
      zoomAtScreenPoint: (screen, factor) => actions.zoomAtScreenPoint(vp, screen, factor),
      panByScreenDelta: actions.panByScreenDelta,
    });

    const { onWheel, onLeave, cancelPendingWheelZoom } = createCanvasAuxHandlers({
      canvas,
      readScreen,
      setHoverScreen: actions.setHoverScreen,
      setCursorWorldFromScreen: (screen) => actions.setCursorWorld(camMath.screenToWorld(screen, camera, vp)),
      setCursorWorldNull: () => actions.setCursorWorld(null),
      setHoveredHit: actions.setHoveredHit,
      zoomAtScreenPoint: (screen, zoomFactor) => actions.zoomAtScreenPoint(vp, screen, zoomFactor),
    });

    const onDoubleClick = (e: MouseEvent) => {
      if (!shouldCancelOnCanvasDoubleClick(activeTool, pendingSelection)) return;
      e.preventDefault();
      if (pendingSelection) {
        actions.clearPendingSelection();
        return;
      }
      if (activeTool === "move") {
        actions.setSelectedObject(null);
      }
    };

    const unbind = bindCanvasEventLifecycle(canvas, {
      onDown,
      onMove,
      onFinish: finish,
      onDoubleClick,
      onLeave,
      onWheel,
    });

    return () => {
      cancelPendingWheelZoom();
      cancelPendingHoverUpdate();
      if (dragBuffers.dragFrameRef.current !== null) {
        cancelAnimationFrame(dragBuffers.dragFrameRef.current);
        dragBuffers.dragFrameRef.current = null;
      }
      unbind();
    };
  }, [
    activeTool,
    constructClickIo,
    camera,
    copyStyleSource,
    angleFixedTool,
    circleFixedTool,
    regularPolygonTool,
    transformTool,
    tolerances,
    actions,
    clickEpsilonPx,
    hoveredHit,
    pendingSelection,
    pointLabelOffsetPx,
    resolvedPoints,
    resolvedAngles,
    scene,
    pointerRef,
    dragBuffers,
    canvasRef,
    labelsLayerRef,
    vp,
  ]);
}
