import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportTikz, exportTikzWithOptions, makeEfficientTikz } from "../src/export/tikz.ts";
import type {
  CircleStyle,
  GeometryObjectRef,
  LineStyle,
  PointStyle,
  PolygonStyle,
  SceneCircle,
  SceneEllipse,
  SceneAngle,
  SceneLine,
  SceneModel,
  SceneNumber,
  ScenePoint,
  ScenePolygon,
  SceneRichTextNode,
  SceneSegment,
  SceneTextLabel,
  ShowLabelMode,
} from "../src/scene/points.ts";
import { getPointWorldPos } from "../src/scene/points.ts";
import { parseRichTextSourceToDocument } from "../src/richtext/document.ts";
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

const defaultPolygonStyle: PolygonStyle = {
  strokeColor: "#1f2937",
  strokeWidth: 1.8,
  strokeDash: "solid",
  strokeOpacity: 1,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
};

const defaultTextLabelStyle: SceneTextLabel["style"] = {
  textColor: "#111111",
  textSize: 12,
  useTex: true,
  textMode: "tex",
  boxWidthPx: 220,
  rotationDeg: 0,
};

const defaultRichTextStyle: SceneRichTextNode["style"] = {
  textColor: "#111111",
  textSize: 12,
  textAlign: "left",
  rotationDeg: 0,
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
    const fixtureExportOptions = parsed.exportOptions as Record<string, unknown> | undefined;
    let tikz = "";
    let exportError: Error | null = null;
    try {
      tikz = fixtureExportOptions ? exportTikzWithOptions(scene, fixtureExportOptions) : exportTikz(scene);
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

  assertTkzSetupToggleRegression();
  await assertEfficientCoordinateRoundingCompileRegression();

  console.log(`All ${files.length} export fixtures compiled successfully.`);
}

async function assertEfficientCoordinateRoundingCompileRegression(): Promise<void> {
  const standard = String.raw`\begin{tikzpicture}
\tkzDefPoints{3/1/A, 6.061083984375/4.95205078125/Ba, 5.514599609375/0.92724609375/C}
\tkzDefPoint(4.32023676029465,3.13891853466853){O_1}
\tkzDefPoint(6.83066157486428,3.06628541608936){O_2}
\tkzDefCircle[circum](A,Ba,C) \tkzGetPoint{tkzCircum_1}
\tkzInterLC[common=A](A,O_1)(tkzCircum_1,A) \tkzGetPoints{B}{A}
\tkzDefCircle[circum](B,O_1,C) \tkzGetPoint{tkzCircum_2}
\tkzInterLC[near](A,O_2)(tkzCircum_2,B) \tkzGetPoints{Other}{N}
\end{tikzpicture}`;
  const efficient = makeEfficientTikz(standard);
  if (!efficient.includes("6.061083984375/4.95205078125/Ba") || !efficient.includes("(6.83066157486428,3.06628541608936)")) {
    throw new Error("Expected efficient TikZ to preserve full construction-coordinate precision.");
  }
  await compileTikzSnippet("efficient-coordinate-rounding-line-circle", efficient);

  const nearTangent = String.raw`\begin{tikzpicture}
\tkzDefPoints{0/0/O,1/0/X,-2/0.9996/A,2/0.9996/B}
\tkzInterLC[near](A,B)(O,X) \tkzGetPoints{P}{Q}
\end{tikzpicture}`;
  const efficientNearTangent = makeEfficientTikz(nearTangent);
  if (!efficientNearTangent.includes("0.9996")) {
    throw new Error("Efficient TikZ must not round a near-tangent secant into tangency.");
  }
  await compileTikzSnippet("efficient-coordinate-rounding-near-tangent", efficientNearTangent);
}

function hydrateScene(raw: {
  points?: Array<Record<string, unknown>>;
  numbers?: Array<Record<string, unknown>>;
  lines?: Array<Record<string, unknown>>;
  segments?: Array<Record<string, unknown>>;
  circles?: Array<Record<string, unknown>>;
  ellipses?: Array<Record<string, unknown>>;
  polygons?: Array<Record<string, unknown>>;
  angles?: Array<Record<string, unknown>>;
  textLabels?: Array<Record<string, unknown>>;
  richTextNodes?: Array<Record<string, unknown>>;
}): SceneModel {
  const points = (raw.points ?? []).map(hydratePoint);
  const numbers = (raw.numbers ?? []).map(hydrateNumber);
  const lines = (raw.lines ?? []).map(hydrateLine);
  const segments = (raw.segments ?? []).map(hydrateSegment);
  const circles = (raw.circles ?? []).map(hydrateCircle);
  const ellipses = (raw.ellipses ?? []).map(hydrateEllipse);
  const polygons = (raw.polygons ?? []).map(hydratePolygon);
  const angles = (raw.angles ?? []).map(hydrateAngle);
  const textLabels = (raw.textLabels ?? []).map(hydrateTextLabel);
  const richTextNodes = (raw.richTextNodes ?? []).map(hydrateRichTextNode);
  return { points, numbers, lines, segments, circles, ellipses, polygons, angles, textLabels, richTextNodes };
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
  if (kind === "triangleCenter") {
    return {
      ...base,
      kind: "triangleCenter",
      centerKind:
        String(def.centerKind) === "centroid"
          ? "centroid"
          : String(def.centerKind) === "circumcenter"
            ? "circumcenter"
            : String(def.centerKind) === "orthocenter"
              ? "orthocenter"
              : "incenter",
      aId: String(def.aId),
      bId: String(def.bId),
      cId: String(def.cId),
    };
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
    const parsedBranch = Number(def.branchIndex);
    return {
      ...base,
      kind: "intersectionPoint",
      objA: def.objA as GeometryObjectRef,
      objB: def.objB as GeometryObjectRef,
      branchIndex: Number.isInteger(parsedBranch) && parsedBranch >= 0 ? parsedBranch : undefined,
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
      showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
      labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
      labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
      labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
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
      showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
      labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
      labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
      labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
      style: (raw.style as LineStyle) ?? defaultLineStyle,
    };
  }
  if (kind === "circleCircleTangent") {
    return {
      id: String(raw.id),
      kind: "circleCircleTangent",
      circleAId: String(raw.circleAId),
      circleBId: String(raw.circleBId),
      family: String(raw.family) === "inner" ? "inner" : "outer",
      branchIndex: Number(raw.branchIndex) === 1 ? 1 : 0,
      visible: raw.visible === undefined ? true : Boolean(raw.visible),
      showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
      labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
      labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
      labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
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
      showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
      labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
      labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
      labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
      style: (raw.style as LineStyle) ?? defaultLineStyle,
    };
  }
  return {
    id: String(raw.id),
    kind: "twoPoint",
    aId: String(raw.aId),
    bId: String(raw.bId),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
    labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
    labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
    labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
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
    labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
    labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
    labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
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
      showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
      labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
      labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
      labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
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
      showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
      labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
      labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
      labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
      style: (raw.style as CircleStyle) ?? defaultCircleStyle,
    };
  }
  return {
    id: String(raw.id),
    kind: "twoPoint",
    centerId: String(raw.centerId),
    throughId: String(raw.throughId),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
    labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
    labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
    labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
    style: (raw.style as CircleStyle) ?? defaultCircleStyle,
  };
}

function hydrateEllipse(raw: Record<string, unknown>): SceneEllipse {
  return {
    id: String(raw.id),
    kind: "fociPoint",
    focusAId: String(raw.focusAId),
    focusBId: String(raw.focusBId),
    throughId: String(raw.throughId),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
    labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
    labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
    labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
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

function hydratePolygon(raw: Record<string, unknown>): ScenePolygon {
  return {
    id: String(raw.id),
    pointIds: Array.isArray(raw.pointIds) ? raw.pointIds.map((id) => String(id)) : [],
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    showLabel: raw.showLabel === undefined ? false : Boolean(raw.showLabel),
    labelText: typeof raw.labelText === "string" ? raw.labelText : undefined,
    labelPosWorld: isVec2Like(raw.labelPosWorld) ? raw.labelPosWorld : undefined,
    labelGlow: typeof raw.labelGlow === "boolean" ? raw.labelGlow : undefined,
    style: (raw.style as PolygonStyle) ?? defaultPolygonStyle,
  };
}

function isVec2Like(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const maybe = value as { x?: unknown; y?: unknown };
  return Number.isFinite(maybe.x) && Number.isFinite(maybe.y);
}

function hydrateNumber(raw: Record<string, unknown>): SceneNumber {
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.id),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    definition: raw.definition as SceneNumber["definition"],
  };
}

