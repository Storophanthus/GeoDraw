import {
  getLineWorldAnchors,
  getPointWorldPos,
  isRightAngle,
  type LineLikeObjectRef,
  type SceneAngle,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";

type PairEntry = {
  lineId?: string;
  segmentId?: string;
};

const pairIndex = new Map<string, PairEntry>();
const reverseLinePair = new Map<string, string>();
const reverseSegmentPair = new Map<string, string>();
const perpendicularAdj = new Map<string, Set<string>>();
const APPROX_RIGHT_EPS = 1e-15;

export type AngleRightStatus = "none" | "approx" | "exact";

function pairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

function refKey(ref: LineLikeObjectRef): string {
  return `${ref.type}:${ref.id}`;
}

function addPerpendicularEdge(a: LineLikeObjectRef, b: LineLikeObjectRef): void {
  const ak = refKey(a);
  const bk = refKey(b);
  if (ak === bk) return;
  let as = perpendicularAdj.get(ak);
  if (!as) {
    as = new Set<string>();
    perpendicularAdj.set(ak, as);
  }
  as.add(bk);
  let bs = perpendicularAdj.get(bk);
  if (!bs) {
    bs = new Set<string>();
    perpendicularAdj.set(bk, bs);
  }
  bs.add(ak);
}

function removePerpendicularKey(key: string): void {
  const neighbors = perpendicularAdj.get(key);
  if (!neighbors) return;
  for (const n of neighbors) {
    const ns = perpendicularAdj.get(n);
    if (ns) {
      ns.delete(key);
      if (ns.size === 0) perpendicularAdj.delete(n);
    }
  }
  perpendicularAdj.delete(key);
}

export function clearRightAngleProvenance(): void {
  pairIndex.clear();
  reverseLinePair.clear();
  reverseSegmentPair.clear();
  perpendicularAdj.clear();
}

export function registerLinePair(lineId: string, aId: string, bId: string): void {
  const key = pairKey(aId, bId);
  const prevKey = reverseLinePair.get(lineId);
  if (prevKey && prevKey !== key) {
    const prevEntry = pairIndex.get(prevKey);
    if (prevEntry?.lineId === lineId) {
      delete prevEntry.lineId;
      if (!prevEntry.segmentId) pairIndex.delete(prevKey);
    }
  }
  const entry = pairIndex.get(key) ?? {};
  entry.lineId = lineId;
  pairIndex.set(key, entry);
  reverseLinePair.set(lineId, key);
}

export function registerSegmentPair(segmentId: string, aId: string, bId: string): void {
  const key = pairKey(aId, bId);
  const prevKey = reverseSegmentPair.get(segmentId);
  if (prevKey && prevKey !== key) {
    const prevEntry = pairIndex.get(prevKey);
    if (prevEntry?.segmentId === segmentId) {
      delete prevEntry.segmentId;
      if (!prevEntry.lineId) pairIndex.delete(prevKey);
    }
  }
  const entry = pairIndex.get(key) ?? {};
  entry.segmentId = segmentId;
  pairIndex.set(key, entry);
  reverseSegmentPair.set(segmentId, key);
}

export function unregisterLineLike(ref: LineLikeObjectRef): void {
  const key = ref.type === "line" ? reverseLinePair.get(ref.id) : reverseSegmentPair.get(ref.id);
  if (key) {
    const entry = pairIndex.get(key);
    if (entry) {
      if (ref.type === "line" && entry.lineId === ref.id) delete entry.lineId;
      if (ref.type === "segment" && entry.segmentId === ref.id) delete entry.segmentId;
      if (!entry.lineId && !entry.segmentId) pairIndex.delete(key);
      else pairIndex.set(key, entry);
    }
  }
  if (ref.type === "line") reverseLinePair.delete(ref.id);
  else reverseSegmentPair.delete(ref.id);
  removePerpendicularKey(refKey(ref));
}

export function registerPerpendicularRelation(lineId: string, base: LineLikeObjectRef): void {
  addPerpendicularEdge({ type: "line", id: lineId }, base);
}

function expandedRefKeys(ref: LineLikeObjectRef): string[] {
  const keys = [refKey(ref)];
  const key =
    ref.type === "line" ? reverseLinePair.get(ref.id) : reverseSegmentPair.get(ref.id);
  if (!key) return keys;
  const entry = pairIndex.get(key);
  if (!entry) return keys;
  if (ref.type === "line" && entry.segmentId) keys.push(`segment:${entry.segmentId}`);
  if (ref.type === "segment" && entry.lineId) keys.push(`line:${entry.lineId}`);
  return keys;
}

export function arePerpendicularByProvenance(a: LineLikeObjectRef, b: LineLikeObjectRef): boolean {
  const aKeys = expandedRefKeys(a);
  const bKeys = expandedRefKeys(b);
  for (const ak of aKeys) {
    const neighbors = perpendicularAdj.get(ak);
    if (!neighbors) continue;
    for (const bk of bKeys) {
      if (neighbors.has(bk)) return true;
    }
  }
  return false;
}

function resolveRaySupport(scene: SceneModel, vertexId: string, otherId: string): LineLikeObjectRef | null {
  const other = scene.points.find((point) => point.id === otherId) as ScenePoint | undefined;
  if (other?.kind === "pointOnLine") return { type: "line", id: other.lineId };
  if (other?.kind === "pointOnSegment") return { type: "segment", id: other.segId };
  const vertex = scene.points.find((point) => point.id === vertexId) as ScenePoint | undefined;
  if (vertex?.kind === "intersectionPoint") {
    const refs: LineLikeObjectRef[] = [];
    if (vertex.objA.type === "line" || vertex.objA.type === "segment") refs.push(vertex.objA);
    if (vertex.objB.type === "line" || vertex.objB.type === "segment") refs.push(vertex.objB);
    for (const ref of refs) {
      if (isPointOnLineLike(scene, otherId, ref)) return ref;
    }
  }
  const entry = pairIndex.get(pairKey(vertexId, otherId));
  if (!entry) return null;
  if (entry.lineId) return { type: "line", id: entry.lineId };
  if (entry.segmentId) return { type: "segment", id: entry.segmentId };
  return null;
}

export function isRightExactByProvenance(scene: SceneModel, aId: string, bId: string, cId: string): boolean {
  const left = resolveRaySupport(scene, bId, aId);
  if (!left) return false;
  const right = resolveRaySupport(scene, bId, cId);
  if (!right) return false;
  return arePerpendicularByProvenance(left, right) || arePerpendicularBySceneDefinition(scene, left, right);
}

export function resolveAngleRightStatus(scene: SceneModel, angle: SceneAngle): AngleRightStatus {
  if (typeof angle.isRightExact === "boolean") return angle.isRightExact ? "exact" : "none";
  if (isRightExactByProvenance(scene, angle.aId, angle.bId, angle.cId)) return "exact";
  const aPoint = scene.points.find((p) => p.id === angle.aId);
  const bPoint = scene.points.find((p) => p.id === angle.bId);
  const cPoint = scene.points.find((p) => p.id === angle.cId);
  if (!aPoint || !bPoint || !cPoint) return "none";
  const a = getPointWorldPos(aPoint, scene);
  const b = getPointWorldPos(bPoint, scene);
  const c = getPointWorldPos(cPoint, scene);
  if (!a || !b || !c) return "none";
  return isRightAngle(a, b, c, APPROX_RIGHT_EPS) ? "approx" : "none";
}

export function resolveAngleRightExact(scene: SceneModel, angle: SceneAngle): boolean {
  return resolveAngleRightStatus(scene, angle) === "exact";
}

function isPointOnLineLike(scene: SceneModel, pointId: string, ref: LineLikeObjectRef): boolean {
  const point = scene.points.find((p) => p.id === pointId);
  if (!point) return false;
  const p = getPointWorldPos(point, scene);
  if (!p) return false;
  if (ref.type === "line") {
    const line = scene.lines.find((l) => l.id === ref.id);
    if (!line) return false;
    const anchors = getLineWorldAnchors(line, scene);
    if (!anchors) return false;
    const dx = anchors.b.x - anchors.a.x;
    const dy = anchors.b.y - anchors.a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-12) return false;
    const cross = Math.abs((p.x - anchors.a.x) * dy - (p.y - anchors.a.y) * dx);
    return cross <= 1e-6 * len;
  }
  const seg = scene.segments.find((s) => s.id === ref.id);
  if (!seg) return false;
  if (pointId === seg.aId || pointId === seg.bId) return true;
  const aPoint = scene.points.find((pt) => pt.id === seg.aId);
  const bPoint = scene.points.find((pt) => pt.id === seg.bId);
  if (!aPoint || !bPoint) return false;
  const a = getPointWorldPos(aPoint, scene);
  const b = getPointWorldPos(bPoint, scene);
  if (!a || !b) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-12) return false;
  const cross = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx);
  if (cross > 1e-6 * Math.sqrt(len2)) return false;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return t >= -1e-6 && t <= 1 + 1e-6;
}

