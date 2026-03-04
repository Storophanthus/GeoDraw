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

export const IconPoint = createIcon(() => (
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
), "IconPoint");

export const IconMidpoint = createIcon(() => (
    <>
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth={2} />
        <circle cx="2" cy="12" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="22" cy="12" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconMidpoint");

export const IconTransform = createIcon(() => (
    <>
        <circle cx="5" cy="17" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="19" cy="7" r="2.5" fill="currentColor" stroke="none" />
        <path d="M7.5 16 L16.5 9.5" strokeWidth={2} />
        <path d="M16.5 9.5 l-1.5 3.8 M16.5 9.5 l-3.9 0.9" strokeWidth={2} />
        <path d="M7 9.5a7.5 7.5 0 0 1 8.4-4.6" strokeWidth={2} />
        <path d="M15.4 4.9 l-2.8 0.5 M15.4 4.9 l-1.6 2.2" strokeWidth={2} />
    </>
), "IconTransform");

export const IconTranslate = createIcon(() => (
    <>
        <rect x="3" y="12" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.25" strokeWidth={2} />
        <rect x="15" y="6" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.15" strokeWidth={2} />
        <path d="M11 15 L 16 15" strokeWidth={2} />
        <path d="M16 15 l-2 -2 M16 15 l-2 2" strokeWidth={2} />
    </>
), "IconTranslate");

export const IconRotate = createIcon(() => (
    <>
        <path d="M7 8a7 7 0 1 1 -0.2 8" strokeWidth={2} />
        <path d="M7 8 H12 M7 8 V13" strokeWidth={2} />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconRotate");

export const IconReflect = createIcon(() => (
    <>
        <line x1="4" y1="20" x2="20" y2="4" strokeWidth={2} />
        <circle cx="7" cy="17" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="17" cy="7" r="2.5" fill="currentColor" stroke="none" />
        <path d="M9 15 L 15 9" strokeWidth={2} strokeDasharray="2 2" />
    </>
), "IconReflect");

export const IconDilate = createIcon(() => (
    <>
        <circle cx="6" cy="18" r="2.5" fill="currentColor" stroke="none" />
        <rect x="9.5" y="10.5" width="4" height="4" rx="1" fill="currentColor" fillOpacity="0.25" strokeWidth={2} />
        <rect x="14" y="6" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.15" strokeWidth={2} />
        <path d="M7 17 L18 6" strokeWidth={2} />
    </>
), "IconDilate");

export const IconLine = createIcon(() => (
    <>
        <line x1="3" y1="21" x2="21" y2="3" strokeWidth={2} />
        {/* Arrowheads at ends */}
        <path d="M3 21 l0 -5 M3 21 l5 0" strokeWidth={2} strokeLinecap="round" />
        <path d="M21 3 l0 5 M21 3 l-5 0" strokeWidth={2} strokeLinecap="round" />
    </>
), "IconLine");

export const IconSegment = createIcon(() => (
    <>
        <line x1="3" y1="21" x2="21" y2="3" strokeWidth={2} />
        <circle cx="3" cy="21" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="21" cy="3" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconSegment");

export const IconRay = createIcon(() => (
    <>
        <line x1="3" y1="21" x2="21" y2="3" strokeWidth={2} />
        <circle cx="3" cy="21" r="2.5" fill="currentColor" stroke="none" />
        <path d="M21 3 l0 5 M21 3 l-5 0" strokeWidth={2} strokeLinecap="round" />
    </>
), "IconRay");

export const IconPerpendicular = createIcon(() => (
    <>
        <line x1="2" y1="20" x2="22" y2="20" strokeWidth={2} />
        <line x1="12" y1="4" x2="12" y2="20" strokeWidth={2} />
        <path d="M12 15 H 17 V 20" fill="none" strokeWidth={2} />
    </>
), "IconPerpendicular");

export const IconParallel = createIcon(() => (
    <>
        <line x1="2" y1="8" x2="22" y2="8" strokeWidth={2} />
        <line x1="2" y1="16" x2="22" y2="16" strokeWidth={2} />
        <path d="M12 8 l-3 -3 M12 8 l-3 3" strokeWidth={2} />
        <path d="M12 16 l-3 -3 M12 16 l-3 3" strokeWidth={2} />
    </>
), "IconParallel");

export const IconTangent = createIcon(() => (
    <>
        <line x1="2" y1="22" x2="22" y2="2" strokeWidth={2} />
        <circle cx="16" cy="16" r="7" strokeWidth={2} />
        <circle cx="11.1" cy="11.1" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconTangent");

export const IconAngle = createIcon(() => (
    <>
        <path d="M2 22 L 12 6 L 22 22" strokeWidth={2} fill="none" strokeLinejoin="round" />
        <path d="M9 17.5 Q 12 19 15 17.5" strokeWidth={2} fill="none" />
    </>
), "IconAngle");

export const IconAngleFixed = createIcon(() => (
    <>
        <path d="M2 20 H 22" strokeWidth={2} />
        <path d="M2 20 L 16 4" strokeWidth={2} />
        <path d="M9 20 A 7 7 0 0 1 8 14" strokeWidth={2} />
        <text x="16" y="16" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">N°</text>
    </>
), "IconAngleFixed");

export const IconBisector = createIcon(() => (
    <>
        <path d="M2 22 L 12 6 L 22 22" strokeWidth={2} fill="none" strokeLinejoin="round" />
        <line x1="12" y1="6" x2="12" y2="22" strokeWidth={2} strokeDasharray="3 2" />
    </>
), "IconBisector");

export const IconCircleCenterPoint = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="22" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconCircleCenterPoint");

export const IconCircle3Point = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="10" strokeWidth={2} strokeDasharray="3 3" />
        <circle cx="12" cy="2" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="3" cy="16.5" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="21" cy="16.5" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconCircle3Point");

export const IconCircleRadius = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        <line x1="12" y1="12" x2="22" y2="12" strokeWidth={2} />
        <text x="16" y="9" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">r</text>
    </>
), "IconCircleRadius");

export const IconSector = createIcon(() => (
    <>
        <path d="M4 20 L 20 20 A 16 16 0 0 0 4 4 Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        <circle cx="4" cy="20" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="20" cy="20" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="4" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconSector");

export const IconPolygon = createIcon(() => (
    <>
        <path d="M4 17 L8 5 L19 7 L21 16 L11 21 Z" fill="currentColor" fillOpacity="0.15" strokeWidth={2} strokeLinejoin="round" />
        <circle cx="4" cy="17" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="8" cy="5" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="19" cy="7" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="21" cy="16" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="11" cy="21" r="2.5" fill="currentColor" stroke="none" />
    </>
), "IconPolygon");

export const IconRegularPolygon = createIcon(() => (
    <>
        <path d="M12 3 L20 8 L20 16 L12 21 L4 16 L4 8 Z" fill="currentColor" fillOpacity="0.15" strokeWidth={2} strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        <line x1="12" y1="12" x2="20" y2="8" strokeWidth={1.5} strokeDasharray="2 2" />
    </>
), "IconRegularPolygon");

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
