import {
  type GeometryObjectRef,
  type LineLikeObjectRef,
  type ReflectionObjectRef,
  type SceneModel,
  type ScenePoint,
} from "../../scene/points";

export function selectConstructionDescription(
  selectedObject: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle" | "textLabel" | "number"; id: string } | null,
  scene: SceneModel
): string | null {
  const pointNameById = new Map(scene.points.map((p) => [p.id, p.name]));
  const pointById = new Map(scene.points.map((p) => [p.id, p]));
  const lineById = new Map(scene.lines.map((l) => [l.id, l]));
  const segmentById = new Map(scene.segments.map((s) => [s.id, s]));
  const circleById = new Map(scene.circles.map((c) => [c.id, c]));
  const polygonById = new Map(scene.polygons.map((p) => [p.id, p]));
  const angleById = new Map(scene.angles.map((a) => [a.id, a]));
  const numberById = new Map(scene.numbers.map((n) => [n.id, n]));

  return describeSelectedConstruction(
    selectedObject,
    scene,
    pointNameById,
    pointById,
    lineById,
    segmentById,
    circleById,
    polygonById,
    angleById,
    numberById
  );
}

function describeSelectedConstruction(
  selectedObject: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle" | "textLabel" | "number"; id: string } | null,
  scene: SceneModel,
  pointNameById: Map<string, string>,
  pointById: Map<string, ScenePoint>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>,
  polygonById: Map<string, SceneModel["polygons"][number]>,
  angleById: Map<string, SceneModel["angles"][number]>,
  numberById: Map<string, SceneModel["numbers"][number]>
): string | null {
  if (!selectedObject) return null;
  if (selectedObject.type === "line") {
    const line = lineById.get(selectedObject.id);
    if (!line) return `Line ${selectedObject.id}`;
    if (line.kind === "perpendicular" || line.kind === "parallel") {
      const baseText =
        line.base.type === "line"
          ? (() => {
            const baseLine = lineById.get(line.base.id);
            return baseLine && baseLine.kind === "twoPoint"
              ? `line through ${pointLabel(baseLine.aId, pointNameById)} and ${pointLabel(baseLine.bId, pointNameById)}`
              : `line ${line.base.id}`;
          })()
          : (() => {
            const baseSeg = segmentById.get(line.base.id);
            return baseSeg
              ? `segment ${pointLabel(baseSeg.aId, pointNameById)}${pointLabel(baseSeg.bId, pointNameById)}`
              : `segment ${line.base.id}`;
          })();
      const modeText = line.kind === "perpendicular" ? "Perpendicular" : "Parallel";
      return `${modeText} line through ${pointLabel(line.throughId, pointNameById)} to ${baseText}.`;
    }
    if (line.kind === "tangent") {
      const circle = circleById.get(line.circleId);
      const circleText = circle
        ? describeCircleRef(circle, pointNameById)
        : `circle ${line.circleId}`;
      return `Tangent line through ${pointLabel(line.throughId, pointNameById)} to ${circleText}.`;
    }
    if (line.kind === "circleCircleTangent") {
      const circleA = circleById.get(line.circleAId);
      const circleB = circleById.get(line.circleBId);
      const circleAText = circleA ? describeCircleRef(circleA, pointNameById) : `circle ${line.circleAId}`;
      const circleBText = circleB ? describeCircleRef(circleB, pointNameById) : `circle ${line.circleBId}`;
      return `Common tangent line of ${circleAText} and ${circleBText}.`;
    }
    if (line.kind === "angleBisector") {
      return `Internal angle bisector of ${pointLabel(line.aId, pointNameById)}${pointLabel(
        line.bId,
        pointNameById
      )}${pointLabel(line.cId, pointNameById)}.`;
    }
    const aTransform = getPointTransformMeta(line.aId, pointById);
    const bTransform = getPointTransformMeta(line.bId, pointById);
    if (aTransform && bTransform && sameTransformEnvelope(aTransform, bTransform)) {
      return `Line ${pointLabel(aTransform.basePointId, pointNameById)}${pointLabel(
        bTransform.basePointId,
        pointNameById
      )} ${describeTransformAction(aTransform, pointNameById, lineById, segmentById, circleById)}.`;
    }
    return `Line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}.`;
  }
  if (selectedObject.type === "segment") {
    const segment = segmentById.get(selectedObject.id);
    if (!segment) return `Segment ${selectedObject.id}`;
    const aTransform = getPointTransformMeta(segment.aId, pointById);
    const bTransform = getPointTransformMeta(segment.bId, pointById);
    if (aTransform && bTransform && sameTransformEnvelope(aTransform, bTransform)) {
      const sourceText = `${pointLabel(aTransform.basePointId, pointNameById)}${pointLabel(bTransform.basePointId, pointNameById)}`;
      return `Segment ${sourceText} ${describeTransformAction(aTransform, pointNameById, lineById, segmentById, circleById)}.`;
    }
    return `Segment from ${pointLabel(segment.aId, pointNameById)} to ${pointLabel(segment.bId, pointNameById)}.`;
  }
  if (selectedObject.type === "circle") {
    const circle = circleById.get(selectedObject.id);
    if (!circle) return `Circle ${selectedObject.id}`;
    if (circle.kind === "threePoint") {
      const aTransform = getPointTransformMeta(circle.aId, pointById);
      const bTransform = getPointTransformMeta(circle.bId, pointById);
      const cTransform = getPointTransformMeta(circle.cId, pointById);
      if (
        aTransform &&
        bTransform &&
        cTransform &&
        sameTransformEnvelope(aTransform, bTransform) &&
        sameTransformEnvelope(aTransform, cTransform)
      ) {
        return `Circle through ${pointLabel(aTransform.basePointId, pointNameById)}, ${pointLabel(
          bTransform.basePointId,
          pointNameById
        )}, ${pointLabel(cTransform.basePointId, pointNameById)} ${describeTransformAction(
          aTransform,
          pointNameById,
          lineById,
          segmentById,
          circleById
        )}.`;
      }
    } else {
      const centerTransform = getPointTransformMeta(circle.centerId, pointById);
      const throughTransform = circle.kind === "fixedRadius" ? null : getPointTransformMeta(circle.throughId, pointById);
      if (
        centerTransform &&
        (circle.kind === "fixedRadius" || (throughTransform && sameTransformEnvelope(centerTransform, throughTransform)))
      ) {
        if (circle.kind === "fixedRadius") {
          return `Circle with center ${pointLabel(centerTransform.basePointId, pointNameById)} and radius ${circle.radiusExpr ?? circle.radius} ${describeTransformAction(
            centerTransform,
            pointNameById,
            lineById,
            segmentById,
            circleById
          )}.`;
        }
        if (!throughTransform) return describeCircleForConstruction(circle, pointNameById);
        return `Circle with center ${pointLabel(centerTransform.basePointId, pointNameById)} through ${pointLabel(
          throughTransform.basePointId,
          pointNameById
        )} ${describeTransformAction(centerTransform, pointNameById, lineById, segmentById, circleById)}.`;
      }
    }
    return describeCircleForConstruction(circle, pointNameById);
  }
  if (selectedObject.type === "polygon") {
    const polygon = polygonById.get(selectedObject.id);
    if (!polygon) return `Polygon ${selectedObject.id}`;
    const transformMetas = polygon.pointIds.map((id) => getPointTransformMeta(id, pointById));
    const seed = transformMetas[0];
    if (seed && transformMetas.every((meta) => !!meta && sameTransformEnvelope(seed, meta))) {
      const sourceLabels = transformMetas.map((meta) => pointLabel(meta!.basePointId, pointNameById)).join("");
      return `Polygon ${sourceLabels} ${describeTransformAction(seed, pointNameById, lineById, segmentById, circleById)}.`;
    }
    const labels = polygon.pointIds.map((id) => pointLabel(id, pointNameById)).join("");
    return `Polygon ${labels}.`;
  }
  if (selectedObject.type === "angle") {
    const angle = angleById.get(selectedObject.id);
    if (!angle) return `Angle ${selectedObject.id}`;
    const aTransform = getPointTransformMeta(angle.aId, pointById);
    const bTransform = getPointTransformMeta(angle.bId, pointById);
    const cTransform = getPointTransformMeta(angle.cId, pointById);
    if (
      aTransform &&
      bTransform &&
      cTransform &&
      sameTransformEnvelope(aTransform, bTransform) &&
      sameTransformEnvelope(aTransform, cTransform)
    ) {
      const angleLabel = `${pointLabel(aTransform.basePointId, pointNameById)}${pointLabel(
        bTransform.basePointId,
        pointNameById
      )}${pointLabel(cTransform.basePointId, pointNameById)}`;
      if (angle.kind === "sector") {
        return `Sector ${angleLabel} ${describeTransformAction(aTransform, pointNameById, lineById, segmentById, circleById)}.`;
      }
      return `Angle ${angleLabel} ${describeTransformAction(aTransform, pointNameById, lineById, segmentById, circleById)}.`;
    }
    if (angle.kind === "sector") {
      return `Sector ${pointLabel(angle.aId, pointNameById)}${pointLabel(angle.bId, pointNameById)}${pointLabel(
        angle.cId,
        pointNameById
      )}.`;
    }
    return `Angle ${pointLabel(angle.aId, pointNameById)}${pointLabel(angle.bId, pointNameById)}${pointLabel(angle.cId, pointNameById)} (degrees).`;
  }
  if (selectedObject.type === "number") {
    const num = numberById.get(selectedObject.id);
    if (!num) return null;
    return describeNumberConstruction(num, pointNameById, segmentById, circleById, angleById, numberById);
  }
  if (selectedObject.type === "textLabel") {
    const label = (scene.textLabels ?? []).find((item) => item.id === selectedObject.id);
    if (!label) return null;
    return `Text label ${label.name}.`;
  }

  const point = scene.points.find((item) => item.id === selectedObject.id);
  if (!point) return null;
  return describePointConstruction(point, pointNameById, lineById, segmentById, circleById);
}

