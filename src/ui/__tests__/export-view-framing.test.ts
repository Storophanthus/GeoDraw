import {
  AUTO_CURRENT_VIEW_TRUE_ZOOM_PERCENT,
  getTrueZoomPercent,
  shouldAutoUseCurrentView,
} from "../exportViewFraming.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(AUTO_CURRENT_VIEW_TRUE_ZOOM_PERCENT === 150, "Auto-framing threshold must stay at 150%.");

assert(getTrueZoomPercent(1.5) === 150, "True Zoom percent must match the canvas badge rounding.");
assert(getTrueZoomPercent(Number.NaN) === 100, "Missing True Zoom must read as 100%.");

assert(!shouldAutoUseCurrentView(1), "Neutral True Zoom must leave the export framing alone.");
assert(!shouldAutoUseCurrentView(1.5), "Exactly 150% is not over the threshold.");
assert(!shouldAutoUseCurrentView(1.504), "A value still displayed as 150% must not flip the box.");
assert(shouldAutoUseCurrentView(1.51), "151% must select the current view automatically.");
assert(shouldAutoUseCurrentView(4), "Maximum True Zoom must select the current view automatically.");
assert(!shouldAutoUseCurrentView(0.25), "Zooming out must never select the current view.");
assert(!shouldAutoUseCurrentView(Number.NaN), "A non-finite True Zoom must not flip the box.");

console.log("export view framing threshold tests passed");
