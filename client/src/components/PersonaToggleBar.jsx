import { Rocket, Box, TrendingUp, ShieldAlert } from "lucide-react";

const ICONS = {
  Rocket,
  Box,
  TrendingUp,
  ShieldAlert,
};

export default function PersonaToggleBar({ advisors, activeAdvisors, onToggle }) {
  return (
    <div className="persona-bar">
      <span className="persona-bar-label">Your Board</span>
      <div className="persona-chips">
        {advisors.map((advisor) => {
          const isActive = activeAdvisors.includes(advisor.id);
          const Icon = ICONS[advisor.icon];
          return (
            <button
              key={advisor.id}
              className={`persona-chip ${isActive ? "active" : ""}`}
              style={{
                "--advisor-color": advisor.color,
                "--advisor-bg": advisor.color + "18",
                "--advisor-border": advisor.color + "40",
              }}
              onClick={() => onToggle(advisor.id)}
              title={advisor.description}
            >
              {Icon && <Icon size={15} />}
              <span className="chip-name">{advisor.name}</span>
              {advisor.role && <span className="chip-role">{advisor.role}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
