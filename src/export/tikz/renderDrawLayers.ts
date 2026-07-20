import type { TikzCommand } from "../tikz";
import { createDrawLayerBackendEmitter } from "./renderDrawBackend";
import type { TikzRendererContext } from "./renderContext";

type MarkAngleCommand = Extract<TikzCommand, { kind: "MarkAngle" }>;
type StyleAliasableDrawCommand = Extract<
  TikzCommand,
  | { kind: "DrawSegment" }
  | { kind: "DrawLine" }
  | { kind: "DrawCircle" }
  | { kind: "FillCircle" }
  | { kind: "DrawSector" }
  | { kind: "FillSector" }
  | { kind: "DrawCircleRadius" }
  | { kind: "FillCircleRadius" }
>;

const DRAW_STYLE_ALIAS_MIN_USAGE = 3;

type DrawLayerRendererArgs = {
  ctx: TikzRendererContext;
  drawObjects: TikzCommand[];
  drawPoints: TikzCommand[];
  drawPointLabels: TikzCommand[];
  drawAngleLabels: TikzCommand[];
  drawOtherLabels: TikzCommand[];
};

function isStyleAliasableDrawCommand(cmd: TikzCommand): cmd is StyleAliasableDrawCommand {
  return (
    cmd.kind === "DrawSegment" ||
    cmd.kind === "DrawLine" ||
    cmd.kind === "DrawCircle" ||
    cmd.kind === "FillCircle" ||
    cmd.kind === "DrawSector" ||
    cmd.kind === "FillSector" ||
    cmd.kind === "DrawCircleRadius" ||
    cmd.kind === "FillCircleRadius"
  );
}

function collectRepeatedDrawStyleAliases(drawObjects: TikzCommand[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const cmd of drawObjects) {
    if (!isStyleAliasableDrawCommand(cmd)) continue;
    const style = cmd.style?.trim();
    if (!style) continue;
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }

  const aliases = new Map<string, string>();
  for (const cmd of drawObjects) {
    if (!isStyleAliasableDrawCommand(cmd)) continue;
    const style = cmd.style?.trim();
    if (!style || aliases.has(style)) continue;
    if ((counts.get(style) ?? 0) < DRAW_STYLE_ALIAS_MIN_USAGE) continue;
    aliases.set(style, `gdDrawStyle${aliases.size + 1}`);
  }
  return aliases;
}

function resolveDrawStyleAlias(style: string | undefined, aliases: Map<string, string>): string | undefined {
  const trimmed = style?.trim();
  if (!trimmed) return style;
  return aliases.get(trimmed) ?? style;
}

function withDrawStyleAlias<T extends StyleAliasableDrawCommand>(cmd: T, aliases: Map<string, string>): T {
  const style = resolveDrawStyleAlias(cmd.style, aliases);
  if (style === cmd.style) return cmd;
  return { ...cmd, style };
}

function circleRadiusArg(
  ctx: TikzRendererContext,
  cmd: Extract<TikzCommand, { kind: "DrawCircleRadius" | "FillCircleRadius" }>,
  prefix: string
): string {
  if (!cmd.radiusExpr) return ctx.capabilities.fmt(cmd.radius);
  const macro = `gd${prefix}Radius`;
  ctx.out.push(`\\pgfmathsetmacro{\\${macro}}{${cmd.radiusExpr}}`);
  return `\\${macro}`;
}

