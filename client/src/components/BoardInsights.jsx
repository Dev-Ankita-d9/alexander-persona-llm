import { useState } from "react";
import { ChevronDown, ChevronUp, Users, MessageSquare, Swords } from "lucide-react";
import { ADVISORS } from "../advisors";
import ReactMarkdown from "react-markdown";

export default function BoardInsights({
  advisorResponses,
  debateResponses = {},
  followUpQuestions,
  followUpResponses,
  errors,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const responseCount = Object.keys(advisorResponses).length;
  const debateCount = Object.keys(debateResponses).length;
  const errorCount = Object.keys(errors).length;

  if (responseCount === 0 && errorCount === 0) return null;

  return (
    <div className="board-insights">
      <button className="insights-toggle" onClick={() => setIsOpen(!isOpen)}>
        <Users size={16} />
        <span>
          Board Deliberation ({responseCount} opinion
          {responseCount !== 1 ? "s" : ""}
          {debateCount > 0 ? ` + ${debateCount} debate rebuttal${debateCount !== 1 ? "s" : ""}` : ""})
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="insights-content">
          {Object.entries(advisorResponses).map(([id, response]) => {
            const advisor = ADVISORS.find((a) => a.id === id);
            if (!advisor) return null;
            const hasDebate = debateResponses[id];
            const hasFollowUp = followUpQuestions?.[id];

            return (
              <div
                key={id}
                className="insight-card"
                style={{ "--advisor-color": advisor.color }}
              >
                <div className="insight-header">
                  <div className="insight-name-group">
                    <div className="insight-dot" />
                    <div>
                      <h3>{advisor.name}</h3>
                      {advisor.role && (
                        <span className="insight-role">{advisor.role}</span>
                      )}
                    </div>
                  </div>
                  <span className="insight-model">
                    {advisor.provider} &middot; {advisor.model}
                  </span>
                </div>

                <div className="insight-phase-label">
                  <span className="phase-tag initial">Initial Position</span>
                </div>
                <div className="insight-body">
                  <ReactMarkdown>{response}</ReactMarkdown>
                </div>

                {hasDebate && (
                  <div className="insight-debate">
                    <div className="debate-label">
                      <Swords size={14} />
                      <span>Debate Rebuttal &amp; Refined Position</span>
                    </div>
                    <div className="debate-body">
                      <ReactMarkdown>{debateResponses[id]}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {hasFollowUp && (
                  <div className="insight-followup">
                    <div className="followup-label">
                      <MessageSquare size={14} />
                      <span>Board Chair follow-up</span>
                    </div>
                    <div className="followup-question">
                      <p>{followUpQuestions[id]}</p>
                    </div>
                    {followUpResponses?.[id] && (
                      <div className="followup-response">
                        <ReactMarkdown>{followUpResponses[id]}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {Object.entries(errors).map(([id, error]) => {
            const advisor = ADVISORS.find((a) => a.id === id);
            return (
              <div
                key={id}
                className="insight-card errored"
                style={{ "--advisor-color": advisor?.color || "#888" }}
              >
                <div className="insight-header">
                  <div className="insight-name-group">
                    <div className="insight-dot" />
                    <div>
                      <h3>{advisor?.name || id}</h3>
                      {advisor?.role && (
                        <span className="insight-role">{advisor.role}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="insight-error">{error}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
