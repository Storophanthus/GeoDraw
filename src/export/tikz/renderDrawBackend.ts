import type { TikzCommand } from "../tikz";
import type { TikzRendererContext } from "./renderContext";

type DrawRawCommand = Extract<TikzCommand, { kind: "DrawRaw" }>;
type DrawSegmentCommand = Extract<TikzCommand, { kind: "DrawSegment" }>;
type DrawLineCommand = Extract<TikzCommand, { kind: "DrawLine" }>;
type DrawCircleCommand = Extract<TikzCommand, { kind: "DrawCircle" }>;
type FillCircleCommand = Extract<TikzCommand, { kind: "FillCircle" }>;
type LabelPointCommand = Extract<TikzCommand, { kind: "LabelPoint" }>;
type LabelAtCommand = Extract<TikzCommand, { kind: "LabelAt" }>;

export type DrawLayerBackendEmitter = {
  emitDrawRaw: (cmd: DrawRawCommand) => string[];
  emitDrawSegment: (cmd: DrawSegmentCommand) => string[];
  emitDrawLine: (cmd: DrawLineCommand) => string[];
  emitDrawCircle: (cmd: DrawCircleCommand) => string[];
  emitFillCircle: (cmd: FillCircleCommand) => string[];
  emitLabelPoint: (cmd: LabelPointCommand) => string[];
  emitLabelAt: (cmd: LabelAtCommand) => string[];
};

function styleOptions(style?: string): string {
  return style ? `[${style}]` : "";
}

function renderLabelText(ctx: TikzRendererContext, text: string, useGlow?: boolean): string {
  const escaped = ctx.capabilities.escapeTikzText(text);
  return useGlow ? `\\gdLabelGlow{$${escaped}$}` : `$${escaped}$`;
}

function createTkzDrawLayerBackendEmitter(ctx: TikzRendererContext): DrawLayerBackendEmitter {
  const caps = ctx.capabilities;
  return {
    emitDrawRaw: (cmd) => [cmd.tex],
    emitDrawSegment: (cmd) => {
      caps.assertTkzMacro("tkzDrawSegment");
      return [`\\tkzDrawSegment${styleOptions(cmd.style)}(${cmd.a},${cmd.b})`];
    },
    emitDrawLine: (cmd) => {
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
    emitLabelPoint: (cmd) => {
      caps.assertTkzMacro("tkzLabelPoint");
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\tkzLabelPoint${opts}(${cmd.name}){${renderLabelText(ctx, cmd.text, cmd.useGlow)}}`];
    },
    emitLabelAt: (cmd) => {
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\node${opts} at (${caps.fmt(cmd.x)},${caps.fmt(cmd.y)}){${renderLabelText(ctx, cmd.text, cmd.useGlow)}};`];
    },
  };
}

function createPlainDrawLayerBackendEmitter(ctx: TikzRendererContext): DrawLayerBackendEmitter {
  const caps = ctx.capabilities;
  return {
    emitDrawRaw: (cmd) => [cmd.tex],
    emitDrawSegment: (cmd) => [`\\draw${styleOptions(cmd.style)} (${cmd.a}) -- (${cmd.b});`],
    emitDrawLine: (cmd) => [
      `% gd plain draw backend: DrawLine exported as anchor segment (${cmd.a},${cmd.b})`,
      `\\draw${styleOptions(cmd.style)} (${cmd.a}) -- (${cmd.b});`,
    ],
    emitDrawCircle: (cmd) => [`\\draw${styleOptions(cmd.style)} (${cmd.o}) circle [through=(${cmd.x})];`],
    emitFillCircle: (cmd) => [`\\fill${styleOptions(cmd.style)} (${cmd.o}) circle [through=(${cmd.x})];`],
    emitLabelPoint: (cmd) => {
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\node${opts} at (${cmd.name}){${renderLabelText(ctx, cmd.text, cmd.useGlow)}};`];
    },
    emitLabelAt: (cmd) => {
      const opts = cmd.options ? `[${cmd.options}]` : "";
      return [`\\node${opts} at (${caps.fmt(cmd.x)},${caps.fmt(cmd.y)}){${renderLabelText(ctx, cmd.text, cmd.useGlow)}};`];
    },
  };
}

export function createDrawLayerBackendEmitter(ctx: TikzRendererContext): DrawLayerBackendEmitter {
  return ctx.options.drawLayerBackend === "plain"
    ? createPlainDrawLayerBackendEmitter(ctx)
    : createTkzDrawLayerBackendEmitter(ctx);
}
