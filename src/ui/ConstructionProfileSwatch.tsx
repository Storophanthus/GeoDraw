import { getColorProfile, type ColorProfileId } from "../state/colorProfiles";
import { toRgba } from "./colorUtils";

export function ConstructionProfileSwatch({ profileId }: { profileId: ColorProfileId }) {
    const palette = getColorProfile(profileId).palette;
    return (
        <span
            className="constructionProfileSwatchVisual"
            style={{
                background: palette.backgroundColor,
                borderColor: palette.lineStroke,
            }}
            aria-hidden
        >
            <span className="constructionProfileSwatchGridMinor" style={{ background: toRgba(palette.gridMinorColor, 0.5) }} />
            <span className="constructionProfileSwatchGridMajor" style={{ background: toRgba(palette.gridMajorColor, 0.8) }} />
            <span className="constructionProfileSwatchAxis" style={{ background: palette.axisColor }} />
            <span className="constructionProfileSwatchFill" style={{ background: palette.polygonFill }} />
            <span className="constructionProfileSwatchLine" style={{ background: palette.segmentStroke }} />
            <span
                className="constructionProfileSwatchDot"
                style={{
                    background: palette.pointFill,
                    borderColor: palette.pointStroke,
                }}
            />
        </span>
    );
}
