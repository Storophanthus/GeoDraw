import type { Vec2 } from "../geo/vec2";
import {
  getPointWorldPos,
  resolveTextLabelDisplayText,
  type SceneModel,
} from "../scene/points";
import {
  defaultObjectLabelPosWorld,
  defaultObjectLabelText,
  resolveObjectLabelText,
  type LabelableObjectType,
} from "../scene/objectLabels";

export type PreviewLabelTargetType =
  | "point"
  | LabelableObjectType
  | "angle"
  | "text"
  | "richText";

export type PreviewLabelTarget = {
  key: string;
  id: string;
  type: PreviewLabelTargetType;
  text: string;
  kindLabel: string;
};

export type PreviewLabelArea = {
  viewport?: { xmin: number; xmax: number; ymin: number; ymax: number };
  clipRectWorld?: { xmin: number; xmax: number; ymin: number; ymax: number };
  clipPolygonWorld?: Vec2[];
  screenPxPerWorld?: number;
};

type PositionedTarget = PreviewLabelTarget & { positionWorld: Vec2 | null };

const targetKey = (type: PreviewLabelTargetType, id: string): string => `${type}:${id}`;

export function listPreviewLabelTargets(
  scene: SceneModel,
  area: PreviewLabelArea = {}
): PreviewLabelTarget[] {
  const targets: PositionedTarget[] = [];
  const pointNameById = new Map(scene.points.map((point) => [point.id, point.name]));
  const pointName = (id: string): string => pointNameById.get(id) ?? id;
  const pxPerWorld = Math.max(1e-6, Math.abs(area.screenPxPerWorld ?? 80));

  for (const point of scene.points) {
    if (!point.visible || point.showLabel === "none") continue;
    const text = point.showLabel === "caption" ? point.captionTex : point.name;
    if (!text.trim()) continue;
    const anchor = getPointWorldPos(point, scene);
    targets.push({
      key: targetKey("point", point.id),
      id: point.id,
      type: "point",
      text,
      kindLabel: "Point",
      positionWorld: anchor
        ? {
            x: anchor.x + point.style.labelOffsetPx.x / pxPerWorld,
            y: anchor.y - point.style.labelOffsetPx.y / pxPerWorld,
          }
        : null,
    });
  }

  const addObjectTargets = <T extends { id: string; visible: boolean; showLabel?: boolean; labelText?: string; labelPosWorld?: Vec2 }>(
    type: LabelableObjectType,
    items: T[],
    kindLabel: string
  ) => {
    for (const item of items) {
      if (!item.visible || item.showLabel !== true) continue;
      const fallbackText = defaultObjectLabelText({ type, id: item.id }, scene);
      const text = resolveObjectLabelText(item.labelText, fallbackText);
      if (!text.trim()) continue;
      targets.push({
        key: targetKey(type, item.id),
        id: item.id,
        type,
        text,
        kindLabel,
        positionWorld:
          item.labelPosWorld ?? defaultObjectLabelPosWorld({ type, id: item.id }, scene),
      });
    }
  };

  addObjectTargets("segment", scene.segments, "Segment");
  addObjectTargets("line", scene.lines, "Line");
  addObjectTargets("circle", scene.circles, "Circle");
  addObjectTargets("ellipse", scene.ellipses ?? [], "Ellipse");
  addObjectTargets("polygon", scene.polygons, "Polygon");

  for (const angle of scene.angles) {
    const customText = angle.style.labelText.trim();
    const rendersText =
      (angle.style.showLabel && customText.length > 0) || angle.style.showValue;
    if (!angle.visible || !rendersText) continue;
    const angleName = `∠${pointName(angle.aId)}${pointName(angle.bId)}${pointName(angle.cId)}`;
    targets.push({
      key: targetKey("angle", angle.id),
      id: angle.id,
      type: "angle",
      text: customText || angleName,
      kindLabel: angle.kind === "sector" ? "Sector" : "Angle",
      positionWorld: angle.style.labelPosWorld,
    });
  }

  for (const label of scene.textLabels ?? []) {
    if (!label.visible) continue;
    const text = resolveTextLabelDisplayText(label, scene).trim();
    if (!text) continue;
    targets.push({
      key: targetKey("text", label.id),
      id: label.id,
      type: "text",
      text,
      kindLabel: label.toolKind === "textbox" ? "Textbox" : "Text",
      positionWorld: label.positionWorld,
    });
  }

  for (const label of scene.richTextNodes ?? []) {
    if (!label.visible) continue;
    targets.push({
      key: targetKey("richText", label.id),
      id: label.id,
      type: "richText",
      text: label.name.trim() || "Rich text",
      kindLabel: "Rich text",
      positionWorld: label.positionWorld,
    });
  }

  return targets
    .filter((target) => target.positionWorld && isInsideLabelArea(target.positionWorld, area))
    .map(({ positionWorld: _positionWorld, ...target }) => target);
}

