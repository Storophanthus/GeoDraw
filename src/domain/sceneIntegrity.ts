import type { GeometryObjectRef, SceneModel } from "../scene/points";
import {
  defaultCircleLabelPosWorld,
  defaultCircleLabelText,
  defaultLineLabelPosWorld,
  defaultLineLabelText,
  defaultPolygonLabelPosWorld,
  defaultPolygonLabelText,
  defaultSegmentLabelPosWorld,
  defaultSegmentLabelText,
  isFiniteLabelPosWorld,
  resolveObjectLabelText,
} from "../scene/objectLabels";
import { resolveIntersectionBranchIndexInScene } from "./intersectionReuse";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceIdentifierToken(expr: string, from: string, to: string): string {
  if (!expr || from === to) return expr;
  return expr.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
}

function migrateLegacySliderNumbers(
  numbers: SceneModel["numbers"],
  points: SceneModel["points"],
  circles: SceneModel["circles"]
): {
  numbers: SceneModel["numbers"];
  points: SceneModel["points"];
  circles: SceneModel["circles"];
  changed: boolean;
} {
  let changed = false;
  const renameByName = new Map<string, string>();
  const usedNames = new Set(numbers.map((n) => n.name));

  const modeNormalized = numbers.map((num) => {
    if (num.definition.kind !== "slider") return num;
    const def = num.definition;
    if (def.sliderMode !== "radian") return num;
    changed = true;
    const legacy = /^t_(\d+)$/.exec(num.name);
    let nextName = num.name;
    if (legacy) {
      usedNames.delete(num.name);
      let idx = Number(legacy[1]);
      if (!Number.isInteger(idx) || idx <= 0) idx = 1;
      let candidate = `ang_${idx}`;
      while (usedNames.has(candidate)) {
        idx += 1;
        candidate = `ang_${idx}`;
      }
      usedNames.add(candidate);
      nextName = candidate;
      if (nextName !== num.name) renameByName.set(num.name, nextName);
    }
    return {
      ...num,
      name: nextName,
      definition: {
        ...def,
        sliderMode: "degree" as const,
      },
    };
  });

  if (!changed && renameByName.size === 0) {
    return { numbers, points, circles, changed: false };
  }

  const rewriteExpr = (expr: string | undefined): string | undefined => {
    if (typeof expr !== "string" || renameByName.size === 0) return expr;
    let out = expr;
    for (const [from, to] of renameByName) out = replaceIdentifierToken(out, from, to);
    return out;
  };

  const nextNumbers = modeNormalized.map((num) => {
    if (num.definition.kind !== "expression") return num;
    const nextExpr = rewriteExpr(num.definition.expr);
    if (nextExpr === num.definition.expr) return num;
    changed = true;
    return {
      ...num,
      definition: {
        ...num.definition,
        expr: nextExpr ?? num.definition.expr,
      },
    };
  });

  const nextPoints = points.map((point) => {
    if (point.kind === "pointByRotation") {
      const nextExpr = rewriteExpr(point.angleExpr);
      if (nextExpr === point.angleExpr) return point;
      changed = true;
      return { ...point, angleExpr: nextExpr };
    }
    if (point.kind === "pointByDilation") {
      const nextExpr = rewriteExpr(point.factorExpr);
      if (nextExpr === point.factorExpr) return point;
      changed = true;
      return { ...point, factorExpr: nextExpr };
    }
    return point;
  });

  const nextCircles = circles.map((circle) => {
    if (circle.kind !== "fixedRadius") return circle;
    const nextExpr = rewriteExpr(circle.radiusExpr);
    if (nextExpr === circle.radiusExpr) return circle;
    changed = true;
    return { ...circle, radiusExpr: nextExpr };
  });

  return { numbers: nextNumbers, points: nextPoints, circles: nextCircles, changed };
}

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

