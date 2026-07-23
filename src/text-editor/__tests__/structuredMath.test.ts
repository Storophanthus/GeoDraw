import {
  parseStructuredMathContent,
  parseStructuredMathDocument,
  serializeStructuredMathContent,
  serializeStructuredMathDocument,
} from "../structuredMath";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fraction = parseStructuredMathDocument("$\\frac{}{b}$");
assert(fraction?.kind === "fraction", "fraction document should be recognized.");
assert(fraction.numerator === "", "fraction numerator should preserve an empty slot.");
assert(fraction.denominator === "b", "fraction denominator should preserve text.");

const sqrt = parseStructuredMathDocument("\\[\\sqrt{x+1}\\]");
assert(sqrt?.kind === "sqrt", "sqrt document should be recognized.");
assert(sqrt.body === "x+1", "sqrt body should be preserved.");

const openFraction = parseStructuredMathDocument("$\\frac{}{b}");
assert(openFraction?.kind === "fraction", "open inline fraction should be recognized while editing.");
assert(openFraction.denominator === "b", "open inline fraction should preserve the denominator slot.");

const script = parseStructuredMathContent("a_{n-1}^{2}");
assert(script?.kind === "script", "subscript/superscript should be recognized.");
assert(script.base === "a", "script base should be preserved.");
assert(script.subscript === "n-1", "script subscript should be preserved.");
assert(script.superscript === "2", "script superscript should be preserved.");

const sqrtIndex = parseStructuredMathContent("\\sqrt[3]{x}");
assert(sqrtIndex?.kind === "sqrt", "indexed root should be recognized.");
assert(sqrtIndex.index === "3", "root index should be preserved.");

const matrix = parseStructuredMathContent("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}");
assert(matrix?.kind === "matrix", "matrix environment should be recognized.");
assert(matrix.rows.length === 2 && matrix.rows[1]?.[1] === "d", "matrix cells should round-trip.");

const cases = parseStructuredMathContent("\\begin{cases} x^2 & x>0 \\\\ 0 & x=0 \\end{cases}");
assert(cases?.kind === "cases", "cases environment should be recognized.");
assert(cases.rows[0]?.condition === "x>0", "cases condition should be preserved.");

const serialized = serializeStructuredMathDocument({
  delimiter: "inline",
  kind: "binom",
  top: "n",
  bottom: "k",
});
assert(serialized === "$\\binom{n}{k}$", "binom serialization should round-trip to standalone math text.");

const serializedScript = serializeStructuredMathContent({
  delimiter: "inline",
  kind: "script",
  base: "a",
  subscript: "n",
  superscript: "2",
  order: "sub-sup",
});
assert(serializedScript === "a_{n}^{2}", "script serialization should preserve order.");

console.log("structured-math: ok");
