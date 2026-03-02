import {
  beginSceneEvalTick,
  endSceneEvalTick,
  getPointWorldPos,
  type GeometryObjectRef,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";

export type SnapshotObjectRef = GeometryObjectRef;

export type SnapshotPointDefinition =
  | { kind: "free"; x: number; y: number }
  | { kind: "midpointPoints"; aId: string; bId: string }
  | { kind: "midpointSegment"; segId: string }
  | { kind: "pointOnLine"; lineId: string; s: number }
  | { kind: "pointOnSegment"; segId: string; u: number }
  | { kind: "pointOnCircle"; circleId: string; t: number }
  | { kind: "circleCenter"; circleId: string }
  | { kind: "triangleCenter"; centerKind: "incenter" | "orthocenter" | "centroid"; aId: string; bId: string; cId: string }
  | { kind: "pointByTranslation"; pointId: string; fromId: string; toId: string; vectorId?: string }
  | { kind: "pointByDilation"; pointId: string; centerId: string; factor?: number; factorExpr?: string }
  | { kind: "pointByReflection"; pointId: string; axis: { type: "line" | "segment" | "point"; id: string } }
  | {
      kind: "pointByRotation";
      centerId: string;
      pointId: string;
      angleDeg?: number;
      angleExpr?: string;
      direction: "CCW" | "CW";
      radiusMode: "keep";
    }
  | {
      kind: "intersectionPoint";
      objA: SnapshotObjectRef;
      objB: SnapshotObjectRef;
      branchIndex?: number;
      preferredWorld: { x: number; y: number };
    }
  | {
      kind: "circleLineIntersectionPoint";
      circleId: string;
      lineId: string;
      branchIndex: 0 | 1;
      excludePointId?: string;
    }
  | {
      kind: "circleSegmentIntersectionPoint";
      circleId: string;
      segId: string;
      branchIndex: 0 | 1;
      excludePointId?: string;
    }
  | {
      kind: "circleCircleIntersectionPoint";
      circleAId: string;
      circleBId: string;
      branchIndex: 0 | 1;
      excludePointId?: string;
    }
  | {
      kind: "lineLikeIntersectionPoint";
      objA: { type: "line" | "segment"; id: string };
      objB: { type: "line" | "segment"; id: string };
      preferredWorld: { x: number; y: number };
    };

export type SnapshotPoint = {
  id: string;
  name: string;
  visible: boolean;
  showLabel: ScenePoint["showLabel"];
  definition: SnapshotPointDefinition;
  dependsOn: string[];
};

export type SnapshotVector =
  | { id: string; definition: { kind: "vectorFromPoints"; fromId: string; toId: string } }
  | { id: string; definition: { kind: "freeVector"; dx: number; dy: number } };

export type SnapshotLine = {
  id: string;
  kind?: "twoPoint" | "perpendicular" | "parallel" | "tangent" | "circleCircleTangent" | "angleBisector";
  aId?: string;
  bId?: string;
  cId?: string;
  throughId?: string;
  circleId?: string;
  circleAId?: string;
  circleBId?: string;
  family?: "outer" | "inner";
  branchIndex?: 0 | 1;
  base?: { type: "line" | "segment"; id: string };
  visible: boolean;
};

export type SnapshotSegment = {
  id: string;
  aId: string;
  bId: string;
  ownedByPolygonIds?: string[];
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
  vectors: SnapshotVector[];
  numbers: Array<{
    id: string;
    name: string;
    visible: boolean;
    definition: SceneModel["numbers"][number]["definition"];
  }>;
  lines: SnapshotLine[];
  segments: SnapshotSegment[];
  circles: SnapshotCircle[];
  polygons: Array<{
    id: string;
    pointIds: string[];
    visible: boolean;
  }>;
  angles: Array<{
    id: string;
    kind: "angle" | "sector";
    aId: string;
    bId: string;
    cId: string;
    visible: boolean;
  }>;
};

export type ConstructionSnapshotWithWorld = ConstructionSnapshot & {
  debugPointWorld: Array<{
    id: string;
    world: { x: number; y: number } | null;
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

  const vectors = (scene.vectors ?? [])
    .map((vector) =>
      vector.kind === "vectorFromPoints"
        ? ({ id: vector.id, definition: { kind: "vectorFromPoints", fromId: vector.fromId, toId: vector.toId } } as const)
        : ({ id: vector.id, definition: { kind: "freeVector", dx: vector.dx, dy: vector.dy } } as const)
    )
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
        : line.kind === "circleCircleTangent"
          ? {
              id: line.id,
              kind: "circleCircleTangent" as const,
              circleAId: line.circleAId,
              circleBId: line.circleBId,
              family: line.family,
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
      ownedByPolygonIds: Array.isArray(seg.ownedByPolygonIds) ? [...seg.ownedByPolygonIds] : undefined,
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

  const polygons = scene.polygons
    .map((polygon) => ({
      id: polygon.id,
      pointIds: [...polygon.pointIds],
      visible: polygon.visible,
    }))
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
    vectors,
    numbers,
    lines,
    segments,
    circles,
    polygons,
    angles,
  };
}

export function exportConstructionSnapshot(scene: SceneModel): string {
  return `${JSON.stringify(buildConstructionSnapshot(scene), null, 2)}\n`;
}

export function buildConstructionSnapshotWithWorld(scene: SceneModel): ConstructionSnapshotWithWorld {
  const base = buildConstructionSnapshot(scene);
  beginSceneEvalTick(scene);
  try {
    const debugPointWorld = scene.points
      .map((point) => {
        const world = getPointWorldPos(point, scene);
        return {
          id: point.id,
          world: world ? { x: world.x, y: world.y } : null,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      ...base,
      debugPointWorld,
    };
  } finally {
    endSceneEvalTick(scene);
  }
}

export function exportConstructionSnapshotWithWorld(scene: SceneModel): string {
  return `${JSON.stringify(buildConstructionSnapshotWithWorld(scene), null, 2)}\n`;
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
  if (point.kind === "pointByTranslation") {
    return {
      kind: "pointByTranslation",
      pointId: point.pointId,
      fromId: point.fromId,
      toId: point.toId,
      vectorId: point.vectorId,
    };
  }
  if (point.kind === "pointByDilation") {
    return {
      kind: "pointByDilation",
      pointId: point.pointId,
      centerId: point.centerId,
      factor: point.factor,
      factorExpr: point.factorExpr,
    };
  }
  if (point.kind === "pointByReflection") {
    return { kind: "pointByReflection", pointId: point.pointId, axis: point.axis };
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
  if (point.kind === "circleSegmentIntersectionPoint") {
    return {
      kind: "circleSegmentIntersectionPoint",
      circleId: point.circleId,
      segId: point.segId,
      branchIndex: point.branchIndex,
      excludePointId: point.excludePointId,
    };
  }
  if (point.kind === "circleCircleIntersectionPoint") {
    return {
      kind: "circleCircleIntersectionPoint",
      circleAId: point.circleAId,
      circleBId: point.circleBId,
      branchIndex: point.branchIndex,
      excludePointId: point.excludePointId,
    };
  }
  if (point.kind === "lineLikeIntersectionPoint") {
    return {
      kind: "lineLikeIntersectionPoint",
      objA: point.objA,
      objB: point.objB,
      preferredWorld: {
        x: point.preferredWorld.x,
        y: point.preferredWorld.y,
      },
    };
  }
  if (point.kind === "triangleCenter") {
    return {
      kind: "triangleCenter",
      centerKind: point.centerKind,
      aId: point.aId,
      bId: point.bId,
      cId: point.cId,
    };
  }
  return {
    kind: "intersectionPoint",
    objA: point.objA,
    objB: point.objB,
    branchIndex: point.branchIndex,
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
  if (point.kind === "triangleCenter") return [point.aId, point.bId, point.cId];
  if (point.kind === "pointByTranslation") {
    const refs = [point.pointId, point.fromId, point.toId];
    if (point.vectorId) refs.push(`vector:${point.vectorId}`);
    return refs;
  }
  if (point.kind === "pointByDilation") return [point.pointId, point.centerId];
  if (point.kind === "pointByReflection") {
    if (point.axis.type === "point") return [point.pointId, point.axis.id];
    return [point.pointId, objectRefKey(point.axis)];
  }
  if (point.kind === "pointByRotation") return [point.centerId, point.pointId];
  if (point.kind === "circleLineIntersectionPoint") {
    const refs = [point.circleId, point.lineId];
    if (point.excludePointId) refs.push(point.excludePointId);
    return refs;
  }
  if (point.kind === "circleSegmentIntersectionPoint") {
    const refs = [point.circleId, point.segId];
    if (point.excludePointId) refs.push(point.excludePointId);
    return refs;
  }
  if (point.kind === "circleCircleIntersectionPoint") {
    const refs = [point.circleAId, point.circleBId];
    if (point.excludePointId) refs.push(point.excludePointId);
    return refs;
  }
  if (point.kind === "lineLikeIntersectionPoint") {
    return [objectRefKey(point.objA), objectRefKey(point.objB)];
  }
  return [objectRefKey(point.objA), objectRefKey(point.objB)];
}

function objectRefKey(ref: GeometryObjectRef): string {
  return `${ref.type}:${ref.id}`;
}
