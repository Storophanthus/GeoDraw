import type { GeometryObjectRef, SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";

type NodeType = "point" | "segment" | "line" | "circle" | "angle" | "number";
type NodeKey = `${NodeType}:${string}`;

type Graph = {
  dependents: Map<NodeKey, Set<NodeKey>>;
};

function key(type: NodeType, id: string): NodeKey {
  return `${type}:${id}`;
}

function objectRefToKey(ref: GeometryObjectRef): NodeKey {
  if (ref.type === "line") return key("line", ref.id);
  if (ref.type === "segment") return key("segment", ref.id);
  return key("circle", ref.id);
}

function selectedToKey(selected: Exclude<SelectedObject, null>): NodeKey {
  if (selected.type === "line") return key("line", selected.id);
  if (selected.type === "segment") return key("segment", selected.id);
  if (selected.type === "circle") return key("circle", selected.id);
  if (selected.type === "point") return key("point", selected.id);
  if (selected.type === "angle") return key("angle", selected.id);
  return key("number", selected.id);
}

function ensureNode(graph: Graph, node: NodeKey): void {
  if (!graph.dependents.has(node)) graph.dependents.set(node, new Set<NodeKey>());
}

function addDependency(graph: Graph, child: NodeKey, parent: NodeKey): void {
  ensureNode(graph, child);
  ensureNode(graph, parent);
  graph.dependents.get(parent)!.add(child);
}

function expressionNumberNames(expr: string): Set<string> {
  const refs = new Set<string>();
  const re = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(expr)) !== null) {
    refs.add(m[1]);
  }
  return refs;
}

export function buildDependencyGraph(scene: SceneModel): Graph {
  const graph: Graph = { dependents: new Map<NodeKey, Set<NodeKey>>() };

  const numberIdByName = new Map(scene.numbers.map((n) => [n.name, n.id]));

  for (const p of scene.points) {
    const child = key("point", p.id);
    ensureNode(graph, child);
    if (p.kind === "midpointPoints") {
      addDependency(graph, child, key("point", p.aId));
      addDependency(graph, child, key("point", p.bId));
    } else if (p.kind === "midpointSegment") {
      addDependency(graph, child, key("segment", p.segId));
    } else if (p.kind === "pointOnLine") {
      addDependency(graph, child, key("line", p.lineId));
    } else if (p.kind === "pointOnSegment") {
      addDependency(graph, child, key("segment", p.segId));
    } else if (p.kind === "pointOnCircle") {
      addDependency(graph, child, key("circle", p.circleId));
    } else if (p.kind === "pointByRotation") {
      addDependency(graph, child, key("point", p.centerId));
      addDependency(graph, child, key("point", p.pointId));
    } else if (p.kind === "intersectionPoint") {
      addDependency(graph, child, objectRefToKey(p.objA));
      addDependency(graph, child, objectRefToKey(p.objB));
      if (p.excludePointId) addDependency(graph, child, key("point", p.excludePointId));
    } else if (p.kind === "circleLineIntersectionPoint") {
      addDependency(graph, child, key("circle", p.circleId));
      addDependency(graph, child, key("line", p.lineId));
      if (p.excludePointId) addDependency(graph, child, key("point", p.excludePointId));
    }
  }

  for (const s of scene.segments) {
    const child = key("segment", s.id);
    ensureNode(graph, child);
    addDependency(graph, child, key("point", s.aId));
    addDependency(graph, child, key("point", s.bId));
  }

  for (const l of scene.lines) {
    const child = key("line", l.id);
    ensureNode(graph, child);
    if (l.kind === "perpendicular" || l.kind === "parallel") {
      addDependency(graph, child, key("point", l.throughId));
      addDependency(graph, child, l.base.type === "line" ? key("line", l.base.id) : key("segment", l.base.id));
    } else if (l.kind === "angleBisector") {
      addDependency(graph, child, key("point", l.aId));
      addDependency(graph, child, key("point", l.bId));
      addDependency(graph, child, key("point", l.cId));
    } else {
      addDependency(graph, child, key("point", l.aId));
      addDependency(graph, child, key("point", l.bId));
    }
  }

  for (const c of scene.circles) {
    const child = key("circle", c.id);
    ensureNode(graph, child);
    if (c.kind === "threePoint") {
      addDependency(graph, child, key("point", c.aId));
      addDependency(graph, child, key("point", c.bId));
      addDependency(graph, child, key("point", c.cId));
    } else {
      addDependency(graph, child, key("point", c.centerId));
      if (c.kind !== "fixedRadius") addDependency(graph, child, key("point", c.throughId));
    }
  }

  for (const a of scene.angles) {
    const child = key("angle", a.id);
    ensureNode(graph, child);
    addDependency(graph, child, key("point", a.aId));
    addDependency(graph, child, key("point", a.bId));
    addDependency(graph, child, key("point", a.cId));
  }

  for (const n of scene.numbers) {
    const child = key("number", n.id);
    ensureNode(graph, child);
    const def = n.definition;
    if (def.kind === "distancePoints") {
      addDependency(graph, child, key("point", def.aId));
      addDependency(graph, child, key("point", def.bId));
    } else if (def.kind === "segmentLength") {
      addDependency(graph, child, key("segment", def.segId));
    } else if (def.kind === "circleRadius" || def.kind === "circleArea") {
      addDependency(graph, child, key("circle", def.circleId));
    } else if (def.kind === "angleDegrees") {
      addDependency(graph, child, key("angle", def.angleId));
    } else if (def.kind === "ratio") {
      addDependency(graph, child, key("number", def.numeratorId));
      addDependency(graph, child, key("number", def.denominatorId));
    } else if (def.kind === "expression") {
      for (const name of expressionNumberNames(def.expr)) {
        const depId = numberIdByName.get(name);
        if (depId) addDependency(graph, child, key("number", depId));
      }
    }
  }

  return graph;
}

