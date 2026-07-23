export type StructuredMathDelimiter = "inline" | "display";
export type StructuredMathScriptOrder = "sub-sup" | "sup-sub";
export type StructuredMathMatrixEnv = "pmatrix" | "bmatrix";

export type StructuredMathDocument =
  | {
      delimiter: StructuredMathDelimiter;
      kind: "fraction";
      variant: "frac" | "dfrac" | "tfrac";
      numerator: string;
      denominator: string;
    }
  | {
      delimiter: StructuredMathDelimiter;
      kind: "sqrt";
      index: string | null;
      body: string;
    }
  | {
      delimiter: StructuredMathDelimiter;
      kind: "binom";
      top: string;
      bottom: string;
    }
  | {
      delimiter: StructuredMathDelimiter;
      kind: "script";
      base: string;
      subscript: string | null;
      superscript: string | null;
      order: StructuredMathScriptOrder;
    }
  | {
      delimiter: StructuredMathDelimiter;
      kind: "matrix";
      env: StructuredMathMatrixEnv;
      rows: string[][];
    }
  | {
      delimiter: StructuredMathDelimiter;
      kind: "cases";
      rows: Array<{ value: string; condition: string }>;
    };

type ParsedStandaloneMath = {
  delimiter: StructuredMathDelimiter;
  content: string;
};

function unwrapStandaloneMath(value: string): ParsedStandaloneMath | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("$")) {
    return {
      delimiter: "inline",
      content: (trimmed.endsWith("$") && trimmed.length >= 2 ? trimmed.slice(1, -1) : trimmed.slice(1)).trim(),
    };
  }
  if (trimmed.startsWith("\\[")) {
    return {
      delimiter: "display",
      content: (trimmed.endsWith("\\]") && trimmed.length >= 4 ? trimmed.slice(2, -2) : trimmed.slice(2)).trim(),
    };
  }
  return null;
}

function skipWhitespace(source: string, index: number): number {
  let next = index;
  while (next < source.length && /\s/.test(source[next] ?? "")) next += 1;
  return next;
}

function readGroupedContent(source: string, startIndex: number): { content: string; nextIndex: number } | null {
  let index = skipWhitespace(source, startIndex);
  if (source[index] !== "{") return null;
  index += 1;
  const contentStart = index;
  let depth = 1;
  while (index < source.length) {
    const char = source[index] ?? "";
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(contentStart, index),
          nextIndex: index + 1,
        };
      }
    }
    index += 1;
  }
  return null;
}

function readBracketContent(source: string, startIndex: number): { content: string; nextIndex: number } | null {
  let index = skipWhitespace(source, startIndex);
  if (source[index] !== "[") return null;
  index += 1;
  const contentStart = index;
  while (index < source.length) {
    const char = source[index] ?? "";
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "]") {
      return {
        content: source.slice(contentStart, index),
        nextIndex: index + 1,
      };
    }
    index += 1;
  }
  return null;
}

function isOnlyWhitespace(source: string, index: number): boolean {
  return source.slice(index).trim().length === 0;
}

function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let index = 0;
  let braceDepth = 0;
  while (index < source.length) {
    if (braceDepth === 0 && source.startsWith(separator, index)) {
      parts.push(source.slice(start, index));
      index += separator.length;
      start = index;
      continue;
    }
    const char = source[index] ?? "";
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    index += 1;
  }
  parts.push(source.slice(start));
  return parts;
}

function readScriptValue(source: string, startIndex: number): { content: string; nextIndex: number } | null {
  const grouped = readGroupedContent(source, startIndex);
  if (grouped) return grouped;
  const index = skipWhitespace(source, startIndex);
  const char = source[index] ?? "";
  if (!char) return null;
  return {
    content: char,
    nextIndex: index + 1,
  };
}

function parseFractionContent(content: string, delimiter: StructuredMathDelimiter): StructuredMathDocument | null {
  const match = content.match(/^\\(dfrac|tfrac|frac)\b/);
  if (!match) return null;
  const numerator = readGroupedContent(content, match[0].length);
  if (!numerator) return null;
  const denominator = readGroupedContent(content, numerator.nextIndex);
  if (!denominator || !isOnlyWhitespace(content, denominator.nextIndex)) return null;
  return {
    delimiter,
    kind: "fraction",
    variant: match[1] as "frac" | "dfrac" | "tfrac",
    numerator: numerator.content,
    denominator: denominator.content,
  };
}

function parseSqrtContent(content: string, delimiter: StructuredMathDelimiter): StructuredMathDocument | null {
  const match = content.match(/^\\sqrt\b/);
  if (!match) return null;
  let index = match[0].length;
  const rootIndex = readBracketContent(content, index);
  if (rootIndex) index = rootIndex.nextIndex;
  const body = readGroupedContent(content, index);
  if (!body || !isOnlyWhitespace(content, body.nextIndex)) return null;
  return {
    delimiter,
    kind: "sqrt",
    index: rootIndex ? rootIndex.content : null,
    body: body.content,
  };
}

function parseBinomContent(content: string, delimiter: StructuredMathDelimiter): StructuredMathDocument | null {
  const match = content.match(/^\\binom\b/);
  if (!match) return null;
  const top = readGroupedContent(content, match[0].length);
  if (!top) return null;
  const bottom = readGroupedContent(content, top.nextIndex);
  if (!bottom || !isOnlyWhitespace(content, bottom.nextIndex)) return null;
  return {
    delimiter,
    kind: "binom",
    top: top.content,
    bottom: bottom.content,
  };
}

