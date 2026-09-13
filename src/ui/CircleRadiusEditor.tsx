import { useEffect, useId, useState } from "react";
import type { SceneCircleFixedRadius } from "../scene/points";
import type { GeoActions } from "../state/slices/storeTypes";

export function CircleRadiusEditor({ circle, updateCircleRadius }: {
  circle: SceneCircleFixedRadius;
  updateCircleRadius: GeoActions["updateCircleRadius"];
}) {
  const inputId = useId();
  const savedExpression = circle.radiusExpr ?? String(circle.radius);
  const [expression, setExpression] = useState(savedExpression);
  const [error, setError] = useState("");
  useEffect(() => {
    setExpression(savedExpression);
    setError("");
  }, [circle.id, savedExpression]);

  return (
    <form className="fieldBlock" onSubmit={event => {
      event.preventDefault();
      const result = updateCircleRadius(circle.id, expression);
      setError(result.ok ? "" : result.error);
    }}>
      <label className="fieldLabel" htmlFor={inputId}>Radius expression</label>
      <div className="renameRow">
        <input id={inputId} className="renameInput" value={expression}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={event => { setExpression(event.target.value); setError(""); }} />
        <button type="submit" className="actionButton" disabled={expression.trim() === savedExpression}>Apply</button>
      </div>
      {error && <div id={`${inputId}-error`} className="errorText" role="alert">{error}</div>}
    </form>
  );
}
