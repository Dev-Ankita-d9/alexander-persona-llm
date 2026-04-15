const { callLLM } = require("./llm-providers");
const {
  getDimensions,
  getSections,
  getSectionLabels,
  getDimensionWeight,
  getRoleWeight,
  getEvidenceMultiplier,
  classifyScore,
} = require("./scoring-config");

const SCORING_SYSTEM_PROMPT = `You are a rigorous scoring analyst for a startup advisory board. Your job is to evaluate an advisor's analysis on specific dimensions with precise, calibrated scores.

Score each section of the advisor's response on these dimensions (1-10 scale):

1. **Specificity** (1-10): Does the advisor cite concrete numbers, examples, benchmarks, or specifics? Or are they vague/generic?
   - 1-3: Entirely generic ("the market is big", "growth is important")
   - 4-6: Some specifics but gaps remain
   - 7-10: Highly specific with concrete data points, examples, or frameworks applied

2. **Credibility** (1-10): Are the claims realistic, well-supported, and evidence-based? Or speculative/unfounded?
   - 1-3: Speculative claims, unsupported assertions, or contradictions
   - 4-6: Plausible but lacks supporting evidence
   - 7-10: Well-supported, references data or sound reasoning, acknowledges uncertainty

3. **Narrative Strength** (1-10): Is the argument compelling, logically structured, and actionable?
   - 1-3: Disjointed, unclear, or repetitive
   - 4-6: Adequate structure but not compelling
   - 7-10: Clear thesis, logical flow, actionable conclusions

For each section, also note the evidence basis:
- "user-provided": The advisor is working with data the user explicitly provided
- "inferred": The advisor is working with information inferred from context
- "research-enriched": The advisor references external research data
- "advisor-generated": The advisor's own analysis/opinion without external backing

Respond with ONLY valid JSON matching this schema:
{
  "sections": {
    "problem": {
      "specificity": { "score": 7, "rationale": "Brief reason" },
      "credibility": { "score": 6, "rationale": "Brief reason" },
      "narrative": { "score": 8, "rationale": "Brief reason" },
      "evidenceBasis": "user-provided | inferred | research-enriched | advisor-generated",
      "covered": true
    }
  },
  "overallAssessment": "1-2 sentence summary of this advisor's analysis quality",
  "strongestSection": "section_key",
  "weakestSection": "section_key"
}

Include entries ONLY for sections the advisor actually addressed. Set "covered": false for sections mentioned but not substantively analyzed. If a section is not mentioned at all, omit it.

Be strict — do not inflate scores. A score of 7+ should mean genuinely strong analysis.`;

async function scoreAdvisorResponse(advisor, response, parsedSchema, model) {
  const sectionLabels = getSectionLabels();
  const schemaContext = parsedSchema?.parsed
    ? Object.entries(parsedSchema.parsed)
        .map(([key, field]) => {
          const label = sectionLabels[key] || key;
          return `- ${label}: ${field.source} (${field.source === "missing" ? "no data provided" : "data available"})`;
        })
        .join("\n")
    : "No structured schema available";

  const userMessage = `## Advisor Being Scored
Name: ${advisor.name}
Role: ${advisor.role}

## Input Data Availability
${schemaContext}

## Advisor's Response
${response}

Score this advisor's response across all sections they addressed. Be calibrated and precise.`;

  const result = await callLLM({
    systemPrompt: SCORING_SYSTEM_PROMPT,
    userMessage,
    model,
    maxTokens: 1200,
  });

  let scores = null;
  try {
    scores = JSON.parse(result.trim());
  } catch {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        scores = JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }

  return scores;
}

/**
 * Score all advisor responses in parallel
 */
async function scoreAllAdvisors(advisorList, advisorResponses, parsedSchema, model) {
  const scoringResults = {};

  const tasks = advisorList
    .filter((a) => advisorResponses[a.id])
    .map(async (advisor) => {
      try {
        const scores = await scoreAdvisorResponse(
          advisor,
          advisorResponses[advisor.id],
          parsedSchema,
          model
        );
        if (scores) {
          scoringResults[advisor.id] = {
            advisorName: advisor.name,
            advisorRole: advisor.role,
            ...scores,
          };
        }
      } catch (err) {
        console.error(`Scoring failed for ${advisor.name}:`, err.message);
      }
    });

  await Promise.allSettled(tasks);
  return scoringResults;
}

/**
 * Compute weighted aggregate scores per section across all advisors.
 * Applies role weights and evidence multipliers.
 */
