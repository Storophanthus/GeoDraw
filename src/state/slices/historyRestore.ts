import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import { resolveIntersectionBranchIndexInScene } from "../../domain/intersectionReuse";
import type { GeoState } from "./storeTypes";
import type { HistorySnapshot } from "./historySlice";
import {
  DEFAULT_COLOR_PROFILE_ID,
  normalizeLabelColorForProfile,
  normalizeSceneLabelColors,
} from "../colorProfiles";
import { createSceneSliceState } from "./sceneSlice";
import { createUiSliceState } from "./uiSlice";

export function restoreGeoStateFromSnapshot(prev: GeoState, snapshot: HistorySnapshot): GeoState {
  const fallbackSceneState = createSceneSliceState();
  const fallbackUiState = createUiSliceState();
  const normalizedScene = normalizeSceneIntegrity(snapshot.scene);
  const colorProfileId = snapshot.colorProfileId ?? DEFAULT_COLOR_PROFILE_ID;
  const sceneWithBranches = normalizeSceneLabelColors({
    ...normalizedScene,
    points: normalizedScene.points.map((point) => {
      if (
        point.kind !== "intersectionPoint" ||
        (Number.isInteger(point.branchIndex) && (point.branchIndex as number) >= 0)
      ) {
        return point;
      }
      const branchIndex = resolveIntersectionBranchIndexInScene(normalizedScene, point.objA, point.objB, point.preferredWorld);
      if (branchIndex === null) return point;
      return { ...point, branchIndex };
    }),
    segments: normalizedScene.segments.map((seg) => {
      const needsArrowMigration = !seg.style.segmentArrowMarks?.length && Boolean(seg.style.segmentArrowMark);
      const needsMarkMigration = !seg.style.segmentMarks?.length && Boolean(seg.style.segmentMark);
      if (!needsArrowMigration && !needsMarkMigration) return seg;
      return {
        ...seg,
        style: {
          ...seg.style,
          segmentArrowMarks: needsArrowMigration ? migrateArrowMark(seg.style.segmentArrowMark!) : seg.style.segmentArrowMarks,
          segmentMarks: needsMarkMigration ? [seg.style.segmentMark!] : seg.style.segmentMarks,
        },
      };
    }),
    circles: normalizedScene.circles.map((c) => {
      if (c.style.arrowMarks?.length) return c;
      if (!c.style.arrowMark) return c;
      return {
        ...c,
        style: {
          ...c.style,
          arrowMarks: migrateArrowMark(c.style.arrowMark),
        },
      };
    }),
    ellipses: (normalizedScene.ellipses ?? []).map((ellipse) => {
      if (ellipse.style.arrowMarks?.length) return ellipse;
      if (!ellipse.style.arrowMark) return ellipse;
      return {
        ...ellipse,
        style: {
          ...ellipse.style,
          arrowMarks: migrateArrowMark(ellipse.style.arrowMark),
        },
      };
    }),
    angles: normalizedScene.angles.map((a) => {
      const needsArrowMigration = !a.style.arcArrowMarks?.length && Boolean(a.style.arcArrowMark);
      const needsMarkMigration = !a.style.angleMarks?.length && a.style.markStyle === "arc";
      if (!needsArrowMigration && !needsMarkMigration) return a;
      return {
        ...a,
        style: {
          ...a.style,
          arcArrowMarks: needsArrowMigration ? migrateArrowMark(a.style.arcArrowMark!) : a.style.arcArrowMarks,
          angleMarks: needsMarkMigration
            ? [
                {
                  enabled: true,
                  arcMultiplicity: a.style.arcMultiplicity ?? 1,
                  markSymbol: a.style.markSymbol ?? "none",
                  markPos: a.style.markPos ?? 0.5,
                  markSize: a.style.markSize ?? 4,
                  markColor: a.style.markColor,
                },
              ]
            : a.style.angleMarks,
        },
      };
    }),
  }, colorProfileId);
  let inferredNextTextLabelId = 1;
  for (const label of sceneWithBranches.textLabels ?? []) {
    const match = /^txt_(\d+)$/.exec(label.id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= inferredNextTextLabelId) inferredNextTextLabelId = n + 1;
  }
  let inferredNextRichTextId = 1;
  for (const node of sceneWithBranches.richTextNodes ?? []) {
    const match = /^rt_(\d+)$/.exec(node.id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= inferredNextRichTextId) inferredNextRichTextId = n + 1;
  }
  let inferredNextEllipseId = 1;
  for (const ellipse of sceneWithBranches.ellipses ?? []) {
    const match = /^e_(\d+)$/.exec(ellipse.id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= inferredNextEllipseId) inferredNextEllipseId = n + 1;
  }
  return {
    ...prev,
    colorProfileId,
    canvasThemeOverrides: snapshot.canvasThemeOverrides ?? fallbackUiState.canvasThemeOverrides,
    // UI preferences are app-level and intentionally not restored from scene snapshots/files.
    uiColorProfileId: prev.uiColorProfileId,
    uiCssOverrides: prev.uiCssOverrides,
    gridEnabled: snapshot.gridEnabled ?? fallbackUiState.gridEnabled,
    axesEnabled: snapshot.axesEnabled ?? fallbackUiState.axesEnabled,
    gridSnapEnabled: snapshot.gridSnapEnabled ?? fallbackUiState.gridSnapEnabled,
    activeTool: snapshot.activeTool ?? fallbackUiState.activeTool,
    propertiesPanelIntent: snapshot.selectedObject || snapshot.activeTool === "move" ? "object" : "toolDefault",
    scene: sceneWithBranches,
    selectedObject: snapshot.selectedObject,
    recentCreatedObject: snapshot.recentCreatedObject,
    textEditRequest: null,
    textClipboard: prev.textClipboard,
    pendingSelection: null,
    hoveredHit: null,
    cursorWorld: null,
    nextPointId: snapshot.nextPointId ?? fallbackSceneState.nextPointId,
    nextSegmentId: snapshot.nextSegmentId ?? fallbackSceneState.nextSegmentId,
    nextLineId: snapshot.nextLineId ?? fallbackSceneState.nextLineId,
    nextCircleId: snapshot.nextCircleId ?? fallbackSceneState.nextCircleId,
    nextEllipseId: snapshot.nextEllipseId ?? Math.max(fallbackSceneState.nextEllipseId, inferredNextEllipseId),
    nextPolygonId: snapshot.nextPolygonId ?? fallbackSceneState.nextPolygonId,
    nextAngleId: snapshot.nextAngleId ?? fallbackSceneState.nextAngleId,
    nextNumberId: snapshot.nextNumberId ?? fallbackSceneState.nextNumberId,
    nextVectorId: snapshot.nextVectorId ?? fallbackSceneState.nextVectorId,
    nextTextLabelId: snapshot.nextTextLabelId ?? Math.max(fallbackSceneState.nextTextLabelId, inferredNextTextLabelId),
    nextRichTextId: snapshot.nextRichTextId ?? Math.max(fallbackSceneState.nextRichTextId, inferredNextRichTextId),
    pointDefaults: normalizePointDefaults(snapshot.pointDefaults ?? fallbackSceneState.pointDefaults, colorProfileId),
    segmentDefaults: snapshot.segmentDefaults ?? fallbackSceneState.segmentDefaults,
    lineDefaults: snapshot.lineDefaults ?? fallbackSceneState.lineDefaults,
    circleDefaults: snapshot.circleDefaults ?? fallbackSceneState.circleDefaults,
    ellipseDefaults: snapshot.ellipseDefaults ?? fallbackSceneState.ellipseDefaults,
    polygonDefaults: snapshot.polygonDefaults ?? fallbackSceneState.polygonDefaults,
    angleDefaults: normalizeAngleDefaults(snapshot.angleDefaults ?? fallbackSceneState.angleDefaults, colorProfileId),
    objectLabelDefaults: snapshot.objectLabelDefaults ?? fallbackSceneState.objectLabelDefaults,
    labelToolDefaults: normalizeTextDefaults(snapshot.labelToolDefaults ?? fallbackSceneState.labelToolDefaults, colorProfileId),
    textboxToolDefaults: normalizeTextDefaults(snapshot.textboxToolDefaults ?? fallbackSceneState.textboxToolDefaults, colorProfileId),
    richTextToolDefaults: normalizeTextDefaults(snapshot.richTextToolDefaults ?? fallbackSceneState.richTextToolDefaults, colorProfileId),
    angleFixedTool: snapshot.angleFixedTool ?? fallbackUiState.angleFixedTool,
    circleFixedTool: snapshot.circleFixedTool ?? fallbackUiState.circleFixedTool,
    transformTool: snapshot.transformTool ?? fallbackUiState.transformTool,
    exportClipWorld: snapshot.exportClipWorld ?? null,
    copyStyle: snapshot.copyStyle ?? fallbackUiState.copyStyle,
  };
}

