import { useState, useRef } from "react";
import { Send, Upload, X, FileText } from "lucide-react";

const PDF_EXTENSIONS = [".pdf"];
const TEXT_EXTENSIONS = [".txt", ".csv", ".md", ".json"];

function getExtension(name) {
  return (name || "").toLowerCase().replace(/^.*(\.[^.]+)$/, "$1");
}

export default function QueryPanel({ onSubmit, isLoading }) {
  const [query, setQuery] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const ext = getExtension(selected.name);

    if (PDF_EXTENSIONS.includes(ext)) {
      setFilePreview(`PDF file — ${(selected.size / 1024).toFixed(0)} KB — will be parsed on server`);
    } else if (TEXT_EXTENSIONS.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const lines = text.split("\n").length;
        setFilePreview(`${lines} lines — ${(selected.size / 1024).toFixed(0)} KB`);
      };
      reader.readAsText(selected);
    } else {
      setFilePreview(`${(selected.size / 1024).toFixed(0)} KB`);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit({ query: query.trim(), file: file || null });
  };

  return (
    <form onSubmit={handleSubmit} className="query-panel">
      <div className="query-panel-header">
        <h2>Ask Your Board</h2>
        <p className="subtitle">
          Pose a question and receive a formal board resolution
        </p>
      </div>

      <div className="query-input-wrapper">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Should we pivot our SaaS to an AI-first product or stay the course?"
          rows={4}
          className="query-textarea"
          disabled={isLoading}
        />
        <p className="query-hint">
          Attach PDFs or notes for extra context — they are parsed on the server before the board
          deliberates.
        </p>
      </div>

      {file && (
        <div className="file-badge">
          <FileText size={14} />
          <span className="file-badge-name">{file.name}</span>
          {filePreview && <span className="file-badge-info">{filePreview}</span>}
          <button type="button" onClick={removeFile} className="file-remove">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="query-actions">
        <label className="upload-btn">
          <Upload size={16} />
          <span>Attach File</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.md,.json,.pdf"
            onChange={handleFileChange}
            hidden
          />
        </label>

        <button type="submit" className="submit-btn" disabled={!query.trim() || isLoading}>
          {isLoading ? (
            <span className="btn-loading">
              <span className="spinner" />
              Board is deliberating...
            </span>
          ) : (
            <>
              <Send size={16} />
              <span>Submit to Board</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
