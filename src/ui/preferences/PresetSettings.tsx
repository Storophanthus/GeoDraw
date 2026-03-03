import { useState, useMemo, useEffect } from "react";
import { useGeoStore } from "../../state/geoStore";
import {
    captureConstructionPreferences,
    saveStoredConstructionPreferences,
    hasStoredConstructionPreferences,
    loadStoredConstructionPreferences,
    clearStoredConstructionPreferences,
} from "../../state/appPreferences";

export function PresetSettings() {
    const applyAppPreferences = useGeoStore((state) => state.applyAppPreferences);
    const colorProfileId = useGeoStore((state) => state.colorProfileId);
    const canvasThemeOverrides = useGeoStore((state) => state.canvasThemeOverrides);
    const gridEnabled = useGeoStore((state) => state.gridEnabled);
    const axesEnabled = useGeoStore((state) => state.axesEnabled);
    const gridSnapEnabled = useGeoStore((state) => state.gridSnapEnabled);
    const pointDefaults = useGeoStore((state) => state.pointDefaults);
    const segmentDefaults = useGeoStore((state) => state.segmentDefaults);
    const lineDefaults = useGeoStore((state) => state.lineDefaults);
    const circleDefaults = useGeoStore((state) => state.circleDefaults);
    const polygonDefaults = useGeoStore((state) => state.polygonDefaults);
    const angleDefaults = useGeoStore((state) => state.angleDefaults);
    const angleFixedTool = useGeoStore((state) => state.angleFixedTool);
    const circleFixedTool = useGeoStore((state) => state.circleFixedTool);
    const regularPolygonTool = useGeoStore((state) => state.regularPolygonTool);
    const transformTool = useGeoStore((state) => state.transformTool);
    const dependencyGlowEnabled = useGeoStore((state) => state.dependencyGlowEnabled);

    const [hasConstructionPreset, setHasConstructionPreset] = useState(() => hasStoredConstructionPreferences());
    const [constructionPresetStatus, setConstructionPresetStatus] = useState<string>("");

    const currentConstructionPreferences = useMemo(
        () =>
            captureConstructionPreferences({
                colorProfileId,
                canvasThemeOverrides,
                gridEnabled,
                axesEnabled,
                gridSnapEnabled,
                pointDefaults,
                segmentDefaults,
                lineDefaults,
                circleDefaults,
                polygonDefaults,
                angleDefaults,
                angleFixedTool,
                circleFixedTool,
                regularPolygonTool,
                transformTool,
                dependencyGlowEnabled,
            }),
        [
            colorProfileId,
            canvasThemeOverrides,
            gridEnabled,
            axesEnabled,
            gridSnapEnabled,
            pointDefaults,
            segmentDefaults,
            lineDefaults,
            circleDefaults,
            polygonDefaults,
            angleDefaults,
            angleFixedTool,
            circleFixedTool,
            regularPolygonTool,
            transformTool,
            dependencyGlowEnabled,
        ]
    );

    useEffect(() => {
        setHasConstructionPreset(hasStoredConstructionPreferences());
    }, []);

    const saveConstructionPreset = () => {
        const ok = saveStoredConstructionPreferences(currentConstructionPreferences);
        if (!ok) {
            setConstructionPresetStatus("Could not save preset (storage unavailable).");
            return;
        }
        setHasConstructionPreset(true);
        setConstructionPresetStatus("Saved current construction settings as preferred preset.");
    };

    const loadConstructionPreset = () => {
        const preset = loadStoredConstructionPreferences();
        if (!preset) {
            setHasConstructionPreset(false);
            setConstructionPresetStatus("No preferred preset found.");
            return;
        }
        applyAppPreferences(preset);
        setHasConstructionPreset(true);
        setConstructionPresetStatus("Loaded preferred construction preset.");
    };

    const clearConstructionPreset = () => {
        const ok = clearStoredConstructionPreferences();
        if (!ok) {
            setConstructionPresetStatus("Could not clear preset (storage unavailable).");
            return;
        }
        setHasConstructionPreset(false);
        setConstructionPresetStatus("Cleared preferred construction preset.");
    };

    return (
        <>
            <div className="preferencesSectionTitle">Construction Preset</div>
            <div className="preferencesPresetActions">
                <button
                    type="button"
                    className="preferencesResetButton"
                    onClick={saveConstructionPreset}
                >
                    Save Current as Preferred
                </button>
                <button
                    type="button"
                    className="preferencesResetButton"
                    onClick={loadConstructionPreset}
                    disabled={!hasConstructionPreset}
                >
                    Load Preferred
                </button>
                <button
                    type="button"
                    className="preferencesResetButton"
                    onClick={clearConstructionPreset}
                    disabled={!hasConstructionPreset}
                >
                    Clear Preferred
                </button>
            </div>
            <div className="preferencesPresetStatus">
                {constructionPresetStatus || (hasConstructionPreset ? "Preferred preset is saved." : "No preferred preset saved yet.")}
            </div>

            <div className="preferencesHint">
                UI theme is persisted across restarts and is not loaded from scene files.
            </div>
            <div className="preferencesHint">
                Construction preset saves palette/default styles/tool defaults so you can re-apply them after opening any file.
            </div>
        </>
    );
}
