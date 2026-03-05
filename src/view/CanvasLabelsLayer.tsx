import type { RefObject } from "react";
import type { AngleLabelOverlay, ObjectLabelOverlay, PointLabelOverlay, TextLabelOverlay } from "./labelOverlays";

type CanvasLabelsLayerProps = {
  labelsLayerRef: RefObject<HTMLDivElement | null>;
  labelOverlays: PointLabelOverlay[];
  angleLabelOverlays: AngleLabelOverlay[];
  objectLabelOverlays: ObjectLabelOverlay[];
  textLabelOverlays: TextLabelOverlay[];
  selectedTextLabelId: string | null;
};

export function CanvasLabelsLayer({
  labelsLayerRef,
  labelOverlays,
  angleLabelOverlays,
  objectLabelOverlays,
  textLabelOverlays,
  selectedTextLabelId,
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
      {objectLabelOverlays.map((label) => (
        <div
          key={`${label.type}:${label.id}`}
          className="pointLabel tex"
          data-object-type={label.type}
          data-object-id={label.id}
          style={{
            transform: `translate(${label.x}px, ${label.y}px)`,
            fontSize: `${Math.max(8, label.textSize)}px`,
            color: label.textColor,
          }}
          dangerouslySetInnerHTML={{ __html: label.html }}
        />
      ))}
      {textLabelOverlays.map((label) => (
        <div
          key={label.id}
          className={label.id === selectedTextLabelId ? "pointLabel tex selectedTextLabel" : "pointLabel tex"}
          data-text-label-id={label.id}
          style={{
            transform: `translate(${label.x}px, ${label.y}px) translate(-50%, -50%) rotate(${label.rotationDeg}deg)`,
            transformOrigin: "center center",
            fontSize: `${Math.max(8, label.textSize)}px`,
            color: label.textColor,
          }}
          dangerouslySetInnerHTML={{ __html: label.html }}
        />
      ))}
    </div>
  );
}
