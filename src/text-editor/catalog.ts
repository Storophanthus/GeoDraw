export type TextEditorCompletionItem = {
  id: string;
  trigger: string;
  label: string;
  detail: string;
  snippet: string;
  keywords?: string[];
};

export const DEFAULT_TEXT_EDITOR_COMPLETIONS: TextEditorCompletionItem[] = [
  { id: "frac", trigger: "\\frac", label: "\\frac", detail: "Fraction", snippet: "\\frac{${1}}{${2}}", keywords: ["fraction", "divide"] },
  { id: "dfrac", trigger: "\\dfrac", label: "\\dfrac", detail: "Display fraction", snippet: "\\dfrac{${1}}{${2}}", keywords: ["fraction"] },
  { id: "tfrac", trigger: "\\tfrac", label: "\\tfrac", detail: "Text fraction", snippet: "\\tfrac{${1}}{${2}}", keywords: ["fraction"] },
  { id: "sqrt", trigger: "\\sqrt", label: "\\sqrt", detail: "Square root", snippet: "\\sqrt{${1}}", keywords: ["root", "radical"] },
  { id: "binom", trigger: "\\binom", label: "\\binom", detail: "Binomial coefficient", snippet: "\\binom{${1}}{${2}}", keywords: ["choose", "combination"] },
  { id: "text", trigger: "\\text", label: "\\text", detail: "Text in math", snippet: "\\text{${1}}", keywords: ["words", "plain"] },
  { id: "left-right", trigger: "\\left", label: "\\left...\\right", detail: "Scalable delimiters", snippet: "\\left(${1}\\right)", keywords: ["delimiters", "parentheses"] },
  { id: "alpha", trigger: "\\alpha", label: "\\alpha", detail: "Greek alpha", snippet: "\\alpha" },
  { id: "beta", trigger: "\\beta", label: "\\beta", detail: "Greek beta", snippet: "\\beta" },
  { id: "gamma", trigger: "\\gamma", label: "\\gamma", detail: "Greek gamma", snippet: "\\gamma" },
  { id: "theta", trigger: "\\theta", label: "\\theta", detail: "Greek theta", snippet: "\\theta" },
  { id: "pi", trigger: "\\pi", label: "\\pi", detail: "Pi", snippet: "\\pi" },
  { id: "infty", trigger: "\\infty", label: "\\infty", detail: "Infinity", snippet: "\\infty" },
  { id: "partial", trigger: "\\partial", label: "\\partial", detail: "Partial derivative", snippet: "\\partial" },
  { id: "nabla", trigger: "\\nabla", label: "\\nabla", detail: "Nabla", snippet: "\\nabla" },
  { id: "leq", trigger: "\\leq", label: "\\leq", detail: "Less than or equal", snippet: "\\leq" },
  { id: "geq", trigger: "\\geq", label: "\\geq", detail: "Greater than or equal", snippet: "\\geq" },
  { id: "neq", trigger: "\\neq", label: "\\neq", detail: "Not equal", snippet: "\\neq" },
  { id: "approx", trigger: "\\approx", label: "\\approx", detail: "Approximately equal", snippet: "\\approx" },
  { id: "cong", trigger: "\\cong", label: "\\cong", detail: "Congruent", snippet: "\\cong" },
  { id: "mathbb-r", trigger: "\\mathbb{R}", label: "\\mathbb{R}", detail: "Real numbers", snippet: "\\mathbb{R}", keywords: ["reals"] },
  { id: "mathbb-z", trigger: "\\mathbb{Z}", label: "\\mathbb{Z}", detail: "Integers", snippet: "\\mathbb{Z}", keywords: ["integers"] },
  { id: "mathbb-n", trigger: "\\mathbb{N}", label: "\\mathbb{N}", detail: "Natural numbers", snippet: "\\mathbb{N}", keywords: ["naturals"] },
  { id: "sin", trigger: "\\sin", label: "\\sin", detail: "Sine", snippet: "\\sin" },
  { id: "cos", trigger: "\\cos", label: "\\cos", detail: "Cosine", snippet: "\\cos" },
  { id: "tan", trigger: "\\tan", label: "\\tan", detail: "Tangent", snippet: "\\tan" },
  { id: "log", trigger: "\\log", label: "\\log", detail: "Logarithm", snippet: "\\log" },
  { id: "ln", trigger: "\\ln", label: "\\ln", detail: "Natural logarithm", snippet: "\\ln" },
  { id: "hat", trigger: "\\hat", label: "\\hat", detail: "Hat accent", snippet: "\\hat{${1}}" },
  { id: "vec", trigger: "\\vec", label: "\\vec", detail: "Vector accent", snippet: "\\vec{${1}}" },
  { id: "overline", trigger: "\\overline", label: "\\overline", detail: "Overline", snippet: "\\overline{${1}}" },
  { id: "cases", trigger: "\\begin{cases}", label: "cases", detail: "Cases environment", snippet: "\\begin{cases}\n${1}\n\\end{cases}", keywords: ["piecewise"] },
  { id: "aligned", trigger: "\\begin{aligned}", label: "aligned", detail: "Aligned equations", snippet: "\\begin{aligned}\n${1}\n\\end{aligned}", keywords: ["align"] },
  { id: "pmatrix", trigger: "\\begin{pmatrix}", label: "pmatrix", detail: "Parenthesized matrix", snippet: "\\begin{pmatrix}\n${1}\n\\end{pmatrix}", keywords: ["matrix"] },
  { id: "bmatrix", trigger: "\\begin{bmatrix}", label: "bmatrix", detail: "Bracket matrix", snippet: "\\begin{bmatrix}\n${1}\n\\end{bmatrix}", keywords: ["matrix"] },
];
