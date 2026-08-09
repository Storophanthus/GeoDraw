import { buildTikzExportText, type TikzExportParams } from "../export/buildTikzExportText";

const STORAGE_PREFIX = "gd:tikz-preview:";
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Everything the preview window needs to regenerate the figure when a sizing
 * scale changes. It is exactly the exporter's params — the sizing fields double
 * as the initial slider values.
 */
export type TikzPreviewRegenParams = TikzExportParams;

export type TikzPreviewSession = {
  tikzPicture: string;
  createdAt: number;
  uiCssVariables?: Record<string, string>;
  /** Absent for web popups or legacy sessions; present enables live figure sizing. */
  regen?: TikzPreviewRegenParams;
};

type StoredTikzPreviewSession = Omit<TikzPreviewSession, "tikzPicture"> & {
  /** Omitted when regen can reproduce the exact generated TikZ. */
  tikzPicture?: string;
};

export function createTikzPreviewSession(
  source: string,
  uiCssVariables?: Record<string, string>,
  regen?: TikzPreviewRegenParams
): string {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const key = `${STORAGE_PREFIX}${token}`;
  const session: StoredTikzPreviewSession = {
    createdAt: Date.now(),
    uiCssVariables: sanitizeUiVariables(uiCssVariables),
    regen,
  };
  // When regen is present, storing the generated TikZ as well would duplicate
  // the entire construction. The preview can rebuild that exact string.
  if (!regen) session.tikzPicture = extractTikzPicture(source);
  if (typeof window !== "undefined") {
    pruneOldSessions();
    if (!storePreviewSessionWithEviction(key, JSON.stringify(session))) {
      // If the scene alone is still too large, retain just the generated TikZ.
      // The preview remains usable, though live sizing is unavailable.
      const fallback: StoredTikzPreviewSession = {
        tikzPicture: extractTikzPicture(source),
        createdAt: session.createdAt,
        uiCssVariables: session.uiCssVariables,
      };
      if (!storePreviewSessionWithEviction(key, JSON.stringify(fallback))) {
        throw new Error("TikZ preview storage is full. Close old preview windows and try again.");
      }
    }
  }
  return token;
}

export function loadTikzPreviewSession(token: string): TikzPreviewSession | null {
  if (!token || typeof window === "undefined") return null;
  const key = `${STORAGE_PREFIX}${token}`;
  const sessionStorage = getSessionStorage();
  const sessionRaw = safeStorageGet(sessionStorage, key);
  const localRaw = safeStorageGet(window.localStorage, key);
  const raw = sessionRaw ?? localRaw;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTikzPreviewSession>;
    const regen = isRegenParams(parsed.regen) ? parsed.regen : undefined;
    const tikzPicture = typeof parsed.tikzPicture === "string"
      ? parsed.tikzPicture
      : regen
        ? extractTikzPicture(buildTikzExportText(regen))
        : null;
    if (tikzPicture === null) return null;
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now();
    // The launcher and preview share localStorage, but sessionStorage belongs
    // to this preview window. Move a consumed session there so open previews
    // no longer accumulate against the app-wide localStorage quota.
    if (!sessionRaw && localRaw && sessionStorage) {
      try {
        sessionStorage.setItem(key, localRaw);
        window.localStorage.removeItem(key);
      } catch {
        // Keeping the local copy is safe when sessionStorage is unavailable.
      }
    }
    return {
      tikzPicture,
      createdAt,
      uiCssVariables: sanitizeUiVariables(parsed.uiCssVariables),
      regen,
    };
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.sessionStorage
      ? window.sessionStorage
      : null;
  } catch {
    return null;
  }
}

function safeStorageGet(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storePreviewSessionWithEviction(key: string, serialized: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, serialized);
    return true;
  } catch {
    // Continue below and reclaim older preview-only entries. Never remove
    // saved documents, preferences, or any unrelated localStorage data.
  }

  for (const candidate of previewSessionKeysOldestFirst(key)) {
    try {
      window.localStorage.removeItem(candidate);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch {
      // Remove another preview entry and retry.
    }
  }
  return false;
}

function previewSessionKeysOldestFirst(excludedKey: string): string[] {
  if (typeof window === "undefined") return [];
  const entries: Array<{ key: string; createdAt: number }> = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || key === excludedKey || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      let createdAt = 0;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { createdAt?: number };
          createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
        } catch {
          createdAt = 0;
        }
      }
      entries.push({ key, createdAt });
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => a.createdAt - b.createdAt).map((entry) => entry.key);
}

function isRegenParams(value: unknown): value is TikzPreviewRegenParams {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TikzExportParams>;
  return (
    typeof candidate.scene === "object" &&
    candidate.scene !== null &&
    typeof candidate.globalScale === "number" &&
    typeof candidate.pointScale === "number" &&
    typeof candidate.lineScale === "number" &&
    typeof candidate.labelScale === "number"
  );
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
    // Keep an outer \scalebox wrapper; it is part of the figure sizing rather
    // than document preamble noise.
    const scalebox = trimmed.lastIndexOf("\\scalebox", begin);
    if (scalebox >= 0) return trimmed.slice(scalebox);
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