function hydrateTextLabel(raw: Record<string, unknown>): SceneTextLabel {
  const style = (raw.style as SceneTextLabel["style"] | undefined) ?? defaultTextLabelStyle;
  const positionWorld = isVec2Like(raw.positionWorld) ? raw.positionWorld : { x: 0, y: 0 };
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.id),
    text: String(raw.text ?? ""),
    toolKind: raw.toolKind === "textbox" ? "textbox" : "label",
    contentMode:
      raw.contentMode === "number" ? "number" : raw.contentMode === "expression" ? "expression" : "static",
    numberId: typeof raw.numberId === "string" ? raw.numberId : undefined,
    expr: typeof raw.expr === "string" ? raw.expr : undefined,
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    positionWorld,
    style: {
      textColor: style.textColor,
      textSize: style.textSize,
      useTex: Boolean(style.useTex),
      textMode: style.textMode,
      textAlign: style.textAlign,
      boxWidthPx: style.boxWidthPx,
      rotationDeg: style.rotationDeg ?? 0,
      labelGlow: Boolean(style.labelGlow),
    },
  };
}

function hydrateRichTextNode(raw: Record<string, unknown>): SceneRichTextNode {
  const style = (raw.style as SceneRichTextNode["style"] | undefined) ?? defaultRichTextStyle;
  const positionWorld = isVec2Like(raw.positionWorld) ? raw.positionWorld : { x: 0, y: 0 };
  const boundsRaw = raw.boundsPx as { widthPx?: unknown; heightPx?: unknown } | undefined;
  const boundsPx =
    boundsRaw && Number.isFinite(boundsRaw.widthPx) && Number.isFinite(boundsRaw.heightPx)
      ? { widthPx: Number(boundsRaw.widthPx), heightPx: Number(boundsRaw.heightPx) }
      : undefined;
  return {
    id: String(raw.id),
    type: "richText",
    name: String(raw.name ?? raw.id),
    visible: raw.visible === undefined ? true : Boolean(raw.visible),
    positionWorld,
    boundsPx,
    document:
      raw.document && typeof raw.document === "object"
        ? (raw.document as SceneRichTextNode["document"])
        : parseRichTextSourceToDocument(String(raw.source ?? "")),
    style: {
      textColor: style.textColor,
      textSize: style.textSize,
      textAlign: style.textAlign ?? "left",
      rotationDeg: style.rotationDeg ?? 0,
      labelGlow: Boolean(style.labelGlow),
    },
  };
}

