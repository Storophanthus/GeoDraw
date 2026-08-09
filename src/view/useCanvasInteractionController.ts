import { useEffect } from "react";
import type { RefObject } from "react";
import type { Vec2 } from "../geo/vec2";
import type { ActiveTool, HoveredHit, PendingSelection, SelectedObject } from "../state/geoStore";
import type { ExportClipWorld } from "../state/slices/storeTypes";
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
import {
  hitTestExportClipHandle,
  moveExportClipHandle,
  type ExportClipHandle,
} from "./exportClipHandles";
import { createCanvasAuxHandlers, createPointerHandlers } from "./pointerEventController";
import {
  computeCanvasCursor,
  decideMovePointerDown,
  shouldCancelOnCanvasDoubleClick,
  type PointerMode,
} from "./pointerInteraction";
import {
  hitTestAngleLabelHandle,
  hitTestObjectLabelFromDom,
  hitTestPointLabel,
  hitTestPointLabelFromDom,
  hitTestSpecificTextLabelFromDom,
  hitTestTextLabelFromDom,
  hitTestRichTextNodeFromDom,
  hitTestSpecificRichTextNodeFromDom,
} from "./labelHit";
import {
  hitTestAngleId as engineHitTestAngleId,
  hitTestCircleId as engineHitTestCircleId,
  hitTestEllipseId as engineHitTestEllipseId,
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
  clipHandle: ExportClipHandle | null;
  objectType: "point" | "angle" | "segment" | "line" | "circle" | "ellipse" | "polygon" | "textLabel" | "richText" | null;
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
  moveObjectLabelTo: (obj: { type: "segment" | "line" | "circle" | "ellipse" | "polygon"; id: string }, world: Vec2) => void;
  moveTextLabelTo: (id: string, world: Vec2) => void;
  moveTextLabelByWorldDelta: (id: string, deltaWorld: Vec2) => void;
  moveRichTextNodeByWorldDelta: (id: string, deltaWorld: Vec2) => void;
  setExportClipWorld: (clip: ExportClipWorld) => void;
  setHoverScreen: (value: Vec2 | null) => void;
  setSnapDisabled: (value: boolean) => void;
  setCursorWorld: (value: Vec2 | null) => void;
  setHoveredHit: (hit: HoveredHit) => void;
  setSelectedObject: (selected: { type: "point" | "line" | "segment" | "circle" | "ellipse" | "polygon" | "angle" | "textLabel" | "richText" | "number"; id: string } | null) => void;
  beginTextLabelEditing?: (id: string) => boolean;
  beginRichTextEditing?: (id: string) => boolean;
  clearPendingSelection: () => void;
  zoomAtScreenPoint: (vp: Viewport, screen: Vec2, zoomFactor: number) => void;
  onWheelZoom?: (zoomFactor: number) => void;
  openContextMenu?: (payload: {
    clientX: number;
    clientY: number;
    screen: Vec2;
    world: Vec2;
    target: Exclude<SelectedObject, null> | null;
  }) => void;
};

