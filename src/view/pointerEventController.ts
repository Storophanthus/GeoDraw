import type { Vec2 } from "../geo/vec2";
import type { ExportClipHandle } from "./exportClipHandles";
import type { PointerMode } from "./pointerInteraction";
import { bufferDragForMode, resetDragBuffers, type DragBufferAccess } from "./pointerDragInteraction";

type PointerState = {
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

type PointerStateRef = { current: PointerState };
type DragFrameRef = { current: number | null };

type PointerHits = {
  hitClipHandle?: ExportClipHandle | null;
  hitTextLabelId?: string | null;
  hitRichTextNodeId?: string | null;
  hitPointId: string | null;
  hitLabelId: string | null;
  hitAngleLabelId: string | null;
  hitAngleId: string | null;
  hitPolygonId: string | null;
  hitSegmentId: string | null;
  hitLineId: string | null;
  hitCircleId: string | null;
  hitEllipseId: string | null;
  hitObjectLabel:
    | { type: "segment"; id: string }
    | { type: "line"; id: string }
    | { type: "circle"; id: string }
    | { type: "ellipse"; id: string }
    | { type: "polygon"; id: string }
    | null;
};

type MoveDecision = {
  mode: PointerMode;
  pointId: string | null;
  clipHandle: ExportClipHandle | null;
  dragObjectType: "segment" | "line" | "circle" | "ellipse" | "polygon" | null;
  selectedObject:
    | { type: "point"; id: string }
    | { type: "segment"; id: string }
    | { type: "line"; id: string }
    | { type: "circle"; id: string }
    | { type: "ellipse"; id: string }
    | { type: "polygon"; id: string }
    | { type: "angle"; id: string }
    | { type: "textLabel"; id: string }
    | { type: "richText"; id: string }
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
  computeHoveredHit: (screen: Vec2) => { type: "point" | "angle" | "segment" | "line2p" | "circle" | "ellipse" | "polygon"; id: string } | null;
  applyCursor: (
    hovered: { type: "point" | "angle" | "segment" | "line2p" | "circle" | "ellipse" | "polygon"; id: string } | null,
    modeOverride?: PointerMode,
    screen?: Vec2
  ) => void;
  scheduleDragUpdate: () => void;
  flushDragUpdate: () => void;
  setHoverScreen: (screen: Vec2) => void;
  setSnapDisabled: (disabled: boolean) => void;
  setCursorWorldFromScreen: (screen: Vec2) => void;
  setHoveredHit: (hit: { type: "point" | "angle" | "segment" | "line2p" | "circle" | "ellipse" | "polygon"; id: string } | null) => void;
  setSelectedObject: (
    obj:
      | { type: "point"; id: string }
      | { type: "segment"; id: string }
      | { type: "line"; id: string }
      | { type: "circle"; id: string }
      | { type: "ellipse"; id: string }
      | { type: "polygon"; id: string }
      | { type: "angle"; id: string }
      | { type: "textLabel"; id: string }
      | { type: "richText"; id: string }
      | null
  ) => void;
  beginTextLabelEditing?: (id: string) => boolean;
  resolveHits: (screen: Vec2, e: PointerEvent) => PointerHits;
  decideMovePointerDown: (hits: PointerHits) => MoveDecision;
  onToolClickRelease: (screen: Vec2, e: PointerEvent, hits: PointerHits) => void;
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
    deps.applyCursor(hovered, undefined, screen);
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
    if (e.button !== 0 || e.ctrlKey) return;
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
    let clipHandle: ExportClipHandle | null = null;
    let objectType: PointerState["objectType"] = null;

    if (deps.activeTool === "move") {
      const decision = deps.decideMovePointerDown(hits);
      mode = decision.mode;
      pointId = decision.pointId;
      clipHandle = decision.clipHandle;
      objectType = decision.selectedObject?.type ?? decision.dragObjectType ?? null;
      // Grabbing a crop handle is not a selection change, so leave the current
      // selection alone rather than clearing it.
      if (mode !== "drag-clip-handle") {
        deps.setSelectedObject(decision.selectedObject);
      }
    } else if (deps.activeTool === "label" || deps.activeTool === "textbox") {
      const decision = deps.decideMovePointerDown(hits);
      const shouldEnterTextboxEdit =
        deps.activeTool === "textbox"
        && Boolean(hits.hitTextLabelId)
        && typeof deps.beginTextLabelEditing === "function";
      if (shouldEnterTextboxEdit) {
        mode = "tool-click";
        pointId = null;
        objectType = null;
      } else if (
        decision.mode === "drag-label"
        || decision.mode === "drag-angle-label"
        || decision.mode === "drag-object-label"
        || decision.mode === "drag-text-label"
      ) {
        mode = decision.mode;
        pointId = decision.pointId;
        objectType = decision.selectedObject?.type ?? decision.dragObjectType ?? null;
      } else {
        mode = "tool-click";
        pointId = null;
        objectType = null;
      }
      if (decision.selectedObject) {
        deps.setSelectedObject(decision.selectedObject);
      }
    } else {
      mode = "tool-click";
    }

    deps.canvas.setPointerCapture(e.pointerId);
    deps.pointerRef.current = {
      active: true,
      pid: e.pointerId,
      mode,
      pointId,
      clipHandle,
      objectType,
      lastX: e.clientX,
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    deps.applyCursor(hovered, mode, screen);
  };

  const onMove = (e: PointerEvent) => {
    const screen = deps.readScreen(e);
    const st = deps.pointerRef.current;
    if (st.active && st.pid === e.pointerId && st.mode !== "tool-click") {
      deps.setSnapDisabled(e.shiftKey);
      // The hovered-handle highlight is derived from hoverScreen, which the drag
      // path otherwise leaves frozen at the grab point — stale by the time the
      // box has resized under the cursor.
      if (st.mode === "drag-clip-handle") deps.setHoverScreen(screen);
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

    if (st.mode === "tool-click" && !st.moved) {
      const screen = deps.readScreen(e);
      deps.onToolClickRelease(screen, e, deps.resolveHits(screen, e));
    }
    deps.pointerRef.current = {
      active: false,
      pid: -1,
      mode: "idle",
      pointId: null,
      clipHandle: null,
      objectType: null,
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
    deps.applyCursor(hovered, undefined, screen);
  };

  return { onDown, onMove, finish, cancelPendingHoverUpdate };
}

type CreateCanvasAuxHandlersDeps = {
  canvas: HTMLCanvasElement;
  readScreen: (e: PointerEvent | WheelEvent) => Vec2;
  setHoverScreen: (screen: Vec2 | null) => void;
  setCursorWorldFromScreen: (screen: Vec2) => void;
  setCursorWorldNull: () => void;
  setHoveredHit: (hit: { type: "point" | "angle" | "segment" | "line2p" | "circle" | "ellipse" | "polygon"; id: string } | null) => void;
  zoomAtScreenPoint: (screen: Vec2, zoomFactor: number) => void;
  onWheelZoom?: (zoomFactor: number) => void;
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
    deps.onWheelZoom?.(factor);
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
