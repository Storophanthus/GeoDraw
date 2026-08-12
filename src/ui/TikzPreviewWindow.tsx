import { invoke } from "@tauri-apps/api/core";
import { save as tauriSave } from "@tauri-apps/plugin-dialog";
import { create, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { buildStandaloneSource, deriveDefaultOptionalPreamble } from "../export/tikz/standaloneDocument";
import { buildTikzExportText } from "../export/buildTikzExportText";
import {
  applyFigureTreatment,
  getFigureTreatmentFactor,
  removeFigureTreatment,
  resolveSavedFigureTreatment,
  type FigureTreatmentMode,
  type FigureTreatmentSelection,
} from "../export/figureTreatment";
import type { SceneModel } from "../scene/points";
import { loadStoredExportPreferences, saveStoredExportPreferences } from "../state/appPreferences";
import {
  loadTikzPreviewSession,
  loadTikzPreviewSessionWithDesktopFallback,
  type TikzPreviewSession,
} from "./tikzPreviewSession";
import {
  listPreviewLabelTargets,
  nudgePreviewLabel,
  resetPreviewLabel,
  type PreviewLabelTarget,
} from "./tikzPreviewLabels";
import { getCanvasCaptureFigureSizing } from "./tikzPreviewSizing";
import { IconGlobe, IconPoint, IconLine, IconType } from "./icons";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type TikzPreviewWindowProps = {
  token: string;
};

type CodeToolTab = "sizing" | "labels" | "find" | "preamble";
type CompileTikzPreviewResult = {
  pdf_base64: string;
  log: string;
  engine: string;
};

const SPLIT_DRAG_THRESHOLD_PX = 8;
const SPLIT_DRAG_FAST_CLICK_MS = 90;
const SPLIT_DRAG_FAST_CLICK_THRESHOLD_PX = 12;
const MAX_TIKZ_EDITOR_HISTORY = 250;
const MIN_PDF_ZOOM = 0.4;
const MAX_PDF_ZOOM = 4;
const PDF_CANVAS_PADDING = 18;

function formatPreviewScale(raw: string, twoDecimals: boolean): string {
  if (!twoDecimals) return raw;
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return String(Number(value.toFixed(2)));
}

function compactPreviewLabelText(raw: string): string {
  const greek: Record<string, string> = {
    "\\alpha": "α",
    "\\beta": "β",
    "\\gamma": "γ",
    "\\delta": "δ",
    "\\theta": "θ",
    "\\lambda": "λ",
    "\\mu": "μ",
    "\\pi": "π",
    "\\sigma": "σ",
    "\\phi": "φ",
    "\\omega": "ω",
  };
  let text = raw
    .replace(/\^\{\\prime\}/gu, "′")
    .replace(/\^\\prime/gu, "′")
    .replace(/\$+/gu, "");
  for (const [tex, glyph] of Object.entries(greek)) {
    text = text.split(tex).join(glyph);
  }
  const subscriptDigits: Record<string, string> = {
    "0": "₀",
    "1": "₁",
    "2": "₂",
    "3": "₃",
    "4": "₄",
    "5": "₅",
    "6": "₆",
    "7": "₇",
    "8": "₈",
    "9": "₉",
  };
  text = text.replace(/_\{?([0-9]+)\}?/gu, (_match, digits: string) =>
    [...digits].map((digit) => subscriptDigits[digit] ?? digit).join("")
  );
  return text.replace(/[{}]/gu, "").trim() || raw;
}

function PrecisionLabelTile({
  target,
  onNudge,
  onReset,
}: {
  target: PreviewLabelTarget;
  onNudge: (target: PreviewLabelTarget, dx: number, dy: number, coarse: boolean) => void;
  onReset: (target: PreviewLabelTarget) => void;
}) {
  const nudge = (dx: number, dy: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    onNudge(target, dx, dy, event.shiftKey);
  };
  const title = `${target.kindLabel}: ${target.text}`;
  return (
    <div className="previewLabelPrecisionTile" title={title}>
      <div className="previewLabelPrecisionIdentity">
        <span className="previewLabelPrecisionName">{compactPreviewLabelText(target.text)}</span>
        <span className="previewLabelPrecisionKind">{target.kindLabel}</span>
      </div>
      <div className="previewLabelJoystick" aria-label={`Move ${target.text}`}>
        <button
          type="button"
          className="previewLabelJoystickButton up"
          onClick={nudge(0, -1)}
          aria-label={`Move ${target.text} up`}
          title="Up 1 px · Shift-click 5 px"
        >
          ↑
        </button>
        <button
          type="button"
          className="previewLabelJoystickButton left"
          onClick={nudge(-1, 0)}
          aria-label={`Move ${target.text} left`}
          title="Left 1 px · Shift-click 5 px"
        >
          ←
        </button>
        <button
          type="button"
          className="previewLabelJoystickButton reset"
          onClick={() => onReset(target)}
          aria-label={`Reset ${target.text} position`}
          title="Reset this label"
        >
          ↺
        </button>
        <button
          type="button"
          className="previewLabelJoystickButton right"
          onClick={nudge(1, 0)}
          aria-label={`Move ${target.text} right`}
          title="Right 1 px · Shift-click 5 px"
        >
          →
        </button>
        <button
          type="button"
          className="previewLabelJoystickButton down"
          onClick={nudge(0, 1)}
          aria-label={`Move ${target.text} down`}
          title="Down 1 px · Shift-click 5 px"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

export function TikzPreviewWindow({ token }: TikzPreviewWindowProps) {
  const immediateSession = useMemo(() => loadTikzPreviewSession(token), [token]);
  const [session, setSession] = useState<TikzPreviewSession | null | undefined>(
    immediateSession ?? undefined
  );

  useEffect(() => {
    const localSession = loadTikzPreviewSession(token);
    if (localSession) {
      setSession(localSession);
      return;
    }
    let cancelled = false;
    setSession(undefined);
    void loadTikzPreviewSessionWithDesktopFallback(token).then((loaded) => {
      if (!cancelled) setSession(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (session === undefined) {
    return <TikzPreviewSessionStatus message="Opening preview…" />;
  }
  if (session === null) {
    return (
      <TikzPreviewSessionStatus message="Preview session not found. Open this window from the main Export panel again." />
    );
  }
  return <TikzPreviewWorkspace session={session} />;
}

function TikzPreviewSessionStatus({ message }: { message: string }) {
  return (
    <div className="previewWindowRoot">
      <header className="previewWindowHeader">
        <h1 className="previewWindowTitle">TikZ Preview</h1>
      </header>
      <div className="previewWindowMissing">{message}</div>
    </div>
  );
}

function TikzPreviewWorkspace({ session }: { session: TikzPreviewSession }) {
  const isTauriRuntime = useMemo(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object),
    []
  );
  const [tikzCode, setTikzCode] = useState(session?.tikzPicture ?? "\\begin{tikzpicture}\n\\end{tikzpicture}");
  const [optionalPreamble, setOptionalPreamble] = useState("");
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfRenderError, setPdfRenderError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState("");
  const [copied, setCopied] = useState(false);
  const [pdfContextMenu, setPdfContextMenu] = useState<{ x: number; y: number } | null>(null);

  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [findStatus, setFindStatus] = useState("");
  const [codePaneRatio, setCodePaneRatio] = useState(0.55);

  // Live figure sizing: only available when the launcher captured the scene
  // (desktop app). Web popups fall back to a static, non-resizable preview.
  const regen = session?.regen ?? null;
  const canvasTrueZoom =
    typeof regen?.canvasTrueZoom === "number" && Number.isFinite(regen.canvasTrueZoom)
      ? Math.max(0.05, regen.canvasTrueZoom)
      : 1;
  const initialFigureTreatment: FigureTreatmentMode = session?.treatment?.mode ?? "canvas";
  const legacyBaseTreatmentScales = removeFigureTreatment(
    regen?.scaleboxScale ?? 1,
    regen?.globalScale ?? 1,
    initialFigureTreatment,
    canvasTrueZoom
  );
  const treatmentBaseRef = useRef({
    scaleboxScale:
      session?.treatment?.baseScaleboxScale ?? legacyBaseTreatmentScales.scaleboxScale,
    globalScale: session?.treatment?.baseGlobalScale ?? legacyBaseTreatmentScales.globalScale,
  });
  const previewSceneRef = useRef<SceneModel | null>(regen?.scene ?? null);
  const [codeToolTab, setCodeToolTab] = useState<CodeToolTab>(() =>
    regen ? "sizing" : "find"
  );
  const initialTwoDecimalPrecision = regen?.roundNumbersToTwoDecimals === true;
  const [scaleboxScale, setScaleboxScale] = useState(
    () => formatPreviewScale(regen ? String(regen.scaleboxScale ?? 1) : "1", initialTwoDecimalPrecision)
  );
  const [trueGlobalScale, setTrueGlobalScale] = useState(
    () => formatPreviewScale(regen ? String(regen.trueGlobalScale ?? 1) : "1", initialTwoDecimalPrecision)
  );
  const [globalScale, setGlobalScale] = useState(() =>
    formatPreviewScale(regen ? String(regen.globalScale) : "1", initialTwoDecimalPrecision)
  );
  const [pointScale, setPointScale] = useState(() =>
    formatPreviewScale(regen ? String(regen.pointScale) : "1", initialTwoDecimalPrecision)
  );
  const [lineScale, setLineScale] = useState(() =>
    formatPreviewScale(regen ? String(regen.lineScale) : "1", initialTwoDecimalPrecision)
  );
  const [labelScale, setLabelScale] = useState(() =>
    formatPreviewScale(regen ? String(regen.labelScale) : "1", initialTwoDecimalPrecision)
  );
  const [labelHaloScale, setLabelHaloScale] = useState(() =>
    formatPreviewScale(regen ? String(regen.labelHaloScale ?? 1) : "1", initialTwoDecimalPrecision)
  );
  const [roundNumbersToTwoDecimals, setRoundNumbersToTwoDecimals] = useState(initialTwoDecimalPrecision);
  const [preferDvipsNames, setPreferDvipsNames] = useState(regen?.preferDvipsNames === true);
  const [figureSizingDefaultSaved, setFigureSizingDefaultSaved] = useState(false);
  const [figureTreatment, setFigureTreatment] = useState<FigureTreatmentSelection>(
    initialFigureTreatment
  );
  const [figureTreatmentFactor, setFigureTreatmentFactor] = useState(() =>
    regen?.figureTreatmentFactor ??
    getFigureTreatmentFactor(initialFigureTreatment, canvasTrueZoom)
  );
  const recompileTimerRef = useRef<number | null>(null);
  const automaticPreambleRef = useRef("");

  const precisionLabelTargets = useMemo(
    () =>
      regen
        ? listPreviewLabelTargets(regen.scene, {
            viewport: regen.viewport,
            clipRectWorld: regen.clipRectWorld,
            clipPolygonWorld: regen.clipPolygonWorld,
            screenPxPerWorld: regen.screenPxPerWorld,
          })
        : [],
    [regen]
  );

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pdfViewportRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfContextMenuRef = useRef<HTMLDivElement | null>(null);
  const splitDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startAt: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{
    points: Map<number, { x: number; y: number }>;
    startDistance: number;
    startZoom: number;
  }>({
    points: new Map(),
    startDistance: 0,
    startZoom: 1,
  });
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const pdfRenderTaskRef = useRef<RenderTask | null>(null);
  const pdfRenderSequenceRef = useRef(0);
  const pdfSkipNextZoomRenderRef = useRef(false);
  const pdfZoomRef = useRef(pdfZoom);
  const gestureStartZoomRef = useRef(1);
  const tikzUndoStackRef = useRef<string[]>([]);
  const tikzRedoStackRef = useRef<string[]>([]);

  const updateTikzCode = useCallback(
    (
      next: string,
      options?: {
        trackHistory?: boolean;
        resetHistory?: boolean;
      }
    ) => {
      setTikzCode((prev) => {
        if (next === prev) return prev;
        if (options?.resetHistory) {
          tikzUndoStackRef.current = [];
          tikzRedoStackRef.current = [];
        } else if (options?.trackHistory !== false) {
          tikzUndoStackRef.current.push(prev);
          if (tikzUndoStackRef.current.length > MAX_TIKZ_EDITOR_HISTORY) {
            tikzUndoStackRef.current.shift();
          }
          tikzRedoStackRef.current = [];
        }
        return next;
      });
    },
    []
  );

  const undoTikzCode = useCallback(() => {
    const undoStack = tikzUndoStackRef.current;
    if (undoStack.length === 0) return;
    const previous = undoStack.pop();
    if (previous === undefined) return;
    setTikzCode((current) => {
      tikzRedoStackRef.current.push(current);
      if (tikzRedoStackRef.current.length > MAX_TIKZ_EDITOR_HISTORY) {
        tikzRedoStackRef.current.shift();
      }
      return previous;
    });
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const pos = editor.value.length;
      editor.setSelectionRange(pos, pos);
    });
  }, []);

  const redoTikzCode = useCallback(() => {
    const redoStack = tikzRedoStackRef.current;
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    if (next === undefined) return;
    setTikzCode((current) => {
      tikzUndoStackRef.current.push(current);
      if (tikzUndoStackRef.current.length > MAX_TIKZ_EDITOR_HISTORY) {
        tikzUndoStackRef.current.shift();
      }
      return next;
    });
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const pos = editor.value.length;
      editor.setSelectionRange(pos, pos);
    });
  }, []);

  const compilePdf = useCallback(
    async (sourceTikz: string, preambleText: string) => {
      if (!isTauriRuntime) {
        setError("PDF rendering in preview window is available only in the desktop app.");
        return;
      }
      if (!sourceTikz.trim()) {
        setError("TikZ code is empty.");
        return;
      }
      setBusy(true);
      setError("");

      try {
        const source = buildStandaloneSource(sourceTikz, preambleText);
        const result = await invoke<CompileTikzPreviewResult>("compile_tikz_preview", { source });
        const bytes = decodeBase64ToBytes(result.pdf_base64);
        setPdfData(bytes);
        setLog(result.log || `Compiled using ${result.engine}.`);
      } catch (err) {
        setPdfData(null);
        const rawMessage = extractErrorMessage(err);
        const normalized = normalizePreviewError(rawMessage);
        setError(normalized.display);
        if (normalized.log) {
          setLog(normalized.log);
        }
      } finally {
        setBusy(false);
      }
    },
    [isTauriRuntime]
  );

  // Rebuild the TikZ from the captured scene with new sizing scales, then
  // recompile. The code update is instant; the PDF recompile is debounced since
  // it shells out to LaTeX and the number spinners can fire rapidly.
  const applyScales = useCallback(
    (next: Partial<{
      scalebox: string;
      trueGlobal: string;
      global: string;
      point: string;
      line: string;
      label: string;
      labelHalo: string;
      twoDecimals: boolean;
      dvipsNames: boolean;
      figureTreatmentFactor: number;
    }>) => {
      if (!regen) return;
      setFigureSizingDefaultSaved(false);
      const resolved = {
        scalebox: next.scalebox ?? scaleboxScale,
        trueGlobal: next.trueGlobal ?? trueGlobalScale,
        global: next.global ?? globalScale,
        point: next.point ?? pointScale,
        line: next.line ?? lineScale,
        label: next.label ?? labelScale,
        labelHalo: next.labelHalo ?? labelHaloScale,
        twoDecimals: next.twoDecimals ?? roundNumbersToTwoDecimals,
        dvipsNames: next.dvipsNames ?? preferDvipsNames,
        figureTreatmentFactor: next.figureTreatmentFactor ?? figureTreatmentFactor,
      };
      let nextTikz: string;
      try {
        nextTikz = buildTikzExportText({
          ...regen,
          scene: previewSceneRef.current ?? regen.scene,
          scaleboxScale: Number(resolved.scalebox),
          trueGlobalScale: Number(resolved.trueGlobal),
          globalScale: Number(resolved.global),
          pointScale: Number(resolved.point),
          lineScale: Number(resolved.line),
          labelScale: Number(resolved.label),
          labelHaloScale: Number(resolved.labelHalo),
          roundNumbersToTwoDecimals: resolved.twoDecimals,
          preferDvipsNames: resolved.dvipsNames,
          figureTreatmentFactor: resolved.figureTreatmentFactor,
        });
      } catch {
        return; // leave the current code untouched if regeneration fails
      }
      let nextPreamble = optionalPreamble;
      if (next.dvipsNames !== undefined) {
        const automaticPreamble = deriveDefaultOptionalPreamble(
          nextTikz,
          session?.uiCssVariables,
          { preferDvipsNames: resolved.dvipsNames }
        );
        if (optionalPreamble === automaticPreambleRef.current) {
          nextPreamble = automaticPreamble;
          setOptionalPreamble(automaticPreamble);
        }
        automaticPreambleRef.current = automaticPreamble;
      }
      updateTikzCode(nextTikz, { trackHistory: true });
      if (recompileTimerRef.current !== null) {
        window.clearTimeout(recompileTimerRef.current);
      }
      recompileTimerRef.current = window.setTimeout(() => {
        recompileTimerRef.current = null;
        void compilePdf(nextTikz, nextPreamble);
      }, 350);
    },
    [
      regen,
      scaleboxScale,
      trueGlobalScale,
      globalScale,
      pointScale,
      lineScale,
      labelScale,
      labelHaloScale,
      roundNumbersToTwoDecimals,
      preferDvipsNames,
      figureTreatmentFactor,
      session?.uiCssVariables,
      updateTikzCode,
      compilePdf,
      optionalPreamble,
    ]
  );

  const regenerateWithScene = useCallback(
    (nextScene: SceneModel) => {
      if (!regen) return;
      let nextTikz: string;
      try {
        nextTikz = buildTikzExportText({
          ...regen,
          scene: nextScene,
          scaleboxScale: Number(scaleboxScale),
          trueGlobalScale: Number(trueGlobalScale),
          globalScale: Number(globalScale),
          pointScale: Number(pointScale),
          lineScale: Number(lineScale),
          labelScale: Number(labelScale),
          labelHaloScale: Number(labelHaloScale),
          roundNumbersToTwoDecimals,
          preferDvipsNames,
          figureTreatmentFactor,
        });
      } catch {
        return;
      }
      updateTikzCode(nextTikz, { trackHistory: true });
      if (recompileTimerRef.current !== null) {
        window.clearTimeout(recompileTimerRef.current);
      }
      recompileTimerRef.current = window.setTimeout(() => {
        recompileTimerRef.current = null;
        void compilePdf(nextTikz, optionalPreamble);
      }, 350);
    },
    [
      regen,
      scaleboxScale,
      trueGlobalScale,
      globalScale,
      pointScale,
      lineScale,
      labelScale,
      labelHaloScale,
      roundNumbersToTwoDecimals,
      preferDvipsNames,
      figureTreatmentFactor,
      updateTikzCode,
      compilePdf,
      optionalPreamble,
    ]
  );

  const nudgePrecisionLabel = useCallback(
    (target: PreviewLabelTarget, deltaX: number, deltaY: number, coarse: boolean) => {
      if (!regen) return;
      const currentScene = previewSceneRef.current ?? regen.scene;
      const amount = coarse ? 5 : 1;
      const nextScene = nudgePreviewLabel(
        currentScene,
        target,
        { x: deltaX * amount, y: deltaY * amount },
        regen.screenPxPerWorld
      );
      previewSceneRef.current = nextScene;
      regenerateWithScene(nextScene);
    },
    [regen, regenerateWithScene]
  );

  const resetPrecisionLabel = useCallback(
    (target: PreviewLabelTarget) => {
      if (!regen) return;
      const currentScene = previewSceneRef.current ?? regen.scene;
      const nextScene = resetPreviewLabel(currentScene, regen.scene, target);
      previewSceneRef.current = nextScene;
      regenerateWithScene(nextScene);
    },
    [regen, regenerateWithScene]
  );

  const selectFigureTreatment = (mode: FigureTreatmentMode) => {
    if (!regen) return;
    const next = applyFigureTreatment(
      treatmentBaseRef.current.scaleboxScale,
      treatmentBaseRef.current.globalScale,
      mode,
      canvasTrueZoom
    );
    const nextScalebox = formatPreviewScale(
      String(next.scaleboxScale),
      roundNumbersToTwoDecimals
    );
    const nextGlobal = formatPreviewScale(
      String(next.globalScale),
      roundNumbersToTwoDecimals
    );
    const nextTreatmentFactor = getFigureTreatmentFactor(mode, canvasTrueZoom);
    setFigureTreatment(mode);
    setFigureTreatmentFactor(nextTreatmentFactor);
    setScaleboxScale(nextScalebox);
    setGlobalScale(nextGlobal);
    applyScales({
      scalebox: nextScalebox,
      global: nextGlobal,
      figureTreatmentFactor: nextTreatmentFactor,
    });
  };

  const saveFigureSizingAsDefault = () => {
    if (!regen) return;
    const stored = loadStoredExportPreferences();
    const normalized = (raw: string, fallback: string): string => {
      const value = Number(raw);
      if (!Number.isFinite(value)) return fallback;
      return roundNumbersToTwoDecimals
        ? String(Number(value.toFixed(2)))
        : String(Number(value.toPrecision(15)));
    };
    const resolvedDefault = resolveSavedFigureTreatment(
      figureTreatment,
      Number(scaleboxScale),
      Number(globalScale),
      treatmentBaseRef.current.scaleboxScale,
      treatmentBaseRef.current.globalScale,
      canvasTrueZoom
    );
    const savedBaseScalebox = normalized(
      String(resolvedDefault.scaleboxScale),
      stored.scaleboxScale
    );
    const savedBaseGlobal = normalized(
      String(resolvedDefault.globalScale),
      stored.globalScale
    );
    const saved = saveStoredExportPreferences({
      ...stored,
      // Named treatments persist independently from their uncompensated manual
      // pair. Custom values keep the legacy Canvas normalization behavior.
      figureTreatment: resolvedDefault.mode,
      scaleboxScale: savedBaseScalebox,
      trueGlobalScale: normalized(trueGlobalScale, stored.trueGlobalScale),
      globalScale: savedBaseGlobal,
      pointScale: normalized(pointScale, stored.pointScale),
      lineScale: normalized(lineScale, stored.lineScale),
      labelScale: normalized(labelScale, stored.labelScale),
      labelHaloScale: normalized(labelHaloScale, stored.labelHaloScale),
      roundNumbersToTwoDecimals,
      preferDvipsNames,
    });
    if (saved && figureTreatment === "custom") {
      treatmentBaseRef.current = {
        scaleboxScale: Number(savedBaseScalebox),
        globalScale: Number(savedBaseGlobal),
      };
    }
    setFigureSizingDefaultSaved(saved);
  };

  const useCanvasCaptureSizing = () => {
    if (!regen) return;
    const captured = getCanvasCaptureFigureSizing(regen.canvasTrueZoom, roundNumbersToTwoDecimals);

    treatmentBaseRef.current = { scaleboxScale: 1, globalScale: 1 };
    setFigureTreatment("canvas");
    setFigureTreatmentFactor(canvasTrueZoom);
    setScaleboxScale(captured.scalebox);
    setTrueGlobalScale(captured.trueGlobal);
    setGlobalScale(captured.global);
    setPointScale(captured.point);
    setLineScale(captured.line);
    setLabelScale(captured.label);
    setLabelHaloScale(captured.labelHalo);
    setFigureSizingDefaultSaved(false);
    applyScales({
      ...captured,
      figureTreatmentFactor: canvasTrueZoom,
    });
  };

  useEffect(() => {
    return () => {
      if (recompileTimerRef.current !== null) {
        window.clearTimeout(recompileTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextTikz = session?.tikzPicture ?? "\\begin{tikzpicture}\n\\end{tikzpicture}";
    previewSceneRef.current = regen?.scene ?? null;
    updateTikzCode(nextTikz, {
      trackHistory: false,
      resetHistory: true,
    });
    const defaultPreamble = deriveDefaultOptionalPreamble(nextTikz, session?.uiCssVariables, {
      preferDvipsNames: regen?.preferDvipsNames === true,
    });
    automaticPreambleRef.current = defaultPreamble;
    setOptionalPreamble(defaultPreamble);
    setCodeToolTab(regen ? "sizing" : defaultPreamble ? "preamble" : "find");
    if (session) {
      void compilePdf(nextTikz, defaultPreamble);
    }
  }, [session, regen, updateTikzCode, compilePdf]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("preview-split-dragging");
    };
  }, []);

  useEffect(() => {
    pdfZoomRef.current = pdfZoom;
  }, [pdfZoom]);

  useEffect(() => {
    const onGestureStart = (event: Event) => {
      if (!isEventInsidePdfViewport(event, pdfViewportRef.current)) return;
      const gesture = event as Event & { preventDefault: () => void };
      gesture.preventDefault();
      gestureStartZoomRef.current = pdfZoomRef.current;
    };

    const onGestureChange = (event: Event) => {
      if (!isEventInsidePdfViewport(event, pdfViewportRef.current)) return;
      const gesture = event as Event & { scale?: number; preventDefault: () => void };
      gesture.preventDefault();
      const scale = typeof gesture.scale === "number" ? gesture.scale : 1;
      setPdfZoom((prev) => {
        const next = clamp(gestureStartZoomRef.current * scale, MIN_PDF_ZOOM, MAX_PDF_ZOOM);
        return Math.abs(next - prev) < 0.01 ? prev : next;
      });
    };

    const options: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener("gesturestart", onGestureStart as EventListener, options);
    window.addEventListener("gesturechange", onGestureChange as EventListener, options);
    return () => {
      window.removeEventListener("gesturestart", onGestureStart as EventListener, options);
      window.removeEventListener("gesturechange", onGestureChange as EventListener, options);
    };
  }, []);

  useEffect(() => {
    if (!pdfContextMenu) return;
    const close = () => setPdfContextMenu(null);

    const onPointerDown = (event: PointerEvent) => {
      const menu = pdfContextMenuRef.current;
      if (!menu) return;
      if (event.target instanceof Node && menu.contains(event.target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [pdfContextMenu]);

  const renderPdfPage = useCallback(async (zoom: number) => {
    const document = pdfDocumentRef.current;
    const canvas = pdfCanvasRef.current;
    if (!document || !canvas) return;

    const sequence = ++pdfRenderSequenceRef.current;
    try {
      const page = await document.getPage(1);
      if (sequence !== pdfRenderSequenceRef.current) return;

      const viewport = page.getViewport({ scale: zoom });
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));

      const context = canvas.getContext("2d");
      if (!context) {
        setPdfRenderError("Canvas context is unavailable.");
        return;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (pdfRenderTaskRef.current) {
        pdfRenderTaskRef.current.cancel();
      }
      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      pdfRenderTaskRef.current = renderTask;
      await renderTask.promise;
      if (sequence !== pdfRenderSequenceRef.current) return;
      setPdfRenderError("");
    } catch (err) {
      const renderErr = err as { name?: string; message?: string };
      if (renderErr?.name === "RenderingCancelledException") return;
      setPdfRenderError(renderErr?.message || "Failed to render PDF preview.");
    }
  }, []);

  const computeFitZoom = useCallback(async (document: PDFDocumentProxy): Promise<number> => {
    const viewport = pdfViewportRef.current;
    if (!viewport) return clamp(pdfZoomRef.current, MIN_PDF_ZOOM, MAX_PDF_ZOOM);

    const availableWidth = viewport.clientWidth - PDF_CANVAS_PADDING * 2;
    const availableHeight = viewport.clientHeight - PDF_CANVAS_PADDING * 2;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return clamp(pdfZoomRef.current, MIN_PDF_ZOOM, MAX_PDF_ZOOM);
    }

    const firstPage = await document.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const fitByWidth = availableWidth / baseViewport.width;
    const fitByHeight = availableHeight / baseViewport.height;
    return clamp(Math.min(fitByWidth, fitByHeight), MIN_PDF_ZOOM, MAX_PDF_ZOOM);
  }, []);

  useEffect(() => {
    return () => {
      pdfRenderTaskRef.current?.cancel();
      pdfRenderTaskRef.current = null;
      if (pdfDocumentRef.current) {
        void pdfDocumentRef.current.destroy();
        pdfDocumentRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadDocument = async () => {
      if (!pdfData) {
        if (pdfDocumentRef.current) {
          await pdfDocumentRef.current.destroy();
          pdfDocumentRef.current = null;
        }
        if (pdfCanvasRef.current) {
          const canvas = pdfCanvasRef.current;
          const context = canvas.getContext("2d");
          if (context) context.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      setPdfRenderError("");
      const previewBytes = pdfData.slice();
      const loadingTask = getDocument({
        data: previewBytes,
        // WKWebView/Tauri WebView can throw DataCloneError ("The object can not be cloned")
        // when PDF.js tries OffscreenCanvas/ImageDecoder worker paths.
        isOffscreenCanvasSupported: false,
        isImageDecoderSupported: false,
      });
      try {
        const loadedDocument = await loadingTask.promise;
        if (disposed) {
          await loadedDocument.destroy();
          return;
        }
        if (pdfDocumentRef.current) {
          await pdfDocumentRef.current.destroy();
        }
        pdfDocumentRef.current = loadedDocument;
        await waitNextFrame();
        const fitZoom = await computeFitZoom(loadedDocument);
        const shouldSkipEffectRender = Math.abs(fitZoom - pdfZoomRef.current) > 0.001;
        if (shouldSkipEffectRender) {
          pdfSkipNextZoomRenderRef.current = true;
          pdfZoomRef.current = fitZoom;
          setPdfZoom(fitZoom);
        }
        await renderPdfPage(fitZoom);
      } catch (err) {
        if (disposed) return;
        setPdfRenderError(extractErrorMessage(err));
      }
    };

    void loadDocument();
    return () => {
      disposed = true;
      pdfRenderTaskRef.current?.cancel();
    };
  }, [computeFitZoom, pdfData, renderPdfPage]);

  useEffect(() => {
    if (!pdfDocumentRef.current) return;
    if (pdfSkipNextZoomRenderRef.current) {
      pdfSkipNextZoomRenderRef.current = false;
      return;
    }
    void renderPdfPage(pdfZoom);
  }, [pdfZoom, renderPdfPage]);

  const updatePdf = useCallback(async () => {
    await compilePdf(tikzCode, optionalPreamble);
  }, [compilePdf, tikzCode, optionalPreamble]);

  const copyEditedTikz = async () => {
    try {
      await navigator.clipboard.writeText(tikzCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const normalizeTauriPath = (path: string): string => {
    const trimmed = path.trim();
    if (trimmed.startsWith("file://")) {
      const withoutScheme = trimmed.replace(/^file:\/\//, "");
      return decodeURIComponent(withoutScheme);
    }
    return trimmed;
  };

  const defaultPreviewFileName = (extension: "pdf" | "png" | "svg" | "tex"): string => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `tikz-preview-${stamp}.${extension}`;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // WebKit can resolve the download asynchronously; immediate revocation can yield 0-byte files.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const writeBinaryFileWithDialog = async (path: string, bytes: Uint8Array) => {
    const file = await create(normalizeTauriPath(path));
    try {
      const written = await file.write(bytes);
      if (written !== bytes.length) {
        throw new Error(`Incomplete write: expected ${bytes.length} bytes, wrote ${written}.`);
      }
    } finally {
      await file.close();
    }
  };

  const saveBytesWithDialog = async (
    bytes: Uint8Array,
    extension: "pdf" | "png",
    filterName: "PDF" | "PNG"
  ) => {
    if (isTauriRuntime) {
      const path = await tauriSave({
        defaultPath: defaultPreviewFileName(extension),
        filters: [{ name: filterName, extensions: [extension] }],
      });
      if (!path) return;
      await writeBinaryFileWithDialog(path, bytes);
      return;
    }
    const mime = extension === "pdf" ? "application/pdf" : "image/png";
    downloadBlob(new Blob([bytes], { type: mime }), defaultPreviewFileName(extension));
  };

  const saveTextWithDialog = async (
    text: string,
    extension: "svg" | "tex",
    filterName: "SVG" | "LaTeX"
  ) => {
    if (isTauriRuntime) {
      const path = await tauriSave({
        defaultPath: defaultPreviewFileName(extension),
        filters: [{ name: filterName, extensions: [extension] }],
      });
      if (!path) return;
      await writeTextFile(normalizeTauriPath(path), text);
      return;
    }
    const mimeType = extension === "svg" ? "image/svg+xml;charset=utf-8" : "text/plain;charset=utf-8";
    downloadBlob(new Blob([text], { type: mimeType }), defaultPreviewFileName(extension));
  };

  const buildSvgSnapshotFromCanvas = (): string | null => {
    const canvas = pdfCanvasRef.current;
    if (!canvas) return null;
    const width = Number.isFinite(canvas.clientWidth) && canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width;
    const height = Number.isFinite(canvas.clientHeight) && canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height;
    if (width <= 0 || height <= 0) return null;
    const pngDataUrl = canvas.toDataURL("image/png");
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `  <image href="${pngDataUrl}" width="${width}" height="${height}" />`,
      `</svg>`,
      "",
    ].join("\n");
  };

  const savePreviewPdf = async () => {
    setPdfContextMenu(null);
    if (!pdfData) return;
    try {
      await saveBytesWithDialog(pdfData.slice(), "pdf", "PDF");
    } catch (err) {
      setError(`Failed to save PDF: ${extractErrorMessage(err)}`);
    }
  };

  const savePreviewPng = async () => {
    setPdfContextMenu(null);
    const canvas = pdfCanvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas, "image/png");
      if (!blob) {
        setError("Failed to render PNG snapshot from preview canvas.");
        return;
      }
      await saveBytesWithDialog(new Uint8Array(await blob.arrayBuffer()), "png", "PNG");
    } catch (err) {
      setError(`Failed to save PNG: ${extractErrorMessage(err)}`);
    }
  };

  const savePreviewSvg = async () => {
    setPdfContextMenu(null);
    try {
      const svg = buildSvgSnapshotFromCanvas();
      if (!svg) {
        setError("Failed to render SVG snapshot from preview canvas.");
        return;
      }
      await saveTextWithDialog(svg, "svg", "SVG");
    } catch (err) {
      setError(`Failed to save SVG: ${extractErrorMessage(err)}`);
    }
  };

  const savePreviewTex = async () => {
    setPdfContextMenu(null);
    try {
      const source = buildStandaloneSource(tikzCode, optionalPreamble);
      await saveTextWithDialog(source, "tex", "LaTeX");
    } catch (err) {
      setError(`Failed to save LaTeX: ${extractErrorMessage(err)}`);
    }
  };

  const onPdfViewportContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!pdfData) return;
    event.preventDefault();
    setPdfContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const startSplitDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    splitDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAt: event.timeStamp,
      moved: false,
    };
    document.body.classList.add("preview-split-dragging");
    target.setPointerCapture(event.pointerId);
  };

  const moveSplitDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = splitDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const body = bodyRef.current;
    if (!body) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (!drag.moved && absDx < SPLIT_DRAG_THRESHOLD_PX) return;
    if (!drag.moved && absDx <= absDy) return;
    if (!drag.moved && event.timeStamp - drag.startAt < SPLIT_DRAG_FAST_CLICK_MS && absDx < SPLIT_DRAG_FAST_CLICK_THRESHOLD_PX) {
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
    }

    const rect = body.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = event.clientX - rect.left;
    const rawPdfRatio = x / rect.width;
    const clampedPdfRatio = clamp(rawPdfRatio, 0.25, 0.75);
    setCodePaneRatio(1 - clampedPdfRatio);
  };

  const endSplitDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = splitDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const target = event.currentTarget;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    splitDragRef.current = null;
    document.body.classList.remove("preview-split-dragging");
  };

  const onPdfViewportWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const zoomStep = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    setPdfZoom((prev) => clamp(prev * zoomStep, MIN_PDF_ZOOM, MAX_PDF_ZOOM));
  };

  const onPdfViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    const viewport = event.currentTarget;
    if (!viewport.hasPointerCapture(event.pointerId)) {
      viewport.setPointerCapture(event.pointerId);
    }
    const pinch = pinchRef.current;
    pinch.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.points.size === 2) {
      const [first, second] = Array.from(pinch.points.values());
      pinch.startDistance = distanceBetween(first, second);
      pinch.startZoom = pdfZoomRef.current;
    }
  };

  const onPdfViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    const pinch = pinchRef.current;
    if (!pinch.points.has(event.pointerId)) return;

    pinch.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.points.size < 2 || pinch.startDistance <= 0) return;

    const [first, second] = Array.from(pinch.points.values());
    const distance = distanceBetween(first, second);
    if (distance <= 0) return;
    event.preventDefault();
    setPdfZoom(clamp((pinch.startZoom * distance) / pinch.startDistance, MIN_PDF_ZOOM, MAX_PDF_ZOOM));
  };

  const onPdfViewportPointerUpOrCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    const viewport = event.currentTarget;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    const pinch = pinchRef.current;
    pinch.points.delete(event.pointerId);
    if (pinch.points.size < 2) {
      pinch.startDistance = 0;
      pinch.startZoom = pdfZoomRef.current;
    }
  };

  const onEditorKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoTikzCode();
      } else {
        undoTikzCode();
      }
      return;
    }
    if (key === "y" && !event.shiftKey) {
      event.preventDefault();
      redoTikzCode();
    }
  };

  const selectMatch = (start: number, length: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    editor.setSelectionRange(start, start + length);
  };

  const findNext = (backward = false): boolean => {
    const query = findText;
    if (!query) {
      setFindStatus("Find text is empty.");
      return false;
    }

    const source = tikzCode;
    if (!source) {
      setFindStatus("Nothing to search.");
      return false;
    }

    const editor = editorRef.current;
    const haystack = matchCase ? source : source.toLowerCase();
    const needle = matchCase ? query : query.toLowerCase();

    let index = -1;
    if (backward) {
      const from = editor ? Math.max(0, editor.selectionStart - 1) : source.length - 1;
      index = haystack.lastIndexOf(needle, from);
      if (index < 0) index = haystack.lastIndexOf(needle);
    } else {
      const from = editor ? editor.selectionEnd : 0;
      index = haystack.indexOf(needle, from);
      if (index < 0) index = haystack.indexOf(needle);
    }

    if (index < 0) {
      setFindStatus("No matches.");
      return false;
    }

    selectMatch(index, query.length);
    setFindStatus(`Match at index ${index + 1}.`);
    return true;
  };

  const selectionMatchesFind = (selectedText: string): boolean =>
    matchCase ? selectedText === findText : selectedText.toLowerCase() === findText.toLowerCase();

  const replaceCurrent = () => {
    if (!findText) {
      setFindStatus("Find text is empty.");
      return;
    }
    const editor = editorRef.current;
    if (!editor) {
      setFindStatus("Editor not available.");
      return;
    }
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = tikzCode.slice(start, end);

    if (!selectionMatchesFind(selected)) {
      if (!findNext(false)) return;
      const nextStart = editor.selectionStart;
      const nextEnd = editor.selectionEnd;
      const nextSelected = tikzCode.slice(nextStart, nextEnd);
      if (!selectionMatchesFind(nextSelected)) {
        setFindStatus("No active match to replace.");
        return;
      }
      const replaced = tikzCode.slice(0, nextStart) + replaceText + tikzCode.slice(nextEnd);
      updateTikzCode(replaced);
      requestAnimationFrame(() => selectMatch(nextStart, replaceText.length));
      setFindStatus("Replaced 1 match.");
      return;
    }

    const replaced = tikzCode.slice(0, start) + replaceText + tikzCode.slice(end);
    updateTikzCode(replaced);
    requestAnimationFrame(() => selectMatch(start, replaceText.length));
    setFindStatus("Replaced 1 match.");
  };

  const replaceAll = () => {
    if (!findText) {
      setFindStatus("Find text is empty.");
      return;
    }
    const pattern = new RegExp(escapeRegExp(findText), matchCase ? "g" : "gi");
    const matches = tikzCode.match(pattern);
    if (!matches || matches.length === 0) {
      setFindStatus("No matches to replace.");
      return;
    }
    updateTikzCode(tikzCode.replace(pattern, replaceText));
    setFindStatus(`Replaced ${matches.length} occurrence${matches.length === 1 ? "" : "s"}.`);
  };

  const expandCompilerLog = Boolean(error) && !pdfData;

  return (
    <div
      className="previewWindowRoot"
      ref={rootRef}
      style={session.uiCssVariables as CSSProperties | undefined}
    >
      <header className="previewWindowHeader">
        <h1 className="previewWindowTitle">TikZ Preview</h1>
        <div className="previewWindowActions">
          <button
            className="actionButton primary"
            onClick={() => void updatePdf()}
            disabled={busy || !isTauriRuntime}
          >
            {busy ? "Updating..." : "Update PDF"}
          </button>
          <button className="actionButton secondary" onClick={() => void copyEditedTikz()}>
            {copied ? "Copied" : "Copy Edited TikZ"}
          </button>
          <button className="actionButton secondary" onClick={() => void savePreviewPdf()} disabled={!pdfData}>
            Save PDF
          </button>
          <button className="actionButton secondary" onClick={() => void savePreviewSvg()} disabled={!pdfData}>
            Save SVG
          </button>
          <button className="actionButton secondary" onClick={() => void savePreviewPng()} disabled={!pdfData}>
            Save PNG
          </button>
          <button className="actionButton secondary" onClick={() => void savePreviewTex()}>
            Save Full LaTeX (.tex)
          </button>
        </div>
      </header>

      <div className="previewWindowBody" ref={bodyRef}>
        <section className="previewPane previewPdfPane" style={{ width: `${(1 - codePaneRatio) * 100}%` }}>
          <div className="sectionTitle">PDF Preview</div>
          {!isTauriRuntime ? (
            <div className="statusText">Run this window inside the desktop app to compile PDF preview.</div>
          ) : null}
          {error ? <div className="errorText">{error}</div> : null}
          {pdfRenderError ? <div className="errorText">{pdfRenderError}</div> : null}
          {pdfData ? (
            <div
              className="pdfPreviewViewport"
              ref={pdfViewportRef}
              onWheel={onPdfViewportWheel}
              onContextMenu={onPdfViewportContextMenu}
              onPointerDown={onPdfViewportPointerDown}
              onPointerMove={onPdfViewportPointerMove}
              onPointerUp={onPdfViewportPointerUpOrCancel}
              onPointerCancel={onPdfViewportPointerUpOrCancel}
            >
              <div className="pdfCanvasSurface">
                <canvas className="pdfPreviewCanvas" ref={pdfCanvasRef} />
              </div>
            </div>
          ) : (
            <div className="exportPreviewEmpty">{busy ? "Compiling PDF..." : "No preview generated yet."}</div>
          )}
          {log ? (
            <details
              className={expandCompilerLog ? "exportLogDetails exportLogDetailsExpanded" : "exportLogDetails"}
              open={Boolean(error)}
            >
              <summary>Compiler log</summary>
              <textarea
                className={
                  expandCompilerLog
                    ? "exportLogText exportLogTextError exportLogTextExpanded"
                    : error
                      ? "exportLogText exportLogTextError"
                      : "exportLogText"
                }
                value={log}
                readOnly
                spellCheck={false}
                rows={expandCompilerLog ? 1 : error ? 12 : 8}
              />
            </details>
          ) : null}
        </section>

        <div
          className="previewSplitHandle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview panes"
          onPointerDown={startSplitDrag}
          onPointerMove={moveSplitDrag}
          onPointerUp={endSplitDrag}
          onPointerCancel={endSplitDrag}
        />

        <section className="previewPane previewCodePane" style={{ width: `${codePaneRatio * 100}%` }}>
          <div className="sectionTitle">TikZ Code</div>
          <div className="previewCodeTools">
            <div className="previewCodeToolTabs" role="tablist" aria-label="TikZ code tools">
              {regen ? (
                <>
                  <button
                    type="button"
                    id="preview-tool-tab-sizing"
                    className={codeToolTab === "sizing" ? "previewCodeToolTab active" : "previewCodeToolTab"}
                    role="tab"
                    aria-selected={codeToolTab === "sizing"}
                    aria-controls="preview-tool-panel-sizing"
                    onClick={() => setCodeToolTab("sizing")}
                  >
                    Figure Sizing
                    <span className="previewCodeToolBadge">Live</span>
                  </button>
                  <button
                    type="button"
                    id="preview-tool-tab-labels"
                    className={codeToolTab === "labels" ? "previewCodeToolTab active" : "previewCodeToolTab"}
                    role="tab"
                    aria-selected={codeToolTab === "labels"}
                    aria-controls="preview-tool-panel-labels"
                    onClick={() => setCodeToolTab("labels")}
                  >
                    Label precision
                  </button>
                </>
              ) : null}
              <button
                type="button"
                id="preview-tool-tab-find"
                className={codeToolTab === "find" ? "previewCodeToolTab active" : "previewCodeToolTab"}
                role="tab"
                aria-selected={codeToolTab === "find"}
                aria-controls="preview-tool-panel-find"
                onClick={() => setCodeToolTab("find")}
              >
                Find &amp; Replace
              </button>
              <button
                type="button"
                id="preview-tool-tab-preamble"
                className={codeToolTab === "preamble" ? "previewCodeToolTab active" : "previewCodeToolTab"}
                role="tab"
                aria-selected={codeToolTab === "preamble"}
                aria-controls="preview-tool-panel-preamble"
                onClick={() => setCodeToolTab("preamble")}
              >
                Preamble
              </button>
            </div>
            {regen && codeToolTab === "labels" ? (
              <div
                id="preview-tool-panel-labels"
                className="previewCodeToolPanel previewLabelPrecision"
                role="tabpanel"
                aria-labelledby="preview-tool-tab-labels"
              >
                <div className="previewLabelPrecisionHeader">
                  <span>Nudge a label by 1 px.</span>
                  <span>Shift-click: 5 px</span>
                </div>
                {precisionLabelTargets.length > 0 ? (
                  <div className="previewLabelPrecisionGrid">
                    {precisionLabelTargets.map((target) => (
                      <PrecisionLabelTile
                        key={target.key}
                        target={target}
                        onNudge={nudgePrecisionLabel}
                        onReset={resetPrecisionLabel}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="previewLabelPrecisionEmpty">No visible labels in this export.</div>
                )}
              </div>
            ) : null}
            {codeToolTab === "preamble" ? (
              <div
                id="preview-tool-panel-preamble"
                className="previewCodeToolPanel"
                role="tabpanel"
                aria-labelledby="preview-tool-tab-preamble"
              >
              <textarea
                className="exportTextarea exportTextareaCompact optionalPreambleEditor"
                value={optionalPreamble}
                onChange={(e) => setOptionalPreamble(e.target.value)}
                placeholder="Example: \\pagecolor{black}"
                spellCheck={false}
              />
              </div>
            ) : null}
            {codeToolTab === "find" ? (
              <div
                id="preview-tool-panel-find"
                className="previewCodeToolPanel findReplacePanel previewFindReplace"
                role="tabpanel"
                aria-labelledby="preview-tool-tab-find"
              >
                <div className="findReplaceRow">
                  <input
                    className="findReplaceInput"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="Find"
                    spellCheck={false}
                  />
                  <input
                    className="findReplaceInput"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Replace"
                    spellCheck={false}
                  />
                </div>
                <div className="findReplaceRow findReplaceControls">
                  <label className="checkboxRow findReplaceCheckbox">
                    <input
                      type="checkbox"
                      checked={matchCase}
                      onChange={(e) => setMatchCase(e.target.checked)}
                    />
                    Match case
                  </label>
                  <button className="actionButton secondary" onClick={() => findNext(true)}>
                    Prev
                  </button>
                  <button className="actionButton secondary" onClick={() => findNext(false)}>
                    Next
                  </button>
                  <button className="actionButton secondary" onClick={replaceCurrent}>
                    Replace
                  </button>
                  <button className="actionButton secondary" onClick={replaceAll}>
                    Replace All
                  </button>
                </div>
                {findStatus ? <div className="statusText">{findStatus}</div> : null}
              </div>
            ) : null}
            {regen && codeToolTab === "sizing" ? (
            <div
              id="preview-tool-panel-sizing"
              className="previewCodeToolPanel previewFigureSizing"
              role="tabpanel"
              aria-labelledby="preview-tool-tab-sizing"
            >
              <div className="previewFigureSizingHeader">
                <div className="previewFigureSizingHint">
                  Scale the complete figure or tune points, lines, and labels independently.
                </div>
                <div className="previewFigureSizingActions">
                  <label className="previewTreatmentControl">
                    <span>Treatment</span>
                    <select
                      className="previewTreatmentSelect"
                      value={figureTreatment}
                      onChange={(event) => {
                        const mode = event.target.value;
                        if (mode === "canvas" || mode === "general" || mode === "veryCloseup") {
                          selectFigureTreatment(mode);
                        }
                      }}
                      title="Choose how strongly points, strokes, labels, halos, and marks are scaled relative to the geometry"
                    >
                      <option value="canvas">Canvas true zoom ({Math.round(canvasTrueZoom * 100)}%)</option>
                      <option value="general">General close-up</option>
                      <option value="veryCloseup">Very close-up</option>
                      {figureTreatment === "custom" ? <option value="custom">Custom</option> : null}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="previewSizingResetButton"
                    onClick={useCanvasCaptureSizing}
                    title="Reset all figure sizing to the captured canvas"
                    aria-label="Reset all figure sizing to the captured canvas"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    className={
                      figureSizingDefaultSaved
                        ? "previewSizingDefaultButton saved"
                        : "previewSizingDefaultButton"
                    }
                    onClick={saveFigureSizingAsDefault}
                    title="Use these figure-sizing and formatting values for future exports"
                  >
                    {figureSizingDefaultSaved ? "Default saved" : "Set as default"}
                  </button>
                </div>
              </div>
              <div className="previewFigureSizingGrid">
                  <label className="previewScaleItem previewScaleItemWide">
                    <IconGlobe size={14} />
                    <span className="previewScaleLabel">Global scale</span>
                    <span className="previewScaleDescription">
                      Final size in your LaTeX document; this standalone preview automatically fits it to the window.
                    </span>
                    <input
                      className="previewScaleInput"
                      type="number"
                      min={0.1}
                      max={6}
                      step={0.05}
                      value={scaleboxScale}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFigureTreatment("custom");
                        setFigureTreatmentFactor(1);
                        setScaleboxScale(v);
                        applyScales({ scalebox: v, trueGlobal: trueGlobalScale, global: globalScale, point: pointScale, line: lineScale, label: labelScale, figureTreatmentFactor: 1 });
                      }}
                      title="Scales the complete figure with a simple LaTeX scalebox"
                    />
                  </label>
                  <label className="previewScaleItem">
                    <IconGlobe size={14} />
                    <span className="previewScaleLabel">TikZ scale</span>
                    <input
                      className="previewScaleInput"
                      type="number"
                      min={0.1}
                      max={6}
                      step={0.05}
                      value={globalScale}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFigureTreatment("custom");
                        setFigureTreatmentFactor(1);
                        setGlobalScale(v);
                        applyScales({ scalebox: scaleboxScale, trueGlobal: trueGlobalScale, global: v, point: pointScale, line: lineScale, label: labelScale, figureTreatmentFactor: 1 });
                      }}
                      aria-describedby="preview-tikz-scale-help"
                    />
                    <span id="preview-tikz-scale-help" className="previewScaleTooltip" role="tooltip">
                      Changes TikZ coordinate spacing and figure extent. Point, line, and label sizes remain independently adjustable.
                    </span>
                  </label>
                  <label className="previewScaleItem">
                    <IconPoint size={14} />
                    <span className="previewScaleLabel">Points</span>
                    <input
                      className="previewScaleInput"
                      type="number"
                      min={0.1}
                      max={4}
                      step={0.05}
                      value={pointScale}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPointScale(v);
                        applyScales({ scalebox: scaleboxScale, trueGlobal: trueGlobalScale, global: globalScale, point: v, line: lineScale, label: labelScale });
                      }}
                    />
                  </label>
                  <label className="previewScaleItem">
                    <IconLine size={14} />
                    <span className="previewScaleLabel">Lines</span>
                    <input
                      className="previewScaleInput"
                      type="number"
                      min={0.1}
                      max={4}
                      step={0.05}
                      value={lineScale}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLineScale(v);
                        applyScales({ scalebox: scaleboxScale, trueGlobal: trueGlobalScale, global: globalScale, point: pointScale, line: v, label: labelScale });
                      }}
                    />
                  </label>
                  <label className="previewScaleItem">
                    <IconType size={14} />
                    <span className="previewScaleLabel">Labels</span>
                    <input
                      className="previewScaleInput"
                      type="number"
                      min={0.1}
                      max={4}
                      step={0.05}
                      value={labelScale}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLabelScale(v);
                        applyScales({ scalebox: scaleboxScale, trueGlobal: trueGlobalScale, global: globalScale, point: pointScale, line: lineScale, label: v });
                      }}
                    />
                  </label>
                  <label className="previewScaleItem">
                    <IconType size={14} />
                    <span className="previewScaleLabel">Halo spread</span>
                    <input
                      className="previewScaleInput"
                      type="number"
                      min={0.1}
                      max={4}
                      step={0.05}
                      value={labelHaloScale}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLabelHaloScale(v);
                        applyScales({ labelHalo: v });
                      }}
                      title="Multiplies the contour spread behind every label"
                    />
                  </label>
                  <div className="previewSizingOptions">
                    <label className="checkboxRow previewSizingCheckbox">
                      <input
                        type="checkbox"
                        checked={roundNumbersToTwoDecimals}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          const nextScalebox = formatPreviewScale(scaleboxScale, enabled);
                          const nextTrueGlobal = formatPreviewScale(trueGlobalScale, enabled);
                          const nextGlobal = formatPreviewScale(globalScale, enabled);
                          const nextPoint = formatPreviewScale(pointScale, enabled);
                          const nextLine = formatPreviewScale(lineScale, enabled);
                          const nextLabel = formatPreviewScale(labelScale, enabled);
                          const nextHalo = formatPreviewScale(labelHaloScale, enabled);
                          setRoundNumbersToTwoDecimals(enabled);
                          setScaleboxScale(nextScalebox);
                          setTrueGlobalScale(nextTrueGlobal);
                          setGlobalScale(nextGlobal);
                          setPointScale(nextPoint);
                          setLineScale(nextLine);
                          setLabelScale(nextLabel);
                          setLabelHaloScale(nextHalo);
                          applyScales({
                            scalebox: nextScalebox,
                            trueGlobal: nextTrueGlobal,
                            global: nextGlobal,
                            point: nextPoint,
                            line: nextLine,
                            label: nextLabel,
                            labelHalo: nextHalo,
                            twoDecimals: enabled,
                          });
                        }}
                      />
                      Two decimal places
                    </label>
                    <label className="checkboxRow previewSizingCheckbox">
                      <input
                        type="checkbox"
                        checked={preferDvipsNames}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setPreferDvipsNames(enabled);
                          applyScales({ dvipsNames: enabled });
                        }}
                      />
                      xcolor/dvipsnames only
                    </label>
                  </div>
                  <details className="previewAdvancedScale">
                    <summary>Advanced transform scale</summary>
                    <label className="previewScaleItem previewScaleItemWide">
                      <IconGlobe size={14} />
                      <span className="previewScaleLabel">Transform shape</span>
                      <input
                        className="previewScaleInput"
                        type="number"
                        min={0.1}
                        max={6}
                        step={0.05}
                        value={trueGlobalScale}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTrueGlobalScale(v);
                          applyScales({ scalebox: scaleboxScale, trueGlobal: v, global: globalScale, point: pointScale, line: lineScale, label: labelScale });
                        }}
                        title="Advanced TikZ scale with transform shape and explicit stroke and mark corrections"
                      />
                    </label>
                  </details>
                </div>
            </div>
            ) : null}
          </div>
          <textarea
            ref={editorRef}
            className="exportTextarea previewEditorArea"
            value={tikzCode}
            onChange={(e) => updateTikzCode(e.target.value)}
            onKeyDown={onEditorKeyDown}
            spellCheck={false}
          />
        </section>
      </div>
      {pdfContextMenu ? (
        <div
          ref={pdfContextMenuRef}
          className="pdfPreviewContextMenu"
          style={clampContextMenuPosition(pdfContextMenu, rootRef.current)}
          role="menu"
          aria-label="Save preview"
        >
          <button className="pdfPreviewContextMenuItem" role="menuitem" onClick={() => void savePreviewPdf()}>
            Save as PDF
          </button>
          <button className="pdfPreviewContextMenuItem" role="menuitem" onClick={() => void savePreviewSvg()}>
            Save as SVG
          </button>
          <button className="pdfPreviewContextMenuItem" role="menuitem" onClick={() => void savePreviewPng()}>
            Save as PNG
          </button>
          <button className="pdfPreviewContextMenuItem" role="menuitem" onClick={() => void savePreviewTex()}>
            Save as Full LaTeX (.tex)
          </button>
        </div>
      ) : null}
    </div>
  );
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "Failed to compile preview.";
}

