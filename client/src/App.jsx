import { useState, useEffect, useCallback } from "react";
import { ADVISORS, BOARD_PRESETS, SYNTHESIS_MODEL, getAdvisorModelsMap } from "./advisors";
import {
  deliberate,
  deliberateFollowup,
  refineWithFeedback,
  submitFeedback,
  getFeedbackHistory,
  deleteFeedback,
  clearAllFeedback,
} from "./api";
import QueryPanel from "./components/QueryPanel";
import PersonaToggleBar from "./components/PersonaToggleBar";
import DeliberationProgress from "./components/DeliberationProgress";
import ResolutionPanel from "./components/ResolutionPanel";
import BoardInsights from "./components/BoardInsights";
import FeedbackRefineButton from "./components/FeedbackRefineButton";
import HistoryPanel from "./components/HistoryPanel";
import OnePagerPanel from "./components/OnePagerPanel";
import EmailDraftPanel from "./components/EmailDraftPanel";
import BoardFollowUpPanel from "./components/BoardFollowUpPanel";
import PastDecisionPicker from "./components/PastDecisionPicker";
import ThemeToggle from "./components/ThemeToggle";
import BrandSparkleLogo from "./components/BrandSparkleLogo";

const ADVISOR_MODELS = getAdvisorModelsMap();

