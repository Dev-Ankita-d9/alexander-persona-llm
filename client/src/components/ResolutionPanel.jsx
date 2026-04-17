import { useState } from "react";
import {
  Gavel,
  ThumbsUp,
  ThumbsDown,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Shield,
  CheckCircle2,
  Check,
  AlertTriangle,
  ArrowRight,
  Scale,
  Target,
  ListChecks,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const CONFIDENCE_CONFIG = {
  high: { label: "High Confidence", icon: ShieldCheck, className: "confidence-high" },
  medium: { label: "Medium Confidence", icon: Shield, className: "confidence-medium" },
  low: { label: "Low Confidence", icon: ShieldAlert, className: "confidence-low" },
};

/** 3–5 bullets: primary from keyReasoning, else consensus lines for older decisions */
function getKeyReasoningBullets(decision) {
  const fromChair = Array.isArray(decision.keyReasoning)
    ? decision.keyReasoning.filter(Boolean).slice(0, 5)
    : [];
  if (fromChair.length) return { bullets: fromChair, isFallback: false };
  const fromConsensus = (decision.consensus || []).filter(Boolean).slice(0, 5);
  return { bullets: fromConsensus, isFallback: fromConsensus.length > 0 };
}

function normalizeAdvisorHighlights(decision) {
  const raw = decision.advisorHighlights;
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((h) => h && (h.highlight || h.name))
    .map((h) => ({
      name: h.name || "Advisor",
      highlight: h.highlight || "",
    }))
    .filter((h) => h.highlight);
}

function KeyReasoningSection({ bullets, isFallback }) {
  if (!bullets?.length) return null;
  return (
    <div className="decision-section decision-section--key-reasoning">
      <div className="section-header">
        <ListChecks size={16} />
        <h3>Key reasoning</h3>
      </div>
      {isFallback && (
        <p className="key-reasoning-fallback-hint">
          Where the board aligned (structured summary was unavailable for this run).
        </p>
      )}
      <ul className="key-reasoning-list">
        {bullets.map((line, i) => (
          <li key={i} className="text-pretty">{line}</li>
        ))}
      </ul>
    </div>
  );
}

function SubdetailsBlock({ icon: Icon, title, hint, children }) {
  return (
    <details className="resolution-subdetails">
      <summary className="resolution-subdetails-summary">
        <span className="resolution-subdetails-summary-main">
          {Icon && (
            <span className="resolution-subdetails-icon" aria-hidden>
              <Icon size={16} />
            </span>
          )}
          <span className="resolution-subdetails-title">{title}</span>
          {hint && <span className="resolution-subdetails-hint">{hint}</span>}
        </span>
        <ChevronDown className="resolution-subdetails-chevron" size={16} aria-hidden />
      </summary>
      <div className="resolution-subdetails-body">{children}</div>
    </details>
  );
}

function ConfidenceBadge({ level, rationale }) {
  const config = CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.medium;
  const Icon = config.icon;
  return (
    <div className={`confidence-badge ${config.className}`}>
      <Icon size={16} />
      <span className="confidence-level">{config.label}</span>
      {rationale && <span className="confidence-rationale">{rationale}</span>}
    </div>
  );
}

function ConsensusList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="decision-section decision-section--consensus">
      <div className="section-header">
        <CheckCircle2 size={16} />
        <h3>Consensus</h3>
      </div>
      <ul className="consensus-list">
        {items.map((item, i) => (
          <li key={i}>
            <span className="consensus-item-icon" aria-hidden>
              <Check size={15} strokeWidth={2.25} />
            </span>
            <span className="consensus-item-text">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConflictsResolved({ conflicts }) {
  if (!conflicts?.length) return null;
  return (
    <div className="decision-section">
      <div className="section-header">
        <Scale size={16} />
        <h3>Conflicts Resolved</h3>
      </div>
      <div className="conflicts-list">
        {conflicts.map((c, i) => (
          <div key={i} className="conflict-card">
            <div className="conflict-topic">{c.topic}</div>
            {c.sides && (
              <div className="conflict-sides">
                {Object.entries(c.sides).map(([name, position]) => (
                  <div key={name} className="conflict-side">
                    <span className="side-name">{name}:</span>
                    <span className="side-position">{position}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="conflict-ruling">
              <ArrowRight size={13} />
              <span>
                <strong>Chair ruling{c.rulingFavor && c.rulingFavor !== "compromise" ? ` (favors ${c.rulingFavor})` : c.rulingFavor === "compromise" ? " (compromise)" : ""}:</strong>{" "}
                {c.chairRuling}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskAssessment({ risks }) {
  if (!risks?.length) return null;
  return (
    <div className="decision-section">
      <div className="section-header">
        <AlertTriangle size={16} />
        <h3>Risk Assessment</h3>
      </div>
      <div className="risks-list">
        {risks.map((r, i) => (
          <div key={i} className={`risk-card risk-${r.severity || "medium"}`}>
            <div className="risk-header">
              <span className={`risk-severity severity-${r.severity || "medium"}`}>
                {(r.severity || "medium").toUpperCase()}
              </span>
              <span className="risk-description">{r.risk}</span>
            </div>
            {r.mitigation && (
              <div className="risk-mitigation">
                <span className="mitigation-label">Mitigation:</span> {r.mitigation}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionItems({ items }) {
  if (!items?.length) return null;
  const priorityOrder = { immediate: 0, "short-term": 1, "long-term": 2 };
  const sorted = [...items].sort(
    (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
  );
  return (
    <div className="decision-section">
      <div className="section-header">
        <Target size={16} />
        <h3>Action Items</h3>
      </div>
      <div className="actions-list">
        {sorted.map((item, i) => (
          <div key={i} className="action-card">
            <span className={`action-priority priority-${item.priority || "short-term"}`}>
              {(item.priority || "short-term").replace("-", " ")}
            </span>
            <div className="action-content">
              <span className="action-text">{item.action}</span>
              {item.rationale && (
                <span className="action-rationale">{item.rationale}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResolutionPanel({
  resolution,
  decision,
  warnings,
  researchSources,
  onRate,
  currentRating,
}) {
  const [showSources, setShowSources] = useState(false);

  if (!resolution && !decision) return null;

  const hasSources = researchSources?.length > 0;
  const hasStructured = decision?.verdict;
  const { bullets: keyReasoningBullets, isFallback: keyReasoningFallback } =
    hasStructured ? getKeyReasoningBullets(decision) : { bullets: [], isFallback: false };
  const advisorHighlightRows = hasStructured ? normalizeAdvisorHighlights(decision) : [];

  return (
    <div className="resolution-panel resolution-panel--modern">
      <div className="resolution-header">
        <span className="resolution-header-icon" aria-hidden>
          <Gavel size={20} strokeWidth={2} />
        </span>
        <h2 className="tracking-tight">Board Decision</h2>
      </div>

      {warnings?.length > 0 && (
        <div className="resolution-warnings">
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {hasStructured ? (
        <div className="structured-decision">
          <div className="verdict-block">
            <div className="decision-hero-label">Decision</div>
            <p className="decision-hero-micro">
              Clear recommendation — no filler. Act on this first.
            </p>
            <div className="verdict-text text-pretty">{decision.verdict}</div>
            {decision.confidence && (
              <ConfidenceBadge
                level={decision.confidence}
                rationale={decision.confidenceRationale}
              />
            )}
          </div>

          <KeyReasoningSection
            bullets={keyReasoningBullets}
            isFallback={keyReasoningFallback}
          />

          <ConsensusList
            items={keyReasoningFallback ? [] : decision.consensus}
          />
          <ConflictsResolved conflicts={decision.conflictsResolved} />
          <RiskAssessment risks={decision.risks} />
          <ActionItems items={decision.actionItems} />

          {decision.dissent && (
            <div className="decision-section dissent-section">
              <div className="section-header">
                <ShieldAlert size={16} />
                <h3>Dissenting View</h3>
              </div>
              <p className="dissent-text">{decision.dissent}</p>
            </div>
          )}

          {advisorHighlightRows.length > 0 && (
            <SubdetailsBlock
              icon={Users}
              title="Advisor highlights"
              hint="Optional — not the main recommendation"
            >
              <ul className="advisor-highlights-list">
                {advisorHighlightRows.map((row, i) => (
                  <li key={i}>
                    <span className="advisor-highlights-name">{row.name}</span>
                    <span className="advisor-highlights-text">{row.highlight}</span>
                  </li>
                ))}
              </ul>
            </SubdetailsBlock>
          )}

          {decision.narrative && (
            <SubdetailsBlock
              title="Additional context"
              hint="Optional"
            >
              <div className="decision-narrative decision-narrative--subdetails">
                <ReactMarkdown>{decision.narrative}</ReactMarkdown>
              </div>
            </SubdetailsBlock>
          )}
        </div>
      ) : (
        <div className="resolution-body prose-sm">
          <ReactMarkdown>{resolution}</ReactMarkdown>
        </div>
      )}

      {hasSources && (
        <div className="resolution-sources">
          <button
            className="sources-toggle"
            onClick={() => setShowSources(!showSources)}
          >
            <Globe size={14} />
            <span>
              {researchSources.length} source
              {researchSources.length !== 1 ? "s" : ""} referenced
            </span>
            {showSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showSources && (
            <div className="sources-list">
              {researchSources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-item"
                >
                  <span className="source-title">
                    {s.title}
                    <ExternalLink size={11} />
                  </span>
                  {s.snippet && (
                    <span className="source-snippet">{s.snippet}</span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="resolution-rating">
        <span className="rating-label">Was this decision helpful?</span>
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
    </div>
  );
}
