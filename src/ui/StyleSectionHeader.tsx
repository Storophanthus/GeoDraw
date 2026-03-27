type StyleSectionHeaderProps = {
  title: string;
  selectedStyleAsDefault: boolean;
  onMakeStyleDefaultChange: (checked: boolean) => void;
};

export function StyleSectionHeader({
  title,
  selectedStyleAsDefault,
  onMakeStyleDefaultChange,
}: StyleSectionHeaderProps) {
  return (
    <div className="styleSectionHeader">
      <div className="subSectionTitle">{title}</div>
      <label className="checkboxRow defaultStyleToggle">
        <input
          type="checkbox"
          checked={selectedStyleAsDefault}
          onChange={(e) => onMakeStyleDefaultChange(e.target.checked)}
        />
        Make this default for this object
      </label>
    </div>
  );
}
