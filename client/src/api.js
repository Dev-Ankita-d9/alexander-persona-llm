const API_BASE = "/api";

export async function deliberate(params, onEvent) {
  let fetchOptions;

  if (params.file) {
    const formData = new FormData();
    formData.append("query", params.query);
    formData.append("activeAdvisors", JSON.stringify(params.activeAdvisors));
    formData.append("advisorModels", JSON.stringify(params.advisorModels || {}));
    if (params.synthesisModel) formData.append("synthesisModel", params.synthesisModel);
    formData.append("outputFormat", params.outputFormat || "structured-memo");
    if (params.pastDecisions?.length) formData.append("pastDecisions", JSON.stringify(params.pastDecisions));
    formData.append("file", params.file);
    fetchOptions = { method: "POST", body: formData };
  } else {
    fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, outputFormat: params.outputFormat || "structured-memo" }),
    };
  }

  const res = await fetch(`${API_BASE}/advisors/deliberate`, fetchOptions);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop();

    for (const part of parts) {
      if (!part.trim()) continue;
      const lines = part.split("\n");
      let eventType = null;
      let eventData = null;

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          try {
            eventData = JSON.parse(line.slice(6));
          } catch {}
        }
      }

      if (eventType && eventData) {
        console.log(`[Board] ${eventType}`, eventData);
        onEvent(eventType, eventData);
      }
    }
  }
}

export async function deliberateFollowup({ originalQuery, previousDecision, answers, activeAdvisors, synthesisModel }) {
  const res = await fetch(`${API_BASE}/advisors/deliberate-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originalQuery, previousDecision, answers, activeAdvisors, synthesisModel }),
  });
  if (!res.ok) throw new Error("Follow-up refinement failed");
  return res.json();
}

export async function generateEmailDraft({ decision, query, model }) {
  const res = await fetch(`${API_BASE}/advisors/email-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, query, model }),
  });
  if (!res.ok) throw new Error("Email draft generation failed");
  return res.json();
}

export async function refineWithFeedback({
  query,
  synthesis,
  rating,
  advisorsUsed,
  model,
}) {
  const res = await fetch(`${API_BASE}/advisors/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, synthesis, rating, advisorsUsed, model }),
  });
  if (!res.ok) throw new Error("Refinement failed");
  return res.json();
}

export async function submitFeedback(entry) {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error("Feedback submission failed");
  return res.json();
}

export async function getFeedbackHistory() {
  const res = await fetch(`${API_BASE}/feedback`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export async function deleteFeedback(id) {
  const res = await fetch(`${API_BASE}/feedback/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete entry");
  return res.json();
}

export async function clearAllFeedback() {
  const res = await fetch(`${API_BASE}/feedback`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear history");
  return res.json();
}

export async function getScoringConfig() {
  const res = await fetch(`${API_BASE}/scoring-config`);
  if (!res.ok) throw new Error("Failed to load scoring config");
  return res.json();
}

export async function updateScoringConfig(partial) {
  const res = await fetch(`${API_BASE}/scoring-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error("Failed to update scoring config");
  return res.json();
}

export async function resetScoringConfig() {
  const res = await fetch(`${API_BASE}/scoring-config/reset`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to reset scoring config");
  return res.json();
}
