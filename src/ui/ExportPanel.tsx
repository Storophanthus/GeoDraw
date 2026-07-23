import { useEffect, useMemo, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { exportConstructionSnapshot, exportConstructionSnapshotWithWorld } from "../export/constructionSnapshot";
import { exportTikzEfficientWithOptions, exportTikzWithOptions } from "../export/tikz";
import { getPointInnerSepFixedPt, TIKZ_EXPORT_CALIBRATION } from "../export/tikz/calibration";
import { buildStandaloneSource, deriveDefaultOptionalPreamble } from "../export/tikz/standaloneDocument";
import { getCanvasColorTheme, getUiCssVariables } from "../state/colorProfiles";
import { loadStoredExportPreferences, saveStoredExportPreferences } from "../state/appPreferences";
import type { SceneModel } from "../scene/points";
import { useGeoStore } from "../state/geoStore";
import type { Camera } from "../view/camera";
import { createTikzPreviewSession } from "./tikzPreviewSession";
import { IconGlobe, IconPoint, IconLine, IconType } from "./icons";
import { Crop, Scissors } from "lucide-react";
import "./ExportPanel.css";

type ExportPanelProps = {
  visible: boolean;
};

type TikzExportMode = "visualExact" | "reconstructible";

type CanvasViewportSize = {
  widthPx: number;
  heightPx: number;
};

export function ExportPanel({ visible }: ExportPanelProps) {
  const scene = useGeoStore((store) => store.scene);
  const camera = useGeoStore((store) => store.camera);
  const exportClipWorld = useGeoStore((store) => store.exportClipWorld);
  const clearExportClipWorld = useGeoStore((store) => store.clearExportClipWorld);
  const activeTool = useGeoStore((store) => store.activeTool);
  const setActiveTool = useGeoStore((store) => store.setActiveTool);
  const uiColorProfileId = useGeoStore((store) => store.uiColorProfileId);
  const colorProfileId = useGeoStore((store) => store.colorProfileId);
  const uiCssOverrides = useGeoStore((store) => store.uiCssOverrides);
  const canvasThemeOverrides = useGeoStore((store) => store.canvasThemeOverrides);

  const [tikzText, setTikzText] = useState("");
  const [tikzCopied, setTikzCopied] = useState(false);
  const [fullDocumentCopied, setFullDocumentCopied] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonCopied, setJsonCopied] = useState(false);
  const [includeWorldInJson, setIncludeWorldInJson] = useState(false);
  const [exportUseCurrentView, setExportUseCurrentView] = useState(() => loadStoredExportPreferences().useCurrentView);
  const [exportUseClipSelection, setExportUseClipSelection] = useState(false);
  const [exportEfficient, setExportEfficient] = useState(() => loadStoredExportPreferences().compactCode);
  const [exportEmitTkzSetupManual, setExportEmitTkzSetupManual] = useState<boolean | null>(() => {
    const mode = loadStoredExportPreferences().emitTkzSetup;
    return mode === "auto" ? null : mode === "on";
  });
  const [exportLabelGlow, setExportLabelGlow] = useState(() => loadStoredExportPreferences().labelGlow);
  const [tikzExportMode, setTikzExportMode] = useState<TikzExportMode>(() => loadStoredExportPreferences().tikzExportMode);
  const [exportGlobalScale, setExportGlobalScale] = useState(() => loadStoredExportPreferences().globalScale);
  const [exportPointScale, setExportPointScale] = useState(() => loadStoredExportPreferences().pointScale);
  const [exportLineScale, setExportLineScale] = useState(() => loadStoredExportPreferences().lineScale);
  const [exportLabelScale, setExportLabelScale] = useState(() => loadStoredExportPreferences().labelScale);
  const [lastTikzSceneRef, setLastTikzSceneRef] = useState<SceneModel | null>(null);
  const [lastTikzOptionSig, setLastTikzOptionSig] = useState("");
  const [lastTikzGeneratedAt, setLastTikzGeneratedAt] = useState<number | null>(null);
  const [canvasViewportSize, setCanvasViewportSize] = useState<CanvasViewportSize | null>(
    () => readDrawingCanvasSize()
  );
  const isTauriRuntime = useMemo(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object),
    []
  );
  const canvasTheme = useMemo(
    () => getCanvasColorTheme(colorProfileId, canvasThemeOverrides),
    [colorProfileId, canvasThemeOverrides]
  );
  const uiCssVariables = useMemo(() => {
    const uiVars = getUiCssVariables(uiColorProfileId, uiCssOverrides);
    return {
      ...uiVars,
      "--gd-scene-bg": canvasTheme.backgroundColor,
    };
  }, [uiColorProfileId, uiCssOverrides, canvasTheme.backgroundColor]);
  const hasVisibleLineObject = useMemo(
    () => scene.lines.some((line) => line.visible),
    [scene.lines]
  );
  const exportBakeCoordinates = tikzExportMode === "visualExact";
  const exportEmitTkzSetup = exportBakeCoordinates ? false : (exportEmitTkzSetupManual ?? hasVisibleLineObject);
  const exportDrawLayerBackend = exportBakeCoordinates ? "plain" : "tkz";

  useEffect(() => {
    saveStoredExportPreferences({
      useCurrentView: exportUseCurrentView,
      compactCode: exportEfficient,
      emitTkzSetup: exportEmitTkzSetupManual === null ? "auto" : exportEmitTkzSetupManual ? "on" : "off",
      labelGlow: exportLabelGlow,
      tikzExportMode,
      globalScale: exportGlobalScale,
      pointScale: exportPointScale,
      lineScale: exportLineScale,
      labelScale: exportLabelScale,
    });
  }, [
    exportUseCurrentView,
    exportEfficient,
    exportEmitTkzSetupManual,
    exportLabelGlow,
    tikzExportMode,
    exportGlobalScale,
    exportPointScale,
    exportLineScale,
    exportLabelScale,
  ]);

  // Drawing a clip area is a deliberate act, so honour it right away instead of
  // making the user find a second checkbox. Clearing the area turns it back off.
  useEffect(() => {
    setExportUseClipSelection(Boolean(exportClipWorld));
  }, [exportClipWorld]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const canvas = document.querySelector<HTMLCanvasElement>(".drawingCanvas");
    if (!canvas) return;

    const updateCanvasViewportSize = () => {
      const next = readDrawingCanvasSize(canvas);
      if (!next) return;
      setCanvasViewportSize((previous) =>
        previous?.widthPx === next.widthPx && previous.heightPx === next.heightPx
          ? previous
          : next
      );
    };

    updateCanvasViewportSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateCanvasViewportSize);
      return () => window.removeEventListener("resize", updateCanvasViewportSize);
    }

    const resizeObserver = new ResizeObserver(updateCanvasViewportSize);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  const clipToolActive = activeTool === "export_clip_rect" || activeTool === "export_clip";

  const clipSig = exportClipWorld
    ? exportClipWorld.kind === "rect"
      ? `rect:${exportClipWorld.xmin},${exportClipWorld.xmax},${exportClipWorld.ymin},${exportClipWorld.ymax}`
      : `poly:${exportClipWorld.points.map((p) => `${p.x},${p.y}`).join(";")}`
    : "none";
  const canvasViewportSig = exportBakeCoordinates
    ? canvasViewportSize
      ? `${canvasViewportSize.widthPx}x${canvasViewportSize.heightPx}`
      : "canvas-unavailable"
    : "reconstructible-legacy-viewport";
  const tikzOptionSigForCanvas = (canvasSig: string) =>
    `${exportUseCurrentView}|${exportUseClipSelection}|${exportEfficient}|${exportEmitTkzSetup}|${exportLabelGlow}|${tikzExportMode}|${exportGlobalScale}|${exportPointScale}|${exportLineScale}|${exportLabelScale}|${camera.pos.x}|${camera.pos.y}|${camera.zoom}|${canvasSig}|${exportBakeCoordinates ? canvasTheme.backgroundColor : "reconstructible-label-halo"}|${clipSig}`;
  const currentTikzOptionSig = tikzOptionSigForCanvas(canvasViewportSig);
  const tikzOutdated = Boolean(tikzText) && (lastTikzSceneRef !== scene || lastTikzOptionSig !== currentTikzOptionSig);
  const tikzStatusText = useMemo(
    () =>
      !tikzText
        ? "Not generated yet."
        : tikzOutdated
          ? "Outdated: scene/options changed."
          : `Up to date${lastTikzGeneratedAt ? ` · Generated ${new Date(lastTikzGeneratedAt).toLocaleTimeString()}` : ""}`,
    [lastTikzGeneratedAt, tikzOutdated, tikzText]
  );

  const buildTikzExport = (): { text: string; optionSig: string } => {
    const pointScale = Number(exportPointScale);
    const lineScale = Number(exportLineScale);
    const labelScale = Number(exportLabelScale);
    const globalScale = Number(exportGlobalScale);
    const exportCanvasViewportSize = exportBakeCoordinates
      ? readDrawingCanvasSize() ?? canvasViewportSize
      : null;
    if (
      exportCanvasViewportSize &&
      (
        canvasViewportSize?.widthPx !== exportCanvasViewportSize.widthPx ||
        canvasViewportSize.heightPx !== exportCanvasViewportSize.heightPx
      )
    ) {
      setCanvasViewportSize(exportCanvasViewportSize);
    }
    const optionSig = exportBakeCoordinates
      ? tikzOptionSigForCanvas(
          exportCanvasViewportSize
            ? `${exportCanvasViewportSize.widthPx}x${exportCanvasViewportSize.heightPx}`
            : "canvas-unavailable"
        )
      : currentTikzOptionSig;
    const viewport = exportUseCurrentView
      ? exportBakeCoordinates
        ? exportCanvasViewportSize
          ? getViewportFromCanvas(camera, exportCanvasViewportSize)
          : undefined
        : getLegacyViewportFromCanvasPane(camera)
      : undefined;
    const clipRect =
      exportUseClipSelection && exportClipWorld?.kind === "rect" ? exportClipWorld : undefined;
    const clipPolygon =
      exportUseClipSelection && exportClipWorld?.kind === "polygon" ? exportClipWorld.points : undefined;
    const useCanvasExactMetrics = exportDrawLayerBackend === "plain";
    const tikzOptions = {
      viewport,
      clipRectWorld: clipRect,
      clipPolygonWorld: clipPolygon,
      worldToTikzScale: Number.isFinite(globalScale) ? globalScale : 1,
      pointScale: Number.isFinite(pointScale) ? pointScale : 1,
      lineScale:
        (Number.isFinite(lineScale) ? lineScale : 1) *
        (useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.uiLineScaleToExporter),
      labelScale: Number.isFinite(labelScale) ? labelScale : 1,
      screenPxPerWorld: camera.zoom,
      emitTkzSetup: exportEmitTkzSetup,
      drawLayerBackend: exportDrawLayerBackend,
      labelGlow: exportLabelGlow,
      labelHaloColor: useCanvasExactMetrics ? canvasTheme.backgroundColor : undefined,
      bakePointCoordinates: exportBakeCoordinates,
      pointStrokeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pointStrokeScale,
      pointInnerSepFixedPt: useCanvasExactMetrics ? undefined : getPointInnerSepFixedPt(),
      pointInnerSepScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pointInnerSepScale,
      segmentMarkSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkSizeScale,
      segmentMarkRoundSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkRoundSizeScale,
      segmentMarkNonRoundSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkNonRoundSizeScale,
      segmentMarkLineWidthScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.segmentMarkLineWidthScale,
      pathDotMarkSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.pathDotMarkSizeScale,
      angleLabelFontScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleLabelFontScale,
      angleArcSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleArcSizeScale,
      angleMarkSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.angleMarkSizeScale,
      rightAngleSizeScale: useCanvasExactMetrics ? 1 : TIKZ_EXPORT_CALIBRATION.rightAngleSizeScale,
      autoScaleToFitCm: {
        maxWidthCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxWidthCm,
        maxHeightCm: TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm.maxHeightCm,
      },
    } as const;
    const text = exportEfficient ? exportTikzEfficientWithOptions(scene, tikzOptions) : exportTikzWithOptions(scene, tikzOptions);
    return { text, optionSig };
  };

  const generateTikz = (): string | null => {
    try {
      const { text, optionSig } = buildTikzExport();
      setTikzText(text);
      setLastTikzSceneRef(scene);
      setLastTikzOptionSig(optionSig);
      setLastTikzGeneratedAt(Date.now());
      setTikzCopied(false);
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown exporter error";
      setTikzText(`% Export failed: ${message}`);
      setTikzCopied(false);
      return null;
    }
  };

  const ensureTikzText = (): string | null => (!tikzText || tikzOutdated ? generateTikz() : tikzText);

  const copyCode = async () => {
    const text = ensureTikzText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setTikzCopied(true);
      window.setTimeout(() => setTikzCopied(false), 1200);
    } catch {
      setTikzCopied(false);
    }
  };

  const copyFullDocument = async () => {
    const text = ensureTikzText();
    if (!text) return;
    const fullDocument = buildStandaloneSource(text, deriveDefaultOptionalPreamble(text, uiCssVariables));
    try {
      await navigator.clipboard.writeText(fullDocument);
      setFullDocumentCopied(true);
      window.setTimeout(() => setFullDocumentCopied(false), 1200);
    } catch {
      setFullDocumentCopied(false);
    }
  };

  const openPreviewWindow = () => {
    try {
      const text = ensureTikzText();
      if (!text) return;

      const token = createTikzPreviewSession(text, uiCssVariables);
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set("tikzPreview", token);
      if (isTauriRuntime) {
        const label = `tikz-preview-${token}`;
        const previewWindow = new WebviewWindow(label, {
          url: url.toString(),
          title: "TikZ Preview",
          width: 1500,
          height: 920,
          minWidth: 980,
          minHeight: 640,
          resizable: true,
          center: true,
        });
        previewWindow.once("tauri://error", (event) => {
          const payload = String(event.payload ?? "Unknown error");
          alert(`Failed to open preview window: ${payload}`);
        });
        return;
      }
      const popup = window.open(url.toString(), "_blank", "noopener,noreferrer");
      if (!popup) {
        alert("Failed to open preview window.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown exporter error";
      setTikzText(`% Export failed: ${message}`);
      setTikzCopied(false);
    }
  };

  const generateConstructionSnapshot = () => {
    try {
      setJsonText(includeWorldInJson ? exportConstructionSnapshotWithWorld(scene) : exportConstructionSnapshot(scene));
      setJsonCopied(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown snapshot exporter error";
      setJsonText(`{ "error": ${JSON.stringify(message)} }`);
      setJsonCopied(false);
    }
  };

  const copyJson = async () => {
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1200);
    } catch {
      setJsonCopied(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <section className="sidebarSection">
        <div className="sectionHeaderRow">
          <h2 className="sectionTitle">Export</h2>
          {isTauriRuntime && (
            <button
              type="button"
              className="exportHeaderButton"
              onClick={openPreviewWindow}
              title="Compile this figure and open it as a PDF"
            >
              Open PDF
            </button>
          )}
        </div>

        <div className="optionsBlock">
          <label className="checkboxRow" title="Crop to the current canvas view. Turn off to include every object.">
            <input
              type="checkbox"
              checked={exportUseCurrentView}
              onChange={(e) => setExportUseCurrentView(e.target.checked)}
            />
            Export what I see now
          </label>
          <label
            className="checkboxRow"
            title="Adds a background-colored outline so labels stay readable where they cross lines."
          >
            <input
              type="checkbox"
              checked={exportLabelGlow}
              onChange={(e) => setExportLabelGlow(e.target.checked)}
            />
            Halo behind labels
          </label>
        </div>

        <div className={clipToolActive ? "clipBlock clipBlockArmed" : "clipBlock"}>
          <div className="clipBlockHeader">
            <span className="subSectionTitle">Crop area</span>
            {(clipToolActive || exportClipWorld) && (
              <span className="clipBlockActions">
                {clipToolActive ? (
                  <button
                    type="button"
                    className="exportRefreshButton"
                    onClick={() => setActiveTool("move")}
                    title="Stop drawing and go back to the move tool"
                  >
                    Done
                  </button>
                ) : (
                  exportClipWorld && (
                    <button
                      type="button"
                      className="exportRefreshButton"
                      onClick={() =>
                        setActiveTool(exportClipWorld.kind === "polygon" ? "export_clip" : "export_clip_rect")
                      }
                      title="Draw the crop area again"
                    >
                      Redraw
                    </button>
                  )
                )}
                {exportClipWorld && (
                  <button
                    type="button"
                    className="exportRefreshButton"
                    onClick={clearExportClipWorld}
                    title="Clear crop area — export the whole figure again"
                  >
                    Clear
                  </button>
                )}
              </span>
            )}
          </div>

          {exportClipWorld ? (
            <>
              <label
                className="checkboxRow"
                title="Uncheck to export the whole figure without losing the area you drew."
              >
                <input
                  type="checkbox"
                  checked={exportUseClipSelection}
                  onChange={(e) => setExportUseClipSelection(e.target.checked)}
                />
                Export only the {exportClipWorld.kind === "polygon" ? "shape" : "box"} I drew
              </label>
              {!clipToolActive && (
                <div className="clipBlockHint">
                  Drag the square handles on the canvas to adjust it.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="clipBlockHint">Export just one part of the figure — draw the area on the canvas.</div>
              <div className="clipToolRow">
                <button
                  type="button"
                  className={activeTool === "export_clip_rect" ? "clipToolButton active" : "clipToolButton"}
                  onClick={() => setActiveTool("export_clip_rect")}
                  title="Click two opposite corners on the canvas"
                >
                  <Crop size={14} />
                  Box
                </button>
                <button
                  type="button"
                  className={activeTool === "export_clip" ? "clipToolButton active" : "clipToolButton"}
                  onClick={() => setActiveTool("export_clip")}
                  title="Click each corner on the canvas, then click the first one again to close"
                >
                  <Scissors size={14} />
                  Freeform
                </button>
              </div>
            </>
          )}

          {clipToolActive && (
            <div className="clipBlockStep">
              {/* The tool stays armed after a box is committed, so once one exists the
                  next set of clicks replaces it — say so instead of repeating "now click". */}
              {exportClipWorld ? "To replace this area, click" : "Now click"}{" "}
              {activeTool === "export_clip_rect"
                ? "two opposite corners on the canvas."
                : "each corner on the canvas, then click the first one again to close."}
            </div>
          )}
        </div>

        <div className="scaleBlock">
          <div className="subSectionTitle">Figure sizing</div>
          <div className="compactScaleGrid">
            <div className="scaleGridItem">
              <div className="scaleGridIcon">
                <IconGlobe size={14} />
              </div>
              <span className="scaleGridLabel">Global</span>
              <input
                className="scaleGridInput"
                type="number"
                min={0.1}
                max={6}
                step={0.05}
                value={exportGlobalScale}
                onChange={(e) => setExportGlobalScale(e.target.value)}
                title="Multiplies every size in the exported figure"
              />
            </div>
            <div className="scaleGridItem">
              <div className="scaleGridIcon">
                <IconPoint size={14} />
              </div>
              <span className="scaleGridLabel">Points</span>
              <input
                className="scaleGridInput"
                type="number"
                min={0.1}
                max={4}
                step={0.05}
                value={exportPointScale}
                onChange={(e) => setExportPointScale(e.target.value)}
                title="Multiplies point marker size"
              />
            </div>
            <div className="scaleGridItem">
              <div className="scaleGridIcon">
                <IconLine size={14} />
              </div>
              <span className="scaleGridLabel">Lines</span>
              <input
                className="scaleGridInput"
                type="number"
                min={0.1}
                max={4}
                step={0.05}
                value={exportLineScale}
                onChange={(e) => setExportLineScale(e.target.value)}
                title="Multiplies line and segment thickness"
              />
            </div>
            <div className="scaleGridItem">
              <div className="scaleGridIcon">
                <IconType size={14} />
              </div>
              <span className="scaleGridLabel">Labels</span>
              <input
                className="scaleGridInput"
                type="number"
                min={0.1}
                max={4}
                step={0.05}
                value={exportLabelScale}
                onChange={(e) => setExportLabelScale(e.target.value)}
                title="Multiplies label text size"
              />
            </div>
          </div>
        </div>

        <div className="exportCodeBlock">
          <div className="exportCodeHeader">
            <div className="exportCodeHeaderLeft">
              <span className="exportCodeTitle">TikZ code</span>
              <span>{tikzStatusText}</span>
              {tikzOutdated && (
                <button type="button" className="exportRefreshButton" onClick={() => generateTikz()}>
                  Refresh
                </button>
              )}
            </div>
            <div className="exportCodeActions">
              <button
                type="button"
                className="exportCodeCopyButton primary"
                onClick={() => void copyCode()}
                title="Copy just the figure code, to paste inside an existing LaTeX document"
              >
                {tikzCopied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="exportCodeCopyButton"
                onClick={() => void copyFullDocument()}
                title="A complete LaTeX file — paste it into any LaTeX editor and compile"
              >
                {fullDocumentCopied ? "Copied" : "Copy full file"}
              </button>
            </div>
          </div>
          {!isTauriRuntime && (
            <div className="statusText exportWebGuidance">
              No LaTeX editor? Use “Copy full file”, then paste into{" "}
              <a href="https://www.overleaf.com" target="_blank" rel="noreferrer">
                overleaf.com
              </a>{" "}
              to get a PDF.
            </div>
          )}
          <textarea
            className="exportTextarea"
            value={tikzText}
            readOnly
            placeholder="Click Copy to generate your figure's TikZ code"
            spellCheck={false}
          />
        </div>

        <details className="exportLogDetails">
          <summary>Advanced options</summary>
          <div className="optionsBlock exportAdvancedBlock">
            <label className="checkboxRow" title="Shorter output, same figure. Turn off for readable, commented code.">
              <input
                type="checkbox"
                checked={exportEfficient}
                onChange={(e) => setExportEfficient(e.target.checked)}
              />
              Compact code
            </label>
            <label
              className="checkboxRow"
              title="Emits \tkzInit, \tkzClip, and \tkzSetUpLine so the figure can compile on its own."
            >
              <input
                type="checkbox"
                checked={exportEmitTkzSetup}
                onChange={(e) => setExportEmitTkzSetupManual(e.target.checked)}
                disabled={exportBakeCoordinates}
              />
              {exportBakeCoordinates
                ? "Include drawing-area setup lines (not used in Exact coordinates mode)"
                : "Include drawing-area setup lines"}
            </label>
            <div className="exportModeBlock">
              <div className="subSectionTitle">Code style</div>
              <div className="exportModeSegmented" role="radiogroup" aria-label="TikZ code style">
                <button
                  type="button"
                  role="radio"
                  aria-checked={tikzExportMode === "visualExact"}
                  className={tikzExportMode === "visualExact" ? "exportModeButton active" : "exportModeButton"}
                  title="Writes each point's final position — always matches the canvas exactly."
                  onClick={() => setTikzExportMode("visualExact")}
                >
                  Exact coordinates
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tikzExportMode === "reconstructible"}
                  className={tikzExportMode === "reconstructible" ? "exportModeButton active" : "exportModeButton"}
                  title="Writes tkz-euclide construction commands — editable geometry, may differ in edge cases."
                  onClick={() => setTikzExportMode("reconstructible")}
                >
                  Geometric constructions
                </button>
              </div>
            </div>
          </div>
        </details>
      </section>

      <section className="sidebarSection">
        <details className="exportLogDetails">
          <summary>Scene data (JSON) — advanced</summary>
          <div className="exportAdvancedBlock">
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={includeWorldInJson}
                onChange={(e) => setIncludeWorldInJson(e.target.checked)}
              />
              Include evaluated world coords (debug)
            </label>
            <div className="actionsRow">
              <button className="actionButton primary" onClick={generateConstructionSnapshot}>
                Generate JSON
              </button>
              <button className="actionButton secondary" onClick={() => void copyJson()} disabled={!jsonText}>
                {jsonCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              className="exportTextarea exportTextareaCompact"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="Click Generate JSON to produce model export"
              spellCheck={false}
            />
          </div>
        </details>
      </section>
    </>
  );
}

function readDrawingCanvasSize(
  canvas?: HTMLCanvasElement
): CanvasViewportSize | null {
  if (typeof document === "undefined") return null;
  const drawingCanvas = canvas ?? document.querySelector<HTMLCanvasElement>(".drawingCanvas");
  if (!drawingCanvas) return null;
  const rect = drawingCanvas.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return { widthPx: rect.width, heightPx: rect.height };
}

function getViewportFromCanvas(
  camera: Camera,
  canvasSize: CanvasViewportSize
): { xmin: number; xmax: number; ymin: number; ymax: number } {
  const widthPx = canvasSize.widthPx;
  const heightPx = canvasSize.heightPx;
  const halfWorldW = widthPx / (2 * Math.max(1e-6, camera.zoom));
  const halfWorldH = heightPx / (2 * Math.max(1e-6, camera.zoom));
  return {
    xmin: camera.pos.x - halfWorldW,
    xmax: camera.pos.x + halfWorldW,
    ymin: camera.pos.y - halfWorldH,
    ymax: camera.pos.y + halfWorldH,
  };
}

function getLegacyViewportFromCanvasPane(
  camera: Camera
): { xmin: number; xmax: number; ymin: number; ymax: number } | undefined {
  if (typeof document === "undefined") return undefined;
  const canvasPane = document.querySelector(".canvasPane") as HTMLElement | null;
  const widthPx = Math.max(240, canvasPane?.clientWidth ?? window.innerWidth);
  const heightPx = Math.max(180, canvasPane?.clientHeight ?? window.innerHeight);
  const halfWorldW = widthPx / (2 * Math.max(1e-6, camera.zoom));
  const halfWorldH = heightPx / (2 * Math.max(1e-6, camera.zoom));
  return {
    xmin: camera.pos.x - halfWorldW,
    xmax: camera.pos.x + halfWorldW,
    ymin: camera.pos.y - halfWorldH,
    ymax: camera.pos.y + halfWorldH,
  };
}
