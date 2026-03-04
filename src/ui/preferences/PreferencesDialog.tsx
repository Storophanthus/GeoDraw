import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ThemeSettings } from "./ThemeSettings";
import { ConstructionSettings } from "./ConstructionSettings";
import { PresetSettings } from "./PresetSettings";

export type PreferenceTab = "ui" | "construction" | "presets";

export const PREFERENCES_TAB_OPTIONS: Array<{ id: PreferenceTab; label: string }> = [
    { id: "ui", label: "UI Theme" },
    { id: "construction", label: "Construction" },
    { id: "presets", label: "Presets" },
];

interface PreferencesDialogProps {
    open: boolean;
    onClose: () => void;
}

export function PreferencesDialog({ open, onClose }: PreferencesDialogProps) {
    const [preferencesTab, setPreferencesTab] = useState<PreferenceTab>("ui");
    const preferencesDialogRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;

        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (preferencesDialogRef.current && !preferencesDialogRef.current.contains(target)) {
                onClose();
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("mousedown", onMouseDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="preferencesOverlay" role="presentation">
            <section className="preferencesModal" role="dialog" aria-label="Preferences" ref={preferencesDialogRef}>
                <div className="preferencesModalHeader">
                    <h2 className="preferencesModalTitle">Preferences</h2>
                    <button
                        type="button"
                        className="preferencesCloseButton"
                        onClick={onClose}
                        aria-label="Close preferences"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="preferencesTabs" role="tablist" aria-label="Preferences categories">
                    {PREFERENCES_TAB_OPTIONS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={preferencesTab === tab.id}
                            className={preferencesTab === tab.id ? "preferencesTabButton active" : "preferencesTabButton"}
                            onClick={() => setPreferencesTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {preferencesTab === "ui" && <ThemeSettings />}
                {preferencesTab === "construction" && <ConstructionSettings />}
                {preferencesTab === "presets" && <PresetSettings />}
            </section>
        </div>
    );
}
