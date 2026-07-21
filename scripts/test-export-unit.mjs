// Runs every unit test in src/export/__tests__.
//
// These files used to be referenced by nothing, so they never ran in any script
// or workflow. Two regressions shipped through that gap at once: viewport
// clipping silently stopped working in the plain backend, and a library
// assertion went stale -- both of which these tests would have caught.
//
// Discovery is by directory scan on purpose. Listing files by hand is what
// allowed the gap in the first place, and a newly added test would have been
// orphaned again the moment someone forgot to register it.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const TEST_DIR = path.join("src", "export", "__tests__");

const files = readdirSync(TEST_DIR)
  .filter((name) => name.endsWith(".test.ts"))
  .sort();

if (files.length === 0) {
  console.error(`No test files found in ${TEST_DIR}`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const target = path.join(TEST_DIR, file);
  const result = spawnSync(process.execPath, ["--import", "tsx", target], { stdio: "inherit" });
  if (result.error) {
    console.error(`\n${file}: ${result.error.message}`);
    failed += 1;
    continue;
  }
  if ((result.status ?? 1) !== 0) {
    console.error(`\n✗ ${file} failed`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${files.length} export unit test file(s) failed.`);
  process.exit(1);
}

console.log(`\n✓ all ${files.length} export unit test files passed`);
