const { callLLM } = require("./llm-providers");

const ONE_PAGER_SYSTEM_PROMPT = `You are a senior VC analyst producing an investor one-pager. You think like an investor — skeptical, pattern-matching, thesis-driven.

Your output is NOT a report. It is a structured reasoning artifact that shows HOW the board arrived at its conclusion. Think of it as "the board's brain, on paper."

Respond with ONLY valid JSON matching this schema (no markdown, no extra text):

{
  "companyName": "string",
  "tagline": "One punchy sentence — the value prop an LP would remember",
  "stage": "Pre-seed / Seed / Series A / etc.",
  "industry": "Primary vertical",

  "investmentThesis": "2-3 sentence thesis statement. Pattern: 'We believe [company] is positioned to [outcome] because [evidence]. The key bet is [core assumption].'",

  "vcNarrative": [
    "Paragraph 1 — THE SETUP: What is this company, what market are they in, and what pattern do we recognize? Write like a partner opening a deal memo at an IC meeting. Use 'We see...' or 'This is a bet on...' framing. 3-4 sentences.",
    "Paragraph 2 — WHAT'S WORKING: What evidence gives us confidence? Reference specific data points, advisor insights, or market signals. Be concrete — 'The 50-restaurant deployment with $200/mo ARPU suggests...' not 'There is early traction.' 3-5 sentences.",
    "Paragraph 3 — WHAT CONCERNS US: The honest risks. Not boilerplate 'competition is a risk' — specific structural concerns the board surfaced. 'The single-city concentration combined with no restaurant industry experience on the founding team means...' 3-5 sentences.",
    "Paragraph 4 — THE DECISION: Why we're making this call. Connect the dots — how does the evidence weigh against the concerns? What would need to be true for this to be a fund-returner? 2-4 sentences."
  ],

  "sections": {
    "problem": {
      "title": "The Problem",
      "content": "2-3 sentences. Specific pain, who feels it, why now. Skip if no data — do NOT write 'insufficient data'.",
      "verdict": "strong | adequate | weak",
      "signal": "One-line assessment: what the data tells us or what's missing"
    },
    "solution": {
      "title": "The Solution",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "market": {
      "title": "Market Opportunity",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "businessModel": {
      "title": "Business Model",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "traction": {
      "title": "Traction & Metrics",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "competition": {
      "title": "Competitive Landscape",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "team": {
      "title": "Team",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "moat": {
      "title": "Defensibility",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "ask": {
      "title": "The Ask",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "whyNow": {
      "title": "Why Now",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    },
    "risks": {
      "title": "Key Risks",
      "content": "...",
      "verdict": "strong | adequate | weak",
      "signal": "..."
    }
  },

  "reasoning": {
    "accepted": ["Array of 2-4 things the board accepted as credible, with brief WHY — e.g. 'Market timing validated: remote work shift creates 3x TAM expansion (board consensus)'"],
    "rejected": ["Array of 1-3 claims the board found weak or unsupported — e.g. '50% margins claim unsupported: no unit economics provided, comparable SaaS companies in this vertical average 35%'"],
    "openQuestions": ["Array of 1-3 critical questions that remain unanswered — e.g. 'Customer acquisition cost unclear: how does the company plan to acquire enterprise customers without a sales team?'"]
  },

  "keyGaps": ["Consolidated list of 2-5 most important missing data points that would change the analysis — NOT per-section 'insufficient data'. Example: 'No financial data (revenue, burn rate, runway)', 'Team background not provided', 'No evidence of product-market fit (users, retention, NPS)'"],

  "verdict": {
    "decision": "INVEST | PASS | CONDITIONAL",
    "reasoning": "2-3 sentences. The core logic: why this decision follows from the evidence. Reference specific accepted/rejected points.",
    "conditions": ["If CONDITIONAL: what must be true. If INVEST/PASS: what could change the decision. 1-3 items."],
    "conviction": "high | medium | low"
  }
}

RULES:
1. Use ONLY information from the inputs. Never fabricate metrics.
2. If a section has NO relevant data at all, set content to null (not "insufficient data"). The section will be hidden.
3. For sections with PARTIAL data, write what you can and note the gap in the signal field.
4. The investmentThesis is a SHORT thesis statement (2-3 sentences max).
5. The vcNarrative is THE MOST IMPORTANT OUTPUT. It must be an array of exactly 4 paragraph strings. Each paragraph should be 3-5 sentences of flowing, opinionated prose. Write like a GP presenting to an investment committee — use "we", be direct, reference specific data from the advisors. This is NOT a summary. It is an ARGUMENT. It should feel like reading a Sequoia or a16z deal memo.
6. The reasoning.accepted/rejected/openQuestions must reference SPECIFIC evidence from the advisor analyses, not generic statements.
7. keyGaps is a MERGED list of the most impactful missing information — max 5 items.
8. The verdict must logically follow from the reasoning and the narrative. A "PASS" with no rejected points makes no sense. An "INVEST" with critical gaps should be "CONDITIONAL".`;

