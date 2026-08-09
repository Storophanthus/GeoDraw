import type { TikzCommand } from "../tikz";
import type { TikzRendererContext } from "./renderContext";

type PointStyleDefLike = {
  styleName: string;
  styleExpr: string;
};

type SetupViewportCommand = Extract<TikzCommand, { kind: "SetupViewport" }>;
type SetupLineCommand = Extract<TikzCommand, { kind: "SetupLine" }>;
type ClipRectCommand = Extract<TikzCommand, { kind: "ClipRect" }>;
type ClipPolygonCommand = Extract<TikzCommand, { kind: "ClipPolygon" }>;
type DefPointsCommand = Extract<TikzCommand, { kind: "DefPoints" }>;
type DefPointCommand = Extract<TikzCommand, { kind: "DefPoint" }>;

type SetupAndPointsRendererArgs = {
  ctx: TikzRendererContext;
  precomputedSegmentMarkStyleNames: string[];
  setupViewport?: SetupViewportCommand;
  setupLine?: SetupLineCommand;
  clipRect?: ClipRectCommand;
  clipPolygon?: ClipPolygonCommand;
  pointStyles: PointStyleDefLike[];
  pointsDefs: DefPointsCommand[];
  pointDefs: DefPointCommand[];
};

type SegmentMarkStyleSpec = {
  argumentHelp: string;
  argumentCount: number;
  commands: string[];
};

const SEGMENT_MARK_STYLE_SPECS: Record<string, SegmentMarkStyleSpec> = {
  gdMarkTick: {
    argumentHelp: "{position}{tick half-length}{draw options}",
    argumentCount: 3,
    commands: ["\\draw[#3,gdMarkStroke] (0pt,-#2) -- (0pt,#2);"],
  },
  gdMarkDoubleTick: {
    argumentHelp: "{position}{tick half-length}{bar half-gap}{draw options}",
    argumentCount: 4,
    commands: [
      "\\draw[#4,gdMarkStroke,xshift=-#3] (0pt,-#2) -- (0pt,#2);",
      "\\draw[#4,gdMarkStroke,xshift=#3] (0pt,-#2) -- (0pt,#2);",
    ],
  },
  gdMarkTripleTick: {
    argumentHelp: "{position}{tick half-length}{bar gap}{draw options}",
    argumentCount: 4,
    commands: [
      "\\draw[#4,gdMarkStroke,xshift=-#3] (0pt,-#2) -- (0pt,#2);",
      "\\draw[#4,gdMarkStroke] (0pt,-#2) -- (0pt,#2);",
      "\\draw[#4,gdMarkStroke,xshift=#3] (0pt,-#2) -- (0pt,#2);",
    ],
  },
  gdMarkSlash: {
    argumentHelp: "{position}{along half-length}{cross half-length}{draw options}",
    argumentCount: 4,
    commands: ["\\draw[#4,gdMarkStroke] (-#2,-#3) -- (#2,#3);"],
  },
  gdMarkSlashTick: {
    argumentHelp: "{position}{slash X}{slash Y}{bar half-gap}{tick half-length}{draw options}",
    argumentCount: 6,
    commands: [
      "\\draw[#6,gdMarkStroke,xshift=-#4] (-#2,-#3) -- (#2,#3);",
      "\\draw[#6,gdMarkStroke,xshift=#4] (0pt,-#5) -- (0pt,#5);",
    ],
  },
  gdMarkSlashDoubleTick: {
    argumentHelp: "{position}{slash X}{slash Y}{bar gap}{tick half-length}{draw options}",
    argumentCount: 6,
    commands: [
      "\\draw[#6,gdMarkStroke,xshift=-#4] (-#2,-#3) -- (#2,#3);",
      "\\draw[#6,gdMarkStroke] (0pt,-#5) -- (0pt,#5);",
      "\\draw[#6,gdMarkStroke,xshift=#4] (0pt,-#5) -- (0pt,#5);",
    ],
  },
  gdMarkCross: {
    argumentHelp: "{position}{X half-size}{Y half-size}{draw options}",
    argumentCount: 4,
    commands: [
      "\\draw[#4,gdMarkStroke] (-#2,-#3) -- (#2,#3);",
      "\\draw[#4,gdMarkStroke] (-#2,#3) -- (#2,-#3);",
    ],
  },
  gdMarkCircle: {
    argumentHelp: "{position}{radius}{draw options}",
    argumentCount: 3,
    commands: ["\\draw[#3,gdMarkStroke] (0pt,0pt) circle[radius=#2];"],
  },
  gdMarkDoubleCircle: {
    argumentHelp: "{position}{radius}{center half-gap}{draw options}",
    argumentCount: 4,
    commands: [
      "\\draw[#4,gdMarkStroke,xshift=-#3] (0pt,0pt) circle[radius=#2];",
      "\\draw[#4,gdMarkStroke,xshift=#3] (0pt,0pt) circle[radius=#2];",
    ],
  },
  gdMarkDot: {
    argumentHelp: "{position}{radius}{fill options}",
    argumentCount: 3,
    commands: ["\\fill[#3,gdMarkFill] (0pt,0pt) circle[radius=#2];"],
  },
  gdMarkZigzag: {
    argumentHelp: "{position}{X half-size}{outer Y}{inner Y}{draw options}",
    argumentCount: 5,
    commands: ["\\draw[#5,gdMarkStroke] (-#2,-#3) -- (#2,-#4) -- (-#2,#3) -- (#2,#4);"],
  },
};

