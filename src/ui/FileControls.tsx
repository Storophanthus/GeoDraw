
import { FolderOpen, Save } from "lucide-react";
import { useRef } from "react";
import { useGeoStore, getGeoStore } from "../state/geoStore";
import { takeHistorySnapshot, type HistorySnapshot } from "../state/slices/historySlice";

export function FileControls() {
    const loadSnapshot = useGeoStore((state) => state.loadSnapshot);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        // We can take a snapshot of the current state directly from the store
        // relying on the fact that useGeoStore.getState() is available via the hook's closure,
        // or by triggering an action. But since we need the *data*, we can just grab it.
        // However, hooks rule: we can't call getState inside render.
        // Better to use an event handler.
        const state = getGeoStore();
        const snapshot = takeHistorySnapshot(state);

        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `geodraw-${new Date().toISOString().slice(0, 10)}.geodraw`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleOpenClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const snapshot = JSON.parse(text) as HistorySnapshot;
                if (!isValidSnapshot(snapshot)) {
                    throw new Error("Invalid GeoDraw file structure");
                }
                loadSnapshot(snapshot);

                // ... inside component ...

                function isValidSnapshot(data: any): data is HistorySnapshot {
                    if (!data || typeof data !== "object") return false;
                    // Check key top-level fields
                    if (!data.scene || typeof data.scene !== "object") return false;
                    if (typeof data.activeTool !== "string") return false;

                    // Check scene structure (fail-closed)
                    const { scene } = data;
                    if (!Array.isArray(scene.points)) return false;
                    if (!Array.isArray(scene.lines)) return false;
                    if (!Array.isArray(scene.circles)) return false;
                    if (!Array.isArray(scene.segments)) return false;
                    // scene.angles and scene.numbers are optional in older versions? 
                    // better to check if they exist, must be arrays.
                    if (scene.angles && !Array.isArray(scene.angles)) return false;
                    if (scene.numbers && !Array.isArray(scene.numbers)) return false;

                    return true;
                }
            } catch (err) {
                console.error("Failed to load file:", err);
                alert("Failed to load file. It might be corrupted or invalid.");
            } finally {
                // Reset input so same file can be selected again
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    return (
        <>
            <div className="canvasTopActions" aria-label="File controls" style={{ left: 16 }}>
                <button
                    className="iconActionButton"
                    onClick={handleOpenClick}
                    title="Open File"
                    aria-label="Open File"
                >
                    <FolderOpen size={16} />
                </button>
                <button
                    className="iconActionButton"
                    onClick={handleSave}
                    title="Save File"
                    aria-label="Save File"
                >
                    <Save size={16} />
                </button>
            </div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".geodraw,.json"
                style={{ display: "none" }}
            />
        </>
    );
}
