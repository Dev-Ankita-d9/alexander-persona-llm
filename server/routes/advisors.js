const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const advisors = require("../advisors");
const { PROVIDERS, callLLM } = require("../llm-providers");
const { searchWeb, isConfigured: isResearchConfigured } = require("../research");
const { parseInput, formatSchemaForAdvisors } = require("../input-parser");
const { enrichSchema, formatEnrichmentForAdvisors } = require("../enrichment");
const {
  scoreAllAdvisors,
  computeAggregateScores,
  formatScoringForDebate,
  buildScoringSummary,
} = require("../scoring");
const { runRefinementLoop } = require("../refinement");
const { generateOnePager } = require("../one-pager");
const { createSession } = require("../logger");

const upload = multer({
  dest: path.join(__dirname, "..", "uploads"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".txt", ".csv", ".md", ".json", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1000;

function buildUserMessage(query, fileContext, researchContext, structuredContext, enrichmentContext) {
  let message = "";

  if (structuredContext) {
    message += `<structured_analysis>\nThe following structured breakdown was extracted from the user's raw input. Use this as your primary reference for analysis. Fields marked [inferred] should be treated with lower confidence than [from input]. Fields marked [not provided] represent gaps you should flag.\n\n${structuredContext}\n</structured_analysis>\n\n`;
  }

  if (enrichmentContext) {
    message += `<enrichment_context>\nThe following industry context, benchmarks, and comparable companies were added to supplement the user's input. Data marked [enriched] is from general industry knowledge — treat it as background context with lower weight than user-provided data.\n\n${enrichmentContext}\n</enrichment_context>\n\n`;
  }

  if (researchContext) {
    message += `<research_context>\nThe following real-time information was gathered from the internet to inform your analysis. Reference specific data points where relevant.\n\n${researchContext}\n</research_context>\n\n`;
  }

  if (fileContext) {
    message += `<uploaded_file>\n${fileContext}\n</uploaded_file>\n\n`;
  }

  message += `<original_query>\n${query}\n</original_query>`;
  return message;
}

function truncateContext(text, maxChars = 16000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n...[truncated]";
}

async function extractFileContext(file) {
  if (!file) return null;
  const ext = path.extname(file.originalname).toLowerCase();
  const filePath = file.path;
  let parser = null;
  try {
    if (ext === ".pdf") {
      // pdf-parse v2+ exports PDFParse class; v1 used `require("pdf-parse")(buffer)` (removed)
      const { PDFParse } = require("pdf-parse");
      const buffer = fs.readFileSync(filePath);
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result?.text ?? "";
      return truncateContext(text);
    }
    const text = fs.readFileSync(filePath, "utf-8");
    return truncateContext(text);
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        /* ignore */
      }
    }
    fs.unlink(filePath, () => {});
  }
}

function parseJsonFromLLM(text) {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return null;
  }
}

// Middleware: apply multer only for multipart requests, pass through for JSON
function optionalFileUpload(req, res, next) {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (!res.headersSent) {
          return res.status(400).json({
            error: err.message || "File upload failed (check size ≤ 5MB and type: pdf, txt, csv, md, json)",
          });
        }
        return;
      }
      next();
    });
  } else {
    next();
  }
}

// Parse the request body uniformly — FormData fields arrive as strings
function parseDeliberateBody(req) {
  const body = req.body || {};

  if (typeof body.activeAdvisors === "string") {
    try { body.activeAdvisors = JSON.parse(body.activeAdvisors); } catch { body.activeAdvisors = []; }
  }
  if (typeof body.advisorModels === "string") {
    try { body.advisorModels = JSON.parse(body.advisorModels); } catch { body.advisorModels = {}; }
  }

  return {
    query: body.query,
    activeIds: body.activeAdvisors,
    fileContext: body.fileContext || null,
    advisorModels: body.advisorModels || {},
    synthesisModel: body.synthesisModel || null,
  };
}

