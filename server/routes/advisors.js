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
    const allowed = [".txt", ".csv", ".md", ".json", ".pdf", ".xlsx", ".xls", ".pptx"];
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

async function extractRawContent(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const filePath = file.path;

  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return { type: "pdf", text: result?.text ?? "" };
  }

  if (ext === ".xlsx" || ext === ".xls") {
    // Note: xlsx has known prototype-pollution vuln (GHSA-4r6h-8v6p-xvw6).
    // Acceptable here since files are uploaded by the app owner, not anonymous users.
    const XLSX = require("xlsx");
    const workbook = XLSX.readFile(filePath);
    const sections = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      return `[Sheet: ${name}]\n${csv}`;
    });
    return { type: "excel", text: sections.join("\n\n") };
  }

  if (ext === ".pptx") {
    const officeParser = require("officeparser");
    const text = await new Promise((resolve, reject) => {
      officeParser.parseOffice(filePath, (data, err) => {
        if (err) reject(err);
        else resolve(data || "");
      });
    });
    return { type: "pptx", text };
  }

  // .txt, .csv, .md, .json
  return { type: "text", text: fs.readFileSync(filePath, "utf-8") };
}

async function generateFileBriefing(rawText, model) {
  try {
    const briefing = await callLLM({ // callLLM is imported at the top of this file
      systemPrompt: "You extract structured intelligence from uploaded documents. Be concise and precise.",
      userMessage: `Convert the following document content into a structured briefing with these sections:
1. **Summary** (2–3 sentences describing what this document is)
2. **Key Metrics** (bullet list of any numbers, KPIs, financial figures, or quantitative data found)
3. **Key Points** (5–8 bullets of the most important facts, findings, or arguments)
4. **Structure Notes** (1 line: describe the document type, e.g. "Financial model with 3 sheets: P&L, Balance Sheet, Assumptions")

Document content:
${rawText.slice(0, 12000)}`,
      model,
      maxTokens: 800,
    });
    return briefing;
  } catch {
    return null;
  }
}

async function extractFileContext(file, model) {
  if (!file) return null;
  const filePath = file.path;
  try {
    const { text } = await extractRawContent(file);
    const truncated = truncateContext(text);
    const briefing = await generateFileBriefing(truncated, model);
    if (briefing) {
      return `[File Briefing — AI-structured summary]\n${briefing}\n\n[Raw Extract]\n${truncated}`;
    }
    return truncated;
  } finally {
    fs.unlink(filePath, () => {});
  }
}

