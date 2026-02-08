import type { ComponentType } from "react";

type IconProps = {
  size?: number;
  strokeWidth?: number;
};

type ToolButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<IconProps>;
  tooltip: string;
  ariaLabel: string;
  disabled?: boolean;
};

export function ToolButton({
  active,
  onClick,
  icon: Icon,
  tooltip,
  ariaLabel,
  disabled = false,
}: ToolButtonProps) {
  return (
    <div className="toolButtonWrap">
      <button
        type="button"
        className={active ? "toolIconButton active" : "toolIconButton"}
        onClick={onClick}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <Icon size={18} strokeWidth={2} />
      </button>
      <span className="toolTooltip" role="tooltip">
        {tooltip}
      </span>
    </div>
  );
}
