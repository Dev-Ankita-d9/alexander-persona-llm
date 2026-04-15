const { callLLM } = require("./llm-providers");

const SCHEMA_FIELDS = [
  "problem",
  "solution",
  "market",
  "traction",
  "businessModel",
  "competition",
  "team",
  "ask",
  "moat",
];

const PARSE_SYSTEM_PROMPT = `You are an expert startup analyst. Your job is to extract structured company data from raw, messy notes.

Given the user's input (which may be unstructured notes, a pitch, a brain dump, or uploaded document text), extract as much information as possible into the following JSON schema. For each field, also indicate the source quality.

Respond with ONLY valid JSON matching this exact schema (no markdown, no text outside the JSON):

{
  "parsed": {
    "problem": { "content": "What problem does the company solve? Who feels this pain?", "source": "extracted | inferred | missing" },
    "solution": { "content": "What is the product/service? How does it solve the problem?", "source": "extracted | inferred | missing" },
    "market": { "content": "Target market, TAM/SAM/SOM, market size, growth trends", "source": "extracted | inferred | missing" },
    "traction": { "content": "Current metrics: revenue, users, growth rate, partnerships, milestones", "source": "extracted | inferred | missing" },
    "businessModel": { "content": "How does the company make money? Pricing, unit economics", "source": "extracted | inferred | missing" },
    "competition": { "content": "Key competitors, differentiation, competitive landscape", "source": "extracted | inferred | missing" },
    "team": { "content": "Founders, key team members, relevant experience", "source": "extracted | inferred | missing" },
    "ask": { "content": "Funding ask, use of funds, runway, valuation expectations", "source": "extracted | inferred | missing" },
    "moat": { "content": "Defensibility: network effects, IP, switching costs, brand, data advantages", "source": "extracted | inferred | missing" }
  },
  "companyName": "Name of the company if mentioned, or null",
  "stage": "pre-seed | seed | series-a | series-b | growth | unknown",
  "industry": "Primary industry/vertical",
  "summary": "A 1-2 sentence summary of what this company does",
  "inputQuality": "high | medium | low",
  "inputQualityRationale": "Brief explanation of the input quality assessment",
  "missingCritical": ["Array of critical fields that are missing and would significantly improve the analysis"]
}

Rules:
- "extracted" = directly stated in the input
- "inferred" = you reasonably deduced it from context (mark clearly)
- "missing" = not enough information to determine; set content to a brief note about what's needed
- For "missing" fields, the content should say what information would be helpful, e.g. "No revenue data provided. Key metrics like MRR, user count, or growth rate would strengthen the analysis."
- Be precise — do not fabricate specific numbers or claims. If the input says "growing fast", note that but don't invent a growth rate.
- inputQuality: "high" = covers most fields with specifics, "medium" = covers some fields but has gaps, "low" = very sparse or vague
- missingCritical: only include fields whose absence would materially weaken an investor evaluation`;

async function parseInput(query, fileContext, model) {
  let userMessage = "";

  if (fileContext) {
    userMessage += `<uploaded_document>\n${fileContext}\n</uploaded_document>\n\n`;
  }

  userMessage += `<raw_input>\n${query}\n</raw_input>\n\nExtract the structured company data from the above input. Respond with only valid JSON.`;

  const result = await callLLM({
    systemPrompt: PARSE_SYSTEM_PROMPT,
    userMessage,
    model,
    maxTokens: 1500,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(result.trim());
  } catch {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }

  return parsed;
}

function formatSchemaForAdvisors(schema) {
  if (!schema?.parsed) return "";

  const lines = [];

  if (schema.companyName) {
    lines.push(`Company: ${schema.companyName}`);
  }
  if (schema.industry) {
    lines.push(`Industry: ${schema.industry}`);
  }
  if (schema.stage && schema.stage !== "unknown") {
    lines.push(`Stage: ${schema.stage}`);
  }
  if (schema.summary) {
    lines.push(`Summary: ${schema.summary}`);
  }

  lines.push("");

  const fieldLabels = {
    problem: "Problem",
    solution: "Solution",
    market: "Market",
    traction: "Traction",
    businessModel: "Business Model",
    competition: "Competition",
    team: "Team",
    ask: "Funding Ask",
    moat: "Moat / Defensibility",
  };

  for (const [key, label] of Object.entries(fieldLabels)) {
    const field = schema.parsed[key];
    if (!field) continue;
    const tag =
      field.source === "extracted"
        ? "[from input]"
        : field.source === "inferred"
          ? "[inferred]"
          : "[not provided]";
    lines.push(`### ${label} ${tag}`);
    lines.push(field.content);
    lines.push("");
  }

  if (schema.missingCritical?.length > 0) {
    lines.push("### Critical Gaps");
    lines.push(
      `The following areas lack sufficient data: ${schema.missingCritical.join(", ")}`
    );
  }

  return lines.join("\n");
}

module.exports = { parseInput, formatSchemaForAdvisors, SCHEMA_FIELDS };
