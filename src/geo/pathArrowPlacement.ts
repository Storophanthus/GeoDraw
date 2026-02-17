import type { ArrowDirection } from "../scene/points";

export type ArrowPathDomain = "open" | "closed";

export type ArrowPlacementParam = {
  t: number;
  reversed: boolean;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function wrap01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

export function normalizePathParam(value: number, domain: ArrowPathDomain): number {
  return domain === "closed" ? wrap01(value) : clamp01(value);
}

export function resolveArrowPlacementParams(
  direction: ArrowDirection,
  basePositions: readonly number[],
  pairDelta: number,
  domain: ArrowPathDomain
): ArrowPlacementParam[] {
  const out: ArrowPlacementParam[] = [];
  const delta = Number.isFinite(pairDelta) ? Math.max(0, pairDelta) : 0;

  for (let i = 0; i < basePositions.length; i += 1) {
    const p = normalizePathParam(basePositions[i], domain);
    if (direction === "->") {
      out.push({ t: p, reversed: false });
      continue;
    }
    if (direction === "<-") {
      out.push({ t: p, reversed: true });
      continue;
    }
    if (direction === "<->") {
      out.push({ t: normalizePathParam(p - delta, domain), reversed: true });
      out.push({ t: normalizePathParam(p + delta, domain), reversed: false });
      continue;
    }
    out.push({ t: normalizePathParam(p - delta, domain), reversed: false });
    out.push({ t: normalizePathParam(p + delta, domain), reversed: true });
  }

  return out;
}
