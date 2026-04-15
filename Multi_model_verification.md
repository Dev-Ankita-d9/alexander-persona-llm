# Project Overview: Multi-LLM Advisor Board System
 
## Context
A structured AI decision system ("Advisor Board") that takes raw company data/notes and produces investor-ready one-pagers. The system should feel like a real advisory board — multiple AI personas evaluate, challenge, and refine input until the output is genuinely strong, not just polished. The project directory is currently empty; this is a greenfield build.
 
---
 
## Client Requirements Summary
 
### Core Concept
A multi-agent AI system where "board members" (AI personas) each evaluate startup/company data from their perspective, challenge each other, and produce a unified, high-quality output.
 
### Board Members (Phase 1)
| Role | Focus | Purpose |
|------|-------|---------|
| **VC / Investor** | Market size, scalability, funding logic, narrative | Evaluates investment potential |
| **Operator** | Execution realism, business model viability | Checks feasibility |
| **Skeptic / Critic** | Assumptions, weak points, gaps | Challenges everything |
 
Additions: Growth/Marketing persona, "celebrity-style" personas (e.g., Elon Musk thinking style via Grok)
 
### Processing Pipeline
```
User Input (text + files)
    |
    v
Input Parser --> Normalize into schema (problem, solution, market, traction, etc.)
    |
    v
Light Enrichment (basic context addition)
    |
    v
Use Serp API to get more context from internet if need and pass the internet data and context of user input to the board members
    |
    v
Role-Based Analysis (VC, Operator, Skeptic evaluate independently)
    |
    v
Scoring Layer (specificity, credibility, narrative strength per section)
    |
    v
Cross-Evaluation & Aggregation
  - Skeptic challenges VC claims
  - Operator validates feasibility
  - Detect contradictions & gaps
  - Output: accepted insights, rejected claims, open questions
    |
    v
Refinement Loop (2-3 passes max)
  - Only refine low-scoring sections
  - Strict improvement delta — stop if quality plateaus
  - Must not just rephrase; must actually improve substance
    |
    v
Board Chair Bot --> Synthesizes final resolution
    |
    v
Final Output: One-pager + VC-style narrative
```
 
### Scoring Mechanism
- **Dimensions**: Specificity, Credibility, Narrative Strength
- **Thresholds**: Below X = auto-refine, mid-range = conditional review, high = accept
- **Evidence tagging**: User-provided claims vs inferred vs research-enriched (higher validation bar for inferred/enriched)
- **Transparency**: Each score includes short rationale explaining why accepted/rejected
- **Role weighting**: Context-dependent (Operator dominates feasibility sections, VC dominates market/narrative, Skeptic dominates risk)
 
### UX Requirements (Client's Vision)
- **Simple ChatGPT-like interface**: Text input window + file upload + board member selector
- **Primary output**: Final board resolution (one unified answer)
- **Secondary (expandable)**: Individual board member opinions visible on demand
- **Board member identity**: Each has a name, face/avatar, distinct personality
- **Frontend**: Client builds in backend provides clean API
 
 
---
 
## Phase 1 Scope (What to Build First)
 
### Goal
Prove the system can take messy company notes and turn them into something investor-ready and non-generic.
 
### Minimum Deliverables
1. **Input parser** — Accept raw text, normalize into structured schema
2. **3 board member roles** — VC, Operator, Skeptic with distinct evaluation prompts
3. **Scoring logic** — Score each section on specificity/credibility/narrative with clear thresholds
4. **1 refinement pass** — Refine only weak sections with constraints
5. **Board Chair aggregation** — Merge into accepted/rejected/open-questions
6. **One-pager generation** — Final clean output from validated content
7. **Clean API** — For frontend to consume
 
### What to Include
- Multi-model integration (single GPT model for all roles) and antropic models
- Advanced enrichment (web research, benchmarks)
- Celebrity-style personas
- VC deck generation (one-pager only)
 
---
 
## Key Client Principles
1. **Selective, not verbose** — Weak claims must be eliminated, not just reworded
2. **Simple surface, smart backend** — User sees one clean input/output; complexity is hidden
3. **Structured disagreement** — Board members must challenge each other, not just generate parallel answers
4. **Transparency** — Every score/decision must have a rationale
5. **Bounded refinement** — Stop after 2-3 passes; flag unresolvable issues instead of over-optimizing
 
---
 
## What Needs to Be Built (Implementation Tasks)
 
### Workflow Layer
1. Main orchestration workflow: input -> parse -> evaluate -> refine -> generate
2. Sub-workflows for each board member role
3. Aggregation/Chair workflow
4. API trigger nodes for frontend integration
 
### Backend Components
1. Input schema definition (JSON structure for problem, solution, market, traction, etc.)
2. Role prompt templates (VC, Operator, Skeptic)
3. Scoring prompt + threshold logic
4. Refinement prompt with constraints
5. Aggregation logic (cross-evaluation, contradiction detection)
6. One-pager generation template
7. API endpoints exposed via or separate backend
 
### Configuration
 
1. Board member definitions (name, avatar, role description, prompt)
2. Scoring thresholds and weights
3. Refinement loop parameters
 
---
 
## Verification Plan
1. Submit sample messy company notes through the API
2. Verify schema parsing produces structured output
3. Check each board member returns distinct, role-appropriate evaluation
4. Confirm scoring flags weak/generic claims correctly
5. Verify refinement actually improves substance (not just rewording)
6. Check final one-pager is investor-ready and non-generic
7. Test API endpoints work for frontend consumption