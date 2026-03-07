import { distance } from "../../geo/geometry";
import { isRightExactByProvenance, registerPerpendicularRelation, registerSegmentPair } from "../../domain/rightAngleProvenance";
import {
  computeOrientedAngleRad,
  evaluateAngleExpressionDegrees,
  getLineWorldAnchors,
  getPointWorldPos,
  isRightAngle,
  nextLabelFromIndex,
} from "../../scene/points";
import type { SceneModel } from "../../scene/points";
import {
  defaultLineLabelPosWorld,
  defaultLineLabelText,
  defaultSegmentLabelPosWorld,
  defaultSegmentLabelText,
} from "../../scene/objectLabels";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type SceneLineAngleContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
};

const ANGLE_LABEL_MIN_DIST = 0.35;
const ANGLE_LABEL_OFFSET = 0.4;
const NON_RIGHT_ANGLE_LABEL_DIST_SCALE = 0.65;
const RIGHT_ANGLE_LABEL_DIST_SCALE = 0.35;
const RIGHT_ANGLE_APPROX_EPS = 1e-2;

function defaultAngleLabelDist(arcRadius: number, rightLike: boolean): number {
  const base = Math.max(ANGLE_LABEL_MIN_DIST, arcRadius - ANGLE_LABEL_OFFSET);
  const scale = rightLike ? RIGHT_ANGLE_LABEL_DIST_SCALE : NON_RIGHT_ANGLE_LABEL_DIST_SCALE;
  return Math.max(ANGLE_LABEL_MIN_DIST, base * scale);
}

export function createSceneLineAngleActions(
  ctx: SceneLineAngleContext
): Pick<
  GeoActions,
  | "createPerpendicularLine"
  | "createParallelLine"
  | "createTangentLines"
  | "createCircleTangentLines"
  | "createAngleBisectorLine"
  | "createAngle"
  | "createSector"
  | "createAngleFixed"
