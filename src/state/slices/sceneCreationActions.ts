import { getPointWorldPos, nextLabelFromIndex } from "../../scene/points";
import type { GeometryObjectRef, ReflectionObjectRef, SceneModel, SceneNumberDefinition, ScenePoint } from "../../scene/points";
import { evaluateNumberExpression } from "../../scene/points";
import {
  defaultCircleLabelPosWorld,
  defaultCircleLabelText,
  defaultEllipseLabelPosWorld,
  defaultEllipseLabelText,
} from "../../scene/objectLabels";
import type { Vec2 } from "../../geo/vec2";
import type { SceneCreationStateLike } from "../../domain/intersectionReuse";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type SceneCreationContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
  findExistingIntersectionPointId: (
    state: SceneCreationStateLike,
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
    state: SceneCreationStateLike
  ) => ScenePoint | null;
  resolveIntersectionBranchIndex: (
    state: SceneCreationStateLike,
    objA: GeometryObjectRef,
    objB: GeometryObjectRef,
    preferredWorld: Vec2
  ) => number | null;
  resolveOtherOccupiedIntersectionPointId: (
    scene: SceneModel,
    objA: GeometryObjectRef,
    objB: GeometryObjectRef,
    preferredWorld: Vec2
  ) => string | undefined;
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
  | "createAuxiliaryCircle"
  | "createCircle"
  | "createCircleThreePoint"
  | "createCircleFixedRadius"
  | "createEllipseFociPoint"
  | "createPointOnLine"
  | "createPointOnSegment"
  | "createPointOnCircle"
  | "createPointOnEllipse"
  | "createPointByRotation"
  | "createPointByTranslation"
  | "createPointByDilation"
  | "createPointByReflection"
  | "createPointByProjection"
  | "createIntersectionPoint"
  | "createNumber"