function computeAggregateScores(scoringResults, parsedSchema) {
  const aggregated = {};
  const sections = getSections();
  const sectionLabels = getSectionLabels();
  const dimensions = getDimensions();

  for (const section of sections) {
    const sectionData = {
      section,
      label: sectionLabels[section] || section,
      advisorScores: [],
      dimensions: {},
      weightedAverage: 0,
      classification: "review",
      evidenceSource: parsedSchema?.parsed?.[section]?.source || "missing",
    };

    let totalWeight = 0;
    let weightedSum = 0;

    const dimensionAggregates = {};
    for (const dim of dimensions) {
      dimensionAggregates[dim.id] = { weightedSum: 0, totalWeight: 0, rationales: [] };
    }

    for (const [advisorId, result] of Object.entries(scoringResults)) {
      const sectionScores = result.sections?.[section];
      if (!sectionScores?.covered) continue;

      const role = result.advisorRole;
      const roleWeight = getRoleWeight(section, role);
      const evidenceMultiplier = getEvidenceMultiplier(sectionData.evidenceSource);

      const advisorEntry = {
        advisorId,
        advisorName: result.advisorName,
        role,
        roleWeight,
        scores: {},
        sectionAverage: 0,
      };

      let dimSum = 0;
      let dimCount = 0;

      for (const dim of dimensions) {
        const dimScore = sectionScores[dim.id];
        if (!dimScore) continue;

        const dimWeight = getDimensionWeight(dim.id);
        const rawScore = Math.min(10, Math.max(1, dimScore.score || 0));
        const adjustedScore = Math.round(rawScore * evidenceMultiplier * dimWeight * 10) / 10;

        advisorEntry.scores[dim.id] = {
          raw: rawScore,
          adjusted: adjustedScore,
          rationale: dimScore.rationale || "",
        };

        dimensionAggregates[dim.id].weightedSum += adjustedScore * roleWeight;
        dimensionAggregates[dim.id].totalWeight += roleWeight;
        dimensionAggregates[dim.id].rationales.push({
          advisor: result.advisorName,
          rationale: dimScore.rationale,
        });

        dimSum += adjustedScore;
        dimCount++;
      }

      advisorEntry.sectionAverage = dimCount > 0
        ? Math.round((dimSum / dimCount) * 10) / 10
        : 0;

      const weightedContribution = advisorEntry.sectionAverage * roleWeight;
      weightedSum += weightedContribution;
      totalWeight += roleWeight;

      sectionData.advisorScores.push(advisorEntry);
    }

    for (const dim of dimensions) {
      const agg = dimensionAggregates[dim.id];
      sectionData.dimensions[dim.id] = {
        weightedScore: agg.totalWeight > 0
          ? Math.round((agg.weightedSum / agg.totalWeight) * 10) / 10
          : 0,
        rationales: agg.rationales,
      };
    }

    sectionData.weightedAverage = totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 10) / 10
      : 0;

    sectionData.classification = classifyScore(sectionData.weightedAverage);

    aggregated[section] = sectionData;
  }

  return aggregated;
}

/**
 * Build a summary of the scoring results for the debate prompt —
 * highlights weak sections that need focused debate.
 */
function formatScoringForDebate(aggregatedScores) {
  const weak = [];
  const strong = [];

  for (const [section, data] of Object.entries(aggregatedScores)) {
    if (data.classification === "refine") {
      weak.push(`- **${data.label}** (score: ${data.weightedAverage}/10) — needs significant strengthening`);
    } else if (data.classification === "review") {
      weak.push(`- **${data.label}** (score: ${data.weightedAverage}/10) — needs attention`);
    } else {
      strong.push(`- **${data.label}** (score: ${data.weightedAverage}/10) — strong`);
    }
  }

  let summary = "";
  if (weak.length > 0) {
    summary += `### Sections Needing Improvement\n${weak.join("\n")}\n\n`;
  }
  if (strong.length > 0) {
    summary += `### Strong Sections\n${strong.join("\n")}`;
  }

  return summary;
}

/**
 * Produce a compact scoring summary for the client
 */
function buildScoringSummary(scoringResults, aggregatedScores) {
  const dimensions = getDimensions();
  const sectionLabels = getSectionLabels();
  const sectionSummaries = {};
  let totalScore = 0;
  let sectionCount = 0;

  for (const [section, data] of Object.entries(aggregatedScores)) {
    sectionSummaries[section] = {
      label: data.label,
      weightedAverage: data.weightedAverage,
      classification: data.classification,
      evidenceSource: data.evidenceSource,
      dimensions: {},
      advisorBreakdown: data.advisorScores.map((a) => ({
        advisorId: a.advisorId,
        advisorName: a.advisorName,
        role: a.role,
        roleWeight: a.roleWeight,
        sectionAverage: a.sectionAverage,
        scores: a.scores,
      })),
    };

    for (const dim of dimensions) {
      sectionSummaries[section].dimensions[dim.id] = {
        score: data.dimensions[dim.id]?.weightedScore || 0,
        label: dim.label,
      };
    }

    if (data.advisorScores.length > 0) {
      totalScore += data.weightedAverage;
      sectionCount++;
    }
  }

  const overallScore = sectionCount > 0
    ? Math.round((totalScore / sectionCount) * 10) / 10
    : 0;

  const sectionsToRefine = Object.entries(aggregatedScores)
    .filter(([, d]) => d.classification === "refine")
    .map(([s]) => sectionLabels[s] || s);

  const sectionsToReview = Object.entries(aggregatedScores)
    .filter(([, d]) => d.classification === "review")
    .map(([s]) => sectionLabels[s] || s);

  const sectionsAccepted = Object.entries(aggregatedScores)
    .filter(([, d]) => d.classification === "accept")
    .map(([s]) => sectionLabels[s] || s);

  return {
    overallScore,
    overallClassification: classifyScore(overallScore),
    sections: sectionSummaries,
    sectionsToRefine,
    sectionsToReview,
    sectionsAccepted,
    advisorAssessments: Object.fromEntries(
      Object.entries(scoringResults).map(([id, r]) => [
        id,
        {
          advisorName: r.advisorName,
          overallAssessment: r.overallAssessment,
          strongestSection: r.strongestSection,
          weakestSection: r.weakestSection,
        },
      ])
    ),
  };
}

module.exports = {
  scoreAdvisorResponse,
  scoreAllAdvisors,
  computeAggregateScores,
  formatScoringForDebate,
  buildScoringSummary,
};
