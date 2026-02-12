export type NumberExpressionEvalResult = { ok: true; value: number } | { ok: false; error: string };

export function parseNumericExpression(expr: string, symbols: Map<string, number>): NumberExpressionEvalResult {
  type Token =
    | { kind: "num"; v: number }
    | { kind: "id"; v: string }
    | { kind: "op"; v: "+" | "-" | "*" | "/" | "^" | "(" | ")" };
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[0-9._]/.test(expr[j])) j += 1;
      const raw = expr.slice(i, j).replace(/_/g, "");
      const v = Number(raw);
      if (!Number.isFinite(v)) return { ok: false, error: `Invalid number: ${raw}` };
      tokens.push({ kind: "num", v });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j += 1;
      tokens.push({ kind: "id", v: expr.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^" || ch === "(" || ch === ")") {
      tokens.push({ kind: "op", v: ch });
      i += 1;
      continue;
    }
    return { ok: false, error: `Unexpected token: ${ch}` };
  }

  let p = 0;
  const peek = (): Token | null => (p < tokens.length ? tokens[p] : null);
  const take = (): Token | null => (p < tokens.length ? tokens[p++] : null);

  const parsePrimary = (): NumberExpressionEvalResult => {
    const t = take();
    if (!t) return { ok: false, error: "Unexpected end of expression." };
    if (t.kind === "num") return { ok: true, value: t.v };
    if (t.kind === "id") {
      const v = symbols.get(t.v) ?? symbols.get(t.v.toLowerCase());
      if (v === undefined) return { ok: false, error: `Unknown symbol: ${t.v}` };
      return { ok: true, value: v };
    }
    if (t.kind === "op" && t.v === "(") {
      const inner = parseExpr();
      if (!inner.ok) return inner;
      const close = take();
      if (!close || close.kind !== "op" || close.v !== ")") return { ok: false, error: "Missing closing ')'." };
      return inner;
    }
    if (t.kind === "op" && (t.v === "+" || t.v === "-")) {
      const inner = parsePrimary();
      if (!inner.ok) return inner;
      return { ok: true, value: t.v === "-" ? -inner.value : inner.value };
    }
    return { ok: false, error: "Expected number, symbol, or parenthesized expression." };
  };

  const parsePower = (): NumberExpressionEvalResult => {
    let left = parsePrimary();
    if (!left.ok) return left;
    const t = peek();
    if (t && t.kind === "op" && t.v === "^") {
      take();
      const right = parsePower();
      if (!right.ok) return right;
      left = { ok: true, value: Math.pow(left.value, right.value) };
    }
    return left;
  };

  const parseTerm = (): NumberExpressionEvalResult => {
    let left = parsePower();
    if (!left.ok) return left;
    while (true) {
      const t = peek();
      if (!t || t.kind !== "op" || (t.v !== "*" && t.v !== "/")) break;
      take();
      const right = parsePower();
      if (!right.ok) return right;
      if (t.v === "*") {
        left = { ok: true, value: left.value * right.value };
      } else {
        if (Math.abs(right.value) <= 1e-12) return { ok: false, error: "Division by zero." };
        left = { ok: true, value: left.value / right.value };
      }
    }
    return left;
  };

  const parseExpr = (): NumberExpressionEvalResult => {
    let left = parseTerm();
    if (!left.ok) return left;
    while (true) {
      const t = peek();
      if (!t || t.kind !== "op" || (t.v !== "+" && t.v !== "-")) break;
      take();
      const right = parseTerm();
      if (!right.ok) return right;
      left = { ok: true, value: t.v === "+" ? left.value + right.value : left.value - right.value };
    }
    return left;
  };

  const out = parseExpr();
  if (!out.ok) return out;
  if (p !== tokens.length) return { ok: false, error: "Unexpected trailing tokens." };
  return out;
}
