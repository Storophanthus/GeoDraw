import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const testFiles = [
  "scripts/test-export.ts",
  ...readdirSync("src/export/__tests__")
    .filter((fileName) => fileName.endsWith(".test.ts"))
    .sort()
    .map((fileName) => path.join("src/export/__tests__", fileName)),
  ...readdirSync("src/export/tikz/efficient/__tests__")
    .filter((fileName) => fileName.endsWith(".test.ts"))
    .sort()
    .map((fileName) => path.join("src/export/tikz/efficient/__tests__", fileName)),
];

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, ["--import", "tsx", testFile], {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`All ${testFiles.length} export test files passed.`);
