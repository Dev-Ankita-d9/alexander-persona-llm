import { Check, Circle } from "lucide-react";

const ROLE_SHORT = {
  "vc-musk": "VC",
  "operator-bezos": "Operator",
  "growth-gary": "Growth",
  "skeptic-taleb": "Skeptic",
};

export default function PersonaToggleBar({ advisors, activeAdvisors, onToggle }) {
  return (
    <div className="persona-bar persona-bar--mockup">
      <span className="persona-bar-label">Your board</span>
      <div className="persona-chips persona-chips--mockup">
        {advisors.map((advisor) => {
          const isActive = activeAdvisors.includes(advisor.id);
          const short = advisor.roleShort || ROLE_SHORT[advisor.id] || advisor.role;
          return (
            <button
              key={advisor.id}
              type="button"
              className={`persona-chip persona-chip--mockup ${isActive ? "active" : ""}`}
              style={{
                "--advisor-color": advisor.color,
                "--advisor-bg": advisor.color + "22",
                "--advisor-border": advisor.color + "55",
              }}
              onClick={() => onToggle(advisor.id)}
              title={advisor.description}
            >
              <span className="chip-check" aria-hidden>
                {isActive ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : (
                  <Circle size={14} strokeWidth={2} className="chip-check-empty" />
                )}
              </span>
              <span className="chip-name">{advisor.name}</span>
              <span className="chip-role-short">({short})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
