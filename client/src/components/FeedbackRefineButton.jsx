import { RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function FeedbackRefineButton({
  onRefine,
  isRefining,
  refinement,
  canRefine,
}) {
  if (!canRefine) return null;

  return (
    <div className="refine-section">
      <button
        className="refine-btn"
        onClick={onRefine}
        disabled={isRefining}
      >
        {isRefining ? (
          <>
            <span className="spinner small" />
            Refining...
          </>
        ) : (
          <>
            <RefreshCw size={16} />
            Refine with feedback
          </>
        )}
      </button>

      {refinement && (
        <div className="refinement-result">
          <h4>Refinement Suggestions</h4>
          <ReactMarkdown>{refinement}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
