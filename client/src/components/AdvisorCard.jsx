import { Target, BarChart3, ShieldAlert, Lightbulb, DollarSign, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

const ICONS = {
  Target,
  BarChart3,
  ShieldAlert,
  Lightbulb,
  DollarSign,
};

const PROVIDER_COLORS = {
  Anthropic: "#d97706",
  OpenAI: "#10b981",
};

export default function AdvisorCard({ advisor, response, error, isLoading }) {
  const Icon = ICONS[advisor.icon];
  const providerColor = PROVIDER_COLORS[advisor.provider] || "#8888a0";

  return (
    <div
      className={`advisor-card ${isLoading ? "loading" : ""} ${error ? "errored" : ""}`}
      style={{ "--advisor-color": advisor.color }}
    >
      <div className="advisor-card-header">
        <div className="advisor-card-icon" style={{ background: advisor.color + "20" }}>
          {Icon && <Icon size={20} color={advisor.color} />}
        </div>
        <div className="advisor-card-header-text">
          <h3 className="advisor-card-name">{advisor.name}</h3>
          <p className="advisor-card-desc">{advisor.description}</p>
        </div>
        <span
          className="advisor-model-badge"
          style={{ "--provider-color": providerColor }}
        >
          {advisor.provider} <span className="advisor-model-id">{advisor.model}</span>
        </span>
      </div>

      <div className="advisor-card-body">
        {isLoading && (
          <div className="advisor-loading">
            <div className="advisor-spinner" style={{ borderTopColor: advisor.color }} />
            <span>Thinking...</span>
          </div>
        )}

        {error && (
          <div className="advisor-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && response && (
          <div className="advisor-response">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        )}

        {!isLoading && !error && !response && (
          <div className="advisor-empty">Waiting for query...</div>
        )}
      </div>
    </div>
  );
}