function normalizePreviewError(message: string): { display: string; log?: string } {
  const text = message.trim();
  if (!text) return { display: "Failed to compile preview." };

  const lowered = text.toLowerCase();
  const looksLikeCompileLog =
    lowered.includes("tex compilation failed") ||
    lowered.includes("compilation did not produce a pdf") ||
    lowered.includes("$ latexmk") ||
    lowered.includes("$ pdflatex") ||
    lowered.includes("latexmk");
  if (looksLikeCompileLog) {
    return {
      display: "TeX compilation failed. See Compiler log below.",
      log: text,
    };
  }
  return { display: text };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type);
  });
}

function clampContextMenuPosition(
  position: { x: number; y: number },
  root: HTMLDivElement | null
): CSSProperties {
  const MENU_WIDTH = 170;
  const MENU_HEIGHT = 170;
  const PADDING = 10;
  const bounds = root?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };

  const maxX = Math.max(bounds.left + PADDING, bounds.right - MENU_WIDTH - PADDING);
  const maxY = Math.max(bounds.top + PADDING, bounds.bottom - MENU_HEIGHT - PADDING);
  const x = Math.min(Math.max(position.x, bounds.left + PADDING), maxX);
  const y = Math.min(Math.max(position.y, bounds.top + PADDING), maxY);

  return {
    left: x,
    top: y,
  };
}

function isEventInsidePdfViewport(event: Event, viewport: HTMLDivElement | null): boolean {
  if (!viewport) return false;
  if (viewport.matches(":hover")) return true;

  const target = event.target;
  if (target instanceof Node && viewport.contains(target)) return true;

  const mouseEvent = event as Event & { clientX?: number; clientY?: number };
  if (typeof mouseEvent.clientX === "number" && typeof mouseEvent.clientY === "number") {
    const hit = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY);
    if (hit && viewport.contains(hit)) return true;
  }
  return false;
}

function waitNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function distanceBetween(first: { x: number; y: number }, second: { x: number; y: number }): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
