import { parseRichTextSourceToDocument, serializeRichTextDocumentToSource, serializeRichTextDocumentToTex } from "../document";
import { parseMathSourceToNode, serializeMathNodeToTex } from "../math";
import { buildRichTextTexSource } from "../render";

function assertEqual(actual: string, expected: string, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual:   ${actual}`);
  }
}

const source = [
  "${b}_{n}={a}_{n}+1$ , lalu ${b}_{n}={b}_{n-1}^{2}+1$ , definisikan ${b}_{0}=1$.",
  "",
  "\\[{b}_{2p}-{b}_{p}=({b}_{p}-1){\\prod}_{k=0}^{p-1}({b}_{k+p}+{b}_{k})\\]",
  "${\\sum}_{k=0}^{n}{a_k}+{\\int}_{0}^{1} f(x) dx+\\lim_{n\\to\\infty} a_n$",
].join("\n");

const document = parseRichTextSourceToDocument(source);
assertEqual(serializeRichTextDocumentToSource(document), source, "rich-text source round-trip must preserve typed LaTeX");
assertEqual(serializeRichTextDocumentToTex(document), source, "rich-text TeX serializer must preserve typed LaTeX");
assertEqual(buildRichTextTexSource(document), source, "rich-text export source must preserve typed LaTeX");

const fallbackMath = serializeMathNodeToTex(parseMathSourceToNode("{\\prod}_{k=0}^{p-1}({b}_{k+p}+{b}_{k})"));
assertEqual(
  fallbackMath,
  "\\prod_{k=0}^{p-1}(b_{k+p}+b_{k})",
  "math AST fallback should not add nested braces around scripted operators"
);

console.log("richtext document source roundtrip: ok");
