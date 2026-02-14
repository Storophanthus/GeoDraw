import type { Vec2 } from "../geo/vec2";
import type { PointerMode } from "./pointerInteraction";
import { bufferDragForMode, resetDragBuffers, type DragBufferAccess } from "./pointerDragInteraction";

type PointerState = {
  active: boolean;
  pid: number;
  mode: PointerMode;
  pointId: string | null;
  exportClipStartedOnDown: boolean;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type PointerStateRef = { current: PointerState };
type DragFrameRef = { current: number | null };

type PointerHits = {
  hitPointId: string | null;
  hitLabelId: string | null;
  hitAngleLabelId: string | null;
  hitAngleId: string | null;
  hitPolygonId: string | null;
  hitSegmentId: string | null;
  hitLineId: string | null;
  hitCircleId: string | null;
};

type MoveDecision = {
  mode: PointerMode;
  pointId: string | null;
  selectedObject:
    | { type: "point"; id: string }
    | { type: "segment"; id: string }
    | { type: "line"; id: string }
    | { type: "circle"; id: string }
    | { type: "polygon"; id: string }
    | { type: "angle"; id: string }
    | null;
};

type CreatePointerHandlersDeps = {
  canvas: HTMLCanvasElement;
  activeTool: string;
  pendingSelection: { tool: string } | null;
  pointerRef: PointerStateRef;
  dragFrameRef: DragFrameRef;
  dragBuffers: DragBufferAccess;
  clickEpsilonPx: number;
  readScreen: (e: PointerEvent) => Vec2;
  computeHoveredHit: (screen: Vec2) => { type: "point" | "angle" | "segment" | "line2p" | "circle" | "polygon"; id: string } | null;
  applyCursor: (
    hovered: { type: "point" | "angle" | "segment" | "line2p" | "circle" | "polygon"; id: string } | null,
    modeOverride?: PointerMode
  ) => void;
  scheduleDragUpdate: () => void;
  flushDragUpdate: () => void;
  setHoverScreen: (screen: Vec2) => void;
  setSnapDisabled: (disabled: boolean) => void;
  setCursorWorldFromScreen: (screen: Vec2) => void;
  setHoveredHit: (hit: { type: "point" | "angle" | "segment" | "line2p" | "circle" | "polygon"; id: string } | null) => void;
  setSelectedObject: (
    obj:
      | { type: "point"; id: string }
      | { type: "segment"; id: string }
      | { type: "line"; id: string }
      | { type: "circle"; id: string }
      | { type: "polygon"; id: string }
      | { type: "angle"; id: string }
      | null
  ) => void;
  resolveHits: (screen: Vec2, e: PointerEvent) => PointerHits;
  decideMovePointerDown: (hits: PointerHits) => MoveDecision;
  onToolClickRelease: (screen: Vec2, e: PointerEvent) => void;
};

export function createPointerHandlers(deps: CreatePointerHandlersDeps) {
  let hoverRafId: number | null = null;
  let pendingHover: { screen: Vec2; shiftKey: boolean } | null = null;

  const flushHoverUpdate = () => {
    hoverRafId = null;
    if (!pendingHover) return;
    const { screen, shiftKey } = pendingHover;
    pendingHover = null;
    deps.setHoverScreen(screen);
    deps.setSnapDisabled(shiftKey);
    deps.setCursorWorldFromScreen(screen);
    const hovered = deps.computeHoveredHit(screen);
    deps.setHoveredHit(hovered);
    deps.applyCursor(hovered);
  };

  const scheduleHoverUpdate = (screen: Vec2, shiftKey: boolean) => {
    pendingHover = { screen, shiftKey };
    if (hoverRafId !== null) return;
    hoverRafId = window.requestAnimationFrame(flushHoverUpdate);
  };

  const cancelPendingHoverUpdate = () => {
    pendingHover = null;
    if (hoverRafId !== null) {
      cancelAnimationFrame(hoverRafId);
      hoverRafId = null;
    }
  };

  const onDown = (e: PointerEvent) => {
    cancelPendingHoverUpdate();
    const screen = deps.readScreen(e);
    deps.setHoverScreen(screen);
    deps.setSnapDisabled(e.shiftKey);
    deps.setCursorWorldFromScreen(screen);
    const hovered = deps.computeHoveredHit(screen);
    deps.setHoveredHit(hovered);
    const hits = deps.resolveHits(screen, e);

    let mode: PointerMode = "idle";
    let pointId: string | null = null;
    let exportClipStartedOnDown = false;

    if (deps.activeTool === "move") {
      const decision = deps.decideMovePointerDown(hits);
      mode = decision.mode;
      pointId = decision.pointId;
      deps.setSelectedObject(decision.selectedObject);
    } else {
      mode = "tool-click";
      if (deps.activeTool === "export_clip" && (!deps.pendingSelection || deps.pendingSelection.tool !== "export_clip")) {
        deps.onToolClickRelease(screen, e);
        exportClipStartedOnDown = true;
      }
    }

    deps.canvas.setPointerCapture(e.pointerId);
    deps.pointerRef.current = {
      active: true,
      pid: e.pointerId,
      mode,
      pointId,
      exportClipStartedOnDown,
      lastX: e.clientX,
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    deps.applyCursor(hovered, mode);
  };

  const onMove = (e: PointerEvent) => {
    const screen = deps.readScreen(e);
    const st = deps.pointerRef.current;
    if (st.active && st.pid === e.pointerId && st.mode !== "tool-click") {
      deps.setSnapDisabled(e.shiftKey);
      const dx = e.clientX - st.lastX;
      const dy = e.clientY - st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;

      const travelX = e.clientX - st.startX;
      const travelY = e.clientY - st.startY;
      if (travelX * travelX + travelY * travelY > deps.clickEpsilonPx * deps.clickEpsilonPx) {
        st.moved = true;
      }

      const queued = bufferDragForMode(st, dx, dy, screen, deps.dragBuffers);
      if (queued) deps.scheduleDragUpdate();
      return;
    }

    scheduleHoverUpdate(screen, e.shiftKey);

    if (!st.active || st.pid !== e.pointerId) return;

    const dx = e.clientX - st.lastX;
    const dy = e.clientY - st.lastY;
    st.lastX = e.clientX;
    st.lastY = e.clientY;

    const travelX = e.clientX - st.startX;
    const travelY = e.clientY - st.startY;
    if (travelX * travelX + travelY * travelY > deps.clickEpsilonPx * deps.clickEpsilonPx) {
      st.moved = true;
    }
    const queued = bufferDragForMode(st, dx, dy, screen, deps.dragBuffers);
    if (queued) deps.scheduleDragUpdate();
  };

  const finish = (e: PointerEvent) => {
    const st = deps.pointerRef.current;
    if (!st.active || st.pid !== e.pointerId) return;
    if (deps.dragFrameRef.current !== null) {
      cancelAnimationFrame(deps.dragFrameRef.current);
      deps.dragFrameRef.current = null;
    }
    deps.flushDragUpdate();

    if (st.mode === "tool-click" && (!st.moved || deps.activeTool === "export_clip")) {
      if (deps.activeTool === "export_clip") {
        const shouldFinalize =
          (!st.exportClipStartedOnDown && deps.pendingSelection?.tool === "export_clip")
          || (st.exportClipStartedOnDown && st.moved);
        if (shouldFinalize) {
          const screen = deps.readScreen(e);
          deps.onToolClickRelease(screen, e);
        }
      } else {
        const screen = deps.readScreen(e);
        deps.onToolClickRelease(screen, e);
      }
    }

    deps.pointerRef.current = {
      active: false,
      pid: -1,
      mode: "idle",
      pointId: null,
      exportClipStartedOnDown: false,
      lastX: 0,
      lastY: 0,
      startX: 0,
      startY: 0,
      moved: false,
    };
    resetDragBuffers(deps.dragBuffers);
    cancelPendingHoverUpdate();
    deps.setSnapDisabled(e.shiftKey);
    const screen = deps.readScreen(e);
    const hovered = deps.computeHoveredHit(screen);
    deps.setHoveredHit(hovered);
    deps.applyCursor(hovered);
  };

  return { onDown, onMove, finish, cancelPendingHoverUpdate };
}

type CreateCanvasAuxHandlersDeps = {
  canvas: HTMLCanvasElement;
  readScreen: (e: PointerEvent | WheelEvent) => Vec2;
  setHoverScreen: (screen: Vec2 | null) => void;
  setCursorWorldFromScreen: (screen: Vec2) => void;
  setCursorWorldNull: () => void;
  setHoveredHit: (hit: { type: "point" | "angle" | "segment" | "line2p" | "circle" | "polygon"; id: string } | null) => void;
  zoomAtScreenPoint: (screen: Vec2, zoomFactor: number) => void;
};

export function createCanvasAuxHandlers(deps: CreateCanvasAuxHandlersDeps) {
  let wheelRafId: number | null = null;
  let wheelScreen: Vec2 | null = null;
  let wheelFactor = 1;

  const flushWheelZoom = () => {
    wheelRafId = null;
    if (!wheelScreen) return;
    const factor = wheelFactor;
    const screen = wheelScreen;
    wheelFactor = 1;
    wheelScreen = null;
    deps.zoomAtScreenPoint(screen, factor);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const screen = deps.readScreen(e);
    const zoomFactor = Math.pow(1.0015, -e.deltaY);
    wheelScreen = screen;
    wheelFactor = Math.max(0.2, Math.min(5, wheelFactor * zoomFactor));
    if (wheelRafId === null) {
      wheelRafId = window.requestAnimationFrame(flushWheelZoom);
    }
  };

  const onLeave = () => {
    deps.setHoverScreen(null);
    deps.setCursorWorldNull();
    deps.setHoveredHit(null);
    deps.canvas.style.cursor = "default";
  };

  const cancelPendingWheelZoom = () => {
    wheelScreen = null;
    wheelFactor = 1;
    if (wheelRafId !== null) {
      cancelAnimationFrame(wheelRafId);
      wheelRafId = null;
    }
  };

  return { onWheel, onLeave, cancelPendingWheelZoom };
}
