import type { RefObject } from "react";
import type { AngleLabelOverlay, PointLabelOverlay } from "./labelOverlays";

type CanvasLabelsLayerProps = {
  labelsLayerRef: RefObject<HTMLDivElement | null>;
  labelOverlays: PointLabelOverlay[];
  angleLabelOverlays: AngleLabelOverlay[];
};

export function CanvasLabelsLayer({
  labelsLayerRef,
  labelOverlays,
  angleLabelOverlays,
}: CanvasLabelsLayerProps) {
  return (
    <div className="labelsLayer" aria-hidden ref={labelsLayerRef}>
      {labelOverlays.map((label) => (
        <div
          key={label.id}
          className="pointLabel tex"
          data-point-id={label.id}
          style={{
            transform: `translate(${label.x}px, ${label.y}px)`,
            fontSize: `${label.labelFontPx}px`,
            color: label.labelColor,
            textShadow: `${label.labelHaloColor} 0 0 ${label.labelHaloWidthPx}px, ${label.labelHaloColor} 0 0 ${Math.max(
              1,
              label.labelHaloWidthPx * 0.6
            )}px`,
          }}
          dangerouslySetInnerHTML={{ __html: label.html }}
        />
      ))}
      {angleLabelOverlays.map((label) => (
        <div
          key={label.id}
          className="pointLabel tex"
          data-angle-id={label.id}
          style={{
            transform: `translate(${label.x}px, ${label.y}px)`,
            fontSize: `${Math.max(8, label.textSize)}px`,
            color: label.textColor,
          }}
          dangerouslySetInnerHTML={{ __html: label.html }}
        />
      ))}
    </div>
  );
}
