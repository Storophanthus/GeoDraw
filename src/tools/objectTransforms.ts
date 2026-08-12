import { evaluateAngleExpressionDegrees, evaluateNumberExpression, type ReflectionObjectRef, type SceneModel } from "../scene/points";

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
  createPointByReflection: (pointId: string, axis: ReflectionObjectRef) => string | null;
  createPointOnLine: (lineId: string, s: number) => string | null;
  createPointOnCircle: (circleId: string, t: number) => string | null;
  createSegment: (aId: string, bId: string) => string | null;
  createLine: (aId: string, bId: string) => string | null;
  createRay?: (originId: string, throughId: string) => string | null;
  createAngleBisectorLine: (aId: string, bId: string, cId: string) => string | null;
  createCircle: (centerId: string, throughId: string) => string | null;
  createCircleThreePoint: (aId: string, bId: string, cId: string) => string | null;
  createCircleFixedRadius: (centerId: string, radiusExpr: string) => string | null;
  createCircleCenterPoint: (circleId: string) => string | null;
  createPolygon: (pointIds: string[]) => string | null;
  createAngle: (aId: string, bId: string, cId: string) => string | null;
  createSector: (centerId: string, startId: string, endId: string) => string | null;
  setObjectVisibility?: (
    obj: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string },
    visible: boolean
  ) => void;
  cloneObjectStyle?: (
    source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string },
    target: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }
  ) => void;
};

export type InversionPointCreateOps = Pick<
  TransformCreateOps,
  "scene" | "createPointByDilation" | "createCircleCenterPoint" | "setObjectVisibility"
>;

type PointTransform = (pointId: string) => string | null;

function sourceExists(scene: SceneModel, source: TransformSourceObjectRef): boolean {
  if (source.type === "point") return scene.points.some((item) => item.id === source.id);
  if (source.type === "segment") return scene.segments.some((item) => item.id === source.id);
  if (source.type === "line") return scene.lines.some((item) => item.id === source.id);
  if (source.type === "circle") return scene.circles.some((item) => item.id === source.id);
  if (source.type === "polygon") return scene.polygons.some((item) => item.id === source.id);
  return scene.angles.some((item) => item.id === source.id);
}

function mapPointWithCache(
  mapper: PointTransform,
  onMapped?: (sourcePointId: string, mappedPointId: string) => void
): PointTransform {
  const cache = new Map<string, string>();
  return (pointId) => {
    const existing = cache.get(pointId);
    if (existing) return existing;
    const created = mapper(pointId);
    if (!created) return null;
    onMapped?.(pointId, created);
    cache.set(pointId, created);
    return created;
  };
}

function cloneStyle(
  ops: TransformCreateOps,
  source: TransformSourceObjectRef,
  target: TransformSourceObjectRef
): void {
  ops.cloneObjectStyle?.(source, target);
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
    const id = ops.createSegment(aId, bId);
    if (!id) return null;
    cloneStyle(ops, source, { type: "segment", id });
    return id;
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

    if (!sourceLine.kind || sourceLine.kind === "twoPoint" || sourceLine.kind === "ray") {
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
    if (helperPointIds.includes(sourceAId)) ops.setObjectVisibility?.({ type: "point", id: aId }, false);
    if (helperPointIds.includes(sourceBId)) ops.setObjectVisibility?.({ type: "point", id: bId }, false);
    const id = sourceLine.kind === "ray" && ops.createRay
      ? ops.createRay(aId, bId)
      : ops.createLine(aId, bId);
    if (!id) return null;
    cloneStyle(ops, source, { type: "line", id });
    return id;
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
    const id = ops.createPolygon(nextPointIds);
    if (!id) return null;
    cloneStyle(ops, source, { type: "polygon", id });
    return id;
  }

  if (source.type === "circle") {
    const sourceCircle = scene.circles.find((item) => item.id === source.id);
    if (!sourceCircle) return null;
    if (sourceCircle.kind === "threePoint") {
      const aId = mapPoint(sourceCircle.aId);
      const bId = mapPoint(sourceCircle.bId);
      const cId = mapPoint(sourceCircle.cId);
      if (!aId || !bId || !cId) return null;
      const id = ops.createCircleThreePoint(aId, bId, cId);
      if (!id) return null;
      cloneStyle(ops, source, { type: "circle", id });
      return id;
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
      const id = ops.createCircleFixedRadius(centerId, radiusExpr);
      if (!id) return null;
      cloneStyle(ops, source, { type: "circle", id });
      return id;
    }
    const throughId = mapPoint(sourceCircle.throughId);
    if (!throughId) return null;
    const id = ops.createCircle(centerId, throughId);
    if (!id) return null;
    cloneStyle(ops, source, { type: "circle", id });
    return id;
  }

  const sourceAngle = scene.angles.find((item) => item.id === source.id);
  if (!sourceAngle) return null;
  const aId = mapPoint(sourceAngle.aId);
  const bId = mapPoint(sourceAngle.bId);
  const cId = mapPoint(sourceAngle.cId);
  if (!aId || !bId || !cId) return null;
  if (sourceAngle.kind === "sector") {
    const id = ops.createSector(bId, aId, cId);
    if (!id) return null;
    cloneStyle(ops, source, { type: "angle", id });
    return id;
  }
  const id = ops.createAngle(aId, bId, cId);
  if (!id) return null;
  cloneStyle(ops, source, { type: "angle", id });
  return id;
}

