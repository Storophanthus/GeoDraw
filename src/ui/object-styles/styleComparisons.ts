import { type PointStyle, type SceneModel } from "../../scene/points";

export function pointStyleEqual(a: PointStyle, b: PointStyle): boolean {
    return (
        a.shape === b.shape &&
        a.sizePx === b.sizePx &&
        a.strokeColor === b.strokeColor &&
        a.strokeWidth === b.strokeWidth &&
        a.strokeOpacity === b.strokeOpacity &&
        a.fillColor === b.fillColor &&
        a.fillOpacity === b.fillOpacity &&
        a.labelFontPx === b.labelFontPx &&
        a.labelHaloWidthPx === b.labelHaloWidthPx &&
        a.labelHaloColor === b.labelHaloColor &&
        a.labelColor === b.labelColor &&
        a.labelOffsetPx.x === b.labelOffsetPx.x &&
        a.labelOffsetPx.y === b.labelOffsetPx.y
    );
}

export function lineStyleEqual(a: SceneModel["segments"][number]["style"], b: SceneModel["segments"][number]["style"]): boolean {
    return (
        a.strokeColor === b.strokeColor &&
        a.strokeWidth === b.strokeWidth &&
        a.dash === b.dash &&
        a.opacity === b.opacity &&
        JSON.stringify(a.segmentMark ?? null) === JSON.stringify(b.segmentMark ?? null) &&
        JSON.stringify(a.segmentMarks ?? null) === JSON.stringify(b.segmentMarks ?? null) &&
        JSON.stringify(a.segmentArrowMark ?? null) === JSON.stringify(b.segmentArrowMark ?? null) &&
        JSON.stringify(a.segmentArrowMarks ?? null) === JSON.stringify(b.segmentArrowMarks ?? null)
    );
}

export function circleStyleEqual(a: SceneModel["circles"][number]["style"], b: SceneModel["circles"][number]["style"]): boolean {
    return (
        a.strokeColor === b.strokeColor &&
        a.strokeWidth === b.strokeWidth &&
        a.strokeDash === b.strokeDash &&
        a.strokeOpacity === b.strokeOpacity &&
        (a.fillColor ?? "") === (b.fillColor ?? "") &&
        (a.fillOpacity ?? 0) === (b.fillOpacity ?? 0) &&
        (a.pattern ?? "") === (b.pattern ?? "") &&
        (a.patternColor ?? "") === (b.patternColor ?? "") &&
        JSON.stringify(a.arrowMark ?? null) === JSON.stringify(b.arrowMark ?? null)
    );
}

export function polygonStyleEqual(a: SceneModel["polygons"][number]["style"], b: SceneModel["polygons"][number]["style"]): boolean {
    return (
        a.strokeColor === b.strokeColor &&
        a.strokeWidth === b.strokeWidth &&
        a.strokeDash === b.strokeDash &&
        a.strokeOpacity === b.strokeOpacity &&
        (a.fillColor ?? "") === (b.fillColor ?? "") &&
        (a.fillOpacity ?? 0) === (b.fillOpacity ?? 0) &&
        (a.pattern ?? "") === (b.pattern ?? "") &&
        (a.patternColor ?? "") === (b.patternColor ?? "") &&
        JSON.stringify(a.arrowMark ?? null) === JSON.stringify(b.arrowMark ?? null)
    );
}

export function angleStyleEqual(a: SceneModel["angles"][number]["style"], b: SceneModel["angles"][number]["style"]): boolean {
    return (
        a.strokeColor === b.strokeColor &&
        a.strokeWidth === b.strokeWidth &&
        (a.strokeDash ?? "solid") === (b.strokeDash ?? "solid") &&
        a.strokeOpacity === b.strokeOpacity &&
        a.textColor === b.textColor &&
        a.textSize === b.textSize &&
        a.fillEnabled === b.fillEnabled &&
        a.fillColor === b.fillColor &&
        a.fillOpacity === b.fillOpacity &&
        a.markStyle === b.markStyle &&
        a.markSymbol === b.markSymbol &&
        a.arcMultiplicity === b.arcMultiplicity &&
        a.markPos === b.markPos &&
        a.markSize === b.markSize &&
        a.markColor === b.markColor &&
        a.arcRadius === b.arcRadius &&
        a.labelText === b.labelText &&
        a.showLabel === b.showLabel &&
        a.showValue === b.showValue &&
        Boolean(a.promoteToSolid) === Boolean(b.promoteToSolid) &&
        JSON.stringify(a.angleMarks ?? null) === JSON.stringify(b.angleMarks ?? null) &&
        JSON.stringify(a.arcArrowMark ?? null) === JSON.stringify(b.arcArrowMark ?? null) &&
        JSON.stringify(a.arcArrowMarks ?? null) === JSON.stringify(b.arcArrowMarks ?? null)
    );
}
