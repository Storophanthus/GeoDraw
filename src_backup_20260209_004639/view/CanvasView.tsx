import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import type { Vec2 } from "../geo/vec2";
import { add, mul, projectPointToLine, projectPointToSegment, sub } from "../geo/geometry";
import { drawRectGrid, type RectGridSettings } from "../render/rectGrid";
import {
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

const POINT_HIT_TOLERANCE_PX = 12;
const SEGMENT_HIT_TOLERANCE_PX = 10;
const LINE_HIT_TOLERANCE_PX = 10;
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
  const pointDefaults = useGeoStore((store) => store.pointDefaults);

  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const panByScreenDelta = useGeoStore((store) => store.panByScreenDelta);
  const zoomAtScreenPoint = useGeoStore((store) => store.zoomAtScreenPoint);
  const createFreePoint = useGeoStore((store) => store.createFreePoint);
  const createSegment = useGeoStore((store) => store.createSegment);
  const createLine = useGeoStore((store) => store.createLine);
  const createMidpointFromPoints = useGeoStore((store) => store.createMidpointFromPoints);
  const createMidpointFromSegment = useGeoStore((store) => store.createMidpointFromSegment);
  const movePointTo = useGeoStore((store) => store.movePointTo);
  const movePointLabelBy = useGeoStore((store) => store.movePointLabelBy);

  const [vp, setVp] = useState<Viewport>({ widthPx: 800, heightPx: 600 });
  const [pendingTool, setPendingTool] = useState<PendingToolState>(null);

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
        if (pendingTool) {
          e.preventDefault();
          setPendingTool(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingTool]);

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
      drawLines(ctx, scene, camera, vp, selectedObject);
      drawSegments(ctx, scene, camera, vp, selectedObject);
      drawPoints(ctx, resolvedPoints, selectedObject, camera, vp);

      if (pendingTool) {
        const a = geoStoreHelpers.getPointWorldById(scene, pendingTool.aPointId);
        if (a) {
          const s = camMath.worldToScreen(a, camera, vp);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    },
    [camera, dpr, pendingTool, resolvedPoints, scene, selectedObject, vp]
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
      const hitPointId = hitTestPoint(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX);
      const hitLabelId =
        hitTestLabelFromDom(e.clientX, e.clientY, labelsLayerRef.current) ??
        hitTestLabel(screen, resolvedPoints, camera, vp, pointDefaults.labelOffsetPx);
      const hitSegmentId = hitTestSegment(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX);
      const hitLineId = hitTestLine(screen, scene, camera, vp, LINE_HIT_TOLERANCE_PX);

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
      const st = pointerRef.current;
      if (!st.active || st.pid !== e.pointerId) return;

      const screen = readScreen(e);
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
        handleToolClick(screen, activeTool, pendingTool, {
          hitPointId: hitTestPoint(screen, resolvedPoints, camera, vp, POINT_HIT_TOLERANCE_PX),
          hitSegmentId: hitTestSegment(screen, scene, camera, vp, SEGMENT_HIT_TOLERANCE_PX),
        }, {
          setPendingTool,
          createFreePoint,
          createSegment,
          createLine,
          createMidpointFromPoints,
          createMidpointFromSegment,
          setSelectedObject,
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
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const screen = readScreen(e);
      const zoomFactor = Math.pow(1.0015, -e.deltaY);
      zoomAtScreenPoint(vp, screen, zoomFactor);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", finish);
      canvas.removeEventListener("pointercancel", finish);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [
    activeTool,
    camera,
    createFreePoint,
    createLine,
    createMidpointFromPoints,
    createMidpointFromSegment,
    createSegment,
    movePointLabelBy,
    movePointTo,
    panByScreenDelta,
    pendingTool,
    pointDefaults.labelOffsetPx,
    resolvedPoints,
    scene,
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
  hits: { hitPointId: string | null; hitSegmentId: string | null },
  io: {
    setPendingTool: (next: PendingToolState) => void;
    createFreePoint: (world: Vec2) => string;
    createSegment: (aId: string, bId: string) => string | null;
    createLine: (aId: string, bId: string) => string | null;
    createMidpointFromPoints: (aId: string, bId: string) => string | null;
    createMidpointFromSegment: (segId: string) => string | null;
    setSelectedObject: (obj: { type: "point" | "segment" | "line"; id: string } | null) => void;
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
    if (hits.hitPointId) {
      io.setSelectedObject({ type: "point", id: hits.hitPointId });
      return;
    }
    const world = camMath.screenToWorld(screen, io.camera, io.vp);
    io.createFreePoint(world);
    return;
  }

  if (activeTool === "segment") {
    if (!pendingTool || pendingTool.tool !== "segment") {
      io.setPendingTool({ tool: "segment", aPointId: ensurePointId() });
      return;
    }
    const bId = ensurePointId();
    io.createSegment(pendingTool.aPointId, bId);
    io.setPendingTool(null);
    return;
  }

  if (activeTool === "line2p") {
    if (!pendingTool || pendingTool.tool !== "line2p") {
      io.setPendingTool({ tool: "line2p", aPointId: ensurePointId() });
      return;
    }
    const bId = ensurePointId();
    io.createLine(pendingTool.aPointId, bId);
    io.setPendingTool(null);
    return;
  }

  if (activeTool === "midpoint") {
    if (hits.hitSegmentId) {
      io.createMidpointFromSegment(hits.hitSegmentId);
      io.setPendingTool(null);
      return;
    }

    if (!pendingTool || pendingTool.tool !== "midpoint") {
      io.setPendingTool({ tool: "midpoint", aPointId: ensurePointId() });
      return;
    }

    const bId = ensurePointId();
    io.createMidpointFromPoints(pendingTool.aPointId, bId);
    io.setPendingTool(null);
  }
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

function drawLines(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: { type: "point" | "segment" | "line"; id: string } | null
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
  }

  ctx.restore();
}

function drawSegments(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: { type: "point" | "segment" | "line"; id: string } | null
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
  }

  ctx.restore();
}

function drawPoints(
  ctx: CanvasRenderingContext2D,
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  selectedObject: { type: "point" | "segment" | "line"; id: string } | null,
  camera: Camera,
  vp: Viewport
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