export function nudgePreviewLabel(
  scene: SceneModel,
  target: PreviewLabelTarget,
  deltaScreenPx: Vec2,
  screenPxPerWorld: number
): SceneModel {
  if (!Number.isFinite(deltaScreenPx.x) || !Number.isFinite(deltaScreenPx.y)) return scene;
  if (target.type === "point") {
    return {
      ...scene,
      points: scene.points.map((point) =>
        point.id === target.id
          ? {
              ...point,
              style: {
                ...point.style,
                labelOffsetPx: {
                  x: point.style.labelOffsetPx.x + deltaScreenPx.x,
                  y: point.style.labelOffsetPx.y + deltaScreenPx.y,
                },
              },
            }
          : point
      ),
    };
  }

  const density = Math.max(1e-6, Math.abs(screenPxPerWorld));
  const deltaWorld = {
    x: deltaScreenPx.x / density,
    y: -deltaScreenPx.y / density,
  };

  if (target.type === "angle") {
    return {
      ...scene,
      angles: scene.angles.map((angle) =>
        angle.id === target.id
          ? {
              ...angle,
              style: {
                ...angle.style,
                labelPosWorld: addWorldDelta(angle.style.labelPosWorld, deltaWorld),
              },
            }
          : angle
      ),
    };
  }

  if (target.type === "text") {
    return {
      ...scene,
      textLabels: (scene.textLabels ?? []).map((label) =>
        label.id === target.id
          ? { ...label, positionWorld: addWorldDelta(label.positionWorld, deltaWorld) }
          : label
      ),
    };
  }

  if (target.type === "richText") {
    return {
      ...scene,
      richTextNodes: (scene.richTextNodes ?? []).map((label) =>
        label.id === target.id
          ? { ...label, positionWorld: addWorldDelta(label.positionWorld, deltaWorld) }
          : label
      ),
    };
  }

  const fallback = defaultObjectLabelPosWorld({ type: target.type, id: target.id }, scene);
  return updateObjectLabelPosition(scene, target.type, target.id, (current) => {
    const position = current ?? fallback;
    return position ? addWorldDelta(position, deltaWorld) : current;
  });
}

export function resetPreviewLabel(
  scene: SceneModel,
  originalScene: SceneModel,
  target: PreviewLabelTarget
): SceneModel {
  if (target.type === "point") {
    const original = originalScene.points.find((point) => point.id === target.id);
    if (!original) return scene;
    return {
      ...scene,
      points: scene.points.map((point) =>
        point.id === target.id
          ? {
              ...point,
              style: { ...point.style, labelOffsetPx: { ...original.style.labelOffsetPx } },
            }
          : point
      ),
    };
  }

  if (target.type === "angle") {
    const original = originalScene.angles.find((angle) => angle.id === target.id);
    if (!original) return scene;
    return {
      ...scene,
      angles: scene.angles.map((angle) =>
        angle.id === target.id
          ? {
              ...angle,
              style: { ...angle.style, labelPosWorld: { ...original.style.labelPosWorld } },
            }
          : angle
      ),
    };
  }

  if (target.type === "text") {
    const original = (originalScene.textLabels ?? []).find((label) => label.id === target.id);
    if (!original) return scene;
    return {
      ...scene,
      textLabels: (scene.textLabels ?? []).map((label) =>
        label.id === target.id
          ? { ...label, positionWorld: { ...original.positionWorld } }
          : label
      ),
    };
  }

  if (target.type === "richText") {
    const original = (originalScene.richTextNodes ?? []).find((label) => label.id === target.id);
    if (!original) return scene;
    return {
      ...scene,
      richTextNodes: (scene.richTextNodes ?? []).map((label) =>
        label.id === target.id
          ? { ...label, positionWorld: { ...original.positionWorld } }
          : label
      ),
    };
  }

  const original = objectWithLabel(originalScene, target.type, target.id);
  if (!original) return scene;
  return updateObjectLabelPosition(scene, target.type, target.id, () =>
    original.labelPosWorld ? { ...original.labelPosWorld } : undefined
  );
}

