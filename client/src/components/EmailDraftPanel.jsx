import { useState, useEffect } from "react";
import { Mail, Copy, Check, AlertTriangle } from "lucide-react";
import { generateEmailDraft } from "../api";
import { SYNTHESIS_MODEL } from "../advisors";

export default function EmailDraftPanel({ decision, query }) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!decision?.verdict || !query) return;
    setLoading(true);
    setDraft(null);
    setError(null);

    generateEmailDraft({ decision, query, model: SYNTHESIS_MODEL })
      .then((data) => setDraft(data.draft))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [decision, query]);

  const handleCopy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!decision?.verdict) return null;

  return (
    <div className="email-draft-panel">
      <div className="email-draft-header">
        <span className="email-draft-header-icon" aria-hidden>
          <Mail size={20} strokeWidth={2} />
        </span>
        <h2>Email Draft</h2>
        {draft && (
          <button
            className={`copy-btn${copied ? " copy-btn--copied" : ""}`}
            onClick={handleCopy}
            aria-label="Copy email to clipboard"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="email-draft-loading">
          <span className="email-draft-spinner" aria-hidden />
          <span>Drafting email…</span>
        </div>
      )}

      {error && (
        <div className="email-draft-error">
          <AlertTriangle size={15} />
          <span>Could not generate draft: {error}</span>
        </div>
      )}

      {draft && (
        <pre className="email-draft-body">{draft}</pre>
      )}
    </div>
  );
}
