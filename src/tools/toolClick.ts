import type { Vec2 } from "../geo/vec2";
import type { GeometryObjectRef, LineLikeObjectRef } from "../scene/points";
import type { ActiveTool, PendingSelection } from "../state/geoStore";
import { camera as camMath, type Camera, type Viewport } from "../view/camera";
import type { SnapCandidate } from "../view/snapEngine";

export type ToolClickHits = {
  hitPointId: string | null;
  hitSegmentId: string | null;
  hitObject: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null;
  shiftKey: boolean;
  hasCopyStyleSource: boolean;
  snap: SnapCandidate | null;
};

export type ToolClickIO = {
  setPendingSelection: (next: PendingSelection) => void;
  clearPendingSelection: () => void;
  createFreePoint: (world: Vec2) => string;
  createSegment: (aId: string, bId: string) => string | null;
  createLine: (aId: string, bId: string) => string | null;
  createCircle: (centerId: string, throughId: string) => string | null;
  createCircleThreePoint: (aId: string, bId: string, cId: string) => string | null;
  createPerpendicularLine: (throughId: string, base: LineLikeObjectRef) => string | null;
  createParallelLine: (throughId: string, base: LineLikeObjectRef) => string | null;
  createTangentLines: (throughId: string, circleId: string) => string[];
  createAngleBisectorLine: (aId: string, bId: string, cId: string) => string | null;
  createAngle: (aId: string, bId: string, cId: string) => string | null;
  createSector: (centerId: string, startId: string, endId: string) => string | null;
  createAngleFixed: (
    vertexId: string,
    basePointId: string,
    angleExpr: string,
    direction: "CCW" | "CW"
  ) => { pointId: string; lineId: string; angleId: string } | null;
  createMidpointFromPoints: (aId: string, bId: string) => string | null;
  createMidpointFromSegment: (segId: string) => string | null;
  createPointOnLine: (lineId: string, s: number) => string | null;
  createPointOnSegment: (segId: string, u: number) => string | null;
  createPointOnCircle: (circleId: string, t: number) => string | null;
  createIntersectionPoint: (objA: GeometryObjectRef, objB: GeometryObjectRef, preferredWorld: Vec2) => string | null;
  createCircleCenterPoint: (circleId: string) => string | null;
  setSelectedObject: (obj: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string } | null) => void;
  setCopyStyleSource: (obj: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string }) => void;
  applyCopyStyleTo: (obj: { type: "point" | "segment" | "line" | "circle" | "angle"; id: string }) => void;
  angleFixedTool: { angleExpr: string; direction: "CCW" | "CW" };
  getPointWorldById: (id: string) => Vec2 | null;
  camera: Camera;
  vp: Viewport;
};

