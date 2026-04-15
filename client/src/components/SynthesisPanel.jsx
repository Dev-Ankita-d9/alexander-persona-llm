import { ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function SynthesisPanel({
  synthesis,
  synthesisWarning,
  isLoading,
  onRate,
  currentRating,
}) {
  if (!synthesis && !isLoading && !synthesisWarning) return null;

  return (
    <div className="synthesis-panel">
      <div className="synthesis-header">
        <Sparkles size={20} />
        <h2>Synthesis</h2>
      </div>

      {synthesisWarning && (
        <div className="synthesis-warning">{synthesisWarning}</div>
      )}

      {isLoading ? (
        <div className="synthesis-loading">
          <div className="synthesis-spinner" />
          <span>Synthesizing advisor perspectives...</span>
        </div>
      ) : (
        synthesis && (
          <>
            <div className="synthesis-body">
              <ReactMarkdown>{synthesis}</ReactMarkdown>
            </div>

            <div className="synthesis-rating">
              <span className="rating-label">Was this helpful?</span>
              <button
                className={`rating-btn helpful ${currentRating === "helpful" ? "active" : ""}`}
                onClick={() => onRate("helpful")}
              >
                <ThumbsUp size={18} />
              </button>
              <button
                className={`rating-btn unhelpful ${currentRating === "unhelpful" ? "active" : ""}`}
                onClick={() => onRate("unhelpful")}
              >
                <ThumbsDown size={18} />
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}
