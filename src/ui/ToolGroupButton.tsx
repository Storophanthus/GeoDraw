import type { ActiveTool } from "../state/geoStore";
import { type ToolGroupId, TOOL_REGISTRY } from "./ToolPalette";

export type ToolGroupButtonProps = {
    groupId: ToolGroupId;
    mainTool: ActiveTool;
    tools: ActiveTool[];
    activeTool: ActiveTool;
    flyoutOpen: boolean;
    onOpenFlyout: () => void;
    onCloseFlyout: () => void;
    onSelectTool: (tool: ActiveTool) => void;
};

export function ToolGroupButton({
    groupId,
    mainTool,
    tools,
    activeTool,
    flyoutOpen,
    onOpenFlyout,
    onCloseFlyout,
    onSelectTool,
}: ToolGroupButtonProps) {
    const mainDef = TOOL_REGISTRY[mainTool];
    const MainIcon = mainDef.icon;

    const flyoutTools = tools.filter((tool) => tool !== mainTool);
    const hasFlyout = flyoutTools.length > 0;

    return (
        <div
            className="toolGroupWrap"
            data-group-id={groupId}
            onMouseEnter={() => {
                if (hasFlyout) onOpenFlyout();
            }}
            onMouseLeave={() => onCloseFlyout()}
        >
            <div className={flyoutOpen ? "toolButtonWrap suppressTooltip" : "toolButtonWrap"}>
                <button
                    type="button"
                    className={activeTool === mainTool ? "toolIconButton active" : "toolIconButton"}
                    onClick={() => {
                        onCloseFlyout();
                        onSelectTool(mainTool);
                    }}
                    onFocus={() => {
                        if (hasFlyout) onOpenFlyout();
                    }}
                    aria-label={mainDef.ariaLabel}
                >
                    <MainIcon size={18} strokeWidth={2} />
                </button>
                <span className="toolTooltip" role="tooltip">
                    {mainDef.tooltip}
                </span>
            </div>

            {flyoutOpen && flyoutTools.length > 0 && (
                <div className="toolFlyout" role="menu" aria-label={`${groupId} tools`}>
                    {flyoutTools.map((tool) => {
                        const def = TOOL_REGISTRY[tool];
                        const Icon = def.icon;
                        return (
                            <div key={tool} className="toolButtonWrap">
                                <button
                                    type="button"
                                    className={activeTool === tool ? "toolIconButton active" : "toolIconButton"}
                                    onClick={() => {
                                        onSelectTool(tool);
                                        onCloseFlyout();
                                    }}
                                    aria-label={def.ariaLabel}
                                    role="menuitem"
                                >
                                    <Icon size={18} strokeWidth={2} />
                                </button>
                                <span className="toolTooltip" role="tooltip">
                                    {def.tooltip}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
