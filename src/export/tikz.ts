import { circleCircleIntersections, distance, lineCircleIntersectionBranches } from "../geo/geometry";
import { getPointWorldPos, type GeometryObjectRef, type SceneModel, type ScenePoint } from "../scene/points";

export type TikzCommand =
  | { kind: "DefPoints"; items: { name: string; x: number; y: number }[] }
  | { kind: "DefPointOnLine"; name: string; a: string; b: string }
  | { kind: "DefPointOnCircle"; name: string; center: string; through: string; theta: number }
  | { kind: "DefMidPoint"; name: string; a: string; b: string }
  | { kind: "InterLL"; name: string; a1: string; a2: string; b1: string; b2: string }
  | {
      kind: "InterLC";
      name: string;
      lineA: string;
      lineB: string;
      circleO: string;
      circleX: string;
      branch: 0 | 1;
      common?: string;
    }
  | {
      kind: "InterCC";
      name: string;
      circleAO: string;
      circleAX: string;
      circleBO: string;
      circleBX: string;
      branch: 0 | 1;
      common?: string;
    }
  | { kind: "DrawSegment"; a: string; b: string }
  | { kind: "DrawLine"; a: string; b: string; addLeft: number; addRight: number }
  | { kind: "DrawCircle"; o: string; x: string }
  | { kind: "DrawPoints"; style: string; points: string[] }
  | { kind: "LabelPoints"; points: string[] }
  | { kind: "LabelPoint"; name: string; text: string };

type PointStyleDef = {
  styleName: string;
  styleExpr: string;
};

