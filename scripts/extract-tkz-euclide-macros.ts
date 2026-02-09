import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FILE_PATTERNS = [
  /^tkz-euclide\.sty$/,
  /^tkz-.*\.tex$/,
  /^tkz-.*\.sty$/,
];

const DEF_REGEXES: RegExp[] = [
  /\\def\\(tkz[A-Za-z@]+)\b/g,
  /\\(?:newcommand|renewcommand|providecommand)\s*\{\\(tkz[A-Za-z@]+)\}/g,
  /\\(?:NewDocumentCommand|DeclareDocumentCommand)\s*\{\\(tkz[A-Za-z@]+)\}/g,
];

async function main(): Promise<void> {
  const styPath = await resolveTkzEuclideStyPath();
  const baseDir = path.dirname(styPath);

  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => FILE_PATTERNS.some((re) => re.test(name)))
    .sort((a, b) => a.localeCompare(b));

  const macros = new Set<string>();

  for (const fileName of files) {
    const fullPath = path.join(baseDir, fileName);
    const content = await fs.readFile(fullPath, "utf8");
    for (const re of DEF_REGEXES) {
      re.lastIndex = 0;
      for (let match = re.exec(content); match; match = re.exec(content)) {
        macros.add(match[1]);
      }
    }
  }

  const result = {
    generatedFrom: styPath,
    count: macros.size,
    macros: [...macros].sort((a, b) => a.localeCompare(b)),
  };

  const outPath = path.join(process.cwd(), "docs", "tkz-euclide-macros.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Wrote ${result.count} macros to ${outPath}`);
}

async function resolveTkzEuclideStyPath(): Promise<string> {
  const { stdout } = await execFileAsync("kpsewhich", ["tkz-euclide.sty"]);
  const result = stdout.trim();
  if (!result) {
    throw new Error("kpsewhich returned empty result for tkz-euclide.sty");
  }
  return result;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
