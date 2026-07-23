import type { Camera, Viewport } from "../view/camera";
import { camera as camMath } from "../view/camera";
import type { SceneModel, SceneRichTextNode } from "../scene/points";
import { LABEL_GLOW_WIDTH_PX, TEXT_LABEL_CANVAS_SIZE_SCALE } from "../view/labelOverlays";
import { renderRichTextDocumentHtml } from "./richTextRender";

export type RichTextOverlay = {
  id: string;
  x: number;
  y: number;
  maxWidthPx: number;
  html: string;
  textColor: string;
  textSize: number;
  textAlign: "left" | "center" | "right";
  rotationDeg: number;
  labelGlow: boolean;
  labelHaloColor: string;
  labelHaloWidthPx: number;
};

export function createRichTextOverlays(
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  labelHaloColor: string
): RichTextOverlay[] {
  return (scene.richTextNodes ?? [])
    .filter((node) => node.visible)
    .map((node) => createRichTextOverlay(node, camera, vp, labelHaloColor));
}

export function createRichTextOverlay(
  node: SceneRichTextNode,
  camera: Camera,
  vp: Viewport,
  labelHaloColor: string
): RichTextOverlay {
  const screen = camMath.worldToScreen(node.positionWorld, camera, vp);
  const maxWidthPx = Math.max(48, vp.widthPx - screen.x - 16);
  return {
    id: node.id,
    x: screen.x,
    y: screen.y,
    maxWidthPx,
    html: renderRichTextDocumentHtml(node.document),
    textColor: node.style.textColor,
    textSize: Math.max(8, node.style.textSize) * TEXT_LABEL_CANVAS_SIZE_SCALE,
    textAlign: node.style.textAlign,
    rotationDeg:
      typeof node.style.rotationDeg === "number" && Number.isFinite(node.style.rotationDeg)
        ? node.style.rotationDeg
        : 0,
    labelGlow: Boolean(node.style.labelGlow),
    labelHaloColor,
    labelHaloWidthPx: LABEL_GLOW_WIDTH_PX,
  };
}
