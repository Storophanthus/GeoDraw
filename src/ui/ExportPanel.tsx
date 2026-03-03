import { useMemo, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { exportConstructionSnapshot, exportConstructionSnapshotWithWorld } from "../export/constructionSnapshot";
import { exportTikzEfficientWithOptions, exportTikzWithOptions } from "../export/tikz";
import { getPointInnerSepFixedPt, TIKZ_EXPORT_CALIBRATION } from "../export/tikz/calibration";
import { getCanvasColorTheme, getUiCssVariables } from "../state/colorProfiles";
import type { SceneModel } from "../scene/points";
import { useGeoStore } from "../state/geoStore";
import type { Camera } from "../view/camera";
import { createTikzPreviewSession } from "./tikzPreviewSession";
import { IconGlobe, IconPoint, IconLine, IconType } from "./icons";
import "./ExportPanel.css";

type ExportPanelProps = {
  visible: boolean;
};

export function ExportPanel({ visible }: ExportPanelProps) {
  const scene = useGeoStore((store) => store.scene);
  const camera = useGeoStore((store) => store.camera);
  const exportClipWorld = useGeoStore((store) => store.exportClipWorld);
  const clearExportClipWorld = useGeoStore((store) => store.clearExportClipWorld);
  const uiColorProfileId = useGeoStore((store) => store.uiColorProfileId);
  const colorProfileId = useGeoStore((store) => store.colorProfileId);
  const uiCssOverrides = useGeoStore((store) => store.uiCssOverrides);
  const canvasThemeOverrides = useGeoStore((store) => store.canvasThemeOverrides);

  const [tikzText, setTikzText] = useState("");
  const [tikzCopied, setTikzCopied] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonCopied, setJsonCopied] = useState(false);
  const [includeWorldInJson, setIncludeWorldInJson] = useState(false);
  const [exportUseCurrentView, setExportUseCurrentView] = useState(false);
  const [exportUseClipSelection, setExportUseClipSelection] = useState(false);
  const [exportEfficient, setExportEfficient] = useState(false);
  const [exportEmitTkzSetup, setExportEmitTkzSetup] = useState(true);
  const [exportLabelGlow, setExportLabelGlow] = useState(true);
  const [exportGlobalScale, setExportGlobalScale] = useState("1");
  const [exportPointScale, setExportPointScale] = useState("1");
  const [exportLineScale, setExportLineScale] = useState("1");
  const [exportLabelScale, setExportLabelScale] = useState("1");
  const [lastTikzSceneRef, setLastTikzSceneRef] = useState<SceneModel | null>(null);
  const [lastTikzOptionSig, setLastTikzOptionSig] = useState("");
  const [lastTikzGeneratedAt, setLastTikzGeneratedAt] = useState<number | null>(null);
  const isTauriRuntime = useMemo(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object),
    []
  );
  const uiCssVariables = useMemo(() => {
    const uiVars = getUiCssVariables(uiColorProfileId, uiCssOverrides);
    const canvasTheme = getCanvasColorTheme(colorProfileId, canvasThemeOverrides);
    return {
      ...uiVars,
      "--gd-scene-bg": canvasTheme.backgroundColor,
    };
  }, [uiColorProfileId, uiCssOverrides, colorProfileId, canvasThemeOverrides]);

  const clipSig = exportClipWorld
    ? exportClipWorld.kind === "rect"
      ? `rect:${exportClipWorld.xmin},${exportClipWorld.xmax},${exportClipWorld.ymin},${exportClipWorld.ymax}`
      : `poly:${exportClipWorld.points.map((p) => `${p.x},${p.y}`).join(";")}`
    : "none";
  const currentTikzOptionSig = `${exportUseCurrentView}|${exportUseClipSelection}|${exportEfficient}|${exportEmitTkzSetup}|${exportLabelGlow}|${exportGlobalScale}|${exportPointScale}|${exportLineScale}|${exportLabelScale}|${camera.pos.x}|${camera.pos.y}|${camera.zoom}|${clipSig}`;
  const tikzOutdated = Boolean(tikzText) && (lastTikzSceneRef !== scene || lastTikzOptionSig !== currentTikzOptionSig);
  const tikzStatusText = useMemo(
    () =>
      !tikzText
        ? "Not generated yet."
        : tikzOutdated
          ? "Outdated: scene/options changed. Regenerate TikZ."
          : `Up to date${lastTikzGeneratedAt ? ` · Generated ${new Date(lastTikzGeneratedAt).toLocaleTimeString()}` : ""}`,
    [lastTikzGeneratedAt, tikzOutdated, tikzText]
  );

  const buildTikzExport = (): { text: string; optionSig: string } => {
    const pointScale = Number(exportPointScale);
    const lineScale = Number(exportLineScale);
    const labelScale = Number(exportLabelScale);
    const globalScale = Number(exportGlobalScale);
    const optionSig = `${exportUseCurrentView}|${exportUseClipSelection}|${exportEfficient}|${exportEmitTkzSetup}|${exportLabelGlow}|${exportGlobalScale}|${exportPointScale}|${exportLineScale}|${exportLabelScale}|${camera.pos.x}|${camera.pos.y}|${camera.zoom}|${clipSig}`;
    const viewport = exportUseCurrentView ? getViewportFromCanvas(camera) : undefined;
    const clipRect =
      exportUseClipSelection && exportClipWorld?.kind === "rect" ? exportClipWorld : undefined;
    const clipPolygon =
      exportUseClipSelection && exportClipWorld?.kind === "polygon" ? exportClipWorld.points : undefined;
    const tikzOptions = {
      viewport,
      clipRectWorld: clipRect,
      clipPolygonWorld: clipPolygon,
      worldToTikzScale: Number.isFinite(globalScale) ? globalScale : 1,
      pointScale: Number.isFinite(pointScale) ? pointScale : 1,
      lineScale:
        (Number.isFinite(lineScale) ? lineScale : 1) *
        TIKZ_EXPORT_CALIBRATION.uiLineScaleToExporter,
      labelScale: Number.isFinite(labelScale) ? labelScale : 1,
      screenPxPerWorld: camera.zoom,
      emitTkzSetup: exportEmitTkzSetup,
      labelGlow: exportLabelGlow,
      pointStrokeScale: TIKZ_EXPORT_CALIBRATION.pointStrokeScale,
      pointInnerSepFixedPt: getPointInnerSepFixedPt(),
      pointInnerSepScale: TIKZ_EXPORT_CALIBRATION.pointInnerSepScale,
      segmentMarkSizeScale: TIKZ_EXPORT_CALIBRATION.segmentMarkSizeScale,
      segmentMarkLineWidthScale: TIKZ_EXPORT_CALIBRATION.segmentMarkLineWidthScale,
      angleLabelFontScale: TIKZ_EXPORT_CALIBRATION.angleLabelFontScale,
      angleArcSizeScale: TIKZ_EXPORT_CALIBRATION.angleArcSizeScale,
      angleMarkSizeScale: TIKZ_EXPORT_CALIBRATION.angleMarkSizeScale,
      rightAngleSizeScale: TIKZ_EXPORT_CALIBRATION.rightAngleSizeScale,
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

  const copyTikz = async () => {
    if (!tikzText) return;
    try {
      await navigator.clipboard.writeText(tikzText);
      setTikzCopied(true);
      window.setTimeout(() => setTikzCopied(false), 1200);
    } catch {
      setTikzCopied(false);
    }
  };

  const openPreviewWindow = () => {
    try {
      const text = !tikzText || tikzOutdated ? generateTikz() : tikzText;
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
        </div>
        <div className="optionsBlock">
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={exportUseCurrentView}
              onChange={(e) => setExportUseCurrentView(e.target.checked)}
            />
            Use Current View
          </label>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={exportEfficient}
              onChange={(e) => setExportEfficient(e.target.checked)}
            />
            Efficient TikZ Code (Compact)
          </label>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={exportEmitTkzSetup}
              onChange={(e) => setExportEmitTkzSetup(e.target.checked)}
            />
            Emit tkz setup (Init/Clip/SetUpLine)
          </label>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={exportUseClipSelection}
              onChange={(e) => setExportUseClipSelection(e.target.checked)}
              disabled={!exportClipWorld}
            />
            Use Export Clip selection
          </label>
          {exportClipWorld && (
            <div className="actionsRow">
              <button className="actionButton secondary" onClick={clearExportClipWorld}>
                Clear clip selection
              </button>
            </div>
          )}
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={exportLabelGlow}
              onChange={(e) => setExportLabelGlow(e.target.checked)}
            />
            Label glow
          </label>
        </div>
        <div className="scaleBlock">
          <div className="subSectionTitle">Scale Modifiers</div>
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
                title="Global Scale"
              />
            </div>
            <div className="scaleGridItem">
              <div className="scaleGridIcon">
                <IconPoint size={14} />
              </div>
              <span className="scaleGridLabel">Point</span>
              <input
                className="scaleGridInput"
                type="number"
                min={0.1}
                max={4}
                step={0.05}
                value={exportPointScale}
                onChange={(e) => setExportPointScale(e.target.value)}
                title="Point Scale"
              />
            </div>
            <div className="scaleGridItem">
              <div className="scaleGridIcon">
                <IconLine size={14} />
              </div>
              <span className="scaleGridLabel">Line</span>
              <input
                className="scaleGridInput"
                type="number"
                min={0.1}
                max={4}
                step={0.05}
                value={exportLineScale}
                onChange={(e) => setExportLineScale(e.target.value)}
                title="Line Scale"
              />
            </div>
            <div className="scaleGridItem">
              <div className="scaleGridIcon">
                <IconType size={14} />
              </div>
              <span className="scaleGridLabel">Label</span>
              <input
                className="scaleGridInput"
                type="number"
                min={0.1}
                max={4}
                step={0.05}
                value={exportLabelScale}
                onChange={(e) => setExportLabelScale(e.target.value)}
                title="Label Scale"
              />
            </div>
          </div>
        </div>
        <div className="actionsRow actionsRowWrap">
          <button className="actionButton primary" onClick={() => void generateTikz()}>
            {tikzText ? "Regenerate TikZ" : "Generate TikZ"}
          </button>
          <button className="actionButton secondary" onClick={() => void copyTikz()} disabled={!tikzText}>
            {tikzCopied ? "Copied" : "Copy"}
          </button>
          <button className="actionButton secondary" onClick={openPreviewWindow}>
            Preview
          </button>
        </div>
        <div className="statusText">{tikzStatusText}</div>
        <textarea
          className="exportTextarea"
          value={tikzText}
          readOnly
          placeholder="Click Preview to generate TikZ and open editor window"
          spellCheck={false}
        />
        {!isTauriRuntime ? <div className="statusText">New-window PDF preview works in desktop app mode.</div> : null}
      </section>

      <section className="sidebarSection">
        <h2 className="sectionTitle">Model JSON</h2>
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
          <button className="actionButton secondary" onClick={copyJson} disabled={!jsonText}>
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
      </section>
    </>
  );
}

function getViewportFromCanvas(camera: Camera): { xmin: number; xmax: number; ymin: number; ymax: number } | undefined {
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
