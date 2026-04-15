import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileSearch,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Building2,
  AlertTriangle,
} from "lucide-react";

const FIELD_LABELS = {
  problem: "Problem",
  solution: "Solution",
  market: "Market",
  traction: "Traction",
  businessModel: "Business Model",
  competition: "Competition",
  team: "Team",
  ask: "Funding Ask",
  moat: "Moat / Defensibility",
};

const SOURCE_CONFIG = {
  extracted: {
    label: "From input",
    icon: CheckCircle2,
    className: "source-extracted",
  },
  inferred: {
    label: "Inferred",
    icon: HelpCircle,
    className: "source-inferred",
  },
  missing: {
    label: "Missing",
    icon: XCircle,
    className: "source-missing",
  },
};

const QUALITY_CONFIG = {
  high: { label: "High Quality Input", className: "quality-high" },
  medium: { label: "Medium Quality Input", className: "quality-medium" },
  low: { label: "Low Quality Input", className: "quality-low" },
};

export default function ParsedInputPanel({ schema }) {
  const [expanded, setExpanded] = useState(false);

  if (!schema?.parsed) return null;

  const fields = Object.entries(schema.parsed);
  const extracted = fields.filter(([, f]) => f.source === "extracted").length;
  const inferred = fields.filter(([, f]) => f.source === "inferred").length;
  const missing = fields.filter(([, f]) => f.source === "missing").length;
  const qualityConfig = QUALITY_CONFIG[schema.inputQuality] || QUALITY_CONFIG.medium;

  return (
    <div className="parsed-input-panel">
      <button
        className="parsed-input-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <FileSearch size={16} />
        <span className="parsed-toggle-text">
          Structured Analysis
          <span className="parsed-summary-badges">
            {extracted > 0 && (
              <span className="parsed-badge badge-extracted">
                {extracted} extracted
              </span>
            )}
            {inferred > 0 && (
              <span className="parsed-badge badge-inferred">
                {inferred} inferred
              </span>
            )}
            {missing > 0 && (
              <span className="parsed-badge badge-missing">
                {missing} missing
              </span>
            )}
          </span>
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="parsed-input-content">
          {/* Company header */}
          {(schema.companyName || schema.industry || schema.stage) && (
            <div className="parsed-company-header">
              <Building2 size={16} />
              <div className="parsed-company-info">
                {schema.companyName && (
                  <span className="parsed-company-name">
                    {schema.companyName}
                  </span>
                )}
                <span className="parsed-company-meta">
                  {[
                    schema.industry,
                    schema.stage && schema.stage !== "unknown"
                      ? schema.stage.replace("-", " ")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <span className={`parsed-quality ${qualityConfig.className}`}>
                {qualityConfig.label}
              </span>
            </div>
          )}

          {schema.summary && (
            <p className="parsed-summary-text">{schema.summary}</p>
          )}

          {/* Schema fields */}
          <div className="parsed-fields">
            {Object.entries(FIELD_LABELS).map(([key, label]) => {
              const field = schema.parsed[key];
              if (!field) return null;
              const sourceConfig =
                SOURCE_CONFIG[field.source] || SOURCE_CONFIG.missing;
              const Icon = sourceConfig.icon;

              return (
                <div
                  key={key}
                  className={`parsed-field ${sourceConfig.className}`}
                >
                  <div className="parsed-field-header">
                    <span className="parsed-field-label">{label}</span>
                    <span
                      className={`parsed-source-tag ${sourceConfig.className}`}
                    >
                      <Icon size={12} />
                      {sourceConfig.label}
                    </span>
                  </div>
                  <p className="parsed-field-content">{field.content}</p>
                </div>
              );
            })}
          </div>

          {/* Critical gaps */}
          {schema.missingCritical?.length > 0 && (
            <div className="parsed-critical-gaps">
              <div className="parsed-gaps-header">
                <AlertTriangle size={14} />
                <span>Critical information gaps</span>
              </div>
              <ul className="parsed-gaps-list">
                {schema.missingCritical.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {schema.inputQualityRationale && (
            <p className="parsed-quality-rationale">
              {schema.inputQualityRationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
