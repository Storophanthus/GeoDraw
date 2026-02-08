import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import type { Vec2 } from "../geo/vec2";
import { add, distance, mul, projectPointToLine, projectPointToSegment, sub } from "../geo/geometry";
import { drawRectGrid, type RectGridSettings } from "../render/rectGrid";
import {
  type GeometryObjectRef,
  getPointWorldPos,
  isPointDraggable,
  type PointShape,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";
import { geoStoreHelpers, useGeoStore } from "../state/geoStore";
import type { ActiveTool } from "../state/geoStore";
import type { Camera } from "./camera";
import { camera as camMath, type Viewport } from "./camera";
import { findBestSnap, type SnapCandidate } from "./snapEngine";

const POINT_HIT_TOLERANCE_PX = 12;
const SEGMENT_HIT_TOLERANCE_PX = 10;
const LINE_HIT_TOLERANCE_PX = 10;
const CIRCLE_HIT_TOLERANCE_PX = 10;
const CLICK_EPSILON_PX = 3;

const GRID_SETTINGS: RectGridSettings = {
  enabled: true,
  rotationRad: 0,
  targetSpacingPx: 40,
  majorEvery: 5,
  minorOpacity: 0.1,
  majorOpacity: 0.18,
  minorWidth: 1,
  majorWidth: 1.5,
};

type PointerMode = "idle" | "pan" | "drag-point" | "drag-label" | "tool-click";

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

type PendingToolState =
  | { tool: "segment"; aPointId: string }
  | { tool: "line2p"; aPointId: string }
  | { tool: "circle"; aPointId: string }
  | { tool: "midpoint"; aPointId: string }
  | null;

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

  const camera = useGeoStore((store) => store.camera);
  const activeTool = useGeoStore((store) => store.activeTool);
  const scene = useGeoStore((store) => store.scene);
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const cursorWorld = useGeoStore((store) => store.cursorWorld);
  const pendingConstruction = useGeoStore((store) => store.pendingConstruction);
  const copyStyle = useGeoStore((store) => store.copyStyle);
  const pointDefaults = useGeoStore((store) => store.pointDefaults);

  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const setCursorWorld = useGeoStore((store) => store.setCursorWorld);
  const setPendingConstruction = useGeoStore((store) => store.setPendingConstruction);
  const clearPendingConstruction = useGeoStore((store) => store.clearPendingConstruction);
  const panByScreenDelta = useGeoStore((store) => store.panByScreenDelta);
  const zoomAtScreenPoint = useGeoStore((store) => store.zoomAtScreenPoint);
  const createFreePoint = useGeoStore((store) => store.createFreePoint);
  const createSegment = useGeoStore((store) => store.createSegment);
  const createLine = useGeoStore((store) => store.createLine);
  const createCircle = useGeoStore((store) => store.createCircle);
  const createMidpointFromPoints = useGeoStore((store) => store.createMidpointFromPoints);
  const createMidpointFromSegment = useGeoStore((store) => store.createMidpointFromSegment);
  const createPointOnLine = useGeoStore((store) => store.createPointOnLine);
  const createPointOnSegment = useGeoStore((store) => store.createPointOnSegment);
  const createPointOnCircle = useGeoStore((store) => store.createPointOnCircle);
  const createIntersectionPoint = useGeoStore((store) => store.createIntersectionPoint);
  const movePointTo = useGeoStore((store) => store.movePointTo);
  const movePointLabelBy = useGeoStore((store) => store.movePointLabelBy);
  const setCopyStyleSource = useGeoStore((store) => store.setCopyStyleSource);
  const applyCopyStyleTo = useGeoStore((store) => store.applyCopyStyleTo);

  const [vp, setVp] = useState<Viewport>({ widthPx: 800, heightPx: 600 });
  const [hoverScreen, setHoverScreen] = useState<Vec2 | null>(null);
  const [snapDisabled, setSnapDisabled] = useState(false);

  const resolvedPoints = useMemo(
    () =>
      scene.points
        .map((point) => {
          const world = getPointWorldPos(point, scene);
          if (!world) return null;
          return { point, world };
        })
        .filter((item): item is { point: ScenePoint; world: Vec2 } => Boolean(item)),
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

  const hoverSnap: SnapCandidate | null = useMemo(() => {
    if (!hoverScreen) return null;
    if (snapDisabled) return null;
    return findBestSnap(hoverScreen, camera, vp, scene, POINT_HIT_TOLERANCE_PX);
  }, [camera, hoverScreen, scene, snapDisabled, vp]);

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
        if (pendingConstruction) {
          e.preventDefault();
          clearPendingConstruction();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearPendingConstruction, pendingConstruction]);

  const dpr = window.devicePixelRatio || 1;

  const draw = useMemo(
    () => () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = Math.max(1, Math.floor(vp.widthPx * dpr));
      canvas.height = Math.max(1, Math.floor(vp.heightPx * dpr));

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vp.widthPx, vp.heightPx);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, vp.widthPx, vp.heightPx);

      drawRectGrid(ctx, camera, vp, GRID_SETTINGS);
      drawCircles(ctx, scene, camera, vp, selectedObject, copyStyle.source);
      drawLines(ctx, scene, camera, vp, selectedObject, copyStyle.source);
      drawSegments(ctx, scene, camera, vp, selectedObject, copyStyle.source);
      drawPendingConstructionPreview(ctx, pendingConstruction, cursorWorld, scene, camera, vp);
      drawPoints(ctx, resolvedPoints, selectedObject, camera, vp, copyStyle.source);

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

    },
    [
      activeTool,
      camera,
      copyStyle.source,
      cursorWorld,
      dpr,
      hoverSnap,
      pendingConstruction,
      resolvedPoints,
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

    const onDown = (e: PointerEvent) => {
      const screen = readScreen(e);
      setHoverScreen(screen);
      setSnapDisabled(e.shiftKey);
      setCursorWorld(camMath.screenToWorld(screen, camera, vp));
      const hitPointId = hitTestPoint(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX);
      const hitLabelId =
        hitTestLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current) ??
        hitTestLabel(screen, resolvedPoints, camera, vp, pointDefaults.labelOffsetPx);
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
    };

    const onMove = (e: PointerEvent) => {
      const screen = readScreen(e);
      setHoverScreen(screen);
      setSnapDisabled(e.shiftKey);
      setCursorWorld(camMath.screenToWorld(screen, camera, vp));
      const st = pointerRef.current;
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
        panByScreenDelta({ x: dx, y: dy });
        return;
      }

      if (st.mode === "drag-point" && st.pointId) {
        const world = camMath.screenToWorld(screen, camera, vp);
        movePointTo(st.pointId, world);
        return;
      }

      if (st.mode === "drag-label" && st.pointId) {
        movePointLabelBy(st.pointId, { x: dx, y: dy });
      }
    };

    const finish = (e: PointerEvent) => {
      const st = pointerRef.current;
      if (!st.active || st.pid !== e.pointerId) return;

      if (st.mode === "tool-click" && !st.moved) {
        const screen = readScreen(e);
        const hitObject = hitTestTopObject(screen, resolvedPoints, scene, camera, vp);
        const snap =
          activeTool === "point" && !e.shiftKey
            ? findBestSnap(screen, camera, vp, scene, POINT_HIT_TOLERANCE_PX)
            : null;
        handleToolClick(screen, activeTool, pendingConstruction, {
          hitPointId: hitTestPoint(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX),
          hitSegmentId: hitTestSegment(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX),
          hitObject,
          shiftKey: e.shiftKey,
          hasCopyStyleSource: Boolean(copyStyle.source),
          snap,
        }, {
          setPendingTool: setPendingConstruction,
          clearPendingTool: clearPendingConstruction,
          createFreePoint,
          createSegment,
          createLine,
          createCircle,
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
      setSnapDisabled(e.shiftKey);
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
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
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
    clearPendingConstruction,
    createMidpointFromPoints,
    createMidpointFromSegment,
    createPointOnLine,
    createPointOnSegment,
    createPointOnCircle,
    createIntersectionPoint,
    applyCopyStyleTo,
    createSegment,
    movePointLabelBy,
    movePointTo,
    panByScreenDelta,
    pendingConstruction,
    pointDefaults.labelOffsetPx,
    resolvedPoints,
    scene,
    setCopyStyleSource,
    setCursorWorld,
    setPendingConstruction,
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
      </div>
    </div>
  );
}

function handleToolClick(
  screen: Vec2,
  activeTool: ActiveTool,
  pendingTool: PendingToolState,
  hits: {
    hitPointId: string | null;
    hitSegmentId: string | null;
    hitObject: { type: "point" | "segment" | "line" | "circle"; id: string } | null;
    shiftKey: boolean;
    hasCopyStyleSource: boolean;
    snap: SnapCandidate | null;
  },
  io: {
    setPendingTool: (next: PendingToolState) => void;
    clearPendingTool: () => void;
    createFreePoint: (world: Vec2) => string;
    createSegment: (aId: string, bId: string) => string | null;
    createLine: (aId: string, bId: string) => string | null;
    createCircle: (centerId: string, radiusPointId: string) => string | null;
    createMidpointFromPoints: (aId: string, bId: string) => string | null;
    createMidpointFromSegment: (segId: string) => string | null;
    createPointOnLine: (lineId: string, s: number) => string | null;
    createPointOnSegment: (segId: string, u: number) => string | null;
    createPointOnCircle: (circleId: string, t: number) => string | null;
    createIntersectionPoint: (objA: GeometryObjectRef, objB: GeometryObjectRef, preferredWorld: Vec2) => string | null;
    setSelectedObject: (obj: { type: "point" | "segment" | "line" | "circle"; id: string } | null) => void;
    setCopyStyleSource: (obj: { type: "point" | "segment" | "line" | "circle"; id: string }) => void;
    applyCopyStyleTo: (obj: { type: "point" | "segment" | "line" | "circle"; id: string }) => void;
    camera: Camera;
    vp: Viewport;
  }
) {
  const ensurePointId = (): string => {
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
    if (!pendingTool || pendingTool.tool !== "segment") {
      io.setPendingTool({ tool: "segment", aPointId: ensurePointId() });
      return;
    }
    const bId = ensurePointId();
    io.createSegment(pendingTool.aPointId, bId);
    io.clearPendingTool();
    return;
  }

  if (activeTool === "line2p") {
    if (!pendingTool || pendingTool.tool !== "line2p") {
      io.setPendingTool({ tool: "line2p", aPointId: ensurePointId() });
      return;
    }
    const bId = ensurePointId();
    io.createLine(pendingTool.aPointId, bId);
    io.clearPendingTool();
    return;
  }

  if (activeTool === "circle") {
    if (!pendingTool || pendingTool.tool !== "circle") {
      io.setPendingTool({ tool: "circle", aPointId: ensurePointId() });
      return;
    }
    const radiusId = ensurePointId();
    io.createCircle(pendingTool.aPointId, radiusId);
    io.clearPendingTool();
    return;
  }

  if (activeTool === "midpoint") {
    if (pendingTool && pendingTool.tool === "midpoint") {
      const bId = ensurePointId();
      io.createMidpointFromPoints(pendingTool.aPointId, bId);
      io.clearPendingTool();
      return;
    }

    if (hits.hitPointId) {
      io.setPendingTool({ tool: "midpoint", aPointId: hits.hitPointId });
      return;
    }

    if (hits.hitSegmentId) {
      io.createMidpointFromSegment(hits.hitSegmentId);
      io.clearPendingTool();
      return;
    }

    io.setPendingTool({ tool: "midpoint", aPointId: ensurePointId() });
  }
}

function hitTestTopObject(
  screenPoint: Vec2,
  points: Array<{ point: ScenePoint; world: Vec2 }>,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
): { type: "point" | "segment" | "line" | "circle"; id: string } | null {
  const pointId = hitTestPoint(screenPoint, points, camera, vp, POINT_HIT_TOLERANCE_PX);
  if (pointId) return { type: "point", id: pointId };

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
    const a = geoStoreHelpers.getPointWorldById(scene, line.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, line.bId);
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
  const worldCursor = camMath.screenToWorld(screenPoint, camera, vp);

  for (let i = scene.circles.length - 1; i >= 0; i -= 1) {
    const circle = scene.circles[i];
    if (!circle.visible) continue;
    const center = geoStoreHelpers.getPointWorldById(scene, circle.centerId);
    const radiusPoint = geoStoreHelpers.getPointWorldById(scene, circle.radiusPointId);
    if (!center || !radiusPoint) continue;
    const radius = distance(center, radiusPoint);
    const d = Math.abs(distance(worldCursor, center) - radius) * camera.zoom;
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
  selectedObject: { type: "point" | "segment" | "line" | "circle"; id: string } | null,
  copySource: { type: "point" | "segment" | "line" | "circle"; id: string } | null
) {
  ctx.save();
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    const center = geoStoreHelpers.getPointWorldById(scene, circle.centerId);
    const radiusPoint = geoStoreHelpers.getPointWorldById(scene, circle.radiusPointId);
    if (!center || !radiusPoint) continue;
    const c = camMath.worldToScreen(center, camera, vp);
    const r = distance(center, radiusPoint) * camera.zoom;
    ctx.setLineDash(circle.style.dash === "dashed" ? [8, 6] : []);
    ctx.strokeStyle = circle.style.strokeColor;
    ctx.globalAlpha = circle.style.opacity;
    ctx.lineWidth = circle.style.strokeWidth;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();

    if (selectedObject?.type === "circle" && selectedObject.id === circle.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = circle.style.strokeWidth + 2;
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

function drawPendingConstructionPreview(
  ctx: CanvasRenderingContext2D,
  pending: PendingToolState,
  cursorWorld: Vec2 | null,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
) {
  if (!pending || !cursorWorld) return;
  const a = geoStoreHelpers.getPointWorldById(scene, pending.aPointId);
  if (!a) return;
  const p1 = camMath.worldToScreen(a, camera, vp);
  const p2 = camMath.worldToScreen(cursorWorld, camera, vp);

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 1.3;

  if (pending.tool === "segment") {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (pending.tool === "line2p") {
    const d = sub(cursorWorld, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) {
      ctx.restore();
      return;
    }
    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const q1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const q2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: { type: "point" | "segment" | "line" | "circle"; id: string } | null,
  copySource: { type: "point" | "segment" | "line" | "circle"; id: string } | null
) {
  ctx.save();

  for (const line of scene.lines) {
    if (!line.visible) continue;
    const a = geoStoreHelpers.getPointWorldById(scene, line.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, line.bId);
    if (!a || !b) continue;

    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) continue;

    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const p1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const p2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);

    ctx.setLineDash(line.style.dash === "dashed" ? [8, 6] : []);
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
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = line.style.strokeWidth + 2;
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
  selectedObject: { type: "point" | "segment" | "line" | "circle"; id: string } | null,
  copySource: { type: "point" | "segment" | "line" | "circle"; id: string } | null
) {
  ctx.save();

  for (const seg of scene.segments) {
    if (!seg.visible) continue;
    const a = geoStoreHelpers.getPointWorldById(scene, seg.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, seg.bId);
    if (!a || !b) continue;

    const p1 = camMath.worldToScreen(a, camera, vp);
    const p2 = camMath.worldToScreen(b, camera, vp);

    ctx.setLineDash(seg.style.dash === "dashed" ? [8, 6] : []);
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
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = seg.style.strokeWidth + 2;
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

function drawPoints(
  ctx: CanvasRenderingContext2D,
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  selectedObject: { type: "point" | "segment" | "line" | "circle"; id: string } | null,
  camera: Camera,
  vp: Viewport,
  copySource: { type: "point" | "segment" | "line" | "circle"; id: string } | null
) {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

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
      const lx = p.x + labelOffset.x;
      const ly = p.y + labelOffset.y;
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
    const a = geoStoreHelpers.getPointWorldById(scene, line.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, line.bId);
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
  const radiusPoint = geoStoreHelpers.getPointWorldById(scene, circle.radiusPointId);
  if (!center || !radiusPoint) {
    ctx.restore();
    return;
  }
  const c = camMath.worldToScreen(center, camera, vp);
  const r = distance(center, radiusPoint) * camera.zoom;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
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
