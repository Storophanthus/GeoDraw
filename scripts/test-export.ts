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
  SceneAngle,
  SceneLine,
  SceneModel,
  SceneNumber,
  ScenePoint,
  SceneSegment,
  ShowLabelMode,
} from "../src/scene/points.ts";
import { getPointWorldPos } from "../src/scene/points.ts";
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
    let tikz = "";
    let exportError: Error | null = null;
    try {
      tikz = exportTikz(scene);
    } catch (error) {
      exportError = error instanceof Error ? error : new Error(String(error));
    }
    assertFixtureSpecificExpectations(fileName, tikz, scene, exportError);
    if (exportError) {
      console.log(`✓ ${fileName} (expected fail-closed export)`);
      continue;
    }
    await compileTikzSnippet(fileName.replace(/\.json$/, ""), tikz);
    console.log(`✓ ${fileName}`);
  }

  console.log(`All ${files.length} export fixtures compiled successfully.`);
}

function hydrateScene(raw: {
  points?: Array<Record<string, unknown>>;
  numbers?: Array<Record<string, unknown>>;
  lines?: Array<Record<string, unknown>>;
  segments?: Array<Record<string, unknown>>;
  circles?: Array<Record<string, unknown>>;
  angles?: Array<Record<string, unknown>>;
}): SceneModel {
  const points = (raw.points ?? []).map(hydratePoint);
  const numbers = (raw.numbers ?? []).map(hydrateNumber);
  const lines = (raw.lines ?? []).map(hydrateLine);
  const segments = (raw.segments ?? []).map(hydrateSegment);
  const circles = (raw.circles ?? []).map(hydrateCircle);
  const angles = (raw.angles ?? []).map(hydrateAngle);
  return { points, numbers, lines, segments, circles, angles };
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
  if (kind === "pointByRotation") {
    const rawAngleDeg = Number(def.angleDeg);
    return {
      ...base,
      kind: "pointByRotation",
      centerId: String(def.centerId),
      pointId: String(def.pointId),
      angleDeg: Number.isFinite(rawAngleDeg) ? rawAngleDeg : undefined,
      angleExpr: typeof def.angleExpr === "string" ? def.angleExpr : undefined,
      direction: String(def.direction) === "CW" ? "CW" : "CCW",
      radiusMode: "keep",
    };
  }
  if (kind === "pointOnLine") {
    return { ...base, kind: "pointOnLine", lineId: String(def.lineId), s: Number(def.s) };
  }
  if (kind === "pointOnSegment") {
    return { ...base, kind: "pointOnSegment", segId: String(def.segId), u: Number(def.u) };
  }
  if (kind === "circleCenter") {
    return { ...base, kind: "circleCenter", circleId: String(def.circleId) };
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
  if (kind === "circleSegmentIntersectionPoint") {
    return {
      ...base,
      kind: "circleSegmentIntersectionPoint",
      circleId: String(def.circleId),
      segId: String(def.segId),
      branchIndex: Number(def.branchIndex) === 1 ? 1 : 0,
      excludePointId: def.excludePointId ? String(def.excludePointId) : undefined,
    };
  }
  if (kind === "circleCircleIntersectionPoint") {
    return {
      ...base,
      kind: "circleCircleIntersectionPoint",
      circleAId: String(def.circleAId),
      circleBId: String(def.circleBId),
      branchIndex: Number(def.branchIndex) === 1 ? 1 : 0,
      excludePointId: def.excludePointId ? String(def.excludePointId) : undefined,
    };
  }
  if (kind === "lineLikeIntersectionPoint") {
    return {
      ...base,
      kind: "lineLikeIntersectionPoint",
      objA: def.objA as { type: "line" | "segment"; id: string },
      objB: def.objB as { type: "line" | "segment"; id: string },
      preferredWorld: def.preferredWorld as { x: number; y: number },
    };
  }
  if (kind === "intersectionPoint") {
    return {
      ...base,
      kind: "intersectionPoint",
      objA: def.objA as GeometryObjectRef,
      objB: def.objB as GeometryObjectRef,
      branchIndex: Number(def.branchIndex) === 1 ? 1 : Number(def.branchIndex) === 0 ? 0 : undefined,
      preferredWorld: def.preferredWorld as { x: number; y: number },
      excludePointId: def.excludePointId ? String(def.excludePointId) : undefined,
    };
  }

  throw new Error(`Unsupported point kind in fixture: ${kind}`);
}

function hydrateLine(raw: Record<string, unknown>): SceneLine {
  const kind = String(raw.kind ?? "twoPoint");
  if (kind === "perpendicular" || kind === "parallel") {
    const base = raw.base as { type: "line" | "segment"; id: string } | undefined;
    if (!base) throw new Error(`Invalid ${kind} line fixture: missing base`);
    return {
      id: String(raw.id),
      kind,
      throughId: String(raw.throughId),
      base,
      visible: raw.visible === undefined ? true : Boolean(raw.visible),
      style: (raw.style as LineStyle) ?? defaultLineStyle,
    };
  }
  if (kind === "tangent") {
    return {
      id: String(raw.id),
      kind: "tangent",
      throughId: String(raw.throughId),
      circleId: String(raw.circleId),
      branchIndex: Number(raw.branchIndex) === 1 ? 1 : 0,
      visible: raw.visible === undefined ? true : Boolean(raw.visible),
      style: (raw.style as LineStyle) ?? defaultLineStyle,
    };
  }
  if (kind === "angleBisector") {
    return {
      id: String(raw.id),
      kind: "angleBisector",
      aId: String(raw.aId),
      bId: String(raw.bId),
      cId: String(raw.cId),
      visible: raw.visible === undefined ? true : Boolean(raw.visible),
      style: (raw.style as LineStyle) ?? defaultLineStyle,
    };
  }
  return {
    id: String(raw.id),
    kind: "twoPoint",
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
  const kind = String(raw.kind ?? "twoPoint");
  if (kind === "fixedRadius") {
    return {
      id: String(raw.id),
      kind: "fixedRadius",
      centerId: String(raw.centerId),
      radius: Number(raw.radius),
      radiusExpr: typeof raw.radiusExpr === "string" ? raw.radiusExpr : undefined,
      visible: raw.visible === undefined ? true : Boolean(raw.visible),
      style: (raw.style as CircleStyle) ?? defaultCircleStyle,
    };
  }
  if (kind === "threePoint") {
    return {
      id: String(raw.id),
      kind: "threePoint",
      aId: String(raw.aId),
      bId: String(raw.bId),
      cId: String(raw.cId),
      visible: raw.visible === undefined ? true : Boolean(raw.visible),
      style: (raw.style as CircleStyle) ?? defaultCircleStyle,
    };
  }
  return {
    id: String(raw.id),
    kind: "twoPoint",
    centerId: String(raw.centerId),
    throughId: String(raw.throughId),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    style: (raw.style as CircleStyle) ?? defaultCircleStyle,
  };
}

function hydrateAngle(raw: Record<string, unknown>): SceneAngle {
  const style = (raw.style as SceneAngle["style"] | undefined) ?? {
    strokeColor: "#334155",
    strokeWidth: 1.8,
    strokeOpacity: 1,
    textColor: "#0f172a",
    textSize: 16,
    fillEnabled: false,
    fillColor: "#93c5fd",
    fillOpacity: 0.2,
    markStyle: "arc",
    markSymbol: "none",
    arcMultiplicity: 1,
    markPos: 0.5,
    markSize: 4,
    markColor: "#334155",
    arcRadius: 1.2,
    labelText: "",
    labelPosWorld: { x: 0, y: 0 },
    showLabel: true,
    showValue: true,
  };
  return {
    id: String(raw.id),
    kind: raw.kind === "sector" ? "sector" : "angle",
    aId: String(raw.aId),
    bId: String(raw.bId),
    cId: String(raw.cId),
    isRightExact: typeof raw.isRightExact === "boolean" ? raw.isRightExact : undefined,
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    style,
  };
}

function hydrateNumber(raw: Record<string, unknown>): SceneNumber {
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.id),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    definition: raw.definition as SceneNumber["definition"],
  };
}