export function applyTranslationToObject(
  source: TransformSourceObjectRef,
  fromId: string,
  toId: string,
  ops: TransformCreateOps
): string | null {
  const mapPoint = mapPointWithCache(
    (pointId) => ops.createPointByTranslation(pointId, fromId, toId),
    (sourcePointId, targetPointId) => {
      if (!ops.scene.points.some((item) => item.id === sourcePointId)) return;
      cloneStyle(ops, { type: "point", id: sourcePointId }, { type: "point", id: targetPointId });
    }
  );
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
  const mapPoint = mapPointWithCache(
    (pointId) => ops.createPointByDilation(pointId, centerId, trimmed),
    (sourcePointId, targetPointId) => {
      if (!ops.scene.points.some((item) => item.id === sourcePointId)) return;
      cloneStyle(ops, { type: "point", id: sourcePointId }, { type: "point", id: targetPointId });
    }
  );
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
  }, (sourcePointId, targetPointId) => {
    if (sourcePointId === targetPointId) return;
    if (!ops.scene.points.some((item) => item.id === sourcePointId)) return;
    cloneStyle(ops, { type: "point", id: sourcePointId }, { type: "point", id: targetPointId });
  });
  return transformSourceObject(source, mapPoint, ops);
}

export function applyReflectionToObject(
  source: TransformSourceObjectRef,
  axis: ReflectionObjectRef,
  ops: TransformCreateOps
): string | null {
  const mapPoint = mapPointWithCache(
    (pointId) => ops.createPointByReflection(pointId, axis),
    (sourcePointId, targetPointId) => {
      if (!ops.scene.points.some((item) => item.id === sourcePointId)) return;
      cloneStyle(ops, { type: "point", id: sourcePointId }, { type: "point", id: targetPointId });
    }
  );
  return transformSourceObject(source, mapPoint, ops);
}

function resolveInversionSpec(
  inversionCircleId: string,
  ops: InversionPointCreateOps
): { centerId: string; radiusExpr: string; hideCenterId?: string } | null {
  const inversionCircle = ops.scene.circles.find((item) => item.id === inversionCircleId);
  if (!inversionCircle) return null;
  if (inversionCircle.kind === "threePoint") {
    const existingCenter = ops.scene.points.find(
      (point) => point.kind === "circleCenter" && point.circleId === inversionCircle.id
    );
    const centerId = existingCenter?.id ?? ops.createCircleCenterPoint(inversionCircle.id);
    if (!centerId) return null;
    return {
      centerId,
      radiusExpr: `Distance(${centerId},${inversionCircle.aId})`,
      hideCenterId: existingCenter ? undefined : centerId,
    };
  }
  if (inversionCircle.kind === "fixedRadius") {
    const expr = inversionCircle.radiusExpr?.trim();
    return {
      centerId: inversionCircle.centerId,
      radiusExpr: expr && expr.length > 0 ? `(${expr})` : String(inversionCircle.radius),
    };
  }
  // `twoPoint` circles can persist with `kind` omitted in older snapshots.
  return {
    centerId: inversionCircle.centerId,
    radiusExpr: `Distance(${inversionCircle.centerId},${inversionCircle.throughId})`,
  };
}

function inversionFactorExpr(spec: { centerId: string; radiusExpr: string }, pointId: string): string {
  return `((abs(${spec.radiusExpr}))^2)/(Distance(${spec.centerId},${pointId})^2)`;
}

export function applyInversionToPoint(
  pointId: string,
  inversionCircleId: string,
  ops: InversionPointCreateOps
): string | null {
  const spec = resolveInversionSpec(inversionCircleId, ops);
  if (!spec) return null;
  if (spec.hideCenterId) {
    ops.setObjectVisibility?.({ type: "point", id: spec.hideCenterId }, false);
  }
  return ops.createPointByDilation(pointId, spec.centerId, inversionFactorExpr(spec, pointId));
}

