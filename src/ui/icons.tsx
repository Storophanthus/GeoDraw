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

export const IconTransform = createIcon(() => (
    <>
        <circle cx="5" cy="17" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="19" cy="7" r="2.5" fill="currentColor" stroke="none" />
        <path d="M7.5 16 L16.5 9.5" strokeWidth={2.2} />
        <path d="M16.5 9.5 l-1.5 3.8 M16.5 9.5 l-3.9 0.9" strokeWidth={2} />
        <path d="M7 9.5a7.5 7.5 0 0 1 8.4-4.6" strokeWidth={1.8} />
        <path d="M15.4 4.9 l-2.8 0.5 M15.4 4.9 l-1.6 2.2" strokeWidth={1.8} />
    </>
), "IconTransform");

export const IconTranslate = createIcon(() => (
    <>
        <rect x="2.5" y="11" width="7" height="7" rx="1.2" fill="currentColor" fillOpacity="0.25" strokeWidth={1.8} />
        <rect x="14.5" y="6" width="7" height="7" rx="1.2" fill="currentColor" fillOpacity="0.15" strokeWidth={1.8} />
        <path d="M10.5 14.5 H15.5" strokeWidth={2.2} />
        <path d="M15.5 14.5 l-2.2 -2.2 M15.5 14.5 l-2.2 2.2" strokeWidth={2} />
    </>
), "IconTranslate");

export const IconRotate = createIcon(() => (
    <>
        <path d="M7 8a7.5 7.5 0 1 1 -0.2 8.9" strokeWidth={2} />
        <path d="M7 8 H12 M7 8 V13" strokeWidth={2} />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </>
), "IconRotate");

export const IconReflect = createIcon(() => (
    <>
        <line x1="3" y1="21" x2="21" y2="3" strokeWidth={2.2} />
        <circle cx="7" cy="17" r="2.3" fill="currentColor" stroke="none" />
        <circle cx="17" cy="7" r="2.3" fill="currentColor" stroke="none" />
        <path d="M9.2 14.8 L14.8 9.2" strokeWidth={1.8} strokeDasharray="2 2" />
    </>
), "IconReflect");

export const IconDilate = createIcon(() => (
    <>
        <circle cx="6" cy="18" r="2.2" fill="currentColor" stroke="none" />
        <rect x="9.5" y="10.5" width="5" height="5" rx="0.9" fill="currentColor" fillOpacity="0.28" strokeWidth={1.8} />
        <rect x="14.5" y="5.5" width="8" height="8" rx="1.2" fill="currentColor" fillOpacity="0.14" strokeWidth={1.8} />
        <path d="M6 18 L18.5 9.5" strokeWidth={1.8} />
    </>
), "IconDilate");

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

export const IconPolygon = createIcon(() => (
    <>
        <path d="M3 18 L8 4 L20 6 L22 17 L10 22 Z" fill="currentColor" fillOpacity="0.2" strokeWidth={2.2} />
        <circle cx="3" cy="18" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="8" cy="4" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="20" cy="6" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="22" cy="17" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="10" cy="22" r="2.4" fill="currentColor" stroke="none" />
    </>
), "IconPolygon");

export const IconRegularPolygon = createIcon(() => (
    <>
        <path d="M12 2.5 L20 7 L20 17 L12 21.5 L4 17 L4 7 Z" fill="currentColor" fillOpacity="0.18" strokeWidth={2.2} />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <line x1="12" y1="12" x2="20" y2="7" strokeWidth={1.7} strokeDasharray="2 2" />
    </>
), "IconRegularPolygon");

export const IconCopyStyle = createIcon(() => (
    <>
        <rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.2" stroke="none" />
        <path d="M12 12 L 23 23" strokeWidth={4} />
        <path d="M21 15 L 15 21" strokeWidth={2} />
        <path d="M5 11 V 20 H 14" strokeDasharray="3 3" strokeWidth={2} />
    </>
), "IconCopyStyle");

export const IconLabel = createIcon(() => (
    <>
        <path d="M4 20 L10 4 L16 20" strokeWidth={2.2} />
        <path d="M6 14 H14" strokeWidth={2.2} />
        <path d="M16.5 6.5 C18.4 4.8 21.5 5.2 21.5 7.8 C21.5 10.3 18.2 10.8 16.6 9.2 V20" strokeWidth={2} />
    </>
), "IconLabel");

export const IconExportClip = createIcon(() => (
    <>
        <rect x="2" y="2" width="20" height="20" rx="2" strokeWidth={2} strokeDasharray="3 2" />
        <path d="M7 7 H17 V17" strokeWidth={2.5} />
        <path d="M17 17 L17 13 M17 17 L13 17" strokeWidth={2.5} />
    </>
), "IconExportClip");

export const IconExportClipPolygon = createIcon(() => (
    <>
        <path d="M4 7 L9 3.5 L17.5 5 L20.5 12 L16.5 20 L7.5 19 L3.5 12 Z" strokeWidth={2} strokeDasharray="3 2" />
        <path d="M8 8.5 L15.2 9.5 L13.5 15.2 L8.8 14.4 Z" strokeWidth={2.2} />
        <path d="M15.2 9.5 L15.2 12.8 M15.2 9.5 L12 9.5" strokeWidth={2.2} />
        <circle cx="8" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15.2" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="13.5" cy="15.2" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="8.8" cy="14.4" r="1.2" fill="currentColor" stroke="none" />
    </>
), "IconExportClipPolygon");

export const IconFitView = createIcon(() => (
    <>
        <path d="M3 9V3h6" strokeWidth={2.2} />
        <path d="M21 9V3h-6" strokeWidth={2.2} />
        <path d="M3 15v6h6" strokeWidth={2.2} />
        <path d="M21 15v6h-6" strokeWidth={2.2} />
        <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" strokeWidth={1.8} />
    </>
), "IconFitView");

export const IconSidebarPanelLeft = createIcon(() => (
    <>
        <rect x="3" y="4" width="18" height="16" rx="3" strokeWidth={2.2} />
        <line x1="9.5" y1="5.5" x2="9.5" y2="18.5" strokeWidth={1.8} />
        <circle cx="15.5" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
    </>
), "IconSidebarPanelLeft");

export const IconSidebarPanelRight = createIcon(() => (
    <>
        <rect x="3" y="4" width="18" height="16" rx="3" strokeWidth={2.2} />
        <line x1="14.5" y1="5.5" x2="14.5" y2="18.5" strokeWidth={1.8} />
        <circle cx="8.5" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
    </>
), "IconSidebarPanelRight");

export const IconGlobe = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <path d="M2 12h20" strokeWidth={2} />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth={2} />
    </>
), "IconGlobe");

export const IconType = createIcon(() => (
    <>
        <path d="M4 7V4h16v3" strokeWidth={2.2} />
        <path d="M9 20h6" strokeWidth={2.2} />
        <path d="M12 4v16" strokeWidth={2.2} />
    </>
), "IconType");
