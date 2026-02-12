import { distance } from "../../geo/geometry";
import {
  computeOrientedAngleRad,
  evaluateAngleExpressionDegrees,
  getLineWorldAnchors,
  getPointWorldPos,
  nextLabelFromIndex,
} from "../../scene/points";
import type { SceneModel } from "../../scene/points";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type SceneLineAngleContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
};

export function createSceneLineAngleActions(
  ctx: SceneLineAngleContext
): Pick<
  GeoActions,
  "createPerpendicularLine" | "createParallelLine" | "createAngleBisectorLine" | "createAngle" | "createAngleFixed"
> {
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
        const start = Math.atan2(wa.y - wb.y, wa.x - wb.x);
        const mid = start + theta * 0.5;
        const dir = { x: Math.cos(mid), y: Math.sin(mid) };
        const labelDist = Math.max(0.45, prev.angleDefaults.arcRadius * 1.25);
        const labelPosWorld = { x: wb.x + dir.x * labelDist, y: wb.y + dir.y * labelDist };

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
                visible: true,
                style: {
                  ...prev.angleDefaults,
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
        const oriented = computeOrientedAngleRad(wa, wv, wc);
        if (oriented === null) return prev;
        const start = Math.atan2(wa.y - wv.y, wa.x - wv.x);
        const mid = start + oriented * 0.5;
        const labelDist = Math.max(0.45, prev.angleDefaults.arcRadius * 1.25);
        const labelPosWorld = { x: wv.x + Math.cos(mid) * labelDist, y: wv.y + Math.sin(mid) * labelDist };

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
                style: { ...prev.lineDefaults },
              },
            ],
            angles: [
              ...prev.scene.angles,
              {
                id: angleId,
                aId: basePointId,
                bId: vertexId,
                cId: pointId,
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
