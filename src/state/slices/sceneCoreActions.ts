import { getPointWorldPos, nextLabelFromIndex } from "../../scene/points";
import type { ShowLabelMode, TriangleCenterKind } from "../../scene/points";
import {
  defaultLineLabelPosWorld,
  defaultLineLabelText,
  defaultPolygonLabelPosWorld,
  defaultPolygonLabelText,
  defaultSegmentLabelPosWorld,
  defaultSegmentLabelText,
} from "../../scene/objectLabels";
import { registerLinePair, registerSegmentPair } from "../../domain/rightAngleProvenance";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type SceneCoreContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
};

function nextUnusedPointName(state: GeoState): string {
  const used = new Set(state.scene.points.map((point) => point.name));
  let idx = 0;
  let name = nextLabelFromIndex(idx);
  while (used.has(name)) {
    idx += 1;
    name = nextLabelFromIndex(idx);
  }
  return name;
}

function nextUnusedTextLabelName(state: GeoState): string {
  const used = new Set((state.scene.textLabels ?? []).map((label) => label.name));
  let idx = 1;
  let name = `T${idx}`;
  while (used.has(name)) {
    idx += 1;
    name = `T${idx}`;
  }
  return name;
}

export function createSceneCoreActions(
  ctx: SceneCoreContext
): Pick<
  GeoActions,
  | "createFreePoint"
  | "createTextLabel"
  | "createMidpointFromPoints"
  | "createMidpointFromSegment"
  | "createSegment"
  | "createLine"
  | "createPolygon"
  | "createRegularPolygon"
  | "createCircleCenterPoint"
  | "createTriangleCenterPoint"
