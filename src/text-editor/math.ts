import katex from "katex";
import {
  createEmptyMathGroup,
  type MathBracketNode,
  type MathCommandNode,
  type MathFractionNode,
  type MathGroupNode,
  type MathNode,
  type MathOperatorNode,
  type MathRootNode,
  type MathSubscriptNode,
  type MathSuperscriptNode,
} from "./richTextModel";

const COMMAND_OPERATOR_MAP: Record<string, string> = {
  "\\leq": "\\leq",
  "\\geq": "\\geq",
  "\\neq": "\\neq",
  "\\approx": "\\approx",
  "\\cong": "\\cong",
  "\\equiv": "\\equiv",
  "\\sim": "\\sim",
  "\\propto": "\\propto",
  "\\times": "\\times",
  "\\cdot": "\\cdot",
  "\\pm": "\\pm",
  "\\to": "\\to",
  "\\mapsto": "\\mapsto",
  "\\in": "\\in",
  "\\notin": "\\notin",
  "\\subset": "\\subset",
  "\\subseteq": "\\subseteq",
  "\\supset": "\\supset",
  "\\cup": "\\cup",
  "\\cap": "\\cap",
  "\\infty": "\\infty",
  "\\forall": "\\forall",
  "\\exists": "\\exists",
};

const COMMAND_IDENTIFIER_MAP: Record<string, string> = {
  "\\alpha": "\\alpha",
  "\\beta": "\\beta",
  "\\gamma": "\\gamma",
  "\\delta": "\\delta",
  "\\theta": "\\theta",
  "\\lambda": "\\lambda",
  "\\pi": "\\pi",
  "\\sigma": "\\sigma",
  "\\mathbb{N}": "\\mathbb{N}",
  "\\mathbb{Z}": "\\mathbb{Z}",
  "\\mathbb{Q}": "\\mathbb{Q}",
  "\\mathbb{R}": "\\mathbb{R}",
};

type ParserState = {
  source: string;
  index: number;
};

const COMMAND_ARGUMENT_COUNTS = new Map<string, number>([
  ["\\dfrac", 2],
  ["\\tfrac", 2],
  ["\\binom", 2],
  ["\\pmod", 1],
  ["\\text", 1],
  ["\\hat", 1],
  ["\\vec", 1],
  ["\\overline", 1],
]);

function peek(state: ParserState): string {
  return state.source[state.index] ?? "";
}

function consume(state: ParserState): string {
  const ch = state.source[state.index] ?? "";
  state.index += 1;
  return ch;
}

function skipSpace(state: ParserState): void {
  while (/\s/.test(peek(state))) consume(state);
}

