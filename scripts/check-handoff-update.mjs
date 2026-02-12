#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function getDiffRange() {
  const cliRange = process.argv[2];
  if (cliRange) return cliRange;

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
      const baseSha = payload?.pull_request?.base?.sha;
      const headSha = payload?.pull_request?.head?.sha;
      if (baseSha && headSha) return `${baseSha}...${headSha}`;
    } catch {
      // Fall through to other strategies.
    }
  }

  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    return `origin/${baseRef}...HEAD`;
  }

  // Local fallback against current working tree.
  return "HEAD";
}

function main() {
  const range = getDiffRange();

  let output = "";
  try {
    output = run(`git diff --name-only ${range}`);
  } catch (err) {
    console.error(`[guardrails] Unable to compute git diff for range: ${range}`);
    console.error(String(err?.message ?? err));
    process.exit(2);
  }

  const files = output
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  const changedCode = files.some((f) => f.startsWith("src/") || f.startsWith("scripts/"));
  const touchedHandoff = files.includes("docs/handoff.md");

  if (changedCode && !touchedHandoff) {
    console.error("[guardrails] src/ or scripts/ changed, but docs/handoff.md was not updated.");
    console.error("[guardrails] Update docs/handoff.md with done/next/risks before merge.");
    console.error(`[guardrails] Diff range: ${range}`);
    process.exit(1);
  }

  console.log(`[guardrails] OK (range: ${range})`);
  if (files.length === 0) {
    console.log("[guardrails] No changed files detected.");
  }
}

main();
