const FORMATS = [
  {
    id: "structured-memo",
    label: "Structured Memo",
    description: "Full board decision with reasoning, risks, and action items",
  },
  {
    id: "quick-answer",
    label: "Quick Answer",
    description: "Verdict only — no deep analysis, fastest response",
  },
  {
    id: "one-pager",
    label: "Investor One-Pager",
    description: "Full formatted one-pager document for investors",
  },
  {
    id: "action-plan",
    label: "Action Plan",
    description: "Prioritized next steps only, no narrative",
  },
  {
    id: "email-draft",
    label: "Email Draft",
    description: "Decision formatted as a ready-to-send professional email",
  },
];

export { FORMATS };

export default function OutputFormatSelector({ value, onChange, disabled }) {
  return (
    <div className="output-format-selector">
      <span className="output-format-label">Output format</span>
      <div className="output-format-chips">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`format-chip${value === f.id ? " format-chip--active" : ""}`}
            onClick={() => onChange(f.id)}
            disabled={disabled}
            title={f.description}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
