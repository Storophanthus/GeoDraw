import type { Vec2 } from "../geo/vec2";
import type { PointerMode } from "./pointerInteraction";

type PointerStateLike = {
  active: boolean;
  mode: PointerMode;
  pointId: string | null;
  objectType: "point" | "angle" | "segment" | "line" | "circle" | "polygon" | "textLabel" | null;
};

export type DragBufferAccess = {
  getPanDelta: () => Vec2;
  setPanDelta: (next: Vec2) => void;
  getLabelDelta: () => Vec2;
  setLabelDelta: (next: Vec2) => void;
  getPointScreen: () => Vec2 | null;
  setPointScreen: (next: Vec2 | null) => void;
  getPointId: () => string | null;
  setPointId: (next: string | null) => void;
  getAngleLabelScreen: () => Vec2 | null;
  setAngleLabelScreen: (next: Vec2 | null) => void;
};

type DragUpdateOps = {
  panByScreenDelta: (delta: Vec2) => void;
  movePointTo: (pointId: string, world: Vec2) => void;
  movePolygonByWorldDelta: (polygonId: string, deltaWorld: Vec2) => void;
  movePointLabelBy: (pointId: string, delta: Vec2) => void;
  moveAngleLabelTo: (angleId: string, world: Vec2) => void;
  moveObjectLabelTo: (
    obj: { type: "segment" | "line" | "circle" | "polygon"; id: string },
    world: Vec2
  ) => void;
  moveTextLabelTo: (id: string, world: Vec2) => void;
  moveTextLabelByWorldDelta: (id: string, deltaWorld: Vec2) => void;
  screenToWorld: (screen: Vec2) => Vec2;
  screenDeltaToWorldDelta: (delta: Vec2) => Vec2;
};

export function applyBufferedDragUpdate(
  st: PointerStateLike,
  buffers: DragBufferAccess,
  ops: DragUpdateOps
): void {
  if (!st.active) return;

  if (st.mode === "pan") {
    const panDelta = buffers.getPanDelta();
    if (panDelta.x !== 0 || panDelta.y !== 0) {
      ops.panByScreenDelta(panDelta);
      buffers.setPanDelta({ x: 0, y: 0 });
    }
    return;
  }

  if (st.mode === "drag-label" && st.pointId) {
    const labelDelta = buffers.getLabelDelta();
    if (labelDelta.x !== 0 || labelDelta.y !== 0) {
      ops.movePointLabelBy(st.pointId, labelDelta);
      buffers.setLabelDelta({ x: 0, y: 0 });
    }
    return;
  }

  if (st.mode === "drag-polygon" && st.pointId) {
    const panDelta = buffers.getPanDelta();
    if (panDelta.x !== 0 || panDelta.y !== 0) {
      ops.movePolygonByWorldDelta(st.pointId, ops.screenDeltaToWorldDelta(panDelta));
      buffers.setPanDelta({ x: 0, y: 0 });
    }
    return;
  }

  if (st.mode === "drag-angle-label" && st.pointId) {
    const angleLabelScreen = buffers.getAngleLabelScreen();
    if (angleLabelScreen) {
      ops.moveAngleLabelTo(st.pointId, ops.screenToWorld(angleLabelScreen));
    }
    return;
  }

  if (st.mode === "drag-object-label" && st.pointId && st.objectType) {
    if (
      st.objectType !== "segment"
      && st.objectType !== "line"
      && st.objectType !== "circle"
      && st.objectType !== "polygon"
    ) {
      return;
    }
    const objectLabelScreen = buffers.getAngleLabelScreen();
    if (objectLabelScreen) {
      ops.moveObjectLabelTo({ type: st.objectType, id: st.pointId }, ops.screenToWorld(objectLabelScreen));
    }
    return;
  }

  if (st.mode === "drag-text-label" && st.pointId) {
    const panDelta = buffers.getPanDelta();
    if (panDelta.x !== 0 || panDelta.y !== 0) {
      ops.moveTextLabelByWorldDelta(st.pointId, ops.screenDeltaToWorldDelta(panDelta));
      buffers.setPanDelta({ x: 0, y: 0 });
    }
    return;
  }

  if (st.mode === "drag-point") {
    const pointScreen = buffers.getPointScreen();
    const pointId = buffers.getPointId();
    if (pointScreen && pointId) {
      ops.movePointTo(pointId, ops.screenToWorld(pointScreen));
    }
  }
}

export function bufferDragForMode(
  st: PointerStateLike,
  dx: number,
  dy: number,
  screen: Vec2,
  buffers: DragBufferAccess
): boolean {
  if (st.mode === "pan") {
    const panDelta = buffers.getPanDelta();
    buffers.setPanDelta({
      x: panDelta.x + dx,
      y: panDelta.y + dy,
    });
    return true;
  }

  if (st.mode === "drag-point" && st.pointId) {
    buffers.setPointId(st.pointId);
    buffers.setPointScreen(screen);
    return true;
  }

  if (st.mode === "drag-polygon" && st.pointId) {
    const panDelta = buffers.getPanDelta();
    buffers.setPanDelta({
      x: panDelta.x + dx,
      y: panDelta.y + dy,
    });
    return true;
  }

  if (st.mode === "drag-label" && st.pointId) {
    const labelDelta = buffers.getLabelDelta();
    buffers.setLabelDelta({
      x: labelDelta.x + dx,
      y: labelDelta.y + dy,
    });
    return true;
  }

  if (st.mode === "drag-angle-label" && st.pointId) {
    buffers.setAngleLabelScreen(screen);
    return true;
  }

  if (st.mode === "drag-object-label" && st.pointId) {
    buffers.setAngleLabelScreen(screen);
    return true;
  }

  if (st.mode === "drag-text-label" && st.pointId) {
    const panDelta = buffers.getPanDelta();
    buffers.setPanDelta({
      x: panDelta.x + dx,
      y: panDelta.y + dy,
    });
    return true;
  }

  return false;
}

export function resetDragBuffers(buffers: DragBufferAccess): void {
  buffers.setPanDelta({ x: 0, y: 0 });
  buffers.setLabelDelta({ x: 0, y: 0 });
  buffers.setPointScreen(null);
  buffers.setPointId(null);
  buffers.setAngleLabelScreen(null);
}
