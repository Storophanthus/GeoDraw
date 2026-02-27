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
  setupViewport?: SetupViewportCommand;
  setupLine?: SetupLineCommand;
  clipRect?: ClipRectCommand;
  clipPolygon?: ClipPolygonCommand;
  pointStyles: PointStyleDefLike[];
  pointsDefs: DefPointsCommand[];
  pointDefs: DefPointCommand[];
};

export function appendRenderedSetupAndPoints({
  ctx,
  setupViewport,
  setupLine,
  clipRect,
  clipPolygon,
  pointStyles,
  pointsDefs,
  pointDefs,
}: SetupAndPointsRendererArgs): void {
  const out = ctx.out;
  const { scale, hasGlowLabels, emitTkzSetup } = ctx.options;
  const caps = ctx.capabilities;

  out.push(`\\begin{tikzpicture}[scale=${caps.fmt(scale)},line cap=round,line join=round,>=triangle 45]`);
  if (hasGlowLabels) {
    // Reusable text halo macro using contour stroke (page-color aware).
    out.push(
      "\\newcommand{\\gdLabelGlow}[1]{\\begingroup\\ifcsname contour\\endcsname\\contourlength{0.42pt}\\ifcsname thepagecolor\\endcsname\\contour{\\thepagecolor}{#1}\\else\\contour{white}{#1}\\fi\\else#1\\fi\\endgroup}"
    );
  }
  // When explicit export clip rectangle is present, avoid tkz viewport clip to
  // prevent extra outer whitespace from a larger bounding box.
  if (emitTkzSetup && setupViewport && !clipRect && !clipPolygon) {
    caps.assertTkzMacro("tkzInit");
    caps.assertTkzMacro("tkzClip");
    out.push(
      `\\tkzInit[xmin=${caps.fmt(setupViewport.xmin)},xmax=${caps.fmt(setupViewport.xmax)},ymin=${caps.fmt(
        setupViewport.ymin
      )},ymax=${caps.fmt(setupViewport.ymax)}]`
    );
    out.push(`\\tkzClip[space=${caps.fmt(setupViewport.space)}]`);
  }
  if (emitTkzSetup && setupLine) {
    caps.assertTkzMacro("tkzSetUpLine");
    out.push(`\\tkzSetUpLine[add=${caps.fmt(setupLine.addLeft)} and ${caps.fmt(setupLine.addRight)}]`);
  }
  if (clipRect) {
    out.push(`\\clip (${caps.fmt(clipRect.xmin)},${caps.fmt(clipRect.ymin)}) rectangle (${caps.fmt(clipRect.xmax)},${caps.fmt(clipRect.ymax)});`);
  }
  if (clipPolygon && clipPolygon.points.length >= 3) {
    const path = clipPolygon.points.map((p) => `(${caps.fmt(p.x)},${caps.fmt(p.y)})`).join(" -- ");
    out.push(`\\clip ${path} -- cycle;`);
  }

  // Emit predefined styles used by tkzDrawPoints[...] commands.
  for (const style of pointStyles) {
    out.push(`\\tikzset{${style.styleName}/.style={${style.styleExpr}}}`);
  }

  ctx.pushSectionHeader("% Points");
  for (const cmd of pointsDefs) {
    caps.assertTkzMacro("tkzDefPoints");
    const items = cmd.items.map((it) => `${caps.fmt(it.x)}/${caps.fmt(it.y)}/${it.name}`).join(", ");
    out.push(`\\tkzDefPoints{${items}}`);
  }
  for (const cmd of pointDefs) {
    caps.assertTkzMacro("tkzDefPoint");
    out.push(`\\tkzDefPoint(${caps.fmt(cmd.x)},${caps.fmt(cmd.y)}){${cmd.name}}`);
  }
}
