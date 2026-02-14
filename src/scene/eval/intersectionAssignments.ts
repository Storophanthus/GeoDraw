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

function sortRequests<TPoint>(requests: AssignmentRequest<TPoint>[]): void {
  requests.sort((a, b) => {
    if (a.forced !== b.forced) return a.forced ? -1 : 1;
    return a.order - b.order;
  });
}

export function assignCircleLinePairPoints(
  pairPoints: CircleLineAssignmentPoint[],
  branches: Array<{ point: Vec2; t: number }>,
  ops: AssignmentOps & {
    getPreviousStablePoint: (pointId: string) => Vec2 | null;
    rememberStablePoint: (pointId: string, value: Vec2) => void;
  }
): Map<string, Vec2 | null> {
  const out = new Map<string, Vec2 | null>();
  if (pairPoints.length === 0) return out;

  if (branches.length === 0) {
    for (const item of pairPoints) out.set(item.id, null);
    return out;
  }

  if (branches.length === 1) {
    const root = branches[0].point;
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

  const root0 = branches[0].point;
  const root1 = branches[1].point;
  const requests: AssignmentRequest<CircleLineAssignmentPoint>[] = [];
  for (let i = 0; i < pairPoints.length; i += 1) {
    const item = pairPoints[i];
    let forcedCandidate: RootIndex | null = null;
    if (item.excludePointId) {
      const excluded = ops.getExcludedPointWorld(item.excludePointId);
      if (excluded) {
        const d0 = distance(root0, excluded);
        const d1 = distance(root1, excluded);
        if (d0 <= ROOT_EPS && d1 > ROOT_EPS) forcedCandidate = 1;
        else if (d1 <= ROOT_EPS && d0 > ROOT_EPS) forcedCandidate = 0;
        else if (d0 <= ROOT_EPS && d1 <= ROOT_EPS) {
          out.set(item.id, null);
          continue;
        }
      }
    }

    const prev = ops.getPreviousStablePoint(item.id);
    let primary: RootIndex = item.branchIndex === 1 ? 1 : 0;
    if (forcedCandidate !== null) {
      primary = forcedCandidate;
    } else if (prev) {
      const d0 = distance(root0, prev);
      const d1 = distance(root1, prev);
      if (Math.abs(d0 - d1) > 1e-9) primary = d0 <= d1 ? 0 : 1;
    }
    const secondary: RootIndex = primary === 0 ? 1 : 0;
    requests.push({
      point: item,
      candidates: [primary, secondary],
      forced: forcedCandidate !== null,
      order: i,
    });
  }

  sortRequests(requests);
  const used = new Set<RootIndex>();
  for (const req of requests) {
    let chosenIdx: RootIndex | null = null;
    if (!used.has(req.candidates[0])) chosenIdx = req.candidates[0];
    else if (!used.has(req.candidates[1])) chosenIdx = req.candidates[1];
    else chosenIdx = req.candidates[0];
    if (!used.has(chosenIdx)) used.add(chosenIdx);
    const value = chosenIdx === 0 ? root0 : root1;
    out.set(req.point.id, value);
  }

  return out;
}

export function assignGenericIntersectionPairPoints(
  pairPoints: GenericAssignmentPoint[],
  intersections: Vec2[],
  ops: AssignmentOps & {
    getPreviousStablePoint: (pointId: string) => Vec2 | null;
    rememberStablePoint: (pointId: string, value: Vec2) => void;
  }
): Map<string, Vec2 | null> {
  const out = new Map<string, Vec2 | null>();
  if (pairPoints.length === 0) return out;

  if (intersections.length === 0) {
    for (const item of pairPoints) out.set(item.id, null);
    return out;
  }

  if (intersections.length === 1) {
    const root = intersections[0];
    for (const item of pairPoints) {
      let result: Vec2 | null = root;
      if (item.excludePointId) {
        const excluded = ops.getExcludedPointWorld(item.excludePointId);
        if (excluded && distance(excluded, root) <= ROOT_EPS) result = null;
      }
      out.set(item.id, result);
      if (result) ops.rememberStablePoint(item.id, result);
    }
    return out;
  }

  const requests: AssignmentRequest<GenericAssignmentPoint>[] = [];
  for (let i = 0; i < pairPoints.length; i += 1) {
    const item = pairPoints[i];
    let forcedExcludedIndex: RootIndex | null = null;
    if (item.excludePointId) {
      const excluded = ops.getExcludedPointWorld(item.excludePointId);
      if (excluded) {
        const matches = intersections
          .map((root, idx) => ({ idx, d: distance(root, excluded) }))
          .filter((it) => it.d <= ROOT_EPS);
        if (matches.length >= intersections.length) {
          out.set(item.id, null);
          continue;
        }
        if (matches.length === 1) forcedExcludedIndex = matches[0].idx;
      }
    }
    let primary: RootIndex;
    if (forcedExcludedIndex !== null) {
      // Prefer any root that is not the excluded one.
      const allowed = intersections.map((_, idx) => idx).filter((idx) => idx !== forcedExcludedIndex);
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
    } else if (Number.isInteger(item.branchIndex) && (item.branchIndex as number) >= 0 && (item.branchIndex as number) < intersections.length) {
      primary = item.branchIndex as number;
    } else {
      // Deterministic fallback when branch index is missing.
      primary = 0;
    }
    const candidates = intersections
      .map((_, idx) => idx)
      .filter((idx) => idx !== primary)
      .sort((a, b) => a - b);
    candidates.unshift(primary);
    requests.push({
      point: item,
      candidates,
      forced: forcedExcludedIndex !== null,
      order: i,
    });
  }

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
    const chosen = intersections[chosenIdx] ?? intersections[0];
    out.set(req.point.id, chosen);
    ops.rememberStablePoint(req.point.id, chosen);
  }

  return out;
}