async function generateOnePager(parsedSchema, decision, scoringSummary, advisorResponses, query, model) {
  const schemaSection = parsedSchema?.parsed
    ? Object.entries(parsedSchema.parsed)
        .map(([key, field]) => `**${key}** [${field.source}]: ${field.content}`)
        .join("\n")
    : "No structured schema available";

  const decisionSection = decision
    ? `Verdict: ${decision.verdict || "N/A"}
Key reasoning: ${(decision.keyReasoning || []).join(" | ") || "N/A"}
Confidence: ${decision.confidence || "N/A"}
Consensus: ${(decision.consensus || []).join("; ")}
Conflicts Resolved: ${(decision.conflictsResolved || []).map((c) => `${c.topic}: ${c.chairRuling}`).join("; ")}
Key Risks: ${(decision.risks || []).map((r) => `${r.risk} (${r.severity}): ${r.mitigation}`).join("; ")}
Action Items: ${(decision.actionItems || []).map((a) => `${a.action} [${a.priority}]`).join("; ")}
Dissent: ${decision.dissent || "None"}
Advisor highlights: ${(decision.advisorHighlights || []).map((h) => `${h.name}: ${h.highlight}`).join("; ") || "None"}
Narrative: ${decision.narrative || "N/A"}`
    : "No structured decision available";

  const scoringSection = scoringSummary
    ? `Overall Score: ${scoringSummary.overallScore}/10 (${scoringSummary.overallClassification})
Sections to refine: ${scoringSummary.sectionsToRefine?.join(", ") || "none"}
Sections accepted: ${scoringSummary.sectionsAccepted?.join(", ") || "none"}
Sections to review: ${scoringSummary.sectionsToReview?.join(", ") || "none"}`
    : "No scoring data available";

  const advisorSection = Object.entries(advisorResponses || {})
    .map(([id, response]) => `### Advisor ${id}\n${response}`)
    .join("\n\n");

  const userMessage = `Generate the one-pager from this validated board analysis. Think like an investor reviewing a deal memo.

## Original Query
${query}

## Structured Input Data
Company: ${parsedSchema?.companyName || "Unknown"}
Industry: ${parsedSchema?.industry || "Unknown"}
Stage: ${parsedSchema?.stage || "Unknown"}
Summary: ${parsedSchema?.summary || "N/A"}

${schemaSection}

## Board Decision
${decisionSection}

## Quality Scores
${scoringSection}

## Advisor Analyses
${advisorSection}

Generate the one-pager now. Show your reasoning. Be opinionated, not diplomatic.`;

  const result = await callLLM({
    systemPrompt: ONE_PAGER_SYSTEM_PROMPT,
    userMessage,
    model,
    maxTokens: 3500,
  });

  let onePager = null;
  try {
    onePager = JSON.parse(result.trim());
  } catch {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        onePager = JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }

  return onePager;
}

module.exports = { generateOnePager };