function assertFixtureSpecificExpectations(fileName: string, tikz: string, scene: SceneModel, exportError: Error | null): void {
  if (fileName === "object-labels-basic.json") {
    if (exportError) throw exportError;
    const nodeCount = (tikz.match(/\\node(?:\[[^\]]*\])?\s+at\s+\(/g) ?? []).length;
    if (nodeCount < 4) {
      throw new Error(`Expected object-label fixture to emit at least 4 node labels, got ${nodeCount}.`);
    }
    if (!tikz.includes("{$s$}")) {
      throw new Error("Expected segment object label to be exported.");
    }
    if (!tikz.includes("{$m$}")) {
      throw new Error("Expected line object label to be exported.");
    }
    if (!tikz.includes("{$\\Gamma_1$}")) {
      throw new Error("Expected circle object label to be exported.");
    }
    if (!tikz.includes("{$ABDC$}")) {
      throw new Error("Expected polygon object label to be exported.");
    }
  }

  if (fileName === "label-glow-options.json") {
    if (exportError) throw exportError;
    for (const expected of [
      "\\gdLabelGlow{$Obj$}",
      "\\gdLabelGlow{$Ang$}",
      "\\gdLabelGlow{$T$}",
      "\\gdLabelGlow{Plain}",
      "\\gdLabelGlow{Rich}",
    ]) {
      if (!tikz.includes(expected)) {
        throw new Error(`Expected label glow fixture to include ${expected}`);
      }
    }
  }

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

  if (fileName === "circle-circle-branch-order-bugs2.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterCC(?:\[[^\]]*\])?\([^)]*\)\([^)]*\)\s*\\tkzGetPoints\{tkzInterCC_\d+_other\}\{E\}/.test(tikz)) {
      throw new Error("Expected bugs2 fixture to swap the first circle-circle intersection so E maps to tkz second point.");
    }
    if (!/\\tkzInterCC(?:\[[^\]]*\])?\([^)]*\)\([^)]*\)\s*\\tkzGetPoints\{F\}\{tkzInterCC_\d+_other\}/.test(tikz)) {
      throw new Error("Expected bugs2 fixture to keep F on tkz first point without swapping.");
    }
    if (!tikz.includes("\\tkzInterLL(D,F)(A,E) \\tkzGetPoint{H}")) {
      throw new Error("Expected bugs2 fixture to keep H constructed from the exported DF and AE segments.");
    }
  }

  if (fileName === "line-circle-common-forward-ref-korea14.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\tkzInterLC[common=B](M,tkzPerp_1)(O,A) \\tkzGetPoints{Bp}{B}")) {
      throw new Error("Regression: exporter emitted a forward common=B reference before B was defined.");
    }
    const definesBFirst =
      /\\tkzInterLC\[near\]\((?:M,tkzPerp_1|tkzPerp_1,M)\)\(O,A\)\s+\\tkzGetPoints\{B\}\{(?:Bp|tkzInterLC_\d+_other)\}/.test(tikz) &&
      /\\tkzInterLC\[near\]\(B,(?:M|tkzPerp_1)\)\(O,A\)\s+\\tkzGetPoints\{tkzInterLC_\d+_other\}\{Bp\}/.test(tikz);
    const definesBpFirst =
      /\\tkzInterLC\[near\]\((?:M,tkzPerp_1|tkzPerp_1,M)\)\(O,A\)\s+\\tkzGetPoints\{(?:Bp|tkzInterLC_\d+_other)\}\{(?:Bp|tkzInterLC_\d+_other)\}/.test(tikz) &&
      /\\tkzInterLC\[near\]\(Bp,(?:M|tkzPerp_1)\)\(O,A\)\s+\\tkzGetPoints\{tkzInterLC_\d+_other\}\{B\}/.test(tikz);
    if (!definesBFirst && !definesBpFirst) {
      throw new Error("Expected korea14 fixture to export the sibling line-circle pair without any forward common reference.");
    }
  }

  if (fileName === "circle-segment-finite-single-root-fail-closed.json") {
    if (exportError) throw exportError;
    if (!/\\tkzDefPointBy\[homothety=center C ratio 0\.5\]\(D\)\s+\\tkzGetPoint\{E\}/.test(tikz)) {
      throw new Error("Expected dedicated finite single segment-circle root fixture to export via homothety.");
    }
    return;
  }

  if (fileName === "generic-circle-segment-finite-single-root-fail-closed.json") {
    if (exportError) throw exportError;
    if (!/\\tkzDefPointBy\[homothety=center C ratio 0\.5\]\(D\)\s+\\tkzGetPoint\{E\}/.test(tikz)) {
      throw new Error("Expected generic finite single segment-circle root fixture to export via homothety.");
    }
    return;
  }

  if (fileName === "circle-line-exclude.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterLC\[near\]\(C,D\)\(A,B\)\s+\\tkzGetPoints\{tkzInterLC_\d+_other\}\{F\}/.test(tikz)) {
      throw new Error("Expected dedicated circle-line exclude fixture to export F as the root away from C without redefining C.");
    }
  }

  if (fileName === "baked-coordinates-construction.json") {
    if (exportError) throw exportError;
    // Baked mode emits every point as a literal \tkzDefPoint and never re-derives
    // geometry in TeX, so none of the construction/intersection macros may appear.
    for (const forbidden of [
      "\\tkzInterLC",
      "\\tkzInterLL",
      "\\tkzInterCC",
      "\\tkzDefTriangleCenter",
      "\\tkzCircumCenter",
      "\\tkzDefPointBy",
      "\\tkzDefPointOnCircle",
    ]) {
      if (tikz.includes(forbidden)) {
        throw new Error(`Baked-coordinate export must not emit ${forbidden}; all points should be literal \\tkzDefPoint.`);
      }
    }
    for (const literal of [
      /\\tkzDefPoint\([^)]*\)\{I\}/,
      /\\tkzDefPoint\([^)]*\)\{X\}/,
    ]) {
      if (!literal.test(tikz)) {
        throw new Error(`Baked-coordinate export expected a literal \\tkzDefPoint for ${literal}.`);
      }
    }
    return;
  }

  if (fileName === "circle-line-coincidental-common-not-on-circle.json") {
    if (exportError) throw exportError;
    // E coincides with an intersection but is a free point (not on the circle by
    // construction). tkz-euclide's common= matching is then unreliable under
    // picture scaling, so the exporter must NOT use it as common= and must fall
    // back to the near/swap line-circle export.
    if (tikz.includes("[common=E]")) {
      throw new Error("Regression: coincidental common point not on the circle by construction must not be used as tkz common=.");
    }
    if (!/\\tkzInterLC\[near\]\((?:G,H|H,G)\)\(O,P\)\s+\\tkzGetPoints(?:\{F\}\{tkzInterLC_\d+_other\}|\{tkzInterLC_\d+_other\}\{F\})/.test(tikz)) {
      throw new Error("Expected coincidental-common fixture to fall back to near/swap line-circle export for F.");
    }
  }

  if (fileName === "line-circle-derived-common-not-on-target-circle.json") {
    if (exportError) throw exportError;
    // I is intentionally constructed on omega, so it can anchor a near/far
    // selection for L. The known I root is stored only in a disposable helper;
    // intersection export must never redefine the existing I identity.
    if (!/\\tkzInterLC\[near\]\(I,G\)\(tkzCircum_\d+,I\)\s+\\tkzGetPoints\{tkzInterLC_\d+_other\}\{L\}/.test(tikz)) {
      throw new Error("Expected L to use I as a stable near-root anchor on its source circle.");
    }
    if (/\\tkzInterLC\[common=I\]\(I,L\)\(tkzCircum_\d+,B\)\s+\\tkzGetPoints\{M\}\{I\}/.test(tikz)) {
      throw new Error("Regression: M must not export with common=I when I is not constructed on the target circle.");
    }
    if (!/\\tkzInterLC\[near\]\(I,L\)\(tkzCircum_\d+,B\)\s+\\tkzGetPoints\{tkzInterLC_\d+_other\}\{M\}/.test(tikz)) {
      throw new Error("Expected M to fall back to near/swap export instead of common=I.");
    }
  }

  if (fileName === "generic-line-circle-exclude-common.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterLC\[near\]\(A,O\)\(O,A\)\s+\\tkzGetPoints\{tkzInterLC_\d+_other\}\{Ap\}/.test(tikz)) {
      throw new Error("Expected generic line-circle exclude fixture to export Ap away from A without redefining A.");
    }
  }

  if (fileName === "generic-circle-segment-exclude-common-swapped.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterLC\[near\]\(A,B\)\(O,A\)\s+\\tkzGetPoints\{tkzInterLC_\d+_other\}\{Ap\}/.test(tikz)) {
      throw new Error("Expected generic swapped circle-segment exclude fixture to export Ap away from A without redefining A.");
    }
  }

  if (fileName === "circle-circle-invalid-common-stale-point.json") {
    if (exportError) throw exportError;
    if (tikz.includes("[common=Q]")) {
      throw new Error("Expected stale invalid exclude point to be rejected as circle-circle common.");
    }
    if (!/\\tkzInterCC(?:\[[^\]]*\])?\((?:O,A|A,O)\)\((?:K,B|B,K)\)\s+\\tkzGetPoints(?:\{P\}\{tkzInterCC_\d+_other\}|\{tkzInterCC_\d+_other\}\{P\})/.test(tikz)) {
      throw new Error("Expected stale invalid circle-circle common fixture to fall back to ordinary InterCC export.");
    }
  }

  if (fileName === "generic-circle-circle-exclude-common-swapped.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterCC\[common=A\]\((?:K,A|A,K)\)\((?:O,A|A,O)\)\s+\\tkzGetPoints\{Ap\}\{tkzInterCC_\d+_other\}/.test(tikz)) {
      throw new Error("Expected generic swapped circle-circle exclude fixture to export Ap using common=A without redefining A.");
    }
  }

  if (fileName === "generic-circle-circle-near-tangent.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterCC(?:\[[^\]]*\])?\((?:O,A|A,O)\)\((?:K,B|B,K)\)\s+\\tkzGetPoints(?:\{P\}\{tkzInterCC_\d+_other\}|\{tkzInterCC_\d+_other\}\{P\})/.test(tikz)) {
      throw new Error("Expected near-tangent generic circle-circle fixture to export the first intersection.");
    }
    if (!/\\tkzInterCC\[common=P\]\((?:O,A|A,O)\)\((?:K,B|B,K)\)\s+\\tkzGetPoints\{Q\}\{tkzInterCC_\d+_other\}/.test(tikz)) {
      throw new Error("Expected near-tangent generic circle-circle fixture to use P as common for Q without redefining P.");
    }
  }

  if (fileName === "generic-circle-circle-near-tangent-swapped.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterCC(?:\[[^\]]*\])?\((?:K,B|B,K)\)\((?:O,A|A,O)\)\s+\\tkzGetPoints(?:\{P\}\{tkzInterCC_\d+_other\}|\{tkzInterCC_\d+_other\}\{P\})/.test(tikz)) {
      throw new Error("Expected swapped near-tangent generic circle-circle fixture to export the first intersection with reversed circle order.");
    }
    if (!/\\tkzInterCC\[common=P\]\((?:K,B|B,K)\)\((?:O,A|A,O)\)\s+\\tkzGetPoints\{Q\}\{tkzInterCC_\d+_other\}/.test(tikz)) {
      throw new Error("Expected swapped near-tangent generic circle-circle fixture to use P as common for Q without redefining P.");
    }
  }

  if (fileName === "line-circle-invalid-common-stale-point.json") {
    if (exportError) throw exportError;
    if (tikz.includes("[common=Q]")) {
      throw new Error("Expected stale invalid exclude point to be rejected as line-circle common.");
    }
    if (!/\\tkzInterLC\[near\]\((?:A,O|O,A)\)\(O,A\)\s+\\tkzGetPoints(?:\{Ap\}\{tkzInterLC_\d+_other\}|\{tkzInterLC_\d+_other\}\{Ap\})/.test(tikz)) {
      throw new Error("Expected stale invalid common fixture to fall back to near/swap line-circle export.");
    }
  }

  if (fileName === "text-label-modes.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\fontsize{12.19pt}{14.628pt}\\selectfont")) {
      throw new Error("Expected free text label export to keep size 12 near 12.19pt instead of scaling with the viewport.");
    }
    if (!tikz.includes("Plain text \\\\ $\\displaystyle x^2+y^2=1$ \\\\ tail")) {
      throw new Error("Expected mixed textbox export to emit centered multi-line TikZ text with display math.");
    }
    if (!tikz.includes("text width=122.222222222222pt")) {
      throw new Error("Expected mixed textbox export to preserve textbox wrap width in TikZ.");
    }
  }

  if (fileName === "rich-text-node.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\node[anchor=north west")) {
      throw new Error("Expected rich text fixture to export as a positioned node.");
    }
    if (!tikz.includes("A number $a$ is algebraic")) {
      throw new Error("Expected rich text fixture to export paragraph text and inline math.");
    }
    if (!tikz.includes("$\\displaystyle {a}^{2}+1=0$")) {
      throw new Error("Expected rich text fixture to export display math.");
    }
    const initMatch = /\\tkzInit\[xmin=([-0-9.]+),xmax=([-0-9.]+),ymin=([-0-9.]+),ymax=([-0-9.]+)\]/u.exec(tikz);
    if (!initMatch) {
      throw new Error("Expected rich text fixture to include a viewport.");
    }
    const [, xminRaw, xmaxRaw, yminRaw, ymaxRaw] = initMatch;
    const xmin = Number(xminRaw);
    const xmax = Number(xmaxRaw);
    const ymin = Number(yminRaw);
    const ymax = Number(ymaxRaw);
    if (!(xmin < 42 && xmax > 47 && ymin < 10 && ymax > 11)) {
      throw new Error(`Expected rich text bounds to contribute to export viewport, got ${initMatch[0]}`);
    }
  }

  if (fileName === "color-basic-red-named.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("color=red")) {
      throw new Error("Expected basic preset color fixture to export segment stroke as named red.");
    }
    if (tikz.includes("\\definecolor")) {
      throw new Error("Expected basic preset color fixture to avoid definecolor in standard export.");
    }
    const efficient = makeEfficientTikz(tikz);
    if (efficient.includes("\\definecolor")) {
      throw new Error("Expected basic preset color fixture to avoid definecolor in efficient export.");
    }
  }

  if (fileName === "color-xcolor-teal-named.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("color=teal")) {
      throw new Error("Expected xcolor preset color fixture to export segment stroke as named teal.");
    }
    if (tikz.includes("\\definecolor")) {
      throw new Error("Expected xcolor preset color fixture to avoid definecolor in standard export.");
    }
    const efficient = makeEfficientTikz(tikz);
    if (efficient.includes("\\definecolor")) {
      throw new Error("Expected xcolor preset color fixture to avoid definecolor in efficient export.");
    }
  }

  if (fileName === "color-dvips-navyblue-named.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("color=NavyBlue")) {
      throw new Error("Expected dvipsnames preset color fixture to export segment stroke as named NavyBlue.");
    }
    if (tikz.includes("\\definecolor")) {
      throw new Error("Expected dvipsnames preset color fixture to avoid definecolor in standard export.");
    }
    const efficient = makeEfficientTikz(tikz);
    if (efficient.includes("\\definecolor")) {
      throw new Error("Expected dvipsnames preset color fixture to avoid definecolor in efficient export.");
    }
  }

  if (fileName === "color-custom-definecolor.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\definecolor{gdC_123456}{RGB}{18,52,86}")) {
      throw new Error("Expected custom color fixture to keep definecolor in standard export.");
    }
    if (!tikz.includes("color=gdC_123456")) {
      throw new Error("Expected custom color fixture to use the defined gdC_123456 color in standard export.");
    }
    const efficient = makeEfficientTikz(tikz);
    if (!efficient.includes("\\definecolor{c0}{RGB}{18,52,86}")) {
      throw new Error("Expected custom color fixture to keep a custom definecolor in efficient export.");
    }
    if (!efficient.includes("color=c0")) {
      throw new Error("Expected custom color fixture to use the simplified c0 color in efficient export.");
    }
  }

  if (fileName === "tangent-circle-circle.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefExtSimilitudeCenter") || !tikz.includes("\\tkzDefIntSimilitudeCenter")) {
      throw new Error("Expected circle-circle tangent fixture to emit tkz similitude-center constructions.");
    }
    if (!tikz.includes("\\tkzDefLine[tangent from =")) {
      throw new Error("Expected circle-circle tangent fixture to emit tangent-from-point line construction.");
    }
    if (!tikz.includes("\\tkzDrawLine")) {
      throw new Error("Expected circle-circle tangent fixture to draw tangent lines.");
    }
  }

  if (fileName === "tangent-circle-circle-branch-pairing.json") {
    if (exportError) {
      if (
        !exportError.message.includes("tangent line-circle intersections are unsupported in tkz export") &&
        !exportError.message.includes("near-tangent line-circle intersections are unsupported in tkz export")
      ) {
        throw exportError;
      }
      return;
    }
    if (!tikz.includes("\\tkzDefExtSimilitudeCenter") || !tikz.includes("\\tkzDefIntSimilitudeCenter")) {
      throw new Error("Expected branch-pairing tangent fixture to emit similitude-center constructions.");
    }
    // Regression: common-tangent branch pairing must respect tkz tangent-from-point point order.
    // This fixture previously exported the outer tangent as (tkzTanCC_7_1,tkzTanCC_9_1), which mismatched branches.
    if (tikz.includes("(tkzTanCC_7_1,tkzTanCC_9_1)")) {
      throw new Error("Regression: exported circle-circle tangent reused mismatched tangent-point branch pair.");
    }
    if (!tikz.includes("(tkzTanCC_8_2,tkzTanCC_10_2)")) {
      throw new Error("Regression: expected corrected outer common-tangent branch pairing in exported TikZ.");
    }
  }

  if (fileName === "tangent-circle-circle-a-inner-intersecting-visible-fail.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\tkzDefIntSimilitudeCenter")) {
      throw new Error("Impossible intersecting inner tangents should be skipped, not exported.");
    }
    if (tikz.includes("tkzTanCC_")) {
      throw new Error("Impossible intersecting inner tangents should not emit tangent helper points.");
    }
  }

  if (fileName === "tangent-circle-circle-a-inner-intersecting-hidden-pass.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefExtSimilitudeCenter")) {
      throw new Error("Expected hidden-inner-tangent fixture to still export visible outer tangent constructively.");
    }
    if (tikz.includes("inner tangents are undefined for intersecting circles")) {
      throw new Error("Hidden impossible tangents should not poison export.");
    }
  }

  if (fileName === "tangent-circle-circle-exact-external.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefLine[perpendicular=through tkzTanCC_T_")) {
      throw new Error("Expected exact external tangency fixture to export collapsed inner tangent constructively via perpendicular-through-contact.");
    }
    if (!tikz.includes("\\tkzDefExtSimilitudeCenter")) {
      throw new Error("Expected exact external tangency fixture to still export non-degenerate outer tangents constructively.");
    }
  }

  if (fileName === "tangent-circle-circle-exact-internal.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefLine[perpendicular=through tkzTanCC_T_")) {
      throw new Error("Expected exact internal tangency fixture to export collapsed outer tangent constructively via perpendicular-through-contact.");
    }
    if (tikz.includes("\\tkzDefIntSimilitudeCenter")) {
      throw new Error("Impossible inner tangents in exact internal tangency should be skipped, not exported.");
    }
  }

  if (fileName === "tangent-circle-circle-near-external-outer.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefExtSimilitudeCenter")) {
      throw new Error("Near-external outer tangent fixture should keep the valid outer tangent constructive export.");
    }
    if (tikz.includes("\\tkzDefIntSimilitudeCenter")) {
      throw new Error("Near-external inner tangent is currently undefined and should not be exported.");
    }
    if (!tikz.includes("\\tkzDrawLine")) {
      throw new Error("Near-external outer tangent fixture should draw the valid tangent line.");
    }
  }

  if (fileName === "tangent-circle-circle-near-equal-outer-safe.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\tkzDefExtSimilitudeCenter")) {
      throw new Error("Near-equal outer tangent fixture should avoid unstable external similitude-center construction.");
    }
    if (!tikz.includes("tkzTanCC_expA_") || !tikz.includes("tkzTanCC_expB_")) {
      throw new Error("Near-equal outer tangent fixture should use explicit tangent-point fallback in unsafe tkz region.");
    }
    if (tikz.includes("tkzTanCC_R_")) {
      throw new Error("Near-equal outer tangent fixture should avoid reduced-radius helper tangent construction in unsafe region.");
    }
    if (!tikz.includes("% gd fallback: unsafe near-equal outer tangent")) {
      throw new Error("Near-equal outer tangent fixture should emit an explicit fallback comment marker in constructions.");
    }
  }

  if (fileName === "tangent-circle-circle-near-equal-outer-intersecting-safe.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\tkzDefExtSimilitudeCenter")) {
      throw new Error(
        "Near-equal intersecting outer tangent fixture should avoid unstable external similitude-center construction."
      );
    }
    if (!tikz.includes("tkzTanCC_expA_") || !tikz.includes("tkzTanCC_expB_")) {
      throw new Error(
        "Near-equal intersecting outer tangent fixture should use explicit tangent-point fallback in unsafe tkz region."
      );
    }
    if (tikz.includes("tkzTanCC_R_")) {
      throw new Error(
        "Near-equal intersecting outer tangent fixture should avoid reduced-radius helper tangent construction in unsafe region."
      );
    }
    if (!tikz.includes("% gd fallback: unsafe near-equal outer tangent")) {
      throw new Error(
        "Near-equal intersecting outer tangent fixture should emit an explicit fallback comment marker in constructions."
      );
    }
    const efficient = makeEfficientTikz(tikz);
    if (!efficient.includes("tkzTanCC_expA_") || !efficient.includes("tkzTanCC_expB_")) {
      throw new Error("Efficient export must preserve explicit tangent-point fallback for unsafe near-equal outer tangents.");
    }
  }

  if (fileName === "tangent-circle-circle-equal-radius-outer-safe.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\tkzDefExtSimilitudeCenter")) {
      throw new Error("Equal-radius outer tangent fixture should avoid external similitude-center construction at infinity.");
    }
    if (tikz.includes("tkzTanCC_A_") || tikz.includes("tkzTanCC_B_")) {
      throw new Error("Equal-radius outer tangent fixture should avoid hard-coded tangent-point fallback.");
    }
    if (!tikz.includes("tkzTanCC_eqRot_") || !tikz.includes("\\tkzDefPointBy[rotation=center")) {
      throw new Error("Equal-radius outer tangent fixture should use constructive rotation-based parallel tangent construction.");
    }
  }

  if (fileName === "tangent-circle-circle-equal-radius-outer-intersecting-safe.json") {
    if (exportError) throw exportError;
    if (tikz.includes("\\tkzDefExtSimilitudeCenter")) {
      throw new Error("Equal-radius intersecting outer tangent fixture should avoid external similitude-center construction at infinity.");
    }
    if (tikz.includes("tkzTanCC_A_") || tikz.includes("tkzTanCC_B_")) {
      throw new Error("Equal-radius intersecting outer tangent fixture should avoid hard-coded tangent-point fallback.");
    }
    if (!tikz.includes("tkzTanCC_eqRot_") || !tikz.includes("\\tkzDefPointBy[rotation=center")) {
      throw new Error("Equal-radius intersecting outer tangent fixture should use constructive rotation-based parallel tangent construction.");
    }
  }

  if (fileName === "tangent-circle-circle-near-degenerate-external-fail.json") {
    if (!exportError) {
      throw new Error("Near-degenerate external tangency fixture should fail closed in exporter.");
    }
    if (!exportError.message.includes("near-degenerate external tangency")) {
      throw new Error("Near-degenerate external tangency fixture should report explicit topology in the error message.");
    }
    if (!exportError.message.includes("d=") || !exportError.message.includes("r1=") || !exportError.message.includes("extGap=")) {
      throw new Error("Near-degenerate external tangency fixture should include numeric diagnostics in the error message.");
    }
    return;
  }

  if (fileName === "tangent-circle-circle-near-degenerate-internal-fail.json") {
    if (!exportError) {
      throw new Error("Near-degenerate internal tangency fixture should fail closed in exporter.");
    }
    if (!exportError.message.includes("near-degenerate internal tangency")) {
      throw new Error("Near-degenerate internal tangency fixture should report explicit topology in the error message.");
    }
    if (!exportError.message.includes("d=") || !exportError.message.includes("r1=") || !exportError.message.includes("intGap=")) {
      throw new Error("Near-degenerate internal tangency fixture should include numeric diagnostics in the error message.");
    }
    return;
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

  if (fileName === "sector-constrained-endpoint.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefPointOnCircle")) {
      throw new Error("Expected sector constrained-endpoint fixture to emit pointOnCircle construction.");
    }
  }

  if (fileName === "polygon-basic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\draw[")) {
      throw new Error("Expected polygon fixture to emit raw TikZ draw command.");
    }
    if (!tikz.includes("-- cycle;")) {
      throw new Error("Expected polygon fixture to emit closed cycle path.");
    }
    if (!tikz.includes("pattern=grid") || !tikz.includes("pattern color=")) {
      throw new Error("Expected polygon fixture to preserve pattern + pattern color options.");
    }
  }

  if (fileName === "sector-line-intersection-export.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefPoint")) {
      throw new Error("Expected sector-line intersection fixture to define explicit point coordinates.");
    }
    const hasNamedPointI =
      /\\tkzDefPoint\([^)]*\)\{I\}/.test(tikz) ||
      /\\tkzDefPoints\{[^}]*\/I(?:,|})/.test(tikz) ||
      /\\tkzGetPoint\{I\}/.test(tikz);
    if (!hasNamedPointI) {
      throw new Error("Expected sector-line intersection fixture to define point I (direct or via tkzGetPoint).");
    }
  }

  if (fileName === "regression-line-coverage-j-o.json") {
    if (exportError) throw exportError;
    if (!/\\tkzInterLL\(F,G\)\(E,D\)\s+\\tkzGetPoint\{J\}/.test(tikz)) {
      throw new Error("Regression: expected J to be defined from InterLL(F,G)(E,D).");
    }
    if (
      !/\\tkzInterLC(?:\[[^\]]*\])?\((?:F,G|G,F)\)\(K,J\)\s+\\tkzGetPoints(?:\{O\}\{[^}]+\}|\{[^}]+\}\{O\})/.test(tikz)
    ) {
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
    if (tikz.includes("\\tkzClip[")) {
      throw new Error("Regression: automatic complete-scene export must not emit a tkz clip.");
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
    if (tikz.includes("\\tkzClip[")) {
      throw new Error("Regression: automatic whitespace fitting must not become a tkz clip.");
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
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkAngle")) {
      throw new Error("Expected approx-right fixture to fallback to \\tkzMarkAngle.");
    }
    if (tikz.includes("\\tkzMarkRightAngles")) {
      throw new Error("Expected approx-right fixture to avoid \\tkzMarkRightAngles.");
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

  if (fileName === "angle-mark-list-quad.json") {
    if (exportError) throw exportError;
    const markAngleLines = tikz.match(/\\tkzMarkAngle\[[^\]]*\]/g) ?? [];
    const groupedMarkAngleForeach = /\\foreach\s+\\[A-Za-z@][A-Za-z0-9@]*(?:\/\\[A-Za-z@][A-Za-z0-9@]*)+\s+in\s*\{[^}]*\}\{\\tkzMarkAngle\[/.test(
      tikz
    );
    if (markAngleLines.length < 2 && !groupedMarkAngleForeach) {
      throw new Error("Expected angle mark list quad fixture to emit repeated or grouped \\tkzMarkAngle commands.");
    }
    if (markAngleLines.length >= 2) {
      const doubleArcLines = markAngleLines.filter((line) => line.includes("arc=ll"));
      if (doubleArcLines.length < 2) {
        throw new Error("Expected angle mark list quad fixture to emit two double-arc mark commands.");
      }
      const sizes = doubleArcLines
        .map((line) => {
          const m = line.match(/size=([0-9.]+)/);
          return m ? Number(m[1]) : NaN;
        })
        .filter((value) => Number.isFinite(value));
      if (sizes.length < 2 || !(sizes[1] > sizes[0])) {
        throw new Error("Expected stacked angle mark list to increase arc size on later entries.");
      }
    } else {
      if (!tikz.includes("\\foreach") || !tikz.includes("\\tkzMarkAngle[") || !tikz.includes("ll")) {
        throw new Error("Expected grouped angle mark list quad fixture to include two double-arc entries.");
      }
    }
  }

  if (fileName === "angle-mark-list-bars.json") {
    if (exportError) throw exportError;
    const markAngleLines = tikz.match(/\\tkzMarkAngle\[[^\]]*\]/g) ?? [];
    const groupedMarkAngleForeach = /\\foreach\s+\\[A-Za-z@][A-Za-z0-9@]*(?:\/\\[A-Za-z@][A-Za-z0-9@]*)*\s+in\s*\{[^}]*\}\{\\tkzMarkAngle\[/.test(
      tikz
    );
    if (markAngleLines.length < 2 && !groupedMarkAngleForeach) {
      throw new Error("Expected angle mark list bars fixture to emit repeated or grouped \\tkzMarkAngle commands.");
    }
    const hasFirstBar =
      markAngleLines.some((line) => line.includes("mark=||") && line.includes("mkpos=0.3")) ||
      (groupedMarkAngleForeach && tikz.includes("/||") && tikz.includes("/0.3"));
    if (!hasFirstBar) {
      throw new Error("Expected angle mark list bars fixture to emit first bar-mark entry with mkpos=0.3.");
    }
    const hasSecondBar =
      markAngleLines.some((line) => line.includes("mark=|") && line.includes("mkpos=0.72")) ||
      (groupedMarkAngleForeach && tikz.includes("/|") && tikz.includes("/0.72"));
    if (!hasSecondBar) {
      throw new Error("Expected angle mark list bars fixture to emit second bar-mark entry with mkpos=0.72.");
    }
  }

  if (fileName === "angle-right-square.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) throw new Error("Expected right-square angle to emit \\tkzMarkRightAngles.");
    if (tikz.includes("german")) throw new Error("Expected right-square angle to omit german option.");
  }

  if (fileName === "angle-right-german.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzMarkRightAngles")) throw new Error("Expected right-german angle to emit \\tkzMarkRightAngles.");
    if (!tikz.includes("german")) throw new Error("Expected right-german angle to include german option.");
    if (!tikz.includes("dotsize=")) throw new Error("Expected right-german angle to include dotsize option.");
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
    if (/(^|[^A-Za-z])E([^A-Za-z]|$)/.test(tikz) || /(^|[^A-Za-z])F([^A-Za-z]|$)/.test(tikz)) {
      throw new Error("Undefined visible points should be skipped from point/label export.");
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

  if (fileName === "segment-mark-list.json") {
    if (exportError) throw exportError;
    const markLines = tikz.match(/\\tkzMarkSegment\[[^\]]*\]/g) ?? [];
    if (markLines.length < 2) {
      throw new Error("Expected segment mark list fixture to emit multiple \\tkzMarkSegment commands.");
    }
    if (!markLines.some((line) => line.includes("mark=||") && line.includes("pos=0.25"))) {
      throw new Error("Expected segment mark list fixture to include first mark at pos=0.25.");
    }
    if (!markLines.some((line) => line.includes("mark=x") && line.includes("pos=0.75"))) {
      throw new Error("Expected segment mark list fixture to include second mark at pos=0.75.");
    }
  }

  if (fileName === "segment-mark-multi.json") {
    if (exportError) throw exportError;
    const usesForeach = tikz.includes("\\foreach \\gdPos in {");
    if (usesForeach) {
      if (!tikz.includes("\\tkzMarkSegment[") || !tikz.includes("pos=\\gdPos")) {
        throw new Error("Expected segment multi-mark fixture to use foreach-driven \\tkzMarkSegment output.");
      }
      if (!tikz.includes("{0.2,0.3,0.4}")) {
        throw new Error("Expected segment multi-mark foreach export to include positions 0.2,0.3,0.4.");
      }
    } else {
      const markLines = tikz.match(/\\tkzMarkSegment\[[^\]]*\]/g) ?? [];
      if (markLines.length < 3) {
        throw new Error("Expected segment multi-mark fixture to emit repeated \\tkzMarkSegment commands.");
      }
      if (!markLines.some((line) => line.includes("pos=0.2"))) {
        throw new Error("Expected segment multi-mark fixture to include pos=0.2.");
      }
      if (!markLines.some((line) => line.includes("pos=0.3"))) {
        throw new Error("Expected segment multi-mark fixture to include pos=0.3.");
      }
      if (!markLines.some((line) => line.includes("pos=0.4"))) {
        throw new Error("Expected segment multi-mark fixture to include pos=0.4.");
      }
    }
  }

  if (fileName === "segment-mark-dot-multi.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\foreach \\gdPos in {")) {
      throw new Error("Expected segment dot multi-mark fixture to emit foreach compact segment mark output.");
    }
    if (!tikz.includes("mark=*")) {
      throw new Error("Expected segment dot multi-mark fixture to map dot mark to TikZ mark=*.");
    }
    if (!tikz.includes("{0.2,0.35,0.5}")) {
      throw new Error("Expected segment dot multi-mark fixture to include positions 0.2,0.35,0.5.");
    }
  }

  if (fileName === "segment-mark-multi-fine-step.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\foreach \\gdPos in {")) {
      throw new Error("Expected fine-step multi-mark fixture to emit foreach compact segment mark output.");
    }
    if (tikz.includes("000000000000") || tikz.includes("000000000001")) {
      throw new Error("Expected fine-step multi-mark standard export to avoid floating-tail precision artifacts.");
    }
    const efficient = makeEfficientTikz(tikz);
    if (!efficient.includes("\\foreach \\gdPos in {")) {
      throw new Error("Expected fine-step multi-mark efficient export to keep foreach compact segment mark output.");
    }
    if (efficient.includes("000000000000") || efficient.includes("000000000001")) {
      throw new Error("Expected fine-step multi-mark efficient export to avoid floating-tail precision artifacts.");
    }
  }

  if (fileName === "segment-mark-arrow-end.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("-{Stealth")) {
      throw new Error("Expected segment end-arrow fixture to emit Stealth end-arrow draw.");
    }
    if (!/\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\([^,]+,E\)/.test(tikz)) {
      throw new Error("Expected segment end-arrow fixture to draw to endpoint.");
    }
  }

  if (fileName === "segment-mark-arrow-end-list-priority.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("-{Stealth")) {
      throw new Error("Expected list-based segment end-arrow fixture to emit Stealth end-arrow draw.");
    }
    if (!/\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\([^,]+,E\)/.test(tikz)) {
      throw new Error("Expected list-based segment end-arrow fixture to draw to endpoint.");
    }
    if (tikz.includes("mark=at position")) {
      throw new Error("Expected list-based segment end-arrow fixture to avoid mid-position markings.");
    }
  }

  if (fileName === "segment-mark-arrow-end-dual-same-color.json") {
    if (exportError) throw exportError;
    const efSegmentDraws = tikz.match(/\\tkzDrawSegment\[[^\]]*\]\(E,F\)/g) ?? [];
    if (efSegmentDraws.some((cmd) => !cmd.includes("}-{Stealth["))) {
      throw new Error("Expected dual endpoint arrows to replace base segment stroke.");
    }
    if (!tikz.includes("}-{Stealth[")) {
      throw new Error("Expected dual endpoint arrows to merge into a single bidirectional endpoint draw.");
    }
    const mergedCount = (tikz.match(/\\tkzDrawSegment\[[^\]]*\{Stealth\[[^\]]*\]\}-\{Stealth\[[^\]]*\]\}[^\]]*\]\(E,F\)/g) ?? []).length;
    if (mergedCount !== 1) {
      throw new Error(`Expected one merged E,F bidirectional segment draw command; found ${mergedCount}.`);
    }
    if (/\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\(F,E\)/.test(tikz)) {
      throw new Error("Expected no separate reverse full-length tkz segment draw after bidirectional merge.");
    }
  }

  if (fileName === "segment-mark-arrow-end-dual-mixed-size.json") {
    if (exportError) throw exportError;
    const efSegmentDraws = tikz.match(/\\tkzDrawSegment\[[^\]]*\]\(E,F\)/g) ?? [];
    if (efSegmentDraws.some((cmd) => !cmd.includes("-{Stealth["))) {
      throw new Error("Expected mixed-size dual endpoint arrows to replace base segment stroke.");
    }
    const fullForward = /\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\(E,F\)/.test(tikz);
    if (!fullForward) {
      throw new Error("Expected mixed-size dual endpoint arrows to keep one full carrier draw.");
    }
    if (/\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\(F,E\)/.test(tikz)) {
      throw new Error("Expected non-carrier reverse endpoint arrow to avoid full-length reverse draw.");
    }
    if (!tikz.includes("$(") || !tikz.includes("!0.")) {
      throw new Error("Expected non-carrier reverse endpoint arrow to emit short head-only endpoint draw.");
    }
  }

  if (fileName === "segment-mark-arrow-end-plus-mid-same-color.json") {
    if (exportError) throw exportError;
    const efSegmentDraws = tikz.match(/\\tkzDrawSegment\[[^\]]*\]\(E,F\)/g) ?? [];
    if (efSegmentDraws.some((cmd) => !cmd.includes("-{Stealth["))) {
      throw new Error("Expected endpoint+mid fixture to replace base segment stroke with endpoint arrow draw.");
    }
    if (!/\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\(E,F\)/.test(tikz)) {
      throw new Error("Expected endpoint+mid fixture to emit endpoint draw for E->F.");
    }
    if (!tikz.includes("mark=at position")) {
      throw new Error("Expected endpoint+mid fixture to preserve midpoint arrow marks.");
    }
  }

  if (fileName === "segment-mark-arrow-end-color-mismatch.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDrawSegment") || !tikz.includes("(E,F)")) {
      throw new Error("Expected color-mismatch endpoint fixture to keep base segment stroke.");
    }
    if (!/\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\(E,F\)/.test(tikz)) {
      throw new Error("Expected color-mismatch endpoint fixture to still emit endpoint draw.");
    }
  }

  if (fileName === "segment-mark-arrow-mid.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("postaction=decorate")) {
      throw new Error("Expected segment mid-arrow fixture to emit decoration-based draw.");
    }
    if (!tikz.includes("mark=at position")) {
      throw new Error("Expected segment mid-arrow fixture to emit mark=at position.");
    }
    const markCount = (tikz.match(/mark=at position/g) ?? []).length;
    if (markCount < 2) {
      throw new Error("Expected segment bidirectional mid-arrow to emit separated mark positions.");
    }
    const marks = extractMarkCommands(tikz);
    if (marks.length < 2) {
      throw new Error("Expected segment bidirectional mid-arrow to emit parseable mark commands.");
    }
    const [left, right] = marks
      .slice(0, 2)
      .sort((a, b) => a.position - b.position);
    if (left.cmd !== "arrowreversed" || right.cmd !== "arrow") {
      throw new Error("Expected segment <-> mid-arrow to emit outward command order: reversed then forward.");
    }
    const segment = scene.segments[0];
    const pointA = scene.points.find((point) => point.id === segment?.aId);
    const pointB = scene.points.find((point) => point.id === segment?.bId);
    const worldA = pointA ? getPointWorldPos(pointA, scene) : null;
    const worldB = pointB ? getPointWorldPos(pointB, scene) : null;
    const pathLengthWorld = worldA && worldB ? Math.hypot(worldB.x - worldA.x, worldB.y - worldA.y) : 0;
    const pxPerWorld = 80;
    const gapPx = (right.position - left.position) * pathLengthWorld * pxPerWorld;
    if (!Number.isFinite(gapPx) || gapPx < 3) {
      throw new Error("Expected segment <-> mid-arrow marks to be separated enough to be visually distinct.");
    }
  }

  if (fileName === "segment-mark-arrow-mid-near-edge.json") {
    if (exportError) throw exportError;
    if (/\\tkzDrawSegment\[[^\]]*-\{(?:Stealth|Latex|Triangle)\[[^\]]*\][^\]]*\]/.test(tikz)) {
      throw new Error("Expected near-edge mid arrow fixture to remain decoration-based (not endpoint draw).");
    }
    const marks = extractMarkCommands(tikz);
    if (marks.length < 1) {
      throw new Error("Expected near-edge mid arrow fixture to emit parseable mark commands.");
    }
    const first = marks[0];
    if (first.cmd !== "arrowreversed") {
      throw new Error("Expected near-edge mid <- arrow to emit reversed arrow glyph.");
    }
    if (Math.abs(first.position - 0.02) > 0.005) {
      throw new Error(`Expected near-edge mid arrow position ~0.02, got ${first.position}.`);
    }
  }

  if (fileName === "segment-mark-arrow-mid-endpoint-compat.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("-{Stealth")) {
      throw new Error("Expected endpoint-compat fixture to emit end-arrow draw for legacy mid pos=1.");
    }
    if (!/\\tkzDrawSegment\[[^\]]*-\{Stealth\[[^\]]*\][^\]]*\]\([^,]+,F\)/.test(tikz)) {
      throw new Error("Expected endpoint-compat fixture to draw to endpoint F.");
    }
    if (tikz.includes("mark=at position")) {
      throw new Error("Expected endpoint-compat fixture to avoid mark-at-position output.");
    }
  }

  if (fileName === "segment-mark-arrow-mid-gap.json") {
    if (exportError) throw exportError;
    const marks = extractMarkCommands(tikz);
    if (marks.length < 2) {
      throw new Error("Expected mid-gap fixture to emit parseable mark commands.");
    }
    const [left, right] = marks
      .slice(0, 2)
      .sort((a, b) => a.position - b.position);
    if (left.cmd !== "arrowreversed" || right.cmd !== "arrow") {
      throw new Error("Expected segment <-> mid-gap fixture to emit outward command order.");
    }
    const measuredGap = right.position - left.position;
    const segment = scene.segments[0];
    const pointA = scene.points.find((point) => point.id === segment?.aId);
    const pointB = scene.points.find((point) => point.id === segment?.bId);
    const worldA = pointA ? getPointWorldPos(pointA, scene) : null;
    const worldB = pointB ? getPointWorldPos(pointB, scene) : null;
    const pathLengthWorld =
      worldA && worldB ? Math.hypot(worldB.x - worldA.x, worldB.y - worldA.y) : 0;
    if (!(pathLengthWorld > 1e-9)) {
      throw new Error("Expected mid-gap fixture to have a resolvable non-zero segment length.");
    }
    const explicitPairGap =
      (Array.isArray(segment?.style.segmentArrowMarks) && segment.style.segmentArrowMarks.length > 0
        ? segment.style.segmentArrowMarks[0]?.pairGapPx
        : segment?.style.segmentArrowMark?.pairGapPx) ?? 30;
    const pairGapPx = Number.isFinite(explicitPairGap) ? Number(explicitPairGap) : 30;
    const pxPerWorld = 80;
    const expectedGap = (2 * pairGapPx) / (pathLengthWorld * pxPerWorld); // 2*pairGapPx / (pathLengthWorld * export px density)
    if (Math.abs(measuredGap - expectedGap) > 0.005) {
      throw new Error(`Expected explicit pairGapPx spacing ${expectedGap}, got ${measuredGap}.`);
    }
  }

  if (fileName === "segment-mark-arrow-mid-multi.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("gdMultiArrow/.style={")) {
      throw new Error("Expected segment multi mid-arrow fixture to emit a named, editable style.");
    }
    if (!tikz.includes("mark=between positions 0.45 and 0.55 step 0.05 with")) {
      throw new Error("Expected segment multi mid-arrow fixture to keep its range human-readable.");
    }
    if (!tikz.includes("\\path[gdMultiArrow={Stealth[")) {
      throw new Error("Expected segment multi mid-arrow fixture to apply a normal TikZ arrow tip.");
    }
    if (tikz.includes("mark=at position")) {
      throw new Error("Expected a regular multi-arrow range not to expand into repeated mark commands.");
    }
  }

  if (fileName === "segment-mark-arrow-mid-inward.json") {
    if (exportError) throw exportError;
    const marks = extractMarkCommands(tikz);
    if (marks.length < 2) {
      throw new Error("Expected inward mid-arrow fixture to emit parseable mark commands.");
    }
    const [left, right] = marks
      .slice(0, 2)
      .sort((a, b) => a.position - b.position);
    if (left.cmd !== "arrow" || right.cmd !== "arrowreversed") {
      throw new Error("Expected segment >-< mid-arrow to emit inward command order: forward then reversed.");
    }
    const segment = scene.segments[0];
    const pointA = scene.points.find((point) => point.id === segment?.aId);
    const pointB = scene.points.find((point) => point.id === segment?.bId);
    const worldA = pointA ? getPointWorldPos(pointA, scene) : null;
    const worldB = pointB ? getPointWorldPos(pointB, scene) : null;
    const pathLengthWorld = worldA && worldB ? Math.hypot(worldB.x - worldA.x, worldB.y - worldA.y) : 0;
    const pxPerWorld = 80;
    const gapPx = (right.position - left.position) * pathLengthWorld * pxPerWorld;
    if (!Number.isFinite(gapPx) || gapPx < 3) {
      throw new Error("Expected segment >-< mid-arrow marks to be separated enough to be visually distinct.");
    }
  }

  if (fileName === "circle-arrow-basic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("arc[start angle=0,end angle=-360,radius=")) {
      throw new Error("Expected circle arrow fixture to emit clockwise full-arc path arrow overlay.");
    }
    if (!tikz.includes("postaction=decorate")) {
      throw new Error("Expected circle arrow fixture to emit decoration-based arrow overlay.");
    }
    if (!tikz.includes("\\draw[color=")) {
      throw new Error("Expected circle arrow fixture to emit canvas-parity stroked arrow glyph.");
    }
  }

  if (fileName === "circle-arrow-mid-position-parity.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("(0.5,-2.5) arc[start angle=0,end angle=-360,radius=2.5]")) {
      throw new Error("Expected circle mid-arrow parity fixture to anchor full-circle overlay at center+radius (+x) start.");
    }
    if (tikz.includes("(D) arc[start angle=")) {
      throw new Error("Expected circle mid-arrow parity fixture to avoid through-point-based full-circle start.");
    }
    const marks = extractMarkCommands(tikz);
    if (marks.length < 2) {
      throw new Error("Expected circle mid-arrow parity fixture to emit parseable paired mark commands.");
    }
    const [left, right] = marks
      .slice(0, 2)
      .sort((a, b) => a.position - b.position);
    if (left.cmd !== "arrow" || right.cmd !== "arrowreversed") {
      throw new Error("Expected circle >-< parity fixture to emit inward command order.");
    }
  }

  if (fileName === "circle-arrow-dot-multi.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("postaction=decorate")) {
      throw new Error("Expected circle dot-arrow fixture to emit decoration-based overlay.");
    }
    if (!tikz.includes("\\fill[") || !tikz.includes("circle[radius=")) {
      throw new Error("Expected circle dot-arrow fixture to emit filled dot marker commands.");
    }
    if (!tikz.includes("\\draw[") || !tikz.includes("circle[radius=")) {
      throw new Error("Expected circle dot-arrow fixture to emit open-dot marker commands.");
    }
    if (tikz.includes("\\arrow[")) {
      throw new Error("Expected circle dot-arrow fixture to avoid arrowhead commands.");
    }
  }

  if (fileName === "sector-arrow-basic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDrawSector")) {
      throw new Error("Expected sector arrow fixture to emit sector draw command.");
    }
    const hasArcOverlay =
      tikz.includes(") arc[start angle=") ||
      tikz.includes(") arc (");
    if (!hasArcOverlay) {
      throw new Error("Expected sector arrow fixture to emit arc path overlay.");
    }
    if (!tikz.includes("\\fill[color=")) {
      throw new Error("Expected sector arrow fixture to emit canvas-parity filled arrow glyph.");
    }
  }



  if (
    fileName === "segment-mark-arrow-mid.json" ||
    fileName === "segment-mark-arrow-end-plus-mid-same-color.json" ||
    fileName === "segment-mark-arrow-mid-near-edge.json" ||
    fileName === "segment-mark-arrow-mid-gap.json" ||
    fileName === "segment-mark-arrow-mid-inward.json" ||
    fileName === "circle-arrow-basic.json" ||
    fileName === "circle-arrow-mid-position-parity.json" ||
    fileName === "sector-arrow-basic.json"
  ) {
    const hasMarkingArrowLibLine = tikz
      .split("\n")
      .some((line) => /\\usetikzlibrary\{[^}]*decorations\.markings[^}]*\}/.test(line));
    const hasConstructiveArrowLib =
      tikz
        .split("\n")
        .some(
          (line) => /\\usetikzlibrary\{[^}]*arrows\.meta[^}]*\}/.test(line) && /\\usetikzlibrary\{[^}]*bending[^}]*\}/.test(line)
        );
    if (!hasMarkingArrowLibLine && !hasConstructiveArrowLib) {
      throw new Error("Expected arrow fixtures to emit an arrows.meta (+ optional markings/bending) library line.");
    }
  }

  if (fileName === "circle-arrow-dot-multi.json") {
    const hasDecorationsMarkings = /\\usetikzlibrary\{[^}]*\bdecorations\.markings\b[^}]*\}/.test(tikz);
    if (!hasDecorationsMarkings) {
      throw new Error("Expected circle dot-arrow fixture to include decorations.markings library.");
    }
  }

  if (fileName === "circle-fixed-radius-basic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefCircle[R](O,3.5)")) {
      throw new Error("Expected fixed-radius circle fixture to emit \\tkzDefCircle[R](O,3.5).");
    }
  }

  if (fileName === "circle-incircle-symbolic.json") {
    if (exportError) throw exportError;
    if (!tikz.includes("\\tkzDefCircle[in](A,B,C) \\tkzGetPoints{D}{")) {
      throw new Error("Expected incircle fixture to emit symbolic \\tkzDefCircle[in](A,B,C) construction.");
    }
    if (tikz.includes("\\tkzDefCircle[R](D,")) {
      throw new Error("Expected incircle fixture to avoid numeric fixed-radius circle construction.");
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
    const hasPatternsLine = /\\usetikzlibrary\{[^}]*\bpatterns\b[^}]*\}/.test(tikz);
    if (hasPatternsLine) {
      throw new Error("Expected no-patterns fixture to omit patterns library line.");
    }
    const hasPatternsMeta = /\\usetikzlibrary\{[^}]*\bpatterns\.meta\b[^}]*\}/.test(tikz);
    if (hasPatternsMeta) {
      throw new Error("Expected no-patterns fixture to omit patterns.meta library.");
    }
  }

  if (fileName === "export-with-patterns.json") {
    if (exportError) throw exportError;
    const hasPatternsLine = /\\usetikzlibrary\{[^}]*\bpatterns\b[^}]*\}/.test(tikz);
    if (!hasPatternsLine) {
      throw new Error("Expected patterns fixture to emit \\usetikzlibrary{patterns}.");
    }
    const hasPatternsMeta = /\\usetikzlibrary\{[^}]*\bpatterns\.meta\b[^}]*\}/.test(tikz);
    if (hasPatternsMeta) {
      throw new Error("Expected classic patterns fixture to avoid patterns.meta.");
    }
    if (!tikz.includes("pattern=north east lines")) {
      throw new Error("Expected patterns fixture to emit classic pattern style.");
    }
  }

  if (fileName === "export-with-patterns-meta.json") {
    if (exportError) throw exportError;
    const hasPatternsAndMeta =
      /\\usetikzlibrary\{[^}]*\bpatterns\b[^}]*\}/.test(tikz) &&
      /\\usetikzlibrary\{[^}]*\bpatterns\.meta\b[^}]*\}/.test(tikz);
    if (!hasPatternsAndMeta) {
      throw new Error("Expected patterns-meta fixture to emit \\usetikzlibrary{patterns,patterns.meta}.");
    }
    if (!tikz.includes("pattern={Lines[angle=45,distance=4pt]}")) {
      throw new Error("Expected patterns-meta fixture to emit pattern={...} style.");
    }
  }

  if (fileName === "sector-pattern-fill.json") {
    if (exportError) throw exportError;
    const hasPatternsLine = /\\usetikzlibrary\{[^}]*\bpatterns\b[^}]*\}/.test(tikz);
    if (!hasPatternsLine) {
      throw new Error("Expected sector pattern fixture to emit \\usetikzlibrary{patterns}.");
    }
    if (!tikz.includes("pattern=north east lines")) {
      throw new Error("Expected sector pattern fixture to emit pattern option.");
    }
    if (!tikz.includes("pattern color=")) {
      throw new Error("Expected sector pattern fixture to emit pattern color option.");
    }
  }

  if (exportError) throw exportError;
}

