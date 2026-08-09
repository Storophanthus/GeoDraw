import {
  buildRequiredPreamble,
  buildStandaloneSource,
  deriveDefaultOptionalPreamble,
  looksLikeFullDocument,
} from "../tikz/standaloneDocument";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const visualExactPicture = String.raw`\begin{tikzpicture}[>=triangle 45]
\path[use as bounding box] (-2,-2) rectangle (2,2);
\coordinate (A) at (0,0);
\coordinate (B) at (1,0);
\draw (A) circle [through=(B)];
\end{tikzpicture}`;

const visualExactPreamble = buildRequiredPreamble(visualExactPicture);
assert(
  visualExactPreamble.includes(
    String.raw`\usetikzlibrary{arrows,arrows.meta,bending,calc,decorations.markings,patterns,patterns.meta,positioning,shapes.geometric,shapes.misc,through}`
  ),
  "Standalone Visual Exact preamble must include every TikZ library that can be requested by the exporter."
);
assert(
  visualExactPreamble.includes(String.raw`\documentclass[tikz,border=0pt]{standalone}`),
  "Explicit Visual Exact canvas bounds must use a zero standalone border."
);
assert(
  !visualExactPreamble.includes(String.raw`\usepackage{tkz-euclide}`),
  "Pure-TikZ Visual Exact standalone files must not require tkz-euclide."
);

const reconstructiblePicture = String.raw`\begin{tikzpicture}
\tkzDefPoint(0,0){A}
\end{tikzpicture}`;
const reconstructibleDocument = buildStandaloneSource(reconstructiblePicture, "");
assert(
  reconstructibleDocument.includes(String.raw`\usepackage{tkz-euclide}`),
  "Reconstructible standalone files must retain tkz-euclide when their body uses tkz macros."
);

const scaledDocument = buildStandaloneSource(
  String.raw`\scalebox{1.5}{\begin{tikzpicture}\end{tikzpicture}}`,
  ""
);
assert(
  scaledDocument.includes(String.raw`\usepackage{graphicx}`),
  "Standalone scalebox exports must include graphicx."
);
assert(
  scaledDocument.includes(String.raw`\documentclass[border=2pt]{standalone}`)
    && scaledDocument.includes(String.raw`\usepackage{tikz}`),
  "Scalebox full files must use generic standalone capture because its tikz environment hook cannot be nested inside a box."
);

const fullDocument = String.raw`\documentclass{article}
\begin{document}
Already complete.
\end{document}`;
assert(looksLikeFullDocument(fullDocument), "Full LaTeX documents must be recognized.");
assert(
  buildStandaloneSource(fullDocument, String.raw`\usepackage{pagecolor}`) === fullDocument,
  "An existing full LaTeX document must pass through unchanged."
);

const diagonalLabelPicture = String.raw`\begin{tikzpicture}
\coordinate (A) at (0,0);
\node[above left={1.16em and 0.74em}] at (A) {$A$};
\node[above right={0.44em and 0.44em}] at (A) {$B$};
\node[below left={1.09em and 0.81em}] at (A) {$C$};
\node[below right={0.6em and 0.5em}] at (A) {$D$};
\end{tikzpicture}`;
const diagonalLabelDocument = buildStandaloneSource(diagonalLabelPicture, "");
assert(
  diagonalLabelDocument.includes("positioning"),
  "The PDF-preview standalone wrapper must load positioning for two-axis semantic label offsets."
);
await compileTikzSnippet("standalone-diagonal-label-positioning", diagonalLabelDocument);

const namedPagePreamble = deriveDefaultOptionalPreamble(
  visualExactPicture,
  { "--gd-scene-bg": "#f5f1e6" },
  { preferDvipsNames: true }
);
assert(
  namedPagePreamble.includes(String.raw`\pagecolor{`) &&
    !namedPagePreamble.includes(String.raw`\definecolor`),
  "dvipsnames-only full files must use a named page color without defining gdPageColor."
);

console.log("✓ standalone document preamble test passed");
