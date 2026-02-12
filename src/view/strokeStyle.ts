export function applyStrokeDash(
  ctx: CanvasRenderingContext2D,
  dash: "solid" | "dashed" | "dotted",
  strokeWidth: number
): void {
  if (dash === "dashed") {
    ctx.setLineDash([8, 6]);
    ctx.lineCap = "butt";
    return;
  }
  if (dash === "dotted") {
    // Near-zero dash length + round caps yields circular dots instead of mini dashes.
    const dot = 0.001;
    const gap = Math.max(4, strokeWidth * 2.4);
    ctx.setLineDash([dot, gap]);
    ctx.lineCap = "round";
    return;
  }
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
}