function parseJsonFromLLM(text) {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
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
    outputFormat: body.outputFormat || "structured-memo",
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
    const { query, activeIds, fileContext: bodyFileContext, advisorModels, synthesisModel, outputFormat } = parseDeliberateBody(req);
    const sessionStart = Date.now();
    const log = createSession(query, activeIds || [], req.file?.originalname);
    const chairModel = synthesisModel || DEFAULT_MODEL;

    // Extract file context: uploaded file takes priority, then body text
    let fileContext = bodyFileContext;
    if (req.file) {
      try {
        fileContext = await extractFileContext(req.file, chairModel);
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

    // Quick-answer shortcut: skip scoring/refinement/debate/follow-up, go straight to Chair
    if (outputFormat === "quick-answer") {
      log.info("Quick-answer mode: skipping scoring, refinement, debate, and follow-up");
      send("stage", { stage: "resolution", message: "Board Chair is synthesizing a quick answer..." });

      const quickBoardSummary = Object.entries(advisorResponses)
        .map(([id, response]) => {
          const a = advisors.find((x) => x.id === id);
          return `## ${a?.name || id} (${a?.role || "Advisor"})\n${response}`;
        })
        .join("\n\n");

      const quickDecisionRaw = await callLLM({
        systemPrompt: `You are the Board Chair. Give a direct, actionable verdict in 2–3 sentences maximum. No lists, no elaboration. Respond with ONLY valid JSON: {"verdict": "string", "confidence": "high|medium|low"}`,
        userMessage: `Question: "${query}"\n\nBoard opinions:\n${quickBoardSummary}\n\nGive a quick verdict.`,
        model: chairModel,
        maxTokens: 300,
      });

      let quickDecision = null;
      try {
        quickDecision = JSON.parse(quickDecisionRaw.trim());
      } catch {
        const m = quickDecisionRaw.match(/\{[\s\S]*\}/);
        if (m) try { quickDecision = JSON.parse(m[0]); } catch {}
      }

      const quickResolution = quickDecision?.verdict || quickDecisionRaw;
      log.complete(Date.now() - sessionStart);
      send("stage", { stage: "complete", message: "Decision ready" });
      send("complete", {
        resolution: quickResolution,
        decision: quickDecision,
        onePager: null,
        advisorResponses,
        advisorModelUsed,
        debateResponses: {},
        followUpQuestions: {},
        followUpResponses: {},
        researchSources,
        errors,
        warnings: [],
      });
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
              userMessage: `The board has weighed in on: "${query}"

Your position:
${advisorResponses[advisor.id]}

What the others said:
${othersSection}${scoringSection}

This is the debate round. You are not here to find common ground — you are here to expose what is wrong with the other arguments. The Chair will synthesize later. Your job is to make the tension sharper, not resolve it.

Structure your rebuttal as follows:

**Target**: Name the specific advisor and the specific claim you're attacking. One claim only — the one that, if wrong, collapses their entire position.

**The flaw**: What is factually wrong, logically broken, or dangerously naive about that claim? Be precise. "That's too optimistic" is not a critique. Name the mechanism that makes it fail.

**Your counter-evidence**: What from your own lens — data, history, first principles, observed patterns — makes your original position hold even under their best argument?

**The sticking point**: State the one thing you and this advisor fundamentally disagree on that no amount of data will resolve. This is a values or framework conflict, not a facts conflict. Name it clearly so the Chair can rule on it.

Rules:
- Do not summarize what the others said. Attack it.
- If you agree with something, say it in one sentence max and move on — this is not a place to list agreements.
- Early consensus is a sign of weak thinking. If you're not challenging a core assumption, you're not trying.
- Stay in your persona. Do not soften your voice for politeness.`,
              model,
              maxTokens: 900,
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
            "You are the Board Chair — the final decision authority. You have read all advisor opinions and their debate rebuttals. You are about to rule. Before you do, identify any advisor claim that is load-bearing for your decision but unsubstantiated — where you cannot rule confidently without a direct answer. These are not clarification questions. They are challenges: you are calling an advisor's bluff. Respond with ONLY valid JSON, no other text.",
          userMessage: `Question: "${query}"

Board opinions and debate:
${refinedBoardSummary}${debateSummary}

You are about to issue a ruling. Identify follow-up questions ONLY if:
- An advisor made a factual claim you cannot verify and it materially changes your verdict
- A core contradiction between two advisors was never resolved in the debate and it determines your ruling
- An advisor's key assumption appears to be false and you want them to defend or retract it

Do NOT ask follow-ups just to gather more information. Ask them to expose a specific weakness in an argument.

If you have unresolved contradictions (maximum 5 questions), respond with:
{"needsFollowUp": true, "followUps": [{"advisorId": "id-here", "question": "specific pointed question that challenges their claim, not a general request for elaboration"}]}

Valid advisor IDs: ${active.map((a) => a.id).join(", ")}

If you can rule confidently without follow-ups, respond with:
{"needsFollowUp": false}`,
          model: chairModel,
          maxTokens: 500,
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
            .slice(0, 5);

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
                  userMessage: `The Board Chair is challenging your position on: "${query}"

The Chair's challenge: ${fu.question}

This is not a request for more information. The Chair is questioning whether your argument holds. Respond directly and defend your position — or, if the Chair has identified a genuine flaw, concede specifically what breaks and what still stands. Do not repeat your original analysis. Address the challenge head-on in 3–5 sentences.`,
                  model,
                  maxTokens: 400,
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
      systemPrompt: `You are the Board Chair — the final decision authority. You have read all advisor opinions, the debate where advisors attacked each other's positions, and any follow-up challenges.

Your job is not to summarize. Your job is to decide.

RULING RULES — read these before writing a single word:
- The verdict is YOUR position, derived from the strongest reasoning in the room. It is not a consensus view. If only one advisor was right, say so.
- Where advisors conflict, you must pick a side. "Both have valid points" is not a ruling. State which position is more sound and what is specifically wrong with the other.
- Do not soften a clear finding with diplomatic hedging. If the data points one way, point it one way.
- The verdict must be actionable in the next 7 days — not a quarter, not a year. What should they actually do first?
- If an advisor's core assumption was wrong, name the advisor and name the wrong assumption. This is not impolite — it's your job.

FIELD RULES:
- "verdict": 1–3 tight sentences. What to do. No preamble, no "based on the above," no generic framing.
- "keyReasoning": 3–5 bullets. The actual reasons this verdict follows — not advisor summaries. Each bullet must stand alone.
- "conflictsResolved[].chairRuling": Must state which position prevailed AND what was specifically wrong with the losing argument. A diplomatic middle-ground is not a ruling.
- "conflictsResolved[].rulingFavor": Name the advisor whose reasoning you adopted, or "chair" if you synthesized a third position neither held.
- "dissent": If an advisor made a point you're overruling that carries real risk, preserve it here. Not to be balanced — to be honest about what you're betting against.
- "advisorHighlights": Required. For each advisor who participated, provide a one-sentence quote or paraphrase of their most distinctive contribution — the specific angle, risk, or insight only they raised. Use their exact name as it appears in the board members list.
- "narrative": Use null. The verdict and keyReasoning are enough.

Field types: confidence is one of "high", "medium", "low". actionItems[].priority is one of "immediate", "short-term", "long-term". risks[].severity is one of "high", "medium", "low".

Respond with ONLY valid JSON (no markdown, no text outside the JSON):
{
  "verdict": "string — 1–3 sentences: what to do, immediately actionable, no filler",
  "keyReasoning": ["3–5 strings — the actual reasons, not advisor summaries"],
  "confidence": "high|medium|low",
  "confidenceRationale": "string — what would change this confidence level",
  "consensus": ["strings — where advisors genuinely agreed on the underlying facts, not just the conclusion"],
  "conflictsResolved": [
    {
      "topic": "string",
      "sides": {"advisor_name": "their position in one clause"},
      "chairRuling": "string — which position prevailed and what was wrong with the other",
      "rulingFavor": "advisor_name or 'chair'"
    }
  ],
  "risks": [{"risk": "string", "severity": "high|medium|low", "mitigation": "string"}],
  "actionItems": [{"action": "string — specific enough to assign to a person", "priority": "immediate|short-term|long-term", "rationale": "string"}],
  "dissent": "string — the strongest argument against your verdict, and why you're overruling it anyway. null if none.",
  "advisorHighlights": [{"name": "AdvisorName", "highlight": "one sentence — their single most distinctive contribution"}],
  "narrative": null
}`,
      userMessage: `${allInputs}\n\nBoard members who participated: ${advisorNames.join(", ")}\n\nIssue your ruling now. Pick sides where there is conflict. Do not average positions.`,
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
      const kr = Array.isArray(decision.keyReasoning)
        ? decision.keyReasoning.filter(Boolean).slice(0, 5)
        : [];
      resolution =
        kr.length > 0
          ? `${decision.verdict}\n\n${kr.map((b) => `- ${b}`).join("\n")}`
          : decision.verdict;
      log.info(`Decision: ${decision.verdict} (confidence: ${decision.confidence})`);
      log.data("Full Decision", decision);
    } else {
      log.info("Decision: structured parse failed — using raw narrative");
      log.data("Raw Decision", resolution);
    }

    if (aborted) return res.end();

    // Phase 6: One-Pager Generation — only when user explicitly requested it
    let onePager = null;
    if (outputFormat === "one-pager") {
      log.phase("One-Pager", "Generating investor one-pager");
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
    } else {
      log.info(`One-pager skipped (outputFormat: ${outputFormat})`);
    }

    // Generate follow-up questions FOR THE USER (board asking user to fill gaps)
    let boardQuestionsForUser = [];
    if (decision?.verdict && outputFormat !== "quick-answer") {
      try {
        const bfuRaw = await callLLM({
          systemPrompt: `You are the Board Chair. You have just delivered a decision. Identify 1–2 questions to ask the USER that would materially strengthen or change your recommendation — not internal advisor follow-ups, but gaps in what the user provided. Be specific and direct. Return ONLY valid JSON: {"questions": [{"question": "string", "why": "string — one sentence on what changes if they answer this"}]}`,
          userMessage: `Original question: "${query}"\nDecision delivered: "${decision.verdict}"\n\nWhat 1–2 questions would most sharpen this ruling if the user answered them? Only ask if missing information would materially change the recommendation.`,
          model: chairModel,
          maxTokens: 400,
        });
        const bfuData = parseJsonFromLLM(bfuRaw);
        if (Array.isArray(bfuData?.questions)) {
          boardQuestionsForUser = bfuData.questions.filter((q) => q.question).slice(0, 2);
        }
      } catch (err) {
        log.error("Board Follow-Up Generation", err.message);
      }
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
      boardQuestionsForUser,
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

// ===== Board follow-up: user answers board questions → refined decision =====

router.post("/deliberate-followup", async (req, res) => {
  const { originalQuery, previousDecision, answers, activeAdvisors: activeIds, synthesisModel } = req.body || {};

  if (!originalQuery?.trim() || !answers?.length) {
    return res.status(400).json({ error: "originalQuery and answers are required" });
  }

  const chairModel = synthesisModel || DEFAULT_MODEL;
  const active = advisors.filter((a) => activeIds?.includes(a.id));

  try {
    const answersText = answers
      .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
      .join("\n\n");

    const refined = await callLLM({
      systemPrompt: `You are the Board Chair. You delivered an initial ruling, then asked the user follow-up questions. You now have their answers. Revise your ruling if the answers change anything material. If the original ruling stands, confirm it with the new context integrated. Be decisive. Return ONLY valid JSON with the same schema as before: {verdict, keyReasoning, confidence, confidenceRationale, consensus, conflictsResolved, risks, actionItems, dissent, advisorHighlights, narrative}.`,
      userMessage: `Original question: "${originalQuery}"\n\nInitial ruling: "${previousDecision?.verdict || ""}"\n\nUser's answers to follow-up questions:\n${answersText}\n\nRevise or confirm your ruling.`,
      model: chairModel,
      maxTokens: 1500,
    });

    let decision = null;
    try {
      decision = JSON.parse(refined.trim());
    } catch {
      const m = refined.match(/\{[\s\S]*\}/);
      if (m) try { decision = JSON.parse(m[0]); } catch {}
    }

    const resolution = decision?.verdict || refined;
    res.json({ resolution, decision });
  } catch (err) {
    res.status(500).json({ error: err.message || "Follow-up refinement failed" });
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

router.post("/email-draft", async (req, res) => {
  try {
    const { decision, query, model } = req.body;
    if (!decision?.verdict) {
      return res.status(400).json({ error: "decision.verdict is required" });
    }
    const actionItems = (decision.actionItems || [])
      .map((a, i) => `${i + 1}. ${a.action}`)
      .join("\n");
    const risks = (decision.risks || [])
      .map((r) => `- ${r.risk} (${r.severity})`)
      .join("\n");

    const draft = await callLLM({
      systemPrompt:
        "You write clear, professional business emails that summarize board decisions. Write in first person as if from the board chair. Be direct and actionable — no filler.",
      userMessage: `Write a professional email summarizing the following board decision.

Original question: ${query}

Board verdict: ${decision.verdict}
Confidence: ${decision.confidence || "medium"}
${actionItems ? `\nRecommended next steps:\n${actionItems}` : ""}
${risks ? `\nKey risks flagged:\n${risks}` : ""}
${decision.dissent ? `\nNote of dissent: ${decision.dissent}` : ""}

Format: Subject line, then email body (3–5 short paragraphs). No salutation placeholder needed.`,
      model: model || DEFAULT_MODEL,
      maxTokens: 600,
    });

    res.json({ draft });
  } catch (err) {
    console.error("Email draft error:", err);
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