function invertLineToObject(
  source: { type: "line"; id: string },
  spec: { centerId: string; radiusExpr: string },
  ops: TransformCreateOps,
  mapPoint: PointTransform
): string | null {
  const sourceLine = ops.scene.lines.find((item) => item.id === source.id);
  if (!sourceLine) return null;
  let sourceAId: string | null = null;
  let sourceBId: string | null = null;
  const helperPointIds: string[] = [];
  if (!sourceLine.kind || sourceLine.kind === "twoPoint") {
    sourceAId = sourceLine.aId;
    sourceBId = sourceLine.bId;
  } else {
    sourceAId = ops.createPointOnLine(source.id, 0.2);
    sourceBId = ops.createPointOnLine(source.id, 0.8);
    if (sourceAId) helperPointIds.push(sourceAId);
    if (sourceBId) helperPointIds.push(sourceBId);
  }
  for (const helperId of helperPointIds) {
    ops.setObjectVisibility?.({ type: "point", id: helperId }, false);
  }
  if (!sourceAId || !sourceBId) return null;
  const aInv = mapPoint(sourceAId);
  const bInv = mapPoint(sourceBId);
  if (!aInv || !bInv) return null;
  if (helperPointIds.includes(sourceAId)) ops.setObjectVisibility?.({ type: "point", id: aInv }, false);
  if (helperPointIds.includes(sourceBId)) ops.setObjectVisibility?.({ type: "point", id: bInv }, false);
  const circleId = ops.createCircleThreePoint(spec.centerId, aInv, bInv);
  if (circleId) {
    cloneStyle(ops, source, { type: "circle", id: circleId });
    return circleId;
  }
  const lineId = ops.createLine(aInv, bInv);
  if (!lineId) return null;
  cloneStyle(ops, source, { type: "line", id: lineId });
  return lineId;
}

function invertCircleToObject(
  source: { type: "circle"; id: string },
  ops: TransformCreateOps,
  mapPoint: PointTransform
): string | null {
  const sourceCircle = ops.scene.circles.find((item) => item.id === source.id);
  if (!sourceCircle) return null;
  const sampleSourcePointIds: string[] = [];
  const helperSourcePointIds = new Set<string>();
  if (sourceCircle.kind === "threePoint") {
    sampleSourcePointIds.push(sourceCircle.aId, sourceCircle.bId, sourceCircle.cId);
  } else {
    const helperA = ops.createPointOnCircle(sourceCircle.id, 0);
    const helperB = ops.createPointOnCircle(sourceCircle.id, (2 * Math.PI) / 3);
    const helperC = ops.createPointOnCircle(sourceCircle.id, (4 * Math.PI) / 3);
    if (helperA) {
      sampleSourcePointIds.push(helperA);
      helperSourcePointIds.add(helperA);
    }
    if (helperB) {
      sampleSourcePointIds.push(helperB);
      helperSourcePointIds.add(helperB);
    }
    if (helperC) {
      sampleSourcePointIds.push(helperC);
      helperSourcePointIds.add(helperC);
    }
    if (sourceCircle.kind !== "fixedRadius") {
      sampleSourcePointIds.push(sourceCircle.throughId);
    }
    for (const helperId of [helperA, helperB, helperC]) {
      if (!helperId) continue;
      ops.setObjectVisibility?.({ type: "point", id: helperId }, false);
    }
  }
  const invertedIds: string[] = [];
  for (const sourcePointId of sampleSourcePointIds) {
    const inverted = mapPoint(sourcePointId);
    if (!inverted || invertedIds.includes(inverted)) continue;
    if (helperSourcePointIds.has(sourcePointId)) {
      ops.setObjectVisibility?.({ type: "point", id: inverted }, false);
    }
    invertedIds.push(inverted);
    if (invertedIds.length >= 3) break;
  }
  if (invertedIds.length >= 3) {
    const circleId = ops.createCircleThreePoint(invertedIds[0], invertedIds[1], invertedIds[2]);
    if (circleId) {
      cloneStyle(ops, source, { type: "circle", id: circleId });
      return circleId;
    }
  }
  if (invertedIds.length >= 2) {
    const lineId = ops.createLine(invertedIds[0], invertedIds[1]);
    if (!lineId) return null;
    cloneStyle(ops, source, { type: "line", id: lineId });
    return lineId;
  }
  return null;
}

export function applyInversionToObject(
  source: TransformSourceObjectRef,
  inversionCircleId: string,
  ops: TransformCreateOps
): string | null {
  if (source.type !== "point" && source.type !== "line" && source.type !== "circle") return null;
  if (source.type === "point") {
    const invertedId = applyInversionToPoint(source.id, inversionCircleId, ops);
    if (!invertedId) return null;
    cloneStyle(ops, source, { type: "point", id: invertedId });
    return invertedId;
  }
  const spec = resolveInversionSpec(inversionCircleId, ops);
  if (!spec) return null;
  if (spec.hideCenterId) {
    ops.setObjectVisibility?.({ type: "point", id: spec.hideCenterId }, false);
  }
  const mapPoint = mapPointWithCache(
    (pointId) => ops.createPointByDilation(pointId, spec.centerId, inversionFactorExpr(spec, pointId)),
    (sourcePointId, targetPointId) => {
      if (sourcePointId === targetPointId) return;
      ops.setObjectVisibility?.({ type: "point", id: targetPointId }, false);
    }
  );
  if (source.type === "line") return invertLineToObject({ type: "line", id: source.id }, spec, ops, mapPoint);
  return invertCircleToObject({ type: "circle", id: source.id }, ops, mapPoint);
}