// ===== Board Chair Deliberation (SSE) =====

router.post("/deliberate", optionalFileUpload, async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  let aborted = false;
  res.on("close", () => {
    aborted = true;
  });

  function send(event, data) {
    if (aborted) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const { query, activeIds, fileContext: bodyFileContext, advisorModels, synthesisModel } = parseDeliberateBody(req);
    const sessionStart = Date.now();
    const log = createSession(query, activeIds || [], req.file?.originalname);

    // Extract file context: uploaded file takes priority, then body text
    let fileContext = bodyFileContext;
    if (req.file) {
      try {
        fileContext = await extractFileContext(req.file);
        log.info(`File extracted: ${req.file.originalname} (${req.file.size} bytes)`);
        send("file_parsed", {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          extracted: !!fileContext,
        });
      } catch (err) {
        log.error("File Extraction", err.message);
        send("file_parsed", {
          fileName: req.file.originalname,
          error: err.message,
        });
      }
    }

    if (!query?.trim()) {
      send("error", { message: "Query is required" });
      return res.end();
    }

    const active = advisors.filter((a) => activeIds?.includes(a.id));
    if (active.length === 0) {
      send("error", { message: "At least one board member must be active" });
      return res.end();
    }

    const modelMap = advisorModels || {};
    const chairModel = synthesisModel || DEFAULT_MODEL;

    // Phase 0: Research — gather real-time internet context
    log.phase("Research", "Gathering real-time data from the web");
    let researchContext = "";
    let researchSources = [];

    if (isResearchConfigured()) {
      send("stage", {
        stage: "researching",
        message: "Gathering real-time data from the web...",
      });

      try {
        const research = await searchWeb(query);
        if (research) {
          researchContext = research.briefing;
          researchSources = research.sources;
          log.info(`Research complete: ${researchSources.length} sources found`);
          log.data("Research Sources", researchSources.map((s) => s.title));
          send("research_complete", {
            sourceCount: researchSources.length,
            sources: researchSources,
          });
        }
      } catch (err) {
        log.error("Research", err.message);
        send("research_complete", { sourceCount: 0, sources: [], error: err.message });
      }

      if (aborted) return res.end();
    } else {
      send("stage", {
        stage: "researching",
        message: "Research layer not configured — skipping web search",
      });
      send("research_complete", { sourceCount: 0, sources: [], skipped: true });
    }

    // Phase 0.5: Parse input into structured schema
    log.phase("Input Parsing", "Analyzing and structuring user input");
    let parsedSchema = null;
    let structuredContext = "";

    send("stage", {
      stage: "parsing",
      message: "Analyzing and structuring your input...",
    });

    try {
      parsedSchema = await parseInput(query, fileContext, chairModel);
      if (parsedSchema?.parsed) {
        structuredContext = formatSchemaForAdvisors(parsedSchema);
        const fieldCount = Object.values(parsedSchema.parsed).filter((f) => f.source !== "missing").length;
        const totalFields = Object.keys(parsedSchema.parsed).length;
        log.info(`Parsed ${fieldCount}/${totalFields} fields — Company: ${parsedSchema.companyName || "Unknown"}, Industry: ${parsedSchema.industry || "Unknown"}, Stage: ${parsedSchema.stage || "unknown"}`);
        log.data("Parsed Schema", parsedSchema);
        send("parsed_input", {
          schema: parsedSchema,
          fieldCount,
          totalFields,
        });
      } else {
        log.info("Parsing returned null — skipped");
        send("parsed_input", { schema: null, skipped: true });
      }
    } catch (err) {
      log.error("Input Parsing", err.message);
      send("parsed_input", { schema: null, error: err.message });
    }

    if (aborted) return res.end();

    // Phase 0.75: Light Enrichment — add industry context, benchmarks, comparables
    log.phase("Light Enrichment", "Adding industry benchmarks, comparables, and context");
    let enrichmentData = null;
    let enrichmentContext = "";

    send("stage", {
      stage: "enriching",
      message: "Adding industry benchmarks and context...",
    });

    try {
      enrichmentData = await enrichSchema(parsedSchema, chairModel);
      if (enrichmentData) {
        enrichmentContext = formatEnrichmentForAdvisors(enrichmentData);
        log.info(`Enriched ${enrichmentData.enrichmentCount || 0} fields, ${enrichmentData.comparableCompanies?.length || 0} comparable companies`);
        log.data("Enrichment Data", enrichmentData);
        send("enrichment_complete", {
          enrichment: enrichmentData,
          enrichmentCount: enrichmentData.enrichmentCount || 0,
          comparableCount: enrichmentData.comparableCompanies?.length || 0,
        });
      } else {
        log.info("Enrichment returned null — skipped");
        send("enrichment_complete", { enrichment: null, skipped: true });
      }
    } catch (err) {
      log.error("Enrichment", err.message);
      send("enrichment_complete", { enrichment: null, error: err.message });
    }

    if (aborted) return res.end();

    const userMessage = buildUserMessage(query, fileContext, researchContext, structuredContext, enrichmentContext);

    // Phase 1: Distribute to board members
    log.phase("Advisor Deliberation", `Distributing to ${active.length} board members: ${active.map((a) => a.name).join(", ")}`);
    send("stage", {
      stage: "distributing",
      message: `Distributing to ${active.length} board member${active.length !== 1 ? "s" : ""}...`,
    });

    // Phase 2: Board members deliberate in parallel
    send("stage", {
      stage: "deliberating",
      message: "Board members are deliberating...",
    });

    const results = await Promise.allSettled(
      active.map((advisor) => {
        const model = modelMap[advisor.id] || advisor.model || DEFAULT_MODEL;
        return callLLM({
          systemPrompt: advisor.systemPrompt,
          userMessage,
          model,
          maxTokens: MAX_TOKENS,
        });
      })
    );

    if (aborted) return res.end();

    const advisorResponses = {};
    const advisorModelUsed = {};
    const errors = {};

    results.forEach((result, i) => {
      const advisor = active[i];
      const model = modelMap[advisor.id] || advisor.model || DEFAULT_MODEL;
      if (result.status === "fulfilled") {
        advisorResponses[advisor.id] = result.value;
        advisorModelUsed[advisor.id] = model;
        send("advisor_complete", {
          advisorId: advisor.id,
          name: advisor.name,
        });
      } else {
        errors[advisor.id] = result.reason?.message || "Unknown error";
        send("advisor_error", {
          advisorId: advisor.id,
          name: advisor.name,
          error: errors[advisor.id],
        });
      }
    });

    const successCount = Object.keys(advisorResponses).length;
    log.info(`${successCount}/${active.length} advisors responded successfully`);
    for (const [id, response] of Object.entries(advisorResponses)) {
      const a = advisors.find((x) => x.id === id);
      log.data(`Advisor Response: ${a?.name || id} (${a?.role})`, response);
    }
    for (const [id, err] of Object.entries(errors)) {
      log.error("Advisor", `${id}: ${err}`);
    }

    if (successCount === 0) {
      log.error("Deliberation", "All board members failed to respond");
      send("error", { message: "All board members failed to respond." });
      return res.end();
    }

    const boardSummary = Object.entries(advisorResponses)
      .map(([id, response]) => {
        const a = advisors.find((x) => x.id === id);
        return `## ${a?.name || id} (${a?.role || "Advisor"})\n${response}`;
      })
      .join("\n\n");

    // Phase 2.5: Scoring Layer — evaluate advisor responses
    log.phase("Scoring", "Evaluating advisor responses on specificity, credibility & narrative");
    let scoringSummary = null;
    let scoringDebateContext = "";

    send("stage", {
      stage: "scoring",
      message: "Scoring advisor responses on specificity, credibility & narrative...",
    });

    try {
      const activeWithResponses = active.filter((a) => advisorResponses[a.id]);
      const rawScores = await scoreAllAdvisors(
        activeWithResponses,
        advisorResponses,
        parsedSchema,
        chairModel
      );

      if (Object.keys(rawScores).length > 0) {
        const aggregated = computeAggregateScores(rawScores, parsedSchema);
        scoringSummary = buildScoringSummary(rawScores, aggregated);
        scoringDebateContext = formatScoringForDebate(aggregated);
        log.info(`Scoring complete — overall: ${scoringSummary.overallScore}/10 (${scoringSummary.overallClassification})`);
        log.info(`Accepted: ${scoringSummary.sectionsAccepted?.join(", ") || "none"} | Refine: ${scoringSummary.sectionsToRefine?.join(", ") || "none"} | Review: ${scoringSummary.sectionsToReview?.join(", ") || "none"}`);
        log.data("Scoring Summary", scoringSummary);
        send("scoring_complete", { scoring: scoringSummary });
      } else {
        log.info("Scoring skipped — no raw scores returned");
        send("scoring_complete", { scoring: null, skipped: true });
      }
    } catch (err) {
      log.error("Scoring", err.message);
      send("scoring_complete", { scoring: null, error: err.message });
    }

    if (aborted) return res.end();

    // Phase 2.75: Bounded Refinement Loop — improve weak sections
    log.phase("Refinement Loop", "Improving weak sections if needed");
    let refinementResult = null;

    if (scoringSummary && (scoringSummary.sectionsToRefine?.length > 0 || scoringSummary.sectionsToReview?.length > 0)) {
      log.info(`Sections to refine: ${scoringSummary.sectionsToRefine?.join(", ") || "none"}`);
      log.info(`Sections to review: ${scoringSummary.sectionsToReview?.join(", ") || "none"}`);
      send("stage", {
        stage: "refining",
        message: "Refining weak sections (up to 3 passes)...",
      });

      try {
        const activeWithResponses = active.filter((a) => advisorResponses[a.id]);
        const initialRawScores = await scoreAllAdvisors(activeWithResponses, advisorResponses, parsedSchema, chairModel);
        const initialAggregated = computeAggregateScores(initialRawScores, parsedSchema);

        refinementResult = await runRefinementLoop(
          activeWithResponses,
          advisorResponses,
          initialAggregated,
          scoringSummary,
          parsedSchema,
          query,
          modelMap,
          chairModel,
          DEFAULT_MODEL,
          send
        );

        if (refinementResult.passes > 0) {
          for (const [id, response] of Object.entries(refinementResult.finalResponses)) {
            advisorResponses[id] = response;
          }
          scoringSummary = refinementResult.finalScoring;
          scoringDebateContext = formatScoringForDebate(refinementResult.finalAggregated);
        }

        log.info(`Refinement complete: ${refinementResult.passes} pass(es), stopped because "${refinementResult.stoppedReason}"`);
        log.data("Refinement History", refinementResult.history);

        send("refinement_complete", {
          passes: refinementResult.passes,
          stoppedReason: refinementResult.stoppedReason,
          history: refinementResult.history,
          finalOverallScore: refinementResult.finalScoring?.overallScore ?? scoringSummary?.overallScore,
        });
      } catch (err) {
        log.error("Refinement", err.message);
        send("refinement_complete", { passes: 0, error: err.message });
      }

      if (aborted) return res.end();
    } else {
      log.info("All sections acceptable — refinement skipped");
      send("refinement_complete", { passes: 0, stoppedReason: "all_sections_acceptable" });
    }

    // Rebuild board summary with potentially refined responses
    const refinedBoardSummary = Object.entries(advisorResponses)
      .map(([id, response]) => {
        const a = advisors.find((x) => x.id === id);
        return `## ${a?.name || id} (${a?.role || "Advisor"})\n${response}`;
      })
      .join("\n\n");

    // Phase 3: Debate Engine — advisors cross-examine each other
    log.phase("Debate Engine", "Advisors cross-examining each other's positions");
    const debateResponses = {};
    const debateSkipped = successCount < 2;

    if (!debateSkipped) {
      send("stage", {
        stage: "debate",
        message: "Advisors are challenging each other's positions...",
      });

      const debateResults = await Promise.allSettled(
        active
          .filter((a) => advisorResponses[a.id])
          .map((advisor) => {
            const othersSection = Object.entries(advisorResponses)
              .filter(([id]) => id !== advisor.id)
              .map(([id, resp]) => {
                const other = advisors.find((x) => x.id === id);
                return `### ${other?.name || id} (${other?.role || "Advisor"})\n${resp}`;
              })
              .join("\n\n");

            const model = modelMap[advisor.id] || advisor.model || DEFAULT_MODEL;
            const scoringSection = scoringDebateContext
              ? `\n\nThe Board's scoring layer has identified the following quality assessment:\n${scoringDebateContext}\n\nPrioritize your debate on sections flagged as needing improvement.`
              : "";
            return callLLM({
              systemPrompt: advisor.systemPrompt,
              userMessage: `You previously analyzed this question: "${query}"

Your initial position was:
${advisorResponses[advisor.id]}

Other board members have now weighed in:

${othersSection}${scoringSection}

As part of the board's structured debate process, you must now:
1. **Challenge**: Identify the weakest assumption or logical gap in the other advisors' positions
2. **Defend or Concede**: Where others contradict your view, either strengthen your argument with sharper reasoning or concede if they raise a valid point
3. **Synthesize**: State your refined position, incorporating any new insights from the debate

Be direct and specific. Name the advisor you're challenging. Do not be agreeable for the sake of politeness — this is a rigorous debate. Keep your response under 250 words.`,
              model,
              maxTokens: 700,
            });
          })
      );

      if (aborted) return res.end();

      const debatingAdvisors = active.filter((a) => advisorResponses[a.id]);
      debateResults.forEach((result, i) => {
        const advisor = debatingAdvisors[i];
        if (result.status === "fulfilled") {
          debateResponses[advisor.id] = result.value;
          log.data(`Debate Response: ${advisor.name}`, result.value);
          send("debate_complete", {
            advisorId: advisor.id,
            name: advisor.name,
          });
        }
      });
      log.info(`Debate complete: ${Object.keys(debateResponses).length} rebuttals`);
    } else {
      log.info("Debate skipped — fewer than 2 successful advisors");
    }

    if (aborted) return res.end();

    const debateSummary = Object.keys(debateResponses).length > 0
      ? "\n\n## Debate Round (Cross-Examination)\n" +
        Object.entries(debateResponses)
          .map(([id, response]) => {
            const a = advisors.find((x) => x.id === id);
            return `### ${a?.name || id} — Rebuttal & Refined Position\n${response}`;
          })
          .join("\n\n")
      : "";

    // Phase 4: Board Chair evaluates — decide if follow-up is needed
    log.phase("Chair Review", "Board Chair reviewing opinions and debate for follow-ups");
    send("stage", {
      stage: "chair_review",
      message: "Board Chair is reviewing opinions and debate...",
    });

    let followUpQuestions = {};
    let followUpResponses = {};

    if (successCount >= 2) {
      try {
        const evalResult = await callLLM({
          systemPrompt:
            "You are the Board Chair. Analyze board member responses AND their debate exchanges to decide if follow-up questions are still needed. The debate round has already surfaced disagreements and refined positions. Respond with ONLY valid JSON, no other text.",
          userMessage: `Question posed to the board: "${query}"\n\nInitial board member opinions:\n${refinedBoardSummary}${debateSummary}\n\nAfter reviewing both the initial opinions and the debate round, determine if you still need to ask follow-up questions to resolve remaining contradictions or fill critical gaps.\n\nIf follow-up is needed (maximum 2 questions), respond with:\n{"needsFollowUp": true, "followUps": [{"advisorId": "id-here", "question": "your question"}]}\n\nValid advisor IDs: ${active.map((a) => a.id).join(", ")}\n\nIf the debate round has sufficiently clarified positions, respond with:\n{"needsFollowUp": false}`,
          model: chairModel,
          maxTokens: 400,
        });

        if (aborted) return res.end();

        const evalData = parseJsonFromLLM(evalResult);

        if (
          evalData?.needsFollowUp &&
          Array.isArray(evalData.followUps) &&
          evalData.followUps.length > 0
        ) {
          send("stage", {
            stage: "follow_up",
            message: "Board Chair is requesting clarification...",
          });

          const validFUs = evalData.followUps
            .filter(
              (fu) =>
                fu.advisorId && fu.question && advisorResponses[fu.advisorId]
            )
            .slice(0, 2);

          if (validFUs.length > 0) {
            const fuResults = await Promise.allSettled(
              validFUs.map((fu) => {
                const advisor = advisors.find((a) => a.id === fu.advisorId);
                if (!advisor) return Promise.resolve(null);
                const model =
                  modelMap[fu.advisorId] || advisor.model || DEFAULT_MODEL;
                followUpQuestions[fu.advisorId] = fu.question;
                return callLLM({
                  systemPrompt: advisor.systemPrompt,
                  userMessage: `The Board Chair has a follow-up question regarding your analysis of: "${query}"\n\nThe Chair asks: ${fu.question}\n\nProvide a focused, direct response.`,
                  model,
                  maxTokens: 500,
                });
              })
            );

            if (aborted) return res.end();

            fuResults.forEach((result, i) => {
              const fu = validFUs[i];
              if (result.status === "fulfilled" && result.value) {
                followUpResponses[fu.advisorId] = result.value;
                log.data(`Follow-up Q for ${fu.advisorId}`, fu.question);
                log.data(`Follow-up A from ${fu.advisorId}`, result.value);
                send("followup_complete", {
                  advisorId: fu.advisorId,
                  name: advisors.find((a) => a.id === fu.advisorId)?.name,
                });
              }
            });
          }
        }
        log.info(`Follow-ups: ${Object.keys(followUpResponses).length} answered`);
      } catch (err) {
        log.error("Chair Review", err?.message || "Evaluation failed — skip follow-up");
      }
    }

    if (aborted) return res.end();

    // Phase 5: Board Chair — Decision Engine
    log.phase("Decision Engine", "Board Chair synthesizing final decision");
    send("stage", {
      stage: "resolution",
      message: "Board Chair is synthesizing the final decision...",
    });

    let followUpSection = "";
    if (Object.keys(followUpResponses).length > 0) {
      followUpSection =
        "\n\n## Follow-up Exchanges\n" +
        Object.entries(followUpResponses)
          .map(([id, resp]) => {
            const a = advisors.find((x) => x.id === id);
            return `### ${a?.name || id}\nChair's question: ${followUpQuestions[id]}\nResponse: ${resp}`;
          })
          .join("\n\n");
    }

    const warnings = [];
    if (successCount < 2) {
      warnings.push(
        "Resolution produced with fewer than 2 board member responses."
      );
    }
    if (debateSkipped) {
      warnings.push(
        "Debate round skipped — requires at least 2 successful advisor responses."
      );
    }

    const allInputs = `Question posed to the board: "${query}"\n\nBoard member opinions${refinementResult?.passes > 0 ? " (refined)" : ""}:\n${refinedBoardSummary}${debateSummary}${followUpSection}`;

    const advisorNames = active
      .filter((a) => advisorResponses[a.id])
      .map((a) => `${a.name} (${a.role})`);

    const structuredDecision = await callLLM({
      systemPrompt: `You are the Board Chair — the final decision authority. You have reviewed all advisor opinions, the structured debate where advisors challenged each other, and any follow-up exchanges.

Your job is to synthesize all inputs, resolve every conflict, and produce a structured decision. You must take a clear position — do not hedge or defer.

Respond with ONLY valid JSON matching this exact schema (no markdown, no text outside the JSON):
{
  "verdict": "A clear 1-2 sentence decision statement — the recommended course of action",
  "confidence": "high" | "medium" | "low",
  "confidenceRationale": "One sentence explaining the confidence level",
  "consensus": ["Array of points where all or most advisors agreed"],
  "conflictsResolved": [
    {
      "topic": "What the disagreement was about",
      "sides": {"advisor_name": "their position (brief)"},
      "chairRuling": "How you resolved it and why",
      "rulingFavor": "Which advisor's reasoning prevailed, or 'compromise'"
    }
  ],
  "risks": [
    {"risk": "Description of the risk", "severity": "high | medium | low", "mitigation": "How to address it"}
  ],
  "actionItems": [
    {"action": "Specific next step", "priority": "immediate | short-term | long-term", "rationale": "Why this matters"}
  ],
  "dissent": "Any surviving minority viewpoints the decision-maker should be aware of, or null if none",
  "narrative": "A 150-250 word authoritative narrative that ties everything together — the 'why' behind this decision. Reference specific advisor arguments and debate outcomes."
}`,
      userMessage: `${allInputs}\n\nBoard members who participated: ${advisorNames.join(", ")}\n\nProduce your structured decision now.`,
      model: chairModel,
      maxTokens: 2000,
    });

    if (aborted) return res.end();

    let decision = null;
    let resolution = structuredDecision;

    try {
      decision = JSON.parse(structuredDecision.trim());
    } catch {
      const jsonMatch = structuredDecision.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          decision = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }

    if (decision?.verdict) {
      resolution = decision.narrative || decision.verdict;
      log.info(`Decision: ${decision.verdict} (confidence: ${decision.confidence})`);
      log.data("Full Decision", decision);
    } else {
      log.info("Decision: structured parse failed — using raw narrative");
      log.data("Raw Decision", resolution);
    }

    if (aborted) return res.end();

    // Phase 6: One-Pager Generation
    log.phase("One-Pager", "Generating investor one-pager");
    let onePager = null;
    try {
      send("stage", {
        stage: "one_pager",
        message: "Generating investor one-pager...",
      });

      onePager = await generateOnePager(
        parsedSchema,
        decision,
        scoringSummary,
        advisorResponses,
        query,
        chairModel
      );

      if (onePager) {
        log.info(`One-pager generated: ${onePager.companyName || "Unknown"}`);
        log.data("One-Pager", onePager);
        send("one_pager_complete", { onePager });
      } else {
        log.info("One-pager generation returned null");
      }
    } catch (err) {
      log.error("One-Pager", err.message);
    }

    log.complete(Date.now() - sessionStart);

    send("stage", { stage: "complete", message: "Decision ready" });
    send("complete", {
      resolution,
      decision,
      onePager,
      parsedSchema,
      enrichmentData,
      scoringSummary,
      refinementResult: refinementResult ? {
        passes: refinementResult.passes,
        stoppedReason: refinementResult.stoppedReason,
        history: refinementResult.history,
      } : null,
      advisorResponses,
      advisorModelUsed,
      debateResponses,
      followUpQuestions,
      followUpResponses,
      researchSources,
      errors,
      warnings,
    });

    res.end();
  } catch (err) {
    console.error("Deliberation error:", err);
    if (!aborted) {
      send("error", {
        message: err.message || "An unexpected error occurred",
      });
    }
    res.end();
  }
});

