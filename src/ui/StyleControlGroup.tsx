import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";

type StyleControlGroupProps = {
    title: string;
    children: ReactNode;
    className?: string;
};

export function StyleControlGroup({ title, children, className }: StyleControlGroupProps) {
  const classNames = className ? `styleControlGroup ${className}` : "styleControlGroup";
    return (
      <div className={classNames}>
        <div className="styleControlGroupTitle">{title}</div>
        {children}
      </div>
    );
}

type TabbedGroup = {
    id: string;
    title: string;
    children: ReactNode;
};

type StyleControlTabbedGroupsProps = {
    children: ReactNode;
    className?: string;
};

function tabIdForTitle(title: string, index: number) {
    return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tab"}-${index}`;
}

export function StyleControlTabbedGroups({ children, className }: StyleControlTabbedGroupsProps) {
    const tabs = useMemo<TabbedGroup[]>(
        () =>
            Children.toArray(children).flatMap((child, index) => {
                if (!isValidElement<StyleControlGroupProps>(child)) return [];
                if (typeof child.props.title !== "string") return [];
                return [
                    {
                        id: tabIdForTitle(child.props.title, index),
                        title: child.props.title,
                        children: child.props.children,
                    },
                ];
            }),
        [children]
    );
    const [activeId, setActiveId] = useState(() => tabs[0]?.id ?? "");
    const firstId = tabs[0]?.id ?? "";

    useEffect(() => {
        if (!tabs.some((tab) => tab.id === activeId)) {
            setActiveId(firstId);
        }
    }, [activeId, firstId, tabs]);

    const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
    if (!activeTab) return null;

    const classNames = className ? `styleControlTabs ${className}` : "styleControlTabs";

    return (
        <div className={classNames}>
            <div className="styleTabList" role="tablist" aria-label="Style categories">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={tab.id === activeTab.id}
                        className={tab.id === activeTab.id ? "styleTabButton active" : "styleTabButton"}
                        onClick={() => setActiveId(tab.id)}
                    >
                        {tab.title}
                    </button>
                ))}
            </div>
            <div className="styleTabPanel" role="tabpanel">
                {activeTab.children}
            </div>
        </div>
    );
}
