import type { Vec2 } from "../geo/vec2";
import { constructFromClick, hitTestPointId, hitTestSegmentId, hitTestTopObject } from "../engine";
import type { ActiveTool, PendingSelection } from "../state/geoStore";
import { camera as camMath, type Camera, type Viewport } from "./camera";
import { findBestSnap } from "./snapEngine";
import type { SceneModel } from "../scene/points";

type ConstructFromClickArgs = Parameters<typeof constructFromClick>[0];
export type ConstructClickIo = Omit<
  ConstructFromClickArgs["io"],
  "angleFixedTool" | "regularPolygonTool" | "camera" | "vp"
>;

type RunConstructClickParams = {
  screen: Vec2;
  pointerEvent: PointerEvent;
  activeTool: ActiveTool;
  pendingSelection: PendingSelection;
  copyStyleSource: { type: "point" | "line" | "segment" | "circle" | "polygon" | "angle" | "number"; id: string } | null;
  scene: SceneModel;
  resolvedPoints: Array<{ point: SceneModel["points"][number]; world: Vec2 }>;
  camera: Camera;
  vp: Viewport;
  angleFixedTool: ConstructFromClickArgs["io"]["angleFixedTool"];
  regularPolygonTool: ConstructFromClickArgs["io"]["regularPolygonTool"];
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
    regularPolygonTool,
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
  const cursorWorld = camMath.screenToWorld(screen, camera, vp);
  const snappedWorld =
    !pointerEvent.shiftKey && io.gridSnapEnabled
      ? io.snapWorldToGrid(cursorWorld)
      : null;
  const snappedScreen = snappedWorld ? camMath.worldToScreen(snappedWorld, camera, vp) : null;
  const rawHitPointId = hitTestPointId(screen, resolvedPoints, camera, vp, tolerances.point);
  const snappedHitPointId = snappedScreen ? hitTestPointId(snappedScreen, resolvedPoints, camera, vp, tolerances.point) : null;

  let snap =
    !pointerEvent.shiftKey && activeTool !== "move" && activeTool !== "copyStyle"
      ? findBestSnap(screen, camera, vp, scene, tolerances.point)
      : null;
  if (snappedHitPointId && (!snap || snap.kind !== "point")) {
    const pointWorld = io.getPointWorldById(snappedHitPointId) ?? snappedWorld ?? cursorWorld;
    const screenDistPx = snappedScreen ? Math.hypot(screen.x - snappedScreen.x, screen.y - snappedScreen.y) : 0;
    snap = {
      kind: "point",
      pointId: snappedHitPointId,
      world: pointWorld,
      screenDistPx,
    };
  }

  constructFromClick({
    screen,
    activeTool,
    pendingSelection,
    hits: {
      hitPointId: rawHitPointId ?? snappedHitPointId,
      hitSegmentId: hitTestSegmentId(screen, scene, camera, vp, tolerances.segment),
      hitObject,
      shiftKey: pointerEvent.shiftKey,
      hasCopyStyleSource: Boolean(copyStyleSource),
      snap,
    },
    io: {
      ...io,
      angleFixedTool,
      regularPolygonTool,
      camera,
      vp,
    },
  });
}
