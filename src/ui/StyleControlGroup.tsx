import type { ReactNode } from "react";

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