// ===== Legacy query endpoint =====

router.post(
  "/query",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "File upload failed" });
      }
      next();
    });
  },
  async (req, res) => {
  try {
    const {
      query,
      activeAdvisors: activeIds,
      fileContext: bodyFileCtx,
      advisorModels,
      synthesisModel,
    } = req.body;

    if (!query?.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }

    let fileContext = bodyFileCtx || null;
    if (req.file) {
      try {
        fileContext = await extractFileContext(req.file);
      } catch (err) {
        return res.status(400).json({ error: err.message || "Could not read uploaded file" });
      }
    }

    const active = advisors.filter((a) => activeIds?.includes(a.id));
    if (active.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one advisor must be active" });
    }

    const userMessage = buildUserMessage(query, fileContext);
    const modelMap = advisorModels || {};

    const results = await Promise.allSettled(
      active.map((advisor) => {
        const model = modelMap[advisor.id] || advisor.model || DEFAULT_MODEL;
        return callLLM({
          systemPrompt: advisor.systemPrompt,
          userMessage,
          model,
          maxTokens: MAX_TOKENS,
        });
      })
    );

    const advisorResponses = {};
    const advisorModelUsed = {};
    const errors = {};

    results.forEach((result, i) => {
      const advisor = active[i];
      const model = modelMap[advisor.id] || advisor.model || DEFAULT_MODEL;
      if (result.status === "fulfilled") {
        advisorResponses[advisor.id] = result.value;
        advisorModelUsed[advisor.id] = model;
      } else {
        errors[advisor.id] = result.reason?.message || "Unknown error";
      }
    });

    const successCount = Object.keys(advisorResponses).length;
    let synthesis = null;
    let synthesisWarning = null;

    if (successCount < 2) {
      synthesisWarning =
        "Synthesis requires at least 2 successful advisor responses.";
    }

    if (successCount >= 1) {
      const synthesisPrompt = `You are a neutral facilitator. Below are responses from ${successCount} advisors on the following question: "${query}"

${Object.entries(advisorResponses)
  .map(([id, response]) => {
    const advisor = advisors.find((a) => a.id === id);
    const model = advisorModelUsed[id];
    return `## ${advisor?.name || id} (via ${model})\n${response}`;
  })
  .join("\n\n")}