function assertFixtureSpecificExpectations(fileName: string, tikz: string, scene: SceneModel, exportError: Error | null): void {
  if (fileName === "perpendicular-line-through-point.json") {
    if (exportError) {
      if (!exportError.message.includes("Unsupported construction: PerpendicularLine")) {
        throw exportError;
      }
      return;
    }
    if (!tikz.includes("\\tkzDefLine[perpendicular=through")) {
      throw new Error("Expected perpendicular fixture to emit \\tkzDefLine[perpendicular=through ...].");
    }
  }

  if (fileName === "parallel-line-through-point.json") {
    if (exportError) {
      if (!exportError.message.includes("Unsupported construction: ParallelLine")) {
        throw exportError;
      }
      return;
    }
    if (!tikz.includes("\\tkzDefLine[parallel=through")) {
      throw new Error("Expected parallel fixture to emit \\tkzDefLine[parallel=through ...].");
    }
  }

  if (fileName === "tangent-line-through-point.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefPoint(") || !tikz.includes("tkzTan_")) {
      throw new Error("Expected tangent fixture to emit helper tangent point definition.");
    }
    if (!tikz.includes("\\tkzDrawLine")) {
      throw new Error("Expected tangent fixture to draw tangent line.");
    }
  }

  if (fileName === "angle-bisector-internal.json") {
    if (exportError) {
      if (!exportError.message.includes("Unsupported construction: AngleBisector")) {
        throw exportError;
      }
      return;
    }
    if (!tikz.includes("\\tkzDefTriangleCenter[in]")) {
      throw new Error("Expected angle bisector fixture to emit \\tkzDefTriangleCenter[in](A,B,C).");
    }
    if (!tikz.includes("\\tkzDrawLine")) {
      throw new Error("Expected angle bisector fixture to draw the bisector line.");
    }
  }

  if (fileName === "angle-fixed-ccw-30.json") {
    if (exportError) {
      if (!exportError.message.includes("Unsupported construction: AngleFixed")) {
        throw exportError;
      }
      return;
    }
    if (!tikz.includes("\\tkzDefPointBy[rotation=center")) {
      throw new Error("Expected AngleFixed CCW fixture to emit tkz rotation construction.");
    }
    if (!/angle\s+30(?:[^\d]|$)/.test(tikz)) {
      throw new Error("Expected AngleFixed CCW fixture to emit positive 30 degree rotation.");
    }
  }

  if (fileName === "angle-fixed-cw-30.json") {
    if (exportError) {
      if (!exportError.message.includes("Unsupported construction: AngleFixed")) {
        throw exportError;
      }
      return;
    }
    if (!tikz.includes("\\tkzDefPointBy[rotation=center")) {
      throw new Error("Expected AngleFixed CW fixture to emit tkz rotation construction.");
    }
    if (!/angle\s+-30(?:[^\d]|$)/.test(tikz)) {
      throw new Error("Expected AngleFixed CW fixture to emit negative 30 degree rotation.");
    }
  }

  if (fileName === "angle-fixed-expression-2gamma.json") {
    if (exportError) {
      if (!exportError.message.includes("Unsupported construction: AngleFixed")) {
        throw exportError;
      }
      return;
    }
    if (!tikz.includes("\\tkzDefPointBy[rotation=center")) {
      throw new Error("Expected AngleFixed expression fixture to emit tkz rotation construction.");
    }
    if (!/angle\s+120(?:[^\d]|$)/.test(tikz)) {
      throw new Error("Expected AngleFixed expression fixture to resolve 2*gamma = 120 degrees.");
    }
  }

  if (fileName === "regression-line-coverage-j-o.json") {
    if (!/\\tkzInterLL\(F,G\)\(E,D\)\s+\\tkzGetPoint\{J\}/.test(tikz)) {
      throw new Error("Regression: expected J to be defined from InterLL(F,G)(E,D).");
    }
    if (!/\\tkzInterLC(?:\[[^\]]*\])?\(F,G\)\(K,J\)\s+\\tkzGetPoints\{O\}\{[^}]+\}/.test(tikz)) {
      throw new Error("Regression: expected O to be defined from InterLC(F,G)(K,J).");
    }
    const drawLines = parseDrawLines(tikz);
    const globalAdd = parseGlobalLineAdd(tikz) ?? 5;
    const requiredNames = ["F", "G", "H", "I", "J", "O"];
    const pointsByName = new Map(scene.points.map((p) => [p.name, getPointWorldPos(p, scene)]));

    const covered = drawLines.some((line) =>
      requiredNames.every((name) => {
        const target = pointsByName.get(name);
        const a = pointsByName.get(line.a);
        const b = pointsByName.get(line.b);
        if (!target || !a || !b) return false;
        return lineCoversPoint(a, b, globalAdd, globalAdd, target);
      })
    );
    if (!covered) {
      throw new Error("Regression: expected one exported draw line to cover F,G,H,I,J,O on the same geometric line.");
    }
  }

  if (fileName === "regression-lines-stubbed.json") {
    if (!tikz.includes("\\tkzInit[")) {
      throw new Error("Regression: expected tkz viewport init.");
    }
    if (!tikz.includes("\\tkzClip[")) {
      throw new Error("Regression: expected tkz clip.");
    }
    if (!tikz.includes("\\tkzSetUpLine[add=5 and 5]")) {
      throw new Error("Regression: expected global line setup with add=5 and 5.");
    }
    if (/\\tkzDrawLine\[add=\d*\.?\d+ and \d*\.?\d+/.test(tikz)) {
      throw new Error("Regression: expected no per-line tiny add values.");
    }
    if (!tikz.includes("\\tkzDefLine[perpendicular=through")) {
      throw new Error("Regression: expected perpendicular-line construction in fixture.");
    }
  }

  if (fileName === "regression-lines-whitespace.json") {
    if (!tikz.includes("\\tkzClip[")) {
      throw new Error("Regression: expected tkz clip in whitespace fixture.");
    }
  }

  if (fileName === "angle-basic-radian-labelpos.json") {
    if (!tikz.includes("\\tkzMarkAngle")) {
      throw new Error("Expected angle fixture to emit \\tkzMarkAngle.");
    }
    if (!tikz.includes("\\tkzLabelAngle")) {
      throw new Error("Expected angle fixture to emit \\tkzLabelAngle.");
    }
    if (!/\\tkzLabelAngle\[[^\]]*(pos|dist)=/.test(tikz)) {
      throw new Error("Expected angle label export to include pos/dist options derived from labelPosWorld.");
    }
    if (!tikz.includes("^{\\circ}")) {
      throw new Error("Expected default angle value label in degrees.");
    }
  }

  if (fileName === "angle-right-mark.json") {
    if (!tikz.includes("\\tkzMarkRightAngles")) {
      throw new Error("Expected right-angle fixture to emit \\tkzMarkRightAngles.");
    }
    if (!tikz.includes("\\pi/2")) {
      throw new Error("Expected custom angle label text to be preserved as TeX.");
    }
  }

  if (fileName === "angle-right-exact-from-perp-tool.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) {
      throw new Error("Expected exact-right fixture to emit \\tkzMarkRightAngles.");
    }
  }

  if (fileName === "angle-right-exact-intersection-vertex.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) {
      throw new Error("Expected intersection-vertex right-angle fixture to emit \\tkzMarkRightAngles.");
    }
  }

  if (fileName === "angle-right-exact-linelike-vertex.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) {
      throw new Error("Expected lineLike-vertex right-angle fixture to emit \\tkzMarkRightAngles.");
    }
  }

  if (fileName === "angle-right-exact-tangent-centerpoint.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) {
      throw new Error("Expected tangent-centerpoint right-angle fixture to emit \\tkzMarkRightAngles.");
    }
  }

  if (fileName === "angle-right-approx-only.json") {
    if (!exportError) {
      throw new Error("Expected approx-right fixture to fail-closed for right-angle mark.");
    }
    if (!exportError.message.includes("Unsupported construction: RightAngleMark on non-right angle")) {
      throw exportError;
    }
    return;
  }

  if (fileName === "angle-nonright-vanilla.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkAngle")) throw new Error("Expected vanilla non-right angle to emit \\tkzMarkAngle.");
    if (!tikz.includes("arc=l")) throw new Error("Expected vanilla non-right angle to emit arc=l.");
  }

  if (fileName === "angle-nonright-doublearc.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("arc=ll")) throw new Error("Expected double-arc angle to emit arc=ll.");
  }

  if (fileName === "angle-nonright-triplearc.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("arc=lll")) throw new Error("Expected triple-arc angle to emit arc=lll.");
  }

  if (fileName === "angle-nonright-markbars.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("mark=||")) throw new Error("Expected mark-bars angle to emit mark=||.");
    if (!tikz.includes("mkpos=0.35")) throw new Error("Expected mark-bars angle to emit mkpos=0.35.");
  }

  if (fileName === "angle-right-square.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) throw new Error("Expected right-square angle to emit \\tkzMarkRightAngles.");
    if (tikz.includes("german")) throw new Error("Expected right-square angle to omit german option.");
  }

  if (fileName === "angle-right-german.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) throw new Error("Expected right-arc-dot angle to emit \\tkzMarkRightAngles.");
    if (!tikz.includes("german")) throw new Error("Expected right-arc-dot angle to include german option.");
  }

  if (fileName === "sector-basic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDrawSector")) {
      throw new Error("Expected sector fixture to emit \\tkzDrawSector.");
    }
    if (!tikz.includes("\\tkzFillSector")) {
      throw new Error("Expected sector fixture to emit \\tkzFillSector.");
    }
  }

  if (fileName === "undefined-circle-line-points.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\tkzDrawPoints[tkzVertex](E") || tikz.includes(",E,") || tikz.includes(",F,")) {
      throw new Error("Expected undefined circle-line points to be omitted from point drawing.");
    }
    if (tikz.includes("\\tkzLabelPoint") && (tikz.includes("(E){") || tikz.includes("(F){"))) {
      throw new Error("Expected undefined circle-line points to be omitted from label drawing.");
    }
  }

  if (fileName === "segment-mark-basic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkSegment")) {
      throw new Error("Expected segment mark fixture to emit \\tkzMarkSegment.");
    }
    if (!tikz.includes("mark=||")) {
      throw new Error("Expected segment mark fixture to emit mark=||.");
    }
    if (!tikz.includes("pos=0.3")) {
      throw new Error("Expected segment mark fixture to emit pos=0.3.");
    }
    if (!tikz.includes("size=5.5pt")) {
      throw new Error("Expected segment mark fixture to emit size=5.5pt.");
    }
    if (!tikz.includes("line width=1pt")) {
      throw new Error("Expected segment mark fixture to emit line width=1pt.");
    }
  }

  if (fileName === "segment-mark-arrow-end.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("-{Stealth")) {
      throw new Error("Expected segment end-arrow fixture to emit Stealth end-arrow draw.");
    }
    if (!tikz.includes("-- (E);")) {
      throw new Error("Expected segment end-arrow fixture to draw to endpoint.");
    }
  }

  if (fileName === "segment-mark-arrow-mid.json") {
    if (!tikz.includes("postaction=decorate")) {
      throw new Error("Expected segment mid-arrow fixture to emit decoration-based draw.");
    }
    if (!tikz.includes("mark=at position")) {
      throw new Error("Expected segment mid-arrow fixture to emit mark=at position.");
    }
  }

  if (fileName === "segment-mark-arrow-mid-multi.json") {
    if (!tikz.includes("postaction=decorate")) {
      throw new Error("Expected segment multi mid-arrow fixture to emit decoration-based draw.");
    }
    if (!tikz.includes("mark=between positions")) {
      throw new Error("Expected segment multi mid-arrow fixture to emit mark=between positions.");
    }
    if (!tikz.includes("step 0.05")) {
      throw new Error("Expected segment multi mid-arrow fixture to emit step 0.05.");
    }
  }

  if (fileName === "circle-fixed-radius-basic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefCircle[R](O,3.5)")) {
      throw new Error("Expected fixed-radius circle fixture to emit \\tkzDefCircle[R](O,3.5).");
    }
  }

  if (fileName === "circle-three-point-basic.json") {
    if (!tikz.includes("\\tkzDefCircle[circum]")) {
      throw new Error("Expected three-point circle fixture to emit \\tkzDefCircle[circum].");
    }
    if (!tikz.includes("\\tkzDrawCircle")) {
      throw new Error("Expected three-point circle fixture to emit \\tkzDrawCircle.");
    }
  }

  if (fileName === "export-no-patterns.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\usetikzlibrary{patterns}")) {
      throw new Error("Expected no-patterns fixture to omit patterns library line.");
    }
    if (tikz.includes("\\usetikzlibrary{patterns,patterns.meta}")) {
      throw new Error("Expected no-patterns fixture to omit patterns.meta library line.");
    }
  }

  if (fileName === "export-with-patterns.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\usetikzlibrary{patterns}")) {
      throw new Error("Expected patterns fixture to emit \\usetikzlibrary{patterns}.");
    }
    if (tikz.includes("\\usetikzlibrary{patterns,patterns.meta}")) {
      throw new Error("Expected classic patterns fixture to avoid patterns.meta.");
    }
    if (!tikz.includes("pattern=north east lines")) {
      throw new Error("Expected patterns fixture to emit classic pattern style.");
    }
  }

  if (fileName === "export-with-patterns-meta.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\usetikzlibrary{patterns,patterns.meta}")) {
      throw new Error("Expected patterns-meta fixture to emit \\usetikzlibrary{patterns,patterns.meta}.");
    }
    if (!tikz.includes("pattern={Lines[angle=45,distance=4pt]}")) {
      throw new Error("Expected patterns-meta fixture to emit pattern={...} style.");
    }
  }

  if (exportError) throw exportError;
}