> {
  return {
    createAuxiliaryCircle(centerId, throughId) {
      if (centerId === throughId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const c = prev.scene.points.find((p) => p.id === centerId);
        const t = prev.scene.points.find((p) => p.id === throughId);
        if (!c || !t) return prev;
        const existing = prev.scene.circles.find(
          (circle) =>
            circle.kind === "twoPoint" &&
            circle.centerId === centerId &&
            circle.throughId === throughId &&
            circle.visible === false
        );
        if (existing) {
          id = existing.id;
          return prev;
        }
        id = `c_${prev.nextCircleId}`;
        const showLabel = prev.objectLabelDefaults.circle;
        const circleForLabel = {
          id,
          kind: "twoPoint" as const,
          centerId,
          throughId,
          visible: false,
          showLabel,
          style: prev.circleDefaults,
        };
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
                visible: false,
                showLabel,
                labelGlow: prev.objectLabelDefaults.circleGlow ?? true,
                labelText: defaultCircleLabelText(circleForLabel, prev.scene),
                labelPosWorld: defaultCircleLabelPosWorld(circleForLabel, prev.scene) ?? undefined,
                style: { ...prev.circleDefaults },
              },
            ],
          },
          nextCircleId: prev.nextCircleId + 1,
        };
      });
      return id;
    },

    createCircle(centerId, throughId) {
      if (centerId === throughId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const c = prev.scene.points.find((p) => p.id === centerId);
        const t = prev.scene.points.find((p) => p.id === throughId);
        if (!c || !t) return prev;
        id = `c_${prev.nextCircleId}`;
        const showLabel = prev.objectLabelDefaults.circle;
        const circleForLabel = {
          id,
          kind: "twoPoint" as const,
          centerId,
          throughId,
          visible: true,
          showLabel,
          style: prev.circleDefaults,
        };
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
                showLabel,
                labelGlow: prev.objectLabelDefaults.circleGlow ?? true,
                labelText: defaultCircleLabelText(circleForLabel, prev.scene),
                labelPosWorld: defaultCircleLabelPosWorld(circleForLabel, prev.scene) ?? undefined,
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
        const showLabel = prev.objectLabelDefaults.circle;
        const circleForLabel = {
          id,
          kind: "threePoint" as const,
          aId,
          bId,
          cId,
          visible: true,
          showLabel,
          style: prev.circleDefaults,
        };
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
                showLabel,
                labelGlow: prev.objectLabelDefaults.circleGlow ?? true,
                labelText: defaultCircleLabelText(circleForLabel, prev.scene),
                labelPosWorld: defaultCircleLabelPosWorld(circleForLabel, prev.scene) ?? undefined,
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
        const showLabel = prev.objectLabelDefaults.circle;
        const circleForLabel = {
          id,
          kind: "fixedRadius" as const,
          centerId,
          radius: evaluated.value,
          radiusExpr: expr,
          visible: true,
          showLabel,
          style: prev.circleDefaults,
        };
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
                showLabel,
                labelGlow: prev.objectLabelDefaults.circleGlow ?? true,
                labelText: defaultCircleLabelText(circleForLabel, prev.scene),
                labelPosWorld: defaultCircleLabelPosWorld(circleForLabel, prev.scene) ?? undefined,
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

    createEllipseFociPoint(focusAId, focusBId, throughId) {
      if (focusAId === focusBId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const focusA = prev.scene.points.find((p) => p.id === focusAId);
        const focusB = prev.scene.points.find((p) => p.id === focusBId);
        const through = prev.scene.points.find((p) => p.id === throughId);
        if (!focusA || !focusB || !through) return prev;
        const aWorld = getPointWorldPos(focusA, prev.scene);
        const bWorld = getPointWorldPos(focusB, prev.scene);
        const throughWorld = getPointWorldPos(through, prev.scene);
        if (!aWorld || !bWorld || !throughWorld) return prev;
        const focusDistance = Math.hypot(bWorld.x - aWorld.x, bWorld.y - aWorld.y);
        const semiMajor = (Math.hypot(throughWorld.x - aWorld.x, throughWorld.y - aWorld.y) + Math.hypot(throughWorld.x - bWorld.x, throughWorld.y - bWorld.y)) / 2;
        if (!Number.isFinite(focusDistance) || focusDistance <= 1e-12) return prev;
        if (!Number.isFinite(semiMajor) || semiMajor <= focusDistance / 2 + 1e-9) return prev;
        id = `e_${prev.nextEllipseId}`;
        const showLabel = prev.objectLabelDefaults.ellipse;
        const ellipseForLabel = {
          id,
          kind: "fociPoint" as const,
          focusAId,
          focusBId,
          throughId,
          visible: true,
          showLabel,
          style: prev.ellipseDefaults,
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            ellipses: [
              ...(prev.scene.ellipses ?? []),
              {
                id,
                kind: "fociPoint",
                focusAId,
                focusBId,
                throughId,
                visible: true,
                showLabel,
                labelGlow: prev.objectLabelDefaults.ellipseGlow ?? true,
                labelText: defaultEllipseLabelText(ellipseForLabel, prev.scene),
                labelPosWorld: defaultEllipseLabelPosWorld(ellipseForLabel, prev.scene) ?? undefined,
                style: { ...prev.ellipseDefaults },
              },
            ],
          },
          selectedObject: { type: "ellipse", id },
          recentCreatedObject: { type: "ellipse", id },
          nextEllipseId: prev.nextEllipseId + 1,
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
                showLabel: prev.objectLabelDefaults.point,
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
                showLabel: prev.objectLabelDefaults.point,
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

    createPointOnCircle(circleId, t, options) {
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
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                circleId,
                t,
                sectorArcId: typeof options?.sectorArcId === "string" ? options.sectorArcId : undefined,
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

    createPointOnEllipse(ellipseId, t) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const ellipse = (prev.scene.ellipses ?? []).find((item) => item.id === ellipseId);
        if (!ellipse || !Number.isFinite(t)) return prev;
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
                kind: "pointOnEllipse",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                ellipseId,
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

    createPointByRotation(centerId, basePointId, angleDeg, direction, angleExpr) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        if (!Number.isFinite(angleDeg)) return prev;
        const center = prev.scene.points.find((item) => item.id === centerId);
        const base = prev.scene.points.find((item) => item.id === basePointId);
        if (!center || !base) return prev;
        const centerWorld = getPointWorldPos(center, prev.scene);
        const baseWorld = getPointWorldPos(base, prev.scene);
        if (!centerWorld || !baseWorld) return prev;
        if (Math.hypot(baseWorld.x - centerWorld.x, baseWorld.y - centerWorld.y) <= 1e-12) return prev;
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
                kind: "pointByRotation",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                centerId,
                pointId: basePointId,
                angleDeg,
                angleExpr,
                direction,
                radiusMode: "keep",
                style: {
                  ...base.style,
                  labelOffsetPx: { ...base.style.labelOffsetPx },
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

    createPointByTranslation(pointId, fromId, toId) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const point = prev.scene.points.find((item) => item.id === pointId);
        const from = prev.scene.points.find((item) => item.id === fromId);
        const to = prev.scene.points.find((item) => item.id === toId);
        if (!point || !from || !to) return prev;
        const pointWorld = getPointWorldPos(point, prev.scene);
        const fromWorld = getPointWorldPos(from, prev.scene);
        const toWorld = getPointWorldPos(to, prev.scene);
        if (!pointWorld || !fromWorld || !toWorld) return prev;
        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        const existingVector = (prev.scene.vectors ?? []).find(
          (vector) => vector.kind === "vectorFromPoints" && vector.fromId === fromId && vector.toId === toId
        );
        const vectorId = existingVector?.id ?? `v_${prev.nextVectorId}`;
        const vectors = existingVector
          ? (prev.scene.vectors ?? [])
          : [...(prev.scene.vectors ?? []), { id: vectorId, kind: "vectorFromPoints" as const, fromId, toId }];
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            vectors,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "pointByTranslation",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                pointId,
                vectorId,
                fromId,
                toId,
                style: {
                  ...point.style,
                  labelOffsetPx: { ...point.style.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
          nextVectorId: existingVector ? prev.nextVectorId : prev.nextVectorId + 1,
        };
      });
      return createdId;
    },

    createPointByDilation(pointId, centerId, factorExpr) {
      const expr = factorExpr.trim();
      if (!expr) return null;
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const point = prev.scene.points.find((item) => item.id === pointId);
        const center = prev.scene.points.find((item) => item.id === centerId);
        if (!point || !center) return prev;
        const pointWorld = getPointWorldPos(point, prev.scene);
        const centerWorld = getPointWorldPos(center, prev.scene);
        if (!pointWorld || !centerWorld) return prev;
        const evaluated = evaluateNumberExpression(prev.scene, expr);
        if (!evaluated.ok || !Number.isFinite(evaluated.value)) return prev;
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
                kind: "pointByDilation",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                pointId,
                centerId,
                factor: evaluated.value,
                factorExpr: expr,
                style: {
                  ...point.style,
                  labelOffsetPx: { ...point.style.labelOffsetPx },
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

    createPointByReflection(pointId, axis: ReflectionObjectRef) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const point = prev.scene.points.find((item) => item.id === pointId);
        if (!point) return prev;
        const axisExists = axis.type === "line"
          ? prev.scene.lines.some((line) => line.id === axis.id)
          : axis.type === "segment"
            ? prev.scene.segments.some((seg) => seg.id === axis.id)
            : axis.type === "point"
              ? prev.scene.points.some((p) => p.id === axis.id)
              : axis.aId !== axis.bId &&
                prev.scene.points.some((p) => p.id === axis.aId) &&
                prev.scene.points.some((p) => p.id === axis.bId);
        if (!axisExists) return prev;
        const pointWorld = getPointWorldPos(point, prev.scene);
        if (!pointWorld) return prev;
        if (axis.type === "pointPair") {
          const axisA = prev.scene.points.find((item) => item.id === axis.aId);
          const axisB = prev.scene.points.find((item) => item.id === axis.bId);
          if (!axisA || !axisB) return prev;
          const axisAWorld = getPointWorldPos(axisA, prev.scene);
          const axisBWorld = getPointWorldPos(axisB, prev.scene);
          if (!axisAWorld || !axisBWorld) return prev;
          if (Math.hypot(axisBWorld.x - axisAWorld.x, axisBWorld.y - axisAWorld.y) <= 1e-12) return prev;
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
                kind: "pointByReflection",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                pointId,
                axis,
                style: {
                  ...point.style,
                  labelOffsetPx: { ...point.style.labelOffsetPx },
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

    createPointByProjection(pointId, axisAId, axisBId) {
      if (axisAId === axisBId) return null;
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const point = prev.scene.points.find((item) => item.id === pointId);
        const axisA = prev.scene.points.find((item) => item.id === axisAId);
        const axisB = prev.scene.points.find((item) => item.id === axisBId);
        if (!point || !axisA || !axisB) return prev;
        const pointWorld = getPointWorldPos(point, prev.scene);
        const axisAWorld = getPointWorldPos(axisA, prev.scene);
        const axisBWorld = getPointWorldPos(axisB, prev.scene);
        if (!pointWorld || !axisAWorld || !axisBWorld) return prev;
        if (Math.hypot(axisBWorld.x - axisAWorld.x, axisBWorld.y - axisAWorld.y) <= 1e-12) return prev;
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
                kind: "pointByProjection",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                pointId,
                axisAId,
                axisBId,
                style: {
                  ...point.style,
                  labelOffsetPx: { ...point.style.labelOffsetPx },
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
        const angleA = objA.type === "angle" ? prev.scene.angles.find((angle) => angle.id === objA.id) : null;
        const angleB = objB.type === "angle" ? prev.scene.angles.find((angle) => angle.id === objB.id) : null;
        // Plain angle marks are not geometric loci; only sector arcs are intersectable.
        if ((angleA && angleA.kind !== "sector") || (angleB && angleB.kind !== "sector")) {
          return prev;
        }

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
        const segmentCircle =
          (objA.type === "segment" && objB.type === "circle")
            ? { segId: objA.id, circleId: objB.id }
            : (objA.type === "circle" && objB.type === "segment")
              ? { segId: objB.id, circleId: objA.id }
              : null;
        const circleCircle =
          (objA.type === "circle" && objB.type === "circle")
            ? { circleAId: objA.id, circleBId: objB.id }
            : null;
        const lineLikeLike =
          ((objA.type === "line" || objA.type === "segment") && (objB.type === "line" || objB.type === "segment"))
            ? { objA, objB }
            : null;
        const lineCirclePoint =
          lineCircle &&
          ctx.createStableLineCircleIntersectionPoint(id, lineCircle.lineId, lineCircle.circleId, preferredWorld, prev);
        const genericBranchIndex = lineCirclePoint
          ? undefined
          : ctx.resolveIntersectionBranchIndex(prev, objA, objB, preferredWorld) ?? undefined;
        const genericExcludePointId = lineCirclePoint
          ? undefined
          : ctx.resolveOtherOccupiedIntersectionPointId(prev.scene, objA, objB, preferredWorld);
        const segmentCircleBranch: 0 | 1 = genericBranchIndex === 1 ? 1 : 0;
        const segmentCirclePoint = !lineCirclePoint && segmentCircle
          ? {
              id,
              kind: "circleSegmentIntersectionPoint" as const,
              name,
              captionTex: name,
              visible: true,
              showLabel: prev.objectLabelDefaults.point,
              locked: true,
              auxiliary: true,
              circleId: segmentCircle.circleId,
              segId: segmentCircle.segId,
              branchIndex: segmentCircleBranch,
              excludePointId: genericExcludePointId,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            }
          : null;
        const circleCirclePoint = !lineCirclePoint && !segmentCirclePoint && circleCircle
          ? {
              id,
              kind: "circleCircleIntersectionPoint" as const,
              name,
              captionTex: name,
              visible: true,
              showLabel: prev.objectLabelDefaults.point,
              locked: true,
              auxiliary: true,
              circleAId: circleCircle.circleAId,
              circleBId: circleCircle.circleBId,
              branchIndex: segmentCircleBranch,
              excludePointId: genericExcludePointId,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            }
          : null;
        const lineLikePoint = !lineCirclePoint && !segmentCirclePoint && !circleCirclePoint && lineLikeLike
          ? {
              id,
              kind: "lineLikeIntersectionPoint" as const,
              name,
              captionTex: name,
              visible: true,
              showLabel: prev.objectLabelDefaults.point,
              locked: true,
              auxiliary: true,
              objA: lineLikeLike.objA,
              objB: lineLikeLike.objB,
              preferredWorld,
              style: {
                ...prev.pointDefaults,
                labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
              },
            }
          : null;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              lineCirclePoint ?? segmentCirclePoint ?? circleCirclePoint ?? lineLikePoint ?? {
                id,
                kind: "intersectionPoint",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: true,
                auxiliary: true,
                objA,
                objB,
                branchIndex: genericBranchIndex,
                excludePointId: genericExcludePointId,
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