function describeNumberConstruction(
  num: SceneModel["numbers"][number],
  pointNameById: Map<string, string>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>,
  angleById: Map<string, SceneModel["angles"][number]>,
  numberById: Map<string, SceneModel["numbers"][number]>
): string {
  const def = num.definition;
  if (def.kind === "constant") return `Number ${num.name} = ${def.value}.`;
  if (def.kind === "slider") {
    const mode =
      def.sliderMode === "radian"
        ? "radian slider"
        : def.sliderMode === "degree"
          ? "degree slider"
          : "slider";
    return `Number ${num.name} = ${def.value} (${mode}, range ${def.min} to ${def.max}).`;
  }
  if (def.kind === "distancePoints") {
    return `Distance ${pointLabel(def.aId, pointNameById)}${pointLabel(def.bId, pointNameById)}.`;
  }
  if (def.kind === "segmentLength") {
    const seg = segmentById.get(def.segId);
    return seg
      ? `Length of segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}.`
      : `Length of segment ${def.segId}.`;
  }
  if (def.kind === "circleRadius") {
    const circle = circleById.get(def.circleId);
    if (!circle) return `Radius of circle ${def.circleId}.`;
    return `Radius of ${describeCircleRef(circle, pointNameById)}.`;
  }
  if (def.kind === "circleArea") {
    const circle = circleById.get(def.circleId);
    if (!circle) return `Area of circle ${def.circleId}.`;
    return `Area of ${describeCircleRef(circle, pointNameById)}.`;
  }
  if (def.kind === "angleDegrees") {
    const angle = angleById.get(def.angleId);
    return angle
      ? `Degree value of angle ${pointLabel(angle.aId, pointNameById)}${pointLabel(angle.bId, pointNameById)}${pointLabel(
        angle.cId,
        pointNameById
      )}.`
      : `Degree value of angle ${def.angleId}.`;
  }
  if (def.kind === "expression") {
    return `Number formula: ${def.expr}.`;
  }
  const n = numberById.get(def.numeratorId)?.name ?? def.numeratorId;
  const d = numberById.get(def.denominatorId)?.name ?? def.denominatorId;
  return `Ratio ${n}/${d}.`;
}

