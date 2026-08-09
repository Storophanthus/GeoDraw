import { getCanvasCaptureFigureSizing } from "../tikzPreviewSizing.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const captured = getCanvasCaptureFigureSizing(1.84, true);
assert(captured.scalebox === "1.84", "Canvas capture must carry True Zoom in the outer scalebox.");
assert(captured.global === "0.54", "Canvas capture must remove True Zoom from coordinate scale.");
assert(captured.trueGlobal === "1", "Canvas capture must neutralize Advanced transform scale.");
assert(captured.point === "1", "Canvas capture must neutralize point scaling.");
assert(captured.line === "1", "Canvas capture must neutralize line scaling.");
assert(captured.label === "1", "Canvas capture must neutralize label scaling.");
assert(captured.labelHalo === "1", "Canvas capture must neutralize halo scaling.");

const unzoomed = getCanvasCaptureFigureSizing(undefined, false);
assert(unzoomed.scalebox === "1" && unzoomed.global === "1", "Missing True Zoom must use neutral sizing.");

console.log("tikz preview canvas-capture sizing tests passed");
