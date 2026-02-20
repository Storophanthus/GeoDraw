import { bindCanvasEventLifecycle } from "../canvasEventLifecycle";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

class FakeCanvas {
  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const fn = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
    const set = this.listeners.get(type) ?? new Set<(event: Event) => void>();
    set.add(fn);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const fn = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) this.listeners.delete(type);
  }

  emit(type: string, event: Event): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) listener(event);
  }
}

const fakeCanvas = new FakeCanvas();
let doubleClicks = 0;

const unbind = bindCanvasEventLifecycle(fakeCanvas as unknown as HTMLCanvasElement, {
  onDown() {},
  onMove() {},
  onFinish() {},
  onDoubleClick() {
    doubleClicks += 1;
  },
  onLeave() {},
  onWheel() {},
});

fakeCanvas.emit("dblclick", {} as Event);
assert(doubleClicks === 1, "dblclick should be bound to lifecycle handlers.");

unbind();
fakeCanvas.emit("dblclick", {} as Event);
assert(doubleClicks === 1, "unbind should remove the dblclick handler.");

console.log("canvas-event-lifecycle: ok");