Produce a synthesis that:
1. Identifies areas of consensus
2. Highlights key trade-offs or disagreements
3. Offers a balanced recommendation with reasoning
Keep it under 300 words.`;

      const synthModel = synthesisModel || DEFAULT_MODEL;

      try {
        synthesis = await callLLM({
          systemPrompt:
            "You are a neutral, unbiased facilitator synthesizing multiple expert perspectives.",
          userMessage: synthesisPrompt,
          model: synthModel,
          maxTokens: MAX_TOKENS,
        });
      } catch {
        synthesisWarning = "Synthesis call failed.";
      }
    }

    res.json({
      advisorResponses,
      advisorModelUsed,
      errors,
      synthesis,
      synthesisWarning,
    });
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/refine", async (req, res) => {
  try {
    const { query, synthesis, rating, advisorsUsed, model } = req.body;

    const refinementPrompt = `A user rated the following board resolution as "${rating}".

Original query: "${query}"
Resolution: "${synthesis}"
Board members: ${advisorsUsed.join(", ")}

Suggest specific improvements to the board member system prompts or resolution logic that would produce a more useful response. Be concrete and actionable.`;

    const refinement = await callLLM({
      systemPrompt:
        "You are an expert prompt engineer helping improve a multi-advisor AI system.",
      userMessage: refinementPrompt,
      model: model || DEFAULT_MODEL,
      maxTokens: MAX_TOKENS,
    });

    res.json({ refinement });
  } catch (err) {
    console.error("Refine error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/personas", (_req, res) => {
  res.json(advisors.map(({ id, name, color }) => ({ id, name, color })));
});

router.get("/models", (_req, res) => {
  res.json(PROVIDERS);
});

module.exports = router;
