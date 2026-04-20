import { useEffect, useState } from "react";

const STAGES = {
  researching:  { label: "Researching",       hint: "Scanning live sources for relevant context…",                   pct: 8  },
  parsing:      { label: "Reading your brief", hint: "Structuring your question for the board…",                      pct: 18 },
  enriching:    { label: "Enriching context",  hint: "Adding industry benchmarks and market data…",                   pct: 28 },
  distributing: { label: "Briefing the board", hint: "Distributing your question to each advisor…",                   pct: 38 },
  deliberating: { label: "In deliberation",    hint: "Board members are forming independent positions…",              pct: 50 },
  scoring:      { label: "Evaluating",         hint: "Assessing depth and credibility of each response…",             pct: 60 },
  refining:     { label: "Refining",           hint: "Improving weak arguments before debate…",                       pct: 68 },
  debate:       { label: "Debate in progress", hint: "Advisors challenging each other's assumptions…",                pct: 76 },
  chair_review: { label: "Chair reviewing",    hint: "Board Chair weighing conflicting positions…",                   pct: 84 },
  follow_up:    { label: "Follow-up",          hint: "Chair pressing advisors on unsubstantiated claims…",            pct: 90 },
  resolution:   { label: "Drafting resolution","hint": "Synthesising the final board decision…",                      pct: 96 },
  one_pager:    { label: "One-pager",          hint: "Formatting investor one-pager…",                                pct: 98 },
  complete:     { label: "Done",               hint: "",                                                               pct: 100 },
};

export default function DeliberationProgress({ currentStage, isDeliberating }) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (!isDeliberating) return;
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(id);
  }, [isDeliberating]);

  if (!isDeliberating) return null;

  const stage = STAGES[currentStage] || { label: "Processing", hint: "Your board is at work…", pct: 20 };
  const pct = stage.pct;

  return (
    <div className="deliberation-progress" role="status" aria-live="polite">
      <div className="dp-top">
        <span className="dp-label">{stage.label}<span className="dp-dots" aria-hidden>{dots}</span></span>
        <span className="dp-pct">{pct}%</span>
      </div>

      <div className="dp-bar-track">
        <div className="dp-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {stage.hint && <p className="dp-hint">{stage.hint}</p>}
    </div>
  );
}