export function buildTikzIR(scene: SceneModel): TikzCommand[] {
  const pointById = new Map(scene.points.map((p) => [p.id, p]));
  const lineById = new Map(scene.lines.map((l) => [l.id, l]));
  const segById = new Map(scene.segments.map((s) => [s.id, s]));
  const circleById = new Map(scene.circles.map((c) => [c.id, c]));

  const pointName = buildPointNameMap(scene.points);

  const defs: TikzCommand[] = [];
  const constructions: TikzCommand[] = [];
  const draws: TikzCommand[] = [];
  const definedPointIds = new Set<string>();

  const freeItems: Array<{ name: string; x: number; y: number }> = [];

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const resolvePoint = (pointId: string) => {
    if (visited.has(pointId)) return;
    if (visiting.has(pointId)) throw new Error(`Cycle detected at point ${pointId}`);
    const point = pointById.get(pointId);
    if (!point) throw new Error(`Missing point ${pointId}`);

    visiting.add(pointId);

    const name = mustName(pointName, point.id);

    if (point.kind === "free") {
      freeItems.push({ name, x: point.position.x, y: point.position.y });
      definedPointIds.add(point.id);
    } else if (point.kind === "midpointPoints") {
      resolvePoint(point.aId);
      resolvePoint(point.bId);
      constructions.push({
        kind: "DefMidPoint",
        name,
        a: mustName(pointName, point.aId),
        b: mustName(pointName, point.bId),
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "midpointSegment") {
      const seg = segById.get(point.segId);
      if (!seg) throw new Error(`Missing segment ${point.segId}`);
      resolvePoint(seg.aId);
      resolvePoint(seg.bId);
      constructions.push({
        kind: "DefMidPoint",
        name,
        a: mustName(pointName, seg.aId),
        b: mustName(pointName, seg.bId),
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "pointOnLine") {
      const line = lineById.get(point.lineId);
      if (!line) throw new Error(`Missing line ${point.lineId}`);
      resolvePoint(line.aId);
      resolvePoint(line.bId);
      constructions.push({
        kind: "DefPointOnLine",
        name,
        a: mustName(pointName, line.aId),
        b: mustName(pointName, line.bId),
        // Kept for renderer param-preserving homothety while keeping public union shape unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (constructions[constructions.length - 1] as any).t = point.s;
      definedPointIds.add(point.id);
    } else if (point.kind === "pointOnSegment") {
      const seg = segById.get(point.segId);
      if (!seg) throw new Error(`Missing segment ${point.segId}`);
      resolvePoint(seg.aId);
      resolvePoint(seg.bId);
      constructions.push({
        kind: "DefPointOnLine",
        name,
        a: mustName(pointName, seg.aId),
        b: mustName(pointName, seg.bId),
        // Kept for renderer param-preserving homothety while keeping public union shape unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (constructions[constructions.length - 1] as any).t = point.u;
      definedPointIds.add(point.id);
    } else if (point.kind === "pointOnCircle") {
      const circle = circleById.get(point.circleId);
      if (!circle) throw new Error(`Missing circle ${point.circleId}`);
      resolvePoint(circle.centerId);
      resolvePoint(circle.throughId);
      constructions.push({
        kind: "DefPointOnCircle",
        name,
        center: mustName(pointName, circle.centerId),
        through: mustName(pointName, circle.throughId),
        theta: point.t,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "circleLineIntersectionPoint") {
      const circle = circleById.get(point.circleId);
      const line = lineById.get(point.lineId);
      if (!circle || !line) throw new Error(`Missing circle/line for ${point.id}`);
      resolvePoint(line.aId);
      resolvePoint(line.bId);
      resolvePoint(circle.centerId);
      resolvePoint(circle.throughId);
      let branch: 0 | 1 = point.branchIndex;
      if (point.excludePointId) {
        branch = inferLineCircleBranchFromExcluded(
          scene,
          line.aId,
          line.bId,
          circle.centerId,
          circle.throughId,
          point.excludePointId,
          point.branchIndex
        );
      }
      let commonName: string | undefined;
      if (point.excludePointId) {
        commonName = mustName(pointName, point.excludePointId);
      } else if (point.branchIndex === 1) {
        const sibling = scene.points.find(
          (p) =>
            p.kind === "circleLineIntersectionPoint" &&
            p.id !== point.id &&
            p.circleId === point.circleId &&
            p.lineId === point.lineId &&
            p.branchIndex === 0
        );
        if (sibling) {
          resolvePoint(sibling.id);
          if (definedPointIds.has(sibling.id)) commonName = mustName(pointName, sibling.id);
        }
      }
      constructions.push({
        kind: "InterLC",
        name,
        lineA: mustName(pointName, line.aId),
        lineB: mustName(pointName, line.bId),
        circleO: mustName(pointName, circle.centerId),
        circleX: mustName(pointName, circle.throughId),
        branch,
        common: commonName,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "intersectionPoint") {
      const llA = lineLikeFromRef(point.objA, lineById, segById);
      const llB = lineLikeFromRef(point.objB, lineById, segById);
      const cA = circleFromRef(point.objA, circleById);
      const cB = circleFromRef(point.objB, circleById);

      if (llA && llB) {
        resolvePoint(llA.aId);
        resolvePoint(llA.bId);
        resolvePoint(llB.aId);
        resolvePoint(llB.bId);
        constructions.push({
          kind: "InterLL",
          name,
          a1: mustName(pointName, llA.aId),
          a2: mustName(pointName, llA.bId),
          b1: mustName(pointName, llB.aId),
          b2: mustName(pointName, llB.bId),
        });
        definedPointIds.add(point.id);
      } else {
        const mixed = llA && cB ? { ll: llA, c: cB } : llB && cA ? { ll: llB, c: cA } : null;
        if (!mixed && cA && cB) {
          resolvePoint(cA.centerId);
          resolvePoint(cA.throughId);
          resolvePoint(cB.centerId);
          resolvePoint(cB.throughId);
          const branch = inferCircleCircleBranch(scene, point, cA.centerId, cA.throughId, cB.centerId, cB.throughId);
          let commonName: string | undefined;
          if (branch === 1) {
            const sibling = scene.points.find((p) => {
              if (p.id === point.id || p.kind !== "intersectionPoint") return false;
              const aCircle = isCircleRef(point.objA) && isCircleRef(point.objB);
              const bCircle = isCircleRef(p.objA) && isCircleRef(p.objB);
              if (!aCircle || !bCircle) return false;
              return sameObjectPair(p.objA, p.objB, point.objA, point.objB) && definedPointIds.has(p.id);
            });
            if (sibling) commonName = mustName(pointName, sibling.id);
          }
          constructions.push({
            kind: "InterCC",
            name,
            circleAO: mustName(pointName, cA.centerId),
            circleAX: mustName(pointName, cA.throughId),
            circleBO: mustName(pointName, cB.centerId),
            circleBX: mustName(pointName, cB.throughId),
            branch,
            common: commonName,
          });
          definedPointIds.add(point.id);
        } else {
          if (!mixed) {
            throw new Error(
              `Unsupported intersection construction for point ${point.name}: ${point.objA.type}-${point.objB.type}`
            );
          }
          resolvePoint(mixed.ll.aId);
          resolvePoint(mixed.ll.bId);
          resolvePoint(mixed.c.centerId);
          resolvePoint(mixed.c.throughId);
          const branch = inferLineCircleBranch(scene, point, mixed.ll.aId, mixed.ll.bId, mixed.c.centerId, mixed.c.throughId);
          let commonName: string | undefined;
          if (branch === 1) {
            const sibling = scene.points.find(
              (p) =>
                p.kind === "intersectionPoint" &&
                p.id !== point.id &&
                sameObjectPair(p.objA, p.objB, point.objA, point.objB) &&
                definedPointIds.has(p.id)
            );
            if (sibling) commonName = mustName(pointName, sibling.id);
          }
          if (!commonName) {
            commonName = inferLineCircleCommonFromEndpoints(
              scene,
              mixed.ll.aId,
              mixed.ll.bId,
              mixed.c.centerId,
              mixed.c.throughId,
              branch,
              pointName
            );
          }
          constructions.push({
            kind: "InterLC",
            name,
            lineA: mustName(pointName, mixed.ll.aId),
            lineB: mustName(pointName, mixed.ll.bId),
            circleO: mustName(pointName, mixed.c.centerId),
            circleX: mustName(pointName, mixed.c.throughId),
            branch,
            common: commonName,
          });
          definedPointIds.add(point.id);
        }
      }
    }

    visiting.delete(pointId);
    visited.add(pointId);
  };

  for (const point of scene.points) {
    resolvePoint(point.id);
  }

  if (freeItems.length > 0) {
    freeItems.sort((a, b) => a.name.localeCompare(b.name));
    defs.push({ kind: "DefPoints", items: freeItems });
  }

  // Strictness: every visible point must be defined by supported constructions.
  const undefinedVisible: string[] = [];
  for (const point of scene.points) {
    if (!point.visible) continue;
    if (definedPointIds.has(point.id)) continue;
    undefinedVisible.push(point.name);
  }
  if (undefinedVisible.length > 0) {
    undefinedVisible.sort((a, b) => a.localeCompare(b));
    throw new Error(`Unsupported point constructions in exporter: ${undefinedVisible.join(", ")}`);
  }

  for (const seg of scene.segments) {
    if (!seg.visible) continue;
    draws.push({ kind: "DrawSegment", a: mustName(pointName, seg.aId), b: mustName(pointName, seg.bId) });
  }
  for (const line of scene.lines) {
    if (!line.visible) continue;
    const ext = computeLineDrawPlacement(scene, line.aId, line.bId);
    draws.push({
      kind: "DrawLine",
      a: mustName(pointName, ext.drawAId),
      b: mustName(pointName, ext.drawBId),
      addLeft: ext.addLeft,
      addRight: ext.addRight,
    });
  }
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    draws.push({ kind: "DrawCircle", o: mustName(pointName, circle.centerId), x: mustName(pointName, circle.throughId) });
  }

  const pointStyleGroups = buildPointStyleGroups(scene.points, pointName);
  for (const group of pointStyleGroups) {
    draws.push({ kind: "DrawPoints", style: group.styleName, points: group.points } as TikzCommand);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draws[draws.length - 1] as any).styleExpr = group.styleExpr;
  }

  const nameLabels: string[] = [];
  const captionLabels: Array<{ name: string; text: string }> = [];
  for (const point of scene.points) {
    if (!point.visible) continue;
    if (point.showLabel === "none") continue;
    const name = pointName.get(point.id);
    if (!name) continue;
    if (point.showLabel === "name") {
      nameLabels.push(name);
    } else {
      captionLabels.push({ name, text: point.captionTex || point.name || name });
    }
  }
  nameLabels.sort((a, b) => a.localeCompare(b));
  captionLabels.sort((a, b) => a.name.localeCompare(b.name));
  if (nameLabels.length > 0) draws.push({ kind: "LabelPoints", points: nameLabels });
  for (const item of captionLabels) draws.push({ kind: "LabelPoint", name: item.name, text: item.text });

  return [...defs, ...constructions, ...draws];
}

export function renderTikz(cmds: TikzCommand[]): string {
  const pointsDefs = cmds.filter((c) => c.kind === "DefPoints");
  const constructions = cmds.filter(
    (c) =>
      c.kind !== "DefPoints" &&
      c.kind !== "DrawSegment" &&
      c.kind !== "DrawLine" &&
      c.kind !== "DrawCircle" &&
      c.kind !== "DrawPoints" &&
      c.kind !== "LabelPoints" &&
      c.kind !== "LabelPoint"
  );
  const drawObjects = cmds.filter((c) => c.kind === "DrawSegment" || c.kind === "DrawLine" || c.kind === "DrawCircle");
  const drawPoints = cmds.filter((c) => c.kind === "DrawPoints");
  const drawLabels = cmds.filter((c) => c.kind === "LabelPoints" || c.kind === "LabelPoint");

  const out: string[] = [];
  out.push("\\begin{tikzpicture}");

  // Emit predefined styles used by tkzDrawPoints[...] commands.
  const pointStyles = extractPointStyles(cmds);
  for (const style of pointStyles) {
    out.push(`\\tikzset{${style.styleName}/.style={${style.styleExpr}}}`);
  }

  out.push("% Points");
  for (const cmd of pointsDefs) {
    const items = cmd.items.map((it) => `${fmt(it.x)}/${fmt(it.y)}/${it.name}`).join(", ");
    out.push(`\\tkzDefPoints{${items}}`);
  }

  out.push("% Constructions");
  let interLCTmpIdx = 0;
  for (const cmd of constructions) {
    if (cmd.kind === "DefMidPoint") {
      out.push(`\\tkzDefMidPoint(${cmd.a},${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnLine") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tRaw = (cmd as any).t;
      const t = typeof tRaw === "number" && Number.isFinite(tRaw) ? tRaw : 0.5;
      out.push(`\\tkzDefPointBy[homothety=center ${cmd.a} ratio ${fmt(t)}](${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnCircle") {
      const deg = (cmd.theta * 180) / Math.PI;
      out.push(`\\tkzDefPointOnCircle[through = center ${cmd.center} angle ${fmt(deg)} point ${cmd.through}]`);
      out.push(`\\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLL") {
      out.push(`\\tkzInterLL(${cmd.a1},${cmd.a2})(${cmd.b1},${cmd.b2}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLC") {
      const canSwap = cmd.lineA !== cmd.lineB;
      const shouldSwap = !cmd.common && canSwap && cmd.branch === 1;
      const la = shouldSwap ? cmd.lineB : cmd.lineA;
      const lb = shouldSwap ? cmd.lineA : cmd.lineB;
      interLCTmpIdx += 1;
      const other = `tkzInterLC_${interLCTmpIdx}_other`;
      const opt = cmd.common ? `[common=${cmd.common}]` : "";
      out.push(`\\tkzInterLC${opt}(${la},${lb})(${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${cmd.name}}{${other}}`);
      continue;
    }
    if (cmd.kind === "InterCC") {
      const canSwap = cmd.circleAO !== cmd.circleBO || cmd.circleAX !== cmd.circleBX;
      const shouldSwap = !cmd.common && canSwap && cmd.branch === 1;
      const ao = shouldSwap ? cmd.circleBO : cmd.circleAO;
      const ax = shouldSwap ? cmd.circleBX : cmd.circleAX;
      const bo = shouldSwap ? cmd.circleAO : cmd.circleBO;
      const bx = shouldSwap ? cmd.circleAX : cmd.circleBX;
      interLCTmpIdx += 1;
      const other = `tkzInterCC_${interLCTmpIdx}_other`;
      const opt = cmd.common ? `[common=${cmd.common}]` : "";
      out.push(`\\tkzInterCC${opt}(${ao},${ax})(${bo},${bx}) \\tkzGetPoints{${cmd.name}}{${other}}`);
    }
  }

  out.push("% Draw objects");
  for (const cmd of drawObjects) {
    if (cmd.kind === "DrawSegment") {
      out.push(`\\tkzDrawSegment(${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawLine") {
      out.push(`\\tkzDrawLine[add=${fmt(cmd.addLeft)} and ${fmt(cmd.addRight)}](${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawCircle") {
      out.push(`\\tkzDrawCircle(${cmd.o},${cmd.x})`);
    }
  }

  out.push("% Draw points");
  for (const cmd of drawPoints) {
    if (cmd.points.length === 0) continue;
    out.push(`\\tkzDrawPoints[${cmd.style}](${cmd.points.join(",")})`);
  }

  out.push("% Labels");
  for (const cmd of drawLabels) {
    if (cmd.kind === "LabelPoints") {
      if (cmd.points.length === 0) continue;
      out.push(`\\tkzLabelPoints(${cmd.points.join(",")})`);
      continue;
    }
    out.push(`\\tkzLabelPoint(${cmd.name}){${escapeTikzText(cmd.text)}}`);
  }

  out.push("\\end{tikzpicture}");
  return out.join("\n");
}

export function exportTikz(scene: SceneModel): string {
  return renderTikz(buildTikzIR(scene));
}

function buildPointNameMap(points: ScenePoint[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const p of points) {
    // Point names are already validated in-app; keep them verbatim for identity fidelity.
    names.set(p.id, p.name);
  }
  return names;
}

function mustName(names: Map<string, string>, pointId: string): string {
  const v = names.get(pointId);
  if (!v) throw new Error(`Missing point name for ${pointId}`);
  return v;
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return Number(v.toPrecision(15)).toString();
}

function lineLikeFromRef(
  ref: GeometryObjectRef,
  lineById: Map<string, SceneModel["lines"][number]>,
  segById: Map<string, SceneModel["segments"][number]>
): { aId: string; bId: string } | null {
  if (ref.type === "line") {
    const line = lineById.get(ref.id);
    if (!line) return null;
    return { aId: line.aId, bId: line.bId };
  }
  if (ref.type === "segment") {
    const seg = segById.get(ref.id);
    if (!seg) return null;
    return { aId: seg.aId, bId: seg.bId };
  }
  return null;
}

function circleFromRef(
  ref: GeometryObjectRef,
  circleById: Map<string, SceneModel["circles"][number]>
): SceneModel["circles"][number] | null {
  if (ref.type !== "circle") return null;
  return circleById.get(ref.id) ?? null;
}

function inferLineCircleBranch(
  scene: SceneModel,
  point: Extract<ScenePoint, { kind: "intersectionPoint" }>,
  lineAId: string,
  lineBId: string,
  circleOId: string,
  circleXId: string
): 0 | 1 {
  const lineA = scene.points.find((p) => p.id === lineAId);
  const lineB = scene.points.find((p) => p.id === lineBId);
  const circleO = scene.points.find((p) => p.id === circleOId);
  const circleX = scene.points.find((p) => p.id === circleXId);
  if (!lineA || !lineB || !circleO || !circleX) return 0;

  const a = getPointWorldPos(lineA, scene);
  const b = getPointWorldPos(lineB, scene);
  const o = getPointWorldPos(circleO, scene);
  const x = getPointWorldPos(circleX, scene);
  if (!a || !b || !o || !x) return 0;

  const radius = distance(o, x);
  const branches = lineCircleIntersectionBranches(a, b, o, radius);
  if (branches.length < 2) return 0;

  const d0 = distance(branches[0].point, point.preferredWorld);
  const d1 = distance(branches[1].point, point.preferredWorld);
  return d1 < d0 ? 1 : 0;
}

function inferLineCircleBranchFromExcluded(
  scene: SceneModel,
  lineAId: string,
  lineBId: string,
  circleOId: string,
  circleXId: string,
  excludePointId: string,
  fallback: 0 | 1
): 0 | 1 {
  const lineA = scene.points.find((p) => p.id === lineAId);
  const lineB = scene.points.find((p) => p.id === lineBId);
  const circleO = scene.points.find((p) => p.id === circleOId);
  const circleX = scene.points.find((p) => p.id === circleXId);
  const excluded = scene.points.find((p) => p.id === excludePointId);
  if (!lineA || !lineB || !circleO || !circleX || !excluded) return fallback;

  const a = getPointWorldPos(lineA, scene);
  const b = getPointWorldPos(lineB, scene);
  const o = getPointWorldPos(circleO, scene);
  const x = getPointWorldPos(circleX, scene);
  const ex = getPointWorldPos(excluded, scene);
  if (!a || !b || !o || !x || !ex) return fallback;

  const radius = distance(o, x);
  const branches = lineCircleIntersectionBranches(a, b, o, radius);
  if (branches.length < 2) return 0;

  const ROOT_EPS = 1e-6;
  const d0 = distance(branches[0].point, ex);
  const d1 = distance(branches[1].point, ex);
  if (d0 <= ROOT_EPS && d1 > ROOT_EPS) return 1;
  if (d1 <= ROOT_EPS && d0 > ROOT_EPS) return 0;
  return fallback;
}

function inferCircleCircleBranch(
  scene: SceneModel,
  point: Extract<ScenePoint, { kind: "intersectionPoint" }>,
  aCenterId: string,
  aThroughId: string,
  bCenterId: string,
  bThroughId: string
): 0 | 1 {
  const aCenterPoint = scene.points.find((p) => p.id === aCenterId);
  const aThroughPoint = scene.points.find((p) => p.id === aThroughId);
  const bCenterPoint = scene.points.find((p) => p.id === bCenterId);
  const bThroughPoint = scene.points.find((p) => p.id === bThroughId);
  if (!aCenterPoint || !aThroughPoint || !bCenterPoint || !bThroughPoint) return 0;
  const aCenter = getPointWorldPos(aCenterPoint, scene);
  const aThrough = getPointWorldPos(aThroughPoint, scene);
  const bCenter = getPointWorldPos(bCenterPoint, scene);
  const bThrough = getPointWorldPos(bThroughPoint, scene);
  if (!aCenter || !aThrough || !bCenter || !bThrough) return 0;

  const ra = distance(aCenter, aThrough);
  const rb = distance(bCenter, bThrough);
  const intersections = circleCircleIntersections(aCenter, ra, bCenter, rb);
  if (intersections.length < 2) return 0;

  const d0 = distance(intersections[0], point.preferredWorld);
  const d1 = distance(intersections[1], point.preferredWorld);
  return d1 < d0 ? 1 : 0;
}

function isCircleRef(ref: GeometryObjectRef): boolean {
  return ref.type === "circle";
}

function sameObjectPair(a1: GeometryObjectRef, b1: GeometryObjectRef, a2: GeometryObjectRef, b2: GeometryObjectRef): boolean {
  return (sameObjectRef(a1, a2) && sameObjectRef(b1, b2)) || (sameObjectRef(a1, b2) && sameObjectRef(b1, a2));
}

function sameObjectRef(a: GeometryObjectRef, b: GeometryObjectRef): boolean {
  return a.type === b.type && a.id === b.id;
}

function inferLineCircleCommonFromEndpoints(
  scene: SceneModel,
  lineAId: string,
  lineBId: string,
  circleOId: string,
  circleXId: string,
  selectedBranch: 0 | 1,
  pointName: Map<string, string>
): string | undefined {
  const lineA = scene.points.find((p) => p.id === lineAId);
  const lineB = scene.points.find((p) => p.id === lineBId);
  const circleO = scene.points.find((p) => p.id === circleOId);
  const circleX = scene.points.find((p) => p.id === circleXId);
  if (!lineA || !lineB || !circleO || !circleX) return undefined;

  const a = getPointWorldPos(lineA, scene);
  const b = getPointWorldPos(lineB, scene);
  const o = getPointWorldPos(circleO, scene);
  const x = getPointWorldPos(circleX, scene);
  if (!a || !b || !o || !x) return undefined;

  const radius = distance(o, x);
  const branches = lineCircleIntersectionBranches(a, b, o, radius);
  if (branches.length < 2) return undefined;

  const ROOT_EPS = 1e-6;
  const aD0 = distance(a, branches[0].point);
  const aD1 = distance(a, branches[1].point);
  const bD0 = distance(b, branches[0].point);
  const bD1 = distance(b, branches[1].point);
  const aMatch = aD0 <= ROOT_EPS ? 0 : aD1 <= ROOT_EPS ? 1 : null;
  const bMatch = bD0 <= ROOT_EPS ? 0 : bD1 <= ROOT_EPS ? 1 : null;

  if (aMatch !== null && bMatch === null && selectedBranch !== aMatch) return pointName.get(lineAId);
  if (bMatch !== null && aMatch === null && selectedBranch !== bMatch) return pointName.get(lineBId);
  return undefined;
}

function computeLineDrawPlacement(
  scene: SceneModel,
  lineAId: string,
  lineBId: string
): { drawAId: string; drawBId: string; addLeft: number; addRight: number } {
  const aPoint = scene.points.find((p) => p.id === lineAId);
  const bPoint = scene.points.find((p) => p.id === lineBId);
  if (!aPoint || !bPoint) return { drawAId: lineAId, drawBId: lineBId, addLeft: 1, addRight: 1 };
  const a = getPointWorldPos(aPoint, scene);
  const b = getPointWorldPos(bPoint, scene);
  if (!a || !b) return { drawAId: lineAId, drawBId: lineBId, addLeft: 1, addRight: 1 };

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dd = dx * dx + dy * dy;
  if (dd <= 1e-12) return { drawAId: lineAId, drawBId: lineBId, addLeft: 1, addRight: 1 };
  const len = Math.sqrt(dd);

  const distTol = Math.max(1e-8, len * 1e-8);
  const candidates: Array<{ id: string; s: number; world: { x: number; y: number } }> = [];

  for (const p of scene.points) {
    const w = getPointWorldPos(p, scene);
    if (!w) continue;
    const ux = w.x - a.x;
    const uy = w.y - a.y;
    const s = (ux * dx + uy * dy) / dd;
    const px = a.x + s * dx;
    const py = a.y + s * dy;
    const dist = Math.hypot(w.x - px, w.y - py);
    if (dist > distTol) continue;
    candidates.push({ id: p.id, s, world: w });
  }

  if (candidates.length === 0) {
    return { drawAId: lineAId, drawBId: lineBId, addLeft: 0.4, addRight: 0.4 };
  }

  candidates.sort((p1, p2) => p1.s - p2.s);
  const minCand = candidates[0];
  const maxCand = candidates[candidates.length - 1];
  const drawAId = minCand.id;
  const drawBId = maxCand.id;
  if (drawAId === drawBId) {
    return { drawAId: lineAId, drawBId: lineBId, addLeft: 0.4, addRight: 0.4 };
  }

  const drawA = minCand.world;
  const drawB = maxCand.world;
  const ddx = drawB.x - drawA.x;
  const ddy = drawB.y - drawA.y;
  const ddDraw = ddx * ddx + ddy * ddy;
  if (ddDraw <= 1e-12) {
    return { drawAId: lineAId, drawBId: lineBId, addLeft: 0.4, addRight: 0.4 };
  }
  const lenDraw = Math.sqrt(ddDraw);

  let minT = 0;
  let maxT = 1;
  for (const c of candidates) {
    const ux = c.world.x - drawA.x;
    const uy = c.world.y - drawA.y;
    const t = (ux * ddx + uy * ddy) / ddDraw;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }

  const margin = Math.max(0.08, 0.03 * lenDraw);
  const addLeft = Math.max(0.15, -minT * lenDraw + margin);
  const addRight = Math.max(0.15, (maxT - 1) * lenDraw + margin);
  return { drawAId, drawBId, addLeft, addRight };
}

function buildPointStyleGroups(
  points: ScenePoint[],
  pointName: Map<string, string>
): Array<{ styleName: string; points: string[]; styleExpr: string }> {
  const groups = new Map<string, { styleName: string; points: string[]; styleExpr: string }>();
  let idx = 0;

  for (const point of points) {
    if (!point.visible) continue;
    const name = pointName.get(point.id);
    if (!name) continue;

    const key = styleKey(point);
    if (!groups.has(key)) {
      const styleName = idx === 0 ? "tkzVertex" : `tkzVertex${idx}`;
      idx += 1;
      groups.set(key, {
        styleName,
        points: [],
        styleExpr: pointStyleToTikz(point),
      });
    }

    const group = groups.get(key)!;
    group.points.push(name);
  }

  const ordered = [...groups.values()];
  for (const group of ordered) {
    group.points.sort((a, b) => a.localeCompare(b));
  }
  ordered.sort((a, b) => a.styleName.localeCompare(b.styleName));
  return ordered;
}

function extractPointStyles(cmds: TikzCommand[]): PointStyleDef[] {
  const defs: PointStyleDef[] = [];
  const seen = new Set<string>();

  for (const cmd of cmds) {
    if (cmd.kind !== "DrawPoints") continue;
    if (seen.has(cmd.style)) continue;
    seen.add(cmd.style);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const styleExpr = (cmd as any).styleExpr as string | undefined;
    if (!styleExpr) continue;
    defs.push({ styleName: cmd.style, styleExpr });
  }

  return defs;
}

function styleKey(point: ScenePoint): string {
  const s = point.style;
  return JSON.stringify({
    shape: s.shape,
    sizePx: s.sizePx,
    strokeColor: s.strokeColor,
    strokeWidth: s.strokeWidth,
    strokeOpacity: s.strokeOpacity,
    fillColor: s.fillColor,
    fillOpacity: s.fillOpacity,
  });
}

function pointStyleToTikz(point: ScenePoint): string {
  const s = point.style;
  const shape = mapPointShape(s.shape);
  const draw = rgbColorExpr(s.strokeColor);
  const fill = rgbColorExpr(s.fillColor);
  const lineWidthPt = Math.max(0.1, s.strokeWidth * 0.75);
  const sizePt = Math.max(0.4, s.sizePx * 0.75);
  const opts = [
    shape,
    `draw=${draw}`,
    `fill=${fill}`,
    `line width=${fmt(lineWidthPt)}pt`,
    `minimum size=${fmt(sizePt)}pt`,
  ];
  if (s.strokeOpacity < 0.999) opts.push(`draw opacity=${fmt(clamp01(s.strokeOpacity))}`);
  if (s.fillOpacity < 0.999) opts.push(`fill opacity=${fmt(clamp01(s.fillOpacity))}`);
  return opts.join(", ");
}

function mapPointShape(shape: ScenePoint["style"]["shape"]): string {
  switch (shape) {
    case "square":
      return "rectangle";
    case "diamond":
      return "diamond";
    case "triUp":
      return "regular polygon, regular polygon sides=3";
    case "triDown":
      return "regular polygon, regular polygon sides=3, shape border rotate=180";
    case "dot":
      return "circle";
    case "circle":
    case "plus":
    case "x":
    case "cross":
    default:
      return "circle";
  }
}

function rgbColorExpr(hex: string): string {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    /^[0-9a-fA-F]{6}$/.test(clean)
      ? clean
      : /^[0-9a-fA-F]{3}$/.test(clean)
        ? clean
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : "000000";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `{rgb,255:red,${r};green,${g};blue,${b}}`;
}

function escapeTikzText(value: string): string {
  return value.replace(/[{}]/g, (m) => (m === "{" ? "\\{" : "\\}"));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
