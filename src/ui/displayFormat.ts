export function formatRoundedDisplay(value: number, maxFractionDigits: number): string {
  if (!Number.isFinite(value)) return String(value);
  const digits = Math.max(0, Math.min(12, Math.floor(maxFractionDigits)));
  let out = value.toFixed(digits);
  if (digits > 0) {
    out = out.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
  }
  if (out === "-0") return "0";
  return out;
}

