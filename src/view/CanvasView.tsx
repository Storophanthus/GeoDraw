import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import type { Vec2 } from "../geo/vec2";
import { add, mul, projectPointToLine, projectPointToSegment, sub } from "../geo/geometry";
import { drawRectGrid, type RectGridSettings } from "../render/rectGrid";
import {
  beginSceneEvalTick,
  computeConvexAngleRad,
  endSceneEvalTick,
  type GeometryObjectRef,
  type LineLikeObjectRef,
  getPointWorldPos,
  isPointDraggable,
  type PointShape,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";
import { geoStoreHelpers, useGeoStore } from "../state/geoStore";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import type { Camera } from "./camera";
import { camera as camMath, type Viewport } from "./camera";
import { findBestSnap, type SnapCandidate } from "./snapEngine";

const POINT_HIT_TOLERANCE_PX = 12;
const SEGMENT_HIT_TOLERANCE_PX = 10;
const LINE_HIT_TOLERANCE_PX = 10;
const CIRCLE_HIT_TOLERANCE_PX = 10;
const ANGLE_HIT_TOLERANCE_PX = 10;
const CLICK_EPSILON_PX = 3;

const GRID_SETTINGS: RectGridSettings = {
  enabled: true,
  rotationRad: 0,
  targetSpacingPx: 40,
  majorEvery: 5,
  minorOpacity: 0.06,
  majorOpacity: 0.12,
  minorWidth: 1,
  majorWidth: 1.5,
};

type PointerMode = "idle" | "pan" | "drag-point" | "drag-label" | "drag-angle-label" | "tool-click";

type PointerState = {
  active: boolean;
  pid: number;
  mode: PointerMode;
  pointId: string | null;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

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
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const recentCreatedObject = useGeoStore((store) => store.recentCreatedObject);
  const hoveredHit = useGeoStore((store) => store.hoveredHit);
  const cursorWorld = useGeoStore((store) => store.cursorWorld);
  const pendingSelection = useGeoStore((store) => store.pendingSelection);
  const copyStyle = useGeoStore((store) => store.copyStyle);
  const pointDefaults = useGeoStore((store) => store.pointDefaults);

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
  const createCircle = useGeoStore((store) => store.createCircle);
  const createPerpendicularLine = useGeoStore((store) => store.createPerpendicularLine);
  const createParallelLine = useGeoStore((store) => store.createParallelLine);
  const createAngle = useGeoStore((store) => store.createAngle);
  const createMidpointFromPoints = useGeoStore((store) => store.createMidpointFromPoints);
  const createMidpointFromSegment = useGeoStore((store) => store.createMidpointFromSegment);
  const createPointOnLine = useGeoStore((store) => store.createPointOnLine);
  const createPointOnSegment = useGeoStore((store) => store.createPointOnSegment);
  const createPointOnCircle = useGeoStore((store) => store.createPointOnCircle);
  const createIntersectionPoint = useGeoStore((store) => store.createIntersectionPoint);
  const movePointTo = useGeoStore((store) => store.movePointTo);
  const movePointLabelBy = useGeoStore((store) => store.movePointLabelBy);
  const moveAngleLabelTo = useGeoStore((store) => store.moveAngleLabelTo);
  const setCopyStyleSource = useGeoStore((store) => store.setCopyStyleSource);
  const applyCopyStyleTo = useGeoStore((store) => store.applyCopyStyleTo);

  const [vp, setVp] = useState<Viewport>({ widthPx: 800, heightPx: 600 });
  const [hoverScreen, setHoverScreen] = useState<Vec2 | null>(null);
  const [snapDisabled, setSnapDisabled] = useState(false);

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

  const resolvedAngles = useMemo(
    () =>
      scene.angles
        .map((angle) => {
          const aPoint = scene.points.find((p) => p.id === angle.aId);
          const bPoint = scene.points.find((p) => p.id === angle.bId);
          const cPoint = scene.points.find((p) => p.id === angle.cId);
          if (!aPoint || !bPoint || !cPoint) return null;
          const a = getPointWorldPos(aPoint, scene);
          const b = getPointWorldPos(bPoint, scene);
          const c = getPointWorldPos(cPoint, scene);
          if (!a || !b || !c) return null;
          const theta = computeConvexAngleRad(a, b, c);
          if (theta === null) return null;
          return { angle, a, b, c, theta };
        })
        .filter((item): item is { angle: SceneModel["angles"][number]; a: Vec2; b: Vec2; c: Vec2; theta: number } => Boolean(item)),
    [scene]
  );

  const labelOverlays = useMemo(() => {
    return resolvedPoints
      .filter(({ point }) => point.visible && point.showLabel === "caption" && Boolean(point.captionTex))
      .map(({ point, world }) => {
        const screen = camMath.worldToScreen(world, camera, vp);
        const offset = point.style.labelOffsetPx;
        const x = screen.x + offset.x;
        const y = screen.y + offset.y;
        const html = katex.renderToString(point.captionTex || "", {
          throwOnError: false,
          displayMode: false,
          strict: "ignore",
        });
        return {
          id: point.id,
          x,
          y,
          html,
          labelFontPx: point.style.labelFontPx,
          labelColor: point.style.labelColor,
          labelHaloColor: point.style.labelHaloColor,
          labelHaloWidthPx: point.style.labelHaloWidthPx,
        };
      });
  }, [camera, resolvedPoints, vp]);

  const angleLabelOverlays = useMemo(() => {
    return resolvedAngles
      .filter(({ angle }) => angle.visible)
      .map(({ angle, theta }) => {
        const tex = buildAngleLabelTex(angle.style.labelText, angle.style.showLabel, angle.style.showValue, theta);
        if (!tex) return null;
        const screen = camMath.worldToScreen(angle.style.labelPosWorld, camera, vp);
        const html = katex.renderToString(tex, {
          throwOnError: false,
          displayMode: false,
          strict: "ignore",
        });
        return {
          id: angle.id,
          x: screen.x,
          y: screen.y,
          html,
          textSize: angle.style.textSize,
          textColor: angle.style.textColor,
        };
      })
      .filter((item): item is { id: string; x: number; y: number; html: string; textSize: number; textColor: string } => Boolean(item));
  }, [camera, resolvedAngles, vp]);

  const hoverSnap: SnapCandidate | null = useMemo(() => {
    if (!hoverScreen) return null;
    if (snapDisabled) return null;
    return findBestSnap(hoverScreen, camera, vp, scene, POINT_HIT_TOLERANCE_PX);
  }, [camera, hoverScreen, scene, snapDisabled, vp]);

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
      beginSceneEvalTick(scene);
      try {
        canvas.width = Math.max(1, Math.floor(vp.widthPx * dpr));
        canvas.height = Math.max(1, Math.floor(vp.heightPx * dpr));

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, vp.widthPx, vp.heightPx);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, vp.widthPx, vp.heightPx);

        drawRectGrid(ctx, camera, vp, GRID_SETTINGS);
        drawCircles(ctx, scene, camera, vp, selectedObject, recentCreatedObject, copyStyle.source);
        drawLines(ctx, scene, camera, vp, selectedObject, recentCreatedObject, copyStyle.source);
        drawSegments(ctx, scene, camera, vp, selectedObject, recentCreatedObject, copyStyle.source);
        drawAngles(ctx, resolvedAngles, camera, vp, selectedObject, recentCreatedObject);
        drawPendingPreview(ctx, pendingSelection, cursorWorld, hoverScreen, hoverSnap, hoveredHit, scene, camera, vp);
        drawPoints(ctx, resolvedPoints, selectedObject, camera, vp, copyStyle.source);
        drawInteractionHighlights(
          ctx,
          activeTool,
          pendingSelection,
          hoveredHit,
          hoveredTargetValid,
          resolvedPoints,
          scene,
          camera,
          vp
        );

        if (hoverSnap && (activeTool === "point" || activeTool === "move")) {
          const s = camMath.worldToScreen(hoverSnap.world, camera, vp);
          ctx.save();
          ctx.beginPath();
          ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#f97316";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          if (hoverSnap.kind === "intersection" && hoverSnap.objA && hoverSnap.objB) {
            highlightSnapObject(ctx, hoverSnap.objA, scene, camera, vp);
            highlightSnapObject(ctx, hoverSnap.objB, scene, camera, vp);
          }
          ctx.restore();
        }
      } finally {
        endSceneEvalTick(scene);
      }
    },
    [
      activeTool,
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
      vp,
    ]
  );

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const readScreen = (e: PointerEvent | WheelEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const computeHoveredHit = (screen: Vec2): HoveredHit => {
      const pointId = hitTestPoint(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX);
      if (pointId) return { type: "point", id: pointId };
      const angleId = hitTestAngle(screen, resolvedAngles, camera, vp, ANGLE_HIT_TOLERANCE_PX);
      if (angleId) return { type: "angle", id: angleId };
      const segmentId = hitTestSegment(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX);
      if (segmentId) return { type: "segment", id: segmentId };
      const lineId = hitTestLine(screen, scene, camera, vp, LINE_HIT_TOLERANCE_PX);
      if (lineId) return { type: "line2p", id: lineId };
      const circleId = hitTestCircle(screen, scene, camera, vp, CIRCLE_HIT_TOLERANCE_PX);
      if (circleId) return { type: "circle", id: circleId };
      return null;
    };

    const applyCursor = (nextHovered: HoveredHit, modeOverride?: PointerMode) => {
      const mode = modeOverride ?? pointerRef.current.mode;
      let nextCursor = "default";

      if (activeTool === "move") {
        if (mode === "pan" || mode === "drag-point" || mode === "drag-label" || mode === "drag-angle-label") {
          nextCursor = "grabbing";
        } else if (nextHovered?.type === "point" || nextHovered?.type === "angle") {
          nextCursor = "pointer";
        } else {
          nextCursor = "grab";
        }
      } else if (nextHovered && isValidTarget(activeTool, pendingSelection, nextHovered)) {
        nextCursor = "pointer";
      } else if (toolAllowsEmptyPointCreation(activeTool, pendingSelection)) {
        nextCursor = "crosshair";
      }

      canvas.style.cursor = nextCursor;
    };

    const flushDragUpdate = () => {
      dragFrameRef.current = null;
      const st = pointerRef.current;
      if (!st.active) return;
      if (st.mode === "pan") {
        const delta = dragPanDeltaRef.current;
        if (delta.x !== 0 || delta.y !== 0) {
          panByScreenDelta(delta);
          dragPanDeltaRef.current = { x: 0, y: 0 };
        }
        return;
      }
      if (st.mode === "drag-label" && st.pointId) {
        const delta = dragLabelDeltaRef.current;
        if (delta.x !== 0 || delta.y !== 0) {
          movePointLabelBy(st.pointId, delta);
          dragLabelDeltaRef.current = { x: 0, y: 0 };
        }
        return;
      }
      if (st.mode === "drag-angle-label" && st.pointId) {
        const angleLabelScreen = dragAngleLabelScreenRef.current;
        if (angleLabelScreen) {
          const world = camMath.screenToWorld(angleLabelScreen, camera, vp);
          moveAngleLabelTo(st.pointId, world);
        }
        return;
      }
      if (st.mode === "drag-point" && st.pointId) {
        const screen = dragPointScreenRef.current;
        const pointId = dragPointIdRef.current;
        if (screen && pointId) {
          const world = camMath.screenToWorld(screen, camera, vp);
          movePointTo(pointId, world);
        }
      }
    };

    const scheduleDragUpdate = () => {
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = window.requestAnimationFrame(flushDragUpdate);
    };

    applyCursor(hoveredHit);

    const onDown = (e: PointerEvent) => {
      const screen = readScreen(e);
      setHoverScreen(screen);
      setSnapDisabled(e.shiftKey);
      setCursorWorld(camMath.screenToWorld(screen, camera, vp));
      const hovered = computeHoveredHit(screen);
      setHoveredHit(hovered);
      const hitPointId = hitTestPoint(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX);
      const hitLabelId =
        hitTestLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current) ??
        hitTestLabel(screen, resolvedPoints, camera, vp, pointDefaults.labelOffsetPx);
      const hitAngleLabelId = hitTestAngleLabel(screen, resolvedAngles, camera, vp);
      const hitAngleId = hitTestAngle(screen, resolvedAngles, camera, vp, ANGLE_HIT_TOLERANCE_PX);
      const hitSegmentId = hitTestSegment(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX);
      const hitLineId = hitTestLine(screen, scene, camera, vp, LINE_HIT_TOLERANCE_PX);
      const hitCircleId = hitTestCircle(screen, scene, camera, vp, CIRCLE_HIT_TOLERANCE_PX);

      let mode: PointerMode = "idle";
      let pointId: string | null = null;

      if (activeTool === "move") {
        if (hitLabelId) {
          mode = "drag-label";
          pointId = hitLabelId;
          setSelectedObject({ type: "point", id: hitLabelId });
        } else if (hitAngleLabelId) {
          mode = "drag-angle-label";
          pointId = hitAngleLabelId;
          setSelectedObject({ type: "angle", id: hitAngleLabelId });
        } else if (hitPointId) {
          const hitPoint = scene.points.find((item) => item.id === hitPointId) ?? null;
          setSelectedObject({ type: "point", id: hitPointId });
          if (hitPoint && isPointDraggable(hitPoint)) {
            mode = "drag-point";
            pointId = hitPointId;
          }
        } else if (hitSegmentId) {
          setSelectedObject({ type: "segment", id: hitSegmentId });
          mode = "idle";
        } else if (hitLineId) {
          setSelectedObject({ type: "line", id: hitLineId });
          mode = "idle";
        } else if (hitCircleId) {
          setSelectedObject({ type: "circle", id: hitCircleId });
          mode = "idle";
        } else if (hitAngleId) {
          setSelectedObject({ type: "angle", id: hitAngleId });
          mode = "idle";
        } else {
          mode = "pan";
          setSelectedObject(null);
        }
      } else {
        mode = "tool-click";
      }

      canvas.setPointerCapture(e.pointerId);
      pointerRef.current = {
        active: true,
        pid: e.pointerId,
        mode,
        pointId,
        lastX: e.clientX,
        lastY: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      applyCursor(hovered, mode);
    };

    const onMove = (e: PointerEvent) => {
      const screen = readScreen(e);
      const st = pointerRef.current;
      if (st.active && st.pid === e.pointerId && st.mode !== "tool-click") {
        setSnapDisabled(e.shiftKey);
        const dx = e.clientX - st.lastX;
        const dy = e.clientY - st.lastY;
        st.lastX = e.clientX;
        st.lastY = e.clientY;

        const travelX = e.clientX - st.startX;
        const travelY = e.clientY - st.startY;
        if (travelX * travelX + travelY * travelY > CLICK_EPSILON_PX * CLICK_EPSILON_PX) {
          st.moved = true;
        }

        if (st.mode === "pan") {
          dragPanDeltaRef.current = {
            x: dragPanDeltaRef.current.x + dx,
            y: dragPanDeltaRef.current.y + dy,
          };
          scheduleDragUpdate();
          return;
        }

        if (st.mode === "drag-point" && st.pointId) {
          dragPointIdRef.current = st.pointId;
          dragPointScreenRef.current = screen;
          scheduleDragUpdate();
          return;
        }

        if (st.mode === "drag-label" && st.pointId) {
          dragLabelDeltaRef.current = {
            x: dragLabelDeltaRef.current.x + dx,
            y: dragLabelDeltaRef.current.y + dy,
          };
          scheduleDragUpdate();
        }

        if (st.mode === "drag-angle-label" && st.pointId) {
          dragAngleLabelScreenRef.current = screen;
          scheduleDragUpdate();
        }
        return;
      }

      setHoverScreen(screen);
      setSnapDisabled(e.shiftKey);
      setCursorWorld(camMath.screenToWorld(screen, camera, vp));
      const hovered = computeHoveredHit(screen);
      setHoveredHit(hovered);
      applyCursor(hovered);

      if (!st.active || st.pid !== e.pointerId) return;

      const dx = e.clientX - st.lastX;
      const dy = e.clientY - st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;

      const travelX = e.clientX - st.startX;
      const travelY = e.clientY - st.startY;
      if (travelX * travelX + travelY * travelY > CLICK_EPSILON_PX * CLICK_EPSILON_PX) {
        st.moved = true;
      }

      if (st.mode === "pan") {
        dragPanDeltaRef.current = {
          x: dragPanDeltaRef.current.x + dx,
          y: dragPanDeltaRef.current.y + dy,
        };
        scheduleDragUpdate();
        return;
      }

      if (st.mode === "drag-point" && st.pointId) {
        dragPointIdRef.current = st.pointId;
        dragPointScreenRef.current = screen;
        scheduleDragUpdate();
        return;
      }

      if (st.mode === "drag-label" && st.pointId) {
        dragLabelDeltaRef.current = {
          x: dragLabelDeltaRef.current.x + dx,
          y: dragLabelDeltaRef.current.y + dy,
        };
        scheduleDragUpdate();
      }

      if (st.mode === "drag-angle-label" && st.pointId) {
        dragAngleLabelScreenRef.current = screen;
        scheduleDragUpdate();
      }
    };

    const finish = (e: PointerEvent) => {
      const st = pointerRef.current;
      if (!st.active || st.pid !== e.pointerId) return;
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      flushDragUpdate();

      if (st.mode === "tool-click" && !st.moved) {
        const screen = readScreen(e);
        const hitObject = hitTestTopObject(screen, resolvedPoints, resolvedAngles, scene, camera, vp);
        const snap =
          !e.shiftKey && activeTool !== "move" && activeTool !== "copyStyle"
            ? findBestSnap(screen, camera, vp, scene, POINT_HIT_TOLERANCE_PX)
            : null;
        handleToolClick(screen, activeTool, pendingSelection, {
          hitPointId: hitTestPoint(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX),
          hitSegmentId: hitTestSegment(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX),
          hitObject,
          shiftKey: e.shiftKey,
          hasCopyStyleSource: Boolean(copyStyle.source),
          snap,
        }, {
          setPendingSelection,
          clearPendingSelection,
          createFreePoint,
          createSegment,
          createLine,
          createCircle,
          createPerpendicularLine,
          createParallelLine,
          createAngle,
          createMidpointFromPoints,
          createMidpointFromSegment,
          createPointOnLine,
          createPointOnSegment,
          createPointOnCircle,
          createIntersectionPoint,
          setSelectedObject,
          setCopyStyleSource,
          applyCopyStyleTo,
          camera,
          vp,
        });
      }

      pointerRef.current = {
        active: false,
        pid: -1,
        mode: "idle",
        pointId: null,
        lastX: 0,
        lastY: 0,
        startX: 0,
        startY: 0,
        moved: false,
      };
      dragPanDeltaRef.current = { x: 0, y: 0 };
      dragLabelDeltaRef.current = { x: 0, y: 0 };
      dragPointScreenRef.current = null;
      dragPointIdRef.current = null;
      dragAngleLabelScreenRef.current = null;
      setSnapDisabled(e.shiftKey);
      const screen = readScreen(e);
      const hovered = computeHoveredHit(screen);
      setHoveredHit(hovered);
      applyCursor(hovered);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const screen = readScreen(e);
      const zoomFactor = Math.pow(1.0015, -e.deltaY);
      zoomAtScreenPoint(vp, screen, zoomFactor);
    };

    const onLeave = () => {
      setHoverScreen(null);
      setCursorWorld(null);
      setHoveredHit(null);
      canvas.style.cursor = "default";
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", finish);
      canvas.removeEventListener("pointercancel", finish);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [
    activeTool,
    camera,
    copyStyle.source,
    createFreePoint,
    createLine,
    createCircle,
    createPerpendicularLine,
    createParallelLine,
    createAngle,
    clearPendingSelection,
    createMidpointFromPoints,
    createMidpointFromSegment,
    createPointOnLine,
    createPointOnSegment,
    createPointOnCircle,
    createIntersectionPoint,
    applyCopyStyleTo,
    createSegment,
    movePointLabelBy,
    moveAngleLabelTo,
    movePointTo,
    panByScreenDelta,
    hoveredHit,
    pendingSelection,
    pointDefaults.labelOffsetPx,
    resolvedPoints,
    resolvedAngles,
    scene,
    setCopyStyleSource,
    setHoveredHit,
    setCursorWorld,
    setPendingSelection,
    setSelectedObject,
    vp,
    zoomAtScreenPoint,
  ]);

  return (
    <div className="canvasStack">
      <canvas ref={canvasRef} className="drawingCanvas" />
      <div className="labelsLayer" aria-hidden ref={labelsLayerRef}>
        {labelOverlays.map((label) => (
          <div
            key={label.id}
            className="pointLabel tex"
            data-point-id={label.id}
            style={{
              transform: `translate(${label.x}px, ${label.y}px)`,
              fontSize: `${label.labelFontPx}px`,
              color: label.labelColor,
              textShadow: `${label.labelHaloColor} 0 0 ${label.labelHaloWidthPx}px, ${label.labelHaloColor} 0 0 ${Math.max(
                1,
                label.labelHaloWidthPx * 0.6
              )}px`,
            }}
            dangerouslySetInnerHTML={{ __html: label.html }}
          />
        ))}
        {angleLabelOverlays.map((label) => (
          <div
            key={label.id}
            className="pointLabel tex"
            data-angle-id={label.id}
            style={{
              transform: `translate(${label.x}px, ${label.y}px)`,
              fontSize: `${Math.max(8, label.textSize)}px`,
              color: label.textColor,
            }}
            dangerouslySetInnerHTML={{ __html: label.html }}
          />
        ))}
      </div>
    </div>
  );
}

