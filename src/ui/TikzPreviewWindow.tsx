import { invoke } from "@tauri-apps/api/core";
import { save as tauriSave } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
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
import { loadTikzPreviewSession } from "./tikzPreviewSession";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type TikzPreviewWindowProps = {
  token: string;
};

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

const REQUIRED_PREAMBLE = `\\documentclass[tikz,border=2pt]{standalone}
\\usepackage{tkz-euclide}
\\usepackage{xfp}
\\usetikzlibrary{arrows.meta,bending,decorations.markings,patterns,patterns.meta,shapes.geometric}`;

export function TikzPreviewWindow({ token }: TikzPreviewWindowProps) {
  const session = useMemo(() => loadTikzPreviewSession(token), [token]);
  const isTauriRuntime = useMemo(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object),
    []
  );
  const [tikzCode, setTikzCode] = useState(session?.tikzPicture ?? "\\begin{tikzpicture}\n\\end{tikzpicture}");
  const [optionalPreamble, setOptionalPreamble] = useState("");
  const [optionalPreambleOpen, setOptionalPreambleOpen] = useState(false);
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

  useEffect(() => {
    const nextTikz = session?.tikzPicture ?? "\\begin{tikzpicture}\n\\end{tikzpicture}";
    updateTikzCode(nextTikz, {
      trackHistory: false,
      resetHistory: true,
    });
    const defaultPreamble = deriveDefaultOptionalPreamble(session?.uiCssVariables);
    setOptionalPreamble(defaultPreamble);
    setOptionalPreambleOpen(Boolean(defaultPreamble));
    if (session) {
      void compilePdf(nextTikz, defaultPreamble);
    }
  }, [session, updateTikzCode, compilePdf]);

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
      const loadingTask = getDocument({
        data: pdfData,
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

  const defaultPreviewFileName = (extension: "pdf" | "png" | "svg"): string => {
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
    URL.revokeObjectURL(url);
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
      await writeFile(normalizeTauriPath(path), bytes);
      return;
    }
    const mime = extension === "pdf" ? "application/pdf" : "image/png";
    downloadBlob(new Blob([bytes], { type: mime }), defaultPreviewFileName(extension));
  };

  const saveTextWithDialog = async (text: string, extension: "svg", filterName: "SVG") => {
    if (isTauriRuntime) {
      const path = await tauriSave({
        defaultPath: defaultPreviewFileName(extension),
        filters: [{ name: filterName, extensions: [extension] }],
      });
      if (!path) return;
      await writeTextFile(normalizeTauriPath(path), text);
      return;
    }
    downloadBlob(new Blob([text], { type: "image/svg+xml;charset=utf-8" }), defaultPreviewFileName(extension));
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
      await saveBytesWithDialog(pdfData, "pdf", "PDF");
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

  if (!session) {
    return (
      <div className="previewWindowRoot">
        <header className="previewWindowHeader">
          <h1 className="previewWindowTitle">TikZ Preview</h1>
        </header>
        <div className="previewWindowMissing">
          Preview session not found. Open this window from the main Export panel again.
        </div>
      </div>
    );
  }

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
          <div className="optionalPreambleSection">
            <button
              type="button"
              className="optionalPreambleToggle"
              onClick={() => setOptionalPreambleOpen((prev) => !prev)}
              aria-expanded={optionalPreambleOpen}
            >
              <span className={optionalPreambleOpen ? "optionalPreambleChevron open" : "optionalPreambleChevron"}>
                {">"}
              </span>
              Optional Preamble
            </button>
            {optionalPreambleOpen ? (
              <textarea
                className="exportTextarea exportTextareaCompact optionalPreambleEditor"
                value={optionalPreamble}
                onChange={(e) => setOptionalPreamble(e.target.value)}
                placeholder="Example: \\pagecolor{black}"
                spellCheck={false}
              />
            ) : null}
          </div>
          <div className="findReplacePanel previewFindReplace">
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
        </div>
      ) : null}
    </div>
  );
}

function buildStandaloneSource(tikzCode: string, optionalPreamble: string): string {
  const trimmed = tikzCode.trim();
  if (looksLikeFullDocument(trimmed)) return tikzCode;
  const extra = optionalPreamble.trim();
  const preamble = extra ? `${REQUIRED_PREAMBLE}\n${extra}` : REQUIRED_PREAMBLE;
  return `${preamble}\n\\begin{document}\n${tikzCode}\n\\end{document}\n`;
}

function deriveDefaultOptionalPreamble(uiCssVariables: Record<string, string> | undefined): string {
  const normalizedHex = normalizeSceneBgHex(uiCssVariables?.["--gd-scene-bg"]);
  if (!normalizedHex || normalizedHex === "FFFFFF") return "";
  return `\\pagecolor[HTML]{${normalizedHex}}`;
}

function normalizeSceneBgHex(rawColor: string | undefined): string | null {
  if (!rawColor) return null;
  const trimmed = rawColor.trim();
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u.exec(trimmed);
  if (!match) return null;
  const hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .slice(0, 3)
      .split("")
      .map((ch) => ch + ch)
      .join("");
    return expanded.toUpperCase();
  }
  if (hex.length === 8) {
    return hex.slice(0, 6).toUpperCase();
  }
  return hex.toUpperCase();
}

function looksLikeFullDocument(text: string): boolean {
  return /\\documentclass\b/.test(text) || /\\begin\{document\}/.test(text);
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
  const MENU_HEIGHT = 118;
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
