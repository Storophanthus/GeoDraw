import { useMemo, useState } from "react";
import { exportConstructionSnapshot, exportConstructionSnapshotWithWorld } from "../export/constructionSnapshot";
import { exportTikzWithOptions, makeEfficientTikz } from "../export/tikz";
import { TIKZ_EXPORT_CALIBRATION } from "../export/tikz/calibration";
import type { SceneModel } from "../scene/points";
import { useGeoStore } from "../state/geoStore";
import type { Camera } from "../view/camera";
import { IconGlobe, IconPoint, IconLine, IconType } from "./icons";

type ExportPanelProps = {
  visible: boolean;
};

export function ExportPanel({ visible }: ExportPanelProps) {
  const scene = useGeoStore((store) => store.scene);
  const camera = useGeoStore((store) => store.camera);
  const exportClipWorld = useGeoStore((store) => store.exportClipWorld);
  const clearExportClipWorld = useGeoStore((store) => store.clearExportClipWorld);

  const [tikzText, setTikzText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [tikzCopied, setTikzCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [includeWorldInJson, setIncludeWorldInJson] = useState(false);
  const [exportUseCurrentView, setExportUseCurrentView] = useState(false);
  const [exportUseClipSelection, setExportUseClipSelection] = useState(false);
  const [exportEfficient, setExportEfficient] = useState(false);
  const [exportMatchCanvas, setExportMatchCanvas] = useState(true);
  const [exportLabelGlow, setExportLabelGlow] = useState(true);
  const [exportGlobalScale, setExportGlobalScale] = useState("1");
  const [exportPointScale, setExportPointScale] = useState("1");
  const [exportLineScale, setExportLineScale] = useState("1");
  const [exportLabelScale, setExportLabelScale] = useState("1");
  const [lastTikzSceneRef, setLastTikzSceneRef] = useState<SceneModel | null>(null);
  const [lastTikzOptionSig, setLastTikzOptionSig] = useState("");
  const [lastTikzGeneratedAt, setLastTikzGeneratedAt] = useState<number | null>(null);

  const clipSig = exportClipWorld
    ? exportClipWorld.kind === "rect"
      ? `rect:${exportClipWorld.xmin},${exportClipWorld.xmax},${exportClipWorld.ymin},${exportClipWorld.ymax}`
      : `poly:${exportClipWorld.points.map((p) => `${p.x},${p.y}`).join(";")}`
    : "none";
  const currentTikzOptionSig = `${exportUseCurrentView}|${exportUseClipSelection}|${exportEfficient}|${exportMatchCanvas}|${exportLabelGlow}|${exportGlobalScale}|${exportPointScale}|${exportLineScale}|${exportLabelScale}|${camera.pos.x}|${camera.pos.y}|${camera.zoom}|${clipSig}`;
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

  const generateTikz = () => {
    try {
      const pointScale = Number(exportPointScale);
      const lineScale = Number(exportLineScale);
      const labelScale = Number(exportLabelScale);
      const globalScale = Number(exportGlobalScale);
      const optionSig = `${exportUseCurrentView}|${exportUseClipSelection}|${exportEfficient}|${exportMatchCanvas}|${exportLabelGlow}|${exportGlobalScale}|${exportPointScale}|${exportLineScale}|${exportLabelScale}|${camera.pos.x}|${camera.pos.y}|${camera.zoom}|${clipSig}`;
      const viewport = exportUseCurrentView ? getViewportFromCanvas(camera) : undefined;
      const clipRect =
        exportUseClipSelection && exportClipWorld?.kind === "rect" ? exportClipWorld : undefined;
      const clipPolygon =
        exportUseClipSelection && exportClipWorld?.kind === "polygon" ? exportClipWorld.points : undefined;
      setTikzText(
        exportTikzWithOptions(scene, {
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
          matchCanvas: exportMatchCanvas,
          labelGlow: exportLabelGlow,
          pointStrokeScale: TIKZ_EXPORT_CALIBRATION.pointStrokeScale,
          pointInnerSepFixedPt: TIKZ_EXPORT_CALIBRATION.pointInnerSepFixedPt,
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
        })
      );
      if (exportEfficient) {
        setTikzText((prev) => makeEfficientTikz(prev));
      }
      setLastTikzSceneRef(scene);
      setLastTikzOptionSig(optionSig);
      setLastTikzGeneratedAt(Date.now());
      setTikzCopied(false);
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
      setJsonText(`{ \"error\": ${JSON.stringify(message)} }`);
      setJsonCopied(false);
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
              checked={exportMatchCanvas}
              onChange={(e) => setExportMatchCanvas(e.target.checked)}
            />
            Match canvas size conversion
          </label>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={exportLabelGlow}
              onChange={(e) => setExportLabelGlow(e.target.checked)}
            />
            Label glow
          </label>
        </div>
        <div className="compactScaleGrid">
          <div className="scaleGridItem">
            <div className="scaleGridIcon">
              <IconGlobe size={14} />
            </div>
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
        <div className="actionsRow">
          <button className="actionButton primary" onClick={generateTikz}>
            {tikzOutdated ? "Regenerate TikZ" : "Generate TikZ"}
          </button>
          <button className="actionButton secondary" onClick={copyTikz} disabled={!tikzText}>
            {tikzCopied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="statusText">{tikzStatusText}</div>
        <textarea
          className="exportTextarea"
          value={tikzText}
          onChange={(e) => setTikzText(e.target.value)}
          placeholder="Click Generate TikZ to export"
          spellCheck={false}
        />
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
