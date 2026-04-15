import { useState } from "react";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
} from "lucide-react";

const CONVICTION_ICONS = {
  high: ShieldCheck,
  medium: Shield,
  low: ShieldAlert,
};

const VERDICT_CONFIG = {
  INVEST: { className: "verdict-invest", label: "Invest" },
  PASS: { className: "verdict-pass", label: "Pass" },
  CONDITIONAL: { className: "verdict-conditional", label: "Conditional" },
};

const SIGNAL_ICONS = {
  strong: TrendingUp,
  adequate: Minus,
  weak: TrendingDown,
};

const SECTION_ORDER = [
  "problem", "solution", "market", "businessModel", "traction",
  "competition", "team", "moat", "ask", "whyNow", "risks",
];

function toMarkdown(op) {
  if (!op) return "";
  const lines = [];

  lines.push(`# ${op.companyName || "Company One-Pager"}`);
  if (op.tagline) lines.push(`\n*${op.tagline}*`);
  const meta = [op.stage, op.industry].filter(Boolean).join(" · ");
  if (meta) lines.push(`\n**${meta}**`);
  lines.push("");

  if (op.investmentThesis) {
    lines.push("## Investment Thesis");
    lines.push(op.investmentThesis);
    lines.push("");
  }

  if (op.vcNarrative?.length) {
    lines.push("## VC Analysis");
    op.vcNarrative.forEach((p) => {
      lines.push(p);
      lines.push("");
    });
  }

  for (const key of SECTION_ORDER) {
    const s = op.sections?.[key];
    if (!s?.content) continue;
    lines.push(`## ${s.title} [${s.verdict || "—"}]`);
    lines.push(s.content);
    if (s.signal) lines.push(`> Signal: ${s.signal}`);
    lines.push("");
  }

  if (op.reasoning) {
    lines.push("## Board Reasoning");
    if (op.reasoning.accepted?.length) {
      lines.push("\n### Accepted");
      op.reasoning.accepted.forEach((r) => lines.push(`- ✓ ${r}`));
    }
    if (op.reasoning.rejected?.length) {
      lines.push("\n### Rejected");
      op.reasoning.rejected.forEach((r) => lines.push(`- ✗ ${r}`));
    }
    if (op.reasoning.openQuestions?.length) {
      lines.push("\n### Open Questions");
      op.reasoning.openQuestions.forEach((r) => lines.push(`- ? ${r}`));
    }
    lines.push("");
  }

  if (op.keyGaps?.length) {
    lines.push("## Key Information Gaps");
    op.keyGaps.forEach((g) => lines.push(`- ${g}`));
    lines.push("");
  }

  if (op.verdict) {
    lines.push(`## Verdict: ${op.verdict.decision}`);
    lines.push(op.verdict.reasoning);
    if (op.verdict.conditions?.length) {
      lines.push("\nConditions:");
      op.verdict.conditions.forEach((c) => lines.push(`- ${c}`));
    }
    lines.push("");
  }

  return lines.join("\n");
}