function normalizePointDefaults<T extends { labelColor: string }>(defaults: T, profileId: GeoState["colorProfileId"]): T {
  return {
    ...defaults,
    labelColor: normalizeLabelColorForProfile(defaults.labelColor, profileId),
  };
}

function normalizeAngleDefaults<T extends { textColor: string }>(defaults: T, profileId: GeoState["colorProfileId"]): T {
  return {
    ...defaults,
    textColor: normalizeLabelColorForProfile(defaults.textColor, profileId),
  };
}

function normalizeTextDefaults<T extends { textColor: string }>(defaults: T, profileId: GeoState["colorProfileId"]): T {
  return {
    ...defaults,
    textColor: normalizeLabelColorForProfile(defaults.textColor, profileId),
  };
}

function migrateArrowMark<T extends { direction: string; pos?: number; pairGapPx?: number }>(arrow: T): T[] {
  if (!arrow) return [];
  const dir = arrow.direction;
  if (dir === "->" || dir === "<-") {
    return [arrow];
  }
  // Split bidirectional arrows into two
  const basePos = arrow.pos ?? 0.5;
  // Estimate gap offset. In the old system, gap separation depended on context (segments vs arcs),
  // but here at data level we don't have geometry. We pick a safe visual default (e.g. +/- 0.05).
  // For segments/arcs this is usually sufficient distinction.
  const offset = 0.05;

  if (dir === "<->") {
    return [
      { ...arrow, direction: "<-", pos: Math.max(0, basePos - offset), pairGapPx: undefined },
      { ...arrow, direction: "->", pos: Math.min(1, basePos + offset), pairGapPx: undefined },
    ];
  }
  if (dir === ">-<") {
    // >-< means incoming to the center. So Left arrow is -> (0 to center), Right arrow is <- (1 to center)
    return [
      { ...arrow, direction: "->", pos: Math.max(0, basePos - offset), pairGapPx: undefined },
      { ...arrow, direction: "<-", pos: Math.min(1, basePos + offset), pairGapPx: undefined },
    ];
  }
  return [arrow];
}
