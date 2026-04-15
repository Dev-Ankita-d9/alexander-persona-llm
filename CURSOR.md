# Multi-LLM Advisor Board — Cursor Rules

## Project Overview

A parallel multi-persona AI advisor board that dispatches a single user query simultaneously to multiple LLM "advisors", each shaped by a distinct system prompt. A final synthesis call aggregates all responses into a balanced recommendation. The system supports file upload context injection, persona toggling, and a feedback loop for iterative prompt refinement.

---

## Architecture

```
User Query + (optional) File Context
        │
        ▼
┌──────────────────────┐
│   Persona Selector   │  Toggle any subset of advisors on/off
└──────────────────────┘
        │
   ┌────┴────┐ (parallel calls)
   ▼         ▼         ▼
[Strategist] [Data Analyst] [Devil's Advocate] [Creative Lead] [CFO]
   │         │         │         │         │
   └────┬────┘         └────┬────┘         │
        └─────────┬──────────┘
                  ▼
        ┌──────────────────┐
        │  Synthesis Call  │  Aggregation prompt → consensus + trade-offs
        └──────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │  Feedback Loop   │  Rate → Refine → Log
        └──────────────────┘
```

---

## Advisor Personas

Each persona is defined by a `systemPrompt` string passed per API call. Never share system prompts across advisors in a single request.

| Advisor         | Role Focus                                              |
|----------------|----------------------------------------------------------|
| Strategist      | Long-term vision, market positioning, competitive moat  |
| Data Analyst    | Quantitative reasoning, metrics, evidence-based claims  |
| Devil's Advocate| Challenges assumptions, surfaces risks and blind spots  |
| Creative Lead   | Lateral thinking, UX/brand, unconventional solutions    |
| CFO             | ROI, cash flow, cost structures, financial risk         |

### System Prompt Structure (per advisor)

```js
{
  role: "system",
  content: `You are a [ROLE] on a strategic advisor board. [2–3 sentences defining 
  the lens, tone, and priorities]. Always structure your response with: 
  1) Key insight, 2) Supporting rationale, 3) One risk or caveat.`
}
```

---

## API Call Pattern

### Parallel Dispatch

All active advisors are called **simultaneously** using `Promise.all`. Never await them sequentially.

```js
const advisorCalls = activeAdvisors.map(advisor =>
  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: advisor.systemPrompt,
      messages: [
        { role: "user", content: buildUserMessage(query, fileContext) }
      ]
    })
  }).then(r => r.json())
);

const results = await Promise.all(advisorCalls);
```

### Synthesis Call

After all advisor responses resolve, make a **single** aggregation call.

```js
const synthesisPrompt = `
You are a neutral facilitator. Below are responses from ${activeAdvisors.length} 
advisors on the following question: "${query}"

${advisorResponses.map((r, i) => `## ${advisors[i].name}\n${r}`).join("\n\n")}

Produce a synthesis that:
1. Identifies areas of consensus
2. Highlights key trade-offs or disagreements
3. Offers a balanced recommendation with reasoning
Keep it under 300 words.
`;
```

---

## File Upload & Context Injection

Supported types: `.txt`, `.csv`, `.md`, `.json`, `.pdf`

- Read file contents as plain text (use `FileReader` for browser)
- Inject into **every** advisor's user message as a prefixed block:

```js
function buildUserMessage(query, fileContext) {
  if (!fileContext) return query;
  return `<uploaded_file>\n${fileContext}\n</uploaded_file>\n\n${query}`;
}
```

- For `.pdf`, extract readable text before injection (use a client-side PDF parser or send as base64 with `type: "document"` in the Anthropic API)
- Truncate file context to **~4000 tokens** max to avoid crowding persona reasoning

---

## Feedback Loop

### Rating
Each synthesis gets a thumbs up / thumbs down rating stored locally.

