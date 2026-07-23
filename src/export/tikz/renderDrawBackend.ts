import type { TikzCommand } from "../tikz";
import type { TikzRendererContext } from "./renderContext";

type DrawRawCommand = Extract<TikzCommand, { kind: "DrawRaw" }>;
type DrawSegmentCommand = Extract<TikzCommand, { kind: "DrawSegment" }>;
type DrawLineCommand = Extract<TikzCommand, { kind: "DrawLine" }>;
type DrawCircleCommand = Extract<TikzCommand, { kind: "DrawCircle" }>;
type DrawPointsCommand = Extract<TikzCommand, { kind: "DrawPoints" }>;
type FillCircleCommand = Extract<TikzCommand, { kind: "FillCircle" }>;
type LabelPointCommand = Extract<TikzCommand, { kind: "LabelPoint" }>;
type LabelAtCommand = Extract<TikzCommand, { kind: "LabelAt" }>;
type MarkSegmentCommand = Extract<TikzCommand, { kind: "MarkSegment" }>;

export type DrawLayerBackendEmitter = {
  emitDrawRaw: (cmd: DrawRawCommand) => string[];
  emitDrawSegment: (cmd: DrawSegmentCommand) => string[];
  emitDrawLine: (cmd: DrawLineCommand) => string[];
  emitMarkSegment: (cmd: MarkSegmentCommand) => string[];
  emitDrawCircle: (cmd: DrawCircleCommand) => string[];
  emitFillCircle: (cmd: FillCircleCommand) => string[];
  emitDrawPoints: (cmd: DrawPointsCommand) => string[];
  emitLabelPoint: (cmd: LabelPointCommand) => string[];
  emitLabelAt: (cmd: LabelAtCommand) => string[];
};

function styleOptions(style?: string): string {
  return style ? `[${style}]` : "";
}

function renderLabelText(ctx: TikzRendererContext, text: string, useGlow?: boolean, textMode: "math" | "raw" = "math"): string {
  const escaped = ctx.capabilities.escapeTikzText(text);
  if (textMode === "raw") return useGlow ? `\\gdLabelGlow{${escaped}}` : escaped;
  return useGlow ? `\\gdLabelGlow{$${escaped}$}` : `$${escaped}$`;
}

function splitTopLevelTexLines(content: string): string[] {
  const lines: string[] = [];
  let current = "";
  let braceDepth = 0;
  let inMath = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (char === "\\" && next === "\\" && !inMath && braceDepth === 0) {
      lines.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += char;
    if (char === "$" && (i === 0 || content[i - 1] !== "\\")) {
      inMath = !inMath;
    } else if (!inMath && char === "{") {
      braceDepth += 1;
    } else if (!inMath && char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    }
  }
  lines.push(current);
  return lines;
}

function renderPlainLabelText(
  ctx: TikzRendererContext,
  cmd: Pick<LabelPointCommand | LabelAtCommand, "text" | "useGlow" | "plainGlow"> & {
    textMode?: "math" | "raw";
  }
): string {
  const content = renderLabelText(ctx, cmd.text, false, cmd.textMode);
  if (!cmd.useGlow) return content;
  const lines =
    cmd.textMode === "raw" ? splitTopLevelTexLines(content) : [content];
  if (!cmd.plainGlow) {
    // The legacy glow helper uses contour, whose argument is LR-mode and
    // cannot contain a node-level line break.
    return lines.length > 1 ? content : `\\gdLabelGlow{${content}}`;
  }
  const widthPt = Math.max(0, cmd.plainGlow.widthPt);
  const contourColor = cmd.plainGlow.color;
  const contourLine = (line: string): string => {
    const lineContent = line.trim().length > 0 ? line : "\\mbox{}";
    const contour = contourColor && contourColor.trim()
      ? `\\contour{${contourColor}}{${lineContent}}`
      : `\\ifcsname thepagecolor\\endcsname\\contour{\\thepagecolor}{${lineContent}}\\else\\contour{white}{${lineContent}}\\fi`;
    // TikZ's align implementation ends the current TeX group at each `\\`.
    // Keep the contour setup inside each individual line instead of spanning
    // the node-level line break.
    return `\\begingroup\\ifcsname contour\\endcsname\\contourlength{${ctx.capabilities.fmt(widthPt)}pt}${contour}\\else ${lineContent}\\fi\\endgroup`;
  };
  return lines.map(contourLine).join("\\\\");
}