export function rebuildRightAngleProvenance(scene: SceneModel): void {
  clearRightAngleProvenance();
  for (const line of scene.lines) {
    if (line.kind === "twoPoint") {
      registerLinePair(line.id, line.aId, line.bId);
    }
  }
  for (const seg of scene.segments) {
    registerSegmentPair(seg.id, seg.aId, seg.bId);
  }
  for (const line of scene.lines) {
    if (line.kind === "perpendicular") {
      registerPerpendicularRelation(line.id, line.base);
    }
  }
}

function arePerpendicularBySceneDefinition(scene: SceneModel, a: LineLikeObjectRef, b: LineLikeObjectRef): boolean {
  const lineA = a.type === "line" ? scene.lines.find((line) => line.id === a.id) : null;
  const lineB = b.type === "line" ? scene.lines.find((line) => line.id === b.id) : null;
  if (lineA?.kind === "perpendicular" && lineLikeRefsEquivalent(scene, lineA.base, b)) return true;
  if (lineB?.kind === "perpendicular" && lineLikeRefsEquivalent(scene, lineB.base, a)) return true;
  return false;
}

function lineLikeRefsEquivalent(scene: SceneModel, a: LineLikeObjectRef, b: LineLikeObjectRef): boolean {
  if (a.type === b.type && a.id === b.id) return true;
  const aPair = lineLikePointPair(scene, a);
  const bPair = lineLikePointPair(scene, b);
  if (!aPair || !bPair) return false;
  return pairKey(aPair.aId, aPair.bId) === pairKey(bPair.aId, bPair.bId);
}

function lineLikePointPair(scene: SceneModel, ref: LineLikeObjectRef): { aId: string; bId: string } | null {
  if (ref.type === "segment") {
    const seg = scene.segments.find((item) => item.id === ref.id);
    if (!seg) return null;
    return { aId: seg.aId, bId: seg.bId };
  }
  const line = scene.lines.find((item) => item.id === ref.id);
  if (!line || line.kind !== "twoPoint") return null;
  return { aId: line.aId, bId: line.bId };
}