function parseDrawLines(
  tikz: string
): Array<{ a: string; b: string }> {
  const out: Array<{ a: string; b: string }> = [];
  const re = /\\tkzDrawLine(?:\[[^\]]*\])?\(([^,]+),([^)]+)\)/g;
  for (let m = re.exec(tikz); m; m = re.exec(tikz)) {
    out.push({
      a: m[1],
      b: m[2],
    });
  }
  return out;
}

function parseGlobalLineAdd(tikz: string): number | null {
  const m = tikz.match(/\\tkzSetUpLine\[add=([^ ]+) and ([^\]]+)\]/);
  if (!m) return null;
  const left = Number(m[1]);
  const right = Number(m[2]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.max(left, right);
}

function lineCoversPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  addLeft: number,
  addRight: number,
  p: { x: number; y: number }
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dd = dx * dx + dy * dy;
  if (dd <= 1e-12) return false;
  const len = Math.sqrt(dd);
  const ux = p.x - a.x;
  const uy = p.y - a.y;
  const t = (ux * dx + uy * dy) / dd;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const dist = Math.hypot(p.x - projX, p.y - projY);
  const EPS_DIST = 1e-5;
  const EPS_T = 1e-6;
  const minT = -(addLeft / len) - EPS_T;
  const maxT = 1 + addRight / len + EPS_T;
  return dist <= EPS_DIST && t >= minT && t <= maxT;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
