import type { AngleStyle, CircleStyle, LineStyle, SceneAngle, SceneCircle, SceneLine, SceneSegment } from "../scene/points";

const SEGMENT_MARK_OPTIONS = ["none", "|", "||", "|||", "s", "s|", "s||", "x", "o", "oo", "z"] as const;
const SEGMENT_ARROW_DIRECTIONS = ["->", "<-", "<->"] as const;
const SEGMENT_ARROW_DISTRIBUTIONS = ["single", "multi"] as const;
const SEGMENT_ARROW_WIDTH_UI_FACTOR = 8;

type ObjectStyleSectionsProps = {
  selectedPointPresent: boolean;
  selectedSegment: SceneSegment | null;
  selectedLine: SceneLine | null;
  selectedCircle: SceneCircle | null;
  selectedAngle: SceneAngle | null;
  updateSelectedSegmentStyle: (style: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (style: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (style: Partial<CircleStyle>) => void;
  updateSelectedAngleStyle: (style: Partial<AngleStyle>) => void;
  updateSelectedSegmentFields: (fields: Partial<Pick<SceneSegment, "visible">>) => void;
  updateSelectedLineFields: (fields: Partial<Pick<SceneLine, "visible">>) => void;
  updateSelectedCircleFields: (fields: Partial<Pick<SceneCircle, "visible">>) => void;
  updateSelectedAngleFields: (fields: Partial<Pick<SceneAngle, "visible">>) => void;
  deleteSelectedObject: () => void;
};

export function ObjectStyleSections({
  selectedPointPresent,
  selectedSegment,
  selectedLine,
  selectedCircle,
  selectedAngle,
  updateSelectedSegmentStyle,
  updateSelectedLineStyle,
  updateSelectedCircleStyle,
  updateSelectedAngleStyle,
  updateSelectedSegmentFields,
  updateSelectedLineFields,
  updateSelectedCircleFields,
  updateSelectedAngleFields,
  deleteSelectedObject,
}: ObjectStyleSectionsProps) {
  return (
    <>
      {!selectedPointPresent && !selectedAngle && selectedSegment && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">Segment Style</div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedSegment.visible}
              onChange={(e) => updateSelectedSegmentFields({ visible: e.target.checked })}
            />
            Show Object
          </label>
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedSegment.style.strokeColor}
              onChange={(e) => updateSelectedSegmentStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedSegment.style.strokeWidth}
              onChange={(e) => updateSelectedSegmentStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Dash</label>
            <select
              className="selectInput"
              value={selectedSegment.style.dash}
              onChange={(e) => updateSelectedSegmentStyle({ dash: e.target.value as "solid" | "dashed" | "dotted" })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedSegment.style.opacity}
              onChange={(e) => updateSelectedSegmentStyle({ opacity: Number(e.target.value) })}
            />
          </div>
          <details className="detailsSection">
            <summary className="subSectionTitle detailsSummary">Marking</summary>
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={selectedSegment.style.segmentMark?.enabled ?? false}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        mark: "none",
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      enabled: e.target.checked,
                    },
                  })
                }
              />
              Enable segment mark
            </label>
            <div className="controlRow">
              <label className="controlLabel">Mark Type</label>
              <select
                className="selectInput"
                value={selectedSegment.style.segmentMark?.mark ?? "none"}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      mark: e.target.value as (typeof SEGMENT_MARK_OPTIONS)[number],
                    },
                  })
                }
              >
                {SEGMENT_MARK_OPTIONS.map((mark: string) => (
                  <option key={mark} value={mark}>
                    {mark}
                  </option>
                ))}
              </select>
            </div>
            <div className="controlRow">
              <label className="controlLabel">Mark Pos</label>
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedSegment.style.segmentMark?.pos ?? 0.5}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        sizePt: 4,
                      }),
                      pos: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="controlRow">
              <label className="controlLabel">Mark Size</label>
              <input
                className="sizeSlider"
                type="number"
                min={0}
                max={24}
                step={0.1}
                value={selectedSegment.style.segmentMark?.sizePt ?? 4}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                      }),
                      sizePt: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="controlRow">
              <label className="controlLabel">Mark Color</label>
              <input
                className="colorInput"
                type="color"
                value={selectedSegment.style.segmentMark?.color ?? selectedSegment.style.strokeColor}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      color: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="controlRow">
              <label className="controlLabel">Mark Width</label>
              <input
                className="sizeSlider"
                type="number"
                min={0}
                max={12}
                step={0.1}
                value={selectedSegment.style.segmentMark?.lineWidthPt ?? 1}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentMark: {
                      ...(selectedSegment.style.segmentMark ?? {
                        enabled: true,
                        mark: "|",
                        pos: 0.5,
                        sizePt: 4,
                      }),
                      lineWidthPt: Number(e.target.value),
                    },
                  })
                }
              />
            </div>

            <div className="subSectionTitle" style={{ marginTop: 10 }}>
              Arrow Mark
            </div>
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={selectedSegment.style.segmentArrowMark?.enabled ?? false}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentArrowMark: {
                      ...(selectedSegment.style.segmentArrowMark ?? {
                        mode: "end",
                        direction: "->",
                        distribution: "single",
                        pos: 0.5,
                        startPos: 0.45,
                        endPos: 0.55,
                        step: 0.05,
                      }),
                      enabled: e.target.checked,
                    },
                  })
                }
              />
              Enable arrow mark
            </label>
            <div className="controlRow">
              <label className="controlLabel">Arrow Mode</label>
              <select
                className="selectInput"
                value={selectedSegment.style.segmentArrowMark?.mode ?? "end"}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentArrowMark: {
                      ...(selectedSegment.style.segmentArrowMark ?? {
                        enabled: true,
                        direction: "->",
                        distribution: "single",
                        pos: 0.5,
                        startPos: 0.45,
                        endPos: 0.55,
                        step: 0.05,
                      }),
                      mode: e.target.value as "end" | "mid",
                    },
                  })
                }
              >
                <option value="end">End arrow</option>
                <option value="mid">Mid arrow</option>
              </select>
            </div>
            <div className="controlRow">
              <label className="controlLabel">Direction</label>
              <select
                className="selectInput"
                value={selectedSegment.style.segmentArrowMark?.direction ?? "->"}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentArrowMark: {
                      ...(selectedSegment.style.segmentArrowMark ?? {
                        enabled: true,
                        mode: "end",
                        distribution: "single",
                        pos: 0.5,
                        startPos: 0.45,
                        endPos: 0.55,
                        step: 0.05,
                      }),
                      direction: e.target.value as (typeof SEGMENT_ARROW_DIRECTIONS)[number],
                    },
                  })
                }
              >
                {SEGMENT_ARROW_DIRECTIONS.map((direction: string) => (
                  <option key={direction} value={direction}>
                    {direction}
                  </option>
                ))}
              </select>
            </div>
            <div className="controlRow">
              <label className="controlLabel">Arrow Pos</label>
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedSegment.style.segmentArrowMark?.pos ?? selectedSegment.style.segmentMark?.pos ?? 0.5}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentArrowMark: {
                      ...(selectedSegment.style.segmentArrowMark ?? {
                        enabled: true,
                        mode: "mid",
                        direction: "->",
                        distribution: "single",
                        startPos: 0.45,
                        endPos: 0.55,
                        step: 0.05,
                      }),
                      pos: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="controlRow">
              <label className="controlLabel">Arrow Color</label>
              <input
                className="colorInput"
                type="color"
                value={selectedSegment.style.segmentArrowMark?.color ?? selectedSegment.style.strokeColor}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentArrowMark: {
                      ...(selectedSegment.style.segmentArrowMark ?? {
                        enabled: true,
                        mode: "end",
                        direction: "->",
                        distribution: "single",
                        pos: 0.5,
                        startPos: 0.45,
                        endPos: 0.55,
                        step: 0.05,
                      }),
                      color: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="controlRow">
              <label className="controlLabel">Arrow Width</label>
              <input
                className="sizeSlider"
                type="number"
                min={0}
                max={12}
                step={0.05}
                value={
                  (selectedSegment.style.segmentArrowMark?.lineWidthPt ?? SEGMENT_ARROW_WIDTH_UI_FACTOR) /
                  SEGMENT_ARROW_WIDTH_UI_FACTOR
                }
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentArrowMark: {
                      ...(selectedSegment.style.segmentArrowMark ?? {
                        enabled: true,
                        mode: "end",
                        direction: "->",
                        distribution: "single",
                        pos: 0.5,
                        startPos: 0.45,
                        endPos: 0.55,
                        step: 0.05,
                      }),
                      lineWidthPt: Number(e.target.value) * SEGMENT_ARROW_WIDTH_UI_FACTOR,
                    },
                  })
                }
              />
            </div>
            <div className="controlRow">
              <label className="controlLabel">Arrow Size</label>
              <input
                className="sizeSlider"
                type="number"
                min={0.2}
                max={8}
                step={0.1}
                value={selectedSegment.style.segmentArrowMark?.sizeScale ?? 1}
                onChange={(e) =>
                  updateSelectedSegmentStyle({
                    segmentArrowMark: {
                      ...(selectedSegment.style.segmentArrowMark ?? {
                        enabled: true,
                        mode: "end",
                        direction: "->",
                        distribution: "single",
                        pos: 0.5,
                        startPos: 0.45,
                        endPos: 0.55,
                        step: 0.05,
                        lineWidthPt: SEGMENT_ARROW_WIDTH_UI_FACTOR,
                      }),
                      sizeScale: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            {selectedSegment.style.segmentArrowMark?.mode === "mid" && (
              <>
                <div className="controlRow">
                  <label className="controlLabel">Distribution</label>
                  <select
                    className="selectInput"
                    value={selectedSegment.style.segmentArrowMark?.distribution ?? "single"}
                    onChange={(e) =>
                      updateSelectedSegmentStyle({
                        segmentArrowMark: {
                          ...(selectedSegment.style.segmentArrowMark ?? {
                            enabled: true,
                            mode: "mid",
                            direction: "->",
                            pos: 0.5,
                            startPos: 0.45,
                            endPos: 0.55,
                            step: 0.05,
                          }),
                          distribution: e.target.value as (typeof SEGMENT_ARROW_DISTRIBUTIONS)[number],
                        },
                      })
                    }
                  >
                    {SEGMENT_ARROW_DISTRIBUTIONS.map((distribution: string) => (
                      <option key={distribution} value={distribution}>
                        {distribution}
                      </option>
                    ))}
                  </select>
                </div>
                {(selectedSegment.style.segmentArrowMark?.distribution ?? "single") === "multi" && (
                  <>
                    <div className="controlRow">
                      <label className="controlLabel">Start</label>
                      <input
                        className="sizeSlider"
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedSegment.style.segmentArrowMark?.startPos ?? 0.45}
                        onChange={(e) =>
                          updateSelectedSegmentStyle({
                            segmentArrowMark: {
                              ...(selectedSegment.style.segmentArrowMark ?? {
                                enabled: true,
                                mode: "mid",
                                direction: "->",
                                distribution: "multi",
                                endPos: 0.55,
                                step: 0.05,
                              }),
                              startPos: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="controlRow">
                      <label className="controlLabel">End</label>
                      <input
                        className="sizeSlider"
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedSegment.style.segmentArrowMark?.endPos ?? 0.55}
                        onChange={(e) =>
                          updateSelectedSegmentStyle({
                            segmentArrowMark: {
                              ...(selectedSegment.style.segmentArrowMark ?? {
                                enabled: true,
                                mode: "mid",
                                direction: "->",
                                distribution: "multi",
                                startPos: 0.45,
                                step: 0.05,
                              }),
                              endPos: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="controlRow">
                      <label className="controlLabel">Step</label>
                      <input
                        className="sizeSlider"
                        type="number"
                        min={0.01}
                        max={1}
                        step={0.01}
                        value={selectedSegment.style.segmentArrowMark?.step ?? 0.05}
                        onChange={(e) =>
                          updateSelectedSegmentStyle({
                            segmentArrowMark: {
                              ...(selectedSegment.style.segmentArrowMark ?? {
                                enabled: true,
                                mode: "mid",
                                direction: "->",
                                distribution: "multi",
                                startPos: 0.45,
                                endPos: 0.55,
                              }),
                              step: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </details>
        </div>
      )}

      {!selectedPointPresent && !selectedAngle && selectedLine && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">Line Style</div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedLine.visible}
              onChange={(e) => updateSelectedLineFields({ visible: e.target.checked })}
            />
            Show Object
          </label>
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedLine.style.strokeColor}
              onChange={(e) => updateSelectedLineStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedLine.style.strokeWidth}
              onChange={(e) => updateSelectedLineStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Dash</label>
            <select
              className="selectInput"
              value={selectedLine.style.dash}
              onChange={(e) => updateSelectedLineStyle({ dash: e.target.value as "solid" | "dashed" | "dotted" })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedLine.style.opacity}
              onChange={(e) => updateSelectedLineStyle({ opacity: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {!selectedPointPresent && !selectedAngle && selectedCircle && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">Circle Style</div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedCircle.visible}
              onChange={(e) => updateSelectedCircleFields({ visible: e.target.checked })}
            />
            Show Object
          </label>
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedCircle.style.strokeColor}
              onChange={(e) => updateSelectedCircleStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedCircle.style.strokeWidth}
              onChange={(e) => updateSelectedCircleStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Dash</label>
            <select
              className="selectInput"
              value={selectedCircle.style.strokeDash}
              onChange={(e) =>
                updateSelectedCircleStyle({ strokeDash: e.target.value as "solid" | "dashed" | "dotted" })
              }
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedCircle.style.strokeOpacity}
              onChange={(e) => updateSelectedCircleStyle({ strokeOpacity: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedCircle.style.fillColor ?? "#000000"}
              onChange={(e) => updateSelectedCircleStyle({ fillColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedCircle.style.fillOpacity ?? 0}
              onChange={(e) => updateSelectedCircleStyle({ fillOpacity: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {!selectedPointPresent && selectedAngle && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">Angle Style</div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedAngle.visible}
              onChange={(e) => updateSelectedAngleFields({ visible: e.target.checked })}
            />
            Show Object
          </label>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedAngle.style.showLabel}
              onChange={(e) => updateSelectedAngleStyle({ showLabel: e.target.checked })}
            />
            Show Label
          </label>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedAngle.style.showValue}
              onChange={(e) => updateSelectedAngleStyle({ showValue: e.target.checked })}
            />
            Show Value (deg)
          </label>
          <div className="controlRow">
            <label className="controlLabel">Label Text</label>
            <input
              className="renameInput"
              value={selectedAngle.style.labelText}
              onChange={(e) => updateSelectedAngleStyle({ labelText: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Mark</label>
            <select
              className="selectInput"
              value={selectedAngle.style.markStyle}
              onChange={(e) => updateSelectedAngleStyle({ markStyle: e.target.value as "arc" | "right" | "none" })}
            >
              <option value="arc">Arc</option>
              <option value="right">Right</option>
              <option value="none">None</option>
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Arc Radius</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.2}
              max={4}
              step={0.05}
              value={selectedAngle.style.arcRadius}
              onChange={(e) => updateSelectedAngleStyle({ arcRadius: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAngle.style.strokeColor}
              onChange={(e) => updateSelectedAngleStyle({ strokeColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Stroke Width</label>
            <input
              className="sizeSlider"
              type="range"
              min={0.5}
              max={6}
              step={0.1}
              value={selectedAngle.style.strokeWidth}
              onChange={(e) => updateSelectedAngleStyle({ strokeWidth: Number(e.target.value) })}
            />
          </div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedAngle.style.fillEnabled}
              onChange={(e) => updateSelectedAngleStyle({ fillEnabled: e.target.checked })}
            />
            Fill Angle
          </label>
          <div className="controlRow">
            <label className="controlLabel">Fill Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAngle.style.fillColor}
              onChange={(e) => updateSelectedAngleStyle({ fillColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Opacity</label>
            <input
              className="sizeSlider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedAngle.style.fillOpacity}
              onChange={(e) => updateSelectedAngleStyle({ fillOpacity: Number(e.target.value) })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Text Color</label>
            <input
              className="colorInput"
              type="color"
              value={selectedAngle.style.textColor}
              onChange={(e) => updateSelectedAngleStyle({ textColor: e.target.value })}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Text Size</label>
            <input
              className="sizeSlider"
              type="range"
              min={8}
              max={42}
              step={1}
              value={selectedAngle.style.textSize}
              onChange={(e) => updateSelectedAngleStyle({ textSize: Number(e.target.value) })}
            />
          </div>
          <button className="deleteButton" onClick={deleteSelectedObject}>
            Delete
          </button>
        </div>
      )}
    </>
  );
}
