import type { SceneGeometryLayerRef, SceneModel } from "./points";

export type GeometryLayerBrowserTab = "all" | "lines" | "circles" | "angles";
export type GeometryLayerDropPosition = "before" | "after";

function angleById(scene: SceneModel, id: string) {
  return scene.angles.find((angle) => angle.id === id) ?? null;
}

export function geometryLayerKey(ref: SceneGeometryLayerRef): string {
  return `${ref.type}:${ref.id}`;
}

export function geometryLayerRefAlive(scene: SceneModel, ref: SceneGeometryLayerRef): boolean {
  if (ref.type === "segment") return scene.segments.some((segment) => segment.id === ref.id);
  if (ref.type === "line") return scene.lines.some((line) => line.id === ref.id);
  if (ref.type === "circle") return scene.circles.some((circle) => circle.id === ref.id);
  if (ref.type === "ellipse") return (scene.ellipses ?? []).some((ellipse) => ellipse.id === ref.id);
  if (ref.type === "polygon") return scene.polygons.some((polygon) => polygon.id === ref.id);
  return scene.angles.some((angle) => angle.id === ref.id);
}

export function isGeometryLayerRef(value: unknown): value is SceneGeometryLayerRef {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; id?: unknown };
  if (typeof candidate.id !== "string" || candidate.id.length === 0) return false;
  return (
    candidate.type === "segment" ||
    candidate.type === "line" ||
    candidate.type === "circle" ||
    candidate.type === "ellipse" ||
    candidate.type === "polygon" ||
    candidate.type === "angle"
  );
}

function isSectorAngleRef(scene: SceneModel, ref: SceneGeometryLayerRef): boolean {
  if (ref.type !== "angle") return false;
  return angleById(scene, ref.id)?.kind === "sector";
}

export function geometryLayerRefMatchesTab(
  scene: SceneModel,
  ref: SceneGeometryLayerRef,
  tab: GeometryLayerBrowserTab
): boolean {
  if (tab === "all") return true;
  if (tab === "lines") return ref.type === "segment" || ref.type === "line";
  if (tab === "circles") {
    return ref.type === "circle" || ref.type === "ellipse" || ref.type === "polygon" || isSectorAngleRef(scene, ref);
  }
  return ref.type === "angle" && !isSectorAngleRef(scene, ref);
}

export function getLegacyGeometryLayerOrder(scene: SceneModel): SceneGeometryLayerRef[] {
  const out: SceneGeometryLayerRef[] = [];
  for (let i = scene.angles.length - 1; i >= 0; i -= 1) {
    out.push({ type: "angle", id: scene.angles[i].id });
  }
  for (let i = scene.segments.length - 1; i >= 0; i -= 1) {
    out.push({ type: "segment", id: scene.segments[i].id });
  }
  for (let i = scene.lines.length - 1; i >= 0; i -= 1) {
    out.push({ type: "line", id: scene.lines[i].id });
  }
  for (let i = scene.polygons.length - 1; i >= 0; i -= 1) {
    out.push({ type: "polygon", id: scene.polygons[i].id });
  }
  const ellipses = scene.ellipses ?? [];
  for (let i = ellipses.length - 1; i >= 0; i -= 1) {
    out.push({ type: "ellipse", id: ellipses[i].id });
  }
  for (let i = scene.circles.length - 1; i >= 0; i -= 1) {
    out.push({ type: "circle", id: scene.circles[i].id });
  }
  return out;
}

