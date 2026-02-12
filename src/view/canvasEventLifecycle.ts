type CanvasPointerHandlers = {
  onDown: (e: PointerEvent) => void;
  onMove: (e: PointerEvent) => void;
  onFinish: (e: PointerEvent) => void;
  onLeave: () => void;
  onWheel: (e: WheelEvent) => void;
};

export function bindCanvasEventLifecycle(
  canvas: HTMLCanvasElement,
  handlers: CanvasPointerHandlers
): () => void {
  canvas.addEventListener("pointerdown", handlers.onDown);
  canvas.addEventListener("pointermove", handlers.onMove);
  canvas.addEventListener("pointerup", handlers.onFinish);
  canvas.addEventListener("pointercancel", handlers.onFinish);
  canvas.addEventListener("pointerleave", handlers.onLeave);
  canvas.addEventListener("wheel", handlers.onWheel, { passive: false });

  return () => {
    canvas.removeEventListener("pointerdown", handlers.onDown);
    canvas.removeEventListener("pointermove", handlers.onMove);
    canvas.removeEventListener("pointerup", handlers.onFinish);
    canvas.removeEventListener("pointercancel", handlers.onFinish);
    canvas.removeEventListener("pointerleave", handlers.onLeave);
    canvas.removeEventListener("wheel", handlers.onWheel);
  };
}
