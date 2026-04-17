import { Loader2 } from "lucide-react";

const STAGE_LABELS = {
  researching: "Gathering real-time data...",
  parsing: "Analyzing your input...",
  enriching: "Adding industry context...",
  distributing: "Consulting board members...",
  deliberating: "Board members deliberating...",
  scoring: "Evaluating response quality...",
  refining: "Improving responses...",
  debate: "Advisors debating positions...",
  chair_review: "Board Chair reviewing...",
  follow_up: "Requesting clarification...",
  resolution: "Producing final decision...",
  one_pager: "Generating one-pager...",
  complete: "Done",
};

export default function DeliberationProgress({
  currentStage,
  isDeliberating,
}) {
  if (!isDeliberating) return null;

  const label = STAGE_LABELS[currentStage] || "Processing...";

  return (
    <div className="deliberation-progress simple-loader" role="status" aria-live="polite">
      <div className="loader-icon-wrap">
        <Loader2 size={22} className="spinning" aria-hidden />
      </div>
      <div className="loader-text">
        <span className="loader-label font-medium">{label}</span>
        <span className="loader-hint text-pretty">Your board is working through research, debate, and synthesis</span>
      </div>
    </div>
  );
}
