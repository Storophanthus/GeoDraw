import { nextLabelFromIndex } from "../../scene/points";
import type { ShowLabelMode } from "../../scene/points";
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
): Pick<GeoActions, "createFreePoint" | "createMidpointFromPoints" | "createMidpointFromSegment" | "createSegment" | "createLine"> {
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
      return id;
    },
  };
}
