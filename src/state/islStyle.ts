import type { SceneModel } from "../scene/points";
import type { SceneStyleDefaults } from "./colorProfiles";

// ISL 2018 G1: substantial black dots, firm strokes, and clear math labels.
// These are logical canvas pixels, adapted to the app's working scale.
const POINT = { shape: "circle", sizePx: 3.5, strokeWidth: 0.6, labelFontPx: 28, labelHaloWidthPx: 1.5 } as const;
const SEGMENT = { strokeWidth: 2.2 };
const LINE = { strokeWidth: 1.8 };
const CURVE = { strokeWidth: 2.2, fillOpacity: 0 };
const POLYGON = { strokeWidth: 2.2, fillOpacity: 0 };
const ANGLE = { strokeWidth: 1.6, textSize: 20, fillEnabled: false, markSize: 6 };

export function withIslStyle(defaults: SceneStyleDefaults): SceneStyleDefaults {
  return {
    ...defaults,
    pointDefaults: { ...defaults.pointDefaults, ...POINT },
    segmentDefaults: { ...defaults.segmentDefaults, ...SEGMENT },
    lineDefaults: { ...defaults.lineDefaults, ...LINE },
    circleDefaults: { ...defaults.circleDefaults, ...CURVE },
    ellipseDefaults: { ...defaults.ellipseDefaults, ...CURVE },
    polygonDefaults: { ...defaults.polygonDefaults, ...POLYGON },
    angleDefaults: { ...defaults.angleDefaults, ...ANGLE, showValue: false },
  };
}

function restyle<T extends { style: object }>(objects: T[], style: object): T[] {
  return objects.map((object) => ({ ...object, style: { ...object.style, ...style } }));
}

/** Explicit preset application only; loading a file must retain its saved styles. */
export function applyIslStyleToScene(scene: SceneModel): SceneModel {
  return {
    ...scene,
    points: scene.points.map((point) => {
      const mathName = point.showLabel === "name" && (!point.captionTex || point.captionTex === point.name);
      return {
        ...point,
        showLabel: mathName ? "caption" : point.showLabel,
        captionTex: mathName ? point.name : point.captionTex,
        style: { ...point.style, ...POINT },
      };
    }),
    segments: restyle(scene.segments, SEGMENT),
    lines: restyle(scene.lines, LINE),
    circles: restyle(scene.circles, CURVE),
    ellipses: scene.ellipses ? restyle(scene.ellipses, CURVE) : scene.ellipses,
    polygons: restyle(scene.polygons, POLYGON),
    angles: restyle(scene.angles, ANGLE),
  };
}
