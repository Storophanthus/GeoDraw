type PatternKind = string | undefined;

function createPatternTile(
  ctx: CanvasRenderingContext2D,
  pattern: string,
  strokeColor: string
): CanvasPattern | null {
  const tile = document.createElement("canvas");
  tile.width = 8;
  tile.height = 8;
  const pctx = tile.getContext("2d");
  if (!pctx) return null;

  pctx.clearRect(0, 0, tile.width, tile.height);
  pctx.strokeStyle = strokeColor;
  pctx.fillStyle = strokeColor;
  pctx.lineWidth = 0.9;

  if (pattern === "north east lines") {
    pctx.beginPath();
    // Opposite diagonal family from north-west lines.
    pctx.moveTo(-2, 10);
    pctx.lineTo(10, -2);
    pctx.stroke();
  } else if (pattern === "north west lines") {
    pctx.beginPath();
    pctx.moveTo(-2, -2);
    pctx.lineTo(8, 8);
    pctx.stroke();
  } else if (pattern === "grid") {
    pctx.beginPath();
    pctx.moveTo(0, 0.5);
    pctx.lineTo(12, 0.5);
    pctx.moveTo(0, 6.5);
    pctx.lineTo(12, 6.5);
    pctx.moveTo(0.5, 0);
    pctx.lineTo(0.5, 12);
    pctx.moveTo(6.5, 0);
    pctx.lineTo(6.5, 12);
    pctx.stroke();
  } else if (pattern === "crosshatch") {
    pctx.beginPath();
    pctx.moveTo(-2, 12);
    pctx.lineTo(12, -2);
    pctx.moveTo(-2, -2);
    pctx.lineTo(12, 12);
    pctx.stroke();
  } else if (pattern === "dots") {
    pctx.beginPath();
    pctx.arc(4, 4, 0.9, 0, Math.PI * 2);
    pctx.fill();
  } else {
    return null;
  }

  return ctx.createPattern(tile, "repeat");
}

export function resolveCanvasFillStyle(
  ctx: CanvasRenderingContext2D,
  fillColor: string,
  pattern: PatternKind,
  patternColor: string | undefined
): string | CanvasPattern {
  const patternName = (pattern ?? "").trim();
  if (!patternName) return fillColor;
  const pat = createPatternTile(ctx, patternName, patternColor ?? fillColor);
  return pat ?? fillColor;
}
