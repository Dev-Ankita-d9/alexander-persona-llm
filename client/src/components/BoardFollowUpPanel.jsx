import { useState } from "react";
import { MessageSquare, Send, Loader } from "lucide-react";

export default function BoardFollowUpPanel({ questions, onSubmit, isLoading }) {
  const [answers, setAnswers] = useState(() => questions.map(() => ""));

  if (!questions?.length) return null;

  const handleChange = (i, value) => {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(answers);
  };

  const allAnswered = answers.every((a) => a.trim().length > 0);

  return (
    <div className="followup-panel">
      <div className="followup-panel-header">
        <MessageSquare size={15} className="followup-icon" />
        <span>The board has follow-up questions</span>
      </div>

      <form className="followup-form" onSubmit={handleSubmit}>
        {questions.map((q, i) => (
          <div key={i} className="followup-question-block">
            <p className="followup-question-text">{q.question}</p>
            {q.why && <p className="followup-question-why">{q.why}</p>}
            <textarea
              className="followup-answer-input"
              rows={3}
              placeholder="Your answer…"
              value={answers[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              disabled={isLoading}
            />
          </div>
        ))}

        <button
          type="submit"
          className="followup-submit-btn"
          disabled={!allAnswered || isLoading}
        >
          {isLoading ? (
            <>
              <Loader size={14} className="followup-spinner" />
              <span>Board is refining…</span>
            </>
          ) : (
            <>
              <Send size={14} />
              <span>Send answers to board</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
