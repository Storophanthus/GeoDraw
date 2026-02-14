import { nextLabelFromIndex } from "../../scene/points";
import type { ShowLabelMode } from "../../scene/points";
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

export function createSceneCoreActions(
  ctx: SceneCoreContext
): Pick<
  GeoActions,
  | "createFreePoint"
  | "createMidpointFromPoints"
  | "createMidpointFromSegment"
  | "createSegment"
  | "createLine"
  | "createPolygon"
  | "createCircleCenterPoint"
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
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: [
              ...prev.scene.segments,
              {
                id,
                aId,
                bId,
                visible: true,
                showLabel: false,
                style: { ...prev.segmentDefaults },
              },
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
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: [
              ...prev.scene.lines,
              {
                id,
                kind: "twoPoint",
                aId,
                bId,
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

        const existingEdgeKeys = new Set<string>();
        for (let i = 0; i < prev.scene.segments.length; i += 1) {
          const seg = prev.scene.segments[i];
          existingEdgeKeys.add(edgeKey(seg.aId, seg.bId));
        }

        const newSegments = [...prev.scene.segments];
        let nextSegmentId = prev.nextSegmentId;
        for (let i = 0; i < uniqueIds.length; i += 1) {
          const aId = uniqueIds[i];
          const bId = uniqueIds[(i + 1) % uniqueIds.length];
          if (aId === bId) continue;
          const key = edgeKey(aId, bId);
          if (existingEdgeKeys.has(key)) continue;
          existingEdgeKeys.add(key);
          const segId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          newSegments.push({
            id: segId,
            aId,
            bId,
            visible: true,
            showLabel: false,
            style: { ...prev.segmentDefaults },
          });
          createdEdges.push({ id: segId, aId, bId });
        }

        id = `pg_${prev.nextPolygonId}`;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: newSegments,
            polygons: [
              ...prev.scene.polygons,
              {
                id,
                pointIds: uniqueIds,
                visible: true,
                style: { ...prev.polygonDefaults },
              },
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
  };
}