export function collectCascadeDelete(scene: SceneModel, selected: Exclude<SelectedObject, null>): Set<NodeKey> {
  const graph = buildDependencyGraph(scene);
  const start = selectedToKey(selected);
  const deleted = new Set<NodeKey>();
  const queue: NodeKey[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (deleted.has(cur)) continue;
    deleted.add(cur);
    const deps = graph.dependents.get(cur);
    if (!deps) continue;
    for (const child of deps) {
      if (!deleted.has(child)) queue.push(child);
    }
  }
  return deleted;
}

export function applyDeletion(scene: SceneModel, deleted: Set<NodeKey>): SceneModel {
  const drop = (type: NodeType, id: string) => deleted.has(key(type, id));

  const points = scene.points.filter((p) => !drop("point", p.id));
  const segments = scene.segments.filter((s) => !drop("segment", s.id));
  const lines = scene.lines.filter((l) => !drop("line", l.id));
  const circles = scene.circles.filter((c) => !drop("circle", c.id));
  const angles = scene.angles.filter((a) => !drop("angle", a.id));
  const numbers = scene.numbers.filter((n) => !drop("number", n.id));

  return { ...scene, points, segments, lines, circles, angles, numbers };
}

export function isSelectedObjectAlive(scene: SceneModel, selected: SelectedObject): boolean {
  if (!selected) return false;
  if (selected.type === "point") return scene.points.some((p) => p.id === selected.id);
  if (selected.type === "segment") return scene.segments.some((s) => s.id === selected.id);
  if (selected.type === "line") return scene.lines.some((l) => l.id === selected.id);
  if (selected.type === "circle") return scene.circles.some((c) => c.id === selected.id);
  if (selected.type === "angle") return scene.angles.some((a) => a.id === selected.id);
  return scene.numbers.some((n) => n.id === selected.id);
}