function parseScriptContent(content: string, delimiter: StructuredMathDelimiter): StructuredMathDocument | null {
  const trimmed = content.trim();
  const firstScriptIndex = (() => {
    let braceDepth = 0;
    for (let index = 0; index < trimmed.length; index += 1) {
      const char = trimmed[index] ?? "";
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === "{") braceDepth += 1;
      else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
      else if (braceDepth === 0 && (char === "_" || char === "^")) return index;
    }
    return -1;
  })();
  if (firstScriptIndex <= 0) return null;
  const base = trimmed.slice(0, firstScriptIndex).trim();
  if (!base) return null;
  let index = firstScriptIndex;
  let subscript: string | null = null;
  let superscript: string | null = null;
  let order: StructuredMathScriptOrder = "sub-sup";
  let sawFirst: "_" | "^" | null = null;
  while (index < trimmed.length) {
    const op = trimmed[index] as "_" | "^";
    if (op !== "_" && op !== "^") return null;
    if (!sawFirst) sawFirst = op;
    const value = readScriptValue(trimmed, index + 1);
    if (!value) return null;
    if (op === "_") {
      if (subscript !== null) return null;
      subscript = value.content;
    } else {
      if (superscript !== null) return null;
      superscript = value.content;
    }
    index = skipWhitespace(trimmed, value.nextIndex);
  }
  if (!subscript && !superscript) return null;
  order = sawFirst === "^" ? "sup-sub" : "sub-sup";
  return {
    delimiter,
    kind: "script",
    base,
    subscript,
    superscript,
    order,
  };
}

function parseMatrixContent(content: string, delimiter: StructuredMathDelimiter): StructuredMathDocument | null {
  const match = content.match(/^\\begin\{(pmatrix|bmatrix)\}/);
  if (!match) return null;
  const env = match[1] as StructuredMathMatrixEnv;
  const close = `\\end{${env}}`;
  if (!content.endsWith(close)) return null;
  const body = content.slice(match[0].length, content.length - close.length).trim();
  const rows = splitTopLevel(body, "\\\\")
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .map((row) => splitTopLevel(row, "&").map((cell) => cell.trim()));
  if (rows.length === 0) return null;
  return {
    delimiter,
    kind: "matrix",
    env,
    rows,
  };
}

function parseCasesContent(content: string, delimiter: StructuredMathDelimiter): StructuredMathDocument | null {
  const open = "\\begin{cases}";
  const close = "\\end{cases}";
  if (!content.startsWith(open) || !content.endsWith(close)) return null;
  const body = content.slice(open.length, content.length - close.length).trim();
  const rows = splitTopLevel(body, "\\\\")
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .map((row) => {
      const [value = "", condition = ""] = splitTopLevel(row, "&");
      return {
        value: value.trim(),
        condition: condition.trim(),
      };
    });
  if (rows.length === 0) return null;
  return {
    delimiter,
    kind: "cases",
    rows,
  };
}

export function parseStructuredMathContent(
  content: string,
  delimiter: StructuredMathDelimiter = "inline"
): StructuredMathDocument | null {
  const trimmed = content.trim();
  if (trimmed.length === 0) return null;
  return (
    parseFractionContent(trimmed, delimiter) ??
    parseSqrtContent(trimmed, delimiter) ??
    parseBinomContent(trimmed, delimiter) ??
    parseMatrixContent(trimmed, delimiter) ??
    parseCasesContent(trimmed, delimiter) ??
    parseScriptContent(trimmed, delimiter)
  );
}

export function parseStructuredMathDocument(value: string): StructuredMathDocument | null {
  const standalone = unwrapStandaloneMath(value);
  if (!standalone) return null;
  return parseStructuredMathContent(standalone.content, standalone.delimiter);
}

export function serializeStructuredMathContent(document: StructuredMathDocument): string {
  if (document.kind === "fraction") {
    return `\\${document.variant}{${document.numerator}}{${document.denominator}}`;
  }
  if (document.kind === "sqrt") {
    const index = document.index && document.index.trim().length > 0 ? `[${document.index}]` : "";
    return `\\sqrt${index}{${document.body}}`;
  }
  if (document.kind === "binom") {
    return `\\binom{${document.top}}{${document.bottom}}`;
  }
  if (document.kind === "script") {
    const sub = document.subscript !== null ? `_{${document.subscript}}` : "";
    const sup = document.superscript !== null ? `^{${document.superscript}}` : "";
    return document.order === "sup-sub" ? `${document.base}${sup}${sub}` : `${document.base}${sub}${sup}`;
  }
  if (document.kind === "matrix") {
    const body = document.rows.map((row) => row.join(" & ")).join(" \\\\ ");
    return `\\begin{${document.env}} ${body} \\end{${document.env}}`;
  }
  const body = document.rows.map((row) => `${row.value} & ${row.condition}`).join(" \\\\ ");
  return `\\begin{cases} ${body} \\end{cases}`;
}

export function serializeStructuredMathDocument(document: StructuredMathDocument): string {
  const content = serializeStructuredMathContent(document);
  return document.delimiter === "display" ? `\\[${content}\\]` : `$${content}$`;
}