function normalizeTextLabels(
  labels: NonNullable<SceneModel["textLabels"]>
): NonNullable<SceneModel["textLabels"]> {
  return labels
    .filter((label) => typeof label.id === "string" && label.id.length > 0)
    .map((label) => {
      const textColor =
        typeof label.style?.textColor === "string" && label.style.textColor.trim().length > 0
          ? label.style.textColor
          : "#111111";
      const textSize =
        typeof label.style?.textSize === "number" && Number.isFinite(label.style.textSize)
          ? Math.max(8, Math.min(96, label.style.textSize))
          : 12;
      const useTex = Boolean(label.style?.useTex);
      const rotationDeg =
        typeof label.style?.rotationDeg === "number" && Number.isFinite(label.style.rotationDeg)
          ? Math.max(-3600, Math.min(3600, label.style.rotationDeg))
          : 0;
      const x = Number.isFinite(label.positionWorld?.x) ? label.positionWorld.x : 0;
      const y = Number.isFinite(label.positionWorld?.y) ? label.positionWorld.y : 0;
      const contentMode =
        label.contentMode === "number" ? "number" : label.contentMode === "expression" ? "expression" : "static";
      const numberId =
        contentMode === "number" && typeof label.numberId === "string" && label.numberId.trim().length > 0
          ? label.numberId
          : undefined;
      const expr =
        contentMode === "expression" && typeof label.expr === "string"
          ? label.expr
          : undefined;
      return {
        ...label,
        name: typeof label.name === "string" ? label.name : label.id,
        text: typeof label.text === "string" ? label.text : "",
        contentMode,
        numberId,
        expr,
        visible: Boolean(label.visible),
        positionWorld: { x, y },
        style: {
          textColor,
          textSize,
          useTex,
          rotationDeg,
        },
      };
    });
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
  let textLabels = Array.isArray(scene.textLabels) ? scene.textLabels : [];
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

    const nextTextLabels = normalizeTextLabels(textLabels);

    const sceneForPass: SceneModel = {
      points,
      vectors: nextVectors,
      lines,
      segments,
      circles,
      polygons,
      angles,
      numbers,
      textLabels: nextTextLabels,
    };
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
        if (point.kind === "triangleCenter") {
          return pointIds.has(point.aId) && pointIds.has(point.bId) && pointIds.has(point.cId);
        }
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
      if (def.kind === "slider") {
        return (
          Number.isFinite(def.value) &&
          Number.isFinite(def.min) &&
          Number.isFinite(def.max) &&
          Number.isFinite(def.step) &&
          def.step > 0
        );
      }
      if (def.kind === "distancePoints") return nextPointIds.has(def.aId) && nextPointIds.has(def.bId);
      if (def.kind === "segmentLength") return nextSegmentIdsAfter.has(def.segId);
      if (def.kind === "circleRadius" || def.kind === "circleArea") return nextCircleIdsAfter.has(def.circleId);
      if (def.kind === "angleDegrees") return nextAngleIds.has(def.angleId);
      return true;
    });
    const numberIds = new Set(numbersPreFiltered.map((n) => n.id));
    const nextNumbersPreMigration = numbersPreFiltered.filter((num) => {
      if (num.definition.kind !== "ratio") return true;
      return numberIds.has(num.definition.numeratorId) && numberIds.has(num.definition.denominatorId);
    });
    const migrated = migrateLegacySliderNumbers(nextNumbersPreMigration, nextPoints, nextCircles);
    const nextNumbers = migrated.numbers;
    const nextPointsMigrated = migrated.points;
    const nextCirclesMigrated = migrated.circles;

    const sceneForLabels: SceneModel = {
      points: nextPointsMigrated,
      vectors: nextVectors,
      segments: nextSegmentsNormalized,
      lines: nextLines,
      circles: nextCirclesMigrated,
      polygons: nextPolygons,
      angles: nextAngles,
      numbers: nextNumbers,
    };

    const nextSegmentsLabeled = nextSegmentsNormalized.map((segment) => {
      const fallbackText = defaultSegmentLabelText(segment, sceneForLabels);
      const fallbackPos = defaultSegmentLabelPosWorld(segment, sceneForLabels) ?? undefined;
      const showLabel = Boolean(segment.showLabel);
      const labelText = resolveObjectLabelText(segment.labelText, fallbackText);
      const labelPosWorld = isFiniteLabelPosWorld(segment.labelPosWorld) ? segment.labelPosWorld : fallbackPos;
      const sameShow = segment.showLabel === showLabel;
      const sameText = segment.labelText === labelText;
      const samePos =
        (segment.labelPosWorld === undefined && labelPosWorld === undefined)
        || (
          segment.labelPosWorld !== undefined
          && labelPosWorld !== undefined
          && segment.labelPosWorld.x === labelPosWorld.x
          && segment.labelPosWorld.y === labelPosWorld.y
        );
      if (sameShow && sameText && samePos) return segment;
      return {
        ...segment,
        showLabel,
        labelText,
        labelPosWorld,
      };
    });

    const sceneForLineLabels: SceneModel = {
      ...sceneForLabels,
      segments: nextSegmentsLabeled,
    };

    const nextLinesLabeled = nextLines.map((line) => {
      const fallbackText = defaultLineLabelText(line, sceneForLineLabels);
      const fallbackPos = defaultLineLabelPosWorld(line, sceneForLineLabels) ?? undefined;
      const showLabel = Boolean(line.showLabel);
      const labelText = resolveObjectLabelText(line.labelText, fallbackText);
      const labelPosWorld = isFiniteLabelPosWorld(line.labelPosWorld) ? line.labelPosWorld : fallbackPos;
      const sameShow = Boolean(line.showLabel) === showLabel;
      const sameText = line.labelText === labelText;
      const samePos =
        (line.labelPosWorld === undefined && labelPosWorld === undefined)
        || (
          line.labelPosWorld !== undefined
          && labelPosWorld !== undefined
          && line.labelPosWorld.x === labelPosWorld.x
          && line.labelPosWorld.y === labelPosWorld.y
        );
      if (sameShow && sameText && samePos) return line;
      return {
        ...line,
        showLabel,
        labelText,
        labelPosWorld,
      };
    });

    const sceneForCircleLabels: SceneModel = {
      ...sceneForLineLabels,
      lines: nextLinesLabeled,
    };

    const nextCirclesLabeled = nextCirclesMigrated.map((circle) => {
      const fallbackText = defaultCircleLabelText(circle, sceneForCircleLabels);
      const fallbackPos = defaultCircleLabelPosWorld(circle, sceneForCircleLabels) ?? undefined;
      const showLabel = Boolean(circle.showLabel);
      const labelText = resolveObjectLabelText(circle.labelText, fallbackText);
      const labelPosWorld = isFiniteLabelPosWorld(circle.labelPosWorld) ? circle.labelPosWorld : fallbackPos;
      const sameShow = Boolean(circle.showLabel) === showLabel;
      const sameText = circle.labelText === labelText;
      const samePos =
        (circle.labelPosWorld === undefined && labelPosWorld === undefined)
        || (
          circle.labelPosWorld !== undefined
          && labelPosWorld !== undefined
          && circle.labelPosWorld.x === labelPosWorld.x
          && circle.labelPosWorld.y === labelPosWorld.y
        );
      if (sameShow && sameText && samePos) return circle;
      return {
        ...circle,
        showLabel,
        labelText,
        labelPosWorld,
      };
    });

    const sceneForPolygonLabels: SceneModel = {
      ...sceneForCircleLabels,
      circles: nextCirclesLabeled,
    };

    const nextPolygonsLabeled = nextPolygons.map((polygon) => {
      const fallbackText = defaultPolygonLabelText(polygon, sceneForPolygonLabels);
      const fallbackPos = defaultPolygonLabelPosWorld(polygon, sceneForPolygonLabels) ?? undefined;
      const showLabel = Boolean(polygon.showLabel);
      const labelText = resolveObjectLabelText(polygon.labelText, fallbackText);
      const labelPosWorld = isFiniteLabelPosWorld(polygon.labelPosWorld) ? polygon.labelPosWorld : fallbackPos;
      const sameShow = Boolean(polygon.showLabel) === showLabel;
      const sameText = polygon.labelText === labelText;
      const samePos =
        (polygon.labelPosWorld === undefined && labelPosWorld === undefined)
        || (
          polygon.labelPosWorld !== undefined
          && labelPosWorld !== undefined
          && polygon.labelPosWorld.x === labelPosWorld.x
          && polygon.labelPosWorld.y === labelPosWorld.y
        );
      if (sameShow && sameText && samePos) return polygon;
      return {
        ...polygon,
        showLabel,
        labelText,
        labelPosWorld,
      };
    });

    const anyChanged =
      !sameIds(nextPointsMigrated, points) ||
      !sameIds(nextVectors, vectors) ||
      !sameIds(nextSegmentsLabeled, segments) ||
      !sameIds(nextLinesLabeled, lines) ||
      !sameIds(nextCirclesLabeled, circles) ||
      !sameIds(nextPolygonsLabeled, polygons) ||
      !sameIds(nextAngles, angles) ||
      !sameIds(nextTextLabels, textLabels) ||
      !sameIds(nextNumbers, numbers) ||
      nextPointsMigrated.some((point, idx) => point !== points[idx]) ||
      nextVectors.some((vector, idx) => vector !== vectors[idx]) ||
      nextSegmentsLabeled.some((segment, idx) => segment !== segments[idx]) ||
      nextLinesLabeled.some((line, idx) => line !== lines[idx]) ||
      nextCirclesLabeled.some((circle, idx) => circle !== circles[idx]) ||
      nextPolygonsLabeled.some((polygon, idx) => polygon !== polygons[idx]) ||
      nextTextLabels.some((label, idx) => label !== textLabels[idx]);

    points = nextPointsMigrated;
    vectors = nextVectors;
    segments = nextSegmentsLabeled;
    lines = nextLinesLabeled;
    circles = nextCirclesLabeled;
    polygons = nextPolygonsLabeled;
    angles = nextAngles;
    numbers = nextNumbers;
    textLabels = nextTextLabels;
    changed = changed || anyChanged || migrated.changed;
    if (!anyChanged) break;
  }

  if (!changed) return scene;
  return { ...scene, points, vectors, segments, lines, circles, polygons, angles, numbers, textLabels };
}
