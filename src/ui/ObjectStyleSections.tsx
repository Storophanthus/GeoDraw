import type {
  AngleMarkSymbol,
  AngleStyle,
  CircleStyle,
  LineStyle,
  SceneAngle,
  SceneCircle,
  SceneLine,
  SceneSegment,
} from "../scene/points";

const SEGMENT_MARK_OPTIONS = ["none", "|", "||", "|||", "s", "s|", "s||", "x", "o", "oo", "z"] as const;
const SEGMENT_ARROW_DIRECTIONS = ["->", "<-", "<->"] as const;
const SEGMENT_ARROW_DISTRIBUTIONS = ["single", "multi"] as const;
const FILL_PATTERN_OPTIONS = [
  { value: "", label: "None" },
  { value: "north east lines", label: "North East Lines" },
  { value: "north west lines", label: "North West Lines" },
  { value: "grid", label: "Grid" },
  { value: "crosshatch", label: "Crosshatch" },
  { value: "dots", label: "Dots" },
] as const;
const SEGMENT_ARROW_WIDTH_UI_FACTOR = 8;
const ARC_VARIANT_OPTIONS = [
  { value: "vanilla", label: "Vanilla Arc" },
  { value: "bars1", label: 'Arc + "|"' },
  { value: "bars2", label: 'Arc + "||"' },
  { value: "bars3", label: 'Arc + "|||"' },
  { value: "double", label: "Double Arc" },
  { value: "triple", label: "Triple Arc" },
  { value: "none", label: "None" },
] as const;

type ObjectStyleSectionsProps = {
  selectedPointPresent: boolean;
  selectedSegment: SceneSegment | null;
  selectedLine: SceneLine | null;
  selectedCircle: SceneCircle | null;
  selectedAngle: SceneAngle | null;
  selectedAngleRightStatus: "none" | "approx" | "exact";
  updateSelectedSegmentStyle: (style: Partial<LineStyle>) => void;
  updateSelectedLineStyle: (style: Partial<LineStyle>) => void;
  updateSelectedCircleStyle: (style: Partial<CircleStyle>) => void;
  updateSelectedAngleStyle: (style: Partial<AngleStyle>) => void;
  deleteSelectedObject: () => void;
};

