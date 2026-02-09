import { readFile } from "node:fs/promises";
import type {
  CircleStyle,
  GeometryObjectRef,
  LineStyle,
  PointStyle,
  SceneCircle,
  SceneLine,
  SceneModel,
  ScenePoint,
  SceneSegment,
  ShowLabelMode,
} from "../src/scene/points.ts";
import { beginSceneEvalTick, endSceneEvalTick, getPointWorldPos } from "../src/scene/points.ts";

const defaultPointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.4,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const defaultLineStyle: LineStyle = {
  strokeColor: "#1f2937",
  strokeWidth: 1.8,
  dash: "solid",
  opacity: 1,
};

const defaultCircleStyle: CircleStyle = {
  strokeColor: "#1f2937",
  strokeWidth: 1.8,
  strokeDash: "solid",
  strokeOpacity: 1,
};

async function main(): Promise<void> {
  const filePath = process.argv[2];
  const eps = Number(process.argv[3] ?? "1e-6");
  if (!filePath) {
    throw new Error("Usage: npm run diag:scene -- <path-to-scene.json> [eps]");
  }
  if (!Number.isFinite(eps) || eps <= 0) {
    throw new Error(`Invalid eps: ${process.argv[3]}`);
  }

  const raw = JSON.parse(await readFile(filePath, "utf8")) as {
    scene?: Record<string, unknown>;
    points?: Array<Record<string, unknown>>;
    lines?: Array<Record<string, unknown>>;
    segments?: Array<Record<string, unknown>>;
    circles?: Array<Record<string, unknown>>;
  };
  const scene = hydrateScene((raw.scene ?? raw) as Record<string, unknown>);

  beginSceneEvalTick(scene);
  const evaluated = scene.points.map((point) => ({ point, world: getPointWorldPos(point, scene) }));
  const stats = endSceneEvalTick(scene);

  const undefinedPoints = evaluated.filter((entry) => !entry.world).map((entry) => entry.point);
  const coincidentGroups = groupCoincidentPoints(
    evaluated.filter((entry): entry is { point: ScenePoint; world: { x: number; y: number } } => Boolean(entry.world)),
    eps
  );
  const definitionDuplicateGroups = groupByDefinitionSignature(scene.points).filter((group) => group.length > 1);

  console.log(`# Scene diagnostics: ${filePath}`);
  console.log(`points=${scene.points.length} lines=${scene.lines.length} segments=${scene.segments.length} circles=${scene.circles.length}`);
  if (stats) {
    console.log(
      `eval tick=${stats.tick} evalCalls=${stats.totalNodeEvalCalls} cacheHits=${stats.cacheHits} circleLine=${stats.circleLineCalls} circleCircle=${stats.circleCircleCalls} lineLine=${stats.lineLineCalls} ms=${stats.ms.toFixed(
        2
      )}`
    );
  }
  console.log("");

  console.log(`Undefined points (${undefinedPoints.length}):`);
  if (undefinedPoints.length === 0) {
    console.log("- none");
  } else {
    for (const point of undefinedPoints) {
      console.log(`- ${point.name} (${point.id}) kind=${point.kind}`);
    }
  }
  console.log("");

  console.log(`Coincident groups by world eps=${eps} (${coincidentGroups.length}):`);
  if (coincidentGroups.length === 0) {
    console.log("- none");
  } else {
    for (const group of coincidentGroups) {
      const names = group.items.map((item) => `${item.point.name}(${item.point.id})`).join(", ");
      console.log(`- @(${group.anchor.x.toFixed(6)}, ${group.anchor.y.toFixed(6)}): ${names}`);
    }
  }
  console.log("");

  console.log(`Duplicate construction signatures (${definitionDuplicateGroups.length}):`);
  if (definitionDuplicateGroups.length === 0) {
    console.log("- none");
  } else {
    for (const group of definitionDuplicateGroups) {
      const sig = definitionSignature(group[0]);
      const names = group.map((p) => `${p.name}(${p.id})`).join(", ");
      console.log(`- ${sig}: ${names}`);
    }
  }
}

function hydrateScene(raw: Record<string, unknown>): SceneModel {
  return {
    points: ((raw.points as Array<Record<string, unknown>> | undefined) ?? []).map(hydratePoint),
    lines: ((raw.lines as Array<Record<string, unknown>> | undefined) ?? []).map(hydrateLine),
    segments: ((raw.segments as Array<Record<string, unknown>> | undefined) ?? []).map(hydrateSegment),
    circles: ((raw.circles as Array<Record<string, unknown>> | undefined) ?? []).map(hydrateCircle),
  };
}

