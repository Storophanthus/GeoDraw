import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import type { Vec2 } from "../geo/vec2";
import { add, mul, sub } from "../geo/geometry";
import { drawRectGrid, type RectGridSettings } from "../render/rectGrid";
import {
  beginSceneEvalTick,
  computeOrientedAngleRad,
  endSceneEvalTick,
  getPointWorldPos,
  isPointDraggable,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";
import { geoStoreHelpers, useGeoStore } from "../state/geoStore";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import type { Camera } from "./camera";
import { camera as camMath, type Viewport } from "./camera";
import { findBestSnap, type SnapCandidate } from "./snapEngine";
import { drawAngleArcPreview } from "./angleRender";
import { hitTestAngleLabelHandle, hitTestPointLabel, hitTestPointLabelFromDom } from "./labelHit";
import { drawPendingPreview } from "./previews/pendingPreview";
import { drawAngles, drawCircles, drawLines, drawPoints, drawSegments } from "./renderers";
import { highlightSnapObject } from "./snapHighlight";
import { isValidTarget, toolAllowsEmptyPointCreation } from "../tools/toolClick";
import {
  constructFromClick,
  hitTestAngleId as engineHitTestAngleId,
  hitTestCircleId as engineHitTestCircleId,
  hitTestLineId as engineHitTestLineId,
  hitTestPointId as engineHitTestPointId,
  hitTestSegmentId as engineHitTestSegmentId,
  hitTestTopObject as engineHitTestTopObject,
} from "../engine";

const POINT_HIT_TOLERANCE_PX = 12;
const SEGMENT_HIT_TOLERANCE_PX = 10;
const LINE_HIT_TOLERANCE_PX = 10;
const CIRCLE_HIT_TOLERANCE_PX = 10;
const ANGLE_HIT_TOLERANCE_PX = 20;
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

// Angle sliders keep their existing numeric ranges, but canvas rendering applies
// a visual remap so current defaults look like the old mid-slider appearance.
const ANGLE_STROKE_RENDER_SCALE = 3.25 / 1.8;
const ANGLE_TEXT_RENDER_SCALE = 25 / 16;

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
  const createCircleThreePoint = useGeoStore((store) => store.createCircleThreePoint);
  const createPerpendicularLine = useGeoStore((store) => store.createPerpendicularLine);
  const createParallelLine = useGeoStore((store) => store.createParallelLine);
  const createAngleBisectorLine = useGeoStore((store) => store.createAngleBisectorLine);
  const createAngle = useGeoStore((store) => store.createAngle);
  const createAngleFixed = useGeoStore((store) => store.createAngleFixed);
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
  const angleFixedTool = useGeoStore((store) => store.angleFixedTool);
  const circleFixedTool = useGeoStore((store) => store.circleFixedTool);

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
          const theta = computeOrientedAngleRad(a, b, c);
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
          textSize: getAngleTextRenderSize(angle.style.textSize),
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

        const selectedDrawableObject = selectedObject?.type === "number" ? null : selectedObject;
        const recentDrawableObject = recentCreatedObject?.type === "number" ? null : recentCreatedObject;
        const copySourceDrawable = copyStyle.source?.type === "number" ? null : copyStyle.source;

        drawRectGrid(ctx, camera, vp, GRID_SETTINGS);
        drawCircles(ctx, scene, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
        drawLines(ctx, scene, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
        drawSegments(ctx, scene, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
        drawAngles(ctx, resolvedAngles, camera, vp, selectedDrawableObject, recentDrawableObject, getAngleStrokeRenderWidth);
        drawPendingPreview(ctx, pendingSelection, cursorWorld, hoverScreen, hoverSnap, hoveredHit, scene, camera, vp, angleFixedTool, circleFixedTool, {
          linePx: LINE_HIT_TOLERANCE_PX,
          segmentPx: SEGMENT_HIT_TOLERANCE_PX,
        });
        drawPoints(ctx, resolvedPoints, selectedDrawableObject, camera, vp, copySourceDrawable);
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
      angleFixedTool,
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
      const pointId = engineHitTestPointId(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX);
      if (pointId) return { type: "point", id: pointId };
      const angleId = engineHitTestAngleId(screen, resolvedAngles, camera, vp, ANGLE_HIT_TOLERANCE_PX);
      if (angleId) return { type: "angle", id: angleId };
      const segmentId = engineHitTestSegmentId(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX);
      if (segmentId) return { type: "segment", id: segmentId };
      const lineId = engineHitTestLineId(screen, scene, camera, vp, LINE_HIT_TOLERANCE_PX);
      if (lineId) return { type: "line2p", id: lineId };
      const circleId = engineHitTestCircleId(screen, scene, camera, vp, CIRCLE_HIT_TOLERANCE_PX);
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
      } else if (activeTool === "copyStyle") {
        nextCursor = nextHovered ? "pointer" : "grab";
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
      const hitPointId = engineHitTestPointId(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX);
      const hitLabelId =
        hitTestPointLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current) ??
        hitTestPointLabel(screen, resolvedPoints, camera, vp, pointDefaults.labelOffsetPx);
      const hitAngleLabelId = hitTestAngleLabelHandle(screen, resolvedAngles, camera, vp, getAngleTextRenderSize);
      const hitAngleId = engineHitTestAngleId(screen, resolvedAngles, camera, vp, ANGLE_HIT_TOLERANCE_PX);
      const hitSegmentId = engineHitTestSegmentId(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX);
      const hitLineId = engineHitTestLineId(screen, scene, camera, vp, LINE_HIT_TOLERANCE_PX);
      const hitCircleId = engineHitTestCircleId(screen, scene, camera, vp, CIRCLE_HIT_TOLERANCE_PX);

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
        const hitObject = engineHitTestTopObject(scene, camera, vp, screen, {
          pointTolPx: POINT_HIT_TOLERANCE_PX,
          angleTolPx: ANGLE_HIT_TOLERANCE_PX,
          segmentTolPx: SEGMENT_HIT_TOLERANCE_PX,
          lineTolPx: LINE_HIT_TOLERANCE_PX,
          circleTolPx: CIRCLE_HIT_TOLERANCE_PX,
        });
        const snap =
          !e.shiftKey && activeTool !== "move" && activeTool !== "copyStyle"
            ? findBestSnap(screen, camera, vp, scene, POINT_HIT_TOLERANCE_PX)
            : null;
        constructFromClick({
          screen,
          activeTool,
          pendingSelection,
          hits: {
            hitPointId: engineHitTestPointId(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX),
            hitSegmentId: engineHitTestSegmentId(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX),
            hitObject,
            shiftKey: e.shiftKey,
            hasCopyStyleSource: Boolean(copyStyle.source),
            snap,
          },
          io: {
            setPendingSelection,
            clearPendingSelection,
            createFreePoint,
            createSegment,
            createLine,
            createCircle,
            createCircleThreePoint,
            createPerpendicularLine,
            createParallelLine,
            createAngleBisectorLine,
            createAngle,
            createAngleFixed,
            createMidpointFromPoints,
            createMidpointFromSegment,
            createPointOnLine,
            createPointOnSegment,
            createPointOnCircle,
            createIntersectionPoint,
            setSelectedObject,
            setCopyStyleSource,
            applyCopyStyleTo,
            angleFixedTool,
            camera,
            vp,
          },
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
    createCircleThreePoint,
    createPerpendicularLine,
    createParallelLine,
    createAngleBisectorLine,
    createAngle,
    createAngleFixed,
    clearPendingSelection,
    createMidpointFromPoints,
    createMidpointFromSegment,
    createPointOnLine,
    createPointOnSegment,
    createPointOnCircle,
    createIntersectionPoint,
    applyCopyStyleTo,
    angleFixedTool,
    circleFixedTool,
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
    if (
      pendingSelection.tool === "angle" ||
      pendingSelection.tool === "angle_fixed" ||
      pendingSelection.tool === "angle_bisector"
    ) {
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
    const radiusPx = Math.max(16, angle.style.arcRadius * camera.zoom);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, getAngleStrokeRenderWidth(angle.style.strokeWidth) + 2);
    ctx.setLineDash([]);
    const theta = computeOrientedAngleRad(a, b, c);
    if (theta === null) {
      ctx.restore();
      return;
    }
    drawAngleArcPreview(ctx, as, bs, theta, radiusPx);
    ctx.restore();
    return;
  }

  const circle = scene.circles.find((item) => item.id === hit.id);
  if (!circle || !circle.visible) return;
  const geom = geoStoreHelpers.getCircleWorldGeometryById(scene, circle.id);
  if (!geom) return;
  const center = geom.center;
  const c = camMath.worldToScreen(center, camera, vp);
  const r = geom.radius * camera.zoom;
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

function buildAngleLabelTex(labelTextRaw: string, showLabel: boolean, showValue: boolean, thetaRad: number): string | null {
  const labelText = labelTextRaw.trim();
  const deg = (thetaRad * 180) / Math.PI;
  const valueTex = `${deg.toFixed(2)}^{\\circ}`;
  if (showLabel && labelText.length > 0 && showValue) return `${labelText}=${valueTex}`;
  if (showLabel && labelText.length > 0) return labelText;
  if (showValue) return valueTex;
  return null;
}

function getAngleStrokeRenderWidth(rawStrokeWidth: number): number {
  return rawStrokeWidth * ANGLE_STROKE_RENDER_SCALE;
}

function getAngleTextRenderSize(rawTextSize: number): number {
  return rawTextSize * ANGLE_TEXT_RENDER_SCALE;
}
