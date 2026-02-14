import type { Vec2 } from "../geo/vec2";
import type { SceneModel } from "../scene/points";
import type { HoveredHit } from "../state/geoStore";
import type { Camera, Viewport } from "./camera";
import type { DragBufferAccess } from "./pointerDragInteraction";
import {
  hitTestAngleId as engineHitTestAngleId,
  hitTestCircleId as engineHitTestCircleId,
  hitTestLineId as engineHitTestLineId,
  hitTestPolygonId as engineHitTestPolygonId,
  hitTestPointId as engineHitTestPointId,
  hitTestSegmentId as engineHitTestSegmentId,
} from "../engine";

type HoveredHitResolverArgs = {
  resolvedPoints: Array<{ point: SceneModel["points"][number]; world: Vec2 }>;
  resolvedAngles: Array<{
    angle: SceneModel["angles"][number];
    a: Vec2;
    b: Vec2;
    c: Vec2;
    theta: number;
  }>;
  scene: SceneModel;
  camera: Camera;
  vp: Viewport;
  tolerances: {
    point: number;
    angle: number;
    segment: number;
    line: number;
    circle: number;
  };
};

type DragBufferRefs = {
  dragPanDeltaRef: { current: Vec2 };
  dragLabelDeltaRef: { current: Vec2 };
  dragPointScreenRef: { current: Vec2 | null };
  dragPointIdRef: { current: string | null };
  dragAngleLabelScreenRef: { current: Vec2 | null };
};

export function createReadScreen(canvas: HTMLCanvasElement) {
  return (e: PointerEvent | WheelEvent): Vec2 => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
}

export function createHoveredHitResolver({
  resolvedPoints,
  resolvedAngles,
  scene,
  camera,
  vp,
  tolerances,
}: HoveredHitResolverArgs) {
  return (screen: Vec2): HoveredHit => {
    const pointId = engineHitTestPointId(screen, resolvedPoints, camera, vp, tolerances.point);
    if (pointId) return { type: "point", id: pointId };
    const polygonId = engineHitTestPolygonId(screen, scene, camera, vp, tolerances.segment);
    if (polygonId) return { type: "polygon", id: polygonId };
    const angleId = engineHitTestAngleId(screen, resolvedAngles, camera, vp, tolerances.angle);
    if (angleId) return { type: "angle", id: angleId };
    const segmentId = engineHitTestSegmentId(screen, scene, camera, vp, tolerances.segment);
    if (segmentId) return { type: "segment", id: segmentId };
    const lineId = engineHitTestLineId(screen, scene, camera, vp, tolerances.line);
    if (lineId) return { type: "line2p", id: lineId };
    const circleId = engineHitTestCircleId(screen, scene, camera, vp, tolerances.circle);
    if (circleId) return { type: "circle", id: circleId };
    return null;
  };
}

export function createDragBufferAccess({
  dragPanDeltaRef,
  dragLabelDeltaRef,
  dragPointScreenRef,
  dragPointIdRef,
  dragAngleLabelScreenRef,
}: DragBufferRefs): DragBufferAccess {
  return {
    getPanDelta: () => dragPanDeltaRef.current,
    setPanDelta: (next) => {
      dragPanDeltaRef.current = next;
    },
    getLabelDelta: () => dragLabelDeltaRef.current,
    setLabelDelta: (next) => {
      dragLabelDeltaRef.current = next;
    },
    getPointScreen: () => dragPointScreenRef.current,
    setPointScreen: (next) => {
      dragPointScreenRef.current = next;
    },
    getPointId: () => dragPointIdRef.current,
    setPointId: (next) => {
      dragPointIdRef.current = next;
    },
    getAngleLabelScreen: () => dragAngleLabelScreenRef.current,
    setAngleLabelScreen: (next) => {
      dragAngleLabelScreenRef.current = next;
    },
  };
}
