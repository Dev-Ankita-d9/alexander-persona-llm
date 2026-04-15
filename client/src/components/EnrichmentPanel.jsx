import { useState } from "react";
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Building2,
  TrendingUp,
  BarChart3,
  Layers,
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

function hasContent(entry) {
  if (!entry) return false;
  return entry.context || entry.benchmark || entry.comparables;
}

export default function EnrichmentPanel({ enrichment }) {
  const [expanded, setExpanded] = useState(false);

  if (!enrichment) return null;

  const fieldEnrichments = enrichment.enrichments || {};
  const enrichedFields = Object.entries(fieldEnrichments).filter(([, e]) =>
    hasContent(e)
  );
  const comparables = enrichment.comparableCompanies || [];

  if (
    enrichedFields.length === 0 &&
    !enrichment.industryOverview &&
    !enrichment.stageContext &&
    comparables.length === 0
  ) {
    return null;
  }

  return (
    <div className="enrichment-panel">
      <div
        className="enrichment-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="enrichment-title-row">
          <Lightbulb size={20} />
          <h2>Light Enrichment</h2>
          <span className="enrichment-count">
            {enrichment.enrichmentCount || enrichedFields.length} field
            {(enrichment.enrichmentCount || enrichedFields.length) !== 1
              ? "s"
              : ""}{" "}
            enriched
          </span>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="enrichment-body">
          {enrichment.industryOverview && (
            <div className="enrichment-overview-card">
              <div className="overview-icon">
                <TrendingUp size={16} />
              </div>
              <div>
                <h4>Industry Overview</h4>
                <p>{enrichment.industryOverview}</p>
              </div>
            </div>
          )}

          {enrichment.stageContext && (
            <div className="enrichment-overview-card">
              <div className="overview-icon">
                <BarChart3 size={16} />
              </div>
              <div>
                <h4>Stage Context</h4>
                <p>{enrichment.stageContext}</p>
              </div>
            </div>
          )}

          {comparables.length > 0 && (
            <div className="enrichment-comparables">
              <div className="comparables-header">
                <Building2 size={15} />
                <h4>Comparable Companies</h4>
              </div>
              <div className="comparables-list">
                {comparables.map((comp, i) => (
                  <div key={i} className="comparable-card">
                    <span className="comparable-name">{comp.name}</span>
                    <span className="comparable-relevance">
                      {comp.relevance}
                    </span>
                    {comp.outcome && (
                      <span className="comparable-outcome">{comp.outcome}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {enrichedFields.length > 0 && (
            <div className="enrichment-fields">
              <div className="fields-header">
                <Layers size={15} />
                <h4>Field-Level Enrichments</h4>
              </div>
              <div className="enrichment-field-list">
                {enrichedFields.map(([key, entry]) => (
                  <div key={key} className="enrichment-field">
                    <span className="field-label">
                      {FIELD_LABELS[key] || key}
                    </span>
                    <div className="field-enrichments">
                      {entry.context && (
                        <p className="field-context">{entry.context}</p>
                      )}
                      {entry.benchmark && (
                        <p className="field-benchmark">
                          <span className="benchmark-tag">Benchmark</span>
                          {entry.benchmark}
                        </p>
                      )}
                      {entry.comparables && (
                        <p className="field-comparables">
                          <span className="comparables-tag">Comparables</span>
                          {entry.comparables}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