function describePointConstruction(
  point: ScenePoint,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string {
  if (point.kind === "free") return `Free point ${point.name}.`;
  if (point.kind === "midpointPoints") {
    return `Midpoint of ${pointLabel(point.aId, pointNameById)} and ${pointLabel(point.bId, pointNameById)}.`;
  }
  if (point.kind === "midpointSegment") {
    const seg = segmentById.get(point.segId);
    if (!seg) return `Midpoint of segment ${point.segId}.`;
    return `Midpoint of segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}.`;
  }
    if (point.kind === "pointOnLine") {
      const line = lineById.get(point.lineId);
      if (!line) return `Point on line ${point.lineId}.`;
      if (line.kind === "perpendicular" || line.kind === "parallel") {
        const relation = line.kind === "perpendicular" ? "perpendicular to" : "parallel to";
        return `Point on line through ${pointLabel(line.throughId, pointNameById)} ${relation} ${describeObjectRef(
          line.base,
        pointNameById,
        lineById,
        segmentById,
        circleById
      )}.`;
    }
      if (line.kind === "angleBisector") {
        return `Point on internal angle bisector of ${pointLabel(line.aId, pointNameById)}${pointLabel(
          line.bId,
          pointNameById
        )}${pointLabel(line.cId, pointNameById)}.`;
      }
      if (line.kind === "tangent") {
        const circle = circleById.get(line.circleId);
        const circleText = circle ? describeCircleRef(circle, pointNameById) : `circle ${line.circleId}`;
        return `Point on tangent line through ${pointLabel(line.throughId, pointNameById)} to ${circleText}.`;
      }
      if (line.kind === "circleCircleTangent") {
        const circleA = circleById.get(line.circleAId);
        const circleB = circleById.get(line.circleBId);
        const circleAText = circleA ? describeCircleRef(circleA, pointNameById) : `circle ${line.circleAId}`;
        const circleBText = circleB ? describeCircleRef(circleB, pointNameById) : `circle ${line.circleBId}`;
        return `Point on common tangent line of ${circleAText} and ${circleBText}.`;
      }
      return `Point on line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}.`;
    }
  if (point.kind === "pointOnSegment") {
    const seg = segmentById.get(point.segId);
    if (!seg) return `Point on segment ${point.segId}.`;
    return `Point on segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}.`;
  }
  if (point.kind === "pointOnCircle") {
    const circle = circleById.get(point.circleId);
    if (!circle) return `Point on circle ${point.circleId}.`;
    return `Point on ${describeCircleRef(circle, pointNameById)}.`;
  }
  if (point.kind === "circleCenter") {
    const circle = circleById.get(point.circleId);
    if (!circle) return `Center of circle ${point.circleId}.`;
    return `Center of ${describeCircleRef(circle, pointNameById)}.`;
  }
  if (point.kind === "pointByRotation") {
    const angleText = point.angleExpr?.trim()
      ? point.angleExpr.trim()
      : typeof point.angleDeg === "number" && Number.isFinite(point.angleDeg)
        ? point.angleDeg.toFixed(2)
        : "0";
    const sign = point.direction === "CCW" ? "" : "-";
    return `Point from rotation of ${pointLabel(point.pointId, pointNameById)} around ${pointLabel(
      point.centerId,
      pointNameById
    )} by ${sign}${angleText}° (${point.direction}).`;
  }
  if (point.kind === "pointByTranslation") {
    return `Point from translation of ${pointLabel(point.pointId, pointNameById)} by vector ${pointLabel(
      point.fromId,
      pointNameById
    )}${pointLabel(point.toId, pointNameById)}.`;
  }
  if (point.kind === "pointByDilation") {
    const factorText = point.factorExpr?.trim() || (typeof point.factor === "number" && Number.isFinite(point.factor) ? String(point.factor) : "?");
    return `Point from dilation of ${pointLabel(point.pointId, pointNameById)} about ${pointLabel(
      point.centerId,
      pointNameById
    )} with factor ${factorText}.`;
  }
  if (point.kind === "pointByReflection") {
    const relation = point.axis.type === "point" ? "about" : "across";
    return `Point from reflection of ${pointLabel(point.pointId, pointNameById)} ${relation} ${describeReflectionRef(
      point.axis,
      pointNameById,
      lineById,
      segmentById,
      circleById
    )}.`;
  }
  if (point.kind === "circleLineIntersectionPoint") {
    const circle = circleById.get(point.circleId);
    const line = lineById.get(point.lineId);
    const circleText = circle
      ? describeCircleRef(circle, pointNameById)
      : `circle ${point.circleId}`;
    const lineText = line
      ? line.kind === "perpendicular" || line.kind === "parallel"
        ? `line through ${pointLabel(line.throughId, pointNameById)} ${line.kind === "perpendicular" ? "perpendicular to" : "parallel to"
        } ${describeObjectRef(
          line.base,
          pointNameById,
          lineById,
          segmentById,
          circleById
        )}`
        : line.kind === "tangent"
          ? `tangent line through ${pointLabel(line.throughId, pointNameById)} to ${(() => {
              const circle = circleById.get(line.circleId);
              return circle ? describeCircleRef(circle, pointNameById) : `circle ${line.circleId}`;
            })()}`
        : line.kind === "circleCircleTangent"
          ? `common tangent line of ${(() => {
              const circleA = circleById.get(line.circleAId);
              return circleA ? describeCircleRef(circleA, pointNameById) : `circle ${line.circleAId}`;
            })()} and ${(() => {
              const circleB = circleById.get(line.circleBId);
              return circleB ? describeCircleRef(circleB, pointNameById) : `circle ${line.circleBId}`;
            })()}`
        : line.kind === "angleBisector"
          ? `internal angle bisector of ${pointLabel(line.aId, pointNameById)}${pointLabel(
            line.bId,
            pointNameById
          )}${pointLabel(line.cId, pointNameById)}`
          : `line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}`
      : `line ${point.lineId}`;
    return `Intersection of ${lineText} with ${circleText}.`;
  }
  if (point.kind === "circleSegmentIntersectionPoint") {
    const circle = circleById.get(point.circleId);
    const seg = segmentById.get(point.segId);
    const circleText = circle ? describeCircleRef(circle, pointNameById) : `circle ${point.circleId}`;
    const segText = seg
      ? `segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}`
      : `segment ${point.segId}`;
    return `Intersection of ${segText} with ${circleText}.`;
  }
  if (point.kind === "circleCircleIntersectionPoint") {
    const ca = circleById.get(point.circleAId);
    const cb = circleById.get(point.circleBId);
    const caText = ca ? describeCircleRef(ca, pointNameById) : `circle ${point.circleAId}`;
    const cbText = cb ? describeCircleRef(cb, pointNameById) : `circle ${point.circleBId}`;
    return `Intersection of ${caText} and ${cbText}.`;
  }
  if (point.kind === "triangleCenter") {
    const a = pointLabel(point.aId, pointNameById);
    const b = pointLabel(point.bId, pointNameById);
    const c = pointLabel(point.cId, pointNameById);
    if (point.centerKind === "incenter") return `Incenter of triangle ${a}${b}${c}.`;
    if (point.centerKind === "centroid") return `Centroid of triangle ${a}${b}${c}.`;
    return `Orthocenter of triangle ${a}${b}${c}.`;
  }
  if (point.kind === "lineLikeIntersectionPoint") {
    return `Intersection of ${describeObjectRef(point.objA, pointNameById, lineById, segmentById, circleById)} and ${describeObjectRef(
      point.objB,
      pointNameById,
      lineById,
      segmentById,
      circleById
    )}.`;
  }
  return `Intersection of ${describeObjectRef(point.objA, pointNameById, lineById, segmentById, circleById)} and ${describeObjectRef(
    point.objB,
    pointNameById,
    lineById,
    segmentById,
    circleById
  )}.`;
}

function describeReflectionRef(
  ref: ReflectionObjectRef,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string {
  if (ref.type === "point") return `point ${pointLabel(ref.id, pointNameById)}`;
  return describeObjectRef(ref, pointNameById, lineById, segmentById, circleById);
}

function describeObjectRef(
  ref: GeometryObjectRef,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string {
  if (ref.type === "line") {
    const line = lineById.get(ref.id);
    if (line?.kind === "perpendicular" || line?.kind === "parallel") {
      return `line through ${pointLabel(line.throughId, pointNameById)} ${line.kind === "perpendicular" ? "perpendicular to" : "parallel to"
        } ${describeObjectRef(
          line.base,
          pointNameById,
          lineById,
          segmentById,
          circleById
        )}`;
    }
    if (line?.kind === "tangent") {
      const circle = circleById.get(line.circleId);
      const circleText = circle ? describeCircleRef(circle, pointNameById) : `circle ${line.circleId}`;
      return `tangent line through ${pointLabel(line.throughId, pointNameById)} to ${circleText}`;
    }
    if (line?.kind === "circleCircleTangent") {
      const circleA = circleById.get(line.circleAId);
      const circleB = circleById.get(line.circleBId);
      const circleAText = circleA ? describeCircleRef(circleA, pointNameById) : `circle ${line.circleAId}`;
      const circleBText = circleB ? describeCircleRef(circleB, pointNameById) : `circle ${line.circleBId}`;
      return `common tangent line of ${circleAText} and ${circleBText}`;
    }
    if (line?.kind === "angleBisector") {
      return `internal angle bisector of ${pointLabel(line.aId, pointNameById)}${pointLabel(
        line.bId,
        pointNameById
      )}${pointLabel(line.cId, pointNameById)}`;
    }
    return line
      ? `line through ${pointLabel(line.aId, pointNameById)} and ${pointLabel(line.bId, pointNameById)}`
      : `line ${ref.id}`;
  }
  if (ref.type === "segment") {
    const seg = segmentById.get(ref.id);
    return seg
      ? `segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}`
      : `segment ${ref.id}`;
  }
  if (ref.type === "angle") {
    return `sector ${ref.id}`;
  }
  const circle = circleById.get(ref.id);
  return circle
    ? describeCircleRef(circle, pointNameById)
    : `circle ${ref.id}`;
}

type PointTransformMeta =
  | {
      kind: "translation";
      basePointId: string;
      fromId: string;
      toId: string;
    }
  | {
      kind: "dilation";
      basePointId: string;
      centerId: string;
      factorText: string;
    }
  | {
      kind: "reflection";
      basePointId: string;
      axis: ReflectionObjectRef;
    };

function getPointTransformMeta(pointId: string, pointById: Map<string, ScenePoint>): PointTransformMeta | null {
  const point = pointById.get(pointId);
  if (!point) return null;
  if (point.kind === "pointByTranslation") {
    return {
      kind: "translation",
      basePointId: point.pointId,
      fromId: point.fromId,
      toId: point.toId,
    };
  }
  if (point.kind === "pointByDilation") {
    const factorText =
      point.factorExpr?.trim() ||
      (typeof point.factor === "number" && Number.isFinite(point.factor) ? String(point.factor) : "?");
    return {
      kind: "dilation",
      basePointId: point.pointId,
      centerId: point.centerId,
      factorText,
    };
  }
  if (point.kind === "pointByReflection") {
    return {
      kind: "reflection",
      basePointId: point.pointId,
      axis: point.axis,
    };
  }
  return null;
}

function sameTransformEnvelope(a: PointTransformMeta, b: PointTransformMeta): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "translation" && b.kind === "translation") return a.fromId === b.fromId && a.toId === b.toId;
  if (a.kind === "dilation" && b.kind === "dilation") return a.centerId === b.centerId && a.factorText === b.factorText;
  if (a.kind === "reflection" && b.kind === "reflection") return a.axis.type === b.axis.type && a.axis.id === b.axis.id;
  return false;
}

function describeLineLikeCompact(
  ref: LineLikeObjectRef,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string {
  if (ref.type === "segment") {
    const seg = segmentById.get(ref.id);
    return seg ? `segment ${pointLabel(seg.aId, pointNameById)}${pointLabel(seg.bId, pointNameById)}` : `segment ${ref.id}`;
  }
  const line = lineById.get(ref.id);
  if (line && (line.kind === undefined || line.kind === "twoPoint")) {
    return `line ${pointLabel(line.aId, pointNameById)}${pointLabel(line.bId, pointNameById)}`;
  }
  return describeObjectRef(ref, pointNameById, lineById, segmentById, circleById);
}

function describeTransformAction(
  meta: PointTransformMeta,
  pointNameById: Map<string, string>,
  lineById: Map<string, SceneModel["lines"][number]>,
  segmentById: Map<string, SceneModel["segments"][number]>,
  circleById: Map<string, SceneModel["circles"][number]>
): string {
  if (meta.kind === "translation") {
    return `translated by vector ${pointLabel(meta.fromId, pointNameById)}${pointLabel(meta.toId, pointNameById)}`;
  }
  if (meta.kind === "dilation") {
    return `dilated about ${pointLabel(meta.centerId, pointNameById)} with factor ${meta.factorText}`;
  }
  if (meta.axis.type === "point") {
    return `reflected about point ${pointLabel(meta.axis.id, pointNameById)}`;
  }
  return `reflected over ${describeLineLikeCompact(meta.axis, pointNameById, lineById, segmentById, circleById)}`;
}

function describeCircleRef(circle: SceneModel["circles"][number], pointNameById: Map<string, string>): string {
  if (circle.kind === "fixedRadius") {
    return `circle centered at ${pointLabel(circle.centerId, pointNameById)}`;
  }
  if (circle.kind === "threePoint") {
    return `circle through ${pointLabel(circle.aId, pointNameById)}, ${pointLabel(circle.bId, pointNameById)}, ${pointLabel(
      circle.cId,
      pointNameById
    )}`;
  }
  return `circle centered at ${pointLabel(circle.centerId, pointNameById)} through ${pointLabel(circle.throughId, pointNameById)}`;
}

function describeCircleForConstruction(circle: SceneModel["circles"][number], pointNameById: Map<string, string>): string {
  if (circle.kind === "fixedRadius") {
    return `Circle with center ${pointLabel(circle.centerId, pointNameById)} and radius ${circle.radiusExpr ?? circle.radius}.`;
  }
  if (circle.kind === "threePoint") {
    return `Circle through ${pointLabel(circle.aId, pointNameById)}, ${pointLabel(circle.bId, pointNameById)}, ${pointLabel(
      circle.cId,
      pointNameById
    )}.`;
  }
  return `Circle with center ${pointLabel(circle.centerId, pointNameById)} through ${pointLabel(circle.throughId, pointNameById)}.`;
}

function pointLabel(pointId: string, pointNameById: Map<string, string>): string {
  return pointNameById.get(pointId) ?? pointId;
}