> {
  const edgeKey = (aId: string, bId: string) => (aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`);
  const lineSignature = (anchors: { a: { x: number; y: number }; b: { x: number; y: number } }): string => {
    const dx = anchors.b.x - anchors.a.x;
    const dy = anchors.b.y - anchors.a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-12) return "";
    let nx = -dy / len;
    let ny = dx / len;
    let c = nx * anchors.a.x + ny * anchors.a.y;
    if (nx < -1e-12 || (Math.abs(nx) <= 1e-12 && ny < -1e-12)) {
      nx = -nx;
      ny = -ny;
      c = -c;
    }
    const q = (v: number) => Math.round(v * 1e9);
    return `${q(nx)}:${q(ny)}:${q(c)}`;
  };
  return {
    createPerpendicularLine(throughId, base) {
      let id: string | null = null;
      ctx.setState((prev) => {
        const through = prev.scene.points.find((p) => p.id === throughId);
        if (!through) return prev;
        const baseValid =
          base.type === "line"
            ? prev.scene.lines.some((line) => line.id === base.id)
            : prev.scene.segments.some((seg) => seg.id === base.id);
        if (!baseValid) return prev;
        const tempLine: SceneModel["lines"][number] = {
          id: "__temp_perp__",
          kind: "perpendicular",
          throughId,
          base,
          visible: true,
          style: prev.lineDefaults,
        };
        const anchors = getLineWorldAnchors(tempLine, prev.scene);
        if (!anchors) return prev;
        id = `l_${prev.nextLineId}`;
        const lineForLabel = {
          id,
          kind: "perpendicular" as const,
          throughId,
          base,
          visible: true,
          showLabel: false,
          style: prev.lineDefaults,
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: [
              ...prev.scene.lines,
              {
                id,
                kind: "perpendicular",
                throughId,
                base,
                visible: true,
                showLabel: false,
                labelText: defaultLineLabelText(lineForLabel, prev.scene),
                labelPosWorld: defaultLineLabelPosWorld(lineForLabel, prev.scene) ?? undefined,
                style: { ...prev.lineDefaults },
              },
            ],
          },
          selectedObject: { type: "line", id },
          recentCreatedObject: { type: "line", id },
          nextLineId: prev.nextLineId + 1,
        };
      });
      if (id) registerPerpendicularRelation(id, base);
      return id;
    },

    createParallelLine(throughId, base) {
      let id: string | null = null;
      ctx.setState((prev) => {
        const through = prev.scene.points.find((p) => p.id === throughId);
        if (!through) return prev;
        const baseValid =
          base.type === "line"
            ? prev.scene.lines.some((line) => line.id === base.id)
            : prev.scene.segments.some((seg) => seg.id === base.id);
        if (!baseValid) return prev;
        const tempLine: SceneModel["lines"][number] = {
          id: "__temp_parallel__",
          kind: "parallel",
          throughId,
          base,
          visible: true,
          style: prev.lineDefaults,
        };
        const anchors = getLineWorldAnchors(tempLine, prev.scene);
        if (!anchors) return prev;
        id = `l_${prev.nextLineId}`;
        const lineForLabel = {
          id,
          kind: "parallel" as const,
          throughId,
          base,
          visible: true,
          showLabel: false,
          style: prev.lineDefaults,
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: [
              ...prev.scene.lines,
              {
                id,
                kind: "parallel",
                throughId,
                base,
                visible: true,
                showLabel: false,
                labelText: defaultLineLabelText(lineForLabel, prev.scene),
                labelPosWorld: defaultLineLabelPosWorld(lineForLabel, prev.scene) ?? undefined,
                style: { ...prev.lineDefaults },
              },
            ],
          },
          selectedObject: { type: "line", id },
          recentCreatedObject: { type: "line", id },
          nextLineId: prev.nextLineId + 1,
        };
      });
      return id;
    },

    createTangentLines(throughId, circleId) {
      const created: string[] = [];
      ctx.setState((prev) => {
        const through = prev.scene.points.find((p) => p.id === throughId);
        const circle = prev.scene.circles.find((c) => c.id === circleId);
        if (!through || !circle) return prev;

        const temp0: SceneModel["lines"][number] = {
          id: "__temp_tangent_0__",
          kind: "tangent",
          throughId,
          circleId,
          branchIndex: 0,
          visible: true,
          style: prev.lineDefaults,
        };
        const a0 = getLineWorldAnchors(temp0, prev.scene);
        if (!a0) return prev;

        const temp1: SceneModel["lines"][number] = {
          id: "__temp_tangent_1__",
          kind: "tangent",
          throughId,
          circleId,
          branchIndex: 1,
          visible: true,
          style: prev.lineDefaults,
        };
        const a1 = getLineWorldAnchors(temp1, prev.scene);

        const nextLines = [...prev.scene.lines];
        let nextLineId = prev.nextLineId;

        const id0 = `l_${nextLineId++}`;
        const line0ForLabel = {
          id: id0,
          kind: "tangent" as const,
          throughId,
          circleId,
          branchIndex: 0 as const,
          visible: true,
          showLabel: false,
          style: prev.lineDefaults,
        };
        nextLines.push({
          id: id0,
          kind: "tangent",
          throughId,
          circleId,
          branchIndex: 0,
          visible: true,
          showLabel: false,
          labelText: defaultLineLabelText(line0ForLabel, prev.scene),
          labelPosWorld: defaultLineLabelPosWorld(line0ForLabel, prev.scene) ?? undefined,
          style: { ...prev.lineDefaults },
        });
        created.push(id0);

        if (a1) {
          const same =
            Math.hypot(a0.a.x - a1.a.x, a0.a.y - a1.a.y) <= 1e-9 &&
            Math.hypot(a0.b.x - a1.b.x, a0.b.y - a1.b.y) <= 1e-9;
          if (!same) {
            const id1 = `l_${nextLineId++}`;
            const line1ForLabel = {
              id: id1,
              kind: "tangent" as const,
              throughId,
              circleId,
              branchIndex: 1 as const,
              visible: true,
              showLabel: false,
              style: prev.lineDefaults,
            };
            nextLines.push({
              id: id1,
              kind: "tangent",
              throughId,
              circleId,
              branchIndex: 1,
              visible: true,
              showLabel: false,
              labelText: defaultLineLabelText(line1ForLabel, prev.scene),
              labelPosWorld: defaultLineLabelPosWorld(line1ForLabel, prev.scene) ?? undefined,
              style: { ...prev.lineDefaults },
            });
            created.push(id1);
          }
        }

        return {
          ...prev,
          scene: { ...prev.scene, lines: nextLines },
          selectedObject: created.length > 0 ? { type: "line", id: created[created.length - 1] } : prev.selectedObject,
          recentCreatedObject:
            created.length > 0 ? { type: "line", id: created[created.length - 1] } : prev.recentCreatedObject,
          nextLineId,
        };
      });
      return created;
    },

    createCircleTangentLines(circleAId, circleBId) {
      if (circleAId === circleBId) return [];
      const created: string[] = [];
      ctx.setState((prev) => {
        const circleA = prev.scene.circles.find((c) => c.id === circleAId);
        const circleB = prev.scene.circles.find((c) => c.id === circleBId);
        if (!circleA || !circleB) return prev;

        const nextLines = [...prev.scene.lines];
        let nextLineId = prev.nextLineId;
        const signatures = new Set<string>();
        const candidates: Array<{ family: "outer" | "inner"; branchIndex: 0 | 1 }> = [
          { family: "outer", branchIndex: 0 },
          { family: "outer", branchIndex: 1 },
          { family: "inner", branchIndex: 0 },
          { family: "inner", branchIndex: 1 },
        ];

        for (let i = 0; i < candidates.length; i += 1) {
          const candidate = candidates[i];
          const tempLine: SceneModel["lines"][number] = {
            id: `__temp_circle_tangent_${candidate.family}_${candidate.branchIndex}__`,
            kind: "circleCircleTangent",
            circleAId,
            circleBId,
            family: candidate.family,
            branchIndex: candidate.branchIndex,
            visible: true,
            style: prev.lineDefaults,
          };
          const anchors = getLineWorldAnchors(tempLine, prev.scene);
          if (!anchors) continue;
          const signature = lineSignature(anchors);
          if (!signature || signatures.has(signature)) continue;
          signatures.add(signature);

          const id = `l_${nextLineId++}`;
          const lineForLabel = {
            id,
            kind: "circleCircleTangent" as const,
            circleAId,
            circleBId,
            family: candidate.family,
            branchIndex: candidate.branchIndex,
            visible: true,
            showLabel: false,
            style: prev.lineDefaults,
          };
          nextLines.push({
            id,
            kind: "circleCircleTangent",
            circleAId,
            circleBId,
            family: candidate.family,
            branchIndex: candidate.branchIndex,
            visible: true,
            showLabel: false,
            labelText: defaultLineLabelText(lineForLabel, prev.scene),
            labelPosWorld: defaultLineLabelPosWorld(lineForLabel, prev.scene) ?? undefined,
            style: { ...prev.lineDefaults },
          });
          created.push(id);
        }

        if (created.length === 0) return prev;
        const lastId = created[created.length - 1];
        return {
          ...prev,
          scene: { ...prev.scene, lines: nextLines },
          selectedObject: { type: "line", id: lastId },
          recentCreatedObject: { type: "line", id: lastId },
          nextLineId,
        };
      });
      return created;
    },

    createAngleBisectorLine(aId, bId, cId) {
      if (aId === bId || bId === cId || aId === cId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        const c = prev.scene.points.find((p) => p.id === cId);
        if (!a || !b || !c) return prev;
        const tempLine: SceneModel["lines"][number] = {
          id: "__temp_bisector__",
          kind: "angleBisector",
          aId,
          bId,
          cId,
          visible: true,
          style: prev.lineDefaults,
        };
        const anchors = getLineWorldAnchors(tempLine, prev.scene);
        if (!anchors) return prev;
        id = `l_${prev.nextLineId}`;
        const lineForLabel = {
          id,
          kind: "angleBisector" as const,
          aId,
          bId,
          cId,
          visible: true,
          showLabel: false,
          style: prev.lineDefaults,
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: [
              ...prev.scene.lines,
              {
                id,
                kind: "angleBisector",
                aId,
                bId,
                cId,
                visible: true,
                showLabel: false,
                labelText: defaultLineLabelText(lineForLabel, prev.scene),
                labelPosWorld: defaultLineLabelPosWorld(lineForLabel, prev.scene) ?? undefined,
                style: { ...prev.lineDefaults },
              },
            ],
          },
          selectedObject: { type: "line", id },
          recentCreatedObject: { type: "line", id },
          nextLineId: prev.nextLineId + 1,
        };
      });
      return id;
    },

    createAngle(aId, bId, cId) {
      if (aId === bId || bId === cId || aId === cId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const pa = prev.scene.points.find((p) => p.id === aId);
        const pb = prev.scene.points.find((p) => p.id === bId);
        const pc = prev.scene.points.find((p) => p.id === cId);
        if (!pa || !pb || !pc) return prev;
        const wa = getPointWorldPos(pa, prev.scene);
        const wb = getPointWorldPos(pb, prev.scene);
        const wc = getPointWorldPos(pc, prev.scene);
        if (!wa || !wb || !wc) return prev;
        const theta = computeOrientedAngleRad(wa, wb, wc);
        if (theta === null) return prev;
        const isRightExact = isRightExactByProvenance(prev.scene, aId, bId, cId);
        const isRightLike = isRightExact || isRightAngle(wa, wb, wc, RIGHT_ANGLE_APPROX_EPS);
        const start = Math.atan2(wa.y - wb.y, wa.x - wb.x);
        const mid = start + theta * 0.5;
        const dir = { x: Math.cos(mid), y: Math.sin(mid) };
        const labelDist = defaultAngleLabelDist(prev.angleDefaults.arcRadius, isRightLike);
        const labelPosWorld = { x: wb.x + dir.x * labelDist, y: wb.y + dir.y * labelDist };
        const markStyle =
          isRightExact && prev.angleDefaults.markStyle === "arc" ? "rightSquare" : prev.angleDefaults.markStyle;

        id = `a_${prev.nextAngleId}`;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles: [
              ...prev.scene.angles,
              {
                id,
                aId,
                bId,
                cId,
                isRightExact,
                visible: true,
                style: {
                  ...prev.angleDefaults,
                  markStyle,
                  labelPosWorld,
                },
              },
            ],
          },
          selectedObject: { type: "angle", id },
          recentCreatedObject: { type: "angle", id },
          nextAngleId: prev.nextAngleId + 1,
        };
      });
      return id;
    },

    createSector(centerId, startId, endId) {
      if (centerId === startId || centerId === endId || startId === endId) return null;
      let id: string | null = null;
      let createdEdges: Array<{ id: string; aId: string; bId: string }> = [];
      ctx.setState((prev) => {
        createdEdges = [];
        const pCenter = prev.scene.points.find((p) => p.id === centerId);
        const pStart = prev.scene.points.find((p) => p.id === startId);
        const pEnd = prev.scene.points.find((p) => p.id === endId);
        if (!pCenter || !pStart || !pEnd) return prev;
        const wCenter = getPointWorldPos(pCenter, prev.scene);
        const wStart = getPointWorldPos(pStart, prev.scene);
        const wEnd = getPointWorldPos(pEnd, prev.scene);
        if (!wCenter || !wStart || !wEnd) return prev;
        const r = distance(wCenter, wStart);
        if (!Number.isFinite(r) || r <= 1e-12) return prev;
        const theta = computeOrientedAngleRad(wStart, wCenter, wEnd);
        if (theta === null) return prev;
        const start = Math.atan2(wStart.y - wCenter.y, wStart.x - wCenter.x);
        const mid = start + theta * 0.5;
        const labelDist = Math.max(0.35, r - 0.4);
        const labelPosWorld = { x: wCenter.x + Math.cos(mid) * labelDist, y: wCenter.y + Math.sin(mid) * labelDist };

        id = `a_${prev.nextAngleId}`;
        const edgeIndexByKey = new Map<string, number>();
        const newSegments = [...prev.scene.segments];
        for (let i = 0; i < newSegments.length; i += 1) {
          const seg = newSegments[i];
          edgeIndexByKey.set(edgeKey(seg.aId, seg.bId), i);
        }
        const radialPairs: Array<[string, string]> = [
          [centerId, startId],
          [centerId, endId],
        ];
        let nextSegmentId = prev.nextSegmentId;
        for (let i = 0; i < radialPairs.length; i += 1) {
          const [aId, bId] = radialPairs[i];
          const k = edgeKey(aId, bId);
          const existingIdx = edgeIndexByKey.get(k);
          if (existingIdx !== undefined) {
            const seg = newSegments[existingIdx];
            if (Array.isArray(seg.ownedBySectorIds)) {
              if (!seg.ownedBySectorIds.includes(id)) {
                newSegments[existingIdx] = { ...seg, ownedBySectorIds: [...seg.ownedBySectorIds, id] };
              }
            } else {
              newSegments[existingIdx] = { ...seg, ownedBySectorIds: [id] };
            }
            continue;
          }
          const segId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          const segForLabel = {
            id: segId,
            aId,
            bId,
            ownedBySectorIds: [id],
            visible: true,
            showLabel: false,
            style: prev.segmentDefaults,
          };
          newSegments.push({
            id: segId,
            aId,
            bId,
            ownedBySectorIds: [id],
            visible: true,
            showLabel: false,
            labelText: defaultSegmentLabelText(segForLabel, prev.scene),
            labelPosWorld: defaultSegmentLabelPosWorld(segForLabel, prev.scene) ?? undefined,
            style: { ...prev.segmentDefaults },
          });
          edgeIndexByKey.set(k, newSegments.length - 1);
          createdEdges.push({ id: segId, aId, bId });
        }
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: newSegments,
            angles: [
              ...prev.scene.angles,
              {
                id,
                kind: "sector",
                aId: startId,
                bId: centerId,
                cId: endId,
                isRightExact: false,
                visible: true,
                style: {
                  ...prev.angleDefaults,
                  arcRadius: r,
                  fillEnabled: true,
                  showLabel: false,
                  showValue: false,
                  labelText: "",
                  labelPosWorld,
                },
              },
            ],
          },
          selectedObject: { type: "angle", id },
          recentCreatedObject: { type: "angle", id },
          nextSegmentId,
          nextAngleId: prev.nextAngleId + 1,
        };
      });
      for (let i = 0; i < createdEdges.length; i += 1) {
        const edge = createdEdges[i];
        registerSegmentPair(edge.id, edge.aId, edge.bId);
      }
      return id;
    },

    createAngleFixed(vertexId, basePointId, angleExpr, direction) {
      if (vertexId === basePointId) return null;
      const expr = angleExpr.trim();
      if (!expr) return null;
      let result: { pointId: string; lineId: string; angleId: string } | null = null;
      ctx.setState((prev) => {
        const pv = prev.scene.points.find((p) => p.id === vertexId);
        const pa = prev.scene.points.find((p) => p.id === basePointId);
        if (!pv || !pa) return prev;
        const wv = getPointWorldPos(pv, prev.scene);
        const wa = getPointWorldPos(pa, prev.scene);
        if (!wv || !wa) return prev;
        if (distance(wv, wa) <= 1e-12) return prev;
        const evalResult = evaluateAngleExpressionDegrees(prev.scene, expr);
        if (!evalResult.ok) return prev;

        const used = new Set(prev.scene.points.map((point) => point.name));
        let idx = 0;
        let name = nextLabelFromIndex(idx);
        while (used.has(name)) {
          idx += 1;
          name = nextLabelFromIndex(idx);
        }

        const pointId = `p_${prev.nextPointId}`;
        const lineId = `l_${prev.nextLineId}`;
        const angleId = `a_${prev.nextAngleId}`;

        const base = { x: wa.x - wv.x, y: wa.y - wv.y };
        const sign = direction === "CCW" ? 1 : -1;
        const theta = (evalResult.valueDeg * Math.PI) / 180;
        const c = Math.cos(sign * theta);
        const s = Math.sin(sign * theta);
        const rot = { x: base.x * c - base.y * s, y: base.x * s + base.y * c };
        const wc = { x: wv.x + rot.x, y: wv.y + rot.y };
        const angleAWorld = direction === "CCW" ? wa : wc;
        const angleCWorld = direction === "CCW" ? wc : wa;
        const oriented = computeOrientedAngleRad(angleAWorld, wv, angleCWorld);
        if (oriented === null) return prev;
        const start = Math.atan2(angleAWorld.y - wv.y, angleAWorld.x - wv.x);
        const mid = start + oriented * 0.5;
        const isRightLike = isRightAngle(angleAWorld, wv, angleCWorld, RIGHT_ANGLE_APPROX_EPS);
        const labelDist = defaultAngleLabelDist(prev.angleDefaults.arcRadius, isRightLike);
        const labelPosWorld = { x: wv.x + Math.cos(mid) * labelDist, y: wv.y + Math.sin(mid) * labelDist };
        const angleAId = direction === "CCW" ? basePointId : pointId;
        const angleCId = direction === "CCW" ? pointId : basePointId;

        result = { pointId, lineId, angleId };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id: pointId,
                kind: "pointByRotation",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name",
                locked: false,
                auxiliary: false,
                centerId: vertexId,
                pointId: basePointId,
                angleDeg: evalResult.valueDeg,
                angleExpr: expr,
                direction,
                radiusMode: "keep",
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
            lines: [
              ...prev.scene.lines,
              {
                id: lineId,
                kind: "twoPoint",
                aId: vertexId,
                bId: pointId,
                visible: true,
                showLabel: false,
                style: { ...prev.lineDefaults },
              },
            ],
            angles: [
              ...prev.scene.angles,
              {
                id: angleId,
                aId: angleAId,
                bId: vertexId,
                cId: angleCId,
                isRightExact: false,
                visible: true,
                style: {
                  ...prev.angleDefaults,
                  labelPosWorld,
                },
              },
            ],
          },
          selectedObject: { type: "angle", id: angleId },
          recentCreatedObject: { type: "angle", id: angleId },
          nextPointId: prev.nextPointId + 1,
          nextLineId: prev.nextLineId + 1,
          nextAngleId: prev.nextAngleId + 1,
        };
      });
      return result;
    },
  };
}
