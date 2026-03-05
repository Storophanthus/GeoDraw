import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TOOL_REGISTRY } from "../src/ui/ToolPalette";

const outDir = join(process.cwd(), "docs", "screenshots", "tools");
mkdirSync(outDir, { recursive: true });

for (const [name, def] of Object.entries(TOOL_REGISTRY)) {
  const Comp = def.icon;
  const raw = renderToStaticMarkup(<Comp size={64} strokeWidth={2} />);
  const colored = raw.replaceAll("currentColor", "#3b3025");
  writeFileSync(join(outDir, `${name}.svg`), colored, "utf8");
}

console.log(`Generated ${Object.keys(TOOL_REGISTRY).length} SVG icons in ${outDir}`);