function addWorldDelta(position: Vec2, delta: Vec2): Vec2 {
  return { x: position.x + delta.x, y: position.y + delta.y };
}

function objectWithLabel(scene: SceneModel, type: LabelableObjectType, id: string) {
  if (type === "segment") return scene.segments.find((item) => item.id === id);
  if (type === "line") return scene.lines.find((item) => item.id === id);
  if (type === "circle") return scene.circles.find((item) => item.id === id);
  if (type === "ellipse") return (scene.ellipses ?? []).find((item) => item.id === id);
  return scene.polygons.find((item) => item.id === id);
}

function updateObjectLabelPosition(
  scene: SceneModel,
  type: LabelableObjectType,
  id: string,
  update: (current: Vec2 | undefined) => Vec2 | undefined
): SceneModel {
  if (type === "segment") {
    return {
      ...scene,
      segments: scene.segments.map((item) =>
        item.id === id ? { ...item, labelPosWorld: update(item.labelPosWorld) } : item
      ),
    };
  }
  if (type === "line") {
    return {
      ...scene,
      lines: scene.lines.map((item) =>
        item.id === id ? { ...item, labelPosWorld: update(item.labelPosWorld) } : item
      ),
    };
  }
  if (type === "circle") {
    return {
      ...scene,
      circles: scene.circles.map((item) =>
        item.id === id ? { ...item, labelPosWorld: update(item.labelPosWorld) } : item
      ),
    };
  }
  if (type === "ellipse") {
    return {
      ...scene,
      ellipses: (scene.ellipses ?? []).map((item) =>
        item.id === id ? { ...item, labelPosWorld: update(item.labelPosWorld) } : item
      ),
    };
  }
  return {
    ...scene,
    polygons: scene.polygons.map((item) =>
      item.id === id ? { ...item, labelPosWorld: update(item.labelPosWorld) } : item
    ),
  };
}

function isInsideLabelArea(position: Vec2, area: PreviewLabelArea): boolean {
  if (area.viewport && !pointInRect(position, area.viewport)) return false;
  if (area.clipRectWorld && !pointInRect(position, area.clipRectWorld)) return false;
  if (
    area.clipPolygonWorld &&
    area.clipPolygonWorld.length >= 3 &&
    !pointInPolygon(position, area.clipPolygonWorld)
  ) {
    return false;
  }
  return true;
}

function pointInRect(
  point: Vec2,
  rect: { xmin: number; xmax: number; ymin: number; ymax: number }
): boolean {
  const eps = 1e-9;
  return (
    point.x >= Math.min(rect.xmin, rect.xmax) - eps &&
    point.x <= Math.max(rect.xmin, rect.xmax) + eps &&
    point.y >= Math.min(rect.ymin, rect.ymax) - eps &&
    point.y <= Math.max(rect.ymin, rect.ymax) + eps
  );
}

function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (pointOnSegment(point, a, b)) return true;
    const crosses =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointOnSegment(point: Vec2, a: Vec2, b: Vec2): boolean {
  const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
  if (Math.abs(cross) > 1e-8) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -1e-8) return false;
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= lengthSq + 1e-8;
}
