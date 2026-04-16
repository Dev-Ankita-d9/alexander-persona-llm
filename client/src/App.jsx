import { useState, useEffect, useCallback } from "react";
import { ADVISORS, SYNTHESIS_MODEL, getAdvisorModelsMap } from "./advisors";
import {
  deliberate,
  refineWithFeedback,
  submitFeedback,
  getFeedbackHistory,
} from "./api";
import QueryPanel from "./components/QueryPanel";
import PersonaToggleBar from "./components/PersonaToggleBar";
import DeliberationProgress from "./components/DeliberationProgress";
import ResolutionPanel from "./components/ResolutionPanel";
import BoardInsights from "./components/BoardInsights";
import FeedbackRefineButton from "./components/FeedbackRefineButton";
import HistoryPanel from "./components/HistoryPanel";
import OnePagerPanel from "./components/OnePagerPanel";
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
  const [activeAdvisors, setActiveAdvisors] = useState(
    ADVISORS.map((a) => a.id)
  );
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
  const [feedback, setFeedback] = useState([]);
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

  const handleSubmit = useCallback(
    async ({ query: q, file }) => {
      setQuery(q);
      setIsDeliberating(true);
      setCurrentStage(null);
      setAdvisorResponses({});
      setDebateResponses({});
      setFollowUpQuestions({});
      setFollowUpResponses({});
      setResearchSources([]);
      setOnePager(null);
      setResolution(null);
      setDecision(null);
      setErrors({});
      setWarnings([]);
      setRating(null);
      setRefinement(null);
      setGlobalError(null);

      try {
        await deliberate(
          {
            query: q,
            activeAdvisors,
            file: file || undefined,
            advisorModels: ADVISOR_MODELS,
            synthesisModel: SYNTHESIS_MODEL,
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
    [activeAdvisors]
  );

  const handleRate = useCallback(
    async (r) => {
      setRating(r);
      const entry = {
        id: crypto.randomUUID(),
        query,
        synthesis: resolution,
        rating: r,
        advisorsUsed: activeAdvisors.map(
          (id) => ADVISORS.find((a) => a.id === id)?.name || id
        ),
      };
      try {
        await submitFeedback(entry);
        const history = await getFeedbackHistory();
        setFeedback(history);
      } catch {}
    },
    [query, resolution, activeAdvisors]
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

      <main className="app-main app-main--mockup">
        <section className="app-input-stack app-input-stack--mockup" aria-label="Question and board">
          <QueryPanel onSubmit={handleSubmit} isLoading={isDeliberating} />
          <div className="persona-shell persona-shell--mockup">
            <PersonaToggleBar
              advisors={ADVISORS}
              activeAdvisors={activeAdvisors}
              onToggle={handleToggle}
            />
          </div>
        </section>

        {globalError && (
          <div className="global-error" role="alert">
            <span className="global-error-icon" aria-hidden="true">
              !
            </span>
            {globalError}
          </div>
        )}

        {isDeliberating && (
          <DeliberationProgress
            currentStage={currentStage}
            isDeliberating={isDeliberating}
          />
        )}

        <div
          className={`app-outcomes${isDeliberating ? " app-outcomes--busy" : ""}`}
        >
          <ResolutionPanel
            resolution={resolution}
            decision={decision}
            warnings={warnings}
            researchSources={researchSources}
            onRate={handleRate}
            currentRating={rating}
          />

          <OnePagerPanel onePager={onePager} />

          <FeedbackRefineButton
            onRefine={handleRefine}
            isRefining={isRefining}
            refinement={refinement}
            canRefine={!!rating && !!resolution}
          />

          <BoardInsights
            advisorResponses={advisorResponses}
            debateResponses={debateResponses}
            followUpQuestions={followUpQuestions}
            followUpResponses={followUpResponses}
            errors={errors}
          />

          <HistoryPanel feedback={feedback} />
        </div>
      </main>

      <footer className="app-footer">
        <p>Board Room — multi-model advisory synthesis</p>
      </footer>
    </div>
  );
}
