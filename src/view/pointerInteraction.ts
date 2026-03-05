import type { ScenePoint } from "../scene/points";
import { isPointDraggable } from "../scene/points";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import { isValidTarget, toolAllowsEmptyPointCreation } from "../tools/toolClick";

export type PointerMode =
  | "idle"
  | "pan"
  | "drag-point"
  | "drag-polygon"
  | "drag-label"
  | "drag-angle-label"
  | "drag-object-label"
  | "drag-text-label"
  | "tool-click";

type MovePointerDownDecision = {
  mode: PointerMode;
  pointId: string | null;
  dragObjectType: "segment" | "line" | "circle" | "polygon" | null;
  selectedObject:
    | { type: "point"; id: string }
    | { type: "segment"; id: string }
    | { type: "line"; id: string }
    | { type: "circle"; id: string }
    | { type: "polygon"; id: string }
    | { type: "angle"; id: string }
    | { type: "textLabel"; id: string }
    | null;
};

type MovePointerDownInput = {
  hitTextLabelId?: string | null;
  hitLabelId: string | null;
  hitAngleLabelId: string | null;
  hitPointId: string | null;
  hitSegmentId: string | null;
  hitPolygonId: string | null;
  hitLineId: string | null;
  hitCircleId: string | null;
  hitAngleId: string | null;
  hitObjectLabel?:
    | { type: "segment"; id: string }
    | { type: "line"; id: string }
    | { type: "circle"; id: string }
    | { type: "polygon"; id: string }
    | null;
  scenePoints: ScenePoint[];
  sceneSegments?: Array<{
    id: string;
    aId: string;
    bId: string;
    ownedBySectorIds?: string[];
  }>;
  sceneAngles?: Array<{
    id: string;
    kind?: "angle" | "sector";
    aId: string;
    bId: string;
    cId: string;
  }>;
};

export function decideMovePointerDown(input: MovePointerDownInput): MovePointerDownDecision {
  const {
    hitTextLabelId,
    hitLabelId,
    hitAngleLabelId,
    hitPointId,
    hitSegmentId,
    hitPolygonId,
    hitLineId,
    hitCircleId,
    hitAngleId,
    hitObjectLabel = null,
    scenePoints,
    sceneSegments = [],
    sceneAngles = [],
  } = input;
  void sceneSegments;

  if (hitTextLabelId) {
    return {
      mode: "drag-text-label",
      pointId: hitTextLabelId,
      dragObjectType: null,
      selectedObject: { type: "textLabel", id: hitTextLabelId },
    };
  }

  if (hitLabelId) {
    return {
      mode: "drag-label",
      pointId: hitLabelId,
      dragObjectType: null,
      selectedObject: { type: "point", id: hitLabelId },
    };
  }

  if (hitAngleLabelId) {
    return {
      mode: "drag-angle-label",
      pointId: hitAngleLabelId,
      dragObjectType: null,
      selectedObject: { type: "angle", id: hitAngleLabelId },
    };
  }

  if (hitObjectLabel) {
    return {
      mode: "drag-object-label",
      pointId: hitObjectLabel.id,
      dragObjectType: hitObjectLabel.type,
      selectedObject: { type: hitObjectLabel.type, id: hitObjectLabel.id },
    };
  }

  if (hitPointId) {
    const hitPoint = scenePoints.find((item) => item.id === hitPointId) ?? null;
    return {
      mode: hitPoint && isPointDraggable(hitPoint) ? "drag-point" : "idle",
      pointId: hitPoint && isPointDraggable(hitPoint) ? hitPointId : null,
      dragObjectType: null,
      selectedObject: { type: "point", id: hitPointId },
    };
  }

  if (hitSegmentId) {
    if (hitAngleId && isSectorAngleHit(hitAngleId, sceneAngles)) {
      return { mode: "idle", pointId: null, dragObjectType: null, selectedObject: { type: "segment", id: hitSegmentId } };
    }
  }

  if (hitAngleId) {
    return { mode: "idle", pointId: null, dragObjectType: null, selectedObject: { type: "angle", id: hitAngleId } };
  }

  if (hitSegmentId) {
    return { mode: "idle", pointId: null, dragObjectType: null, selectedObject: { type: "segment", id: hitSegmentId } };
  }

  if (hitLineId) {
    return { mode: "idle", pointId: null, dragObjectType: null, selectedObject: { type: "line", id: hitLineId } };
  }

  if (hitCircleId) {
    return { mode: "idle", pointId: null, dragObjectType: null, selectedObject: { type: "circle", id: hitCircleId } };
  }

  if (hitPolygonId) {
    return {
      mode: "drag-polygon",
      pointId: hitPolygonId,
      dragObjectType: "polygon",
      selectedObject: { type: "polygon", id: hitPolygonId },
    };
  }

  return { mode: "pan", pointId: null, dragObjectType: null, selectedObject: null };
}

function isSectorAngleHit(
  angleId: string,
  angles: Array<{ id: string; kind?: "angle" | "sector"; aId: string; bId: string; cId: string }>
): boolean {
  const angle = angles.find((item) => item.id === angleId);
  return Boolean(angle && angle.kind === "sector");
}

export function computeCanvasCursor(
  activeTool: ActiveTool,
  mode: PointerMode,
  hoveredHit: HoveredHit,
  pendingSelection: PendingSelection
): string {
  if (activeTool === "move") {
    if (
      mode === "pan"
      || mode === "drag-point"
      || mode === "drag-polygon"
      || mode === "drag-label"
      || mode === "drag-angle-label"
      || mode === "drag-object-label"
      || mode === "drag-text-label"
    ) {
      return "grabbing";
    }
    if (hoveredHit?.type === "point" || hoveredHit?.type === "angle" || hoveredHit?.type === "polygon") {
      return "pointer";
    }
    return "grab";
  }

  if (activeTool === "label") {
    if (mode === "drag-label" || mode === "drag-angle-label" || mode === "drag-object-label" || mode === "drag-text-label") {
      return "grabbing";
    }
    return "crosshair";
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

export function shouldCancelOnCanvasDoubleClick(activeTool: ActiveTool, pendingSelection: PendingSelection): boolean {
  if (activeTool === "move") return true;
  if (!pendingSelection) return false;
  return pendingSelection.tool === "polygon" || pendingSelection.tool === "export_clip";
}
