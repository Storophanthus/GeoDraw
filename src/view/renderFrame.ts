import type { Vec2 } from "../geo/vec2";
import type { RectGridSettings } from "../render/rectGrid";
import { drawRectGrid } from "../render/rectGrid";
import { beginSceneEvalTick, endSceneEvalTick, type ScenePoint } from "../scene/points";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import type { Camera, Viewport } from "./camera";
import { camera as camMath } from "./camera";
import type { SnapCandidate } from "./snapEngine";
import {
  drawPendingPreview,
  type AngleFixedToolState,
  type CircleFixedToolState,
} from "./previews/pendingPreview";
import { drawAngles, drawCircles, drawLines, drawPoints, drawSegments } from "./renderers";
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
  pendingPreviewTolerances: PendingPreviewTolerances;
  selectedDrawableObject: DrawableObjectSelection;
  recentDrawableObject: DrawableObjectSelection;
  copySourceDrawable: DrawableObjectSelection;
  dependencyGlowEnabled: boolean;
  exportClipRectWorld: { xmin: number; xmax: number; ymin: number; ymax: number } | null;
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
    pendingPreviewTolerances,
    selectedDrawableObject,
    recentDrawableObject,
    copySourceDrawable,
    dependencyGlowEnabled,
    exportClipRectWorld,
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
    if (exportClipRectWorld) {
      const pMin = camMath.worldToScreen({ x: exportClipRectWorld.xmin, y: exportClipRectWorld.ymin }, camera, vp);
      const pMax = camMath.worldToScreen({ x: exportClipRectWorld.xmax, y: exportClipRectWorld.ymax }, camera, vp);
      const x = Math.min(pMin.x, pMax.x);
      const y = Math.min(pMin.y, pMax.y);
      const w = Math.abs(pMax.x - pMin.x);
      const h = Math.abs(pMax.y - pMin.y);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "rgba(14,165,233,0.95)";
      ctx.fillStyle = "rgba(14,165,233,0.05)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

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