function parseBraceSource(state: ParserState): string {
  if (consume(state) !== "{") return "";
  let depth = 1;
  let out = "{";
  while (state.index < state.source.length && depth > 0) {
    const ch = consume(state);
    out += ch;
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  return out;
}

function parseCommand(state: ParserState): string {
  if (consume(state) !== "\\") return "";
  let name = "\\";
  while (/[A-Za-z]/.test(peek(state))) name += consume(state);
  if (name === "\\mathbb" && peek(state) === "{") {
    return `${name}${parseBraceSource(state)}`;
  }
  return name;
}

function readCommandAt(source: string, index: number): { command: string; end: number } | null {
  if (source[index] !== "\\") return null;
  let cursor = index + 1;
  while (/[A-Za-z]/.test(source[cursor] ?? "")) cursor += 1;
  if (cursor === index + 1 && cursor < source.length) cursor += 1;
  return { command: source.slice(index, cursor), end: cursor };
}

function parseDelimiterToken(state: ParserState): string {
  skipSpace(state);
  if (state.index >= state.source.length) return "";
  if (peek(state) !== "\\") return consume(state);
  const command = readCommandAt(state.source, state.index);
  if (!command) return consume(state);
  state.index = command.end;
  return command.command;
}

function parseDelimitedNodesWithClose(state: ParserState, terminator: string): { nodes: MathNode[]; closed: boolean } {
  const out: MathNode[] = [];
  while (state.index < state.source.length) {
    skipSpace(state);
    const ch = peek(state);
    if (!ch) break;
    if (terminator && ch === terminator) {
      consume(state);
      return { nodes: out, closed: true };
    }
    const atom = parseAtom(state);
    if (!atom) break;
    out.push(applyScripts(state, atom));
  }
  return { nodes: out, closed: false };
}

function parseDelimitedNodes(state: ParserState, terminator: string): MathNode[] {
  return parseDelimitedNodesWithClose(state, terminator).nodes;
}

function parseGroupedArgument(state: ParserState): MathNode[] {
  skipSpace(state);
  if (peek(state) === "{") {
    consume(state);
    return parseDelimitedNodes(state, "}");
  }
  const atom = parseAtom(state);
  return atom ? [applyScripts(state, atom)] : [];
}

function parseCommandCall(state: ParserState, command: string, argCount: number): MathCommandNode {
  const args: MathNode[][] = [];
  for (let index = 0; index < argCount; index += 1) {
    args.push(parseGroupedArgument(state));
  }
  return { kind: "command", command, args };
}

function parseTrailingBracedArguments(state: ParserState): MathNode[][] {
  const args: MathNode[][] = [];
  while (true) {
    skipSpace(state);
    if (peek(state) !== "{") return args;
    args.push(parseGroupedArgument(state));
  }
}

function applyScripts(state: ParserState, base: MathNode): MathNode {
  let node = base;
  while (true) {
    skipSpace(state);
    const ch = peek(state);
    if (ch === "^") {
      consume(state);
      const exponent = parseGroupedArgument(state);
      node = {
        kind: "superscript",
        base: node.kind === "group" ? node.children : [node],
        exponent,
      } satisfies MathSuperscriptNode;
      continue;
    }
    if (ch === "_") {
      consume(state);
      const subscript = parseGroupedArgument(state);
      node = {
        kind: "subscript",
        base: node.kind === "group" ? node.children : [node],
        subscript,
      } satisfies MathSubscriptNode;
      continue;
    }
    return node;
  }
}

function parseBracket(state: ParserState, left: string, right: string): MathBracketNode {
  const parsed = parseDelimitedNodesWithClose(state, right);
  return {
    kind: "bracket",
    left,
    right: parsed.closed ? right : "",
    content: parsed.nodes,
  };
}

function parseLeftRightBracket(state: ParserState, left: string): MathBracketNode {
  const content: MathNode[] = [];
  while (state.index < state.source.length) {
    skipSpace(state);
    const command = readCommandAt(state.source, state.index);
    if (command?.command === "\\right") {
      state.index = command.end;
      return {
        kind: "bracket",
        left,
        right: parseDelimiterToken(state),
        content,
        scaled: true,
      };
    }
    const atom = parseAtom(state);
    if (!atom) break;
    content.push(applyScripts(state, atom));
  }
  return {
    kind: "bracket",
    left,
    right: "",
    content,
    scaled: true,
  };
}

function parseAtom(state: ParserState): MathNode | null {
  skipSpace(state);
  const ch = peek(state);
  if (!ch) return null;
  if (ch === "{") {
    consume(state);
    return {
      kind: "group",
      children: parseDelimitedNodes(state, "}"),
    } satisfies MathGroupNode;
  }
  if (ch === "(") {
    consume(state);
    return parseBracket(state, "(", ")");
  }
  if (ch === "[") {
    consume(state);
    return parseBracket(state, "[", "]");
  }
  if (ch === "\\") {
    const command = parseCommand(state);
    if (command === "\\left") {
      return parseLeftRightBracket(state, parseDelimiterToken(state));
    }
    if (command === "\\right") {
      return { kind: "operator", value: `${command}${parseDelimiterToken(state)}` } satisfies MathOperatorNode;
    }
    if (command === "\\frac") {
      return {
        kind: "fraction",
        numerator: parseGroupedArgument(state),
        denominator: parseGroupedArgument(state),
      } satisfies MathFractionNode;
    }
    if (command === "\\sqrt") {
      return {
        kind: "root",
        radicand: parseGroupedArgument(state),
      } satisfies MathRootNode;
    }
    const commandArgCount = COMMAND_ARGUMENT_COUNTS.get(command);
    if (commandArgCount) {
      return parseCommandCall(state, command, commandArgCount);
    }
    if (command in COMMAND_OPERATOR_MAP) {
      return { kind: "operator", value: COMMAND_OPERATOR_MAP[command] } satisfies MathOperatorNode;
    }
    if (command in COMMAND_IDENTIFIER_MAP) {
      return { kind: "identifier", value: COMMAND_IDENTIFIER_MAP[command] };
    }
    const args = parseTrailingBracedArguments(state);
    if (args.length > 0) {
      return { kind: "command", command, args };
    }
    return { kind: "identifier", value: command };
  }
  if (/[0-9]/.test(ch)) {
    let value = consume(state);
    while (/[0-9.]/.test(peek(state))) value += consume(state);
    return { kind: "number", value };
  }
  if (/[A-Za-z]/.test(ch)) {
    let value = consume(state);
    while (/[A-Za-z0-9]/.test(peek(state))) value += consume(state);
    return { kind: "identifier", value };
  }
  if (/[+\-*/=,:;<>]/.test(ch)) {
    return { kind: "operator", value: consume(state) };
  }
  consume(state);
  return { kind: "operator", value: ch };
}

export function parseMathSourceToNode(sourceRaw: string): MathNode {
  const source = sourceRaw.trim();
  if (!source) return createEmptyMathGroup();
  const state: ParserState = { source, index: 0 };
  return {
    kind: "group",
    children: parseDelimitedNodes(state, ""),
  };
}

function needsControlWordSeparator(previousTex: string, nextTex: string): boolean {
  return /\\[A-Za-z]+$/.test(previousTex) && /^[A-Za-z]/.test(nextTex);
}

function serializeMathNodesToTex(nodes: MathNode[]): string {
  return nodes.reduce((out, node) => {
    const tex = serializeMathNodeToTex(node);
    return `${out}${out.length > 0 && needsControlWordSeparator(out, tex) ? " " : ""}${tex}`;
  }, "");
}

function serializeScriptBaseToTex(nodes: MathNode[]): string {
  const tex = serializeMathNodesToTex(nodes);
  return nodes.length === 1 ? tex : `{${tex}}`;
}

export function serializeMathNodeToTex(node: MathNode): string {
  if (node.kind === "group") {
    return serializeMathNodesToTex(node.children);
  }
  if (node.kind === "identifier") return node.value;
  if (node.kind === "number") return node.value;
  if (node.kind === "operator") return node.value;
  if (node.kind === "command") {
    return `${node.command}${node.args.map((arg) => `{${serializeMathNodesToTex(arg)}}`).join("")}`;
  }
  if (node.kind === "fraction") {
    return `\\frac{${serializeMathNodesToTex(node.numerator)}}{${serializeMathNodesToTex(node.denominator)}}`;
  }
  if (node.kind === "superscript") {
    return `${serializeScriptBaseToTex(node.base)}^{${serializeMathNodesToTex(node.exponent)}}`;
  }
  if (node.kind === "subscript") {
    return `${serializeScriptBaseToTex(node.base)}_{${serializeMathNodesToTex(node.subscript)}}`;
  }
  if (node.kind === "root") {
    return `\\sqrt{${serializeMathNodesToTex(node.radicand)}}`;
  }
  if (node.kind === "bracket") {
    const content = serializeMathNodesToTex(node.content);
    if (node.scaled) {
      if (!node.right) return `\\left${node.left}${content}`;
      return `\\left${node.left}${content}\\right${node.right}`;
    }
    if (!node.right) return `${node.left}${content}`;
    return `${node.left}${content}${node.right}`;
  }
  const rows = node.rows
    .map((row) => row.map((cell) => serializeMathNodesToTex(cell)).join(" & "))
    .join(" \\\\ ");
  return `\\begin{matrix}${rows}\\end{matrix}`;
}

export function renderMathNodeToHtml(node: MathNode, displayMode = false): string {
  return katex.renderToString(serializeMathNodeToTex(node) || "\\,", {
    throwOnError: false,
    displayMode,
    strict: "ignore",
  });
}