export default function OnePagerPanel({ onePager }) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!onePager) return null;

  const verdict = onePager.verdict || {};
  const vConfig = VERDICT_CONFIG[verdict.decision] || VERDICT_CONFIG.CONDITIONAL;
  const ConvictionIcon = CONVICTION_ICONS[verdict.conviction] || Shield;

  const filledSections = SECTION_ORDER.filter(
    (k) => onePager.sections?.[k]?.content
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(onePager));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="one-pager-panel">
      <div className="one-pager-header" onClick={() => setExpanded(!expanded)}>
        <div className="one-pager-title-row">
          <FileText size={22} />
          <h2>Investor One-Pager</h2>
          {verdict.decision && (
            <div className={`one-pager-verdict-badge ${vConfig.className}`}>
              {vConfig.label}
            </div>
          )}
          <div className={`one-pager-confidence conviction-${verdict.conviction || "medium"}`}>
            <ConvictionIcon size={14} />
            <span>{verdict.conviction || "medium"} conviction</span>
          </div>
        </div>
        <div className="one-pager-actions">
          <button
            className="copy-btn"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            title="Copy as Markdown"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {expanded && (
        <div className="one-pager-body">
          {/* Hero */}
          <div className="one-pager-hero">
            <h3 className="company-name">{onePager.companyName || "Company Overview"}</h3>
            {onePager.tagline && <p className="company-tagline">{onePager.tagline}</p>}
            <div className="company-meta">
              {onePager.stage && <span className="meta-tag stage-tag">{onePager.stage}</span>}
              {onePager.industry && <span className="meta-tag industry-tag">{onePager.industry}</span>}
            </div>
          </div>

          {/* Investment Thesis */}
          {onePager.investmentThesis && (
            <div className="one-pager-thesis">
              <h4>Investment Thesis</h4>
              <p>{onePager.investmentThesis}</p>
            </div>
          )}

          {/* VC Narrative */}
          {onePager.vcNarrative?.length > 0 && (
            <div className="one-pager-narrative">
              <div className="narrative-header">
                <BookOpen size={18} />
                <h4>VC Analysis</h4>
              </div>
              <div className="narrative-body">
                {onePager.vcNarrative.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning Trail */}
          {onePager.reasoning && (
            <div className="one-pager-reasoning">
              <h4>Board Reasoning</h4>
              <div className="reasoning-columns">
                {onePager.reasoning.accepted?.length > 0 && (
                  <div className="reasoning-group reasoning-accepted">
                    <div className="reasoning-group-header">
                      <CheckCircle2 size={15} />
                      <span>Accepted</span>
                    </div>
                    <ul>
                      {onePager.reasoning.accepted.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {onePager.reasoning.rejected?.length > 0 && (
                  <div className="reasoning-group reasoning-rejected">
                    <div className="reasoning-group-header">
                      <XCircle size={15} />
                      <span>Rejected</span>
                    </div>
                    <ul>
                      {onePager.reasoning.rejected.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {onePager.reasoning.openQuestions?.length > 0 && (
                  <div className="reasoning-group reasoning-questions">
                    <div className="reasoning-group-header">
                      <HelpCircle size={15} />
                      <span>Open Questions</span>
                    </div>
                    <ul>
                      {onePager.reasoning.openQuestions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sections — only those with content */}
          {filledSections.length > 0 && (
            <div className="one-pager-sections">
              {filledSections.map((key) => {
                const section = onePager.sections[key];
                const SignalIcon = SIGNAL_ICONS[section.verdict] || Minus;
                return (
                  <div key={key} className={`one-pager-section signal-${section.verdict || "adequate"}`}>
                    <div className="section-head">
                      <h4 className="section-title">{section.title}</h4>
                      <div className={`section-signal signal-badge-${section.verdict || "adequate"}`}>
                        <SignalIcon size={12} />
                        <span>{section.verdict || "—"}</span>
                      </div>
                    </div>
                    <p className="section-content">{section.content}</p>
                    {section.signal && (
                      <p className="section-signal-note">{section.signal}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Key Gaps — merged, not per-section */}
          {onePager.keyGaps?.length > 0 && (
            <div className="one-pager-gaps">
              <div className="gaps-header">
                <AlertTriangle size={15} />
                <h4>Key Information Gaps</h4>
              </div>
              <ul>
                {onePager.keyGaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Verdict */}
          {verdict.reasoning && (
            <div className={`one-pager-verdict-block ${vConfig.className}`}>
              <div className="verdict-header">
                <h4>Verdict: {vConfig.label}</h4>
                <div className={`conviction-badge conviction-${verdict.conviction || "medium"}`}>
                  <ConvictionIcon size={13} />
                  {verdict.conviction || "medium"} conviction
                </div>
              </div>
              <p className="verdict-reasoning">{verdict.reasoning}</p>
              {verdict.conditions?.length > 0 && (
                <div className="verdict-conditions">
                  <span className="conditions-label">
                    {verdict.decision === "CONDITIONAL" ? "Conditions:" : "What could change this:"}
                  </span>
                  <ul>
                    {verdict.conditions.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
