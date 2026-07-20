import { useState } from "react";
import { useGeoStore } from "../state/geoStore";
import { loadStoredOnboardingFlags, saveStoredOnboardingFlags } from "../state/appPreferences";
import type { SceneModel } from "../scene/points";

const USER_MANUAL_URL = "https://github.com/Storophanthus/GeoDraw/blob/main/docs/user-manual.pdf";

function isSceneEmpty(scene: SceneModel): boolean {
  return (
    scene.points.length === 0 &&
    (scene.vectors?.length ?? 0) === 0 &&
    scene.segments.length === 0 &&
    scene.lines.length === 0 &&
    scene.circles.length === 0 &&
    (scene.ellipses?.length ?? 0) === 0 &&
    scene.polygons.length === 0 &&
    scene.angles.length === 0 &&
    scene.numbers.length === 0 &&
    (scene.textLabels?.length ?? 0) === 0 &&
    (scene.richTextNodes?.length ?? 0) === 0
  );
}

export function EmptyCanvasHint() {
  const scene = useGeoStore((store) => store.scene);
  const [dismissed, setDismissed] = useState(() => loadStoredOnboardingFlags().emptyCanvasHintDismissed);

  if (dismissed || !isSceneEmpty(scene)) return null;

  const handleDismiss = () => {
    setDismissed(true);
    saveStoredOnboardingFlags({ emptyCanvasHintDismissed: true });
  };

  return (
    <div className="emptyCanvasHintWrap">
      <section className="emptyCanvasHint" role="note" aria-label="Getting started">
        <div className="emptyCanvasHintTitle">Welcome to GeoDraw</div>
        <p className="emptyCanvasHintRow">
          Draw with the tools on the left — hover any icon to see what it does (shortcuts: V, P, S, L, M, O, C).
        </p>
        <p className="emptyCanvasHintRow">Or type a command below — the ? button lists every command.</p>
        <p className="emptyCanvasHintRow">
          When you're done, open the Export tab on the right to copy your figure's code or save a PDF.
        </p>
        <div className="emptyCanvasHintFooter">
          <a href={USER_MANUAL_URL} target="_blank" rel="noreferrer">
            User manual (PDF)
          </a>
          <button type="button" className="actionButton primary" onClick={handleDismiss}>
            Got it
          </button>
        </div>
      </section>
    </div>
  );
}
