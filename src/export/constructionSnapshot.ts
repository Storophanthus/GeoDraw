import type { GeometryObjectRef, SceneModel, ScenePoint } from "../scene/points";

export type SnapshotObjectRef = GeometryObjectRef;

export type SnapshotPointDefinition =
  | { kind: "free"; x: number; y: number }
  | { kind: "midpointPoints"; aId: string; bId: string }
  | { kind: "midpointSegment"; segId: string }
  | { kind: "pointOnLine"; lineId: string; s: number }
  | { kind: "pointOnSegment"; segId: string; u: number }
  | { kind: "pointOnCircle"; circleId: string; t: number }
  | { kind: "circleCenter"; circleId: string }
  | {
      kind: "pointByRotation";
      centerId: string;
      pointId: string;
      angleDeg?: number;
      angleExpr?: string;
      direction: "CCW" | "CW";
      radiusMode: "keep";
    }
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
  kind?: "twoPoint" | "perpendicular" | "parallel" | "tangent" | "angleBisector";
  aId?: string;
  bId?: string;
  cId?: string;
  throughId?: string;
  circleId?: string;
  branchIndex?: 0 | 1;
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
  kind?: "twoPoint" | "fixedRadius" | "threePoint";
  centerId?: string;
  throughId?: string;
  aId?: string;
  bId?: string;
  cId?: string;
  radius?: number;
  radiusExpr?: string;
  visible: boolean;
};

export type ConstructionSnapshot = {
  version: 1;
  points: SnapshotPoint[];
  numbers: Array<{
    id: string;
    name: string;
    visible: boolean;
    definition: SceneModel["numbers"][number]["definition"];
  }>;
  lines: SnapshotLine[];
  segments: SnapshotSegment[];
  circles: SnapshotCircle[];
  angles: Array<{
    id: string;
    kind: "angle" | "sector";
    aId: string;
    bId: string;
    cId: string;
    visible: boolean;
  }>;
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

  const numbers = scene.numbers
    .map((num) => ({
      id: num.id,
      name: num.name,
      visible: num.visible,
      definition: num.definition,
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
        : line.kind === "tangent"
          ? {
              id: line.id,
              kind: "tangent" as const,
              throughId: line.throughId,
              circleId: line.circleId,
              branchIndex: line.branchIndex,
              visible: line.visible,
            }
        : line.kind === "angleBisector"
          ? {
              id: line.id,
              kind: "angleBisector" as const,
              aId: line.aId,
              bId: line.bId,
              cId: line.cId,
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
    .map((circle) =>
      circle.kind === "fixedRadius"
        ? {
            id: circle.id,
            kind: "fixedRadius" as const,
            centerId: circle.centerId,
            radius: circle.radius,
            radiusExpr: circle.radiusExpr,
            visible: circle.visible,
          }
        : circle.kind === "threePoint"
          ? {
              id: circle.id,
              kind: "threePoint" as const,
              aId: circle.aId,
              bId: circle.bId,
              cId: circle.cId,
              visible: circle.visible,
            }
        : {
            id: circle.id,
            kind: "twoPoint" as const,
            centerId: circle.centerId,
            throughId: circle.throughId,
            visible: circle.visible,
          }
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  const angles = scene.angles
    .map((angle) => {
      const kind: "angle" | "sector" = angle.kind === "sector" ? "sector" : "angle";
      return {
        id: angle.id,
        kind,
        aId: angle.aId,
        bId: angle.bId,
        cId: angle.cId,
        visible: angle.visible,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: 1,
    points,
    numbers,
    lines,
    segments,
    circles,
    angles,
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
  if (point.kind === "circleCenter") {
    return { kind: "circleCenter", circleId: point.circleId };
  }
  if (point.kind === "pointByRotation") {
    return {
      kind: "pointByRotation",
      centerId: point.centerId,
      pointId: point.pointId,
      angleDeg: point.angleDeg,
      angleExpr: point.angleExpr,
      direction: point.direction,
      radiusMode: point.radiusMode,
    };
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
  if (point.kind === "circleCenter") return [point.circleId];
  if (point.kind === "pointByRotation") return [point.centerId, point.pointId];
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
