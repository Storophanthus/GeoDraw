export type TextLabelRichTextSegment =
  | { kind: "text"; content: string; sourceStart: number; sourceEnd: number }
  | {
      kind: "inlineMath";
      content: string;
      open?: boolean;
      sourceStart: number;
      sourceEnd: number;
      activeStart: number;
      activeEnd: number;
    }
  | {
      kind: "displayMath";
      content: string;
      open?: boolean;
      sourceStart: number;
      sourceEnd: number;
      activeStart: number;
      activeEnd: number;
    };

type ParseMode = "text" | "inlineMath" | "displayMath";
type ParseTextLabelRichTextOptions = {
  liveOpenMath?: boolean;
};

function pushText(segments: TextLabelRichTextSegment[], content: string, sourceStart: number, sourceEnd: number): void {
  if (content.length === 0) return;
  const last = segments[segments.length - 1];
  if (last?.kind === "text" && last.sourceEnd === sourceStart) {
    last.content += content;
    last.sourceEnd = sourceEnd;
    return;
  }
  segments.push({ kind: "text", content, sourceStart, sourceEnd });
}

function pushMath(
  segments: TextLabelRichTextSegment[],
  kind: "inlineMath" | "displayMath",
  content: string,
  sourceStart: number,
  sourceEnd: number,
  activeStart: number,
  activeEnd: number,
  open = false
): void {
  segments.push({ kind, content, open, sourceStart, sourceEnd, activeStart, activeEnd });
}

export function parseTextLabelRichText(
  source: string,
  options: ParseTextLabelRichTextOptions = {}
): TextLabelRichTextSegment[] {
  const segments: TextLabelRichTextSegment[] = [];
  let mode: ParseMode = "text";
  let buffer = "";
  let openDelimiter = "";
  let bufferStart = 0;
  let mathSourceStart = 0;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1] ?? "";

    if (mode === "text") {
      if (char === "\\" && next === "[") {
        pushText(segments, buffer, bufferStart, i);
        buffer = "";
        mode = "displayMath";
        openDelimiter = "\\[";
        mathSourceStart = i;
        bufferStart = i + 2;
        i += 1;
        continue;
      }
      if (char === "\\" && (next === "$" || next === "]" || next === "\\")) {
        if (buffer.length === 0) bufferStart = i;
        buffer += next;
        i += 1;
        continue;
      }
      if (char === "$") {
        pushText(segments, buffer, bufferStart, i);
        buffer = "";
        mode = "inlineMath";
        openDelimiter = "$";
        mathSourceStart = i;
        bufferStart = i + 1;
        continue;
      }
      if (buffer.length === 0) bufferStart = i;
      buffer += char;
      continue;
    }

    if (mode === "inlineMath") {
      if (char === "\\" && next === "$") {
        buffer += "\\$";
        i += 1;
        continue;
      }
      if (char === "$") {
        pushMath(segments, "inlineMath", buffer, mathSourceStart, i + 1, bufferStart, i);
        buffer = "";
        mode = "text";
        openDelimiter = "";
        bufferStart = i + 1;
        continue;
      }
      buffer += char;
      continue;
    }

    if (char === "\\" && next === "]") {
      pushMath(segments, "displayMath", buffer, mathSourceStart, i + 2, bufferStart, i);
      buffer = "";
      mode = "text";
      openDelimiter = "";
      bufferStart = i + 2;
      i += 1;
      continue;
    }
    buffer += char;
  }

  if (mode === "text") {
    pushText(segments, buffer, bufferStart, source.length);
    return segments;
  }

  if (options.liveOpenMath) {
    pushMath(
      segments,
      mode === "displayMath" ? "displayMath" : "inlineMath",
      buffer,
      mathSourceStart,
      source.length,
      bufferStart,
      source.length,
      true
    );
    return segments;
  }

  pushText(segments, `${openDelimiter}${buffer}`, mathSourceStart, source.length);
  return segments;
}
