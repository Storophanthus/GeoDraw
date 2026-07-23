type StyleSectionHeaderProps = {
  title: string;
  selectedStyleAsDefault?: boolean;
  onMakeStyleDefaultChange?: (checked: boolean) => void;
  mode?: "object" | "toolDefault";
};

export function StyleSectionHeader({
  title,
  selectedStyleAsDefault = false,
  onMakeStyleDefaultChange,
  mode = "object",
}: StyleSectionHeaderProps) {
  return (
    <>
      <div className="styleSectionHeader">
        <div className="subSectionTitle">{title}</div>
        {mode === "object" && (
          <label className="checkboxRow defaultStyleToggle">
            <input
              type="checkbox"
              checked={selectedStyleAsDefault}
              onChange={(e) => onMakeStyleDefaultChange?.(e.target.checked)}
            />
            Set Default
          </label>
        )}
      </div>
      {mode === "toolDefault" && (
        <div className="toolDefaultNotice">
          <strong>Editing tool defaults</strong>
          <span>New objects use these settings. Switch to Move and select an object to edit an existing one.</span>
        </div>
      )}
    </>
  );
}
