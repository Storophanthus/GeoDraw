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
  // tkz-euclide's construction algorithms are not invariant under a large
  // surrounding TikZ `scale`: its dimension arithmetic can visibly move
  // centers and projections. Define constructed points in a reciprocal scope
  // so tkz calculates at unit scale. The resulting named coordinates still
  // line up with points and drawing commands in the outer scaled picture.
  const neutralizePictureScale =
    ctx.options.drawLayerBackend === "tkz" &&
    Math.abs(ctx.options.scale - 1) > 1e-9 &&
    constructions.length > 0;
  if (neutralizePictureScale) {
    out.push(`\\begin{scope}[scale=${ctx.capabilities.fmtGeometry(1 / ctx.options.scale)}]`);
  }
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
  if (neutralizePictureScale) {
    out.push("\\end{scope}");
  }
}