```js
const feedbackEntry = {
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  query,
  synthesis,
  rating,          // "helpful" | "unhelpful"
  advisorsUsed: activeAdvisors.map(a => a.name),
  refined: false
};
```

### Refinement
On "Refine with feedback", send the full context back to Claude with a meta-prompt:

```js
const refinementPrompt = `
A user rated the following synthesis as "${rating}".

Original query: "${query}"
Synthesis: "${synthesis}"
Active advisors: ${advisorsUsed.join(", ")}

Suggest specific improvements to the persona system prompts or aggregation 
logic that would produce a more useful response. Be concrete and actionable.
`;
```

### History Panel
All feedback entries are logged and displayed. Persist to `localStorage` keyed by `advisorboard_feedback`.

---

## State Management

```js
// Core state shape
{
  query: string,
  fileContext: string | null,
  fileName: string | null,
  activeAdvisors: AdvisorId[],          // subset of all 5
  advisorResponses: Record<AdvisorId, string>,
  synthesis: string | null,
  isLoading: boolean,
  loadingAdvisors: AdvisorId[],         // for per-card spinners
  feedback: FeedbackEntry[],
  error: string | null
}
```

---

## Component Structure (React)

```
<AdvisorBoard>
  ├── <QueryPanel>              # Textarea + file upload + submit
  ├── <PersonaToggleBar>        # 5 advisor chips, toggle on/off
  ├── <AdvisorGrid>             # Parallel response cards
  │     └── <AdvisorCard />     # Name, avatar, response, loading state
  ├── <SynthesisPanel>          # Aggregated result + rating buttons
  ├── <FeedbackRefineButton>    # Trigger refinement call
  └── <HistoryPanel>            # Logged feedback entries
```

---

## Error Handling

- Wrap every API call in `try/catch`
- If one advisor call fails, still proceed with remaining responses
- Mark failed advisor cards with an error state, don't block synthesis
- Show a warning if synthesis runs with fewer than 2 advisors

```js
const results = await Promise.allSettled(advisorCalls);
const successful = results
  .filter(r => r.status === "fulfilled")
  .map(r => r.value);
```

---

## Performance Rules

- **Never** await advisor calls sequentially — always `Promise.all` or `Promise.allSettled`
- Debounce the query input by 300ms if live-updating
- Cache file context in state; don't re-read on every submit
- Limit feedback history display to the last 20 entries; paginate beyond that

---

## Styling Conventions

- Each advisor has a unique accent color used consistently across toggle chip, card header, and loading indicator
- Synthesis panel uses a neutral, elevated style (no persona color)
- Loading state: per-card spinner with the advisor's accent color
- Feedback: thumbs icons, not text buttons
- History panel: collapsible, timestamped, shows advisor set used per entry

---

## Production Mapping (n8n / Node.js)

| App Layer             | Production Equivalent                              |
|-----------------------|---------------------------------------------------|
| Parallel API calls    | Parallel branches in n8n / `Promise.all` in Node  |
| Synthesis call        | Merge node → aggregation LLM call                 |
| File context          | File trigger node → text extraction → inject      |
| Feedback rating       | Webhook node → feedback DB write                  |
| Refinement call       | Loop-back branch → prompt tuning node             |
| History panel         | Database read node → frontend API                 |

---

## Do / Don't

| ✅ Do                                              | ❌ Don't                                          |
|---------------------------------------------------|----------------------------------------------------|
| Call all advisors in parallel                     | Await advisors sequentially                        |
| Give each advisor a strongly differentiated prompt| Use nearly identical system prompts                |
| Truncate file context before injection            | Inject entire files without token awareness        |
| Use `Promise.allSettled` for resilience           | Let one failed call block the whole board          |
| Log all feedback with full context                | Store only the rating without the query/synthesis  |
| Show per-advisor loading states                   | Show a single global spinner                       |
| Keep synthesis prompt neutral and structured      | Let synthesis inherit any persona bias             |