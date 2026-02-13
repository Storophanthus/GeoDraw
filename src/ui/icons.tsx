import type { ComponentType } from "react";

type IconProps = {
    size?: number;
    strokeWidth?: number;
    className?: string; // Allow passing className for styling
};

// --- Generic Helpers ---
function createIcon(
    render: (props: IconProps) => React.ReactNode,
    displayName: string
): ComponentType<IconProps> {
    const Component = (props: IconProps) => {
        const { size = 18, strokeWidth = 2, className } = props;
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
                aria-hidden="true"
            >
                {render({ ...props, size, strokeWidth })}
            </svg>
        );
    };
    Component.displayName = displayName;
    return Component;
}

// --- Icons ---

export const IconMove = createIcon(() => (
    <>
        <path d="M1 1l8 19 2.5-8.5 8.5-2.5L1 1z" strokeWidth={2} />
    </>
), "IconMove");

export const IconPoint = createIcon(() => (
    <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
), "IconPoint");


export const IconMidpoint = createIcon(() => (
    <>
        <line x1="0" y1="12" x2="24" y2="12" strokeWidth={3} />
        <circle cx="0" cy="12" r="3" fill="currentColor" stroke="none" />
        <circle cx="24" cy="12" r="3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth={2} />
    </>
), "IconMidpoint");

export const IconLine = createIcon(() => (
    <>
        <line x1="1" y1="23" x2="23" y2="1" strokeWidth={2.5} />
        {/* Arrowheads at ends */}
        <path d="M1 23 l0 -6 M1 23 l6 0" strokeLinecap="round" />
        <path d="M23 1 l0 6 M23 1 l-6 0" strokeLinecap="round" />
    </>
), "IconLine");

export const IconSegment = createIcon(() => (
    <>
        <line x1="2" y1="22" x2="22" y2="2" strokeWidth={3} />
        <circle cx="2" cy="22" r="4" fill="currentColor" stroke="none" />
        <circle cx="22" cy="2" r="4" fill="currentColor" stroke="none" />
    </>
), "IconSegment");

export const IconRay = createIcon(() => (
    <>
        <line x1="2" y1="22" x2="22" y2="2" strokeWidth={3} />
        <circle cx="2" cy="22" r="4" fill="currentColor" stroke="none" />
        <path d="M22 2 l0 6 M22 2 l-6 0" strokeLinecap="round" />
    </>
), "IconRay");

export const IconPerpendicular = createIcon(() => (
    <>
        <line x1="0" y1="22" x2="24" y2="22" strokeWidth={2.5} />
        <line x1="10" y1="0" x2="10" y2="22" strokeWidth={2.5} />
        <path d="M10 16 H 16 V 22" fill="none" strokeWidth={2} />
    </>
), "IconPerpendicular");

export const IconParallel = createIcon(() => (
    <>
        <line x1="0" y1="6" x2="24" y2="6" strokeWidth={2.5} />
        <line x1="0" y1="18" x2="24" y2="18" strokeWidth={2.5} />
        <path d="M12 6 l-3 -3 M12 6 l-3 3" strokeWidth={2} />
        <path d="M8 18 l-3 -3 M8 18 l-3 3" strokeWidth={2} />
    </>
), "IconParallel");

export const IconTangent = createIcon(() => (
    <>
        <line x1="0" y1="24" x2="24" y2="0" strokeWidth={2.5} />
        <circle cx="18" cy="18" r="8.5" strokeWidth={2.5} />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
), "IconTangent");

export const IconAngle = createIcon(() => (
    <>
        <path d="M0 24 L 14 4 L 24 24" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        <path d="M11 18 Q 14 19 16.5 16.5" strokeWidth={2} />
        <text x="14" y="15" fontSize="8" fill="currentColor" stroke="none" textAnchor="middle">α</text>
    </>
), "IconAngle");

export const IconAngleFixed = createIcon(() => (
    <>
        <path d="M0 22 H 24" strokeWidth={2.5} />
        <path d="M0 22 L 18 2" strokeWidth={2.5} />
        <path d="M9 22 A 7 7 0 0 1 7.5 16" strokeWidth={2} />
        <text x="17" y="16" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">N°</text>
    </>
), "IconAngleFixed");

export const IconBisector = createIcon(() => (
    <>
        <path d="M0 24 L 12 4 L 24 24" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        <line x1="12" y1="0" x2="12" y2="24" strokeWidth={2} strokeDasharray="3 3" />
    </>
), "IconBisector");

export const IconCircleCenterPoint = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="11" strokeWidth={2.5} />
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <circle cx="23" cy="12" r="4" fill="currentColor" stroke="none" />
    </>
), "IconCircleCenterPoint");

export const IconCircle3Point = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="11" strokeWidth={2} strokeDasharray="3 3" />
        <circle cx="12" cy="1" r="4" fill="currentColor" stroke="none" />
        <circle cx="2.5" cy="17.5" r="4" fill="currentColor" stroke="none" />
        <circle cx="21.5" cy="17.5" r="4" fill="currentColor" stroke="none" />
    </>
), "IconCircle3Point");

export const IconCircleRadius = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="11" strokeWidth={2.5} />
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <line x1="12" y1="12" x2="23" y2="12" strokeWidth={2} />
        <text x="15" y="9" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">r</text>
    </>
), "IconCircleRadius");

export const IconSector = createIcon(() => (
    <>
        <path d="M2 22 L 22 22 A 20 20 0 0 0 2 2 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth={2.5} />
        <circle cx="2" cy="22" r="3" fill="currentColor" stroke="none" />
        <circle cx="22" cy="22" r="3" fill="currentColor" stroke="none" />
        <circle cx="2" cy="2" r="3" fill="currentColor" stroke="none" />
    </>
), "IconSector");

export const IconCopyStyle = createIcon(() => (
    <>
        <rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.2" stroke="none" />
        <path d="M12 12 L 23 23" strokeWidth={4} />
        <path d="M21 15 L 15 21" strokeWidth={2} />
        <path d="M5 11 V 20 H 14" strokeDasharray="3 3" strokeWidth={2} />
    </>
), "IconCopyStyle");

export const IconExportClip = createIcon(() => (
    <>
        <rect x="2" y="2" width="20" height="20" rx="2" strokeWidth={2} strokeDasharray="3 2" />
        <path d="M7 7 H17 V17" strokeWidth={2.5} />
        <path d="M17 17 L17 13 M17 17 L13 17" strokeWidth={2.5} />
    </>
), "IconExportClip");
