const PROVIDERS = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", tier: "balanced" },
      { id: "claude-haiku-4-20250414", name: "Claude Haiku 4", tier: "fast" },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", tier: "balanced" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", tier: "fast" },
      { id: "gpt-4.1", name: "GPT-4.1", tier: "premium" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", tier: "balanced" },
    ],
  },
};

async function callAnthropic(systemPrompt, userMessage, model, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function callOpenAI(systemPrompt, userMessage, model, maxTokens) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function resolveProvider(modelId) {
  for (const provider of Object.values(PROVIDERS)) {
    if (provider.models.some((m) => m.id === modelId)) {
      return provider.id;
    }
  }
  return null;
}

async function callLLM({ systemPrompt, userMessage, model, maxTokens = 1000 }) {
  const provider = resolveProvider(model);

  if (!provider) {
    throw new Error(`Unknown model: ${model}. Could not resolve provider.`);
  }

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("your_")) {
      throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY in server/.env");
    }
    return callAnthropic(systemPrompt, userMessage, model, maxTokens);
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("your_")) {
      throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in server/.env");
    }
    return callOpenAI(systemPrompt, userMessage, model, maxTokens);
  }

  throw new Error(`Provider '${provider}' is not implemented.`);
}

module.exports = { PROVIDERS, callLLM, resolveProvider };
