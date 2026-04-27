import { useState } from "react";
import { History, X, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";

function DecisionDetail({ entry }) {
  const verdict = entry.decision?.verdict;
  const keyReasoning = entry.decision?.keyReasoning;
  const actionItems = entry.decision?.actionItems;

  const reasoningList = Array.isArray(keyReasoning)
    ? keyReasoning
    : typeof keyReasoning === "string" && keyReasoning.trim()
    ? [keyReasoning]
    : [];

  const actionList = Array.isArray(actionItems) ? actionItems : [];

  return (
    <div className="past-decision-detail">
      {verdict && <p className="past-decision-detail-verdict">{verdict}</p>}
      {reasoningList.length > 0 && (
        <ul className="past-decision-detail-list">
          {reasoningList.slice(0, 4).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {actionList.length > 0 && (
        <div className="past-decision-detail-actions">
          {actionList.slice(0, 3).map((item, i) => (
            <span key={i} className="past-decision-detail-action">
              {typeof item === "string" ? item : item.action}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PastDecisionPicker({ history, selected, onChange, onDelete, onClearAll }) {
  const [expandedId, setExpandedId] = useState(null);
  const selectedIds = new Set(selected.map((d) => d.id));

  const toggleSelect = (entry, e) => {
    e.stopPropagation();
    if (selectedIds.has(entry.id)) {
      onChange(selected.filter((d) => d.id !== entry.id));
    } else {
      onChange([...selected, entry].slice(-3));
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (expandedId === id) setExpandedId(null);
    onDelete?.(id);
  };

  return (
    <div className="past-decision-picker">
      <div className="past-decision-picker-header">
        <History size={13} />
        <span>Reference a past decision</span>
        {history.length > 0 && (
          <button
            type="button"
            className="past-decision-clear-all"
            onClick={onClearAll}
            title="Delete all past decisions"
          >
            <Trash2 size={11} />
            Clear all
          </button>
        )}
      </div>
      <div className="past-decision-list">
        {history.slice(0, 8).map((entry) => {
          const isSelected = selectedIds.has(entry.id);
          const isExpanded = expandedId === entry.id;
          return (
            <div
              key={entry.id}
              className={`past-decision-chip${isSelected ? " past-decision-chip--active" : ""}`}
            >
              <div
                className="past-decision-chip-row"
                onClick={() => toggleExpand(entry.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && toggleExpand(entry.id)}
              >
                <span className="past-decision-chip-query">{entry.query}</span>
                <span className="past-decision-chip-date">
                  {new Date(entry.timestamp).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                <button
                  type="button"
                  className="past-decision-chip-delete"
                  onClick={(e) => handleDelete(e, entry.id)}
                  title="Delete this decision"
                >
                  <X size={11} />
                </button>
              </div>
              {isExpanded && (
                <div className="past-decision-chip-expanded">
                  <DecisionDetail entry={entry} />
                  <button
                    type="button"
                    className={`past-decision-use-btn${isSelected ? " past-decision-use-btn--active" : ""}`}
                    onClick={(e) => toggleSelect(entry, e)}
                  >
                    {isSelected ? (
                      <>
                        <Check size={11} /> Referenced
                      </>
                    ) : (
                      "Use as reference"
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
