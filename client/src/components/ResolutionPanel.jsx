import { useState } from "react";
import {
  ThumbsUp, ThumbsDown, Globe, ChevronDown, ChevronUp, ExternalLink,
  ShieldCheck, ShieldAlert, Shield, Check, AlertTriangle, ArrowRight,
  Scale, ChevronRight, Users, Zap, Eye,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ADVISORS } from "../advisors";
import AdvisorAvatar from "./AdvisorAvatar";

const CONFIDENCE_CONFIG = {
  high:   { label: "High confidence",   icon: ShieldCheck,  className: "confidence-high"   },
  medium: { label: "Medium confidence", icon: Shield,       className: "confidence-medium" },
  low:    { label: "Low confidence",    icon: ShieldAlert,  className: "confidence-low"    },
};

function toArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) return [val];
  return [];
}

function getKeyReasoningBullets(decision) {
  const fromChair = toArray(decision.keyReasoning).filter(Boolean).slice(0, 5);
  if (fromChair.length) return { bullets: fromChair, isFallback: false };
  const fromConsensus = toArray(decision.consensus).filter(Boolean).slice(0, 5);
  return { bullets: fromConsensus, isFallback: fromConsensus.length > 0 };
}

function normalizeAdvisorHighlights(decision) {
  const raw = toArray(decision.advisorHighlights);
  return raw
    .filter((h) => h && typeof h === "object" && (h.highlight || h.name))
    .map((h) => ({ name: h.name || "Advisor", highlight: h.highlight || "" }))
    .filter((h) => h.highlight);
}

function ConfidenceBadge({ level, rationale }) {
  const config = CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.medium;
  const Icon = config.icon;
  return (
    <div className={`confidence-badge ${config.className}`}>
      <Icon size={14} />
      <span className="confidence-level">{config.label}</span>
      {rationale && <span className="confidence-rationale">{rationale}</span>}
    </div>
  );
}

