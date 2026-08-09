import type { TikzCommand } from "../tikz";
import { createDrawLayerBackendEmitter } from "./renderDrawBackend";
import type { TikzRendererContext } from "./renderContext";

type MarkAngleCommand = Extract<TikzCommand, { kind: "MarkAngle" }>;
type LabelPointCommand = Extract<TikzCommand, { kind: "LabelPoint" }>;
type LabelAtCommand = Extract<TikzCommand, { kind: "LabelAt" }>;
type AliasableLabelCommand = LabelPointCommand | LabelAtCommand;
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
const LABEL_ALIAS_MIN_USAGE = 2;

type RepeatedLabelAliases = {
  optionAliases: Map<string, string>;
  optionDefinitions: Array<{ name: string; options: string }>;
  glowAliases: Map<string, { name: string; width: string; color: string }>;
};

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

function aliasableLabels(commands: TikzCommand[]): AliasableLabelCommand[] {
  return commands.filter(
    (command): command is AliasableLabelCommand =>
      command.kind === "LabelPoint" || command.kind === "LabelAt"
  );
}

function collectRepeatedLabelAliases(
  ctx: TikzRendererContext,
  commands: AliasableLabelCommand[],
  aliasOptions: { includeGlowAliases: boolean } = { includeGlowAliases: true }
): RepeatedLabelAliases {
  const optionGroups = new Map<
    string,
    {
      count: number;
      commonOptions: string;
      variants: Map<string, string | null>;
    }
  >();
  const glowCounts = new Map<string, { count: number; width: string; color: string }>();

  for (const command of commands) {
    const options = command.options?.trim();
    if (options) {
      const parts = splitTopLevelOptions(options);
      const placementOptions = parts.filter((part) =>
        /^(?:anchor|xshift|yshift|above|below|left|right|above left|above right|below left|below right)\s*=/u.test(part)
      );
      const commonOptions = parts
        .filter((part) => !/^(?:anchor|xshift|yshift|above|below|left|right|above left|above right|below left|below right)\s*=/u.test(part))
        .join(", ");
      // Anchor and shifts are placement choices, not visual styling. Group
      // labels by everything else so each node can keep a small relative
      // placement such as `anchor=west, xshift=.2em, yshift=.3em`.
      // If placement is the only option, keep exact variants separate because an
      // empty shared style would make the output longer rather than shorter.
      const groupKey = commonOptions || `__exact__${options}`;
      const group = optionGroups.get(groupKey) ?? {
        count: 0,
        commonOptions,
        variants: new Map<string, string | null>(),
      };
      group.count += 1;
      group.variants.set(options, placementOptions.join(", ") || null);
      optionGroups.set(groupKey, group);
    }
    if (!aliasOptions.includeGlowAliases || !command.useGlow) continue;
    const widthPt = Math.max(
      0,
      command.plainGlow?.widthPt ??
        0.42 * ctx.options.trueGlobalScale * ctx.options.labelHaloScale
    );
    const width = `${ctx.capabilities.fmt(widthPt)}pt`;
    const color = command.plainGlow?.color?.trim() || "\\thepagecolor";
    const key = `${width}\u0000${color}`;
    const current = glowCounts.get(key);
    glowCounts.set(key, { count: (current?.count ?? 0) + 1, width, color });
  }

  const repeatedOptions = [...optionGroups.values()].filter(
    (group) => group.count >= LABEL_ALIAS_MIN_USAGE
  );
  const optionAliases = new Map<string, string>();
  const optionDefinitions: Array<{ name: string; options: string }> = [];
  repeatedOptions.forEach((group, index) => {
    const name = repeatedOptions.length === 1 ? "gdLabel" : `gdLabel${index + 1}`;
    const placements = new Set(group.variants.values());
    const sharedPlacement = placements.size === 1 ? [...placements][0] : null;
    const definitionOptions = [sharedPlacement, group.commonOptions]
      .filter((part): part is string => Boolean(part))
      .join(", ");
    optionDefinitions.push({ name, options: definitionOptions });
    for (const [fullOptions, placement] of group.variants) {
      optionAliases.set(
        fullOptions,
        [name, placements.size > 1 ? placement : null]
          .filter((part): part is string => Boolean(part))
          .join(", ")
      );
    }
  });

  const repeatedGlows = [...glowCounts].filter(([, value]) => value.count >= LABEL_ALIAS_MIN_USAGE);
  const glowAliases = new Map<string, { name: string; width: string; color: string }>();
  repeatedGlows.forEach(([key, value], index) => {
    glowAliases.set(key, {
      name: repeatedGlows.length === 1 ? "gdLabelText" : `gdLabelText${index + 1}`,
      width: value.width,
      color: value.color,
    });
  });

  return { optionAliases, optionDefinitions, glowAliases };
}