function createTkzDrawLayerBackendEmitter(ctx: TikzRendererContext): DrawLayerBackendEmitter {
  const caps = ctx.capabilities;
  return {
    emitDrawRaw: (cmd) => [cmd.tex],
    emitDrawSegment: (cmd) => {
      caps.assertTkzMacro("tkzDrawSegment");
      return [`\\tkzDrawSegment${styleOptions(cmd.style)}(${cmd.a},${cmd.b})`];
    },
    emitMarkSegment: (cmd) => {
      caps.assertTkzMacro("tkzMarkSegment");
      return [`\\tkzMarkSegment[${cmd.style}](${cmd.a},${cmd.b})`];
    },
    emitDrawLine: (cmd) => {
      if (cmd.finiteFallback) {
        const { ax, ay, bx, by } = cmd.finiteFallback;
        return [`\\draw${styleOptions(cmd.style)} (${caps.fmt(ax)},${caps.fmt(ay)}) -- (${caps.fmt(bx)},${caps.fmt(by)});`];
      }
      caps.assertTkzMacro("tkzDrawLine");
      return [`\\tkzDrawLine${styleOptions(cmd.style)}(${cmd.a},${cmd.b})`];
    },
    emitDrawCircle: (cmd) => {
      caps.assertTkzMacro("tkzDrawCircle");
      return [`\\tkzDrawCircle${styleOptions(cmd.style)}(${cmd.o},${cmd.x})`];
    },
    emitFillCircle: (cmd) => {
      caps.assertTkzMacro("tkzFillCircle");
      return [`\\tkzFillCircle${styleOptions(cmd.style)}(${cmd.o},${cmd.x})`];
    },
    emitDrawPoints: (cmd) => {
      return [`\\tkzDrawPoints[${cmd.style}](${cmd.points.join(",")})`];
    },
    emitLabelPoint: (cmd) => {
      caps.assertTkzMacro("tkzLabelPoint");
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\tkzLabelPoint${opts}(${cmd.name}){${renderLabelText(ctx, cmd.text, cmd.useGlow)}}`];
    },
    emitLabelAt: (cmd) => {
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\node${opts} at (${caps.fmt(cmd.x)},${caps.fmt(cmd.y)}){${renderLabelText(ctx, cmd.text, cmd.useGlow, cmd.textMode)}};`];
    },
  };
}

function createPlainDrawLayerBackendEmitter(ctx: TikzRendererContext): DrawLayerBackendEmitter {
  const caps = ctx.capabilities;
  return {
    emitDrawRaw: (cmd) => [cmd.tex],
    emitDrawSegment: (cmd) => [`\\draw${styleOptions(cmd.style)} (${cmd.a}) -- (${cmd.b});`],
    emitMarkSegment: (cmd) => {
      const markerOpts = styleOptions(cmd.style);
      return [`\\draw${markerOpts} (${cmd.a}) -- (${cmd.b});`];
    },
    emitDrawLine: (cmd) => {
      if (cmd.finiteFallback) {
        const { ax, ay, bx, by } = cmd.finiteFallback;
        return [
          `% gd plain draw backend: DrawLine exported as finite viewport segment (${cmd.a},${cmd.b})`,
          `\\draw${styleOptions(cmd.style)} (${caps.fmt(ax)},${caps.fmt(ay)}) -- (${caps.fmt(bx)},${caps.fmt(by)});`,
        ];
      }
      return [
        `% gd plain draw backend: DrawLine exported as anchor segment (${cmd.a},${cmd.b})`,
        `\\draw${styleOptions(cmd.style)} (${cmd.a}) -- (${cmd.b});`,
      ];
    },
    emitDrawCircle: (cmd) => [`\\draw${styleOptions(cmd.style)} (${cmd.o}) circle [through=(${cmd.x})];`],
    emitFillCircle: (cmd) => [`\\fill${styleOptions(cmd.style)} (${cmd.o}) circle [through=(${cmd.x})];`],
    emitDrawPoints: (cmd) => {
      if (cmd.points.length === 0) return [];
      const style = cmd.style ? `[${cmd.style}]` : "";
      return cmd.points.map((name) => `\\node${style} at (${name}) {};`);
    },
    emitLabelPoint: (cmd) => {
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\node${opts} at (${cmd.name}){${renderPlainLabelText(ctx, cmd)}};`];
    },
    emitLabelAt: (cmd) => {
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\node${opts} at (${caps.fmt(cmd.x)},${caps.fmt(cmd.y)}){${renderPlainLabelText(ctx, cmd)}};`];
    },
  };
}

export function createDrawLayerBackendEmitter(ctx: TikzRendererContext): DrawLayerBackendEmitter {
  return ctx.options.drawLayerBackend === "plain"
    ? createPlainDrawLayerBackendEmitter(ctx)
    : createTkzDrawLayerBackendEmitter(ctx);
}
