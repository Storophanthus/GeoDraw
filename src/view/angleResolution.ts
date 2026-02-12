import { computeOrientedAngleRad, getPointWorldPos, type SceneModel } from "../scene/points";
import type { ResolvedAngle } from "./labelOverlays";

export function resolveAngles(scene: SceneModel): ResolvedAngle[] {
  return scene.angles
    .map((angle) => {
      const aPoint = scene.points.find((p) => p.id === angle.aId);
      const bPoint = scene.points.find((p) => p.id === angle.bId);
      const cPoint = scene.points.find((p) => p.id === angle.cId);
      if (!aPoint || !bPoint || !cPoint) return null;
      const a = getPointWorldPos(aPoint, scene);
      const b = getPointWorldPos(bPoint, scene);
      const c = getPointWorldPos(cPoint, scene);
      if (!a || !b || !c) return null;
      const theta = computeOrientedAngleRad(a, b, c);
      if (theta === null) return null;
      return { angle, a, b, c, theta };
    })
    .filter((item): item is ResolvedAngle => Boolean(item));
}
