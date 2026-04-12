export type RichTextStyle = {
  textColor: string;
  textSize: number;
  textAlign: "left" | "center" | "right";
  rotationDeg?: number;
};

export type RichTextDocument = {
  kind: "document";
  blocks: RichTextBlockNode[];
};

export type RichTextBlockNode = RichTextParagraphNode | RichTextDisplayMathNode;

export type RichTextParagraphNode = {
  kind: "paragraph";
  children: RichTextInlineNode[];
};

export type RichTextDisplayMathNode = {
  kind: "displayMath";
  math: MathNode;
  source?: string;
  delimiter?: "dollar" | "bracket";
};

export type RichTextInlineNode = RichTextTextRunNode | RichTextSymbolNode | RichTextInlineMathNode;

export type RichTextTextRunNode = {
  kind: "text";
  text: string;
};

export type RichTextSymbolNode = {
  kind: "symbol";
  command: string;
  text: string;
};

export type RichTextInlineMathNode = {
  kind: "inlineMath";
  math: MathNode;
  source?: string;
};

export type MathNode =
  | MathGroupNode
  | MathIdentifierNode
  | MathNumberNode
  | MathOperatorNode
  | MathCommandNode
  | MathFractionNode
  | MathSuperscriptNode
  | MathSubscriptNode
  | MathRootNode
  | MathBracketNode
  | MathMatrixNode;

export type MathGroupNode = {
  kind: "group";
  children: MathNode[];
};

export type MathIdentifierNode = {
  kind: "identifier";
  value: string;
};

export type MathNumberNode = {
  kind: "number";
  value: string;
};

export type MathOperatorNode = {
  kind: "operator";
  value: string;
};

export type MathCommandNode = {
  kind: "command";
  command: string;
  args: MathNode[][];
};

export type MathFractionNode = {
  kind: "fraction";
  numerator: MathNode[];
  denominator: MathNode[];
};

export type MathSuperscriptNode = {
  kind: "superscript";
  base: MathNode[];
  exponent: MathNode[];
};

export type MathSubscriptNode = {
  kind: "subscript";
  base: MathNode[];
  subscript: MathNode[];
};

export type MathRootNode = {
  kind: "root";
  radicand: MathNode[];
};

export type MathBracketNode = {
  kind: "bracket";
  left: string;
  right: string;
  content: MathNode[];
  scaled?: boolean;
};

export type MathMatrixNode = {
  kind: "matrix";
  rows: MathNode[][][];
};

export type RichTextSelection =
  | {
      kind: "paragraph-text";
      blockIndex: number;
      inlineIndex: number;
      start: number;
      end: number;
    }
  | {
      kind: "inline-math";
      blockIndex: number;
      inlineIndex: number;
    }
  | {
      kind: "display-math";
      blockIndex: number;
    }
  | null;

export function createEmptyMathGroup(): MathGroupNode {
  return { kind: "group", children: [] };
}

export function createEmptyParagraph(): RichTextParagraphNode {
  return {
    kind: "paragraph",
    children: [{ kind: "text", text: "" }],
  };
}

export function createEmptyRichTextDocument(): RichTextDocument {
  return {
    kind: "document",
    blocks: [createEmptyParagraph()],
  };
}

export function cloneRichTextDocument(document: RichTextDocument): RichTextDocument {
  return structuredClone(document);
}

function normalizeParagraphChildren(children: RichTextInlineNode[]): RichTextInlineNode[] {
  const merged: RichTextInlineNode[] = [];

  const pushText = (text: string) => {
    if (merged.length > 0) {
      const last = merged[merged.length - 1];
      if (last.kind === "text") {
        last.text += text;
        return;
      }
    }
    merged.push({ kind: "text", text });
  };

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.kind === "text") {
      pushText(child.text);
      continue;
    }
    if (child.kind === "symbol") {
      if (child.text.length > 0) pushText(child.text);
      continue;
    }
    if (merged.length === 0) pushText("");
    merged.push(child);
    if (i === children.length - 1) pushText("");
  }

  if (merged.length === 0) merged.push({ kind: "text", text: "" });
  if (merged[0]?.kind !== "text") merged.unshift({ kind: "text", text: "" });
  if (merged[merged.length - 1]?.kind !== "text") merged.push({ kind: "text", text: "" });
  return merged;
}

export function normalizeMathNode(node: MathNode): MathNode {
  if (node.kind === "group") {
    return {
      kind: "group",
      children: node.children.map(normalizeMathNode),
    };
  }
  if (node.kind === "fraction") {
    return {
      kind: "fraction",
      numerator: node.numerator.map(normalizeMathNode),
      denominator: node.denominator.map(normalizeMathNode),
    };
  }
  if (node.kind === "superscript") {
    return {
      kind: "superscript",
      base: node.base.map(normalizeMathNode),
      exponent: node.exponent.map(normalizeMathNode),
    };
  }
  if (node.kind === "subscript") {
    return {
      kind: "subscript",
      base: node.base.map(normalizeMathNode),
      subscript: node.subscript.map(normalizeMathNode),
    };
  }
  if (node.kind === "root") {
    return {
      kind: "root",
      radicand: node.radicand.map(normalizeMathNode),
    };
  }
  if (node.kind === "command") {
    return {
      kind: "command",
      command: node.command,
      args: node.args.map((arg) => arg.map(normalizeMathNode)),
    };
  }
  if (node.kind === "bracket") {
    return {
      kind: "bracket",
      left: node.left,
      right: node.right,
      content: node.content.map(normalizeMathNode),
      scaled: node.scaled === true ? true : undefined,
    };
  }
  if (node.kind === "matrix") {
    return {
      kind: "matrix",
      rows: node.rows.map((row) => row.map((cell) => cell.map(normalizeMathNode))),
    };
  }
  return node;
}

export function normalizeRichTextDocument(document: RichTextDocument): RichTextDocument {
  const blocks = document.blocks.length > 0 ? document.blocks : [createEmptyParagraph()];
  return {
    kind: "document",
    blocks: blocks.map((block) => {
    if (block.kind === "displayMath") {
      return {
        kind: "displayMath",
        math: normalizeMathNode(block.math),
        source: typeof block.source === "string" ? block.source : undefined,
        delimiter: block.delimiter === "bracket" ? "bracket" : block.delimiter === "dollar" ? "dollar" : undefined,
      };
    }
      return {
        kind: "paragraph",
        children: normalizeParagraphChildren(
          block.children.map((child) =>
            child.kind === "inlineMath"
              ? {
                  kind: "inlineMath",
                  math: normalizeMathNode(child.math),
                  source: typeof child.source === "string" ? child.source : undefined,
                }
              : child
          )
        ),
      };
    }),
  };
}
