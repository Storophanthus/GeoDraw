import type { TikzCommand } from "../tikz";

type MarkAngleCommand = Extract<TikzCommand, { kind: "MarkAngle" }>;

export type TikzRendererCapabilities = {
  fmt: (value: number) => string;
  /**
   * Format inputs that participate in reconstructible geometry. These values
   * must remain precise even when presentation numbers are shortened.
   */
  fmtGeometry: (value: number) => string;
  escapeTikzText: (value: string) => string;
  buildGroupedMarkAngleTex: (run: MarkAngleCommand[]) => string | null;
  assertTkzMacro: (name: string) => void;
  assertPerpendicularMacro: (name: string) => void;
  assertParallelMacro: (name: string) => void;
  assertAngleBisectorMacro: (name: string) => void;
  assertAngleFixedMacro: (name: string) => void;
  assertCircleFixedMacro: (name: string) => void;
  assertAngleMacro: (name: string, context: string) => void;
};
