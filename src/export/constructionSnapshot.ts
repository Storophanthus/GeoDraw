import type { GeometryObjectRef, SceneModel, ScenePoint } from "../scene/points";

export type SnapshotObjectRef = GeometryObjectRef;

export type SnapshotPointDefinition =
  | { kind: "free"; x: number; y: number }
  | { kind: "midpointPoints"; aId: string; bId: string }
  | { kind: "midpointSegment"; segId: string }
  | { kind: "pointOnLine"; lineId: string; s: number }
  | { kind: "pointOnSegment"; segId: string; u: number }
  | { kind: "pointOnCircle"; circleId: string; t: number }
  | { kind: "intersectionPoint"; objA: SnapshotObjectRef; objB: SnapshotObjectRef; preferredWorld: { x: number; y: number } }
  | {
      kind: "circleLineIntersectionPoint";
      circleId: string;
      lineId: string;
      branchIndex: 0 | 1;
      excludePointId?: string;
    };

export type SnapshotPoint = {
  id: string;
  name: string;
  visible: boolean;
  showLabel: ScenePoint["showLabel"];
  definition: SnapshotPointDefinition;
  dependsOn: string[];
};

export type SnapshotLine = {
  id: string;
  kind?: "twoPoint" | "perpendicular" | "parallel";
  aId?: string;
  bId?: string;
  throughId?: string;
  base?: { type: "line" | "segment"; id: string };
  visible: boolean;
};

export type SnapshotSegment = {
  id: string;
  aId: string;
  bId: string;
  visible: boolean;
};

export type SnapshotCircle = {
  id: string;
  centerId: string;
  throughId: string;
  visible: boolean;
};

export type ConstructionSnapshot = {
  version: 1;
  points: SnapshotPoint[];
  lines: SnapshotLine[];
  segments: SnapshotSegment[];
  circles: SnapshotCircle[];
};

export function buildConstructionSnapshot(scene: SceneModel): ConstructionSnapshot {
  const points = scene.points
    .map((point) => ({
      id: point.id,
      name: point.name,
      visible: point.visible,
      showLabel: point.showLabel,
      definition: pointDefinition(point),
      dependsOn: pointDependsOn(point),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const lines = scene.lines
    .map((line) =>
      line.kind === "perpendicular" || line.kind === "parallel"
        ? {
            id: line.id,
            kind: line.kind,
            throughId: line.throughId,
            base: line.base,
            visible: line.visible,
          }
        : {
            id: line.id,
            kind: "twoPoint" as const,
            aId: line.aId,
            bId: line.bId,
            visible: line.visible,
          }
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  const segments = scene.segments
    .map((seg) => ({
      id: seg.id,
      aId: seg.aId,
      bId: seg.bId,
      visible: seg.visible,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const circles = scene.circles
    .map((circle) => ({
      id: circle.id,
      centerId: circle.centerId,
      throughId: circle.throughId,
      visible: circle.visible,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: 1,
    points,
    lines,
    segments,
    circles,
  };
}

export function exportConstructionSnapshot(scene: SceneModel): string {
  return `${JSON.stringify(buildConstructionSnapshot(scene), null, 2)}\n`;
}

function pointDefinition(point: ScenePoint): SnapshotPointDefinition {
  if (point.kind === "free") {
    return { kind: "free", x: point.position.x, y: point.position.y };
  }
  if (point.kind === "midpointPoints") {
    return { kind: "midpointPoints", aId: point.aId, bId: point.bId };
  }
  if (point.kind === "midpointSegment") {
    return { kind: "midpointSegment", segId: point.segId };
  }
  if (point.kind === "pointOnLine") {
    return { kind: "pointOnLine", lineId: point.lineId, s: point.s };
  }
  if (point.kind === "pointOnSegment") {
    return { kind: "pointOnSegment", segId: point.segId, u: point.u };
  }
  if (point.kind === "pointOnCircle") {
    return { kind: "pointOnCircle", circleId: point.circleId, t: point.t };
  }
  if (point.kind === "circleLineIntersectionPoint") {
    return {
      kind: "circleLineIntersectionPoint",
      circleId: point.circleId,
      lineId: point.lineId,
      branchIndex: point.branchIndex,
      excludePointId: point.excludePointId,
    };
  }
  return {
    kind: "intersectionPoint",
    objA: point.objA,
    objB: point.objB,
    preferredWorld: {
      x: point.preferredWorld.x,
      y: point.preferredWorld.y,
    },
  };
}

function pointDependsOn(point: ScenePoint): string[] {
  if (point.kind === "free") return [];
  if (point.kind === "midpointPoints") return [point.aId, point.bId];
  if (point.kind === "midpointSegment") return [point.segId];
  if (point.kind === "pointOnLine") return [point.lineId];
  if (point.kind === "pointOnSegment") return [point.segId];
  if (point.kind === "pointOnCircle") return [point.circleId];
  if (point.kind === "circleLineIntersectionPoint") {
    const refs = [point.circleId, point.lineId];
    if (point.excludePointId) refs.push(point.excludePointId);
    return refs;
  }
  return [objectRefKey(point.objA), objectRefKey(point.objB)];
}

function objectRefKey(ref: GeometryObjectRef): string {
  return `${ref.type}:${ref.id}`;
}
