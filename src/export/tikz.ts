import { circleCircleIntersections, distance, lineCircleIntersectionBranches } from "../geo/geometry";
import {
  getLineWorldAnchors,
  getPointWorldPos,
  type GeometryObjectRef,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";
import tkzMacroWhitelist from "../../docs/tkz-euclide-macros.json";
import { assertNoUnknownTkzMacro } from "./tkzWhitelist";

export type TikzExportViewport = { xmin: number; xmax: number; ymin: number; ymax: number };
export type TikzExportOptions = {
  viewport?: TikzExportViewport;
  clipSpace?: number;
  globalLineAdd?: number;
  pointScale?: number;
  lineScale?: number;
};

export type TikzCommand =
  | { kind: "SetupViewport"; xmin: number; xmax: number; ymin: number; ymax: number; space: number }
  | { kind: "SetupLine"; addLeft: number; addRight: number }
  | { kind: "DefPoints"; items: { name: string; x: number; y: number }[] }
  | { kind: "DefPoint"; name: string; x: number; y: number }
  | { kind: "DefPointOnLine"; name: string; a: string; b: string }
  | { kind: "DefPerpendicularLine"; auxName: string; through: string; baseA: string; baseB: string }
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
      selector?: { name: string; x: number; y: number };
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
      selector?: { name: string; x: number; y: number };
    }
  | { kind: "DrawSegment"; a: string; b: string; style?: string }
  | { kind: "DrawLine"; a: string; b: string; addLeft: number; addRight: number; style?: string }
  | { kind: "DrawCircle"; o: string; x: string; style?: string }
  | { kind: "DrawPoints"; style: string; points: string[] }
  | { kind: "LabelPoints"; points: string[] }
  | { kind: "LabelPoint"; name: string; text: string; options?: string };

type PointStyleDef = {
  styleName: string;
  styleExpr: string;
};

