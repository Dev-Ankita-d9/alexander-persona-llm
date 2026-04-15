const MAX_RESULTS = 6;
const MAX_RELATED = 3;

function isConfigured() {
  const key = process.env.SERP_API_KEY;
  return key && !key.startsWith("your_") && key.length > 10;
}

async function searchWeb(query) {
  if (!isConfigured()) return null;

  const searchQuery = query.length > 120 ? query.slice(0, 120) : query;

  const params = new URLSearchParams({
    q: searchQuery,
    api_key: process.env.SERP_API_KEY,
    num: MAX_RESULTS + 2,
    hl: "en",
    gl: "us",
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SerpAPI ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return formatResults(data, searchQuery);
}

function formatResults(data, searchQuery) {
  const sources = [];
  const sections = [];

  if (data.knowledge_graph?.description) {
    sections.push(`## Overview\n${data.knowledge_graph.description}`);
  }

  if (data.answer_box) {
    const ab = data.answer_box;
    if (ab.answer) {
      sections.push(`## Quick Answer\n${ab.answer}`);
    } else if (ab.snippet) {
      sections.push(`## Quick Answer\n${ab.snippet}`);
    }
  }

  if (data.organic_results?.length) {
    sections.push(`## Search Results for: "${searchQuery}"`);
    data.organic_results.slice(0, MAX_RESULTS).forEach((r, i) => {
      sources.push({
        title: r.title,
        url: r.link,
        snippet: r.snippet || "",
        date: r.date || null,
      });
      const datePart = r.date ? ` (${r.date})` : "";
      sections.push(
        `${i + 1}. **${r.title}**${datePart}\n   ${r.snippet || "No description"}\n   Source: ${r.link}`
      );
    });
  }

  if (data.related_questions?.length) {
    sections.push("## People Also Ask");
    data.related_questions.slice(0, MAX_RELATED).forEach((q) => {
      const answer = q.snippet ? `: ${q.snippet}` : "";
      sections.push(`- **${q.question}**${answer}`);
    });
  }

  if (sections.length === 0) return null;

  return {
    briefing: sections.join("\n\n"),
    sources,
    searchQuery,
  };
}

module.exports = { searchWeb, isConfigured };
