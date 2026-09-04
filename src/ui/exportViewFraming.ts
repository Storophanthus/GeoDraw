/**
 * Past this reading, True Zoom stops being a pure publication scale: the user
 * has magnified one part of the drawing and is looking at a detail, so the
 * export should frame what is on screen instead of the whole scene.
 */
export const AUTO_CURRENT_VIEW_TRUE_ZOOM_PERCENT = 150;

/** The same rounded percentage the canvas True Zoom badge shows. */
export function getTrueZoomPercent(trueZoom: number): number {
  return Number.isFinite(trueZoom) ? Math.round(trueZoom * 100) : 100;
}

/**
 * Compared against the displayed percentage rather than the raw factor so the
 * checkbox flips exactly when the badge the user is reading passes 150%.
 */
export function shouldAutoUseCurrentView(trueZoom: number): boolean {
  return getTrueZoomPercent(trueZoom) > AUTO_CURRENT_VIEW_TRUE_ZOOM_PERCENT;
}
