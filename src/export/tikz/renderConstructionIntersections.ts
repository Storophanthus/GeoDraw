import type { TikzCommand } from "../tikz";
import type { TikzRendererContext } from "./renderContext";

export function appendRenderedIntersectionConstruction(
  ctx: TikzRendererContext,
  cmd: TikzCommand
): boolean {
  const out = ctx.out;
  const caps = ctx.capabilities;

  if (cmd.kind === "InterLC") {
    ctx.state.interLCTmpIdx += 1;
    const otherName = `tkzInterLC_${ctx.state.interLCTmpIdx}_other`;

    if (cmd.common) {
      // Never assign an intersection result back into an existing point. At
      // sufficiently large picture scales tkz-euclide's `common=` tolerance
      // can change sides at a tiny numeric threshold, which used to overwrite
      // the original point and swap both identities. Put the known common
      // point first on the support line and use `near`: the first result is the
      // disposable common root and the second is the requested other root.
      const lineDirectionPoint = cmd.lineA === cmd.common ? cmd.lineB : cmd.lineA;
      caps.assertTkzMacro("tkzInterLC");
      caps.assertTkzMacro("tkzGetPoints");
      out.push(
        `\\tkzInterLC[near](${cmd.common},${lineDirectionPoint})(${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${otherName}}{${cmd.name}}`
      );
      return true;
    }

    const p1 = cmd.swap ? otherName : cmd.name;
    const p2 = cmd.swap ? cmd.name : otherName;
    caps.assertTkzMacro("tkzInterLC");
    caps.assertTkzMacro("tkzGetPoints");
    out.push(`\\tkzInterLC[near](${cmd.lineA},${cmd.lineB})(${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${p1}}{${p2}}`);
    return true;
  }

  if (cmd.kind === "InterCC") {
    ctx.state.interLCTmpIdx += 1;
    const otherName = `tkzInterCC_${ctx.state.interLCTmpIdx}_other`;

    let opt = "";
    let p1;
    let p2;
    if (cmd.common) {
      opt = `[common=${cmd.common}]`;
      // `common=` promises the shared point in the second result slot, but do
      // not alias that slot back onto the already-defined point. This keeps
      // the original identity immutable even if tkz's tolerance misclassifies
      // a near-tangent case.
      p1 = cmd.name;
      p2 = otherName;
    } else {
      p1 = cmd.swap ? otherName : cmd.name;
      p2 = cmd.swap ? cmd.name : otherName;
    }

    caps.assertTkzMacro("tkzInterCC");
    caps.assertTkzMacro("tkzGetPoints");
    out.push(`\\tkzInterCC${opt}(${cmd.circleAO},${cmd.circleAX})(${cmd.circleBO},${cmd.circleBX}) \\tkzGetPoints{${p1}}{${p2}}`);
    return true;
  }

  return false;
}
