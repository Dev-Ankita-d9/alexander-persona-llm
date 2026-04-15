const { callLLM } = require("./llm-providers");
const {
  getThresholds,
  getRefinementConfig,
  classifyScore,
} = require("./scoring-config");
const {
  scoreAllAdvisors,
  computeAggregateScores,
  buildScoringSummary,
} = require("./scoring");

const TARGET_CLASSIFICATIONS = ["refine", "review"];
const MAX_SECTIONS_PER_PASS = 5;

const REFINEMENT_SYSTEM_PROMPT = `You are refining your earlier analysis based on quality scoring feedback. The board's scoring layer evaluated your response and found specific weaknesses.

CRITICAL RULES:
1. You must ACTUALLY IMPROVE the substance — add specifics, data, concrete examples, or sharper reasoning
2. Do NOT just rephrase the same points differently
3. Do NOT pad with filler or generic statements
4. If you cannot meaningfully improve a section (e.g., insufficient data), say so explicitly rather than fabricating
5. Focus your improvement on the specific dimensions flagged: Specificity, Credibility, or Narrative Strength
6. Keep your refined response concise and focused`;

/**
 * Identify which sections need refinement from aggregated scores.
 * Returns array of { section, label, score, classification, weakDimensions }
 */
function identifySectionsToRefine(aggregatedScores) {
  const thresholds = getThresholds();
  const targets = [];

  for (const [section, data] of Object.entries(aggregatedScores)) {
    if (!TARGET_CLASSIFICATIONS.includes(data.classification)) {
      continue;
    }
    if (data.advisorScores.length === 0) continue;

    const weakDimensions = [];
    for (const [dimId, dimData] of Object.entries(data.dimensions || {})) {
      if (dimData.weightedScore <= thresholds.review) {
        weakDimensions.push({
          dimension: dimId,
          score: dimData.weightedScore,
          rationales: dimData.rationales || [],
        });
      }
    }

    targets.push({
      section,
      label: data.label,
      score: data.weightedAverage,
      classification: data.classification,
      weakDimensions,
    });
  }

  targets.sort((a, b) => a.score - b.score);
  return targets.slice(0, MAX_SECTIONS_PER_PASS);
}

/**
 * Build the refinement prompt for a specific advisor, targeting weak sections.
 */
function buildRefinementPrompt(advisor, originalResponse, weakSections, query) {
  const sectionFeedback = weakSections
    .map((s) => {
      const dimDetails = s.weakDimensions
        .map((d) => {
          const rationale = d.rationales
            .find((r) => r.advisor === advisor.name)?.rationale || "No specific feedback";
          return `  - ${d.dimension}: ${d.score}/10 — ${rationale}`;
        })
        .join("\n");

      return `**${s.label}** (overall: ${s.score}/10, status: ${s.classification})\n${dimDetails || "  General improvement needed across all dimensions"}`;
    })
    .join("\n\n");

  return `You previously analyzed this question: "${query}"

Your original response was:
${originalResponse}

The board's scoring layer identified the following sections as needing improvement:

${sectionFeedback}

Provide an IMPROVED version of your full analysis. You must:
1. Substantially strengthen the weak sections listed above — add specifics, data, examples, or sharper logic
2. Keep strong sections as-is (don't degrade what already works)
3. If a section scored low on Specificity, add concrete numbers, benchmarks, or examples
4. If a section scored low on Credibility, strengthen evidence and acknowledge uncertainty
5. If a section scored low on Narrative, improve structure and make conclusions actionable

Respond with your complete improved analysis. Focus your effort on the flagged sections.`;
}

/**
 * Run a single refinement pass: refine weak sections, re-score, measure delta.
 * Returns { refinedResponses, newScoring, avgImprovement, sectionsRefined }
 */
async function runRefinementPass(
  activeAdvisors,
  currentResponses,
  aggregatedScores,
  parsedSchema,
  query,
  modelMap,
  chairModel,
  defaultModel
) {
  const weakSections = identifySectionsToRefine(aggregatedScores);

  if (weakSections.length === 0) {
    return { refinedResponses: currentResponses, improved: false, reason: "no_weak_sections" };
  }

  // Ask each advisor to improve their response based on scoring feedback
  const refinementTasks = activeAdvisors
    .filter((a) => currentResponses[a.id])
    .map(async (advisor) => {
      const model = modelMap[advisor.id] || advisor.model || defaultModel;
      try {
        const refined = await callLLM({
          systemPrompt: `${advisor.systemPrompt}\n\n${REFINEMENT_SYSTEM_PROMPT}`,
          userMessage: buildRefinementPrompt(
            advisor,
            currentResponses[advisor.id],
            weakSections,
            query
          ),
          model,
          maxTokens: 1200,
        });
        return { advisorId: advisor.id, refined };
      } catch (err) {
        console.error(`Refinement failed for ${advisor.name}:`, err.message);
        return { advisorId: advisor.id, refined: null };
      }
    });

  const results = await Promise.allSettled(refinementTasks);

  // Build refined responses (replace only where refinement succeeded)
  const refinedResponses = { ...currentResponses };
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.refined) {
      refinedResponses[result.value.advisorId] = result.value.refined;
    }
  }

  // Re-score the refined responses
  const newRawScores = await scoreAllAdvisors(
    activeAdvisors,
    refinedResponses,
    parsedSchema,
    chairModel
  );

  if (Object.keys(newRawScores).length === 0) {
    return { refinedResponses, improved: false, reason: "scoring_failed" };
  }

  const newAggregated = computeAggregateScores(newRawScores, parsedSchema);
  const newSummary = buildScoringSummary(newRawScores, newAggregated);

  // Measure improvement delta for the targeted sections
  let totalDelta = 0;
  let deltaCount = 0;

  for (const target of weakSections) {
    const oldScore = target.score;
    const newScore = newAggregated[target.section]?.weightedAverage ?? oldScore;
    totalDelta += (newScore - oldScore);
    deltaCount++;
  }

  const avgImprovement = deltaCount > 0 ? totalDelta / deltaCount : 0;

  return {
    refinedResponses,
    newRawScores,
    newAggregated,
    newSummary,
    avgImprovement: Math.round(avgImprovement * 100) / 100,
    sectionsRefined: weakSections.map((s) => ({
      section: s.section,
      label: s.label,
      oldScore: s.score,
      newScore: newAggregated[s.section]?.weightedAverage ?? s.score,
      newClassification: newAggregated[s.section]?.classification ?? s.classification,
    })),
    improved: true,
  };
}

