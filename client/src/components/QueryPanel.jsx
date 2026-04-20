import { useState, useRef } from "react";
import { Send, Paperclip, X, FileText, ChevronDown } from "lucide-react";
import BrandSparkleLogo from "./BrandSparkleLogo";
import { FORMATS } from "./OutputFormatSelector";

const PDF_EXTENSIONS = [".pdf"];
const TEXT_EXTENSIONS = [".txt", ".csv", ".md", ".json"];
const EXCEL_EXTENSIONS = [".xlsx", ".xls"];
const PPTX_EXTENSIONS = [".pptx"];

function getExtension(name) {
  return (name || "").toLowerCase().replace(/^.*(\.[^.]+)$/, "$1");
}

export default function QueryPanel({
  onSubmit,
  isLoading,
  outputFormat,
  onFormatChange,
}) {
  const [query, setQuery] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showFormats, setShowFormats] = useState(false);
  const fileInputRef = useRef(null);

  const activeFormat = FORMATS.find((f) => f.id === outputFormat) || FORMATS[0];

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const ext = getExtension(selected.name);
    const kb = (selected.size / 1024).toFixed(0);

    if (PDF_EXTENSIONS.includes(ext)) {
      setFilePreview(`PDF — ${kb} KB`);
    } else if (EXCEL_EXTENSIONS.includes(ext)) {
      setFilePreview(`Excel — ${kb} KB`);
    } else if (PPTX_EXTENSIONS.includes(ext)) {
      setFilePreview(`PowerPoint — ${kb} KB`);
    } else if (TEXT_EXTENSIONS.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const lines = ev.target.result.split("\n").length;
        setFilePreview(`${lines} lines · ${kb} KB`);
      };
      reader.readAsText(selected);
    } else {
      setFilePreview(`${kb} KB`);
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
    onSubmit({ query: query.trim(), file: file || null, outputFormat });
  };

  const handleFormatSelect = (id) => {
    onFormatChange(id);
    setShowFormats(false);
  };

  return (
    <form onSubmit={handleSubmit} className="query-panel query-panel--mockup">
      <div className="query-panel-header">
        <div className="query-panel-logo" aria-hidden="true">
          <BrandSparkleLogo size={48} className="brand-sparkle-logo" />
        </div>
        <h2 className="text-balance tracking-tight">Ask Your Board</h2>
        <p className="subtitle text-pretty">
          Pose a question and receive a formal board resolution from your AI advisory board.
        </p>
      </div>

      <div className="query-composer">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe your situation, challenge, or strategic question…"
          rows={5}
          className="query-textarea query-textarea--mockup leading-relaxed"
          disabled={isLoading}
        />

        {file && (
          <div className="file-badge file-badge--in-composer">
            <FileText size={14} aria-hidden />
            <span className="file-badge-name">{file.name}</span>
            {filePreview && <span className="file-badge-info">{filePreview}</span>}
            <button
              type="button"
              onClick={removeFile}
              className="file-remove"
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {showFormats && (
          <div className="format-drawer">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`format-chip${outputFormat === f.id ? " format-chip--active" : ""}`}
                onClick={() => handleFormatSelect(f.id)}
                disabled={isLoading}
                title={f.description}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="query-composer-toolbar">
          <div className="query-composer-toolbar-left">
            <label className="attach-link">
              <Paperclip size={16} strokeWidth={2} aria-hidden />
              <span>Attach</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.md,.json,.pdf,.xlsx,.xls,.pptx"
                onChange={handleFileChange}
                hidden
                disabled={isLoading}
              />
            </label>

            <button
              type="button"
              className={`format-toggle-btn${showFormats ? " format-toggle-btn--open" : ""}`}
              onClick={() => setShowFormats((v) => !v)}
              disabled={isLoading}
              title="Change output format"
            >
              <span className="format-toggle-label">{activeFormat.label}</span>
              <ChevronDown size={13} className="format-toggle-chevron" />
            </button>
          </div>

          <button
            type="submit"
            className="send-circle-btn"
            disabled={!query.trim() || isLoading}
            aria-label={isLoading ? "Sending" : "Send to board"}
          >
            {isLoading ? (
              <span className="send-circle-btn-spinner" aria-hidden />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
