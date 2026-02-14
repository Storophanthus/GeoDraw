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

type RenderFrameArgs = {
  canvas: HTMLCanvasElement;
  scene: Parameters<typeof beginSceneEvalTick>[0];
  camera: Camera;
  vp: Viewport;
  dpr: number;
  gridSettings: RectGridSettings;
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
  circleFixedTool: CircleFixedToolState;
  anglePreviewArcRadius: number;
  pendingPreviewTolerances: PendingPreviewTolerances;
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
    circleFixedTool,
    anglePreviewArcRadius,
    pendingPreviewTolerances,
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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, vp.widthPx, vp.heightPx);

    drawRectGrid(ctx, camera, vp, gridSettings);
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
      circleFixedTool,
      anglePreviewArcRadius,
      pendingPreviewTolerances
    );
    drawPoints(ctx, resolvedPoints, selectedDrawableObject, camera, vp, copySourceDrawable, dependencyGlowEnabled);
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
    drawExportClipOverlay(ctx, exportClipWorld, clipPreviewPoints, cursorWorld, camera, vp);

    if (hoverSnap && (activeTool === "point" || activeTool === "move")) {
      const s = camMath.worldToScreen(hoverSnap.world, camera, vp);
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#f97316";
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
  vp: Viewport
): void {
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = "rgba(14,165,233,0.95)";
  ctx.fillStyle = "rgba(14,165,233,0.05)";
  ctx.lineWidth = 1.2;

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
