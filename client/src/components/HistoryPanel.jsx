import { useState } from "react";
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Clock, Users } from "lucide-react";

export default function HistoryPanel({ feedback }) {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  if (feedback.length === 0) return null;

  const visible = feedback.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = visible.length < feedback.length;

  return (
    <div className="history-panel">
      <button className="history-toggle" onClick={() => setIsOpen(!isOpen)}>
        <Clock size={16} />
        <span>Feedback History ({feedback.length})</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="history-list">
          {visible.map((entry) => (
            <div key={entry.id} className="history-entry">
              <div className="history-entry-header">
                <span className="history-date">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
                <span className={`history-rating ${entry.rating}`}>
                  {entry.rating === "helpful" ? (
                    <ThumbsUp size={14} />
                  ) : (
                    <ThumbsDown size={14} />
                  )}
                </span>
              </div>
              <p className="history-query">{entry.query}</p>
              <div className="history-advisors">
                <Users size={12} />
                <span>{entry.advisorsUsed?.join(", ")}</span>
              </div>
            </div>
          ))}

          {hasMore && (
            <button className="history-more" onClick={() => setPage((p) => p + 1)}>
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