export function ObjectStyleSections({
  selectedPointPresent,
  selectedSegment,
  selectedLine,
  selectedCircle,
  selectedAngle,
  selectedAngleRightStatus,
  updateSelectedSegmentStyle,
  updateSelectedLineStyle,
  updateSelectedCircleStyle,
  updateSelectedAngleStyle,
  deleteSelectedObject,
}: ObjectStyleSectionsProps) {
  const selectedAngleIsRight = selectedAngleRightStatus !== "none";
  const selectedAngleIsRightExact = selectedAngleRightStatus === "exact";
  const selectedAngleIsSector = selectedAngle?.kind === "sector";
  const angleArcVariant =
    selectedAngle?.style.markStyle === "none"
      ? "none"
      : selectedAngle?.style.arcMultiplicity === 3
      ? "triple"
      : selectedAngle?.style.arcMultiplicity === 2
      ? "double"
      : selectedAngle?.style.markSymbol === "|||"
      ? "bars3"
      : selectedAngle?.style.markSymbol === "||"
      ? "bars2"
      : selectedAngle?.style.markSymbol === "|"
      ? "bars1"
      : "vanilla";

  const updateAngleArcVariant = (variant: string) => {
    if (!selectedAngle) return;
    if (variant === "none") {
      updateSelectedAngleStyle({ markStyle: "none" });
      return;
    }
    if (variant === "double") {
      updateSelectedAngleStyle({ markStyle: "arc", arcMultiplicity: 2, markSymbol: "none" });
      return;
    }
    if (variant === "triple") {
      updateSelectedAngleStyle({ markStyle: "arc", arcMultiplicity: 3, markSymbol: "none" });
      return;
    }
    const markSymbol: AngleMarkSymbol =
      variant === "bars1" ? "|" : variant === "bars2" ? "||" : variant === "bars3" ? "|||" : "none";
    updateSelectedAngleStyle({ markStyle: "arc", arcMultiplicity: 1, markSymbol });
  };

  return (
    <>
      {!selectedPointPresent && !selectedAngle && selectedSegment && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">Segment Style</div>
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
              value={selectedCircle.style.fillColor ?? "#FFFFFF"}
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
              onChange={(e) =>
                updateSelectedCircleStyle({
                  fillOpacity: Number(e.target.value),
                  fillColor: selectedCircle.style.fillColor ?? "#FFFFFF",
                })
              }
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Fill Pattern</label>
            <select
              className="selectInput"
              value={selectedCircle.style.pattern ?? ""}
              onChange={(e) => updateSelectedCircleStyle({ pattern: e.target.value })}
            >
              {FILL_PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(selectedCircle.style.pattern ?? "") !== "" && (
            <div className="controlRow">
              <label className="controlLabel">Pattern Color</label>
              <input
                className="colorInput"
                type="color"
                value={selectedCircle.style.patternColor ?? selectedCircle.style.strokeColor}
                onChange={(e) => updateSelectedCircleStyle({ patternColor: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {!selectedPointPresent && selectedAngle && (
        <div className="cosmeticsBlock">
          <div className="subSectionTitle">{selectedAngleIsSector ? "Sector Style" : "Angle Style"}</div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={selectedAngle.style.showLabel}
              onChange={(e) => updateSelectedAngleStyle({ showLabel: e.target.checked })}
            />
            Show Label
          </label>
          {!selectedAngleIsSector && (
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={selectedAngle.style.showValue}
                onChange={(e) => updateSelectedAngleStyle({ showValue: e.target.checked })}
              />
              Show Value (deg)
            </label>
          )}
          <div className="controlRow">
            <label className="controlLabel">Label Text</label>
            <input
              className="renameInput"
              value={selectedAngle.style.labelText}
              onChange={(e) => updateSelectedAngleStyle({ labelText: e.target.value })}
            />
          </div>
          {!selectedAngleIsSector && (
            <>
              <div className="controlRow">
                <label className="controlLabel">Mark</label>
                {selectedAngleIsRight ? (
                  <select
                    className="selectInput"
                    value={
                      selectedAngle.style.markStyle === "none"
                        ? "none"
                        : selectedAngle.style.markStyle === "right" || selectedAngle.style.markStyle === "arc"
                        ? "rightSquare"
                        : selectedAngle.style.markStyle
                    }
                    onChange={(e) =>
                      updateSelectedAngleStyle({
                        markStyle: e.target.value as "rightSquare" | "rightArcDot" | "none",
                        arcMultiplicity: 1,
                        markSymbol: "none",
                      })
                    }
                  >
                    <option value="rightSquare">RightSquare</option>
                    <option value="rightArcDot">RightArcDot</option>
                    <option value="none">None</option>
                  </select>
                ) : (
                  <select className="selectInput" value={angleArcVariant} onChange={(e) => updateAngleArcVariant(e.target.value)}>
                    {ARC_VARIANT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {selectedAngleIsRight && (
                <label className="checkboxRow">
                  <input
                    type="checkbox"
                    checked={selectedAngleIsRightExact || Boolean(selectedAngle.style.promoteToSolid)}
                    disabled={selectedAngleIsRightExact}
                    onChange={(e) => updateSelectedAngleStyle({ promoteToSolid: e.target.checked })}
                  />
                  Promote to solid
                </label>
              )}
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
              {!selectedAngleIsRight && (
                <>
                  <div className="controlRow">
                    <label className="controlLabel">Mark Position</label>
                    <input
                      className="sizeSlider"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedAngle.style.markPos ?? 0.5}
                      onChange={(e) => updateSelectedAngleStyle({ markPos: Number(e.target.value) })}
                    />
                  </div>
                  <div className="controlRow">
                    <label className="controlLabel">Mark Size</label>
                    <input
                      className="sizeSlider"
                      type="range"
                      min={1}
                      max={12}
                      step={0.1}
                      value={selectedAngle.style.markSize ?? 4}
                      onChange={(e) => updateSelectedAngleStyle({ markSize: Number(e.target.value) })}
                    />
                  </div>
                  <div className="controlRow">
                    <label className="controlLabel">Mark Color</label>
                    <input
                      className="colorInput"
                      type="color"
                      value={selectedAngle.style.markColor ?? selectedAngle.style.strokeColor}
                      onChange={(e) => updateSelectedAngleStyle({ markColor: e.target.value })}
                    />
                  </div>
                </>
              )}
            </>
          )}
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
            {selectedAngleIsSector ? "Fill Sector" : "Fill Angle"}
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
            <label className="controlLabel">Fill Pattern</label>
            <select
              className="selectInput"
              value={selectedAngle.style.pattern ?? ""}
              onChange={(e) => updateSelectedAngleStyle({ pattern: e.target.value })}
            >
              {FILL_PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(selectedAngle.style.pattern ?? "") !== "" && (
            <div className="controlRow">
              <label className="controlLabel">Pattern Color</label>
              <input
                className="colorInput"
                type="color"
                value={selectedAngle.style.patternColor ?? selectedAngle.style.strokeColor}
                onChange={(e) => updateSelectedAngleStyle({ patternColor: e.target.value })}
              />
            </div>
          )}
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
