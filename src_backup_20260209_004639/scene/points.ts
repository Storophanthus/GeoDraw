import type { Vec2 } from "../geo/vec2";

export type PointShape =
  | "circle"
  | "x"
  | "plus"
  | "cross"
  | "diamond"
  | "square"
  | "triUp"
  | "triDown"
  | "dot";

export type PointStyle = {
  shape: PointShape;
  sizePx: number;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  labelFontPx: number;
  labelHaloWidthPx: number;
  labelHaloColor: string;
  labelColor: string;
  labelOffsetPx: Vec2;
};

export type LineStyle = {
  strokeColor: string;
  strokeWidth: number;
  dash: "solid" | "dashed";
  opacity: number;
};

export type ShowLabelMode = "none" | "name" | "caption";

export type FreePoint = {
  id: string;
  kind: "free";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  position: Vec2;
  style: PointStyle;
};

export type MidpointFromPoints = {
  id: string;
  kind: "midpointPoints";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  aId: string;
  bId: string;
  style: PointStyle;
};

export type MidpointFromSegment = {
  id: string;
  kind: "midpointSegment";
  name: string;
  captionTex: string;
  visible: boolean;
  showLabel: ShowLabelMode;
  locked?: boolean;
  auxiliary?: boolean;
  segId: string;
  style: PointStyle;
};

export type ScenePoint = FreePoint | MidpointFromPoints | MidpointFromSegment;

export type SceneSegment = {
  id: string;
  aId: string;
  bId: string;
  visible: boolean;
  showLabel: boolean;
  style: LineStyle;
};

export type SceneLine = {
  id: string;
  aId: string;
  bId: string;
  visible: boolean;
  style: LineStyle;
};

export type SceneModel = {
  points: ScenePoint[];
  segments: SceneSegment[];
  lines: SceneLine[];
};

export function nextLabelFromIndex(index: number): string {
  const letterIndex = index % 26;
  const cycle = Math.floor(index / 26);
  const letter = String.fromCharCode(65 + letterIndex);
  if (cycle === 0) return letter;
  return `${letter}_${cycle}`;
}

export function isNameUnique(
  name: string,
  existingNames: Iterable<string>,
  ignoreName?: string
): boolean {
  for (const existing of existingNames) {
    if (existing === ignoreName) continue;
    if (existing === name) return false;
  }
  return true;
}

export function isValidPointName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

export function getPointWorldPos(
  point: ScenePoint,
  scene: SceneModel,
  visited: Set<string> = new Set()
): Vec2 | null {
  if (visited.has(point.id)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(point.id);

  if (point.kind === "free") return point.position;

  if (point.kind === "midpointPoints") {
    const a = scene.points.find((item) => item.id === point.aId);
    const b = scene.points.find((item) => item.id === point.bId);
    if (!a || !b) return null;
    const pa = getPointWorldPos(a, scene, nextVisited);
    const pb = getPointWorldPos(b, scene, nextVisited);
    if (!pa || !pb) return null;
    return { x: (pa.x + pb.x) * 0.5, y: (pa.y + pb.y) * 0.5 };
  }

  const seg = scene.segments.find((item) => item.id === point.segId);
  if (!seg) return null;
  const a = scene.points.find((item) => item.id === seg.aId);
  const b = scene.points.find((item) => item.id === seg.bId);
  if (!a || !b) return null;
  const pa = getPointWorldPos(a, scene, nextVisited);
  const pb = getPointWorldPos(b, scene, nextVisited);
  if (!pa || !pb) return null;
  return { x: (pa.x + pb.x) * 0.5, y: (pa.y + pb.y) * 0.5 };
}

export function isPointDraggable(point: ScenePoint): boolean {
  return point.kind === "free" && !point.locked;
}

export function movePoint(point: ScenePoint, world: Vec2): ScenePoint {
  if (point.kind !== "free") return point;
  if (point.locked) return point;
  return { ...point, position: world };
}
