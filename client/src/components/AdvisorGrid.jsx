import { ADVISORS } from "../advisors";
import AdvisorCard from "./AdvisorCard";

export default function AdvisorGrid({
  activeAdvisors,
  advisorResponses,
  errors,
  loadingAdvisors,
}) {
  const visibleAdvisors = ADVISORS.filter((a) => activeAdvisors.includes(a.id));

  if (visibleAdvisors.length === 0) {
    return (
      <div className="advisor-grid-empty">
        Select at least one advisor to get started.
      </div>
    );
  }

  return (
    <div className="advisor-grid" data-count={visibleAdvisors.length}>
      {visibleAdvisors.map((advisor) => (
        <AdvisorCard
          key={advisor.id}
          advisor={advisor}
          response={advisorResponses[advisor.id]}
          error={errors[advisor.id]}
          isLoading={loadingAdvisors.includes(advisor.id)}
        />
      ))}
    </div>
  );
}
