import type { Vec2 } from "../geo/vec2";
import { constructFromClick, hitTestPointId, hitTestSegmentId, hitTestTopObject } from "../engine";
import type { ActiveTool, PendingSelection } from "../state/geoStore";
import type { Camera, Viewport } from "./camera";
import { findBestSnap } from "./snapEngine";
import type { SceneModel } from "../scene/points";

type ConstructFromClickArgs = Parameters<typeof constructFromClick>[0];
export type ConstructClickIo = Omit<ConstructFromClickArgs["io"], "angleFixedTool" | "camera" | "vp">;

type RunConstructClickParams = {
  screen: Vec2;
  pointerEvent: PointerEvent;
  activeTool: ActiveTool;
  pendingSelection: PendingSelection;
  copyStyleSource: { type: "point" | "line" | "segment" | "circle" | "angle" | "number"; id: string } | null;
  scene: SceneModel;
  resolvedPoints: Array<{ point: SceneModel["points"][number]; world: Vec2 }>;
  camera: Camera;
  vp: Viewport;
  angleFixedTool: ConstructFromClickArgs["io"]["angleFixedTool"];
  tolerances: {
    point: number;
    angle: number;
    segment: number;
    line: number;
    circle: number;
  };
  io: ConstructClickIo;
};

export function runConstructClickAdapter(params: RunConstructClickParams): void {
  const {
    screen,
    pointerEvent,
    activeTool,
    pendingSelection,
    copyStyleSource,
    scene,
    resolvedPoints,
    camera,
    vp,
    angleFixedTool,
    tolerances,
    io,
  } = params;

  const hitObject = hitTestTopObject(scene, camera, vp, screen, {
    pointTolPx: tolerances.point,
    angleTolPx: tolerances.angle,
    segmentTolPx: tolerances.segment,
    lineTolPx: tolerances.line,
    circleTolPx: tolerances.circle,
  });
  const snap =
    !pointerEvent.shiftKey && activeTool !== "move" && activeTool !== "copyStyle"
      ? findBestSnap(screen, camera, vp, scene, tolerances.point)
      : null;

  constructFromClick({
    screen,
    activeTool,
    pendingSelection,
    hits: {
      hitPointId: hitTestPointId(screen, resolvedPoints, camera, vp, tolerances.point),
      hitSegmentId: hitTestSegmentId(screen, scene, camera, vp, tolerances.segment),
      hitObject,
      shiftKey: pointerEvent.shiftKey,
      hasCopyStyleSource: Boolean(copyStyleSource),
      snap,
    },
    io: {
      ...io,
      angleFixedTool,
      camera,
      vp,
    },
  });
}