export function buildTikzIR(scene: SceneModel, options: TikzExportOptions = {}): TikzCommand[] {
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
  const viewport = options.viewport ?? computeExportViewport(scene);
  defs.push({ kind: "SetupViewport", ...viewport, space: options.clipSpace ?? 0 });
  const globalAdd = options.globalLineAdd ?? 5;
  defs.push({ kind: "SetupLine", addLeft: globalAdd, addRight: globalAdd });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const lineAnchorNames = new Map<string, { a: string; b: string }>();
  let selectorIndex = 0;
  let perpAuxIndex = 0;

  const newSelectorName = (kind: "LC" | "CC"): string => {
    selectorIndex += 1;
    return `tkzSel${kind}_${selectorIndex}`;
  };

  const resolveLineAnchorsById = (lineId: string): { a: string; b: string } => {
    const cached = lineAnchorNames.get(lineId);
    if (cached) return cached;
    const line = lineById.get(lineId);
    if (!line) throw new Error(`Missing line ${lineId}`);
    if (line.kind === "perpendicular") {
      resolvePoint(line.throughId);
      const base = resolveLineLikeNames(line.base);
      perpAuxIndex += 1;
      const auxName = `tkzPerp_${perpAuxIndex}`;
      constructions.push({
        kind: "DefPerpendicularLine",
        auxName,
        through: mustName(pointName, line.throughId),
        baseA: base.a,
        baseB: base.b,
      });
      const anchors = { a: mustName(pointName, line.throughId), b: auxName };
      lineAnchorNames.set(lineId, anchors);
      return anchors;
    }
    resolvePoint(line.aId);
    resolvePoint(line.bId);
    const anchors = { a: mustName(pointName, line.aId), b: mustName(pointName, line.bId) };
    lineAnchorNames.set(lineId, anchors);
    return anchors;
  };

  const resolveLineLikeNames = (ref: { type: "line" | "segment"; id: string }): { a: string; b: string } => {
    if (ref.type === "segment") {
      const seg = segById.get(ref.id);
      if (!seg) throw new Error(`Missing segment ${ref.id}`);
      resolvePoint(seg.aId);
      resolvePoint(seg.bId);
      return { a: mustName(pointName, seg.aId), b: mustName(pointName, seg.bId) };
    }
    return resolveLineAnchorsById(ref.id);
  };

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
      const lineAnchors = resolveLineAnchorsById(point.lineId);
      constructions.push({
        kind: "DefPointOnLine",
        name,
        a: lineAnchors.a,
        b: lineAnchors.b,
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
      const lineAnchors = resolveLineAnchorsById(point.lineId);
      resolvePoint(circle.centerId);
      resolvePoint(circle.throughId);
      const lineWorld = getLineWorldAnchors(line, scene);
      const center = getPointWorldPosCached(scene, circle.centerId);
      const through = getPointWorldPosCached(scene, circle.throughId);
      if (!lineWorld || !center || !through) throw new Error(`Undefined line/circle geometry for ${point.name}`);
      let branch: 0 | 1 = point.branchIndex;
      if (point.excludePointId) {
        const excluded = getPointWorldPosCached(scene, point.excludePointId);
        if (excluded) {
          branch = inferLineCircleBranchFromExcludedWorld(
            lineWorld.a,
            lineWorld.b,
            center,
            through,
            excluded,
            point.branchIndex
          );
        }
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
      let selector: { name: string; x: number; y: number } | undefined;
      if (!commonName) {
        const other = inferOtherLineCircleBranchPointFromWorld(lineWorld.a, lineWorld.b, center, through, branch);
        if (other) {
          selector = { name: newSelectorName("LC"), x: other.x, y: other.y };
          commonName = selector.name;
        }
      }
      constructions.push({
        kind: "InterLC",
        name,
        lineA: lineAnchors.a,
        lineB: lineAnchors.b,
        circleO: mustName(pointName, circle.centerId),
        circleX: mustName(pointName, circle.throughId),
        branch,
        common: commonName,
        selector,
      });
      definedPointIds.add(point.id);
    } else if (point.kind === "intersectionPoint") {
      const llA = lineLikeNamesFromRef(point.objA, resolveLineAnchorsById, scene, lineById, segById, pointName, resolvePoint);
      const llB = lineLikeNamesFromRef(point.objB, resolveLineAnchorsById, scene, lineById, segById, pointName, resolvePoint);
      const cA = circleFromRef(point.objA, circleById);
      const cB = circleFromRef(point.objB, circleById);

      if (llA && llB) {
        constructions.push({
          kind: "InterLL",
          name,
          a1: llA.a,
          a2: llA.b,
          b1: llB.a,
          b2: llB.b,
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
          let selector: { name: string; x: number; y: number } | undefined;
          if (!commonName) {
            const other = inferOtherCircleCircleBranchPoint(scene, cA.centerId, cA.throughId, cB.centerId, cB.throughId, branch);
            if (other) {
              selector = { name: newSelectorName("CC"), x: other.x, y: other.y };
              commonName = selector.name;
            }
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
            selector,
          });
          definedPointIds.add(point.id);
        } else {
          if (!mixed) {
            throw new Error(
              `Unsupported intersection construction for point ${point.name}: ${point.objA.type}-${point.objB.type}`
            );
          }
          resolvePoint(mixed.c.centerId);
          resolvePoint(mixed.c.throughId);
          const center = getPointWorldPosCached(scene, mixed.c.centerId);
          const through = getPointWorldPosCached(scene, mixed.c.throughId);
          if (!center || !through) throw new Error(`Undefined circle geometry for ${point.name}`);
          const branch = inferLineCircleBranchFromWorld(point, mixed.ll.worldA, mixed.ll.worldB, center, through);
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
            commonName = inferLineCircleCommonFromEndpointsWorld(
              mixed.ll.endpointAId,
              mixed.ll.endpointBId,
              mixed.ll.worldA,
              mixed.ll.worldB,
              center,
              through,
              branch,
              pointName
            );
          }
          let selector: { name: string; x: number; y: number } | undefined;
          if (!commonName) {
            const other = inferOtherLineCircleBranchPointFromWorld(mixed.ll.worldA, mixed.ll.worldB, center, through, branch);
            if (other) {
              selector = { name: newSelectorName("LC"), x: other.x, y: other.y };
              commonName = selector.name;
            }
          }
          constructions.push({
            kind: "InterLC",
            name,
            lineA: mixed.ll.a,
            lineB: mixed.ll.b,
            circleO: mustName(pointName, mixed.c.centerId),
            circleX: mustName(pointName, mixed.c.throughId),
            branch,
            common: commonName,
            selector,
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

  const undefinedWorldVisible: string[] = [];
  for (const point of scene.points) {
    if (!point.visible) continue;
    const world = getPointWorldPos(point, scene);
    if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) {
      undefinedWorldVisible.push(point.name);
    }
  }
  if (undefinedWorldVisible.length > 0) {
    undefinedWorldVisible.sort((a, b) => a.localeCompare(b));
    throw new Error(
      `Cannot export undefined points in current configuration: ${undefinedWorldVisible.join(
        ", "
      )}. Hide/delete them or adjust construction.`
    );
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
    draws.push({
      kind: "DrawSegment",
      a: mustName(pointName, seg.aId),
      b: mustName(pointName, seg.bId),
      style: segmentStyleToTikz(seg.style, options),
    });
  }
  for (const line of scene.lines) {
    if (!line.visible) continue;
    const lineNames = resolveLineAnchorsById(line.id);
    const ext = computeLineDrawPlacement(scene, line);
    const drawAName =
      ext.drawAId === line.id ? lineNames.b : ext.drawAId === (line.kind === "perpendicular" ? line.throughId : line.aId)
        ? lineNames.a
        : pointName.get(ext.drawAId) ?? ext.drawAId;
    const drawBName =
      ext.drawBId === line.id ? lineNames.b : ext.drawBId === (line.kind === "perpendicular" ? line.throughId : line.aId)
        ? lineNames.a
        : pointName.get(ext.drawBId) ?? ext.drawBId;
    draws.push({
      kind: "DrawLine",
      a: drawAName,
      b: drawBName,
      addLeft: ext.addLeft,
      addRight: ext.addRight,
      style: lineStyleToTikz(line.style, options),
    });
  }
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    draws.push({
      kind: "DrawCircle",
      o: mustName(pointName, circle.centerId),
      x: mustName(pointName, circle.throughId),
      style: circleStyleToTikz(circle.style, options),
    });
  }

  const pointStyleGroups = buildPointStyleGroups(scene.points, pointName, options);
  for (const group of pointStyleGroups) {
    draws.push({ kind: "DrawPoints", style: group.styleName, points: group.points } as TikzCommand);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draws[draws.length - 1] as any).styleExpr = group.styleExpr;
  }

  const labels: Array<{ name: string; text: string; options?: string }> = [];
  for (const point of scene.points) {
    if (!point.visible) continue;
    if (point.showLabel === "none") continue;
    const name = pointName.get(point.id);
    if (!name) continue;
    const options = pointLabelOptionsToTikz(point);
    if (point.showLabel === "name") {
      labels.push({ name, text: point.name || name, options });
    } else {
      labels.push({ name, text: point.captionTex || point.name || name, options });
    }
  }
  labels.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of labels) draws.push({ kind: "LabelPoint", name: item.name, text: item.text, options: item.options });

  return [...defs, ...constructions, ...draws];
}

export function renderTikz(cmds: TikzCommand[]): string {
  const setupViewport = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupViewport" }> => c.kind === "SetupViewport");
  const setupLine = cmds.find((c): c is Extract<TikzCommand, { kind: "SetupLine" }> => c.kind === "SetupLine");
  const pointsDefs = cmds.filter((c) => c.kind === "DefPoints");
  const pointDefs = cmds.filter((c) => c.kind === "DefPoint");
  const constructions = cmds.filter(
    (c) =>
      c.kind !== "DefPoints" &&
      c.kind !== "SetupViewport" &&
      c.kind !== "SetupLine" &&
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
  out.push("\\begin{tikzpicture}[scale=2,line cap=round,line join=round,>=triangle 45]");
  if (setupViewport) {
    assertTkzMacro("tkzInit");
    assertTkzMacro("tkzClip");
    out.push(
      `\\tkzInit[xmin=${fmt(setupViewport.xmin)},xmax=${fmt(setupViewport.xmax)},ymin=${fmt(
        setupViewport.ymin
      )},ymax=${fmt(setupViewport.ymax)}]`
    );
    out.push(`\\tkzClip[space=${fmt(setupViewport.space)}]`);
  }
  if (setupLine) {
    assertTkzMacro("tkzSetUpLine");
    out.push(`\\tkzSetUpLine[add=${fmt(setupLine.addLeft)} and ${fmt(setupLine.addRight)}]`);
  }

  // Emit predefined styles used by tkzDrawPoints[...] commands.
  const pointStyles = extractPointStyles(cmds);
  for (const style of pointStyles) {
    out.push(`\\tikzset{${style.styleName}/.style={${style.styleExpr}}}`);
  }

  out.push("% Points");
  for (const cmd of pointsDefs) {
    assertTkzMacro("tkzDefPoints");
    const items = cmd.items.map((it) => `${fmt(it.x)}/${fmt(it.y)}/${it.name}`).join(", ");
    out.push(`\\tkzDefPoints{${items}}`);
  }
  for (const cmd of pointDefs) {
    assertTkzMacro("tkzDefPoint");
    out.push(`\\tkzDefPoint(${fmt(cmd.x)},${fmt(cmd.y)}){${cmd.name}}`);
  }

  out.push("% Constructions");
  let interLCTmpIdx = 0;
  for (const cmd of constructions) {
    if (cmd.kind === "DefMidPoint") {
      assertTkzMacro("tkzDefMidPoint");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefMidPoint(${cmd.a},${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnLine") {
      assertTkzMacro("tkzDefPointBy");
      assertTkzMacro("tkzGetPoint");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tRaw = (cmd as any).t;
      const t = typeof tRaw === "number" && Number.isFinite(tRaw) ? tRaw : 0.5;
      out.push(`\\tkzDefPointBy[homothety=center ${cmd.a} ratio ${fmt(t)}](${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPerpendicularLine") {
      assertPerpendicularMacro("tkzDefLine");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefLine[perpendicular=through ${cmd.through}](${cmd.baseA},${cmd.baseB}) \\tkzGetPoint{${cmd.auxName}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnCircle") {
      assertTkzMacro("tkzDefPointOnCircle");
      assertTkzMacro("tkzGetPoint");
      const deg = (cmd.theta * 180) / Math.PI;
      out.push(`\\tkzDefPointOnCircle[through = center ${cmd.center} angle ${fmt(deg)} point ${cmd.through}]`);
      out.push(`\\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLL") {
      assertTkzMacro("tkzInterLL");
      assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzInterLL(${cmd.a1},${cmd.a2})(${cmd.b1},${cmd.b2}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLC") {
      if (cmd.selector) {
        assertTkzMacro("tkzDefPoint");
        out.push(`\\tkzDefPoint(${fmt(cmd.selector.x)},${fmt(cmd.selector.y)}){${cmd.selector.name}}`);
      }
      assertTkzMacro("tkzInterLC");
      assertTkzMacro("tkzGetPoints");
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
      if (cmd.selector) {
        assertTkzMacro("tkzDefPoint");
        out.push(`\\tkzDefPoint(${fmt(cmd.selector.x)},${fmt(cmd.selector.y)}){${cmd.selector.name}}`);
      }
      assertTkzMacro("tkzInterCC");
      assertTkzMacro("tkzGetPoints");
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
      assertTkzMacro("tkzDrawSegment");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawSegment${opts}(${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawLine") {
      assertTkzMacro("tkzDrawLine");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawLine${opts}(${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawCircle") {
      assertTkzMacro("tkzDrawCircle");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawCircle${opts}(${cmd.o},${cmd.x})`);
    }
  }

  out.push("% Draw points");
  for (const cmd of drawPoints) {
    if (cmd.points.length === 0) continue;
    assertTkzMacro("tkzDrawPoints");
    out.push(`\\tkzDrawPoints[${cmd.style}](${cmd.points.join(",")})`);
  }

  out.push("% Labels");
  for (const cmd of drawLabels) {
    if (cmd.kind === "LabelPoints") {
      if (cmd.points.length === 0) continue;
      assertTkzMacro("tkzLabelPoints");
      out.push(`\\tkzLabelPoints(${cmd.points.join(",")})`);
      continue;
    }
    assertTkzMacro("tkzLabelPoint");
    const opts = cmd.options ? `[${cmd.options}]` : "";
    out.push(`\\tkzLabelPoint${opts}(${cmd.name}){$${escapeTikzText(cmd.text)}$}`);
  }

  out.push("\\end{tikzpicture}");
  const withNamedColors = hoistNamedColors(out);
  return withNamedColors.join("\n");
}

export function exportTikz(scene: SceneModel): string {
  const tex = renderTikz(buildTikzIR(scene));
  assertNoUnknownTkzMacro(tex);
  return tex;
}

export function exportTikzWithOptions(scene: SceneModel, options: TikzExportOptions): string {
  const tex = renderTikz(buildTikzIR(scene, options));
  assertNoUnknownTkzMacro(tex);
  return tex;
}

export const exportTikZ = (scene: unknown): string => exportTikz(scene as SceneModel);

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

function lineLikeNamesFromRef(
  ref: GeometryObjectRef,
  resolveLineAnchorsById: (lineId: string) => { a: string; b: string },
  scene: SceneModel,
  lineById: Map<string, SceneModel["lines"][number]>,
  segById: Map<string, SceneModel["segments"][number]>,
  pointName: Map<string, string>,
  resolvePoint: (pointId: string) => void
): { a: string; b: string; worldA: { x: number; y: number }; worldB: { x: number; y: number }; endpointAId?: string; endpointBId?: string } | null {
  if (ref.type === "line") {
    const line = lineById.get(ref.id);
    if (!line) return null;
    const names = resolveLineAnchorsById(ref.id);
    const anchors = getLineWorldAnchors(line, scene);
    if (!anchors) return null;
    if (line.kind === "perpendicular") {
      return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.throughId };
    }
    return { a: names.a, b: names.b, worldA: anchors.a, worldB: anchors.b, endpointAId: line.aId, endpointBId: line.bId };
  }
  if (ref.type === "segment") {
    const seg = segById.get(ref.id);
    if (!seg) return null;
    resolvePoint(seg.aId);
    resolvePoint(seg.bId);
    const wa = getPointWorldPosCached(scene, seg.aId);
    const wb = getPointWorldPosCached(scene, seg.bId);
    if (!wa || !wb) return null;
    return {
      a: mustName(pointName, seg.aId),
      b: mustName(pointName, seg.bId),
      worldA: wa,
      worldB: wb,
      endpointAId: seg.aId,
      endpointBId: seg.bId,
    };
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

function inferLineCircleBranchFromWorld(
  point: Extract<ScenePoint, { kind: "intersectionPoint" }>,
  a: { x: number; y: number },
  b: { x: number; y: number },
  center: { x: number; y: number },
  through: { x: number; y: number }
): 0 | 1 {
  const radius = distance(center, through);
  const branches = lineCircleIntersectionBranches(a, b, center, radius);
  if (branches.length < 2) return 0;

  const d0 = distance(branches[0].point, point.preferredWorld);
  const d1 = distance(branches[1].point, point.preferredWorld);
  return d1 < d0 ? 1 : 0;
}

function inferLineCircleBranchFromExcludedWorld(
  a: { x: number; y: number },
  b: { x: number; y: number },
  center: { x: number; y: number },
  through: { x: number; y: number },
  excluded: { x: number; y: number },
  fallback: 0 | 1
): 0 | 1 {
  const radius = distance(center, through);
  const branches = lineCircleIntersectionBranches(a, b, center, radius);
  if (branches.length < 2) return 0;

  const ROOT_EPS = 1e-6;
  const d0 = distance(branches[0].point, excluded);
  const d1 = distance(branches[1].point, excluded);
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
  const aCenter = getPointWorldPosCached(scene, aCenterId);
  const aThrough = getPointWorldPosCached(scene, aThroughId);
  const bCenter = getPointWorldPosCached(scene, bCenterId);
  const bThrough = getPointWorldPosCached(scene, bThroughId);
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

function inferLineCircleCommonFromEndpointsWorld(
  lineAId: string | undefined,
  lineBId: string | undefined,
  lineAWorld: { x: number; y: number },
  lineBWorld: { x: number; y: number },
  circleO: { x: number; y: number },
  circleX: { x: number; y: number },
  selectedBranch: 0 | 1,
  pointName: Map<string, string>
): string | undefined {
  const radius = distance(circleO, circleX);
  const branches = lineCircleIntersectionBranches(lineAWorld, lineBWorld, circleO, radius);
  if (branches.length < 2) return undefined;

  const ROOT_EPS = 1e-6;
  const aD0 = distance(lineAWorld, branches[0].point);
  const aD1 = distance(lineAWorld, branches[1].point);
  const bD0 = distance(lineBWorld, branches[0].point);
  const bD1 = distance(lineBWorld, branches[1].point);
  const aMatch = aD0 <= ROOT_EPS ? 0 : aD1 <= ROOT_EPS ? 1 : null;
  const bMatch = bD0 <= ROOT_EPS ? 0 : bD1 <= ROOT_EPS ? 1 : null;

  if (lineAId && aMatch !== null && bMatch === null && selectedBranch !== aMatch) return pointName.get(lineAId);
  if (lineBId && bMatch !== null && aMatch === null && selectedBranch !== bMatch) return pointName.get(lineBId);
  return undefined;
}

function computeExportViewport(scene: SceneModel): { xmin: number; xmax: number; ymin: number; ymax: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const add = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const point of scene.points) {
    const world = getPointWorldPos(point, scene);
    if (!world) continue;
    add(world.x, world.y);
  }

  for (const circle of scene.circles) {
    const center = getPointWorldPosCached(scene, circle.centerId);
    const through = getPointWorldPosCached(scene, circle.throughId);
    if (!center || !through) continue;
    const r = distance(center, through);
    if (!Number.isFinite(r)) continue;
    add(center.x - r, center.y - r);
    add(center.x + r, center.y + r);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
  }

  let width = maxX - minX;
  let height = maxY - minY;
  if (width < 1e-6) width = 1;
  if (height < 1e-6) height = 1;
  const pad = Math.max(0.25, 0.1 * Math.max(width, height));

  return {
    xmin: minX - pad,
    xmax: maxX + pad,
    ymin: minY - pad,
    ymax: maxY + pad,
  };
}

function inferOtherLineCircleBranchPointFromWorld(
  lineA: { x: number; y: number },
  lineB: { x: number; y: number },
  circleO: { x: number; y: number },
  circleX: { x: number; y: number },
  selectedBranch: 0 | 1
): { x: number; y: number } | null {
  const radius = distance(circleO, circleX);
  const branches = lineCircleIntersectionBranches(lineA, lineB, circleO, radius);
  if (branches.length < 2) return null;
  const idx = selectedBranch === 0 ? 1 : 0;
  return branches[idx].point;
}

function inferOtherCircleCircleBranchPoint(
  scene: SceneModel,
  aCenterId: string,
  aThroughId: string,
  bCenterId: string,
  bThroughId: string,
  selectedBranch: 0 | 1
): { x: number; y: number } | null {
  const aCenter = getPointWorldPosCached(scene, aCenterId);
  const aThrough = getPointWorldPosCached(scene, aThroughId);
  const bCenter = getPointWorldPosCached(scene, bCenterId);
  const bThrough = getPointWorldPosCached(scene, bThroughId);
  if (!aCenter || !aThrough || !bCenter || !bThrough) return null;

  const ra = distance(aCenter, aThrough);
  const rb = distance(bCenter, bThrough);
  const intersections = circleCircleIntersections(aCenter, ra, bCenter, rb);
  if (intersections.length < 2) return null;
  const idx = selectedBranch === 0 ? 1 : 0;
  return intersections[idx];
}

function computeLineDrawPlacement(
  scene: SceneModel,
  line: SceneModel["lines"][number]
): { drawAId: string; drawBId: string; addLeft: number; addRight: number } {
  const anchors = getLineWorldAnchors(line, scene);
  if (!anchors) throw new Error(`Cannot export undefined line geometry: ${line.id}`);
  const a = anchors.a;
  const b = anchors.b;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dd = dx * dx + dy * dy;
  const anchorAId = line.kind === "perpendicular" ? line.throughId : line.aId;
  const anchorBId = line.kind === "perpendicular" ? line.id : line.bId;
  if (dd <= 1e-12) return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 1, addRight: 1 };
  const len = Math.sqrt(dd);

  const distTol = Math.max(1e-6, len * 1e-6);
  const relevantPointIds = collectLineRelevantPointIds(scene, line);
  const candidates: Array<{ id: string; s: number }> = [];

  for (const item of relevantPointIds) {
    const w = item.world;
    if (!w) continue;
    const ux = w.x - a.x;
    const uy = w.y - a.y;
    const s = (ux * dx + uy * dy) / dd;
    const px = a.x + s * dx;
    const py = a.y + s * dy;
    const dist = Math.hypot(w.x - px, w.y - py);
    if (dist > distTol) continue;
    candidates.push({ id: item.id, s });
  }

  if (candidates.length < 2) {
    return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };
  }

  candidates.sort((p1, p2) => p1.s - p2.s);
  const minCand = candidates[0];
  const maxCand = candidates[candidates.length - 1];

  if (minCand.id === maxCand.id) {
    return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };
  }

  let minS = 0;
  let maxS = 1;
  for (const c of candidates) {
    if (c.s < minS) minS = c.s;
    if (c.s > maxS) maxS = c.s;
  }

  const drawAId = minCand.id;
  const drawBId = maxCand.id;
  const wa = relevantPointIds.find((item) => item.id === drawAId)?.world ?? null;
  const wb = relevantPointIds.find((item) => item.id === drawBId)?.world ?? null;
  if (!wa || !wb) return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };

  const ddx = wb.x - wa.x;
  const ddy = wb.y - wa.y;
  const ddDraw = ddx * ddx + ddy * ddy;
  if (ddDraw <= 1e-12) return { drawAId: anchorAId, drawBId: anchorBId, addLeft: 0.15, addRight: 0.15 };
  const lenDraw = Math.sqrt(ddDraw);

  let minT = 0;
  let maxT = 1;
  for (const c of candidates) {
    const w = relevantPointIds.find((item) => item.id === c.id)?.world ?? null;
    if (!w) continue;
    const ux = w.x - wa.x;
    const uy = w.y - wa.y;
    const t = (ux * ddx + uy * ddy) / ddDraw;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }

  const margin = Math.max(0.06, 0.02 * lenDraw);
  const addLeft = Math.max(0.12, -minT * lenDraw + margin);
  const addRight = Math.max(0.12, (maxT - 1) * lenDraw + margin);
  return { drawAId, drawBId, addLeft, addRight };
}

function collectLineRelevantPointIds(
  scene: SceneModel,
  line: SceneModel["lines"][number]
): Array<{ id: string; world: { x: number; y: number } | null }> {
  const items: Array<{ id: string; world: { x: number; y: number } | null }> = [];
  const pushPoint = (id: string, world: { x: number; y: number } | null) => {
    if (items.some((item) => item.id === id)) return;
    items.push({ id, world });
  };

  const anchors = getLineWorldAnchors(line, scene);
  if (line.kind === "perpendicular") {
    pushPoint(line.throughId, getPointWorldPosCached(scene, line.throughId));
    pushPoint(line.id, anchors?.b ?? null);
  } else {
    pushPoint(line.aId, getPointWorldPosCached(scene, line.aId));
    pushPoint(line.bId, getPointWorldPosCached(scene, line.bId));
  }

  for (const point of scene.points) {
    if (point.kind === "pointOnLine" && point.lineId === line.id) {
      pushPoint(point.id, getPointWorldPosCached(scene, point.id));
      continue;
    }
    if (point.kind === "circleLineIntersectionPoint" && point.lineId === line.id) {
      pushPoint(point.id, getPointWorldPosCached(scene, point.id));
      continue;
    }
    if (
      point.kind === "intersectionPoint" &&
      ((point.objA.type === "line" && point.objA.id === line.id) || (point.objB.type === "line" && point.objB.id === line.id))
    ) {
      pushPoint(point.id, getPointWorldPosCached(scene, point.id));
    }
  }
  return items;
}

const pointByIdCache = new WeakMap<SceneModel, Map<string, ScenePoint>>();
const pointWorldCache = new WeakMap<SceneModel, Map<string, ReturnType<typeof getPointWorldPos>>>();

function getPointByIdCached(scene: SceneModel, pointId: string): ScenePoint | null {
  let map = pointByIdCache.get(scene);
  if (!map) {
    map = new Map(scene.points.map((p) => [p.id, p]));
    pointByIdCache.set(scene, map);
  }
  return map.get(pointId) ?? null;
}

function getPointWorldPosCached(scene: SceneModel, pointId: string) {
  let map = pointWorldCache.get(scene);
  if (!map) {
    map = new Map();
    pointWorldCache.set(scene, map);
  }
  if (map.has(pointId)) return map.get(pointId) ?? null;
  const point = getPointByIdCached(scene, pointId);
  const world = point ? getPointWorldPos(point, scene) : null;
  map.set(pointId, world);
  return world;
}

function buildPointStyleGroups(
  points: ScenePoint[],
  pointName: Map<string, string>,
  options: TikzExportOptions
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
        styleExpr: pointStyleToTikz(point, options),
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

function pointStyleToTikz(point: ScenePoint, options: TikzExportOptions): string {
  const s = point.style;
  const shape = mapPointShape(s.shape);
  const draw = rgbColorExpr(s.strokeColor);
  const fill = rgbColorExpr(s.fillColor);
  const pointScale = clampPositive(options.pointScale ?? 0.75, 0.05, 10);
  const basePointStroke = 1.4;
  const basePointSizePx = 4;
  const lineWidthPt = Math.max(0.1, 0.868 * pointScale * (s.strokeWidth / basePointStroke));
  const innerSepPt = Math.max(0.4, 3 * pointScale * (s.sizePx / basePointSizePx));
  const opts = [
    shape,
    `draw=${draw}`,
    `fill=${fill}`,
    `line width=${fmt(lineWidthPt)}pt`,
    `inner sep=${fmt(innerSepPt)}pt`,
  ];
  if (s.strokeOpacity < 0.999) opts.push(`draw opacity=${fmt(clamp01(s.strokeOpacity))}`);
  if (s.fillOpacity < 0.999) opts.push(`fill opacity=${fmt(clamp01(s.fillOpacity))}`);
  return opts.join(", ");
}

function segmentStyleToTikz(style: SceneModel["segments"][number]["style"], options: TikzExportOptions): string {
  return lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.dash, style.opacity, options);
}

function lineStyleToTikz(style: SceneModel["lines"][number]["style"], options: TikzExportOptions): string {
  return lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.dash, style.opacity, options);
}

function circleStyleToTikz(style: SceneModel["circles"][number]["style"], options: TikzExportOptions): string {
  const opts = lineLikeStyleToTikz(style.strokeColor, style.strokeWidth, style.strokeDash, style.strokeOpacity, options);
  return opts;
}

function lineLikeStyleToTikz(
  strokeColor: string,
  strokeWidth: number,
  dash: "solid" | "dashed" | "dotted",
  opacity: number,
  options: TikzExportOptions
): string {
  const lineScale = clampPositive(options.lineScale ?? 0.75, 0.05, 10);
  const opts: string[] = [
    `color=${rgbColorExpr(strokeColor)}`,
    `line width=${fmt(Math.max(0.1, strokeWidth * lineScale))}pt`,
  ];
  if (dash === "dashed") opts.push("dashed");
  if (dash === "dotted") opts.push("dotted");
  if (opacity < 0.999) opts.push(`opacity=${fmt(clamp01(opacity))}`);
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

function pointLabelOptionsToTikz(point: ScenePoint): string {
  const opts: string[] = [];
  const offset = point.style.labelOffsetPx;
  // Keep labels legible: map canvas offset to pt and enforce a minimum radial distance.
  const ptPerPx = 1.0;
  let xShiftPt = offset.x * ptPerPx;
  let yShiftPt = -offset.y * ptPerPx;
  const minDistPt = 9;
  const d = Math.hypot(xShiftPt, yShiftPt);
  if (d < 1e-6) {
    xShiftPt = minDistPt * 0.7071;
    yShiftPt = minDistPt * 0.7071;
  } else if (d < minDistPt) {
    const s = minDistPt / d;
    xShiftPt *= s;
    yShiftPt *= s;
  }
  if (Math.abs(xShiftPt) > 1e-9) opts.push(`xshift=${fmt(xShiftPt)}pt`);
  if (Math.abs(yShiftPt) > 1e-9) opts.push(`yshift=${fmt(yShiftPt)}pt`);
  const fontPt = Math.max(6, Math.min(28, point.style.labelFontPx));
  const baselinePt = Math.max(fontPt + 1, fontPt * 1.2);
  opts.push(`font=\\fontsize{${fmt(fontPt)}pt}{${fmt(baselinePt)}pt}\\selectfont`);

  // Reuse point halo style for label readability on dense diagrams.
  if (point.style.labelHaloWidthPx > 0) {
    opts.push(`fill=${rgbColorExpr(point.style.labelHaloColor)}`);
    opts.push("fill opacity=0.8");
    opts.push("text opacity=1");
    opts.push(`inner sep=${fmt(Math.max(0.6, point.style.labelHaloWidthPx * 0.4))}pt`);
  }
  if (point.style.labelColor) {
    opts.push(`text=${rgbColorExpr(point.style.labelColor)}`);
  }
  return opts.join(", ");
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

function hoistNamedColors(lines: string[]): string[] {
  const rgbPattern = /\{rgb,255:red,(\d+);green,(\d+);blue,(\d+)\}/g;
  const colorMap = new Map<string, string>();
  const colorDefs: string[] = [];

  const toName = (r: number, g: number, b: number): string => {
    const hex = [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("");
    return `gdC_${hex}`;
  };

  const rewritten = lines.map((line) =>
    line.replace(rgbPattern, (_m, rs: string, gs: string, bs: string) => {
      const r = Number(rs);
      const g = Number(gs);
      const b = Number(bs);
      const key = `${r},${g},${b}`;
      let name = colorMap.get(key);
      if (!name) {
        name = toName(r, g, b);
        colorMap.set(key, name);
        colorDefs.push(`\\definecolor{${name}}{RGB}{${r},${g},${b}}`);
      }
      return name;
    })
  );

  if (colorDefs.length === 0) return rewritten;

  const beginIdx = rewritten.findIndex((line) => line.trim().startsWith("\\begin{tikzpicture}"));
  if (beginIdx < 0) return rewritten;

  const out = [...rewritten];
  out.splice(beginIdx + 1, 0, ...colorDefs);
  return out;
}

function escapeTikzText(value: string): string {
  return value.replace(/[{}]/g, (m) => (m === "{" ? "\\{" : "\\}"));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampPositive(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

const TKZ_MACRO_SET = new Set<string>((tkzMacroWhitelist as { macros: string[] }).macros ?? []);

function assertTkzMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported tkz-euclide macro emitted: \\\\${name}. Run npm run update:tkz-macros or fix exporter.`);
}

function assertPerpendicularMacro(name: string): void {
  if (TKZ_MACRO_SET.has(name)) return;
  throw new Error(`Unsupported construction: PerpendicularLine (missing tkz macro: ${name})`);
}