> {
  const edgeKey = (aId: string, bId: string) => (aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`);

  return {
    createFreePoint(world) {
      let createdId = "";
      ctx.setState((prev) => {
        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "free",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: false,
                auxiliary: false,
                position: world,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createTextLabel(world) {
      let createdId = "";
      ctx.setState((prev) => {
        if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return prev;
        const name = nextUnusedTextLabelName(prev);
        const id = `txt_${prev.nextTextLabelId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: [
              ...(prev.scene.textLabels ?? []),
              {
                id,
                name,
                text: name,
                visible: true,
                positionWorld: { x: world.x, y: world.y },
                style: {
                  textColor: prev.pointDefaults.labelColor,
                  textSize: 12,
                  useTex: true,
                  rotationDeg: 0,
                },
              },
            ],
          },
          selectedObject: { type: "textLabel", id },
          recentCreatedObject: { type: "textLabel", id },
          nextTextLabelId: prev.nextTextLabelId + 1,
        };
      });
      return createdId;
    },

    createMidpointFromPoints(aId, bId) {
      if (aId === bId) return null;
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;

        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;

        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "midpointPoints",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: true,
                auxiliary: true,
                aId,
                bId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createMidpointFromSegment(segId) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const seg = prev.scene.segments.find((s) => s.id === segId);
        if (!seg) return prev;

        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;

        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "midpointSegment",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: true,
                auxiliary: true,
                segId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createSegment(aId, bId) {
      if (aId === bId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;
        id = `s_${prev.nextSegmentId}`;
        const newSegment = {
          id,
          aId,
          bId,
          visible: true,
          showLabel: false,
          labelText: defaultSegmentLabelText({ id, aId, bId, visible: true, showLabel: false, style: prev.segmentDefaults }, prev.scene),
          labelPosWorld:
            defaultSegmentLabelPosWorld({ id, aId, bId, visible: true, showLabel: false, style: prev.segmentDefaults }, prev.scene) ?? undefined,
          style: { ...prev.segmentDefaults },
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: [
              ...prev.scene.segments,
              newSegment,
            ],
          },
          selectedObject: { type: "segment", id },
          recentCreatedObject: { type: "segment", id },
          nextSegmentId: prev.nextSegmentId + 1,
        };
      });
      if (id) registerSegmentPair(id, aId, bId);
      return id;
    },

    createLine(aId, bId) {
      if (aId === bId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;
        id = `l_${prev.nextLineId}`;
        const newLine = {
          id,
          kind: "twoPoint" as const,
          aId,
          bId,
          visible: true,
          showLabel: false,
          labelText: defaultLineLabelText(
            { id, kind: "twoPoint", aId, bId, visible: true, showLabel: false, style: prev.lineDefaults },
            prev.scene
          ),
          labelPosWorld:
            defaultLineLabelPosWorld(
              { id, kind: "twoPoint", aId, bId, visible: true, showLabel: false, style: prev.lineDefaults },
              prev.scene
            ) ?? undefined,
          style: { ...prev.lineDefaults },
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: [
              ...prev.scene.lines,
              newLine,
            ],
          },
          selectedObject: { type: "line", id },
          recentCreatedObject: { type: "line", id },
          nextLineId: prev.nextLineId + 1,
        };
      });
      if (id) registerLinePair(id, aId, bId);
      return id;
    },

    createPolygon(pointIds) {
      const uniqueIds = Array.from(new Set(pointIds));
      if (uniqueIds.length < 3) return null;
      let id: string | null = null;
      let createdEdges: Array<{ id: string; aId: string; bId: string }> = [];
      ctx.setState((prev) => {
        createdEdges = [];
        for (let i = 0; i < uniqueIds.length; i += 1) {
          if (!prev.scene.points.some((p) => p.id === uniqueIds[i])) return prev;
        }
        const polygonId = `pg_${prev.nextPolygonId}`;

        const edgeIndexByKey = new Map<string, number>();
        for (let i = 0; i < prev.scene.segments.length; i += 1) {
          const seg = prev.scene.segments[i];
          edgeIndexByKey.set(edgeKey(seg.aId, seg.bId), i);
        }

        const newSegments = [...prev.scene.segments];
        let nextSegmentId = prev.nextSegmentId;
        for (let i = 0; i < uniqueIds.length; i += 1) {
          const aId = uniqueIds[i];
          const bId = uniqueIds[(i + 1) % uniqueIds.length];
          if (aId === bId) continue;
          const key = edgeKey(aId, bId);
          const existingIdx = edgeIndexByKey.get(key);
          if (existingIdx !== undefined) {
            const existingSeg = newSegments[existingIdx];
            if (Array.isArray(existingSeg.ownedByPolygonIds) && !existingSeg.ownedByPolygonIds.includes(polygonId)) {
              newSegments[existingIdx] = {
                ...existingSeg,
                ownedByPolygonIds: [...existingSeg.ownedByPolygonIds, polygonId],
              };
            }
            continue;
          }
          const segId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          const segForLabel = {
            id: segId,
            aId,
            bId,
            visible: true,
            showLabel: false,
            ownedByPolygonIds: [polygonId],
            style: prev.segmentDefaults,
          };
          newSegments.push({
            id: segId,
            aId,
            bId,
            ownedByPolygonIds: [polygonId],
            visible: true,
            showLabel: false,
            labelText: defaultSegmentLabelText(segForLabel, prev.scene),
            labelPosWorld: defaultSegmentLabelPosWorld(segForLabel, prev.scene) ?? undefined,
            style: { ...prev.segmentDefaults },
          });
          edgeIndexByKey.set(key, newSegments.length - 1);
          createdEdges.push({ id: segId, aId, bId });
        }

        id = polygonId;
        const newPolygon = {
          id,
          pointIds: uniqueIds,
          visible: true,
          showLabel: false,
          labelText: defaultPolygonLabelText({ id, pointIds: uniqueIds, visible: true, showLabel: false, style: prev.polygonDefaults }, prev.scene),
          labelPosWorld:
            defaultPolygonLabelPosWorld(
              { id, pointIds: uniqueIds, visible: true, showLabel: false, style: prev.polygonDefaults },
              prev.scene
            ) ?? undefined,
          style: { ...prev.polygonDefaults },
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: newSegments,
            polygons: [
              ...prev.scene.polygons,
              newPolygon,
            ],
          },
          selectedObject: { type: "polygon", id },
          recentCreatedObject: { type: "polygon", id },
          nextSegmentId,
          nextPolygonId: prev.nextPolygonId + 1,
        };
      });
      for (let i = 0; i < createdEdges.length; i += 1) {
        const edge = createdEdges[i];
        registerSegmentPair(edge.id, edge.aId, edge.bId);
      }
      return id;
    },

    createRegularPolygon(aId, bId, sides, direction) {
      if (aId === bId) return null;
      if (!Number.isInteger(sides) || sides < 3 || sides > 64) return null;
      if (direction !== "CCW" && direction !== "CW") return null;
      let id: string | null = null;
      let createdEdges: Array<{ id: string; aId: string; bId: string }> = [];
      ctx.setState((prev) => {
        createdEdges = [];
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;
        const aw = getPointWorldPos(a, prev.scene);
        const bw = getPointWorldPos(b, prev.scene);
        if (!aw || !bw) return prev;
        if (Math.hypot(aw.x - bw.x, aw.y - bw.y) <= 1e-12) return prev;

        const polygonId = `pg_${prev.nextPolygonId}`;
        const newPoints = [...prev.scene.points];
        const usedNames = new Set(newPoints.map((point) => point.name));
        let nextPointId = prev.nextPointId;
        // pointByRotation rotates the previous vertex around the current one.
        // To advance edge direction by orientation-selected exterior angle, we
        // rotate by interior angle and flip direction due to reversed base vector.
        const angleDeg = 180 - 360 / sides;
        const rotationDirection = direction === "CCW" ? "CW" : "CCW";
        const pointIds: string[] = [aId, bId];

        for (let i = 2; i < sides; i += 1) {
          let idx = 0;
          let name = nextLabelFromIndex(idx);
          while (usedNames.has(name)) {
            idx += 1;
            name = nextLabelFromIndex(idx);
          }
          usedNames.add(name);
          const pointId = `p_${nextPointId}`;
          nextPointId += 1;
          const centerId = pointIds[i - 1];
          const basePointId = pointIds[i - 2];
          newPoints.push({
            id: pointId,
            kind: "pointByRotation",
            name,
            captionTex: name,
            visible: true,
            showLabel: "name",
            locked: true,
            auxiliary: true,
            centerId,
            pointId: basePointId,
                angleDeg,
                direction: rotationDirection,
                radiusMode: "keep",
            style: {
              ...prev.pointDefaults,
              labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
            },
          });
          pointIds.push(pointId);
        }

        const edgeIndexByKey = new Map<string, number>();
        for (let i = 0; i < prev.scene.segments.length; i += 1) {
          const seg = prev.scene.segments[i];
          edgeIndexByKey.set(edgeKey(seg.aId, seg.bId), i);
        }

        const newSegments = [...prev.scene.segments];
        const sceneWithNewPoints = {
          ...prev.scene,
          points: newPoints,
        };
        let nextSegmentId = prev.nextSegmentId;
        for (let i = 0; i < pointIds.length; i += 1) {
          const pa = pointIds[i];
          const pb = pointIds[(i + 1) % pointIds.length];
          if (pa === pb) continue;
          const key = edgeKey(pa, pb);
          const existingIdx = edgeIndexByKey.get(key);
          if (existingIdx !== undefined) {
            const existingSeg = newSegments[existingIdx];
            if (Array.isArray(existingSeg.ownedByPolygonIds) && !existingSeg.ownedByPolygonIds.includes(polygonId)) {
              newSegments[existingIdx] = {
                ...existingSeg,
                ownedByPolygonIds: [...existingSeg.ownedByPolygonIds, polygonId],
              };
            }
            continue;
          }
          const segId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          const segForLabel = {
            id: segId,
            aId: pa,
            bId: pb,
            visible: true,
            showLabel: false,
            ownedByPolygonIds: [polygonId],
            style: prev.segmentDefaults,
          };
          newSegments.push({
            id: segId,
            aId: pa,
            bId: pb,
            ownedByPolygonIds: [polygonId],
            visible: true,
            showLabel: false,
            labelText: defaultSegmentLabelText(segForLabel, sceneWithNewPoints),
            labelPosWorld: defaultSegmentLabelPosWorld(segForLabel, sceneWithNewPoints) ?? undefined,
            style: { ...prev.segmentDefaults },
          });
          edgeIndexByKey.set(key, newSegments.length - 1);
          createdEdges.push({ id: segId, aId: pa, bId: pb });
        }

        id = polygonId;
        const polygonForLabel = {
          id: polygonId,
          pointIds,
          visible: true,
          showLabel: false,
          style: prev.polygonDefaults,
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: newPoints,
            segments: newSegments,
            polygons: [
              ...prev.scene.polygons,
              {
                id: polygonId,
                pointIds,
                visible: true,
                showLabel: false,
                labelText: defaultPolygonLabelText(polygonForLabel, sceneWithNewPoints),
                labelPosWorld: defaultPolygonLabelPosWorld(polygonForLabel, sceneWithNewPoints) ?? undefined,
                style: { ...prev.polygonDefaults },
              },
            ],
          },
          selectedObject: { type: "polygon", id: polygonId },
          recentCreatedObject: { type: "polygon", id: polygonId },
          nextPointId,
          nextSegmentId,
          nextPolygonId: prev.nextPolygonId + 1,
        };
      });
      for (let i = 0; i < createdEdges.length; i += 1) {
        const edge = createdEdges[i];
        registerSegmentPair(edge.id, edge.aId, edge.bId);
      }
      return id;
    },

    createCircleCenterPoint(circleId) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const circle = prev.scene.circles.find((c) => c.id === circleId);
        if (!circle) return prev;

        if (circle.kind !== "threePoint") {
          const center = prev.scene.points.find((p) => p.id === circle.centerId);
          if (!center) return prev;
          createdId = center.id;
          return {
            ...prev,
            selectedObject: { type: "point", id: center.id },
          };
        }

        const existing = prev.scene.points.find(
          (p) => p.kind === "circleCenter" && p.circleId === circleId
        );
        if (existing) {
          createdId = existing.id;
          return {
            ...prev,
            selectedObject: { type: "point", id: existing.id },
          };
        }

        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "circleCenter",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: true,
                auxiliary: true,
                circleId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createTriangleCenterPoint(centerKind, aId, bId, cId) {
      if (aId === bId || bId === cId || aId === cId) return null;
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        const c = prev.scene.points.find((p) => p.id === cId);
        if (!a || !b || !c) return prev;
        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "triangleCenter",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: true,
                auxiliary: true,
                centerKind: centerKind as TriangleCenterKind,
                aId,
                bId,
                cId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },
  };
}
