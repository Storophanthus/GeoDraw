import type { Vec2 } from "../geo/vec2";
import {
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getNumberValue,
  getPointWorldPos,
  type SceneModel,
} from "../scene/points";

export const geoStoreHelpers = {
  getPointWorldById(scene: SceneModel, pointId: string): Vec2 | null {
    const point = scene.points.find((p) => p.id === pointId);
    if (!point) return null;
    return getPointWorldPos(point, scene);
  },
  getLineWorldAnchorsById(scene: SceneModel, lineId: string): { a: Vec2; b: Vec2 } | null {
    const line = scene.lines.find((item) => item.id === lineId);
    if (!line) return null;
    return getLineWorldAnchors(line, scene);
  },
  getCircleWorldGeometryById(scene: SceneModel, circleId: string): { center: Vec2; radius: number } | null {
    const circle = scene.circles.find((item) => item.id === circleId);
    if (!circle) return null;
    return getCircleWorldGeometry(circle, scene);
  },
  getNumberValueById(scene: SceneModel, numberId: string): number | null {
    return getNumberValue(numberId, scene);
  },
};
