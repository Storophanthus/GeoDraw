import type { TikzCommand } from "../tikz";
import { appendRenderedGeometryHelperConstruction } from "./renderConstructionGeometryHelpers";
import { appendRenderedIntersectionConstruction } from "./renderConstructionIntersections";
import { appendRenderedPointConstruction } from "./renderConstructionPoints";
import type { TikzRendererContext } from "./renderContext";

export function appendRenderedConstructions(
  ctx: TikzRendererContext,
  constructions: TikzCommand[]
): void {
  const out = ctx.out;
  ctx.pushSectionHeader("% Constructions");
  for (const cmd of constructions) {
    if (cmd.kind === "ConstructionComment") {
      out.push(`% ${cmd.text}`);
      continue;
    }
    if (appendRenderedPointConstruction(ctx, cmd)) {
      continue;
    }
    if (appendRenderedGeometryHelperConstruction(ctx, cmd)) {
      continue;
    }
    if (appendRenderedIntersectionConstruction(ctx, cmd)) {
      continue;
    }
  }
}
