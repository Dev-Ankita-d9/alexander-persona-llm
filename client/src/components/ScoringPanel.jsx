import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

const CLASSIFICATION_CONFIG = {
  accept: {
    label: "Accept",
    icon: CheckCircle2,
    className: "cls-accept",
  },
  review: {
    label: "Review",
    icon: AlertTriangle,
    className: "cls-review",
  },
  refine: {
    label: "Refine",
    icon: XCircle,
    className: "cls-refine",
  },
};

const DIMENSION_LABELS = {
  specificity: "Specificity",
  credibility: "Credibility",
  narrative: "Narrative",
};

function ScoreBar({ score, max = 10 }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const colorClass =
    score >= 7 ? "bar-high" : score >= 5 ? "bar-medium" : "bar-low";
  return (
    <div className="score-bar-track">
      <div
        className={`score-bar-fill ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function OverallBadge({ score, classification }) {
  const config = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG.review;
  const Icon = config.icon;
  return (
    <div className={`scoring-overall-badge ${config.className}`}>
      <Icon size={18} />
      <span className="overall-score-value">{score}/10</span>
      <span className="overall-score-label">{config.label}</span>
    </div>
  );
}

function SectionRow({ sectionKey, data, isExpanded, onToggle }) {
  const config = CLASSIFICATION_CONFIG[data.classification] || CLASSIFICATION_CONFIG.review;
  const ClsIcon = config.icon;

  return (
    <div className={`scoring-section-row ${config.className}`}>
      <button className="scoring-section-header" onClick={onToggle}>
        <div className="scoring-section-left">
          <ClsIcon size={14} />
          <span className="scoring-section-label">{data.label}</span>
          <span className={`scoring-cls-tag ${config.className}`}>
            {config.label}
          </span>
        </div>
        <div className="scoring-section-right">
          <span className="scoring-section-score">{data.weightedAverage}</span>
          <ScoreBar score={data.weightedAverage} />
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {isExpanded && (
        <div className="scoring-section-detail">
          {/* Dimension breakdown */}
          <div className="scoring-dimensions">
            {Object.entries(DIMENSION_LABELS).map(([dimId, dimLabel]) => {
              const dimData = data.dimensions?.[dimId];
              if (!dimData) return null;
              return (
                <div key={dimId} className="scoring-dim-row">
                  <span className="scoring-dim-label">{dimLabel}</span>
                  <span className="scoring-dim-score">{dimData.score}</span>
                  <ScoreBar score={dimData.score} />
                </div>
              );
            })}
          </div>

          {/* Evidence source */}
          {data.evidenceSource && (
            <div className="scoring-evidence">
              <span className="scoring-evidence-label">Evidence basis:</span>
              <span className={`scoring-evidence-tag evidence-${data.evidenceSource}`}>
                {data.evidenceSource === "extracted"
                  ? "From user input"
                  : data.evidenceSource === "inferred"
                    ? "Inferred (higher bar)"
                    : "Not provided (highest bar)"}
              </span>
            </div>
          )}

          {/* Per-advisor breakdown */}
          {data.advisorBreakdown?.length > 0 && (
            <div className="scoring-advisor-breakdown">
              <div className="scoring-breakdown-header">Advisor Breakdown</div>
              {data.advisorBreakdown.map((advisor) => (
                <div key={advisor.advisorId} className="scoring-advisor-row">
                  <div className="scoring-advisor-info">
                    <span className="scoring-advisor-name">
                      {advisor.advisorName}
                    </span>
                    <span className="scoring-advisor-role">{advisor.role}</span>
                    <span className="scoring-advisor-weight">
                      ×{advisor.roleWeight.toFixed(2)}
                    </span>
                  </div>
                  <div className="scoring-advisor-scores">
                    {Object.entries(advisor.scores || {}).map(
                      ([dimId, dimScore]) => (
                        <div key={dimId} className="scoring-advisor-dim">
                          <span className="scoring-advisor-dim-label">
                            {DIMENSION_LABELS[dimId]?.[0] || dimId[0]?.toUpperCase()}
                          </span>
                          <span className="scoring-advisor-dim-value">
                            {dimScore.adjusted}
                          </span>
                          {dimScore.rationale && (
                            <span
                              className="scoring-advisor-dim-rationale"
                              title={dimScore.rationale}
                            >
                              {dimScore.rationale}
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScoringPanel({ scoring }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  if (!scoring) return null;

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const refineCount = scoring.sectionsToRefine?.length || 0;
  const reviewCount = scoring.sectionsToReview?.length || 0;
  const acceptCount = scoring.sectionsAccepted?.length || 0;

  return (
    <div className="scoring-panel">
      <button
        className="scoring-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <BarChart3 size={16} />
        <span className="scoring-toggle-text">
          Quality Scores
          <span className="scoring-summary-badges">
            {acceptCount > 0 && (
              <span className="scoring-badge badge-accept">
                {acceptCount} accepted
              </span>
            )}
            {reviewCount > 0 && (
              <span className="scoring-badge badge-review">
                {reviewCount} review
              </span>
            )}
            {refineCount > 0 && (
              <span className="scoring-badge badge-refine">
                {refineCount} refine
              </span>
            )}
          </span>
        </span>
        <OverallBadge
          score={scoring.overallScore}
          classification={scoring.overallClassification}
        />
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="scoring-content">
          {/* Section-by-section scores */}
          <div className="scoring-sections">
            {Object.entries(scoring.sections || {}).map(([key, data]) => {
              if (!data.advisorBreakdown?.length) return null;
              return (
                <SectionRow
                  key={key}
                  sectionKey={key}
                  data={data}
                  isExpanded={!!expandedSections[key]}
                  onToggle={() => toggleSection(key)}
                />
              );
            })}
          </div>

          {/* Advisor overall assessments */}
          {scoring.advisorAssessments && (
            <div className="scoring-assessments">
              <div className="scoring-assessments-header">
                Advisor Quality Assessments
              </div>
              {Object.entries(scoring.advisorAssessments).map(
                ([id, assessment]) => (
                  <div key={id} className="scoring-assessment-card">
                    <div className="scoring-assessment-name">
                      {assessment.advisorName}
                    </div>
                    <p className="scoring-assessment-text">
                      {assessment.overallAssessment}
                    </p>
                    <div className="scoring-assessment-meta">
                      {assessment.strongestSection && (
                        <span className="scoring-meta-strong">
                          <TrendingUp size={12} />
                          Strongest: {assessment.strongestSection}
                        </span>
                      )}
                      {assessment.weakestSection && (
                        <span className="scoring-meta-weak">
                          <TrendingDown size={12} />
                          Weakest: {assessment.weakestSection}
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
