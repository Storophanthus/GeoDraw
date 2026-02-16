import type { GeometryObjectRef, SceneModel } from "../scene/points";
import { resolveIntersectionBranchIndexInScene } from "./intersectionReuse";

function objectRefAlive(
  obj: GeometryObjectRef,
  lines: SceneModel["lines"],
  segments: SceneModel["segments"],
  circles: SceneModel["circles"],
  angles: SceneModel["angles"]
): boolean {
  if (obj.type === "line") return lines.some((line) => line.id === obj.id);
  if (obj.type === "segment") return segments.some((segment) => segment.id === obj.id);
  if (obj.type === "circle") return circles.some((circle) => circle.id === obj.id);
  return angles.some((angle) => angle.id === obj.id && angle.kind === "sector");
}

export function normalizeSceneIntegrity(scene: SceneModel): SceneModel {
  let points = scene.points;
  let vectors = scene.vectors ?? [];
  let segments = scene.segments;
  let lines = scene.lines;
  let circles = scene.circles;
  let polygons = scene.polygons;
  let angles = scene.angles;
  let numbers = scene.numbers;
  let changed = false;

  const sameIds = (a: Array<{ id: string }>, b: Array<{ id: string }>) =>
    a.length === b.length && a.every((item, idx) => item.id === b[idx].id);

  for (let pass = 0; pass < 6; pass += 1) {
    const pointIds = new Set(points.map((p) => p.id));
    const nextVectors = vectors.filter((vector) => {
      if (vector.kind === "freeVector") {
        return Number.isFinite(vector.dx) && Number.isFinite(vector.dy);
      }
      return pointIds.has(vector.fromId) && pointIds.has(vector.toId);
    });
    const nextVectorIds = new Set(nextVectors.map((vector) => vector.id));

    const nextSegments = segments.filter((seg) => pointIds.has(seg.aId) && pointIds.has(seg.bId));
    const nextCircles = circles.filter((circle) => {
      if (circle.kind === "threePoint") {
        return pointIds.has(circle.aId) && pointIds.has(circle.bId) && pointIds.has(circle.cId);
      }
      if (!pointIds.has(circle.centerId)) return false;
      if (circle.kind === "fixedRadius") return Number.isFinite(circle.radius) && circle.radius > 0;
      return pointIds.has(circle.throughId);
    });
    const nextAngles = angles.filter(
      (angle) => pointIds.has(angle.aId) && pointIds.has(angle.bId) && pointIds.has(angle.cId)
    );
    const nextPolygons = polygons.filter(
      (polygon) => polygon.pointIds.length >= 3 && polygon.pointIds.every((pointId) => pointIds.has(pointId))
    );
    const nextPolygonIds = new Set(nextPolygons.map((polygon) => polygon.id));
    const nextSectorIds = new Set(nextAngles.filter((angle) => angle.kind === "sector").map((angle) => angle.id));
    const nextSegmentsNormalized = nextSegments.map((segment) => {
      const polygonOwners = Array.isArray(segment.ownedByPolygonIds)
        ? segment.ownedByPolygonIds.filter((id) => nextPolygonIds.has(id))
        : undefined;
      const sectorOwners = Array.isArray(segment.ownedBySectorIds)
        ? segment.ownedBySectorIds.filter((id) => nextSectorIds.has(id))
        : undefined;
      const dedupe = (ids: string[] | undefined): string[] | undefined => {
        if (!ids || ids.length === 0) return undefined;
        const out: string[] = [];
        for (let i = 0; i < ids.length; i += 1) {
          const id = ids[i];
          if (!out.includes(id)) out.push(id);
        }
        return out.length > 0 ? out : undefined;
      };
      const polyNext = dedupe(polygonOwners);
      const sectorNext = dedupe(sectorOwners);
      const samePoly =
        (polyNext === undefined && segment.ownedByPolygonIds === undefined) ||
        (Array.isArray(polyNext) &&
          Array.isArray(segment.ownedByPolygonIds) &&
          polyNext.length === segment.ownedByPolygonIds.length &&
          polyNext.every((id, idx) => id === segment.ownedByPolygonIds?.[idx]));
      const sameSector =
        (sectorNext === undefined && segment.ownedBySectorIds === undefined) ||
        (Array.isArray(sectorNext) &&
          Array.isArray(segment.ownedBySectorIds) &&
          sectorNext.length === segment.ownedBySectorIds.length &&
          sectorNext.every((id, idx) => id === segment.ownedBySectorIds?.[idx]));
      if (samePoly && sameSector) return segment;
      return {
        ...segment,
        ownedByPolygonIds: polyNext,
        ownedBySectorIds: sectorNext,
      };
    });

    const nextSegmentIds = new Set(nextSegmentsNormalized.map((s) => s.id));
    const nextLineIds = new Set(lines.map((l) => l.id));
    const nextCircleIds = new Set(nextCircles.map((c) => c.id));

    const nextLines = lines.filter((line) => {
      if (line.kind === "perpendicular" || line.kind === "parallel") {
        if (!pointIds.has(line.throughId)) return false;
        if (line.base.type === "segment") return nextSegmentIds.has(line.base.id);
        return nextLineIds.has(line.base.id);
      }
      if (line.kind === "tangent") {
        return pointIds.has(line.throughId) && nextCircleIds.has(line.circleId);
      }
      if (line.kind === "circleCircleTangent") {
        return nextCircleIds.has(line.circleAId) && nextCircleIds.has(line.circleBId);
      }
      if (line.kind === "angleBisector") {
        return pointIds.has(line.aId) && pointIds.has(line.bId) && pointIds.has(line.cId);
      }
      return pointIds.has(line.aId) && pointIds.has(line.bId);
    });

    const nextLineIdsAfter = new Set(nextLines.map((l) => l.id));

    const sceneForPass: SceneModel = { points, vectors: nextVectors, lines, segments, circles, polygons, angles, numbers };
    const pointsWithBranches = points.map((point) => {
      if (
        point.kind !== "intersectionPoint" ||
        (Number.isInteger(point.branchIndex) && (point.branchIndex as number) >= 0)
      ) {
        return point;
      }
      const branchIndex = resolveIntersectionBranchIndexInScene(sceneForPass, point.objA, point.objB, point.preferredWorld);
      if (branchIndex === null) return point;
      return { ...point, branchIndex };
    });

    const nextPoints = pointsWithBranches
      .map((point) => {
        if (point.kind === "circleLineIntersectionPoint" && point.excludePointId && !pointIds.has(point.excludePointId)) {
          return { ...point, excludePointId: undefined };
        }
        if (point.kind === "circleSegmentIntersectionPoint" && point.excludePointId && !pointIds.has(point.excludePointId)) {
          return { ...point, excludePointId: undefined };
        }
        if (point.kind === "circleCircleIntersectionPoint" && point.excludePointId && !pointIds.has(point.excludePointId)) {
          return { ...point, excludePointId: undefined };
        }
        if (point.kind === "intersectionPoint" && point.excludePointId && !pointIds.has(point.excludePointId)) {
          return { ...point, excludePointId: undefined };
        }
        if (point.kind === "pointByTranslation" && point.vectorId && !nextVectorIds.has(point.vectorId)) {
          return { ...point, vectorId: undefined };
        }
        return point;
      })
      .filter((point) => {
        if (point.kind === "free") return true;
        if (point.kind === "midpointPoints") return pointIds.has(point.aId) && pointIds.has(point.bId);
        if (point.kind === "midpointSegment") return nextSegmentIds.has(point.segId);
        if (point.kind === "pointOnLine") return nextLineIdsAfter.has(point.lineId);
        if (point.kind === "pointOnSegment") return nextSegmentIds.has(point.segId);
        if (point.kind === "pointOnCircle") return nextCircleIds.has(point.circleId);
        if (point.kind === "circleCenter") return nextCircleIds.has(point.circleId);
        if (point.kind === "pointByRotation") return pointIds.has(point.centerId) && pointIds.has(point.pointId);
        if (point.kind === "pointByTranslation") {
          if (point.vectorId) return pointIds.has(point.pointId) && nextVectorIds.has(point.vectorId);
          return pointIds.has(point.pointId) && pointIds.has(point.fromId) && pointIds.has(point.toId);
        }
        if (point.kind === "pointByDilation") {
          return pointIds.has(point.pointId) && pointIds.has(point.centerId);
        }
        if (point.kind === "pointByReflection") {
          if (!pointIds.has(point.pointId)) return false;
          return point.axis.type === "line" ? nextLineIdsAfter.has(point.axis.id) : nextSegmentIds.has(point.axis.id);
        }
        if (point.kind === "circleLineIntersectionPoint") {
          return nextCircleIds.has(point.circleId) && nextLineIdsAfter.has(point.lineId);
        }
        if (point.kind === "circleSegmentIntersectionPoint") {
          return nextCircleIds.has(point.circleId) && nextSegmentIds.has(point.segId);
        }
        if (point.kind === "circleCircleIntersectionPoint") {
          return nextCircleIds.has(point.circleAId) && nextCircleIds.has(point.circleBId);
        }
        if (point.kind === "lineLikeIntersectionPoint") {
          return (
            objectRefAlive(point.objA, nextLines, nextSegments, nextCircles, nextAngles) &&
            objectRefAlive(point.objB, nextLines, nextSegments, nextCircles, nextAngles)
          );
        }
        if (point.kind === "intersectionPoint") {
          return (
            objectRefAlive(point.objA, nextLines, nextSegments, nextCircles, nextAngles) &&
            objectRefAlive(point.objB, nextLines, nextSegments, nextCircles, nextAngles)
          );
        }
        return true;
      });

    const nextPointIds = new Set(nextPoints.map((p) => p.id));
    const nextAngleIds = new Set(nextAngles.map((a) => a.id));
    const nextCircleIdsAfter = new Set(nextCircles.map((c) => c.id));
    const nextSegmentIdsAfter = new Set(nextSegmentsNormalized.map((s) => s.id));
    const numbersPreFiltered = numbers.filter((num) => {
      const def = num.definition;
      if (def.kind === "constant") return Number.isFinite(def.value);
      if (def.kind === "distancePoints") return nextPointIds.has(def.aId) && nextPointIds.has(def.bId);
      if (def.kind === "segmentLength") return nextSegmentIdsAfter.has(def.segId);
      if (def.kind === "circleRadius" || def.kind === "circleArea") return nextCircleIdsAfter.has(def.circleId);
      if (def.kind === "angleDegrees") return nextAngleIds.has(def.angleId);
      return true;
    });
    const numberIds = new Set(numbersPreFiltered.map((n) => n.id));
    const nextNumbers = numbersPreFiltered.filter((num) => {
      if (num.definition.kind !== "ratio") return true;
      return numberIds.has(num.definition.numeratorId) && numberIds.has(num.definition.denominatorId);
    });

    const anyChanged =
      !sameIds(nextPoints, points) ||
      !sameIds(nextVectors, vectors) ||
      !sameIds(nextSegmentsNormalized, segments) ||
      !sameIds(nextLines, lines) ||
      !sameIds(nextCircles, circles) ||
      !sameIds(nextPolygons, polygons) ||
      !sameIds(nextAngles, angles) ||
      !sameIds(nextNumbers, numbers) ||
      nextPoints.some((point, idx) => point !== points[idx]) ||
      nextVectors.some((vector, idx) => vector !== vectors[idx]) ||
      nextSegmentsNormalized.some((segment, idx) => segment !== segments[idx]);

    points = nextPoints;
    vectors = nextVectors;
    segments = nextSegmentsNormalized;
    lines = nextLines;
    circles = nextCircles;
    polygons = nextPolygons;
    angles = nextAngles;
    numbers = nextNumbers;
    changed = changed || anyChanged;
    if (!anyChanged) break;
  }

  if (!changed) return scene;
  return { ...scene, points, vectors, segments, lines, circles, polygons, angles, numbers };
}
