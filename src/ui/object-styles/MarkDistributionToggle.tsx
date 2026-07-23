export type MarkDistribution = "single" | "multi";

type MarkDistributionToggleProps = {
    value: MarkDistribution;
    onChange: (value: MarkDistribution) => void;
};

export function MarkDistributionToggle({ value, onChange }: MarkDistributionToggleProps) {
    return (
        <div className="arrowIconToggleGrid">
            {(["single", "multi"] as const).map((distribution) => (
                <button
                    key={distribution}
                    type="button"
                    className={`arrowIconToggleButton ${value === distribution ? "active" : ""}`}
                    onClick={() => onChange(distribution)}
                    title={distribution === "single" ? "Single" : "Multi"}
                    aria-label={distribution === "single" ? "Single" : "Multi"}
                >
                    <MarkDistributionGlyph distribution={distribution} />
                </button>
            ))}
        </div>
    );
}

function MarkDistributionGlyph({ distribution }: { distribution: MarkDistribution }) {
    const tick = (x: number) => (
        <line
            key={x}
            x1={x}
            y1="7"
            x2={x}
            y2="25"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
        />
    );

    return (
        <svg className="arrowIconToggleSvg" viewBox="0 0 88 32" aria-hidden="true">
            <line x1="8" y1="16" x2="80" y2="16" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
            {distribution === "single" ? tick(44) : [tick(28), tick(44), tick(60)]}
        </svg>
    );
}