/**
 * Run the full bounded refinement loop.
 * Returns { finalResponses, finalScoring, passes, history, stoppedReason }
 */
async function runRefinementLoop(
  activeAdvisors,
  initialResponses,
  initialAggregated,
  initialSummary,
  parsedSchema,
  query,
  modelMap,
  chairModel,
  defaultModel,
  sendEvent
) {
  let currentResponses = { ...initialResponses };
  let currentAggregated = initialAggregated;
  let currentSummary = initialSummary;
  const passHistory = [];

  // Check if any sections need refinement at all
  const initialTargets = identifySectionsToRefine(currentAggregated);
  if (initialTargets.length === 0) {
    return {
      finalResponses: currentResponses,
      finalScoring: currentSummary,
      finalAggregated: currentAggregated,
      passes: 0,
      history: [],
      stoppedReason: "all_sections_acceptable",
    };
  }

  const refinementCfg = getRefinementConfig();

  for (let pass = 1; pass <= refinementCfg.maxPasses; pass++) {
    if (sendEvent) {
      sendEvent("refinement_pass_start", {
        pass,
        maxPasses: refinementCfg.maxPasses,
        targetSections: identifySectionsToRefine(currentAggregated).map((s) => ({
          label: s.label,
          score: s.score,
          classification: s.classification,
        })),
      });
    }

    const passResult = await runRefinementPass(
      activeAdvisors,
      currentResponses,
      currentAggregated,
      parsedSchema,
      query,
      modelMap,
      chairModel,
      defaultModel
    );

    if (!passResult.improved) {
      passHistory.push({
        pass,
        avgImprovement: 0,
        sectionsRefined: [],
        stoppedEarly: true,
        reason: passResult.reason,
      });

      if (sendEvent) {
        sendEvent("refinement_pass_complete", {
          pass,
          avgImprovement: 0,
          stoppedEarly: true,
          reason: passResult.reason,
        });
      }
      break;
    }

    currentResponses = passResult.refinedResponses;
    currentAggregated = passResult.newAggregated;
    currentSummary = passResult.newSummary;

    const passEntry = {
      pass,
      avgImprovement: passResult.avgImprovement,
      sectionsRefined: passResult.sectionsRefined,
      stoppedEarly: false,
    };
    passHistory.push(passEntry);

    if (sendEvent) {
      sendEvent("refinement_pass_complete", {
        pass,
        avgImprovement: passResult.avgImprovement,
        sectionsRefined: passResult.sectionsRefined,
        newOverallScore: passResult.newSummary.overallScore,
      });
    }

    // Check stopping conditions
    if (passResult.avgImprovement < refinementCfg.minImprovementDelta) {
      passHistory[passHistory.length - 1].stoppedEarly = true;
      passHistory[passHistory.length - 1].reason = "plateau";
      if (sendEvent) {
        sendEvent("refinement_stopped", {
          reason: "plateau",
          message: `Improvement delta (${passResult.avgImprovement}) below threshold (${refinementCfg.minImprovementDelta}) — stopping refinement`,
        });
      }
      break;
    }

    // Check if all sections now acceptable
    const remainingTargets = identifySectionsToRefine(currentAggregated);
    if (remainingTargets.length === 0) {
      if (sendEvent) {
        sendEvent("refinement_stopped", {
          reason: "all_acceptable",
          message: "All sections now meet quality thresholds",
        });
      }
      break;
    }

    if (pass === refinementCfg.maxPasses) {
      if (sendEvent) {
        const unresolved = remainingTargets.map((s) => s.label);
        sendEvent("refinement_stopped", {
          reason: "max_passes",
          message: `Maximum ${refinementCfg.maxPasses} passes reached`,
          unresolvedSections: unresolved,
        });
      }
    }
  }

  return {
    finalResponses: currentResponses,
    finalScoring: currentSummary,
    finalAggregated: currentAggregated,
    passes: passHistory.length,
    history: passHistory,
    stoppedReason: passHistory.length > 0
      ? passHistory[passHistory.length - 1].reason || "completed"
      : "no_refinement_needed",
  };
}

module.exports = {
  identifySectionsToRefine,
  runRefinementPass,
  runRefinementLoop,
};
