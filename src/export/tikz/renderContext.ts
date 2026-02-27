import type { TikzRendererCapabilities } from "./renderCapabilities";

export type DrawLayerBackendKind = "tkz" | "plain";

export type TikzRendererOptions = {
  scale: number;
  hasGlowLabels: boolean;
  emitTkzSetup: boolean;
  labelScale: number | null;
  groupMarkAngles: boolean;
  drawLayerBackend: DrawLayerBackendKind;
};

export type TikzRendererState = {
  interLCTmpIdx: number;
  drawCircleRadiusTmpIdx: number;
};

export type TikzRendererContext = {
  out: string[];
  options: TikzRendererOptions;
  state: TikzRendererState;
  capabilities: TikzRendererCapabilities;
  pushSectionHeader: (title: string) => void;
};

export function createTikzRendererContext(
  out: string[],
  pushSectionHeader: (title: string) => void,
  options: TikzRendererOptions,
  capabilities: TikzRendererCapabilities
): TikzRendererContext {
  return {
    out,
    pushSectionHeader,
    options,
    capabilities,
    state: {
      interLCTmpIdx: 0,
      drawCircleRadiusTmpIdx: 0,
    },
  };
}