export function handleToolClick(
  screen: Vec2,
  activeTool: ActiveTool,
  pendingSelection: PendingSelection,
  hits: ToolClickHits,
  io: ToolClickIO
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

  if (activeTool === "circle_3p") {
    if (!pendingSelection || pendingSelection.tool !== "circle_3p") {
      io.setPendingSelection({ tool: "circle_3p", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    if (pendingSelection.step === 2) {
      const bId = resolveOrCreatePointAtCursor();
      io.setPendingSelection({
        tool: "circle_3p",
        step: 3,
        first: pendingSelection.first,
        second: { type: "point", id: bId },
      });
      return;
    }
    const cId = resolveOrCreatePointAtCursor();
    const created = io.createCircleThreePoint(pendingSelection.first.id, pendingSelection.second.id, cId);
    if (!created) return;
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "circle_fixed") {
    if (!pendingSelection || pendingSelection.tool !== "circle_fixed") {
      io.setPendingSelection({ tool: "circle_fixed", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
    }
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

  if (activeTool === "sector") {
    if (!pendingSelection || pendingSelection.tool !== "sector") {
      io.setPendingSelection({ tool: "sector", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    if (pendingSelection.step === 2) {
      const aId = resolveOrCreatePointAtCursor();
      if (aId === pendingSelection.first.id) return;
      io.setPendingSelection({ tool: "sector", step: 3, first: pendingSelection.first, second: { type: "point", id: aId } });
      return;
    }
    let endId: string | null = hits.hitPointId;
    if (!endId) {
      const center = io.getPointWorldById(pendingSelection.first.id);
      const start = io.getPointWorldById(pendingSelection.second.id);
      const cursorWorld = camMath.screenToWorld(screen, io.camera, io.vp);
      if (!center || !start) return;
      const vx = cursorWorld.x - center.x;
      const vy = cursorWorld.y - center.y;
      const d = Math.hypot(vx, vy);
      const r = Math.hypot(start.x - center.x, start.y - center.y);
      if (!Number.isFinite(r) || r <= 1e-12) return;
      const ux = d <= 1e-12 ? (start.x - center.x) / r : vx / d;
      const uy = d <= 1e-12 ? (start.y - center.y) / r : vy / d;
      endId = io.createFreePoint({ x: center.x + ux * r, y: center.y + uy * r });
    }
    if (!endId) return;
    const created = io.createSector(pendingSelection.first.id, pendingSelection.second.id, endId);
    if (!created) return;
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "angle_fixed") {
    if (!pendingSelection || pendingSelection.tool !== "angle_fixed") {
      io.setPendingSelection({ tool: "angle_fixed", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    if (pendingSelection.step === 2) {
      const bId = resolveOrCreatePointAtCursor();
      if (bId === pendingSelection.first.id) return;
      io.setPendingSelection({
        tool: "angle_fixed",
        step: 3,
        first: pendingSelection.first,
        second: { type: "point", id: bId },
      });
      return;
    }
    const created = io.createAngleFixed(
      pendingSelection.second.id,
      pendingSelection.first.id,
      io.angleFixedTool.angleExpr,
      io.angleFixedTool.direction
    );
    if (!created) return;
    io.clearPendingSelection();
    return;
  }

  if (activeTool === "angle_bisector") {
    if (!pendingSelection || pendingSelection.tool !== "angle_bisector") {
      io.setPendingSelection({ tool: "angle_bisector", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }
    if (pendingSelection.step === 2) {
      const bId = resolveOrCreatePointAtCursor();
      io.setPendingSelection({
        tool: "angle_bisector",
        step: 3,
        first: pendingSelection.first,
        second: { type: "point", id: bId },
      });
      return;
    }
    const cId = resolveOrCreatePointAtCursor();
    const created = io.createAngleBisectorLine(pendingSelection.first.id, pendingSelection.second.id, cId);
    if (!created) return;
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

    if (hits.hitObject?.type === "circle") {
      const centerId = io.createCircleCenterPoint(hits.hitObject.id);
      if (!centerId) return;
      io.setSelectedObject({ type: "point", id: centerId });
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
    return;
  }

  if (activeTool === "tangent_line") {
    const hitCircleId =
      hits.snap?.kind === "onCircle" && hits.snap.circleId
        ? hits.snap.circleId
        : hits.hitObject?.type === "circle"
          ? hits.hitObject.id
          : null;

    if (!pendingSelection || pendingSelection.tool !== "tangent_line") {
      if (hits.hitPointId) {
        io.setPendingSelection({ tool: "tangent_line", step: 2, first: { type: "point", id: hits.hitPointId } });
        return;
      }
      if (hitCircleId) {
        io.setPendingSelection({ tool: "tangent_line", step: 2, first: { type: "circle", id: hitCircleId } });
        return;
      }
      io.setPendingSelection({ tool: "tangent_line", step: 2, first: { type: "point", id: resolveOrCreatePointAtCursor() } });
      return;
    }

    if (pendingSelection.first.type === "point") {
      if (!hitCircleId) return;
      const created = io.createTangentLines(pendingSelection.first.id, hitCircleId);
      if (created.length > 0) io.clearPendingSelection();
      return;
    }

    const throughId = resolveOrCreatePointAtCursor();
    const created = io.createTangentLines(throughId, pendingSelection.first.id);
    if (created.length > 0) io.clearPendingSelection();
  }
}

export function toolAllowsEmptyPointCreation(activeTool: ActiveTool, pendingSelection: PendingSelection): boolean {
  if (activeTool === "perp_line" || activeTool === "parallel_line") {
    if (!pendingSelection || (pendingSelection.tool !== "perp_line" && pendingSelection.tool !== "parallel_line")) return true;
    return pendingSelection.first.type === "lineLike";
  }
  if (activeTool === "tangent_line") {
    if (!pendingSelection || pendingSelection.tool !== "tangent_line") return true;
    return pendingSelection.first.type === "circle";
  }
  return (
    activeTool === "point" ||
    activeTool === "segment" ||
    activeTool === "line2p" ||
    activeTool === "circle_cp" ||
    activeTool === "circle_3p" ||
    activeTool === "circle_fixed" ||
    activeTool === "sector" ||
    activeTool === "midpoint" ||
    activeTool === "angle_bisector" ||
    activeTool === "angle" ||
    activeTool === "angle_fixed"
  );
}

export function isValidTarget(
  activeTool: ActiveTool,
  pendingSelection: PendingSelection,
  hoveredHit: { type: "point" | "segment" | "line2p" | "circle" | "angle"; id: string } | null
): boolean {
  if (!hoveredHit) return false;

  if (activeTool === "segment") return hoveredHit.type === "point";
  if (activeTool === "line2p") return hoveredHit.type === "point";
  if (activeTool === "circle_cp") return hoveredHit.type === "point";
  if (activeTool === "circle_3p") return hoveredHit.type === "point";
  if (activeTool === "circle_fixed") return hoveredHit.type === "point";
  if (activeTool === "angle_bisector") return hoveredHit.type === "point";
  if (activeTool === "angle") return hoveredHit.type === "point";
  if (activeTool === "sector") return hoveredHit.type === "point";
  if (activeTool === "angle_fixed") {
    if (pendingSelection?.tool === "angle_fixed" && pendingSelection.step === 3) return false;
    return hoveredHit.type === "point";
  }
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
  if (activeTool === "tangent_line") {
    if (!pendingSelection || pendingSelection.tool !== "tangent_line") {
      return hoveredHit.type === "point" || hoveredHit.type === "circle";
    }
    if (pendingSelection.first.type === "point") {
      return hoveredHit.type === "circle";
    }
    return hoveredHit.type === "point";
  }

  if (activeTool === "midpoint") {
    if (pendingSelection?.tool === "midpoint") return hoveredHit.type === "point";
    return hoveredHit.type === "segment" || hoveredHit.type === "point" || hoveredHit.type === "circle";
  }

  return false;
}
