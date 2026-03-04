const STORAGE_PREFIX = "gd:tikz-preview:";
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

export type TikzPreviewSession = {
  tikzPicture: string;
  createdAt: number;
  uiCssVariables?: Record<string, string>;
};

export function createTikzPreviewSession(source: string, uiCssVariables?: Record<string, string>): string {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const session: TikzPreviewSession = {
    tikzPicture: extractTikzPicture(source),
    createdAt: Date.now(),
    uiCssVariables: sanitizeUiVariables(uiCssVariables),
  };
  if (typeof window !== "undefined") {
    pruneOldSessions();
    window.localStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(session));
  }
  return token;
}

export function loadTikzPreviewSession(token: string): TikzPreviewSession | null {
  if (!token || typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${token}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TikzPreviewSession>;
    if (typeof parsed.tikzPicture !== "string") return null;
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now();
    return {
      tikzPicture: parsed.tikzPicture,
      createdAt,
      uiCssVariables: sanitizeUiVariables(parsed.uiCssVariables),
    };
  } catch {
    return null;
  }
}

function pruneOldSessions(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    keys.push(key);
  }
  for (const key of keys) {
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { createdAt?: number };
      const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
      if (createdAt <= 0 || now - createdAt > MAX_SESSION_AGE_MS) {
        window.localStorage.removeItem(key);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }
}

function extractTikzPicture(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "\\begin{tikzpicture}\n\\end{tikzpicture}";

  const begin = trimmed.indexOf("\\begin{tikzpicture}");
  const end = trimmed.lastIndexOf("\\end{tikzpicture}");
  if (begin >= 0 && end > begin) {
    return trimmed.slice(begin, end + "\\end{tikzpicture}".length).trim();
  }

  if (trimmed.includes("\\begin{tikzpicture}")) {
    return trimmed;
  }

  return `\\begin{tikzpicture}\n${trimmed}\n\\end{tikzpicture}`;
}

function sanitizeUiVariables(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
