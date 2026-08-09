import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export async function compileTikzSnippet(name, tikzCode) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "geodraw-tikz-"));
  const texPath = path.join(tmpDir, `${name}.tex`);
  const logPath = path.join(tmpDir, `${name}.log`);
  const isFullDocument = /\\documentclass\b/u.test(tikzCode) || /\\begin\{document\}/u.test(tikzCode);
  const hasExplicitCanvasBounds = /\\path\s*\[[^\]]*\buse as bounding box\b[^\]]*\]/u.test(tikzCode);
  const usesTkzEuclide = /\\tkz[A-Za-z@]+/u.test(tikzCode);
  const usesScalebox = tikzCode.includes("\\scalebox");
  const border = hasExplicitCanvasBounds ? "0pt" : "2pt";

  const tex = isFullDocument
    ? tikzCode
    : [
        "\\PassOptionsToPackage{dvipsnames}{xcolor}",
        usesScalebox
          ? `\\documentclass[border=${border}]{standalone}`
          : `\\documentclass[tikz,border=${border}]{standalone}`,
        ...(usesScalebox ? ["\\usepackage{tikz}"] : []),
        ...(usesTkzEuclide ? ["\\usepackage{tkz-euclide}"] : []),
        ...(usesScalebox ? ["\\usepackage{graphicx}"] : []),
        "\\usepackage{xfp}",
        "\\usepackage{contour}",
        "\\begin{document}",
        tikzCode,
        "\\end{document}",
        "",
      ].join("\n");

  await writeFile(texPath, tex, "utf8");

  const latexmk = spawnSync("latexmk", ["-pdf", "-interaction=nonstopmode", "-halt-on-error", `${name}.tex`], {
    cwd: tmpDir,
    encoding: "utf8",
  });

  let ok = latexmk.status === 0;
  let command = "latexmk";
  let stdout = latexmk.stdout ?? "";
  let stderr = latexmk.stderr ?? "";

  if (latexmk.error && latexmk.error.code === "ENOENT") {
    command = "pdflatex";
    const pass1 = spawnSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", `${name}.tex`], {
      cwd: tmpDir,
      encoding: "utf8",
    });
    const pass2 = pass1.status === 0
      ? spawnSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", `${name}.tex`], {
          cwd: tmpDir,
          encoding: "utf8",
        })
      : pass1;

    ok = pass1.status === 0 && pass2.status === 0;
    stdout = `${pass1.stdout ?? ""}\n${pass2.stdout ?? ""}`;
    stderr = `${pass1.stderr ?? ""}\n${pass2.stderr ?? ""}`;
  }

  if (ok) {
    await rm(tmpDir, { recursive: true, force: true });
    return;
  }

  let tail = "";
  try {
    const log = await readFile(logPath, "utf8");
    const lines = log.split(/\r?\n/);
    tail = lines.slice(Math.max(0, lines.length - 60)).join("\n");
  } catch {
    tail = `${stdout}\n${stderr}`.trim();
  }

  throw new Error([
    `TeX compilation failed for fixture '${name}' using ${command}.`,
    `Working dir: ${tmpDir}`,
    "----- log tail -----",
    tail || "(no log output)",
  ].join("\n"));
}
