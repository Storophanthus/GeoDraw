import type { Vec2 } from "../geo/vec2";
import type { RectGridSettings } from "../render/rectGrid";
import { drawRectGrid } from "../render/rectGrid";
import { beginSceneEvalTick, endSceneEvalTick, type ScenePoint } from "../scene/points";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import type { ExportClipWorld } from "../state/slices/storeTypes";
import type { Camera, Viewport } from "./camera";
import { camera as camMath } from "./camera";
import type { SnapCandidate } from "./snapEngine";
import {
  drawPendingPreview,
  type AngleFixedToolState,
  type CircleFixedToolState,
  type PendingPreviewTheme,
  type RegularPolygonToolState,
  type TransformToolState,
} from "./previews/pendingPreview";
import { drawAngles, drawCircles, drawLines, drawPoints, drawPolygons, drawSegments } from "./renderers";
import type { DrawableObjectSelection } from "./renderers/types";
import type { ResolvedAngle } from "./labelOverlays";
import { drawInteractionHighlights } from "./interactionHighlights";
import { highlightSnapObject } from "./snapHighlight";

type PendingPreviewTolerances = {
  linePx: number;
  segmentPx: number;
};

type CanvasColorTheme = {
  backgroundColor: string;
  gridMinorColor: string;
  gridMajorColor: string;
  axisColor: string;
};

type RenderFrameArgs = {
  canvas: HTMLCanvasElement;
  scene: Parameters<typeof beginSceneEvalTick>[0];
  camera: Camera;
  vp: Viewport;
  dpr: number;
  gridSettings: RectGridSettings;
  canvasTheme: CanvasColorTheme;
  activeTool: ActiveTool;
  pendingSelection: PendingSelection;
  cursorWorld: Vec2 | null;
  hoverScreen: Vec2 | null;
  hoverSnap: SnapCandidate | null;
  hoveredHit: HoveredHit;
  hoveredTargetValid: boolean;
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>;
  resolvedAngles: ResolvedAngle[];
  angleFixedTool: AngleFixedToolState;
  regularPolygonTool: RegularPolygonToolState;
  circleFixedTool: CircleFixedToolState;
  transformTool: TransformToolState;
  anglePreviewArcRadius: number;
  pendingPreviewTolerances: PendingPreviewTolerances;
  previewTheme: PendingPreviewTheme;
  selectedDrawableObject: DrawableObjectSelection;
  recentDrawableObject: DrawableObjectSelection;
  copySourceDrawable: DrawableObjectSelection;
  dependencyGlowEnabled: boolean;
  exportClipWorld: ExportClipWorld | null;
  getAngleStrokeRenderWidth: (rawStrokeWidth: number) => number;
};

export function renderCanvasFrame(args: RenderFrameArgs): void {
  const {
    canvas,
    scene,
    camera,
    vp,
    dpr,
    gridSettings,
    canvasTheme,
    activeTool,
    pendingSelection,
    cursorWorld,
    hoverScreen,
    hoverSnap,
    hoveredHit,
    hoveredTargetValid,
    resolvedPoints,
    resolvedAngles,
    angleFixedTool,
    regularPolygonTool,
    circleFixedTool,
    transformTool,
    anglePreviewArcRadius,
    pendingPreviewTolerances,
    previewTheme,
    selectedDrawableObject,
    recentDrawableObject,
    copySourceDrawable,
    dependencyGlowEnabled,
    exportClipWorld,
    getAngleStrokeRenderWidth,
  } = args;

  beginSceneEvalTick(scene);
  try {
    canvas.width = Math.max(1, Math.floor(vp.widthPx * dpr));
    canvas.height = Math.max(1, Math.floor(vp.heightPx * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vp.widthPx, vp.heightPx);
    ctx.fillStyle = canvasTheme.backgroundColor;
    ctx.fillRect(0, 0, vp.widthPx, vp.heightPx);

    drawRectGrid(ctx, camera, vp, gridSettings, canvasTheme);
    drawCircles(ctx, scene, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
    drawPolygons(ctx, scene, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
    drawLines(ctx, scene, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
    drawSegments(ctx, scene, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
    drawAngles(ctx, resolvedAngles, camera, vp, selectedDrawableObject, recentDrawableObject, getAngleStrokeRenderWidth);
    drawPendingPreview(
      ctx,
      pendingSelection,
      cursorWorld,
      hoverScreen,
      hoverSnap,
      hoveredHit,
      scene,
      camera,
      vp,
      angleFixedTool,
      regularPolygonTool,
      circleFixedTool,
      transformTool,
      anglePreviewArcRadius,
      pendingPreviewTolerances,
      previewTheme
    );
    drawPoints(
      ctx,
      resolvedPoints,
      selectedDrawableObject,
      camera,
      vp,
      copySourceDrawable,
      dependencyGlowEnabled,
      canvasTheme.backgroundColor
    );
    drawInteractionHighlights(
      ctx,
      activeTool,
      pendingSelection,
      hoveredHit,
      hoveredTargetValid,
      resolvedPoints,
      scene,
      camera,
      vp
    );
    const clipPreviewPoints: Vec2[] =
      pendingSelection && pendingSelection.tool === "export_clip"
        ? pendingSelection.points.map((p) => p.world)
        : [];
    drawExportClipOverlay(ctx, exportClipWorld, clipPreviewPoints, cursorWorld, camera, vp, previewTheme);

    if (hoverSnap && (activeTool === "point" || activeTool === "move")) {
      const s = camMath.worldToScreen(hoverSnap.world, camera, vp);
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = previewTheme.snapStroke;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      if (hoverSnap.kind === "intersection" && hoverSnap.objA && hoverSnap.objB) {
        highlightSnapObject(ctx, hoverSnap.objA, scene, camera, vp);
        highlightSnapObject(ctx, hoverSnap.objB, scene, camera, vp);
      }
      ctx.restore();
    }
  } finally {
    endSceneEvalTick(scene);
  }
}

function drawExportClipOverlay(
  ctx: CanvasRenderingContext2D,
  clip: ExportClipWorld | null,
  pendingPoints: Vec2[],
  cursorWorld: Vec2 | null,
  camera: Camera,
  vp: Viewport,
  previewTheme: PendingPreviewTheme
): void {
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = previewTheme.strokeStrong;
  ctx.fillStyle = previewTheme.fillSoft;
  ctx.lineWidth = Math.max(0.8, previewTheme.lineWidthPx);

  if (clip?.kind === "rect") {
    const pMin = camMath.worldToScreen({ x: clip.xmin, y: clip.ymin }, camera, vp);
    const pMax = camMath.worldToScreen({ x: clip.xmax, y: clip.ymax }, camera, vp);
    const x = Math.min(pMin.x, pMax.x);
    const y = Math.min(pMin.y, pMax.y);
    const w = Math.abs(pMax.x - pMin.x);
    const h = Math.abs(pMax.y - pMin.y);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
  } else if (clip?.kind === "polygon" && clip.points.length >= 3) {
    const first = camMath.worldToScreen(clip.points[0], camera, vp);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < clip.points.length; i += 1) {
      const p = camMath.worldToScreen(clip.points[i], camera, vp);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (pendingPoints.length >= 1) {
    const first = camMath.worldToScreen(pendingPoints[0], camera, vp);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pendingPoints.length; i += 1) {
      const p = camMath.worldToScreen(pendingPoints[i], camera, vp);
      ctx.lineTo(p.x, p.y);
    }
    if (cursorWorld) {
      const c = camMath.worldToScreen(cursorWorld, camera, vp);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