function splitTopLevelOptions(options: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of options) {
    if (char === "{" || char === "[" || char === "(") depth += 1;
    else if (char === "}" || char === "]" || char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function appendRepeatedLabelDefinitions(
  out: string[],
  aliases: RepeatedLabelAliases
): void {
  if (aliases.optionDefinitions.length > 0) {
    out.push("% Shared label styles: edit here to update every matching label.");
    out.push("\\tikzset{");
    aliases.optionDefinitions.forEach(({ options, name }, styleIndex) => {
      out.push(`  ${name}/.style={`);
      const parts = splitTopLevelOptions(options);
      parts.forEach((part, partIndex) => {
        out.push(`    ${part}${partIndex < parts.length - 1 ? "," : ""}`);
      });
      out.push(`  }${styleIndex < aliases.optionDefinitions.length - 1 ? "," : ""}`);
    });
    out.push("}");
  }
  if (aliases.glowAliases.size > 0) {
    out.push("% Shared label halo presets: edit once to update every matching label.");
    for (const { name, width, color } of aliases.glowAliases.values()) {
      out.push(
        `\\newcommand{\\${name}}[1]{\\gdLabelGlow{${width}}{${color}}{#1}}`
      );
    }
  }
}

function withRepeatedLabelAliases<T extends AliasableLabelCommand>(
  ctx: TikzRendererContext,
  command: T,
  aliases: RepeatedLabelAliases
): T {
  const options = command.options?.trim();
  const optionAlias = options ? aliases.optionAliases.get(options) : undefined;
  let plainGlowCommand = command.plainGlowCommand;
  if (command.useGlow) {
    const widthPt = Math.max(
      0,
      command.plainGlow?.widthPt ??
        0.42 * ctx.options.trueGlobalScale * ctx.options.labelHaloScale
    );
    const width = `${ctx.capabilities.fmt(widthPt)}pt`;
    const color = command.plainGlow?.color?.trim() || "\\thepagecolor";
    plainGlowCommand = aliases.glowAliases.get(`${width}\u0000${color}`)?.name;
  }
  if (!optionAlias && plainGlowCommand === command.plainGlowCommand) return command;
  return {
    ...command,
    ...(optionAlias ? { options: optionAlias } : {}),
    ...(plainGlowCommand ? { plainGlowCommand } : {}),
  };
}

function circleRadiusArg(
  ctx: TikzRendererContext,
  cmd: Extract<TikzCommand, { kind: "DrawCircleRadius" | "FillCircleRadius" }>,
  prefix: string
): string {
  if (!cmd.radiusExpr) {
    return ctx.capabilities.fmtGeometry(cmd.radius);
  }
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
      const aliasedStyle = resolveDrawStyleAlias(cmd.style, drawStyleAliases);
      const opts = aliasedStyle ? `[${aliasedStyle}]` : "";
      const radiusArg = circleRadiusArg(ctx, cmd, "DrawCircle");
      if (ctx.options.drawLayerBackend === "plain") {
        out.push(`\\draw${opts} (${cmd.o}) circle [radius=${radiusArg}];`);
      } else {
        caps.assertCircleFixedMacro("tkzDefCircle");
        caps.assertCircleFixedMacro("tkzGetPoint");
        caps.assertCircleFixedMacro("tkzDrawCircle");
        ctx.state.drawCircleRadiusTmpIdx += 1;
        const tmpThrough = `tkzCircleRDraw_${ctx.state.drawCircleRadiusTmpIdx}`;
        out.push(`\\tkzDefCircle[R](${cmd.o},${radiusArg}) \\tkzGetPoint{${tmpThrough}}`);
        out.push(`\\tkzDrawCircle${opts}(${cmd.o},${tmpThrough})`);
      }
    } else if (cmd.kind === "FillCircleRadius") {
      const aliasedStyle = resolveDrawStyleAlias(cmd.style, drawStyleAliases);
      const opts = aliasedStyle ? `[${aliasedStyle}]` : "";
      const radiusArg = circleRadiusArg(ctx, cmd, "FillCircle");
      if (ctx.options.drawLayerBackend === "plain") {
        out.push(`\\fill${opts} (${cmd.o}) circle [radius=${radiusArg}];`);
      } else {
        caps.assertCircleFixedMacro("tkzDefCircle");
        caps.assertCircleFixedMacro("tkzGetPoint");
        caps.assertCircleFixedMacro("tkzFillCircle");
        ctx.state.drawCircleRadiusTmpIdx += 1;
        const tmpThrough = `tkzCircleRFill_${ctx.state.drawCircleRadiusTmpIdx}`;
        out.push(`\\tkzDefCircle[R](${cmd.o},${radiusArg}) \\tkzGetPoint{${tmpThrough}}`);
        out.push(`\\tkzFillCircle${opts}(${cmd.o},${tmpThrough})`);
      }
    } else if (cmd.kind === "FillAngle") {
      if (ctx.options.drawLayerBackend === "plain") {
        throw new Error("Plain draw backend received a non-materialized FillAngle command.");
      }
      caps.assertAngleMacro("tkzFillAngle", "Angle.fill");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkAngle") {
      if (ctx.options.drawLayerBackend === "plain") {
        throw new Error("Plain draw backend received a non-materialized MarkAngle command.");
      }
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
      if (ctx.options.drawLayerBackend === "plain") {
        throw new Error("Plain draw backend received a non-materialized MarkRightAngle command.");
      }
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
  const repeatedLabelCandidates =
    ctx.options.drawLayerBackend === "plain"
      ? [
          ...aliasableLabels(drawPointLabels),
          ...aliasableLabels(drawOtherLabels),
        ]
      : [
          ...drawPointLabels.filter(
            (command): command is LabelPointCommand =>
              command.kind === "LabelPoint" && command.renderAsNode === true
          ),
          ...aliasableLabels(drawOtherLabels),
        ];
  const repeatedLabelAliases = collectRepeatedLabelAliases(
    ctx,
    repeatedLabelCandidates,
    { includeGlowAliases: ctx.options.drawLayerBackend === "plain" }
  );
  appendRepeatedLabelDefinitions(out, repeatedLabelAliases);
  const labelScale = ctx.options.labelScale;
  const shouldScaleLabels = typeof labelScale === "number" && Math.abs(labelScale - 1) > 1e-9;
  if (shouldScaleLabels) {
    out.push(`\\begin{scope}[every node/.style={scale=${caps.fmt(labelScale)}}]`);
  }
  for (const cmd of drawPointLabels) {
    if (cmd.kind === "LabelPoints") {
      if (cmd.points.length === 0) continue;
      if (ctx.options.drawLayerBackend === "plain") {
        for (const point of cmd.points) {
          out.push(`\\node at (${point}){$${caps.escapeTikzText(point)}$};`);
        }
        continue;
      }
      caps.assertTkzMacro("tkzLabelPoints");
      out.push(`\\tkzLabelPoints(${cmd.points.join(",")})`);
      continue;
    }
    if (cmd.kind !== "LabelPoint") continue;
    out.push(...backend.emitLabelPoint(withRepeatedLabelAliases(ctx, cmd, repeatedLabelAliases)));
  }

  for (const cmd of drawAngleLabels) {
    if (cmd.kind !== "LabelAngle") continue;
    if (ctx.options.drawLayerBackend === "plain") {
      throw new Error("Plain draw backend received a non-materialized LabelAngle command.");
    }
    caps.assertAngleMacro("tkzLabelAngle", "Angle.label");
    const opts = cmd.style ? `[${cmd.style}]` : "";
    const text = caps.escapeTikzText(cmd.text);
    out.push(`\\tkzLabelAngle${opts}(${cmd.a},${cmd.b},${cmd.c}){${cmd.useGlow ? `\\gdLabelGlow{$${text}$}` : `$${text}$`}}`);
  }
  for (const cmd of drawOtherLabels) {
    if (cmd.kind !== "LabelAt") continue;
    out.push(...backend.emitLabelAt(withRepeatedLabelAliases(ctx, cmd, repeatedLabelAliases)));
  }
  if (shouldScaleLabels) {
    out.push("\\end{scope}");
  }
}