function appendPrecomputedSegmentMarkTikzset(out: string[], rawStyleNames: string[]): void {
  const styleNames = [...new Set(rawStyleNames)].filter(
    (name) => SEGMENT_MARK_STYLE_SPECS[name] !== undefined
  );
  if (styleNames.length === 0) return;

  const usesStrokeStyle = styleNames.some((name) => name !== "gdMarkDot");
  const usesFillStyle = styleNames.includes("gdMarkDot");
  out.push("% Segment-mark styles used in this figure; each use is labeled below.");
  if (usesStrokeStyle && usesFillStyle) {
    out.push("% Edit gdMarkStroke or gdMarkFill to override every mark globally.");
  } else if (usesStrokeStyle) {
    out.push("% Edit gdMarkStroke to override every mark globally.");
  } else {
    out.push("% Edit gdMarkFill to override every mark globally.");
  }
  out.push("\\tikzset{");
  if (usesStrokeStyle) out.push("  gdMarkStroke/.style={line cap=round, line join=round},");
  if (usesFillStyle) out.push("  gdMarkFill/.style={},");
  styleNames.forEach((name, index) => {
    const spec = SEGMENT_MARK_STYLE_SPECS[name];
    out.push(`  % ${name} arguments: ${spec.argumentHelp}`);
    out.push(`  ${name}/.style n args={${spec.argumentCount}}{`);
    out.push("    decoration={");
    out.push("      markings,");
    out.push("      mark=at position #1 with {");
    for (const command of spec.commands) out.push(`        ${command}`);
    out.push("      }");
    out.push("    },");
    out.push("    postaction={decorate}");
    out.push(`  }${index < styleNames.length - 1 ? "," : ""}`);
  });
  out.push("}");
}

