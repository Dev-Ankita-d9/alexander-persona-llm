# Multi-LLM Advisor Board

A parallel multi-persona AI advisor board that dispatches a single user query simultaneously to multiple LLM "advisors", each shaped by a distinct system prompt. A synthesis call aggregates all responses into a balanced recommendation.

## Quick Start

### 1. Configure API Key

Edit `server/.env` and set your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...your-key-here
```

### 2. Install Dependencies

```bash
# From the root directory
cd server && npm install
cd ../client && npm install
```

### 3. Run the Application

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

The app will be available at `http://localhost:5173`.

## Architecture

- **Frontend:** React + Vite, styled with custom CSS (dark theme)
- **Backend:** Node.js + Express
- **LLM:** Anthropic Claude API (parallel dispatch via `Promise.allSettled`)

## Advisors

| Advisor          | Focus                                     |
|-----------------|-------------------------------------------|
| Strategist       | Long-term vision, market positioning      |
| Data Analyst     | Quantitative reasoning, metrics           |
| Devil's Advocate | Challenges assumptions, surfaces risks    |
| Creative Lead    | Lateral thinking, unconventional solutions|
| CFO              | ROI, cash flow, financial risk            |

## Features

- Parallel advisor dispatch with per-card loading states
- File upload context injection (.txt, .csv, .md, .json, .pdf)
- Synthesis aggregation across all advisor responses
- Thumbs up/down feedback with history
- Refinement loop for prompt improvement suggestions
- Responsive dark-themed UI