function getInitialTheme() {
  const saved = localStorage.getItem("boardroom-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [activeAdvisors, setActiveAdvisors] = useState(ADVISORS.map((a) => a.id));
  const [outputFormat, setOutputFormat] = useState("structured-memo");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [query, setQuery] = useState("");
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [advisorResponses, setAdvisorResponses] = useState({});
  const [debateResponses, setDebateResponses] = useState({});
  const [followUpQuestions, setFollowUpQuestions] = useState({});
  const [followUpResponses, setFollowUpResponses] = useState({});
  const [researchSources, setResearchSources] = useState([]);
  const [onePager, setOnePager] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [decision, setDecision] = useState(null);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [rating, setRating] = useState(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinement, setRefinement] = useState(null);
  const [boardQuestionsForUser, setBoardQuestionsForUser] = useState([]);
  const [isAnsweringBoard, setIsAnsweringBoard] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [referencedDecisions, setReferencedDecisions] = useState([]);
  const [advisorStances, setAdvisorStances] = useState({});
  const [contradictionAlert, setContradictionAlert] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("boardroom-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    getFeedbackHistory()
      .then(setFeedback)
      .catch(() => {});
  }, []);

  const handleToggle = useCallback((id) => {
    setActiveAdvisors((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }, []);

  const handlePresetSelect = useCallback((ids) => {
    setActiveAdvisors(ids);
  }, []);

  const handleSubmit = useCallback(
    async ({ query: q, file, outputFormat: fmt }) => {
      setQuery(q);
      setIsDeliberating(true);
      setCurrentStage(null);
      setAdvisorResponses({});
      setDebateResponses({});
      setFollowUpQuestions({});
      setFollowUpResponses({});
      setResearchSources([]);
      setOnePager(null);
      setAdvisorStances({});
      setContradictionAlert(null);
      setResolution(null);
      setDecision(null);
      setErrors({});
      setWarnings([]);
      setRating(null);
      setRefinement(null);
      setBoardQuestionsForUser([]);
      setIsAnsweringBoard(false);
      setGlobalError(null);

      try {
        await deliberate(
          {
            query: q,
            activeAdvisors,
            file: file || undefined,
            advisorModels: ADVISOR_MODELS,
            synthesisModel: SYNTHESIS_MODEL,
            outputFormat: fmt || outputFormat,
            pastDecisions: referencedDecisions,
            feedbackHistory: feedback.filter((f) => f.decision?.verdict).slice(0, 8),
          },
          (event, data) => {
            switch (event) {
              case "stage":
                setCurrentStage(data.stage);
                break;
              case "one_pager_complete":
                if (data.onePager) setOnePager(data.onePager);
                break;
              case "complete":
                setResolution(data.resolution);
                setDecision(data.decision || null);
                if (data.onePager) setOnePager(data.onePager);
                setAdvisorResponses(data.advisorResponses || {});
                setDebateResponses(data.debateResponses || {});
                setFollowUpQuestions(data.followUpQuestions || {});
                setFollowUpResponses(data.followUpResponses || {});
                if (data.researchSources) setResearchSources(data.researchSources);
                if (data.errors) setErrors(data.errors);
                setWarnings(data.warnings || []);
                setBoardQuestionsForUser(data.boardQuestionsForUser || []);
                setAdvisorStances(data.advisorStances || {});
                if (data.contradictionAlert) setContradictionAlert(data.contradictionAlert);
                break;
              case "contradiction_alert":
                console.log("[CONTRADICTION ALERT RECEIVED]", data);
                setContradictionAlert(data);
                break;
              case "auto_referenced":
                console.log("[AUTO-REFERENCED]", data);
                break;
              case "error":
                setGlobalError(data.message);
                break;
            }
          }
        );
      } catch (err) {
        setGlobalError(err.message);
      } finally {
        setIsDeliberating(false);
      }
    },
    [activeAdvisors, outputFormat, referencedDecisions, feedback]
  );

  const handleRate = useCallback(
    async (r) => {
      setRating(r);
      if (r !== "helpful") return;
      try {
        await submitFeedback({
          id: crypto.randomUUID(),
          query,
          synthesis: resolution,
          decision: decision || null,
          rating: r,
          advisorsUsed: activeAdvisors.map(
            (id) => ADVISORS.find((a) => a.id === id)?.name || id
          ),
        });
        const history = await getFeedbackHistory();
        setFeedback(history);
      } catch {}
    },
    [query, resolution, decision, activeAdvisors]
  );

  const handleRefine = useCallback(async () => {
    if (!rating || !resolution) return;
    setIsRefining(true);
    setRefinement(null);
    try {
      const data = await refineWithFeedback({
        query,
        synthesis: resolution,
        rating,
        advisorsUsed: activeAdvisors.map(
          (id) => ADVISORS.find((a) => a.id === id)?.name || id
        ),
        model: SYNTHESIS_MODEL,
      });
      setRefinement(data.refinement);
    } catch {
      setRefinement("Refinement failed. Please try again.");
    } finally {
      setIsRefining(false);
    }
  }, [query, resolution, rating, activeAdvisors]);

  const handleFollowUpSubmit = useCallback(
    async (answers) => {
      setIsAnsweringBoard(true);
      try {
        const data = await deliberateFollowup({
          originalQuery: query,
          previousDecision: decision,
          answers,
          activeAdvisors,
          synthesisModel: SYNTHESIS_MODEL,
        });
        if (data.resolution) setResolution(data.resolution);
        if (data.decision) setDecision(data.decision);
        setBoardQuestionsForUser([]);
      } catch (err) {
        setGlobalError(err.message);
      } finally {
        setIsAnsweringBoard(false);
      }
    },
    [query, decision, activeAdvisors]
  );

  const hasResult = !!(resolution || decision);

  return (
    <div className="app app--mockup-home">
      <header className="app-header app-header--mockup">
        <div className="header-content header-content--mockup">
          <div className="logo logo--mockup">
            <div className="logo-icon logo-icon--mockup" aria-hidden>
              <BrandSparkleLogo size={36} className="brand-sparkle-logo" />
            </div>
            <h1>Board Room</h1>
          </div>
          <div className="header-right header-right--mockup">
            <p className="header-tagline header-tagline--mockup">AI advisory board</p>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main className="app-main app-main--mockup antialiased">
        {/* Input stack: query → board selection */}
        <section
          className="app-input-stack app-input-stack--mockup"
          aria-label="Question and board"
        >
          <QueryPanel
            onSubmit={handleSubmit}
            isLoading={isDeliberating}
            outputFormat={outputFormat}
            onFormatChange={setOutputFormat}
          />
          <div className="persona-shell persona-shell--mockup">
            <PersonaToggleBar
              advisors={ADVISORS}
              activeAdvisors={activeAdvisors}
              onToggle={handleToggle}
              presets={BOARD_PRESETS}
              onPresetSelect={handlePresetSelect}
            />
          </div>
          {feedback.filter((f) => f.decision?.verdict).length > 0 && (
            <PastDecisionPicker
              history={feedback.filter((f) => f.decision?.verdict)}
              selected={referencedDecisions}
              onChange={setReferencedDecisions}
              onDelete={async (id) => {
                await deleteFeedback(id).catch(() => {});
                setReferencedDecisions((prev) => prev.filter((d) => d.id !== id));
                const h = await getFeedbackHistory().catch(() => []);
                setFeedback(h);
              }}
              onClearAll={async () => {
                await clearAllFeedback().catch(() => {});
                setReferencedDecisions([]);
                setFeedback([]);
              }}
            />
          )}
        </section>

        {globalError && (
          <div className="global-error" role="alert">
            <span className="global-error-icon" aria-hidden="true">!</span>
            {globalError}
          </div>
        )}

        {isDeliberating && (
          <DeliberationProgress
            currentStage={currentStage}
            isDeliberating={isDeliberating}
          />
        )}

        {/* Primary output */}
        <div className={`app-outcomes${isDeliberating ? " app-outcomes--busy" : ""}`}>
          {/* Structured memo / action-plan / quick-answer → ResolutionPanel */}
          {hasResult && outputFormat !== "email-draft" && outputFormat !== "one-pager" && (
            <ResolutionPanel
              resolution={resolution}
              decision={decision}
              warnings={warnings}
              researchSources={researchSources}
              activeAdvisors={activeAdvisors}
              advisorStances={advisorStances}
              contradictionAlert={contradictionAlert}
              onRate={handleRate}
              currentRating={rating}
            />
          )}

          {/* One-pager format */}
          {outputFormat === "one-pager" && onePager && (
            <OnePagerPanel onePager={onePager} decision={decision} />
          )}

          {/* Email draft format */}
          {outputFormat === "email-draft" && hasResult && (
            <EmailDraftPanel decision={decision} query={query} />
          )}

          {hasResult && boardQuestionsForUser.length > 0 && (
            <BoardFollowUpPanel
              questions={boardQuestionsForUser}
              onSubmit={handleFollowUpSubmit}
              isLoading={isAnsweringBoard}
            />
          )}

          {hasResult && (
            <FeedbackRefineButton
              onRefine={handleRefine}
              isRefining={isRefining}
              refinement={refinement}
              canRefine={!!rating && !!resolution}
            />
          )}

          {/* Advanced view toggle */}
          {hasResult && (
            <div className="advanced-view-toggle">
              <button
                type="button"
                className="advanced-toggle-btn"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                {showAdvanced ? "Hide board deliberation" : "Show board deliberation"}
                <span className="advanced-toggle-chevron" aria-hidden>
                  {showAdvanced ? "▲" : "▼"}
                </span>
              </button>
            </div>
          )}

          {/* Secondary panels — hidden by default */}
          {showAdvanced && (
            <div className="advanced-panels">
              <BoardInsights
                advisorResponses={advisorResponses}
                debateResponses={debateResponses}
                followUpQuestions={followUpQuestions}
                followUpResponses={followUpResponses}
                errors={errors}
              />
              <HistoryPanel feedback={feedback} />
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>Board Room — multi-model advisory synthesis</p>
      </footer>
    </div>
  );
}
