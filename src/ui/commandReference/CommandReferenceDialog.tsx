import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  ASSIGNMENT_INTRO,
  COMMAND_SPECS,
  FUNCTION_SPECS,
  type CommandCategory,
  type CommandSpec,
  type FunctionCategory,
  type FunctionSpec,
} from "./commandReferenceData";

type ReferenceTab = "commands" | "functions";

type CommandReferenceDialogProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (template: string) => void;
};

const COMMAND_CATEGORY_ORDER: readonly CommandCategory[] = [
  "Points",
  "Lines",
  "Circles & Ellipses",
  "Polygons",
  "Angles & Sectors",
  "Transformations",
  "Measure",
];

const FUNCTION_CATEGORY_ORDER: readonly FunctionCategory[] = ["Measure", "Math", "Constants"];

function matchesQuery(haystack: readonly string[], query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return haystack.some((s) => s.toLowerCase().includes(q));
}

function groupByCategory<TCategory extends string, TSpec extends { category: TCategory }>(
  specs: readonly TSpec[],
  order: readonly TCategory[],
  query: string,
  searchFields: (spec: TSpec) => readonly string[]
): Array<{ category: TCategory; items: TSpec[] }> {
  const groups = new Map<TCategory, TSpec[]>();
  for (const spec of specs) {
    if (!matchesQuery(searchFields(spec), query)) continue;
    const list = groups.get(spec.category);
    if (list) list.push(spec);
    else groups.set(spec.category, [spec]);
  }
  return order.map((category) => ({ category, items: groups.get(category) ?? [] })).filter((group) => group.items.length > 0);
}

export function CommandReferenceDialog({ open, onClose, onInsert }: CommandReferenceDialogProps) {
  const [tab, setTab] = useState<ReferenceTab>("commands");
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dialogRef.current && !dialogRef.current.contains(target)) {
        onClose();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const groupedCommands = useMemo(
    () =>
      groupByCategory(COMMAND_SPECS, COMMAND_CATEGORY_ORDER, query, (spec) => [
        spec.name,
        spec.signature,
        spec.description,
        ...(spec.variants ?? []),
      ]),
    [query]
  );

  const groupedFunctions = useMemo(
    () => groupByCategory(FUNCTION_SPECS, FUNCTION_CATEGORY_ORDER, query, (spec) => [spec.name, spec.signature, spec.description]),
    [query]
  );

  if (!open) return null;

  const noResults = tab === "commands" ? groupedCommands.length === 0 : groupedFunctions.length === 0;

  return (
    <div className="preferencesOverlay" role="presentation">
      <section className="preferencesModal commandRefModal" role="dialog" aria-label="Command reference" ref={dialogRef}>
        <div className="preferencesModalHeader">
          <h2 className="preferencesModalTitle">Command Reference</h2>
          <button type="button" className="preferencesCloseButton" onClick={onClose} aria-label="Close command reference">
            <X size={14} />
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commands..."
          className="commandRefSearch"
          autoFocus
        />

        <div className="preferencesTabs" role="tablist" aria-label="Reference categories">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "commands"}
            className={tab === "commands" ? "preferencesTabButton active" : "preferencesTabButton"}
            onClick={() => setTab("commands")}
          >
            Commands
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "functions"}
            className={tab === "functions" ? "preferencesTabButton active" : "preferencesTabButton"}
            onClick={() => setTab("functions")}
          >
            Functions &amp; Math
          </button>
        </div>

        {tab === "commands" && query.length === 0 && (
          <div className="commandRefIntro">
            {ASSIGNMENT_INTRO.map((line) => (
              <div key={line} className="commandRefIntroRow">
                {line}
              </div>
            ))}
          </div>
        )}

        <div className="commandRefList">
          {noResults && <div className="commandRefEmpty">No matches for &quot;{query}&quot;.</div>}

          {tab === "commands" &&
            groupedCommands.map((group) => (
              <div key={group.category} className="commandRefGroup">
                <div className="commandRefCategoryTitle">{group.category}</div>
                {group.items.map((spec) => (
                  <CommandRow key={spec.name} spec={spec} onInsert={onInsert} />
                ))}
              </div>
            ))}

          {tab === "functions" &&
            groupedFunctions.map((group) => (
              <div key={group.category} className="commandRefGroup">
                <div className="commandRefCategoryTitle">{group.category}</div>
                {group.items.map((spec) => (
                  <FunctionRow key={spec.name} spec={spec} onInsert={onInsert} />
                ))}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function CommandRow({ spec, onInsert }: { spec: CommandSpec; onInsert: (template: string) => void }) {
  return (
    <button
      type="button"
      className="commandRefRow"
      title="Click to insert into the command bar"
      onClick={() => onInsert(spec.example)}
    >
      <code className="commandRefSignature">{spec.signature}</code>
      <span className="commandRefDescription">{spec.description}</span>
      {spec.variants && spec.variants.length > 0 && (
        <span className="commandRefVariants">Also: {spec.variants.join(", ")}</span>
      )}
      {spec.note && <span className="commandRefNote">{spec.note}</span>}
    </button>
  );
}

function FunctionRow({ spec, onInsert }: { spec: FunctionSpec; onInsert: (template: string) => void }) {
  return (
    <button
      type="button"
      className="commandRefRow"
      title="Click to insert into the command bar"
      onClick={() => onInsert(spec.example)}
    >
      <code className="commandRefSignature">{spec.signature}</code>
      <span className="commandRefDescription">{spec.description}</span>
    </button>
  );
}