function CollapsibleSection({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible-section">
      <button
        type="button"
        className="collapsible-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapsible-trigger-left">
          {Icon && <Icon size={14} className="collapsible-icon" />}
          <span>{title}</span>
        </span>
        <ChevronRight
          size={14}
          className={`collapsible-chevron${open ? " collapsible-chevron--open" : ""}`}
        />
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

const OWNER_LABELS = { user: "You", ai: "AI", external: "External" };
const PRIORITY_ORDER = { now: 0, "this-week": 1, later: 2, immediate: 0, "short-term": 1, "long-term": 2 };

function ActionItems({ items }) {
  if (!items?.length) return null;
  const sorted = [...items].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
  );
  return (
    <div className="action-items-list">
      {sorted.map((item, i) => (
        <div key={i} className="action-item-row">
          <span className={`action-priority priority-${item.priority || "this-week"}`}>
            {(item.priority || "this-week").replace("-", " ")}
          </span>
          <span className="action-item-text">{item.action}</span>
          {item.owner && (
            <span className={`action-owner owner-${item.owner}`}>
              {OWNER_LABELS[item.owner] || item.owner}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ConsensusList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="consensus-list">
      {items.map((item, i) => (
        <li key={i}>
          <span className="consensus-item-icon" aria-hidden>
            <Check size={13} strokeWidth={2.25} />
          </span>
          <span className="consensus-item-text">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ConflictsResolved({ conflicts }) {
  if (!conflicts?.length) return null;
  return (
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
            <ArrowRight size={12} />
            <span>
              <strong>
                Chair ruling{c.rulingFavor && c.rulingFavor !== "compromise"
                  ? ` (favors ${c.rulingFavor})`
                  : c.rulingFavor === "compromise" ? " (compromise)" : ""}:
              </strong>{" "}
              {c.chairRuling}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskAssessment({ risks }) {
  if (!risks?.length) return null;
  return (
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
  );
}

const STANCE_CONFIG = {
  proceed:     { label: "Proceed",     className: "stance-proceed"     },
  pause:       { label: "Pause",       className: "stance-pause"       },
  avoid:       { label: "Avoid",       className: "stance-avoid"       },
  investigate: { label: "Investigate", className: "stance-investigate" },
};

const ADVISOR_CONFIDENCE_CONFIG = {
  high:   { label: "High",   className: "advisor-conf-high"   },
  medium: { label: "Medium", className: "advisor-conf-medium" },
  low:    { label: "Low",    className: "advisor-conf-low"    },
};

function ContradictionAlert({ alert, pastDecisionRef, explanation }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="contradiction-alert" role="alert">
      <div className="contradiction-alert-header">
        <Eye size={14} className="contradiction-icon" />
        <span className="contradiction-label">
          Contradiction detected{pastDecisionRef ? ` (vs ${pastDecisionRef})` : ""}
        </span>
        <button
          type="button"
          className="contradiction-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >×</button>
      </div>
      <p className="contradiction-text">{alert}</p>
      {explanation && <p className="contradiction-explanation">{explanation}</p>}
    </div>
  );
}

function ConsensusMeter({ score }) {
  if (typeof score !== "number") return null;
  const pct = Math.max(0, Math.min(100, score));
  const label = pct >= 75 ? "Strong consensus" : pct >= 50 ? "Partial consensus" : "Divided board";
  const cls = pct >= 75 ? "consensus-high" : pct >= 50 ? "consensus-mid" : "consensus-low";
  return (
    <div className={`consensus-meter ${cls}`}>
      <div className="consensus-meter-header">
        <Users size={13} />
        <span className="consensus-meter-label">{label}</span>
        <span className="consensus-meter-pct">{pct}% aligned</span>
      </div>
      <div className="consensus-meter-track">
        <div className="consensus-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WeaknessPanel({ weaknesses }) {
  const items = Array.isArray(weaknesses) ? weaknesses.filter(Boolean) : [];
  if (!items.length) return null;
  return (
    <div className="weakness-panel">
      <div className="weakness-panel-label">
        <Zap size={13} /> Decision blind spots
      </div>
      <ul className="weakness-list">
        {items.map((w, i) => (
          <li key={i} className="weakness-item">{w}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ResolutionPanel({
  resolution,
  decision,
  warnings,
  researchSources,
  activeAdvisors = [],
  advisorStances = {},
  contradictionAlert,
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

  const boardMembers = ADVISORS.filter((a) => activeAdvisors.includes(a.id));

  return (
    <div className="resolution-panel resolution-panel--modern">

      {warnings?.length > 0 && (
        <div className="resolution-warnings">
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      {contradictionAlert && (
        <ContradictionAlert
          alert={contradictionAlert.alert}
          pastDecisionRef={contradictionAlert.pastDecisionRef}
          explanation={contradictionAlert.explanation}
        />
      )}

      {hasStructured ? (
        <div className="structured-decision">

          {/* THE VERDICT — must dominate the screen */}
          <div className="verdict-hero">
            {decision.impact && (
              <span className={`impact-badge impact-${decision.impact}`}>
                {decision.impact.toUpperCase()} IMPACT
              </span>
            )}
            <p className="verdict-hero-text text-pretty">{decision.verdict}</p>
          </div>

          {/* Attribution line — sits below the verdict, not above it */}
          {boardMembers.length > 0 && (
            <div className="board-attribution">
              {boardMembers.map((a) => (
                <span
                  key={a.id}
                  className="board-attribution-member"
                  style={{ "--advisor-color": a.color }}
                  title={`${a.name} · ${a.role}`}
                >
                  <AdvisorAvatar advisorId={a.id} size={18} />
                  <span className="board-attribution-name">{a.name}</span>
                </span>
              ))}
            </div>
          )}

          {/* Key reasoning — flows directly from verdict, no competing header */}
          {keyReasoningBullets.length > 0 && (
            <div className="key-reasoning-block">
              {keyReasoningFallback && (
                <p className="key-reasoning-fallback-hint">
                  Where the board aligned (structured summary unavailable).
                </p>
              )}
              <ul className="key-reasoning-list">
                {keyReasoningBullets.map((line, i) => (
                  <li key={i} className="text-pretty">{line}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action items — continuation of the verdict, not a separate module */}
          {toArray(decision.actionItems).length > 0 && (
            <div className="action-block">
              <span className="action-block-label">What to do next</span>
              <ActionItems items={toArray(decision.actionItems)} />
            </div>
          )}

          {/* Confidence — footnote after the substance, not inline with the verdict */}
          {decision.confidence && (
            <ConfidenceBadge
              level={decision.confidence}
              rationale={decision.confidenceRationale}
            />
          )}

          {/* Board Discussion — voices, consensus, narrative */}
          {(advisorHighlightRows.length > 0 || toArray(decision.consensus).length > 0 || decision.narrative || typeof decision.consensusScore === "number") && (
            <CollapsibleSection title="Board Discussion" defaultOpen>
              {typeof decision.consensusScore === "number" && (
                <ConsensusMeter score={decision.consensusScore} />
              )}
              {advisorHighlightRows.length > 0 && (
                <div className="analysis-sub">
                  <div className="analysis-sub-label">Board voices</div>
                  <div className="board-voices-list">
                    {advisorHighlightRows.map((row, i) => {
                      const advisor = ADVISORS.find((a) => a.name === row.name);
                      const stance = advisorStances[advisor?.id];
                      const stanceCfg = stance ? STANCE_CONFIG[stance.stance] : null;
                      const confCfg = stance ? ADVISOR_CONFIDENCE_CONFIG[stance.confidence] : null;
                      return (
                        <div
                          key={i}
                          className="board-voice-row"
                          style={{ "--advisor-color": advisor?.color || "var(--accent)" }}
                        >
                          <div className="board-voice-identity">
                            <span className="board-voice-avatar">
                              <AdvisorAvatar advisorId={advisor?.id} size={28} />
                            </span>
                            <span className="board-voice-name">{row.name}</span>
                            <span className="board-voice-role">{advisor?.roleShort || advisor?.role}</span>
                            {stanceCfg && (
                              <span className={`advisor-stance-badge ${stanceCfg.className}`}>
                                {stanceCfg.label}
                              </span>
                            )}
                            {confCfg && (
                              <span className={`advisor-conf-badge ${confCfg.className}`}>
                                {confCfg.label} conf.
                              </span>
                            )}
                          </div>
                          <p className="board-voice-text">{row.highlight}</p>
                          {stance?.stanceRationale && (
                            <p className="board-voice-rationale">{stance.stanceRationale}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {toArray(decision.consensus).length > 0 && !keyReasoningFallback && (
                <div className="analysis-sub">
                  <div className="analysis-sub-label">Where the board agreed</div>
                  <ConsensusList items={toArray(decision.consensus)} />
                </div>
              )}
              {decision.narrative && (
                <div className="analysis-sub">
                  <div className="analysis-sub-label">Additional context</div>
                  <div className="decision-narrative">
                    <ReactMarkdown>{decision.narrative}</ReactMarkdown>
                  </div>
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* Diverging Opinions — conflicts, risks, dissent, minority, weaknesses */}
          {(toArray(decision.conflictsResolved).length > 0 || toArray(decision.risks).length > 0 || decision.dissent || decision.minorityView || toArray(decision.weaknesses).length > 0) && (
            <CollapsibleSection title="Diverging Opinions" defaultOpen>
              {decision.minorityView && (
                <div className="analysis-sub">
                  <div className="analysis-sub-label minority-label">
                    <Users size={13} /> Minority position
                  </div>
                  <p className="minority-view-text">{decision.minorityView}</p>
                </div>
              )}
              {toArray(decision.conflictsResolved).length > 0 && (
                <div className="analysis-sub">
                  <div className="analysis-sub-label">
                    <Scale size={13} /> Conflicts resolved
                  </div>
                  <ConflictsResolved conflicts={toArray(decision.conflictsResolved)} />
                </div>
              )}
              {toArray(decision.risks).length > 0 && (
                <div className="analysis-sub">
                  <div className="analysis-sub-label">
                    <AlertTriangle size={13} /> Risks
                  </div>
                  <RiskAssessment risks={toArray(decision.risks)} />
                </div>
              )}
              {decision.dissent && (
                <div className="analysis-sub">
                  <div className="analysis-sub-label">
                    <ShieldAlert size={13} /> Dissenting view
                  </div>
                  <p className="dissent-text">{decision.dissent}</p>
                </div>
              )}
              {toArray(decision.weaknesses).length > 0 && (
                <WeaknessPanel weaknesses={toArray(decision.weaknesses)} />
              )}
            </CollapsibleSection>
          )}

        </div>
      ) : (
        <div className="resolution-body">
          <ReactMarkdown>{resolution}</ReactMarkdown>
        </div>
      )}

      {hasSources && (
        <div className="resolution-sources">
          <button
            className="sources-toggle"
            onClick={() => setShowSources(!showSources)}
          >
            <Globe size={13} />
            <span>{researchSources.length} source{researchSources.length !== 1 ? "s" : ""} referenced</span>
            {showSources ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showSources && (
            <div className="sources-list">
              {researchSources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="source-item">
                  <span className="source-title">{s.title}<ExternalLink size={10} /></span>
                  {s.snippet && <span className="source-snippet">{s.snippet}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="resolution-rating">
        <span className="rating-label">Was this helpful?</span>
        <button
          className={`rating-btn helpful${currentRating === "helpful" ? " active" : ""}`}
          onClick={() => onRate("helpful")}
        >
          <ThumbsUp size={16} />
        </button>
        <button
          className={`rating-btn unhelpful${currentRating === "unhelpful" ? " active" : ""}`}
          onClick={() => onRate("unhelpful")}
        >
          <ThumbsDown size={16} />
        </button>
      </div>
    </div>
  );
}
