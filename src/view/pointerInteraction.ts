import type { ScenePoint } from "../scene/points";
import { isPointDraggable } from "../scene/points";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import { isValidTarget, toolAllowsEmptyPointCreation } from "../tools/toolClick";

export type PointerMode =
  | "idle"
  | "pan"
  | "drag-point"
  | "drag-label"
  | "drag-angle-label"
  | "tool-click";

type MovePointerDownDecision = {
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

type MovePointerDownInput = {
  hitLabelId: string | null;
  hitAngleLabelId: string | null;
  hitPointId: string | null;
  hitSegmentId: string | null;
  hitPolygonId: string | null;
  hitLineId: string | null;
  hitCircleId: string | null;
  hitAngleId: string | null;
  scenePoints: ScenePoint[];
};

export function decideMovePointerDown(input: MovePointerDownInput): MovePointerDownDecision {
  const {
    hitLabelId,
    hitAngleLabelId,
    hitPointId,
    hitSegmentId,
    hitPolygonId,
    hitLineId,
    hitCircleId,
    hitAngleId,
    scenePoints,
  } = input;

  if (hitLabelId) {
    return {
      mode: "drag-label",
      pointId: hitLabelId,
      selectedObject: { type: "point", id: hitLabelId },
    };
  }

  if (hitAngleLabelId) {
    return {
      mode: "drag-angle-label",
      pointId: hitAngleLabelId,
      selectedObject: { type: "angle", id: hitAngleLabelId },
    };
  }

  if (hitPointId) {
    const hitPoint = scenePoints.find((item) => item.id === hitPointId) ?? null;
    return {
      mode: hitPoint && isPointDraggable(hitPoint) ? "drag-point" : "idle",
      pointId: hitPoint && isPointDraggable(hitPoint) ? hitPointId : null,
      selectedObject: { type: "point", id: hitPointId },
    };
  }

  if (hitPolygonId) {
    return { mode: "idle", pointId: null, selectedObject: { type: "polygon", id: hitPolygonId } };
  }

  if (hitSegmentId) {
    return { mode: "idle", pointId: null, selectedObject: { type: "segment", id: hitSegmentId } };
  }

  if (hitLineId) {
    return { mode: "idle", pointId: null, selectedObject: { type: "line", id: hitLineId } };
  }

  if (hitCircleId) {
    return { mode: "idle", pointId: null, selectedObject: { type: "circle", id: hitCircleId } };
  }

  if (hitAngleId) {
    return { mode: "idle", pointId: null, selectedObject: { type: "angle", id: hitAngleId } };
  }

  return { mode: "pan", pointId: null, selectedObject: null };
}

export function computeCanvasCursor(
  activeTool: ActiveTool,
  mode: PointerMode,
  hoveredHit: HoveredHit,
  pendingSelection: PendingSelection
): string {
  if (activeTool === "move") {
    if (mode === "pan" || mode === "drag-point" || mode === "drag-label" || mode === "drag-angle-label") {
      return "grabbing";
    }
    if (hoveredHit?.type === "point" || hoveredHit?.type === "angle" || hoveredHit?.type === "polygon") {
      return "pointer";
    }
    return "grab";
  }

  if (activeTool === "copyStyle") {
    return hoveredHit ? "pointer" : "grab";
  }

  if (hoveredHit && isValidTarget(activeTool, pendingSelection, hoveredHit)) {
    return "pointer";
  }

  if (toolAllowsEmptyPointCreation(activeTool, pendingSelection)) {
    return "crosshair";
  }

  return "default";
}
