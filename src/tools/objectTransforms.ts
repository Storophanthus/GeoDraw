import { evaluateAngleExpressionDegrees, evaluateNumberExpression, type LineLikeObjectRef, type SceneModel } from "../scene/points";

export type TransformSourceObjectRef = {
  type: "point" | "segment" | "line" | "circle" | "polygon" | "angle";
  id: string;
};

type TransformCreateOps = {
  scene: SceneModel;
  createPointByTranslation: (pointId: string, fromId: string, toId: string) => string | null;
  createPointByRotation: (
    centerId: string,
    pointId: string,
    angleDeg: number,
    direction: "CCW" | "CW",
    angleExpr?: string
  ) => string | null;
  createPointByDilation: (pointId: string, centerId: string, factorExpr: string) => string | null;
  createPointByReflection: (pointId: string, axis: LineLikeObjectRef) => string | null;
  createPointOnLine: (lineId: string, s: number) => string | null;
  createSegment: (aId: string, bId: string) => string | null;
  createLine: (aId: string, bId: string) => string | null;
  createAngleBisectorLine: (aId: string, bId: string, cId: string) => string | null;
  createCircle: (centerId: string, throughId: string) => string | null;
  createCircleThreePoint: (aId: string, bId: string, cId: string) => string | null;
  createCircleFixedRadius: (centerId: string, radiusExpr: string) => string | null;
  createPolygon: (pointIds: string[]) => string | null;
  createAngle: (aId: string, bId: string, cId: string) => string | null;
  createSector: (centerId: string, startId: string, endId: string) => string | null;
  setObjectVisibility?: (
    obj: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string },
    visible: boolean
  ) => void;
};

type PointTransform = (pointId: string) => string | null;

function sourceExists(scene: SceneModel, source: TransformSourceObjectRef): boolean {
  if (source.type === "point") return scene.points.some((item) => item.id === source.id);
  if (source.type === "segment") return scene.segments.some((item) => item.id === source.id);
  if (source.type === "line") return scene.lines.some((item) => item.id === source.id);
  if (source.type === "circle") return scene.circles.some((item) => item.id === source.id);
  if (source.type === "polygon") return scene.polygons.some((item) => item.id === source.id);
  return scene.angles.some((item) => item.id === source.id);
}

function mapPointWithCache(mapper: PointTransform): PointTransform {
  const cache = new Map<string, string>();
  return (pointId) => {
    const existing = cache.get(pointId);
    if (existing) return existing;
    const created = mapper(pointId);
    if (!created) return null;
    cache.set(pointId, created);
    return created;
  };
}

