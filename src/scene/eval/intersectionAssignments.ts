import type { Vec2 } from "../../geo/vec2";
import { distance } from "../../geo/geometry";

const ROOT_EPS = 1e-6;

type RootIndex = number;

export type CircleLineAssignmentPoint = {
  id: string;
  branchIndex: 0 | 1;
  excludePointId?: string;
};

export type GenericAssignmentPoint = {
  id: string;
  branchIndex?: number;
  excludePointId?: string;
};

type AssignmentRequest<TPoint> = {
  point: TPoint;
  candidates: RootIndex[];
  forced: boolean;
  order: number;
};

type AssignmentOps = {
  getExcludedPointWorld: (pointId: string) => Vec2 | null;
};

type StableAssignmentOps = {
  getPreviousStablePoint: (pointId: string) => Vec2 | null;
  rememberStablePoint: (pointId: string, value: Vec2) => void;
};

function sortRequests<TPoint>(requests: AssignmentRequest<TPoint>[]): void {
  requests.sort((a, b) => {
    if (a.forced !== b.forced) return a.forced ? -1 : 1;
    return a.order - b.order;
  });
}

function assignSingleRootPoints<TPoint extends { id: string; excludePointId?: string }>(
  pairPoints: TPoint[],
  root: Vec2,
  ops: AssignmentOps & StableAssignmentOps
): Map<string, Vec2 | null> {
  const out = new Map<string, Vec2 | null>();
  for (const item of pairPoints) {
    let result: Vec2 | null = root;
    if (item.excludePointId) {
      const excluded = ops.getExcludedPointWorld(item.excludePointId);
      if (excluded && distance(excluded, root) <= ROOT_EPS) result = null;
    }
    if (result) ops.rememberStablePoint(item.id, result);
    out.set(item.id, result);
  }
  return out;
}

function computeForcedExclusions(
  item: { excludePointId?: string },
  roots: Vec2[],
  ops: AssignmentOps
): { excludeIndex: RootIndex | null; impossible: boolean } {
  if (!item.excludePointId) return { excludeIndex: null, impossible: false };
  const excluded = ops.getExcludedPointWorld(item.excludePointId);
  if (!excluded) return { excludeIndex: null, impossible: false };
  const matches = roots
    .map((root, idx) => ({ idx, d: distance(root, excluded) }))
    .filter((it) => it.d <= ROOT_EPS);
  if (matches.length >= roots.length) return { excludeIndex: null, impossible: true };
  if (matches.length === 1) return { excludeIndex: matches[0].idx, impossible: false };
  return { excludeIndex: null, impossible: false };
}

function computeSingletonUnoccupiedRootPreference(occupiedByOtherPoints: boolean[] | undefined, rootCount: number): RootIndex | null {
  if (!occupiedByOtherPoints || occupiedByOtherPoints.length !== rootCount) return null;
  const occupiedCount = occupiedByOtherPoints.filter(Boolean).length;
  if (occupiedCount !== 1) return null;
  const idx = occupiedByOtherPoints.findIndex((isOccupied) => !isOccupied);
  return idx >= 0 ? idx : null;
}

function primaryByPreviousStable(itemId: string, roots: Vec2[], ops: StableAssignmentOps): RootIndex | null {
  const prev = ops.getPreviousStablePoint(itemId);
  if (!prev) return null;
  let bestIdx = 0;
  let bestDist = distance(roots[0], prev);
  let secondBest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < roots.length; i += 1) {
    const d = distance(roots[i], prev);
    if (d < bestDist) {
      secondBest = bestDist;
      bestDist = d;
      bestIdx = i;
    } else if (d < secondBest) {
      secondBest = d;
    }
  }
  if (!Number.isFinite(secondBest)) return bestIdx;
  return Math.abs(bestDist - secondBest) > 1e-9 ? bestIdx : null;
}

function candidateOrder(rootCount: number, primary: RootIndex): RootIndex[] {
  const out: RootIndex[] = [primary];
  for (let i = 0; i < rootCount; i += 1) {
    if (i !== primary) out.push(i);
  }
  return out;
}

function pushRequest<TPoint>(requests: AssignmentRequest<TPoint>[], point: TPoint, order: number, candidates: RootIndex[], forced: boolean): void {
  requests.push({ point, order, candidates, forced });
}

function finalizeRequestAssignments<TPoint extends { id: string }>(
  requests: AssignmentRequest<TPoint>[],
  roots: Vec2[],
  out: Map<string, Vec2 | null>,
  ops: StableAssignmentOps
): void {
  sortRequests(requests);
  const used = new Set<RootIndex>();
  for (const req of requests) {
    let chosenIdx: RootIndex = req.candidates[0];
    for (const candidate of req.candidates) {
      if (!used.has(candidate)) {
        chosenIdx = candidate;
        break;
      }
    }
    if (!used.has(chosenIdx)) used.add(chosenIdx);
    const chosen = roots[chosenIdx] ?? roots[0] ?? null;
    out.set(req.point.id, chosen);
    if (chosen) ops.rememberStablePoint(req.point.id, chosen);
  }
}