export function appendRenderedSetupAndPoints({
  ctx,
  precomputedSegmentMarkStyleNames,
  setupViewport,
  setupLine,
  clipRect,
  clipPolygon,
  pointStyles,
  pointsDefs,
  pointDefs,
}: SetupAndPointsRendererArgs): void {
  const out = ctx.out;
  const { scale, trueGlobalScale, labelHaloScale, usesLabelGlowMacro, emitTkzSetup, drawLayerBackend } = ctx.options;
  const caps = ctx.capabilities;

  const appliesTrueGlobalScale = Math.abs(trueGlobalScale - 1) > 1e-9;
  // Coordinate transforms are geometry too. Rounding this scale while keeping
  // coordinates precise changes the physical figure size, so keep it out of
  // the optional cosmetic two-decimal formatting pass.
  const renderedCoordinateScale = caps.fmtGeometry(scale);
  const pictureSizing = appliesTrueGlobalScale
    ? `x=${renderedCoordinateScale}cm,y=${renderedCoordinateScale}cm,scale=${caps.fmt(trueGlobalScale)},transform shape`
    : `scale=${renderedCoordinateScale}`;
  out.push(`\\begin{tikzpicture}[${pictureSizing},line cap=round,line join=round,>=triangle 45]`);
  if (usesLabelGlowMacro) {
    if (drawLayerBackend === "plain") {
      // Visual Exact supplies its calibrated width per label. Page-colored
      // calls pass \thepagecolor explicitly; define a local white fallback so
      // copied snippets remain safe without the pagecolor package.
      out.push(
        "\\newcommand{\\gdLabelGlow}[3]{\\begingroup\\ifcsname contour\\endcsname\\contourlength{#1}\\ifcsname thepagecolor\\endcsname\\else\\def\\thepagecolor{white}\\fi\\if\\relax\\detokenize{#2}\\relax\\contour{\\thepagecolor}{#3}\\else\\contour{#2}{#3}\\fi\\else#3\\fi\\endgroup}"
      );
    } else {
      // Reconstructible mode uses a compact page-color-aware default.
      out.push(
        `\\newcommand{\\gdLabelGlow}[1]{\\begingroup\\ifcsname contour\\endcsname\\contourlength{${caps.fmt(0.42 * trueGlobalScale * labelHaloScale)}pt}\\ifcsname thepagecolor\\endcsname\\contour{\\thepagecolor}{#1}\\else\\contour{white}{#1}\\fi\\else#1\\fi\\endgroup}`
      );
    }
  }
  appendPrecomputedSegmentMarkTikzset(out, precomputedSegmentMarkStyleNames);
  if (drawLayerBackend === "plain") {
    if (clipRect) {
      const clipPath = `(${caps.fmtGeometry(clipRect.xmin)},${caps.fmtGeometry(clipRect.ymin)}) rectangle (${caps.fmtGeometry(clipRect.xmax)},${caps.fmtGeometry(clipRect.ymax)})`;
      out.push(`\\path[use as bounding box] ${clipPath};`);
      out.push(`\\clip ${clipPath};`);
    } else if (clipPolygon && clipPolygon.points.length >= 3) {
      const xs = clipPolygon.points.map((point) => point.x);
      const ys = clipPolygon.points.map((point) => point.y);
      const boundsPath = `(${caps.fmtGeometry(Math.min(...xs))},${caps.fmtGeometry(Math.min(...ys))}) rectangle (${caps.fmtGeometry(Math.max(...xs))},${caps.fmtGeometry(Math.max(...ys))})`;
      const polygonPath = clipPolygon.points
        .map((point) => `(${caps.fmtGeometry(point.x)},${caps.fmtGeometry(point.y)})`)
        .join(" -- ");
      out.push(`\\path[use as bounding box] ${boundsPath};`);
      out.push(`\\clip ${polygonPath} -- cycle;`);
    } else if (setupViewport) {
      const xmin = setupViewport.xmin - setupViewport.space;
      const xmax = setupViewport.xmax + setupViewport.space;
      const ymin = setupViewport.ymin - setupViewport.space;
      const ymax = setupViewport.ymax + setupViewport.space;
      const viewportPath = `(${caps.fmtGeometry(xmin)},${caps.fmtGeometry(ymin)}) rectangle (${caps.fmtGeometry(xmax)},${caps.fmtGeometry(ymax)})`;
      out.push(`\\path[use as bounding box] ${viewportPath};`);
      out.push(`\\clip ${viewportPath};`);
    }
  }
  // When explicit export clip rectangle is present, avoid tkz viewport clip to
  // prevent extra outer whitespace from a larger bounding box.
  if (drawLayerBackend === "tkz" && emitTkzSetup && setupViewport && !clipRect && !clipPolygon) {
    caps.assertTkzMacro("tkzInit");
    caps.assertTkzMacro("tkzClip");
    out.push(
      `\\tkzInit[xmin=${caps.fmt(setupViewport.xmin)},xmax=${caps.fmt(setupViewport.xmax)},ymin=${caps.fmt(
        setupViewport.ymin
      )},ymax=${caps.fmt(setupViewport.ymax)}]`
    );
    out.push(`\\tkzClip[space=${caps.fmt(setupViewport.space)}]`);
  }
  if (drawLayerBackend === "tkz" && emitTkzSetup && setupLine) {
    caps.assertTkzMacro("tkzSetUpLine");
    out.push(`\\tkzSetUpLine[add=${caps.fmt(setupLine.addLeft)} and ${caps.fmt(setupLine.addRight)}]`);
  }
  if (drawLayerBackend !== "plain" && clipRect) {
    out.push(`\\clip (${caps.fmt(clipRect.xmin)},${caps.fmt(clipRect.ymin)}) rectangle (${caps.fmt(clipRect.xmax)},${caps.fmt(clipRect.ymax)});`);
  }
  if (drawLayerBackend !== "plain" && clipPolygon && clipPolygon.points.length >= 3) {
    const path = clipPolygon.points.map((p) => `(${caps.fmt(p.x)},${caps.fmt(p.y)})`).join(" -- ");
    out.push(`\\clip ${path} -- cycle;`);
  }

  // Emit predefined styles used by tkzDrawPoints[...] commands.
  for (const style of pointStyles) {
    out.push(`\\tikzset{${style.styleName}/.style={${style.styleExpr}}}`);
  }

  ctx.pushSectionHeader("% Points");
  // Both modes require precise defining coordinates. In particular, rounding
  // a tiny drawing from 3.735... to 3.74 changes its shape by a large fraction;
  // an "Exact coordinates" export must not do that. The two-decimal option is
  // therefore limited to cosmetic values such as widths, fonts, and opacity.
  const fmtPoint = caps.fmtGeometry;
  for (const cmd of pointsDefs) {
    const items = cmd.items.map((it) => `${fmtPoint(it.x)}/${fmtPoint(it.y)}/${it.name}`).join(", ");
    if (drawLayerBackend === "plain") {
      for (const item of cmd.items) {
        out.push(`\\coordinate (${item.name}) at (${fmtPoint(item.x)},${fmtPoint(item.y)});`);
      }
    } else {
      caps.assertTkzMacro("tkzDefPoints");
      out.push(`\\tkzDefPoints{${items}}`);
    }
  }
  for (const cmd of pointDefs) {
    if (drawLayerBackend === "plain") {
      out.push(`\\coordinate (${cmd.name}) at (${fmtPoint(cmd.x)},${fmtPoint(cmd.y)});`);
    } else {
      caps.assertTkzMacro("tkzDefPoint");
      out.push(`\\tkzDefPoint(${fmtPoint(cmd.x)},${fmtPoint(cmd.y)}){${cmd.name}}`);
    }
  }
}
