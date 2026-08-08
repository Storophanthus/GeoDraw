import {
  buildRequiredPreamble,
  buildStandaloneSource,
  looksLikeFullDocument,
} from "../tikz/standaloneDocument";

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
    String.raw`\usetikzlibrary{arrows,arrows.meta,bending,calc,decorations.markings,patterns,patterns.meta,shapes.geometric,shapes.misc,through}`
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

const fullDocument = String.raw`\documentclass{article}
\begin{document}
Already complete.
\end{document}`;
assert(looksLikeFullDocument(fullDocument), "Full LaTeX documents must be recognized.");
assert(
  buildStandaloneSource(fullDocument, String.raw`\usepackage{pagecolor}`) === fullDocument,
  "An existing full LaTeX document must pass through unchanged."
);

console.log("✓ standalone document preamble test passed");
