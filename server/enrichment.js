const { callLLM } = require("./llm-providers");

const ENRICHMENT_SYSTEM_PROMPT = `You are a startup context analyst. Your job is to add lightweight, factual context to a parsed company schema — filling gaps with industry benchmarks, comparable companies, and standard frameworks that any informed investor would expect.

You are NOT inventing data. You are adding publicly known context that helps advisors evaluate the opportunity more thoroughly.

Given a parsed schema (with fields marked as extracted/inferred/missing), enrich it by:

1. **Industry benchmarks**: Add typical metrics for the company's stage and industry (e.g., "Seed-stage SaaS companies typically have $10K-$100K MRR")
2. **Comparable companies**: Mention 2-3 relevant comparables or analogues in the space
3. **Market context**: Add known market sizing data, growth rates, or regulatory context for the industry
4. **Standard frameworks**: Apply relevant frameworks (TAM/SAM/SOM estimates, unit economics benchmarks, typical burn rates for stage)
5. **Gap flagging**: For missing fields, note what a typical company at this stage would be expected to have

Respond with ONLY valid JSON matching this schema:

{
  "enrichments": {
    "problem": { "context": "Additional context or null if no enrichment needed", "comparables": "Relevant comparable companies or null", "benchmark": "Industry benchmark or null" },
    "solution": { "context": "...", "comparables": "...", "benchmark": "..." },
    "market": { "context": "...", "comparables": "...", "benchmark": "..." },
    "traction": { "context": "...", "comparables": "...", "benchmark": "..." },
    "businessModel": { "context": "...", "comparables": "...", "benchmark": "..." },
    "competition": { "context": "...", "comparables": "...", "benchmark": "..." },
    "team": { "context": "...", "comparables": "...", "benchmark": "..." },
    "ask": { "context": "...", "comparables": "...", "benchmark": "..." },
    "moat": { "context": "...", "comparables": "...", "benchmark": "..." }
  },
  "industryOverview": "2-3 sentence overview of the industry landscape, key trends, and tailwinds/headwinds",
  "stageContext": "What investors typically expect from companies at this stage (metrics, milestones, team size)",
  "comparableCompanies": [
    { "name": "Company name", "relevance": "Why this company is relevant as a comparable", "outcome": "IPO / acquired / funded / etc." }
  ],
  "enrichmentCount": 0
}

CRITICAL RULES:
1. Only add context that is publicly known and factually grounded. Do NOT fabricate specific numbers for the company.
2. Benchmarks should be industry-standard ranges, not precise predictions ("typically $X-$Y" not "will be $X").
3. Set fields to null if no meaningful enrichment can be added — don't pad with generic statements.
4. enrichmentCount should reflect how many fields actually received useful enrichment (non-null context or benchmark).
5. Comparables should be real, well-known companies — not invented examples.
6. Keep each enrichment concise: 1-2 sentences max per field.`;

async function enrichSchema(parsedSchema, model) {
  if (!parsedSchema?.parsed) return null;

  const schemaDescription = Object.entries(parsedSchema.parsed)
    .map(([key, field]) => `- **${key}** [${field.source}]: ${field.content}`)
    .join("\n");

  const userMessage = `Enrich the following parsed company schema with lightweight context.

## Company Info
Name: ${parsedSchema.companyName || "Unknown"}
Industry: ${parsedSchema.industry || "Unknown"}
Stage: ${parsedSchema.stage || "unknown"}
Summary: ${parsedSchema.summary || "N/A"}
Input Quality: ${parsedSchema.inputQuality || "unknown"}

## Parsed Fields
${schemaDescription}

## Missing Critical Fields
${parsedSchema.missingCritical?.length ? parsedSchema.missingCritical.join(", ") : "None flagged"}

Add industry benchmarks, comparable companies, market context, and standard frameworks. Only add genuinely useful context — skip fields where enrichment wouldn't add value.`;

  const result = await callLLM({
    systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
    userMessage,
    model,
    maxTokens: 1500,
  });

  let enrichment = null;
  try {
    enrichment = JSON.parse(result.trim());
  } catch {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        enrichment = JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }

  return enrichment;
}

function formatEnrichmentForAdvisors(enrichment) {
  if (!enrichment) return "";

  const lines = [];

  if (enrichment.industryOverview) {
    lines.push(`### Industry Overview [enriched]`);
    lines.push(enrichment.industryOverview);
    lines.push("");
  }

  if (enrichment.stageContext) {
    lines.push(`### Stage Context [enriched]`);
    lines.push(enrichment.stageContext);
    lines.push("");
  }

  if (enrichment.comparableCompanies?.length > 0) {
    lines.push(`### Comparable Companies [enriched]`);
    for (const comp of enrichment.comparableCompanies) {
      lines.push(`- **${comp.name}**: ${comp.relevance}${comp.outcome ? ` (${comp.outcome})` : ""}`);
    }
    lines.push("");
  }

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

  const fieldEnrichments = enrichment.enrichments || {};
  for (const [key, label] of Object.entries(fieldLabels)) {
    const e = fieldEnrichments[key];
    if (!e) continue;

    const parts = [];
    if (e.context) parts.push(e.context);
    if (e.benchmark) parts.push(`Benchmark: ${e.benchmark}`);
    if (e.comparables) parts.push(`Comparables: ${e.comparables}`);

    if (parts.length > 0) {
      lines.push(`### ${label} — Enrichment [enriched]`);
      lines.push(parts.join(" | "));
      lines.push("");
    }
  }

  return lines.join("\n");
}

module.exports = { enrichSchema, formatEnrichmentForAdvisors };