function transformSourceObject(
  source: TransformSourceObjectRef,
  mapPoint: PointTransform,
  ops: TransformCreateOps,
  dilationFactorExpr?: string
): string | null {
  const { scene } = ops;
  if (!sourceExists(scene, source)) return null;

  if (source.type === "point") return mapPoint(source.id);

  if (source.type === "segment") {
    const sourceSegment = scene.segments.find((item) => item.id === source.id);
    if (!sourceSegment) return null;
    const aId = mapPoint(sourceSegment.aId);
    const bId = mapPoint(sourceSegment.bId);
    if (!aId || !bId) return null;
    return ops.createSegment(aId, bId);
  }

  if (source.type === "line") {
    const sourceLine = scene.lines.find((item) => item.id === source.id);
    if (!sourceLine) return null;
    if (sourceLine.kind === "angleBisector") {
      const aId = mapPoint(sourceLine.aId);
      const bId = mapPoint(sourceLine.bId);
      const cId = mapPoint(sourceLine.cId);
      if (!aId || !bId || !cId) return null;
      return ops.createAngleBisectorLine(aId, bId, cId);
    }

    const helperPointIds: string[] = [];
    let sourceAId: string | null = null;
    let sourceBId: string | null = null;

    if (!sourceLine.kind || sourceLine.kind === "twoPoint") {
      sourceAId = sourceLine.aId;
      sourceBId = sourceLine.bId;
    } else if (sourceLine.kind === "perpendicular" || sourceLine.kind === "parallel" || sourceLine.kind === "tangent") {
      sourceAId = sourceLine.throughId;
    }

    if (!sourceAId) {
      const helperA = ops.createPointOnLine(source.id, 0.2);
      if (!helperA) return null;
      sourceAId = helperA;
      helperPointIds.push(helperA);
    }
    if (!sourceBId) {
      const helperB = ops.createPointOnLine(source.id, 0.8);
      if (!helperB) return null;
      sourceBId = helperB;
      helperPointIds.push(helperB);
    }

    for (const helperId of helperPointIds) {
      ops.setObjectVisibility?.({ type: "point", id: helperId }, false);
    }

    const aId = mapPoint(sourceAId);
    const bId = mapPoint(sourceBId);
    if (!aId || !bId) return null;
    return ops.createLine(aId, bId);
  }

  if (source.type === "polygon") {
    const sourcePolygon = scene.polygons.find((item) => item.id === source.id);
    if (!sourcePolygon || sourcePolygon.pointIds.length < 3) return null;
    const nextPointIds: string[] = [];
    for (const sourcePointId of sourcePolygon.pointIds) {
      const transformedPointId = mapPoint(sourcePointId);
      if (!transformedPointId) return null;
      nextPointIds.push(transformedPointId);
    }
    return ops.createPolygon(nextPointIds);
  }

  if (source.type === "circle") {
    const sourceCircle = scene.circles.find((item) => item.id === source.id);
    if (!sourceCircle) return null;
    if (sourceCircle.kind === "threePoint") {
      const aId = mapPoint(sourceCircle.aId);
      const bId = mapPoint(sourceCircle.bId);
      const cId = mapPoint(sourceCircle.cId);
      if (!aId || !bId || !cId) return null;
      return ops.createCircleThreePoint(aId, bId, cId);
    }
    const centerId = mapPoint(sourceCircle.centerId);
    if (!centerId) return null;
    if (sourceCircle.kind === "fixedRadius") {
      const baseExpr = sourceCircle.radiusExpr?.trim() || String(sourceCircle.radius);
      if (!baseExpr) return null;
      const radiusExpr =
        typeof dilationFactorExpr === "string"
          ? `abs((${baseExpr})*(${dilationFactorExpr.trim()}))`
          : baseExpr;
      const radiusEval = evaluateNumberExpression(scene, radiusExpr);
      if (!radiusEval.ok || !Number.isFinite(radiusEval.value) || radiusEval.value <= 0) return null;
      return ops.createCircleFixedRadius(centerId, radiusExpr);
    }
    const throughId = mapPoint(sourceCircle.throughId);
    if (!throughId) return null;
    return ops.createCircle(centerId, throughId);
  }

  const sourceAngle = scene.angles.find((item) => item.id === source.id);
  if (!sourceAngle) return null;
  const aId = mapPoint(sourceAngle.aId);
  const bId = mapPoint(sourceAngle.bId);
  const cId = mapPoint(sourceAngle.cId);
  if (!aId || !bId || !cId) return null;
  if (sourceAngle.kind === "sector") {
    return ops.createSector(bId, aId, cId);
  }
  return ops.createAngle(aId, bId, cId);
}

export function applyTranslationToObject(
  source: TransformSourceObjectRef,
  fromId: string,
  toId: string,
  ops: TransformCreateOps
): string | null {
  const mapPoint = mapPointWithCache((pointId) => ops.createPointByTranslation(pointId, fromId, toId));
  return transformSourceObject(source, mapPoint, ops);
}

export function applyDilationToObject(
  source: TransformSourceObjectRef,
  centerId: string,
  factorExpr: string,
  ops: TransformCreateOps
): string | null {
  const trimmed = factorExpr.trim();
  if (!trimmed) return null;
  const factorEval = evaluateNumberExpression(ops.scene, trimmed);
  if (!factorEval.ok || !Number.isFinite(factorEval.value)) return null;
  const mapPoint = mapPointWithCache((pointId) => ops.createPointByDilation(pointId, centerId, trimmed));
  return transformSourceObject(source, mapPoint, ops, trimmed);
}

export function applyRotationToObject(
  source: TransformSourceObjectRef,
  centerId: string,
  angleExpr: string,
  direction: "CCW" | "CW",
  ops: TransformCreateOps
): string | null {
  const trimmed = angleExpr.trim();
  if (!trimmed) return null;
  const angleEval = evaluateAngleExpressionDegrees(ops.scene, trimmed);
  if (!angleEval.ok || !Number.isFinite(angleEval.valueDeg)) return null;
  const mapPoint = mapPointWithCache((pointId) => {
    // Rotating the center point around itself is an identity map. Reuse the
    // existing point so polygon/angle transforms can rotate about one of their
    // own vertices without failing the whole transform.
    if (pointId === centerId) return centerId;
    return ops.createPointByRotation(centerId, pointId, angleEval.valueDeg, direction, trimmed);
  });
  return transformSourceObject(source, mapPoint, ops);
}

export function applyReflectionToObject(
  source: TransformSourceObjectRef,
  axis: LineLikeObjectRef,
  ops: TransformCreateOps
): string | null {
  const mapPoint = mapPointWithCache((pointId) => ops.createPointByReflection(pointId, axis));
  return transformSourceObject(source, mapPoint, ops);
}
