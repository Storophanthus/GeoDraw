import { getPointWorldPos, nextLabelFromIndex } from "../../scene/points";
import type { GeometryObjectRef, SceneModel, SceneNumberDefinition, ScenePoint, ShowLabelMode } from "../../scene/points";
import { evaluateNumberExpression } from "../../scene/points";
import type { Vec2 } from "../../geo/vec2";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type SceneCreationContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
  findExistingIntersectionPointId: (
    state: GeoState,
    objA: GeometryObjectRef,
    objB: GeometryObjectRef,
    preferredWorld: Vec2
  ) => string | null;
  getLineCircleRefs: (objA: GeometryObjectRef, objB: GeometryObjectRef) => { lineId: string; circleId: string } | null;
  createStableLineCircleIntersectionPoint: (
    id: string,
    lineId: string,
    circleId: string,
    preferredWorld: Vec2,
    state: GeoState
  ) => ScenePoint | null;
  isValidNumberDefinition: (def: SceneNumberDefinition, scene: SceneModel) => boolean;
  numberPrefixForDefinition: (def: SceneNumberDefinition) => string;
  nextAvailableNumberName: (usedNames: Set<string>, prefix: string) => string;
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

export function createSceneCreationActions(
  ctx: SceneCreationContext
): Pick<
  GeoActions,
  | "createCircle"
  | "createCircleThreePoint"
  | "createCircleFixedRadius"
  | "createPointOnLine"
  | "createPointOnSegment"
  | "createPointOnCircle"
  | "createIntersectionPoint"
  | "createNumber"
> {
  return {
    createCircle(centerId, throughId) {
      if (centerId === throughId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const c = prev.scene.points.find((p) => p.id === centerId);
        const t = prev.scene.points.find((p) => p.id === throughId);
        if (!c || !t) return prev;
        id = `c_${prev.nextCircleId}`;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: [
              ...prev.scene.circles,
              {
                id,
                kind: "twoPoint",
                centerId,
                throughId,
                visible: true,
                style: { ...prev.circleDefaults },
              },
            ],
          },
          selectedObject: { type: "circle", id },
          recentCreatedObject: { type: "circle", id },
          nextCircleId: prev.nextCircleId + 1,
        };
      });
      return id;
    },

    createCircleThreePoint(aId, bId, cId) {
      if (aId === bId || aId === cId || bId === cId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        const c = prev.scene.points.find((p) => p.id === cId);
        if (!a || !b || !c) return prev;
        const aw = getPointWorldPos(a, prev.scene);
        const bw = getPointWorldPos(b, prev.scene);
        const cw = getPointWorldPos(c, prev.scene);
        if (!aw || !bw || !cw) return prev;
        const area2 = (bw.x - aw.x) * (cw.y - aw.y) - (bw.y - aw.y) * (cw.x - aw.x);
        if (Math.abs(area2) <= 1e-9) return prev;
        id = `c_${prev.nextCircleId}`;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: [
              ...prev.scene.circles,
              {
                id,
                kind: "threePoint",
                aId,
                bId,
                cId,
                visible: true,
                style: { ...prev.circleDefaults },
              },
            ],
          },
          selectedObject: { type: "circle", id },
          recentCreatedObject: { type: "circle", id },
          nextCircleId: prev.nextCircleId + 1,
        };
      });
      return id;
    },

    createCircleFixedRadius(centerId, radiusExpr) {
      const expr = radiusExpr.trim();
      if (!expr) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const c = prev.scene.points.find((p) => p.id === centerId);
        if (!c) return prev;
        const evaluated = evaluateNumberExpression(prev.scene, expr);
        if (!evaluated.ok || !Number.isFinite(evaluated.value) || evaluated.value <= 0) return prev;
        id = `c_${prev.nextCircleId}`;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: [
              ...prev.scene.circles,
              {
                id,
                kind: "fixedRadius",
                centerId,
                radius: evaluated.value,
                radiusExpr: expr,
                visible: true,
                style: { ...prev.circleDefaults },
              },
            ],
          },
          selectedObject: { type: "circle", id },
          recentCreatedObject: { type: "circle", id },
          nextCircleId: prev.nextCircleId + 1,
        };
      });
      return id;
    },

    createPointOnLine(lineId, s) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const line = prev.scene.lines.find((item) => item.id === lineId);
        if (!line) return prev;
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
                kind: "pointOnLine",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: false,
                auxiliary: false,
                lineId,
                s,
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

    createPointOnSegment(segId, u) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const seg = prev.scene.segments.find((item) => item.id === segId);
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
                kind: "pointOnSegment",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: false,
                auxiliary: false,
                segId,
                u,
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

    createPointOnCircle(circleId, t) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const circle = prev.scene.circles.find((item) => item.id === circleId);
        if (!circle) return prev;
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
                kind: "pointOnCircle",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: false,
                auxiliary: false,
                circleId,
                t,
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

    createIntersectionPoint(objA, objB, preferredWorld) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const existingId = ctx.findExistingIntersectionPointId(prev, objA, objB, preferredWorld);
        if (existingId) {
          createdId = existingId;
          return {
            ...prev,
            selectedObject: { type: "point", id: existingId },
          };
        }

        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;
        const lineCircle = ctx.getLineCircleRefs(objA, objB);
        const lineCirclePoint =
          lineCircle &&
          ctx.createStableLineCircleIntersectionPoint(id, lineCircle.lineId, lineCircle.circleId, preferredWorld, prev);
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              lineCirclePoint ?? {
                id,
                kind: "intersectionPoint",
                name,
                captionTex: name,
                visible: true,
                showLabel: "name" as ShowLabelMode,
                locked: true,
                auxiliary: true,
                objA,
                objB,
                preferredWorld,
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

    createNumber(definition, preferredName) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        if (!ctx.isValidNumberDefinition(definition, prev.scene)) return prev;
        const usedNames = new Set(prev.scene.numbers.map((n) => n.name));
        let name: string;
        const preferred = preferredName?.trim();
        if (preferred && /^[A-Za-z_][A-Za-z0-9_]*$/.test(preferred) && !usedNames.has(preferred)) {
          name = preferred;
        } else {
          const prefix = ctx.numberPrefixForDefinition(definition);
          name = ctx.nextAvailableNumberName(usedNames, prefix);
        }
        const id = `n_${prev.nextNumberId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            numbers: [
              ...prev.scene.numbers,
              {
                id,
                name,
                visible: true,
                definition,
              },
            ],
          },
          selectedObject: { type: "number", id },
          recentCreatedObject: { type: "number", id },
          nextNumberId: prev.nextNumberId + 1,
        };
      });
      return createdId;
    },
  };
}
