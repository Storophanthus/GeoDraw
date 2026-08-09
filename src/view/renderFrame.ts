import type { Vec2 } from "../geo/vec2";
import type { RectGridSettings } from "../render/rectGrid";
import { drawRectGrid } from "../render/rectGrid";
import { beginSceneEvalTick, endSceneEvalTick, type ScenePoint } from "../scene/points";
import { getGeometryLayerOrder } from "../scene/geometryLayerOrder";
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
import { drawAngleObject, drawCircleObject, drawEllipseObject, drawLineObject, drawPoints, drawPolygonObject, drawSegmentObject } from "./renderers";
import type { DrawableObjectSelection } from "./renderers/types";
import type { ResolvedAngle } from "./labelOverlays";
import { drawInteractionHighlights } from "./interactionHighlights";
import {
  EXPORT_CLIP_HANDLE_HIT_PX,
  EXPORT_CLIP_HANDLE_SIZE_PX,
  exportClipHandleScreen,
  listExportClipHandles,
} from "./exportClipHandles";
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
    camera: viewCamera,
    vp: viewViewport,
    dpr,
    gridSettings,
    canvasTheme,
    activeTool,
    pendingSelection,
    cursorWorld,
    hoverScreen: viewHoverScreen,
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

  const renderSpace = camMath.trueZoomRenderSpace(viewCamera, viewViewport);
  const camera = renderSpace.camera;
  const vp = renderSpace.viewport;
  const renderScale = renderSpace.scale;
  const hoverScreen = viewHoverScreen
    ? { x: viewHoverScreen.x / renderScale, y: viewHoverScreen.y / renderScale }
    : null;

  beginSceneEvalTick(scene);
  try {
    canvas.width = Math.max(1, Math.floor(viewViewport.widthPx * dpr));
    canvas.height = Math.max(1, Math.floor(viewViewport.heightPx * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr * renderScale, 0, 0, dpr * renderScale, 0, 0);
    ctx.clearRect(0, 0, vp.widthPx, vp.heightPx);
    ctx.fillStyle = canvasTheme.backgroundColor;
    ctx.fillRect(0, 0, vp.widthPx, vp.heightPx);

    drawRectGrid(ctx, camera, vp, gridSettings, canvasTheme);
    const polygonOwnedEdgePresence = new Set<string>();
    for (const segment of scene.segments) {
      if (!Array.isArray(segment.ownedByPolygonIds) || segment.ownedByPolygonIds.length === 0) continue;
      const key = segment.aId < segment.bId ? `${segment.aId}::${segment.bId}` : `${segment.bId}::${segment.aId}`;
      for (const polygonId of segment.ownedByPolygonIds) {
        polygonOwnedEdgePresence.add(`${polygonId}::${key}`);
      }
    }
    const geometryLayerOrder = getGeometryLayerOrder(scene);
    for (let i = geometryLayerOrder.length - 1; i >= 0; i -= 1) {
      const ref = geometryLayerOrder[i];
      if (ref.type === "circle") {
        drawCircleObject(ctx, scene, ref.id, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
      } else if (ref.type === "ellipse") {
        drawEllipseObject(ctx, scene, ref.id, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
      } else if (ref.type === "polygon") {
        drawPolygonObject(
          ctx,
          scene,
          ref.id,
          camera,
          vp,
          selectedDrawableObject,
          recentDrawableObject,
          copySourceDrawable,
          polygonOwnedEdgePresence
        );
      } else if (ref.type === "line") {
        drawLineObject(ctx, scene, ref.id, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
      } else if (ref.type === "segment") {
        drawSegmentObject(ctx, scene, ref.id, camera, vp, selectedDrawableObject, recentDrawableObject, copySourceDrawable);
      } else if (ref.type === "angle") {
        drawAngleObject(
          ctx,
          resolvedAngles,
          ref.id,
          camera,
          vp,
          selectedDrawableObject,
          recentDrawableObject,
          getAngleStrokeRenderWidth
        );
      }
    }
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
    drawExportClipOverlay(
      ctx,
      exportClipWorld,
      clipPreviewPoints,
      cursorWorld,
      camera,
      vp,
      previewTheme,
      activeTool,
      hoverScreen
    );

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
  previewTheme: PendingPreviewTheme,
  activeTool: ActiveTool,
  hoverScreen: Vec2 | null
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

  // Grab handles ride on top of the dashed outline, and only under the move tool
  // — while a clip tool is armed the next clicks draw a replacement area, so
  // showing handles there would advertise an interaction that isn't available.
  if (clip && activeTool === "move") {
    drawExportClipHandles(ctx, clip, camera, vp, previewTheme, hoverScreen);
  }
}

function drawExportClipHandles(
  ctx: CanvasRenderingContext2D,
  clip: ExportClipWorld,
  camera: Camera,
  vp: Viewport,
  previewTheme: PendingPreviewTheme,
  hoverScreen: Vec2 | null
): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = Math.max(1, previewTheme.lineWidthPx);
  const half = EXPORT_CLIP_HANDLE_SIZE_PX / 2;

  for (const handle of listExportClipHandles(clip)) {
    const screen = exportClipHandleScreen(clip, handle, camera, vp);
    if (!screen) continue;
    const hovered =
      hoverScreen !== null
      && Math.hypot(hoverScreen.x - screen.x, hoverScreen.y - screen.y) <= EXPORT_CLIP_HANDLE_HIT_PX;
    const size = hovered ? half + 1.5 : half;
    ctx.fillStyle = hovered ? previewTheme.strokeStrong : previewTheme.fillStrong;
    ctx.strokeStyle = previewTheme.strokeStrong;
    ctx.beginPath();
    ctx.rect(screen.x - size, screen.y - size, size * 2, size * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