function dedupeAliveGeometryLayerOrder(scene: SceneModel, raw: SceneGeometryLayerRef[]): SceneGeometryLayerRef[] {
  const out: SceneGeometryLayerRef[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i += 1) {
    const ref = raw[i];
    if (!isGeometryLayerRef(ref)) continue;
    if (!geometryLayerRefAlive(scene, ref)) continue;
    const key = geometryLayerKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export function normalizeGeometryLayerOrder(scene: SceneModel): SceneGeometryLayerRef[] {
  const legacy = getLegacyGeometryLayerOrder(scene);
  const raw = Array.isArray(scene.geometryLayerOrder) ? scene.geometryLayerOrder : [];
  const current = dedupeAliveGeometryLayerOrder(scene, raw);
  if (current.length === 0) return legacy;

  const next = [...current];
  const nextKeySet = new Set(next.map(geometryLayerKey));
  const indexOfKey = (key: string): number => next.findIndex((item) => geometryLayerKey(item) === key);

  for (let i = 0; i < legacy.length; i += 1) {
    const ref = legacy[i];
    const key = geometryLayerKey(ref);
    if (nextKeySet.has(key)) continue;

    let insertIdx = next.length;
    let anchored = false;

    for (let j = i - 1; j >= 0; j -= 1) {
      const prevKey = geometryLayerKey(legacy[j]);
      const idx = indexOfKey(prevKey);
      if (idx >= 0) {
        insertIdx = idx + 1;
        anchored = true;
        break;
      }
    }

    if (!anchored) {
      for (let j = i + 1; j < legacy.length; j += 1) {
        const nextKey = geometryLayerKey(legacy[j]);
        const idx = indexOfKey(nextKey);
        if (idx >= 0) {
          insertIdx = idx;
          anchored = true;
          break;
        }
      }
    }

    next.splice(insertIdx, 0, ref);
    nextKeySet.add(key);
  }

  return next;
}

export function getGeometryLayerOrder(scene: SceneModel): SceneGeometryLayerRef[] {
  return normalizeGeometryLayerOrder(scene);
}

export function geometryLayerOrderForTab(scene: SceneModel, tab: GeometryLayerBrowserTab): SceneGeometryLayerRef[] {
  return getGeometryLayerOrder(scene).filter((ref) => geometryLayerRefMatchesTab(scene, ref, tab));
}

function reorderSubset(
  subset: SceneGeometryLayerRef[],
  draggedKey: string,
  targetKey: string,
  placement: GeometryLayerDropPosition
): SceneGeometryLayerRef[] {
  const draggedIdx = subset.findIndex((ref) => geometryLayerKey(ref) === draggedKey);
  const targetIdx = subset.findIndex((ref) => geometryLayerKey(ref) === targetKey);
  if (draggedIdx < 0 || targetIdx < 0) return subset;
  const dragged = subset[draggedIdx];
  const withoutDragged = subset.filter((_, idx) => idx !== draggedIdx);
  const baseTargetIdx = withoutDragged.findIndex((ref) => geometryLayerKey(ref) === targetKey);
  if (baseTargetIdx < 0) return subset;
  const insertIdx = placement === "before" ? baseTargetIdx : baseTargetIdx + 1;
  const next = [...withoutDragged];
  next.splice(insertIdx, 0, dragged);
  return next;
}

export function moveGeometryLayerWithinTab(
  scene: SceneModel,
  dragged: SceneGeometryLayerRef,
  target: SceneGeometryLayerRef,
  tab: Exclude<GeometryLayerBrowserTab, "all">,
  placement: GeometryLayerDropPosition
): SceneGeometryLayerRef[] {
  const current = getGeometryLayerOrder(scene);
  const draggedKey = geometryLayerKey(dragged);
  const targetKey = geometryLayerKey(target);
  if (draggedKey === targetKey) return current;
  if (!geometryLayerRefMatchesTab(scene, dragged, tab) || !geometryLayerRefMatchesTab(scene, target, tab)) {
    return current;
  }

  const subset = current.filter((ref) => geometryLayerRefMatchesTab(scene, ref, tab));
  const nextSubset = reorderSubset(subset, draggedKey, targetKey, placement);
  if (
    nextSubset.length === subset.length &&
    nextSubset.every((ref, idx) => geometryLayerKey(ref) === geometryLayerKey(subset[idx]))
  ) {
    return current;
  }

  const rebuilt: SceneGeometryLayerRef[] = [];
  let subsetIdx = 0;
  for (let i = 0; i < current.length; i += 1) {
    const ref = current[i];
    if (geometryLayerRefMatchesTab(scene, ref, tab)) {
      rebuilt.push(nextSubset[subsetIdx]);
      subsetIdx += 1;
    } else {
      rebuilt.push(ref);
    }
  }
  return rebuilt;
}