function handleToolClick(
  screen: Vec2,
  activeTool: ActiveTool,
  pendingSelection: PendingSelection,
  hits: {
    hitPointId: string | null;
    hitSegmentId: string | null;
    hitObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null;
    shiftKey: boolean;
    hasCopyStyleSource: boolean;
    snap: SnapCandidate | null;
  },
  io: {
    setPendingSelection: (next: PendingSelection) => void;
    clearPendingSelection: () => void;
    createFreePoint: (world: Vec2) => string;
    createSegment: (aId: string, bId: string) => string | null;
    createLine: (aId: string, bId: string) => string | null;
    createCircle: (centerId: string, throughId: string) => string | null;
    createPerpendicularLine: (throughId: string, base: LineLikeObjectRef) => string | null;
    createParallelLine: (throughId: string, base: LineLikeObjectRef) => string | null;
    createAngle: (aId: string, bId: string, cId: string) => string | null;
    createMidpointFromPoints: (aId: string, bId: string) => string | null;
    createMidpointFromSegment: (segId: string) => string | null;
    createPointOnLine: (lineId: string, s: number) => string | null;
    createPointOnSegment: (segId: string, u: number) => string | null;
    createPointOnCircle: (circleId: string, t: number) => string | null;
    createIntersectionPoint: (objA: GeometryObjectRef, objB: GeometryObjectRef, preferredWorld: Vec2) => string | null;
    setSelectedObject: (obj: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null) => void;
    setCopyStyleSource: (obj: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string }) => void;
    applyCopyStyleTo: (obj: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string }) => void;
    camera: Camera;
    vp: Viewport;
  }
) {
  const resolveOrCreatePointAtCursor = (): string => {
    const snap = hits.shiftKey ? null : hits.snap;
    if (snap?.kind === "point" && snap.pointId) return snap.pointId;
    if (snap?.kind === "intersection" && snap.objA && snap.objB) {
      const created = io.createIntersectionPoint(snap.objA, snap.objB, snap.world);
      if (created) return created;
    }
    if (snap?.kind === "onLine" && snap.lineId && typeof snap.s === "number") {
      const created = io.createPointOnLine(snap.lineId, snap.s);
      if (created) return created;
    }
    if (snap?.kind === "onSegment" && snap.segId && typeof snap.u === "number") {
      const created = io.createPointOnSegment(snap.segId, snap.u);
      if (created) return created;
    }
    if (snap?.kind === "onCircle" && snap.circleId && typeof snap.t === "number") {
      const created = io.createPointOnCircle(snap.circleId, snap.t);
      if (created) return created;
    }
    if (hits.hitPointId) return hits.hitPointId;
    const world = camMath.screenToWorld(screen, io.camera, io.vp);
    return io.createFreePoint(world);
  };

  if (activeTool === "point") {
    const snap = hits.shiftKey ? null : hits.snap;
    if (snap?.kind === "point" && snap.pointId) {
      io.setSelectedObject({ type: "point", id: snap.pointId });
      return;
    }
    if (snap?.kind === "intersection" && snap.objA && snap.objB) {
      io.createIntersectionPoint(snap.objA, snap.objB, snap.world);
      return;
    }
    if (snap?.kind === "onLine" && snap.lineId && typeof snap.s === "number") {
      io.createPointOnLine(snap.lineId, snap.s);
      return;
    }
    if (snap?.kind === "onSegment" && snap.segId && typeof snap.u === "number") {
      io.createPointOnSegment(snap.segId, snap.u);
      return;
    }
    if (snap?.kind === "onCircle" && snap.circleId && typeof snap.t === "number") {
      io.createPointOnCircle(snap.circleId, snap.t);
      return;
    }
    if (hits.hitPointId) {
      io.setSelectedObject({ type: "point", id: hits.hitPointId });
      return;
    }
    const world = camMath.screenToWorld(screen, io.camera, io.vp);
    io.createFreePoint(world);
    return;
  }

  if (activeTool === "copyStyle") {
    if (!hits.hitObject) return;
    io.setSelectedObject(hits.hitObject);
    if (hits.shiftKey || !hits.hasCopyStyleSource) {
      io.setCopyStyleSource(hits.hitObject);
      return;
    }
    io.applyCopyStyleTo(hits.hitObject);
    return;
  }

  if (activeTool === "segment") {
    if (!pendingSelection || pendingSelection.tool !== "segment") {
      io.setPendingSelection({ tool: "segment", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    const bId = resolveOrCreatePointAtCursor();
    io.createSegment(pendingSelection.first.id, bId);
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "line2p") {
    if (!pendingSelection || pendingSelection.tool !== "line2p") {
      io.setPendingSelection({ tool: "line2p", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    const bId = resolveOrCreatePointAtCursor();
    io.createLine(pendingSelection.first.id, bId);
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "circle_cp") {
    if (!pendingSelection || pendingSelection.tool !== "circle_cp") {
      io.setPendingSelection({ tool: "circle_cp", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    const throughId = resolveOrCreatePointAtCursor();
    io.createCircle(pendingSelection.first.id, throughId);
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "angle") {
    if (!pendingSelection || pendingSelection.tool !== "angle") {
      io.setPendingSelection({ tool: "angle", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    if (pendingSelection.step === 2) {
      const bId = resolveOrCreatePointAtCursor();
      io.setPendingSelection({ tool: "angle", step: 3, first: pendingSelection.first, second: { type: "point", id: bId } });
      return;
    }
    const cId = resolveOrCreatePointAtCursor();
    io.createAngle(pendingSelection.first.id, pendingSelection.second.id, cId);
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "midpoint") {
    if (pendingSelection && pendingSelection.tool === "midpoint") {
      const bId = resolveOrCreatePointAtCursor();
      io.createMidpointFromPoints(pendingSelection.first.id, bId);
      io.clearPendingSelection();
      return;
    }

    if (hits.hitPointId) {
      io.setPendingSelection({ tool: "midpoint", step: 2, first: { type: "point", id: hits.hitPointId } });
      return;
    }

    if (hits.hitSegmentId) {
      io.createMidpointFromSegment(hits.hitSegmentId);
      io.clearPendingSelection();
      return;
    }

    io.setPendingSelection({ tool: "midpoint", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
    return;
  }

  if (activeTool === "perp_line") {
    const hitLineLikeRef = hits.hitObject?.type === "line"
      ? ({ type: "line", id: hits.hitObject.id } as const)
      : hits.hitObject?.type === "segment"
        ? ({ type: "segment", id: hits.hitObject.id } as const)
        : null;

    if (!pendingSelection || pendingSelection.tool !== "perp_line") {
      if (hits.hitPointId) {
        io.setPendingSelection({ tool: "perp_line", step: 2, first: { type: "point", id: hits.hitPointId } });
        return;
      }
      if (hitLineLikeRef) {
        io.setPendingSelection({ tool: "perp_line", step: 2, first: { type: "lineLike", ref: hitLineLikeRef } });
        return;
      }
      io.setPendingSelection({ tool: "perp_line", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }

    if (pendingSelection.first.type === "point") {
      if (!hitLineLikeRef) return;
      io.createPerpendicularLine(pendingSelection.first.id, hitLineLikeRef);
      io.clearPendingSelection();
      return;
    }

    const throughId = resolveOrCreatePointAtCursor();
    io.createPerpendicularLine(throughId, pendingSelection.first.ref);
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "parallel_line") {
    const hitLineLikeRef = hits.hitObject?.type === "line"
      ? ({ type: "line", id: hits.hitObject.id } as const)
      : hits.hitObject?.type === "segment"
        ? ({ type: "segment", id: hits.hitObject.id } as const)
        : null;

    if (!pendingSelection || pendingSelection.tool !== "parallel_line") {
      if (hits.hitPointId) {
        io.setPendingSelection({ tool: "parallel_line", step: 2, first: { type: "point", id: hits.hitPointId } });
        return;
      }
      if (hitLineLikeRef) {
        io.setPendingSelection({ tool: "parallel_line", step: 2, first: { type: "lineLike", ref: hitLineLikeRef } });
        return;
      }
      io.setPendingSelection({ tool: "parallel_line", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }

    if (pendingSelection.first.type === "point") {
      if (!hitLineLikeRef) return;
      io.createParallelLine(pendingSelection.first.id, hitLineLikeRef);
      io.clearPendingSelection();
      return;
    }

    const throughId = resolveOrCreatePointAtCursor();
    io.createParallelLine(throughId, pendingSelection.first.ref);
    io.clearPendingSelection();
  }
}

function toolAllowsEmptyPointCreation(activeTool: ActiveTool, pendingSelection: PendingSelection): boolean {
  if (activeTool === "perp_line" || activeTool === "parallel_line") {
    if (!pendingSelection || (pendingSelection.tool !== "perp_line" && pendingSelection.tool !== "parallel_line")) return true;
    return pendingSelection.first.type === "lineLike";
  }
  return (
    activeTool === "point" ||
    activeTool === "segment" ||
    activeTool === "line2p" ||
    activeTool === "circle_cp" ||
    activeTool === "midpoint" ||
    activeTool === "angle"
  );
}

function isValidTarget(
  activeTool: ActiveTool,
  pendingSelection: PendingSelection,
  hoveredHit: HoveredHit
): boolean {
  if (!hoveredHit) return false;

  if (activeTool === "segment") return hoveredHit.type === "point";
  if (activeTool === "line2p") return hoveredHit.type === "point";
  if (activeTool === "circle_cp") return hoveredHit.type === "point";
  if (activeTool === "angle") return hoveredHit.type === "point";
  if (activeTool === "perp_line") {
    if (!pendingSelection || pendingSelection.tool !== "perp_line") {
      return hoveredHit.type === "point" || hoveredHit.type === "line2p" || hoveredHit.type === "segment";
    }
    if (pendingSelection.first.type === "point") {
      return hoveredHit.type === "line2p" || hoveredHit.type === "segment";
    }
    return hoveredHit.type === "point";
  }
  if (activeTool === "parallel_line") {
    if (!pendingSelection || pendingSelection.tool !== "parallel_line") {
      return hoveredHit.type === "point" || hoveredHit.type === "line2p" || hoveredHit.type === "segment";
    }
    if (pendingSelection.first.type === "point") {
      return hoveredHit.type === "line2p" || hoveredHit.type === "segment";
    }
    return hoveredHit.type === "point";
  }

  if (activeTool === "midpoint") {
    if (pendingSelection?.tool === "midpoint") return hoveredHit.type === "point";
    return hoveredHit.type === "segment" || hoveredHit.type === "point";
  }

  return false;
}

function hitTestTopObject(
  screenPoint: Vec2,
  points: Array<{ point: ScenePoint; world: Vec2 }>,
  angles: Array<{ angle: SceneModel["angles"][number]; a: Vec2; b: Vec2; c: Vec2; theta: number }>,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
): { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null {
  const pointId = hitTestPoint(screenPoint, points, camera, vp, POINT_HIT_TOLERANCE_PX);
  if (pointId) return { type: "point", id: pointId };

  const angleId = hitTestAngle(screenPoint, angles, camera, vp, ANGLE_HIT_TOLERANCE_PX);
  if (angleId) return { type: "angle", id: angleId };

  const segmentId = hitTestSegment(screenPoint, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX);
  if (segmentId) return { type: "segment", id: segmentId };

  const lineId = hitTestLine(screenPoint, scene, camera, vp, LINE_HIT_TOLERANCE_PX);
  if (lineId) return { type: "line", id: lineId };

  const circleId = hitTestCircle(screenPoint, scene, camera, vp, CIRCLE_HIT_TOLERANCE_PX);
  if (circleId) return { type: "circle", id: circleId };

  return null;
}

function hitTestPoint(
  screenPoint: Vec2,
  points: Array<{ point: ScenePoint; world: Vec2 }>,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  const maxDistanceSq = tolerancePx * tolerancePx;
  let closestId: string | null = null;
  let closestDistanceSq = maxDistanceSq;

  for (let i = points.length - 1; i >= 0; i -= 1) {
    const entry = points[i];
    if (!entry.point.visible) continue;
    const p = camMath.worldToScreen(entry.world, camera, vp);
    const dx = screenPoint.x - p.x;
    const dy = screenPoint.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= closestDistanceSq) {
      closestDistanceSq = d2;
      closestId = entry.point.id;
    }
  }

  return closestId;
}

function hitTestSegment(
  screenPoint: Vec2,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  let bestId: string | null = null;
  let best = tolerancePx;

  for (let i = scene.segments.length - 1; i >= 0; i -= 1) {
    const seg = scene.segments[i];
    if (!seg.visible) continue;
    const a = geoStoreHelpers.getPointWorldById(scene, seg.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, seg.bId);
    if (!a || !b) continue;
    const ap = camMath.worldToScreen(a, camera, vp);
    const bp = camMath.worldToScreen(b, camera, vp);
    const pr = projectPointToSegment(screenPoint, ap, bp);
    if (pr.distance <= best) {
      best = pr.distance;
      bestId = seg.id;
    }
  }

  return bestId;
}

function hitTestLine(
  screenPoint: Vec2,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  let bestId: string | null = null;
  let best = tolerancePx;

  for (let i = scene.lines.length - 1; i >= 0; i -= 1) {
    const line = scene.lines[i];
    if (!line.visible) continue;
    const anchors = geoStoreHelpers.getLineWorldAnchorsById(scene, line.id);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) continue;
    const ap = camMath.worldToScreen(a, camera, vp);
    const bp = camMath.worldToScreen(b, camera, vp);
    const pr = projectPointToLine(screenPoint, ap, bp);
    if (pr.distance <= best) {
      best = pr.distance;
      bestId = line.id;
    }
  }

  return bestId;
}

function hitTestCircle(
  screenPoint: Vec2,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  let bestId: string | null = null;
  let best = tolerancePx;

  for (let i = scene.circles.length - 1; i >= 0; i -= 1) {
    const circle = scene.circles[i];
    if (!circle.visible) continue;
    const center = geoStoreHelpers.getPointWorldById(scene, circle.centerId);
    const through = geoStoreHelpers.getPointWorldById(scene, circle.throughId);
    if (!center || !through) continue;
    const centerScreen = camMath.worldToScreen(center, camera, vp);
    const throughScreen = camMath.worldToScreen(through, camera, vp);
    const radiusPx = Math.hypot(throughScreen.x - centerScreen.x, throughScreen.y - centerScreen.y);
    const d = Math.abs(Math.hypot(screenPoint.x - centerScreen.x, screenPoint.y - centerScreen.y) - radiusPx);
    if (d <= best) {
      best = d;
      bestId = circle.id;
    }
  }
  return bestId;
}

function drawCircles(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  recentCreatedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  copySource: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null
) {
  ctx.save();
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    const center = geoStoreHelpers.getPointWorldById(scene, circle.centerId);
    const through = geoStoreHelpers.getPointWorldById(scene, circle.throughId);
    if (!center || !through) continue;
    const c = camMath.worldToScreen(center, camera, vp);
    const t = camMath.worldToScreen(through, camera, vp);
    const r = Math.hypot(t.x - c.x, t.y - c.y);
    applyStrokeDash(ctx, circle.style.strokeDash, circle.style.strokeWidth);
    if ((circle.style.fillOpacity ?? 0) > 0 && circle.style.fillColor) {
      ctx.globalAlpha = circle.style.fillOpacity ?? 0;
      ctx.fillStyle = circle.style.fillColor;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = circle.style.strokeColor;
    ctx.globalAlpha = circle.style.strokeOpacity;
    ctx.lineWidth = circle.style.strokeWidth;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();

    if (selectedObject?.type === "circle" && selectedObject.id === circle.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "circle" && recentCreatedObject.id === circle.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = circle.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (copySource?.type === "circle" && copySource.id === circle.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = circle.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPendingPreview(
  ctx: CanvasRenderingContext2D,
  pendingSelection: PendingSelection,
  cursorWorld: Vec2 | null,
  cursorScreen: Vec2 | null,
  hoverSnap: SnapCandidate | null,
  hoveredHit: HoveredHit,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
) {
  if (!pendingSelection) return;
  const firstPointId = pendingSelection.first.type === "point" ? pendingSelection.first.id : null;
  const firstWorld = firstPointId ? geoStoreHelpers.getPointWorldById(scene, firstPointId) : null;
  const p1 = firstWorld ? camMath.worldToScreen(firstWorld, camera, vp) : null;

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 1.3;

  if (p1 && (pendingSelection.tool === "segment" || pendingSelection.tool === "midpoint") && cursorWorld) {
    const p2 = camMath.worldToScreen(cursorWorld, camera, vp);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (p1 && pendingSelection.tool === "line2p" && cursorWorld && firstWorld) {
    const d = sub(cursorWorld, firstWorld);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) {
      ctx.restore();
      return;
    }
    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const q1 = camMath.worldToScreen(add(firstWorld, mul(dir, -span)), camera, vp);
    const q2 = camMath.worldToScreen(add(firstWorld, mul(dir, span)), camera, vp);
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (p1 && pendingSelection.tool === "circle_cp" && cursorScreen) {
    const radiusPx = Math.hypot(cursorScreen.x - p1.x, cursorScreen.y - p1.y);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (pendingSelection.tool === "perp_line" || pendingSelection.tool === "parallel_line") {
    let through: Vec2 | null = null;
    let baseRef: LineLikeObjectRef | null = null;

    if (pendingSelection.first.type === "point") {
      through = geoStoreHelpers.getPointWorldById(scene, pendingSelection.first.id);
      if (hoverSnap?.kind === "onLine" && hoverSnap.lineId) baseRef = { type: "line", id: hoverSnap.lineId };
      else if (hoverSnap?.kind === "onSegment" && hoverSnap.segId) baseRef = { type: "segment", id: hoverSnap.segId };
      else if (hoveredHit?.type === "line2p") baseRef = { type: "line", id: hoveredHit.id };
      else if (hoveredHit?.type === "segment") baseRef = { type: "segment", id: hoveredHit.id };
      else if (cursorWorld && cursorScreen) {
        const lineId = hitTestLine(cursorScreen, scene, camera, vp, LINE_HIT_TOLERANCE_PX);
        const segId = hitTestSegment(cursorScreen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX);
        if (lineId) baseRef = { type: "line", id: lineId };
        else if (segId) baseRef = { type: "segment", id: segId };
      }
    } else {
      baseRef = pendingSelection.first.ref;
      if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
        through = geoStoreHelpers.getPointWorldById(scene, hoverSnap.pointId);
      } else if (hoveredHit?.type === "point") {
        through = geoStoreHelpers.getPointWorldById(scene, hoveredHit.id);
      } else if (cursorWorld) {
        // GeoGebra-like behavior: with base selected first, preview line follows cursor.
        through = cursorWorld;
      }
    }

    if (!through || !baseRef) {
      ctx.restore();
      return;
    }
    const baseAnchors = baseRef.type === "line"
      ? geoStoreHelpers.getLineWorldAnchorsById(scene, baseRef.id)
      : (() => {
          const seg = scene.segments.find((item) => item.id === baseRef.id);
          if (!seg) return null;
          const a = geoStoreHelpers.getPointWorldById(scene, seg.aId);
          const b = geoStoreHelpers.getPointWorldById(scene, seg.bId);
          if (!a || !b) return null;
          return { a, b };
        })();
    if (!baseAnchors) {
      ctx.restore();
      return;
    }
    const d = sub(baseAnchors.b, baseAnchors.a);
    if (d.x * d.x + d.y * d.y <= 1e-12) {
      ctx.restore();
      return;
    }
    const dirVec = pendingSelection.tool === "perp_line" ? { x: -d.y, y: d.x } : d;
    const len = Math.hypot(dirVec.x, dirVec.y);
    if (len <= 1e-12) {
      ctx.restore();
      return;
    }
    const dir = { x: dirVec.x / len, y: dirVec.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const q1 = camMath.worldToScreen(add(through, mul(dir, -span)), camera, vp);
    const q2 = camMath.worldToScreen(add(through, mul(dir, span)), camera, vp);
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
  }

  if (pendingSelection.tool === "angle" && pendingSelection.step === 3) {
    const a = geoStoreHelpers.getPointWorldById(scene, pendingSelection.first.id);
    const b = geoStoreHelpers.getPointWorldById(scene, pendingSelection.second.id);
    let c: Vec2 | null = null;
    if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
      c = geoStoreHelpers.getPointWorldById(scene, hoverSnap.pointId);
    }
    if (!c && hoveredHit?.type === "point") {
      c = geoStoreHelpers.getPointWorldById(scene, hoveredHit.id);
    }
    if (!c) c = cursorWorld;
    if (a && b && c) {
      const theta = computeConvexAngleRad(a, b, c);
      if (theta !== null) {
        const as = camMath.worldToScreen(a, camera, vp);
        const bs = camMath.worldToScreen(b, camera, vp);
        const cs = camMath.worldToScreen(c, camera, vp);
        const radiusPx = Math.max(18, Math.min(72, Math.hypot(as.x - bs.x, as.y - bs.y) * 0.28));
        drawAngleArcPreview(ctx, as, bs, cs, radiusPx);
        const labelVec = normalizeScreenVec({
          x: as.x + cs.x - 2 * bs.x,
          y: as.y + cs.y - 2 * bs.y,
        });
        const lx = bs.x + labelVec.x * (radiusPx + 16);
        const ly = bs.y + labelVec.y * (radiusPx + 16);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([]);
        ctx.fillStyle = "#0284c7";
        ctx.font = "12px system-ui";
        const deg = (theta * 180) / Math.PI;
        ctx.fillText(`${deg.toFixed(2)}°`, lx, ly);
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

function drawInteractionHighlights(
  ctx: CanvasRenderingContext2D,
  activeTool: ActiveTool,
  pendingSelection: PendingSelection,
  hoveredHit: HoveredHit,
  hoveredTargetValid: boolean,
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
) {
  if (pendingSelection) {
    if (pendingSelection.tool === "angle") {
      drawHitHighlight(
        ctx,
        { type: "point", id: pendingSelection.first.id },
        resolvedPoints,
        scene,
        camera,
        vp,
        "#22c55e",
        0.95
      );
      if (pendingSelection.step === 3) {
        drawHitHighlight(
          ctx,
          { type: "point", id: pendingSelection.second.id },
          resolvedPoints,
          scene,
          camera,
          vp,
          "#16a34a",
          0.9
        );
      }
      if (hoveredHit && hoveredTargetValid && activeTool !== "move") {
        drawHitHighlight(ctx, hoveredHit, resolvedPoints, scene, camera, vp, "#0ea5e9", 0.9);
      }
      return;
    }
    if (
      (pendingSelection.tool === "perp_line" || pendingSelection.tool === "parallel_line") &&
      pendingSelection.first.type === "lineLike"
    ) {
      drawHitHighlight(
        ctx,
        pendingSelection.first.ref.type === "line"
          ? { type: "line2p", id: pendingSelection.first.ref.id }
          : { type: "segment", id: pendingSelection.first.ref.id },
        resolvedPoints,
        scene,
        camera,
        vp,
        "#22c55e",
        0.95
      );
    } else {
      if (pendingSelection.first.type !== "point") {
        return;
      }
      drawHitHighlight(
        ctx,
        { type: "point", id: pendingSelection.first.id },
        resolvedPoints,
        scene,
        camera,
        vp,
        "#22c55e",
        0.95
      );
    }
  }

  if (hoveredHit && hoveredTargetValid && activeTool !== "move") {
    drawHitHighlight(ctx, hoveredHit, resolvedPoints, scene, camera, vp, "#0ea5e9", 0.9);
  }
}

function drawHitHighlight(
  ctx: CanvasRenderingContext2D,
  hit: Exclude<HoveredHit, null>,
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  color: string,
  alpha: number
) {
  if (hit.type === "point") {
    const point = resolvedPoints.find((item) => item.point.id === hit.id);
    if (!point || !point.point.visible) return;
    const p = camMath.worldToScreen(point.world, camera, vp);
    const r = Math.max(point.point.style.sizePx + 4, 8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (hit.type === "segment") {
    const seg = scene.segments.find((item) => item.id === hit.id);
    if (!seg || !seg.visible) return;
    const a = geoStoreHelpers.getPointWorldById(scene, seg.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, seg.bId);
    if (!a || !b) return;
    const p1 = camMath.worldToScreen(a, camera, vp);
    const p2 = camMath.worldToScreen(b, camera, vp);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = seg.style.strokeWidth + 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (hit.type === "line2p") {
    const line = scene.lines.find((item) => item.id === hit.id);
    if (!line || !line.visible) return;
    const anchors = geoStoreHelpers.getLineWorldAnchorsById(scene, line.id);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) return;
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) return;
    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const p1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const p2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = line.style.strokeWidth + 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (hit.type === "angle") {
    const angle = scene.angles.find((item) => item.id === hit.id);
    if (!angle || !angle.visible) return;
    const a = geoStoreHelpers.getPointWorldById(scene, angle.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, angle.bId);
    const c = geoStoreHelpers.getPointWorldById(scene, angle.cId);
    if (!a || !b || !c) return;
    const as = camMath.worldToScreen(a, camera, vp);
    const bs = camMath.worldToScreen(b, camera, vp);
    const cs = camMath.worldToScreen(c, camera, vp);
    const radiusPx = Math.max(16, angle.style.arcRadius * camera.zoom);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, angle.style.strokeWidth + 2);
    ctx.setLineDash([]);
    drawAngleArcPreview(ctx, as, bs, cs, radiusPx);
    ctx.restore();
    return;
  }

  const circle = scene.circles.find((item) => item.id === hit.id);
  if (!circle || !circle.visible) return;
  const center = geoStoreHelpers.getPointWorldById(scene, circle.centerId);
  const through = geoStoreHelpers.getPointWorldById(scene, circle.throughId);
  if (!center || !through) return;
  const c = camMath.worldToScreen(center, camera, vp);
  const t = camMath.worldToScreen(through, camera, vp);
  const r = Math.hypot(t.x - c.x, t.y - c.y);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.lineWidth = circle.style.strokeWidth + 2.5;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  recentCreatedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  copySource: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null
) {
  ctx.save();

  for (const line of scene.lines) {
    if (!line.visible) continue;
    const anchors = geoStoreHelpers.getLineWorldAnchorsById(scene, line.id);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) continue;

    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) continue;

    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const p1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const p2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);

    applyStrokeDash(ctx, line.style.dash, line.style.strokeWidth);
    ctx.strokeStyle = line.style.strokeColor;
    ctx.globalAlpha = line.style.opacity;
    ctx.lineWidth = line.style.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    if (selectedObject?.type === "line" && selectedObject.id === line.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "line" && recentCreatedObject.id === line.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = line.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    if (copySource?.type === "line" && copySource.id === line.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = line.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawSegments(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  recentCreatedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  copySource: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null
) {
  ctx.save();

  for (const seg of scene.segments) {
    if (!seg.visible) continue;
    const a = geoStoreHelpers.getPointWorldById(scene, seg.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, seg.bId);
    if (!a || !b) continue;

    const p1 = camMath.worldToScreen(a, camera, vp);
    const p2 = camMath.worldToScreen(b, camera, vp);

    applyStrokeDash(ctx, seg.style.dash, seg.style.strokeWidth);
    ctx.strokeStyle = seg.style.strokeColor;
    ctx.globalAlpha = seg.style.opacity;
    ctx.lineWidth = seg.style.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    if (selectedObject?.type === "segment" && selectedObject.id === seg.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "segment" && recentCreatedObject.id === seg.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = seg.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    if (copySource?.type === "segment" && copySource.id === seg.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = seg.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawAngles(
  ctx: CanvasRenderingContext2D,
  resolvedAngles: Array<{ angle: SceneModel["angles"][number]; a: Vec2; b: Vec2; c: Vec2; theta: number }>,
  camera: Camera,
  vp: Viewport,
  selectedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  recentCreatedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null
) {
  for (const entry of resolvedAngles) {
    const { angle, a, b, c } = entry;
    if (!angle.visible) continue;
    const as = camMath.worldToScreen(a, camera, vp);
    const bs = camMath.worldToScreen(b, camera, vp);
    const cs = camMath.worldToScreen(c, camera, vp);
    const radiusPx = Math.max(12, angle.style.arcRadius * camera.zoom);

    ctx.save();
    if (angle.style.fillEnabled && angle.style.fillOpacity > 0) {
      ctx.globalAlpha = angle.style.fillOpacity;
      ctx.fillStyle = angle.style.fillColor;
      drawAngleSector(ctx, as, bs, cs, radiusPx);
      ctx.fill();
    }
    ctx.globalAlpha = angle.style.strokeOpacity;
    ctx.strokeStyle = angle.style.strokeColor;
    ctx.lineWidth = angle.style.strokeWidth;
    if (angle.style.markStyle === "right") {
      drawRightAngleMark(ctx, as, bs, cs, radiusPx * 0.55);
      ctx.stroke();
    } else if (angle.style.markStyle === "arc") {
      drawAngleArcPreview(ctx, as, bs, cs, radiusPx);
    }

    if (selectedObject?.type === "angle" && selectedObject.id === angle.id) {
      const isNew = recentCreatedObject?.type === "angle" && recentCreatedObject.id === angle.id;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = angle.style.strokeWidth + (isNew ? 1.5 : 1.6);
      if (angle.style.markStyle === "right") {
        drawRightAngleMark(ctx, as, bs, cs, radiusPx * 0.63);
        ctx.stroke();
      } else if (angle.style.markStyle === "arc") {
        drawAngleArcPreview(ctx, as, bs, cs, radiusPx + 2);
      }
      const lScreen = camMath.worldToScreen(angle.style.labelPosWorld, camera, vp);
      ctx.beginPath();
      ctx.arc(lScreen.x, lScreen.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(245,158,11,0.85)";
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPoints(
  ctx: CanvasRenderingContext2D,
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  selectedObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null,
  camera: Camera,
  vp: Viewport,
  copySource: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null
) {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const labelStack = new Map<string, number>();

  for (const { point, world } of resolvedPoints) {
    if (!point.visible) continue;
    const p = camMath.worldToScreen(world, camera, vp);
    const selected = selectedObject?.type === "point" && selectedObject.id === point.id;

    drawPointSymbol(
      ctx,
      point.style.shape,
      p.x,
      p.y,
      point.style.sizePx,
      point.style.fillColor,
      point.style.fillOpacity,
      point.style.strokeColor,
      point.style.strokeWidth,
      point.style.strokeOpacity
    );

    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(point.style.sizePx + 3, 7), 0, Math.PI * 2);
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (copySource?.type === "point" && copySource.id === point.id) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(point.style.sizePx + 4.5, 8), 0, Math.PI * 2);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (point.showLabel === "name" && point.name) {
      const labelOffset = point.style.labelOffsetPx;
      const stackKey = `${Math.round(p.x * 2) / 2}:${Math.round(p.y * 2) / 2}`;
      const stackIndex = labelStack.get(stackKey) ?? 0;
      labelStack.set(stackKey, stackIndex + 1);
      const ring = Math.floor(stackIndex / 8) + 1;
      const angle = (stackIndex % 8) * (Math.PI / 4);
      const spread = stackIndex === 0 ? 0 : 10 * ring;
      const lx = p.x + labelOffset.x + Math.cos(angle) * spread;
      const ly = p.y + labelOffset.y + Math.sin(angle) * spread;
      ctx.font = `${point.style.labelFontPx}px system-ui`;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = point.style.labelHaloColor;
      ctx.lineWidth = point.style.labelHaloWidthPx;
      ctx.strokeText(point.name, lx, ly);
      ctx.fillStyle = point.style.labelColor;
      ctx.fillText(point.name, lx, ly);
    }
  }

  ctx.restore();
}

function hitTestLabel(
  screenPoint: Vec2,
  points: Array<{ point: ScenePoint; world: Vec2 }>,
  camera: Camera,
  vp: Viewport,
  defaultOffset: Vec2
): string | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const { point, world } = points[i];
    if (!point.visible || point.showLabel === "none") continue;
    const p = camMath.worldToScreen(world, camera, vp);
    const labelOffset = point.style.labelOffsetPx ?? defaultOffset;
    const labelText = point.showLabel === "name" ? point.name : point.captionTex;
    if (!labelText) continue;
    const fontPx = point.style.labelFontPx ?? 16;
    const x = p.x + labelOffset.x - 2;
    const y = p.y + labelOffset.y - fontPx * 0.65;
    const w = Math.max(18, labelText.length * (fontPx * 0.58) + 8);
    const h = Math.max(16, fontPx * 1.2);
    if (screenPoint.x >= x && screenPoint.x <= x + w && screenPoint.y >= y && screenPoint.y <= y + h) {
      return point.id;
    }
  }
  return null;
}

function hitTestAngleLabel(
  screenPoint: Vec2,
  resolvedAngles: Array<{ angle: SceneModel["angles"][number]; a: Vec2; b: Vec2; c: Vec2; theta: number }>,
  camera: Camera,
  vp: Viewport
): string | null {
  for (let i = resolvedAngles.length - 1; i >= 0; i -= 1) {
    const entry = resolvedAngles[i];
    if (!entry.angle.visible) continue;
    const labelScreen = camMath.worldToScreen(entry.angle.style.labelPosWorld, camera, vp);
    const grabRadius = Math.max(16, entry.angle.style.textSize * 0.8);
    const d = Math.hypot(screenPoint.x - labelScreen.x, screenPoint.y - labelScreen.y);
    if (d <= grabRadius) return entry.angle.id;
  }
  return null;
}

function hitTestAngle(
  screenPoint: Vec2,
  resolvedAngles: Array<{ angle: SceneModel["angles"][number]; a: Vec2; b: Vec2; c: Vec2; theta: number }>,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  let bestId: string | null = null;
  let best = tolerancePx;
  for (let i = resolvedAngles.length - 1; i >= 0; i -= 1) {
    const entry = resolvedAngles[i];
    if (!entry.angle.visible) continue;
    const as = camMath.worldToScreen(entry.a, camera, vp);
    const bs = camMath.worldToScreen(entry.b, camera, vp);
    const cs = camMath.worldToScreen(entry.c, camera, vp);
    const r = Math.max(12, entry.angle.style.arcRadius * camera.zoom);
    const d = distanceToAngleArc(screenPoint, as, bs, cs, r);
    if (d <= best) {
      best = d;
      bestId = entry.angle.id;
    }
  }
  return bestId;
}

function hitTestLabelFromDom(clientX: number, clientY: number, labelsLayer: HTMLDivElement | null): string | null {
  if (!labelsLayer) return null;
  const labels = labelsLayer.querySelectorAll<HTMLElement>(".pointLabel[data-point-id]");
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const el = labels[i];
    const rect = el.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return el.dataset.pointId ?? null;
    }
  }
  return null;
}

function highlightSnapObject(
  ctx: CanvasRenderingContext2D,
  obj: GeometryObjectRef,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
) {
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(249, 115, 22, 0.9)";
  ctx.lineWidth = 2;

  if (obj.type === "line") {
    const line = scene.lines.find((item) => item.id === obj.id);
    if (!line) {
      ctx.restore();
      return;
    }
    const anchors = geoStoreHelpers.getLineWorldAnchorsById(scene, line.id);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) {
      ctx.restore();
      return;
    }
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) {
      ctx.restore();
      return;
    }
    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 1.8;
    const p1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const p2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (obj.type === "segment") {
    const seg = scene.segments.find((item) => item.id === obj.id);
    if (!seg) {
      ctx.restore();
      return;
    }
    const a = geoStoreHelpers.getPointWorldById(scene, seg.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, seg.bId);
    if (!a || !b) {
      ctx.restore();
      return;
    }
    const p1 = camMath.worldToScreen(a, camera, vp);
    const p2 = camMath.worldToScreen(b, camera, vp);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const circle = scene.circles.find((item) => item.id === obj.id);
  if (!circle) {
    ctx.restore();
    return;
  }
  const center = geoStoreHelpers.getPointWorldById(scene, circle.centerId);
  const through = geoStoreHelpers.getPointWorldById(scene, circle.throughId);
  if (!center || !through) {
    ctx.restore();
    return;
  }
  const c = camMath.worldToScreen(center, camera, vp);
  const t = camMath.worldToScreen(through, camera, vp);
  const r = Math.hypot(t.x - c.x, t.y - c.y);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function normalizeScreenVec(v: Vec2): Vec2 {
  const d = Math.hypot(v.x, v.y);
  if (d <= 1e-9) return { x: 1, y: 0 };
  return { x: v.x / d, y: v.y / d };
}

function angleSweep(aScreen: Vec2, bScreen: Vec2, cScreen: Vec2): { start: number; end: number; ccw: boolean } {
  const start = Math.atan2(aScreen.y - bScreen.y, aScreen.x - bScreen.x);
  const end = Math.atan2(cScreen.y - bScreen.y, cScreen.x - bScreen.x);
  let delta = end - start;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  const ccw = delta < 0;
  return { start, end, ccw };
}

function drawAngleArcPreview(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  cScreen: Vec2,
  radiusPx: number
): void {
  const sweep = angleSweep(aScreen, bScreen, cScreen);
  ctx.beginPath();
  ctx.arc(bScreen.x, bScreen.y, radiusPx, sweep.start, sweep.end, sweep.ccw);
  ctx.stroke();
}

function drawAngleSector(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  cScreen: Vec2,
  radiusPx: number
): void {
  const sweep = angleSweep(aScreen, bScreen, cScreen);
  ctx.beginPath();
  ctx.moveTo(bScreen.x, bScreen.y);
  ctx.arc(bScreen.x, bScreen.y, radiusPx, sweep.start, sweep.end, sweep.ccw);
  ctx.closePath();
}

function drawRightAngleMark(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  cScreen: Vec2,
  sizePx: number
): void {
  const u = normalizeScreenVec({ x: aScreen.x - bScreen.x, y: aScreen.y - bScreen.y });
  const v = normalizeScreenVec({ x: cScreen.x - bScreen.x, y: cScreen.y - bScreen.y });
  const p1 = { x: bScreen.x + u.x * sizePx, y: bScreen.y + u.y * sizePx };
  const p3 = { x: bScreen.x + v.x * sizePx, y: bScreen.y + v.y * sizePx };
  const p2 = { x: p1.x + v.x * sizePx, y: p1.y + v.y * sizePx };
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
}

function distanceToAngleArc(
  p: Vec2,
  aScreen: Vec2,
  bScreen: Vec2,
  cScreen: Vec2,
  radiusPx: number
): number {
  const sweep = angleSweep(aScreen, bScreen, cScreen);
  const dx = p.x - bScreen.x;
  const dy = p.y - bScreen.y;
  const dist = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx);
  const isWithin = isAngleOnArc(theta, sweep.start, sweep.end, sweep.ccw);
  if (!isWithin) {
    const pStart = { x: bScreen.x + Math.cos(sweep.start) * radiusPx, y: bScreen.y + Math.sin(sweep.start) * radiusPx };
    const pEnd = { x: bScreen.x + Math.cos(sweep.end) * radiusPx, y: bScreen.y + Math.sin(sweep.end) * radiusPx };
    return Math.min(Math.hypot(p.x - pStart.x, p.y - pStart.y), Math.hypot(p.x - pEnd.x, p.y - pEnd.y));
  }
  return Math.abs(dist - radiusPx);
}

function isAngleOnArc(theta: number, start: number, end: number, ccw: boolean): boolean {
  const norm = (a: number): number => {
    let out = a;
    while (out < 0) out += Math.PI * 2;
    while (out >= Math.PI * 2) out -= Math.PI * 2;
    return out;
  };
  const t = norm(theta);
  const s = norm(start);
  const e = norm(end);
  if (!ccw) {
    if (s <= e) return t >= s && t <= e;
    return t >= s || t <= e;
  }
  // Counter-clockwise direction in canvas means traveling from start down to end.
  if (e <= s) return t <= s && t >= e;
  return t <= s || t >= e;
}

function buildAngleLabelTex(labelTextRaw: string, showLabel: boolean, showValue: boolean, thetaRad: number): string | null {
  const labelText = labelTextRaw.trim();
  const deg = (thetaRad * 180) / Math.PI;
  const valueTex = `${deg.toFixed(2)}^{\\circ}`;
  if (showLabel && labelText.length > 0 && showValue) return `${labelText}=${valueTex}`;
  if (showLabel && labelText.length > 0) return labelText;
  if (showValue) return valueTex;
  return null;
}

function drawPointSymbol(
  ctx: CanvasRenderingContext2D,
  shape: PointShape,
  x: number,
  y: number,
  sizePx: number,
  fillColor: string,
  fillOpacity: number,
  strokeColor: string,
  strokeWidth: number,
  strokeOpacity: number
) {
  const r = Math.max(1.5, sizePx);
  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.globalAlpha = fillOpacity;

  if (shape === "dot") {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.2, r * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (shape === "x" || shape === "plus" || shape === "cross") {
    ctx.globalAlpha = strokeOpacity;
    ctx.beginPath();
    if (shape === "x" || shape === "cross") {
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
    }
    if (shape === "plus" || shape === "cross") {
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case "diamond":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case "square":
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case "triUp":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x - r, y + r);
      ctx.closePath();
      break;
    case "triDown":
      ctx.moveTo(x, y + r);
      ctx.lineTo(x + r, y - r);
      ctx.lineTo(x - r, y - r);
      ctx.closePath();
      break;
  }
  ctx.fill();
  ctx.globalAlpha = strokeOpacity;
  ctx.stroke();
  ctx.restore();
}

function applyStrokeDash(
  ctx: CanvasRenderingContext2D,
  dash: "solid" | "dashed" | "dotted",
  strokeWidth: number
) {
  if (dash === "dashed") {
    ctx.setLineDash([8, 6]);
    ctx.lineCap = "butt";
    return;
  }
  if (dash === "dotted") {
    // Near-zero dash length + round caps yields circular dots instead of mini dashes.
    const dot = 0.001;
    const gap = Math.max(4, strokeWidth * 2.4);
    ctx.setLineDash([dot, gap]);
    ctx.lineCap = "round";
    return;
  }
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
}
