import fixture from "../../export/__fixtures__/incircle-hidden-center-label-hit.json";
import { getPointWorldPos, type SceneModel } from "../../scene/points";
import { camera, type Camera } from "../camera";
import { hitTestPointLabel, hitTestPointLabelFromDom } from "../labelHit";

function equal(actual: unknown, expected: unknown, message = "Values must match"): void {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const scene = fixture.scene as SceneModel;
const resolved = scene.points.map((point) => ({ point, world: getPointWorldPos(point, scene)! }));
const incenter = resolved.find(({ point }) => point.name === "I")!;
const viewport = { widthPx: 1000, heightPx: 800 };

for (const trueZoom of [0.5, 1, 2, 4]) {
  const view: Camera = { pos: { x: 0, y: 0 }, zoom: 50 * trueZoom, trueZoom };
  const anchor = camera.worldToScreen(incenter.world, view, viewport);
  const cursor = { x: anchor.x + 10 * trueZoom, y: anchor.y - 12 * trueZoom };
  equal(
    hitTestPointLabel(cursor, resolved, view, viewport, { x: 8, y: -8 }),
    "p_8",
    `I must remain draggable beside the caption A^{\\prime} at True Zoom ${trueZoom}`
  );

  const captionsOnly = resolved.filter(({ point }) => point.showLabel === "caption");
  equal(
    hitTestPointLabel(cursor, captionsOnly, view, viewport, { x: 8, y: -8 }),
    null,
    "TeX source length must never create an invisible caption hit target"
  );
}

// Captions still use the measured DOM bounds, including TeX and True Zoom.
const layer = {
  querySelectorAll: () => [{
    dataset: { pointId: "p_12" },
    getBoundingClientRect: () => ({ left: 100, right: 124, top: 200, bottom: 225 }),
  }],
} as unknown as HTMLDivElement;
equal(hitTestPointLabelFromDom(110, 210, layer), "p_12");
equal(hitTestPointLabelFromDom(125, 210, layer), null);
equal(hitTestPointLabelFromDom(110, 226, layer), null);
equal(hitTestPointLabelFromDom(110, 210, null), null);

console.log("point-label-hit: ok");
