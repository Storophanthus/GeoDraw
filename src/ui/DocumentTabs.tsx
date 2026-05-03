import { Plus, X } from "lucide-react";
import type { GeoDocumentTab } from "./useDocumentTabs";

type DocumentTabsProps = {
  documents: GeoDocumentTab[];
  activeDocumentId: string;
  onCreateDocument: () => void;
  onSelectDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onRenameDocument: (id: string, title: string) => void;
};

export function DocumentTabs({
  documents,
  activeDocumentId,
  onCreateDocument,
  onSelectDocument,
  onCloseDocument,
  onRenameDocument,
}: DocumentTabsProps) {
  return (
    <div className="documentTabsBar" role="tablist" aria-label="Canvas tabs">
      <div className="documentTabsScroller">
        {documents.map((doc) => {
          const active = doc.id === activeDocumentId;
          return (
            <div
              key={doc.id}
              role="tab"
              tabIndex={0}
              aria-selected={active}
              className={active ? "documentTab active" : "documentTab"}
              onClick={() => onSelectDocument(doc.id)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelectDocument(doc.id);
              }}
              onDoubleClick={() => {
                const title = window.prompt("Rename canvas", doc.title);
                if (title === null) return;
                onRenameDocument(doc.id, title);
              }}
              title={doc.file.savedName ?? doc.title}
            >
              <span className="documentTabTitle">{doc.title}</span>
              <button
                type="button"
                className="documentTabClose"
                title="Close canvas"
                aria-label={`Close ${doc.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseDocument(doc.id);
                }}
              >
                <X size={12} strokeWidth={2.4} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="documentTabAdd"
        onClick={onCreateDocument}
        title="New canvas"
        aria-label="New canvas"
      >
        <Plus size={15} strokeWidth={2.3} />
      </button>
    </div>
  );
}