export function assignCircleLinePairPoints(
  pairPoints: CircleLineAssignmentPoint[],
  branches: Array<{ point: Vec2; t: number }>,
  ops: AssignmentOps & {
    getPreviousStablePoint: (pointId: string) => Vec2 | null;
    rememberStablePoint: (pointId: string, value: Vec2) => void;
    occupiedByOtherPoints?: [boolean, boolean];
  }
): Map<string, Vec2 | null> {
  const out = new Map<string, Vec2 | null>();
  if (pairPoints.length === 0) return out;

  if (branches.length === 0) {
    for (const item of pairPoints) out.set(item.id, null);
    return out;
  }

  if (branches.length === 1) {
    return assignSingleRootPoints(pairPoints, branches[0].point, ops);
  }

  const roots = [branches[0].point, branches[1].point];
  const singletonOccupiedRootPreference =
    pairPoints.length === 1 && ops.occupiedByOtherPoints
      ? ops.occupiedByOtherPoints[0] !== ops.occupiedByOtherPoints[1]
        ? (ops.occupiedByOtherPoints[0] ? 1 : 0)
        : null
      : null;
  const requests: AssignmentRequest<CircleLineAssignmentPoint>[] = [];
  for (let i = 0; i < pairPoints.length; i += 1) {
    const item = pairPoints[i];
    const forced = computeForcedExclusions(item, roots, ops);
    if (forced.impossible) {
      out.set(item.id, null);
      continue;
    }
    let primary: RootIndex = item.branchIndex === 1 ? 1 : 0;
    if (forced.excludeIndex !== null) {
      primary = forced.excludeIndex === 0 ? 1 : 0;
    } else if (singletonOccupiedRootPreference !== null) {
      // If another point already occupies one root (e.g. known anchor/intersection),
      // keep the singleton circle-line intersection on the unoccupied root.
      primary = singletonOccupiedRootPreference;
    } else {
      const prevPrimary = primaryByPreviousStable(item.id, roots, ops);
      if (prevPrimary !== null) primary = prevPrimary;
    }
    pushRequest(requests, item, i, candidateOrder(roots.length, primary), forced.excludeIndex !== null);
  }

  finalizeRequestAssignments(requests, roots, out, ops);

  return out;
}

export function assignGenericIntersectionPairPoints(
  pairPoints: GenericAssignmentPoint[],
  intersections: Vec2[],
  ops: AssignmentOps & {
    getPreviousStablePoint: (pointId: string) => Vec2 | null;
    rememberStablePoint: (pointId: string, value: Vec2) => void;
    occupiedByOtherPoints?: boolean[];
  }
): Map<string, Vec2 | null> {
  const out = new Map<string, Vec2 | null>();
  if (pairPoints.length === 0) return out;

  if (intersections.length === 0) {
    for (const item of pairPoints) out.set(item.id, null);
    return out;
  }

  if (intersections.length === 1) {
    return assignSingleRootPoints(pairPoints, intersections[0], ops);
  }

  const requests: AssignmentRequest<GenericAssignmentPoint>[] = [];
  const singletonOccupiedRootPreference = pairPoints.length === 1
    ? computeSingletonUnoccupiedRootPreference(ops.occupiedByOtherPoints, intersections.length)
    : null;
  for (let i = 0; i < pairPoints.length; i += 1) {
    const item = pairPoints[i];
    const forced = computeForcedExclusions(item, intersections, ops);
    if (forced.impossible) {
      out.set(item.id, null);
      continue;
    }
    let primary: RootIndex;
    if (forced.excludeIndex !== null) {
      // Prefer any root that is not the excluded one.
      const allowed = intersections.map((_, idx) => idx).filter((idx) => idx !== forced.excludeIndex);
      if (allowed.length === 0) {
        out.set(item.id, null);
        continue;
      }
      if (Number.isInteger(item.branchIndex) && (item.branchIndex as number) >= 0 && (item.branchIndex as number) < intersections.length) {
        primary = allowed.includes(item.branchIndex as number) ? (item.branchIndex as number) : allowed[0];
      } else {
        // Deterministic fallback: choose the first allowed root by index.
        primary = allowed[0];
      }
    } else if (singletonOccupiedRootPreference !== null && singletonOccupiedRootPreference >= 0) {
      primary = singletonOccupiedRootPreference;
    } else if (Number.isInteger(item.branchIndex) && (item.branchIndex as number) >= 0 && (item.branchIndex as number) < intersections.length) {
      primary = item.branchIndex as number;
    } else {
      const prevPrimary = primaryByPreviousStable(item.id, intersections, ops);
      primary = prevPrimary ?? 0;
    }
    pushRequest(requests, item, i, candidateOrder(intersections.length, primary), forced.excludeIndex !== null);
  }

  finalizeRequestAssignments(requests, intersections, out, ops);

  return out;
}
