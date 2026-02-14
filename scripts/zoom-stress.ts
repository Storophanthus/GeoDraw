import { hitTestTopObject } from "../src/engine/hitTest.ts";
import type { LineStyle, PointStyle, SceneModel } from "../src/scene/points.ts";
import { camera as camMath, type Camera, type Viewport } from "../src/view/camera.ts";
import { findBestSnap } from "../src/view/snapEngine.ts";

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.2,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 12,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle: LineStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.2,
  dash: "solid",
  opacity: 1,
};

const viewport: Viewport = { widthPx: 1400, heightPx: 900 };
const ticks = Number(process.argv[2] ?? 900);
const warmup = Number(process.argv[3] ?? 120);
const avgThresholdMs = Number(process.argv[4] ?? 2.8);
const maxThresholdMs = Number(process.argv[5] ?? 14);

function buildScene(): SceneModel {
  const points: SceneModel["points"] = [];
  const segments: SceneModel["segments"] = [];
  const lines: SceneModel["lines"] = [];
  const circles: SceneModel["circles"] = [];

  let pid = 1;
  let sid = 1;
  let lid = 1;
  let cid = 1;

  for (let y = -6; y <= 6; y += 1) {
    for (let x = -8; x <= 8; x += 1) {
      points.push({
        id: `p_${pid}`,
        kind: "free",
        name: `P${pid}`,
        captionTex: `P${pid}`,
        visible: true,
        showLabel: "none",
        position: { x: x * 1.6, y: y * 1.3 },
        style: pointStyle,
      });
      pid += 1;
    }
  }

  for (let i = 1; i <= 70; i += 1) {
    const a = `p_${((i * 7) % (pid - 1)) + 1}`;
    const b = `p_${((i * 13 + 41) % (pid - 1)) + 1}`;
    if (a === b) continue;
    segments.push({ id: `s_${sid++}`, aId: a, bId: b, visible: true, showLabel: false, style: lineStyle });
    lines.push({ id: `l_${lid++}`, kind: "twoPoint", aId: a, bId: b, visible: true, style: lineStyle });
  }

  for (let i = 1; i <= 42; i += 1) {
    const c = `p_${((i * 11) % (pid - 1)) + 1}`;
    const t = `p_${((i * 17 + 19) % (pid - 1)) + 1}`;
    if (c === t) continue;
    circles.push({
      id: `c_${cid++}`,
      kind: "twoPoint",
      centerId: c,
      throughId: t,
      visible: true,
      style: { strokeColor: "#334155", strokeWidth: 1.2, strokeDash: "solid", strokeOpacity: 1 },
    });
  }

  return { points, segments, lines, circles, polygons: [], angles: [], numbers: [] };
}

function main(): void {
  if (!Number.isFinite(ticks) || ticks < 50) throw new Error("ticks must be >= 50");
  if (!Number.isFinite(warmup) || warmup < 0) throw new Error("warmup must be >= 0");
  const scene = buildScene();
  let camera: Camera = { pos: { x: 0, y: 0 }, zoom: 80, logZoom: Math.log(80) };

  const runTick = (i: number): number => {
    const sx = ((i * 29) % viewport.widthPx) + 0.5;
    const sy = ((i * 17) % viewport.heightPx) + 0.5;
    const screen = { x: sx, y: sy };
    const zoomFactor = i % 2 === 0 ? 1.04 : 1 / 1.04;
    const t0 = performance.now();
    camera = camMath.zoomAtScreenPoint(camera, viewport, screen, zoomFactor);
    findBestSnap(screen, camera, viewport, scene, 12, 6000);
    hitTestTopObject(scene, camera, viewport, screen, {
      pointTolPx: 10,
      angleTolPx: 10,
      segmentTolPx: 8,
      lineTolPx: 8,
      circleTolPx: 8,
    });
    return performance.now() - t0;
  };

  for (let i = 0; i < warmup; i += 1) runTick(i);

  let total = 0;
  let worst = 0;
  for (let i = 0; i < ticks; i += 1) {
    const dt = runTick(i + warmup);
    total += dt;
    if (dt > worst) worst = dt;
  }

  const avg = total / ticks;
  console.log(
    `zoom-stress ticks=${ticks} warmup=${warmup} avgMs=${avg.toFixed(4)} maxMs=${worst.toFixed(4)} thresholds(avg<=${avgThresholdMs},max<=${maxThresholdMs})`
  );

  if (avg > avgThresholdMs || worst > maxThresholdMs) {
    process.exitCode = 1;
    console.error("zoom-stress FAILED threshold");
  }
}

main();
