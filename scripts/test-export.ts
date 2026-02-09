import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportTikz } from "../src/export/tikz.ts";
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
import { compileTikzSnippet } from "./compile-tex.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, "../src/export/__fixtures__");

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
  const files = (await readdir(fixtureDir))
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No fixtures found in ${fixtureDir}`);
  }

  for (const fileName of files) {
    const fullPath = path.join(fixtureDir, fileName);
    const rawText = await readFile(fullPath, "utf8");
    const parsed = JSON.parse(rawText);
    const rawScene = parsed.scene ?? parsed;
    const scene = hydrateScene(rawScene);
    const tikz = exportTikz(scene);
    assertFixtureSpecificExpectations(fileName, tikz);
    await compileTikzSnippet(fileName.replace(/\.json$/, ""), tikz);
    console.log(`✓ ${fileName}`);
  }

  console.log(`All ${files.length} export fixtures compiled successfully.`);
}

function hydrateScene(raw: {
  points?: Array<Record<string, unknown>>;
  lines?: Array<Record<string, unknown>>;
  segments?: Array<Record<string, unknown>>;
  circles?: Array<Record<string, unknown>>;
}): SceneModel {
  const points = (raw.points ?? []).map(hydratePoint);
  const lines = (raw.lines ?? []).map(hydrateLine);
  const segments = (raw.segments ?? []).map(hydrateSegment);
  const circles = (raw.circles ?? []).map(hydrateCircle);
  return { points, lines, segments, circles };
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
  if (kind === "pointOnCircle") {
    return { ...base, kind: "pointOnCircle", circleId: String(def.circleId), t: Number(def.t) };
  }
  if (kind === "pointOnLine") {
    return { ...base, kind: "pointOnLine", lineId: String(def.lineId), s: Number(def.s) };
  }
  if (kind === "pointOnSegment") {
    return { ...base, kind: "pointOnSegment", segId: String(def.segId), u: Number(def.u) };
  }
  if (kind === "midpointPoints") {
    return { ...base, kind: "midpointPoints", aId: String(def.aId), bId: String(def.bId) };
  }
  if (kind === "midpointSegment") {
    return { ...base, kind: "midpointSegment", segId: String(def.segId) };
  }
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

  throw new Error(`Unsupported point kind in fixture: ${kind}`);
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

function assertFixtureSpecificExpectations(fileName: string, tikz: string): void {
  if (fileName === "regression-line-coverage-j-o.json") {
    if (!/\\tkzInterLL\(F,G\)\(E,D\)\s+\\tkzGetPoint\{J\}/.test(tikz)) {
      throw new Error("Regression: expected J to be defined from InterLL(F,G)(E,D).");
    }
    if (!/\\tkzInterLC(?:\[[^\]]*\])?\(F,G\)\(K,J\)\s+\\tkzGetPoints\{O\}\{[^}]+\}/.test(tikz)) {
      throw new Error("Regression: expected O to be defined from InterLC(F,G)(K,J).");
    }
    if (!/\\tkzDrawLine\[add=[^\]]+\]\(F,G\)/.test(tikz)) {
      throw new Error("Regression: expected line l_1 to be drawn from defining points (F,G).");
    }
    if (/\\tkzDrawLine\[add=[^\]]+\]\(O,G\)/.test(tikz)) {
      throw new Error("Regression: line l_1 must not be re-anchored to O.");
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
