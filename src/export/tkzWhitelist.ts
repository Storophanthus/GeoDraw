const EMITTED_TKZ_MACROS = new Set<string>([
  "tkzDefPoints",
  "tkzDefPoint",
  "tkzInit",
  "tkzClip",
  "tkzSetUpLine",
  "tkzDefMidPoint",
  "tkzGetPoint",
  "tkzDefPointBy",
  "tkzDefLine",
  "tkzDefExtSimilitudeCenter",
  "tkzDefIntSimilitudeCenter",
  "tkzDefCircle",
  "tkzDefTriangleCenter",
  "tkzDefPointOnCircle",
  "tkzInterLL",
  "tkzInterLC",
  "tkzInterCC",
  "tkzGetPoints",
  "tkzDrawSegment",
  "tkzMarkSegment",
  "tkzDrawLine",
  "tkzDrawCircle",
  "tkzFillCircle",
  "tkzDrawSector",
  "tkzFillSector",
  "tkzFillAngle",
  "tkzMarkAngle",
  "tkzMarkRightAngles",
  "tkzLabelAngle",
  "tkzDrawPoints",
  "tkzLabelPoints",
  "tkzLabelPoint",
]);

export function assertNoUnknownTkzMacro(tex: string): void {
  const re = /\\(tkz[A-Za-z]+)/g;
  const unknown = new Set<string>();

  for (let match = re.exec(tex); match; match = re.exec(tex)) {
    const macro = match[1];
    if (!EMITTED_TKZ_MACROS.has(macro)) {
      unknown.add(macro);
    }
  }

  if (unknown.size === 0) return;
  const first = [...unknown].sort((a, b) => a.localeCompare(b))[0];
  throw new Error(`Unsupported tkz-euclide macro emitted: \\${first}. Run npm run update:tkz-macros or fix exporter.`);
}

export function getEmittedTkzMacros(): string[] {
  return [...EMITTED_TKZ_MACROS].sort((a, b) => a.localeCompare(b));
}