type InteractionDeps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  labelsLayerRef: RefObject<HTMLDivElement | null>;
  pointerRef: RefObject<PointerState>;
  dragBuffers: DragBufferRefs;
  activeTool: ActiveTool;
  pendingSelection: PendingSelection;
  copyStyleSource: { type: "point" | "line" | "segment" | "circle" | "ellipse" | "polygon" | "angle" | "textLabel" | "richText" | "number"; id: string } | null;
  scene: SceneModel;
  camera: Camera;
  vp: Viewport;
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>;
  resolvedAngles: ResolvedAngle[];
  hoveredHit: HoveredHit;
  exportClipWorld: ExportClipWorld | null;
  selectedObject: { type: "point" | "line" | "segment" | "circle" | "ellipse" | "polygon" | "angle" | "textLabel" | "richText" | "number"; id: string } | null;
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
    exportClipWorld,
    selectedObject,
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

    // Clip handles only exist while a crop area does, and only the move tool can
    // grab them — the clip tools themselves are busy drawing a replacement.
    const resolveClipHandle = (screen: Vec2): ExportClipHandle | null =>
      activeTool === "move" ? hitTestExportClipHandle(screen, exportClipWorld, camera, vp) : null;

    const applyCursor = (nextHovered: HoveredHit, modeOverride?: PointerMode, screen?: Vec2) => {
      const mode = modeOverride ?? pointerRef.current.mode;
      const hoveredClipHandle = screen ? resolveClipHandle(screen) : null;
      canvas.style.cursor = computeCanvasCursor(activeTool, mode, nextHovered, pendingSelection, hoveredClipHandle);
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
          moveTextLabelByWorldDelta: actions.moveTextLabelByWorldDelta,
          moveRichTextNodeByWorldDelta: actions.moveRichTextNodeByWorldDelta,
          moveExportClipHandleTo: (handle, world) => {
            if (!exportClipWorld) return;
            const result = moveExportClipHandle(exportClipWorld, handle, world);
            // A bound that crossed its opposite renames the grabbed handle; keep
            // the pointer holding the same physical corner/edge so the rest of
            // the drag still tracks the cursor.
            pointerRef.current.clipHandle = result.handle;
            actions.setExportClipWorld(result.clip);
          },
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

    const resolveCanvasHits = (screen: Vec2, clientX: number, clientY: number) => ({
      hitClipHandle: resolveClipHandle(screen),
      hitTextLabelId: hitTestTextLabelFromDom(clientX, clientY, labelsLayerRef.current),
      hitRichTextNodeId: hitTestRichTextNodeFromDom(clientX, clientY, labelsLayerRef.current),
      hitPointId: engineHitTestPointId(screen, resolvedPoints, camera, vp, tolerances.point),
      hitLabelId:
        hitTestPointLabelFromDom(clientX, clientY, labelsLayerRef.current) ??
        hitTestPointLabel(screen, resolvedPoints, camera, vp, pointLabelOffsetPx),
      hitAngleLabelId: hitTestAngleLabelHandle(screen, resolvedAngles, camera, vp, getAngleTextRenderSize),
      hitAngleId: engineHitTestAngleId(screen, resolvedAngles, camera, vp, tolerances.angle),
      hitSegmentId: engineHitTestSegmentId(screen, scene, camera, vp, tolerances.segment),
      hitPolygonId: engineHitTestPolygonId(screen, scene, camera, vp, tolerances.segment),
      hitLineId: engineHitTestLineId(screen, scene, camera, vp, tolerances.line),
      hitCircleId: engineHitTestCircleId(screen, scene, camera, vp, tolerances.circle),
      hitEllipseId: engineHitTestEllipseId(screen, scene, camera, vp, tolerances.circle),
      hitObjectLabel: hitTestObjectLabelFromDom(clientX, clientY, labelsLayerRef.current),
    });

    const resolveContextTarget = (hits: ReturnType<typeof resolveCanvasHits>): Exclude<SelectedObject, null> | null => {
      const decision = decideMovePointerDown({
        ...hits,
        scenePoints: scene.points,
        sceneSegments: scene.segments,
        sceneAngles: scene.angles,
      });
      return decision.selectedObject;
    };

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
      beginTextLabelEditing: actions.beginTextLabelEditing,
      resolveHits: (screen, e) => resolveCanvasHits(screen, e.clientX, e.clientY),
      decideMovePointerDown: (hits) =>
        decideMovePointerDown({
          ...hits,
          scenePoints: scene.points,
          sceneSegments: scene.segments,
          sceneAngles: scene.angles,
        }),
      onToolClickRelease: (screen, e, hits) =>
        runConstructClickAdapter({
          screen,
          pointerEvent: e,
          preHitTextLabelId: hits.hitTextLabelId ?? null,
          preHitRichTextNodeId: hits.hitRichTextNodeId ?? null,
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
          io: {
            ...constructClickIo,
            beginTextLabelEditing: actions.beginTextLabelEditing,
            beginRichTextEditing: actions.beginRichTextEditing,
          },
        }),
    });

    const { onWheel, onLeave, cancelPendingWheelZoom } = createCanvasAuxHandlers({
      canvas,
      readScreen,
      setHoverScreen: actions.setHoverScreen,
      setCursorWorldFromScreen: (screen) => actions.setCursorWorld(camMath.screenToWorld(screen, camera, vp)),
      setCursorWorldNull: () => actions.setCursorWorld(null),
      setHoveredHit: actions.setHoveredHit,
      zoomAtScreenPoint: (screen, zoomFactor) => actions.zoomAtScreenPoint(vp, screen, zoomFactor),
      onWheelZoom: actions.onWheelZoom,
    });

    const onDoubleClick = (e: MouseEvent) => {
      if (activeTool === "move") {
        const hitRichTextNodeId = hitTestRichTextNodeFromDom(e.clientX, e.clientY, labelsLayerRef.current);
        if (hitRichTextNodeId) {
          e.preventDefault();
          actions.beginRichTextEditing?.(hitRichTextNodeId);
          return;
        }
        if (
          selectedObject?.type === "richText"
          && hitTestSpecificRichTextNodeFromDom(e.clientX, e.clientY, labelsLayerRef.current, selectedObject.id, 12)
        ) {
          e.preventDefault();
          actions.beginRichTextEditing?.(selectedObject.id);
          return;
        }

        const hitTextLabelId = hitTestTextLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current);
        if (hitTextLabelId) {
          e.preventDefault();
          actions.beginTextLabelEditing?.(hitTextLabelId);
          return;
        }
        if (
          selectedObject?.type === "textLabel"
          && hitTestSpecificTextLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current, selectedObject.id, 12)
        ) {
          e.preventDefault();
          actions.beginTextLabelEditing?.(selectedObject.id);
          return;
        }
      }
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

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const screen = readScreen(e);
      const hits = resolveCanvasHits(screen, e.clientX, e.clientY);
      const target = resolveContextTarget(hits);
      if (target) actions.setSelectedObject(target);
      actions.openContextMenu?.({
        clientX: e.clientX,
        clientY: e.clientY,
        screen,
        world: camMath.screenToWorld(screen, camera, vp),
        target,
      });
    };

    const unbind = bindCanvasEventLifecycle(canvas, {
      onDown,
      onMove,
      onFinish: finish,
      onDoubleClick,
      onContextMenu,
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
    exportClipWorld,
    selectedObject,
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
