import type { Camera, Viewport } from "../view/camera";
import { camera as camMath } from "../view/camera";
import type { SceneModel, SceneRichTextNode } from "../scene/points";
import { TEXT_LABEL_CANVAS_SIZE_SCALE } from "../view/labelOverlays";
import { renderRichTextDocumentHtml } from "./render";

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
};

export function createRichTextOverlays(scene: SceneModel, camera: Camera, vp: Viewport): RichTextOverlay[] {
  return (scene.richTextNodes ?? [])
    .filter((node) => node.visible)
    .map((node) => createRichTextOverlay(node, camera, vp));
}

export function createRichTextOverlay(node: SceneRichTextNode, camera: Camera, vp: Viewport): RichTextOverlay {
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
  };
}