function hydratePoint(raw: Record<string, unknown>): ScenePoint {
  const def = (raw.definition as Record<string, unknown> | undefined) ?? raw;
  const kind = String(def.kind ?? raw.kind ?? "free");
  const name = String(raw.name ?? raw.id ?? "P");
  const base = {
    id: String(raw.id),
    name,
    captionTex: String(raw.captionTex ?? name),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    showLabel: (raw.showLabel as ShowLabelMode) ?? "name",
    locked: raw.locked === undefined ? false : Boolean(raw.locked),
    auxiliary: raw.auxiliary === undefined ? false : Boolean(raw.auxiliary),
    style: (raw.style as PointStyle) ?? { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
  };

  if (kind === "free") {
    const pos = (raw.position as { x: number; y: number } | undefined) ?? {
      x: Number((def.x as number | undefined) ?? raw.x),
      y: Number((def.y as number | undefined) ?? raw.y),
    };
    return { ...base, kind: "free", position: pos };
  }
  if (kind === "pointOnCircle") return { ...base, kind: "pointOnCircle", circleId: String(def.circleId), t: Number(def.t) };
  if (kind === "pointOnLine") return { ...base, kind: "pointOnLine", lineId: String(def.lineId), s: Number(def.s) };
  if (kind === "pointOnSegment") return { ...base, kind: "pointOnSegment", segId: String(def.segId), u: Number(def.u) };
  if (kind === "midpointPoints") return { ...base, kind: "midpointPoints", aId: String(def.aId), bId: String(def.bId) };
  if (kind === "midpointSegment") return { ...base, kind: "midpointSegment", segId: String(def.segId) };
  if (kind === "circleLineIntersectionPoint") {
    return {
      ...base,
      kind: "circleLineIntersectionPoint",
      circleId: String(def.circleId),
      lineId: String(def.lineId),
      branchIndex: Number(def.branchIndex) === 1 ? 1 : 0,
      excludePointId: def.excludePointId ? String(def.excludePointId) : undefined,
    };
  }
  if (kind === "intersectionPoint") {
    return {
      ...base,
      kind: "intersectionPoint",
      objA: def.objA as GeometryObjectRef,
      objB: def.objB as GeometryObjectRef,
      preferredWorld: def.preferredWorld as { x: number; y: number },
      excludePointId: def.excludePointId ? String(def.excludePointId) : undefined,
    };
  }
  throw new Error(`Unsupported point kind: ${kind}`);
}

function hydrateLine(raw: Record<string, unknown>): SceneLine {
  return {
    id: String(raw.id),
    aId: String(raw.aId),
    bId: String(raw.bId),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    style: (raw.style as LineStyle) ?? defaultLineStyle,
  };
}

function hydrateSegment(raw: Record<string, unknown>): SceneSegment {
  return {
    id: String(raw.id),
    aId: String(raw.aId),
    bId: String(raw.bId),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
    style: (raw.style as LineStyle) ?? defaultLineStyle,
  };
}

function hydrateCircle(raw: Record<string, unknown>): SceneCircle {
  return {
    id: String(raw.id),
    centerId: String(raw.centerId),
    throughId: String(raw.throughId),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    style: (raw.style as CircleStyle) ?? defaultCircleStyle,
  };
}

function groupCoincidentPoints(
  entries: Array<{ point: ScenePoint; world: { x: number; y: number } }>,
  eps: number
): Array<{ anchor: { x: number; y: number }; items: Array<{ point: ScenePoint; world: { x: number; y: number } }> }> {
  const used = new Set<string>();
  const groups: Array<{ anchor: { x: number; y: number }; items: Array<{ point: ScenePoint; world: { x: number; y: number } }> }> = [];
  for (let i = 0; i < entries.length; i += 1) {
    const a = entries[i];
    if (used.has(a.point.id)) continue;
    const items = [a];
    for (let j = i + 1; j < entries.length; j += 1) {
      const b = entries[j];
      if (used.has(b.point.id)) continue;
      const dx = a.world.x - b.world.x;
      const dy = a.world.y - b.world.y;
      if (dx * dx + dy * dy <= eps * eps) {
        items.push(b);
      }
    }
    if (items.length > 1) {
      for (const item of items) used.add(item.point.id);
      groups.push({ anchor: a.world, items });
    }
  }
  groups.sort((g1, g2) => g1.items[0].point.name.localeCompare(g2.items[0].point.name));
  return groups;
}

function groupByDefinitionSignature(points: ScenePoint[]): ScenePoint[][] {
  const map = new Map<string, ScenePoint[]>();
  for (const point of points) {
    const sig = definitionSignature(point);
    const list = map.get(sig) ?? [];
    list.push(point);
    map.set(sig, list);
  }
  return [...map.values()];
}

function definitionSignature(point: ScenePoint): string {
  if (point.kind === "intersectionPoint") {
    return `intersection:${point.objA.type}:${point.objA.id}:${point.objB.type}:${point.objB.id}:${point.excludePointId ?? "-"}`;
  }
  if (point.kind === "circleLineIntersectionPoint") {
    return `circleLine:${point.circleId}:${point.lineId}:${point.branchIndex}:${point.excludePointId ?? "-"}`;
  }
  if (point.kind === "pointOnCircle") return `pointOnCircle:${point.circleId}:${point.t}`;
  if (point.kind === "pointOnLine") return `pointOnLine:${point.lineId}:${point.s}`;
  if (point.kind === "pointOnSegment") return `pointOnSegment:${point.segId}:${point.u}`;
  if (point.kind === "midpointPoints") return `midpointPoints:${point.aId}:${point.bId}`;
  if (point.kind === "midpointSegment") return `midpointSegment:${point.segId}`;
  if (point.kind === "free") return `free:${point.position.x}:${point.position.y}`;
  return point.kind;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