export function appendRenderedDrawLayers({
  ctx,
  drawObjects,
  drawPoints,
  drawPointLabels,
  drawAngleLabels,
  drawOtherLabels,
}: DrawLayerRendererArgs): void {
  const out = ctx.out;
  const caps = ctx.capabilities;
  const backend = createDrawLayerBackendEmitter(ctx);
  const drawStyleAliases = collectRepeatedDrawStyleAliases(drawObjects);
  ctx.pushSectionHeader("% Draw objects");
  for (const [style, alias] of drawStyleAliases) {
    out.push(`\\tikzset{${alias}/.style={${style}}}`);
  }
  for (let drawIdx = 0; drawIdx < drawObjects.length; drawIdx += 1) {
    const cmd = drawObjects[drawIdx];
    if (cmd.kind === "DrawSegment") {
      out.push(...backend.emitDrawSegment(withDrawStyleAlias(cmd, drawStyleAliases)));
    } else if (cmd.kind === "MarkSegment") {
      out.push(...backend.emitMarkSegment(cmd));
    } else if (cmd.kind === "DrawRaw") {
      out.push(...backend.emitDrawRaw(cmd));
    } else if (cmd.kind === "DrawLine") {
      out.push(...backend.emitDrawLine(withDrawStyleAlias(cmd, drawStyleAliases)));
    } else if (cmd.kind === "FillCircle") {
      out.push(...backend.emitFillCircle(withDrawStyleAlias(cmd, drawStyleAliases)));
    } else if (cmd.kind === "DrawCircle") {
      out.push(...backend.emitDrawCircle(withDrawStyleAlias(cmd, drawStyleAliases)));
    } else if (cmd.kind === "DrawSector") {
      caps.assertTkzMacro("tkzDrawSector");
      const opts = resolveDrawStyleAlias(cmd.style, drawStyleAliases)
        ? `[${resolveDrawStyleAlias(cmd.style, drawStyleAliases)}]`
        : "";
      out.push(`\\tkzDrawSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "FillSector") {
      caps.assertTkzMacro("tkzFillSector");
      const opts = resolveDrawStyleAlias(cmd.style, drawStyleAliases)
        ? `[${resolveDrawStyleAlias(cmd.style, drawStyleAliases)}]`
        : "";
      out.push(`\\tkzFillSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "DrawCircleRadius") {
      caps.assertCircleFixedMacro("tkzDefCircle");
      caps.assertCircleFixedMacro("tkzGetPoint");
      caps.assertCircleFixedMacro("tkzDrawCircle");
      ctx.state.drawCircleRadiusTmpIdx += 1;
      const tmpThrough = `tkzCircleRDraw_${ctx.state.drawCircleRadiusTmpIdx}`;
      out.push(`\\tkzDefCircle[R](${cmd.o},${circleRadiusArg(ctx, cmd, "DrawCircle")}) \\tkzGetPoint{${tmpThrough}}`);
      const aliasedStyle = resolveDrawStyleAlias(cmd.style, drawStyleAliases);
      const opts = aliasedStyle ? `[${aliasedStyle}]` : "";
      out.push(`\\tkzDrawCircle${opts}(${cmd.o},${tmpThrough})`);
    } else if (cmd.kind === "FillCircleRadius") {
      caps.assertCircleFixedMacro("tkzDefCircle");
      caps.assertCircleFixedMacro("tkzGetPoint");
      caps.assertCircleFixedMacro("tkzFillCircle");
      ctx.state.drawCircleRadiusTmpIdx += 1;
      const tmpThrough = `tkzCircleRFill_${ctx.state.drawCircleRadiusTmpIdx}`;
      out.push(`\\tkzDefCircle[R](${cmd.o},${circleRadiusArg(ctx, cmd, "FillCircle")}) \\tkzGetPoint{${tmpThrough}}`);
      const aliasedStyle = resolveDrawStyleAlias(cmd.style, drawStyleAliases);
      const opts = aliasedStyle ? `[${aliasedStyle}]` : "";
      out.push(`\\tkzFillCircle${opts}(${cmd.o},${tmpThrough})`);
    } else if (cmd.kind === "FillAngle") {
      caps.assertAngleMacro("tkzFillAngle", "Angle.fill");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkAngle") {
      const run: MarkAngleCommand[] = [cmd];
      let scan = drawIdx + 1;
      while (scan < drawObjects.length) {
        const next = drawObjects[scan];
        if (next.kind !== "MarkAngle") break;
        if (next.a !== cmd.a || next.b !== cmd.b || next.c !== cmd.c) break;
        run.push(next);
        scan += 1;
      }
      const groupedTex = ctx.options.groupMarkAngles ? caps.buildGroupedMarkAngleTex(run) : null;
      if (groupedTex) {
        caps.assertAngleMacro("tkzMarkAngle", "Angle.mark");
        out.push(groupedTex);
        drawIdx = scan - 1;
        continue;
      }
      caps.assertAngleMacro("tkzMarkAngle", "Angle.mark");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkRightAngle") {
      caps.assertAngleMacro("tkzMarkRightAngles", "Angle.markRight");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkRightAngles${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    }
  }

  ctx.pushSectionHeader("% Draw points");
  for (const cmd of drawPoints) {
    if (cmd.kind !== "DrawPoints") continue;
    if (cmd.points.length === 0) continue;
    out.push(...backend.emitDrawPoints(cmd));
  }

  ctx.pushSectionHeader("% Labels");
  const labelScale = ctx.options.labelScale;
  const shouldScaleLabels = typeof labelScale === "number" && Math.abs(labelScale - 1) > 1e-9;
  if (shouldScaleLabels) {
    out.push(`\\begin{scope}[every node/.style={scale=${caps.fmt(labelScale)}}]`);
  }
  for (const cmd of drawPointLabels) {
    if (cmd.kind === "LabelPoints") {
      if (cmd.points.length === 0) continue;
      caps.assertTkzMacro("tkzLabelPoints");
      out.push(`\\tkzLabelPoints(${cmd.points.join(",")})`);
      continue;
    }
    if (cmd.kind !== "LabelPoint") continue;
    out.push(...backend.emitLabelPoint(cmd));
  }

  for (const cmd of drawAngleLabels) {
    if (cmd.kind !== "LabelAngle") continue;
    caps.assertAngleMacro("tkzLabelAngle", "Angle.label");
    const opts = cmd.style ? `[${cmd.style}]` : "";
    const text = caps.escapeTikzText(cmd.text);
    out.push(`\\tkzLabelAngle${opts}(${cmd.a},${cmd.b},${cmd.c}){${cmd.useGlow ? `\\gdLabelGlow{$${text}$}` : `$${text}$`}}`);
  }
  for (const cmd of drawOtherLabels) {
    if (cmd.kind !== "LabelAt") continue;
    out.push(...backend.emitLabelAt(cmd));
  }
  if (shouldScaleLabels) {
    out.push("\\end{scope}");
  }
}
