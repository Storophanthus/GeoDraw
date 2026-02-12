import type { Vec2 } from "../../geo/vec2";
import { projectPointToCircle, projectPointToLine, projectPointToSegment } from "../../geo/geometry";
import { getCircleWorldGeometry, getLineWorldAnchors, getPointWorldPos, type AngleStyle, type CircleStyle, type LineStyle, type PointStyle, type SceneModel } from "../../scene/points";
import { applyDeletion, collectCascadeDelete, isSelectedObjectAlive } from "../../domain/geometryGraph";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type SetState = (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;

export function createSceneMutationActions({
  setState,
}: {
  setState: SetState;
}): Pick<
  GeoActions,
  | "movePointTo"
  | "movePointLabelBy"
  | "moveAngleLabelTo"
  | "updateSelectedPointStyle"
  | "updateSelectedPointFields"
  | "updateSelectedSegmentStyle"
  | "updateSelectedLineStyle"
  | "updateSelectedCircleStyle"
  | "updateSelectedAngleStyle"
  | "updateSelectedSegmentFields"
  | "updateSelectedLineFields"
  | "updateSelectedCircleFields"
  | "updateSelectedAngleFields"
  | "deleteSelectedObject"
  | "setCopyStyleSource"
  | "applyCopyStyleTo"
  | "clearCopyStyle"
> {
  return {
    movePointTo(id, world) {
      setState((prev) => {
        const nextPoints = prev.scene.points.map((point) => {
          if (point.id !== id) return point;
          if (point.locked) return point;
          if (point.kind === "free") return { ...point, position: world };

          if (point.kind === "pointOnLine") {
            const line = prev.scene.lines.find((item) => item.id === point.lineId);
            if (!line) return point;
            const anchors = getLineWorldAnchors(line, prev.scene);
            if (!anchors) return point;
            const pr = projectPointToLine(world, anchors.a, anchors.b);
            return { ...point, s: pr.s };
          }

          if (point.kind === "pointOnSegment") {
            const seg = prev.scene.segments.find((item) => item.id === point.segId);
            if (!seg) return point;
            const a = getPointWorldById(prev.scene, seg.aId);
            const b = getPointWorldById(prev.scene, seg.bId);
            if (!a || !b) return point;
            const pr = projectPointToSegment(world, a, b);
            return { ...point, u: pr.u };
          }

          if (point.kind === "pointOnCircle") {
            const circle = prev.scene.circles.find((item) => item.id === point.circleId);
            if (!circle) return point;
            const geom = getCircleWorldGeometry(circle, prev.scene);
            if (!geom) return point;
            const pr = projectPointToCircle(world, geom.center, geom.radius);
            return { ...point, t: pr.t };
          }

          return point;
        });
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: nextPoints,
          },
        };
      }, { history: "coalesce", actionKey: `movePointTo:${id}` });
    },

    movePointLabelBy(id, deltaPx) {
      setState((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          points: prev.scene.points.map((point) =>
            point.id === id
              ? {
                  ...point,
                  style: {
                    ...point.style,
                    labelOffsetPx: {
                      x: point.style.labelOffsetPx.x + deltaPx.x,
                      y: point.style.labelOffsetPx.y + deltaPx.y,
                    },
                  },
                }
              : point
          ),
        },
      }), { history: "coalesce", actionKey: `movePointLabelBy:${id}` });
    },

    moveAngleLabelTo(id, world) {
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            angles: prev.scene.angles.map((angle) =>
              angle.id === id
                ? {
                    ...angle,
                    style: {
                      ...angle.style,
                      labelPosWorld: { x: world.x, y: world.y },
                    },
                  }
                : angle
            ),
          },
        }),
        { history: "coalesce", actionKey: `moveAngleLabelTo:${id}` }
      );
    },

    updateSelectedPointStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "point") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: prev.scene.points.map((point) =>
              point.id === prev.selectedObject!.id
                ? {
                    ...point,
                    style: {
                      ...point.style,
                      ...next,
                    },
                  }
                : point
            ),
          },
        };
      });
    },

    updateSelectedPointFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "point") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: prev.scene.points.map((point) =>
              point.id === prev.selectedObject!.id
                ? {
                    ...point,
                    ...next,
                  }
                : point
            ),
          },
        };
      });
    },

    updateSelectedSegmentStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "segment") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: prev.scene.segments.map((seg) =>
              seg.id === prev.selectedObject!.id ? { ...seg, style: { ...seg.style, ...next } } : seg
            ),
          },
        };
      });
    },

    updateSelectedLineStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "line") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: prev.scene.lines.map((line) =>
              line.id === prev.selectedObject!.id ? { ...line, style: { ...line.style, ...next } } : line
            ),
          },
        };
      });
    },

    updateSelectedCircleStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "circle") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: prev.scene.circles.map((circle) =>
              circle.id === prev.selectedObject!.id ? { ...circle, style: { ...circle.style, ...next } } : circle
            ),
          },
        };
      });
    },

    updateSelectedAngleStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "angle") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles: prev.scene.angles.map((angle) =>
              angle.id === prev.selectedObject!.id ? { ...angle, style: { ...angle.style, ...next } } : angle
            ),
          },
        };
      });
    },

    updateSelectedSegmentFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "segment") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: prev.scene.segments.map((seg) =>
              seg.id === prev.selectedObject!.id ? { ...seg, ...next } : seg
            ),
          },
        };
      });
    },

    updateSelectedLineFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "line") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: prev.scene.lines.map((line) =>
              line.id === prev.selectedObject!.id ? { ...line, ...next } : line
            ),
          },
        };
      });
    },

    updateSelectedCircleFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "circle") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: prev.scene.circles.map((circle) =>
              circle.id === prev.selectedObject!.id ? { ...circle, ...next } : circle
            ),
          },
        };
      });
    },

    updateSelectedAngleFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "angle") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles: prev.scene.angles.map((angle) =>
              angle.id === prev.selectedObject!.id ? { ...angle, ...next } : angle
            ),
          },
        };
      });
    },

    deleteSelectedObject() {
      setState((prev) => {
        if (!prev.selectedObject) return prev;
        const deleted = collectCascadeDelete(prev.scene, prev.selectedObject);
        const nextScene = applyDeletion(prev.scene, deleted);
        return {
          ...prev,
          scene: nextScene,
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle: isSelectedObjectAlive(nextScene, prev.copyStyle.source)
            ? prev.copyStyle
            : { source: null, pointStyle: null, lineStyle: null, circleStyle: null, angleStyle: null, showLabel: null },
        };
      });
    },

    setCopyStyleSource(obj) {
      setState((prev) => {
        if (obj.type === "point") {
          const point = prev.scene.points.find((item) => item.id === obj.id);
          if (!point) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: {
                ...point.style,
                labelOffsetPx: { ...point.style.labelOffsetPx },
              },
              lineStyle: null,
              circleStyle: null,
              angleStyle: null,
              showLabel: point.showLabel,
            },
          };
        }

        if (obj.type === "segment") {
          const segment = prev.scene.segments.find((item) => item.id === obj.id);
          if (!segment) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: { ...segment.style },
              circleStyle: circleStyleFromLineStyle(segment.style),
              angleStyle: angleStyleFromLineStyle(segment.style),
              showLabel: null,
            },
          };
        }

        if (obj.type === "circle") {
          const circle = prev.scene.circles.find((item) => item.id === obj.id);
          if (!circle) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: lineStyleFromCircleStyle(circle.style),
              circleStyle: { ...circle.style },
              angleStyle: angleStyleFromCircleStyle(circle.style),
              showLabel: null,
            },
          };
        }

        if (obj.type === "angle") {
          const angle = prev.scene.angles.find((item) => item.id === obj.id);
          if (!angle) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: {
                strokeColor: angle.style.strokeColor,
                strokeWidth: angle.style.strokeWidth,
                dash: "solid",
                opacity: angle.style.strokeOpacity,
              },
              circleStyle: {
                strokeColor: angle.style.strokeColor,
                strokeWidth: angle.style.strokeWidth,
                strokeDash: "solid",
                strokeOpacity: angle.style.strokeOpacity,
                fillColor: angle.style.fillColor,
                fillOpacity: angle.style.fillOpacity,
              },
              angleStyle: {
                ...angle.style,
                labelPosWorld: { ...angle.style.labelPosWorld },
              },
              showLabel: null,
            },
          };
        }

        const line = prev.scene.lines.find((item) => item.id === obj.id);
        if (!line) return prev;
        return {
          ...prev,
          copyStyle: {
            source: obj,
            pointStyle: null,
            lineStyle: { ...line.style },
            circleStyle: circleStyleFromLineStyle(line.style),
            angleStyle: angleStyleFromLineStyle(line.style),
            showLabel: null,
          },
        };
      });
    },

    applyCopyStyleTo(obj) {
      setState((prev) => {
        if (obj.type === "point") {
          const sourcePointStyle =
            prev.copyStyle.pointStyle ??
            (prev.copyStyle.lineStyle ? pointStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
            (prev.copyStyle.circleStyle ? pointStyleFromCircleStyle(prev.copyStyle.circleStyle) : null);
          if (!sourcePointStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              points: prev.scene.points.map((point) =>
                point.id !== obj.id
                  ? point
                  : {
                      ...point,
                      showLabel: prev.copyStyle.showLabel ?? point.showLabel,
                      style: {
                        ...point.style,
                        ...sourcePointStyle,
                        labelOffsetPx: { ...point.style.labelOffsetPx },
                      },
                    }
              ),
            },
          };
        }

        if (obj.type === "segment") {
          const sourceLineStyle =
            prev.copyStyle.lineStyle ??
            (prev.copyStyle.circleStyle ? lineStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
            (prev.copyStyle.pointStyle ? lineStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
          if (!sourceLineStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              segments: prev.scene.segments.map((segment) =>
                segment.id === obj.id ? { ...segment, style: { ...segment.style, ...sourceLineStyle } } : segment
              ),
            },
          };
        }

        if (obj.type === "circle") {
          const sourceCircleStyle =
            prev.copyStyle.circleStyle ??
            (prev.copyStyle.lineStyle ? circleStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
            (prev.copyStyle.pointStyle ? circleStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
          if (!sourceCircleStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              circles: prev.scene.circles.map((circle) =>
                circle.id === obj.id ? { ...circle, style: { ...circle.style, ...sourceCircleStyle } } : circle
              ),
            },
          };
        }

        if (obj.type === "angle") {
          const sourceAngleStyle =
            prev.copyStyle.angleStyle ??
            (prev.copyStyle.lineStyle ? angleStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
            (prev.copyStyle.circleStyle ? angleStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
            (prev.copyStyle.pointStyle ? angleStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
          if (!sourceAngleStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              angles: prev.scene.angles.map((angle) =>
                angle.id === obj.id
                  ? {
                      ...angle,
                      style: {
                        ...angle.style,
                        ...sourceAngleStyle,
                        labelPosWorld: { ...angle.style.labelPosWorld },
                      },
                    }
                  : angle
              ),
            },
          };
        }

        const sourceLineStyle =
          prev.copyStyle.lineStyle ??
          (prev.copyStyle.circleStyle ? lineStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
          (prev.copyStyle.pointStyle ? lineStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
        if (!sourceLineStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: prev.scene.lines.map((line) =>
              line.id === obj.id ? { ...line, style: { ...line.style, ...sourceLineStyle } } : line
            ),
          },
        };
      });
    },

    clearCopyStyle() {
      setState((prev) => ({
        ...prev,
        copyStyle: {
          source: null,
          pointStyle: null,
          lineStyle: null,
          circleStyle: null,
          angleStyle: null,
          showLabel: null,
        },
      }));
    },
  };
}

function getPointWorldById(scene: SceneModel, pointId: string): Vec2 | null {
  const point = scene.points.find((p) => p.id === pointId);
  if (!point) return null;
  return getPointWorldPos(point, scene);
}

function circleStyleFromLineStyle(style: LineStyle): CircleStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: style.dash,
    strokeOpacity: style.opacity,
  };
}

function lineStyleFromCircleStyle(style: CircleStyle): LineStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: style.strokeDash,
    opacity: style.strokeOpacity,
  };
}

function lineStyleFromPointStyle(style: PointStyle): LineStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: "solid",
    opacity: style.strokeOpacity,
  };
}

function circleStyleFromPointStyle(style: PointStyle): CircleStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: "solid",
    strokeOpacity: style.strokeOpacity,
  };
}

function pointStyleFromLineStyle(style: LineStyle): Partial<PointStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.opacity,
    fillColor: style.strokeColor,
    fillOpacity: style.opacity,
  };
}

function pointStyleFromCircleStyle(style: CircleStyle): Partial<PointStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor ?? style.strokeColor,
    fillOpacity: style.fillOpacity ?? style.strokeOpacity,
  };
}

function angleStyleFromLineStyle(style: LineStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.opacity,
  };
}

function angleStyleFromCircleStyle(style: CircleStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor ?? style.strokeColor,
    fillOpacity: style.fillOpacity ?? style.strokeOpacity,
  };
}

function angleStyleFromPointStyle(style: PointStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    textColor: style.labelColor,
    textSize: style.labelFontPx,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
  };
}
