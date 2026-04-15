import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  Sliders,
  Scale,
  ShieldCheck,
  Gauge,
} from "lucide-react";
import {
  getScoringConfig,
  updateScoringConfig,
  resetScoringConfig,
} from "../api";

const ROLE_COLORS = {
  "Venture Capitalist": "#6366f1",
  Operator: "#f59e0b",
  "Growth Strategist": "#ef4444",
  Skeptic: "#06b6d4",
};

function SliderInput({ label, value, min, max, step, onChange, suffix = "" }) {
  return (
    <div className="config-slider">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {typeof value === "number" ? value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0) : value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ThresholdsSection({ thresholds, onChange }) {
  return (
    <div className="config-section">
      <div className="config-section-header">
        <Gauge size={16} />
        <h4>Score Thresholds</h4>
      </div>
      <p className="config-hint">
        Scores at or below "Refine" trigger auto-refinement. Scores between
        "Refine" and "Review" get conditional review. Above "Review" are
        accepted.
      </p>
      <div className="config-grid-2">
        <SliderInput
          label="Auto-Refine (≤)"
          value={thresholds.refine}
          min={1}
          max={8}
          step={1}
          onChange={(v) => onChange({ ...thresholds, refine: v })}
          suffix="/10"
        />
        <SliderInput
          label="Conditional Review (≤)"
          value={thresholds.review}
          min={2}
          max={9}
          step={1}
          onChange={(v) => onChange({ ...thresholds, review: v })}
          suffix="/10"
        />
      </div>
      <div className="threshold-preview">
        <div className="threshold-band refine-band" style={{ flex: thresholds.refine }}>
          <span>Refine</span>
          <span>1–{thresholds.refine}</span>
        </div>
        <div
          className="threshold-band review-band"
          style={{ flex: thresholds.review - thresholds.refine }}
        >
          <span>Review</span>
          <span>
            {thresholds.refine + 1}–{thresholds.review}
          </span>
        </div>
        <div
          className="threshold-band accept-band"
          style={{ flex: 10 - thresholds.review }}
        >
          <span>Accept</span>
          <span>
            {thresholds.review + 1}–10
          </span>
        </div>
      </div>
    </div>
  );
}

function DimensionsSection({ dimensions, onChange }) {
  const handleWeight = (id, weight) => {
    onChange(dimensions.map((d) => (d.id === id ? { ...d, weight } : d)));
  };

  return (
    <div className="config-section">
      <div className="config-section-header">
        <Sliders size={16} />
        <h4>Dimension Weights</h4>
      </div>
      <p className="config-hint">
        How much each scoring dimension contributes to the overall score.
        Default is 1.0 for all.
      </p>
      <div className="config-grid-3">
        {dimensions.map((dim) => (
          <SliderInput
            key={dim.id}
            label={dim.label}
            value={dim.weight}
            min={0.1}
            max={3.0}
            step={0.1}
            onChange={(v) => handleWeight(dim.id, v)}
            suffix="×"
          />
        ))}
      </div>
    </div>
  );
}

function EvidenceSection({ multipliers, onChange }) {
  return (
    <div className="config-section">
      <div className="config-section-header">
        <ShieldCheck size={16} />
        <h4>Evidence Multipliers</h4>
      </div>
      <p className="config-hint">
        Higher bar for inferred/missing data. User-provided data scores at face
        value; inferred/missing data is penalized.
      </p>
      <div className="config-grid-3">
        <SliderInput
          label="Extracted (user-provided)"
          value={multipliers.extracted}
          min={0.5}
          max={1.5}
          step={0.05}
          onChange={(v) => onChange({ ...multipliers, extracted: v })}
          suffix="×"
        />
        <SliderInput
          label="Inferred"
          value={multipliers.inferred}
          min={0.3}
          max={1.2}
          step={0.05}
          onChange={(v) => onChange({ ...multipliers, inferred: v })}
          suffix="×"
        />
        <SliderInput
          label="Missing"
          value={multipliers.missing}
          min={0.1}
          max={1.0}
          step={0.05}
          onChange={(v) => onChange({ ...multipliers, missing: v })}
          suffix="×"
        />
      </div>
    </div>
  );
}

function RefinementSection({ refinement, onChange }) {
  return (
    <div className="config-section">
      <div className="config-section-header">
        <RotateCcw size={16} />
        <h4>Refinement Loop</h4>
      </div>
      <p className="config-hint">
        Controls how many passes the refinement loop runs and when it stops.
      </p>
      <div className="config-grid-2">
        <SliderInput
          label="Max Passes"
          value={refinement.maxPasses}
          min={1}
          max={10}
          step={1}
          onChange={(v) => onChange({ ...refinement, maxPasses: v })}
        />
        <SliderInput
          label="Min Improvement Delta"
          value={refinement.minImprovementDelta}
          min={0.1}
          max={3.0}
          step={0.1}
          onChange={(v) => onChange({ ...refinement, minImprovementDelta: v })}
        />
      </div>
    </div>
  );
}

function RoleWeightsSection({ roleWeights, sectionLabels, onChange }) {
  const [expandedSection, setExpandedSection] = useState(null);

  const roles = Object.keys(roleWeights.problem || {});

  const handleRoleWeight = (section, role, value) => {
    const updated = {
      ...roleWeights,
      [section]: { ...roleWeights[section], [role]: value },
    };
    onChange(updated);
  };

  return (
    <div className="config-section">
      <div className="config-section-header">
        <Scale size={16} />
        <h4>Role Weights by Section</h4>
      </div>
      <p className="config-hint">
        Which advisor role dominates scoring for each section. Weights are
        auto-normalized to sum to 1.0 on save.
      </p>
      <div className="role-weights-list">
        {Object.entries(roleWeights).map(([section, weights]) => {
          const isExpanded = expandedSection === section;
          const total = Object.values(weights).reduce((a, b) => a + b, 0);
          return (
            <div key={section} className="role-weight-section">
              <button
                className="role-weight-toggle"
                onClick={() =>
                  setExpandedSection(isExpanded ? null : section)
                }
              >
                <span className="rw-section-label">
                  {sectionLabels[section] || section}
                </span>
                <span className="rw-section-preview">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className="rw-role-dot"
                      style={{
                        backgroundColor: ROLE_COLORS[role] || "#888",
                        width: `${Math.max(8, weights[role] * 40)}px`,
                      }}
                      title={`${role}: ${(weights[role] * 100).toFixed(0)}%`}
                    />
                  ))}
                </span>
                {isExpanded ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
              {isExpanded && (
                <div className="role-weight-details">
                  {roles.map((role) => (
                    <div key={role} className="role-weight-row">
                      <span
                        className="role-label"
                        style={{ color: ROLE_COLORS[role] || "#888" }}
                      >
                        {role}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={weights[role]}
                        onChange={(e) =>
                          handleRoleWeight(
                            section,
                            role,
                            Number(e.target.value)
                          )
                        }
                      />
                      <span className="role-weight-value">
                        {(weights[role] * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  <div className="role-weight-total">
                    Total: {(total * 100).toFixed(0)}%
                    {Math.abs(total - 1.0) > 0.02 && (
                      <span className="total-warning"> (will normalize on save)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScoringConfigPanel() {
  const [config, setConfig] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getScoringConfig()
      .then(({ config: c, defaults: d }) => {
        setConfig(c);
        setDefaults(d);
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const { config: updated } = await updateScoringConfig(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleReset = useCallback(async () => {
    setError(null);
    try {
      const { config: c, defaults: d } = await resetScoringConfig();
      setConfig(c);
      setDefaults(d);
      setSaved(false);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  if (!config) return null;

  const hasChanges =
    defaults && JSON.stringify(config) !== JSON.stringify(defaults);

  return (
    <div className="scoring-config-panel">
      <button
        className="scoring-config-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <Settings size={18} className={expanded ? "spinning-slow" : ""} />
        <span>Scoring Configuration</span>
        {hasChanges && <span className="config-modified-badge">Modified</span>}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="scoring-config-body">
          <ThresholdsSection
            thresholds={config.thresholds}
            onChange={(t) => setConfig({ ...config, thresholds: t })}
          />

          <DimensionsSection
            dimensions={config.dimensions}
            onChange={(d) => setConfig({ ...config, dimensions: d })}
          />

          <EvidenceSection
            multipliers={config.evidenceMultipliers}
            onChange={(m) => setConfig({ ...config, evidenceMultipliers: m })}
          />

          <RefinementSection
            refinement={config.refinement}
            onChange={(r) => setConfig({ ...config, refinement: r })}
          />

          <RoleWeightsSection
            roleWeights={config.roleWeights}
            sectionLabels={config.sectionLabels}
            onChange={(rw) => setConfig({ ...config, roleWeights: rw })}
          />

          {error && <div className="config-error">{error}</div>}

          <div className="config-actions">
            <button
              className="config-reset-btn"
              onClick={handleReset}
              title="Restore default values"
            >
              <RotateCcw size={14} />
              Reset to Defaults
            </button>
            <button
              className="config-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <span className="spinner small" />
              ) : saved ? (
                <ShieldCheck size={14} />
              ) : (
                <Save size={14} />
              )}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Configuration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