function extractMarkCommands(tikz: string): Array<{ position: number; cmd: "arrow" | "arrowreversed" }> {
  const marks: Array<{ position: number; cmd: "arrow" | "arrowreversed" }> = [];
  const regex = /mark=at position\s+([0-9]*\.?[0-9]+)\s+with\s+\{\\(arrow|arrowreversed)\[/g;
  for (const match of tikz.matchAll(regex)) {
    const position = Number(match[1]);
    const cmd = match[2] === "arrowreversed" ? "arrowreversed" : "arrow";
    if (Number.isFinite(position)) marks.push({ position, cmd });
  }
  const glyphRegex = /mark=at position\s+([0-9]*\.?[0-9]+)\s+with\s+\{(\\(?:fill|draw)\[[^}]+?;\s*)\}/g;
  for (const match of tikz.matchAll(glyphRegex)) {
    const position = Number(match[1]);
    const coordMatches = [...match[2].matchAll(/\(([-+]?\d*\.?\d+)pt,/g)];
    const directionalCoord = coordMatches
      .map((coordMatch) => Number(coordMatch[1]))
      .find((value) => Number.isFinite(value) && Math.abs(value) > 1e-6);
    if (!Number.isFinite(position) || directionalCoord === undefined) continue;
    marks.push({ position, cmd: directionalCoord < 0 ? "arrow" : "arrowreversed" });
  }
  marks.sort((a, b) => a.position - b.position);
  return marks;
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

function assertTkzSetupToggleRegression(): void {
  const scene: SceneModel = {
    points: [
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: defaultPointStyle,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 4, y: 0 },
        style: defaultPointStyle,
      },
    ],
    numbers: [],
    lines: [],
    segments: [
      {
        id: "sAB",
        aId: "pA",
        bId: "pB",
        visible: true,
        showLabel: false,
        style: defaultLineStyle,
      },
    ],
    circles: [],
    polygons: [],
    angles: [],
  };

  const withSetup = exportTikzWithOptions(scene, { emitTkzSetup: true });
  if (!withSetup.includes("\\tkzInit[") || !withSetup.includes("\\tkzSetUpLine[")) {
    throw new Error("Regression: emitTkzSetup=true must include non-clipping tkz setup lines.");
  }
  if (withSetup.includes("\\tkzClip[space=")) {
    throw new Error("Regression: emitTkzSetup=true must not turn automatic fitting into a crop.");
  }
  const withoutSetup = exportTikzWithOptions(scene, { emitTkzSetup: false });
  if (withoutSetup.includes("\\tkzInit[") || withoutSetup.includes("\\tkzClip[space=") || withoutSetup.includes("\\tkzSetUpLine[")) {
    throw new Error("Regression: emitTkzSetup=false must omit tkz setup lines.");
  }
  if (!withoutSetup.includes("\\tkzDrawSegment")) {
    throw new Error("Regression: geometry must still export when tkz setup lines are omitted.");
  }
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
