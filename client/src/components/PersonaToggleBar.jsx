import { Check, Circle } from "lucide-react";

function activePresetId(advisors, activeAdvisors, presets) {
  const active = new Set(activeAdvisors);
  for (const preset of presets) {
    const ids = new Set(preset.advisorIds);
    if (
      ids.size === active.size &&
      preset.advisorIds.every((id) => active.has(id))
    ) {
      return preset.id;
    }
  }
  return null;
}

export default function PersonaToggleBar({
  advisors,
  activeAdvisors,
  onToggle,
  presets = [],
  onPresetSelect,
}) {
  const currentPreset = activePresetId(advisors, activeAdvisors, presets);

  return (
    <div className="persona-bar persona-bar--mockup">
      <div className="persona-bar-header">
        <span className="persona-bar-label">Your board</span>
        {presets.length > 0 && (
          <div className="persona-presets">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip${currentPreset === preset.id ? " preset-chip--active" : ""}`}
                onClick={() => onPresetSelect?.(preset.advisorIds)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="persona-grid">
        {advisors.map((advisor) => {
          const isActive = activeAdvisors.includes(advisor.id);
          return (
            <button
              key={advisor.id}
              type="button"
              className={`advisor-chip${isActive ? " advisor-chip--active" : ""}`}
              style={{ "--advisor-color": advisor.color }}
              onClick={() => onToggle(advisor.id)}
              aria-pressed={isActive}
              title={advisor.description}
            >
              <span className="advisor-chip-icon" aria-hidden>
                {isActive ? (
                  <Check size={13} strokeWidth={2.5} />
                ) : (
                  <Circle size={13} strokeWidth={2} />
                )}
              </span>
              <span className="advisor-chip-name">{advisor.name}</span>
              <span className="advisor-chip-role">({advisor.role})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
