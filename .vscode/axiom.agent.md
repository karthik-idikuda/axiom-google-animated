---
description: AXIOM - real-data AI fairness audit platform
applyTo: "**"
---

# AXIOM Agent Instructions

Build AXIOM for Solution Challenge 2026 India, Track 04: Unbiased AI Decision.
The project must satisfy the hackathon priorities: technical merit, Google AI
integration, performance/scalability, security/privacy, user experience, cause
alignment, and innovation.

## Current Product Contract

AXIOM is a real-time AI fairness review gateway. It uploads real CSV datasets,
discovers causal signals with DirectLiNGAM, parses plain-English fairness
policies with Gemini, audits intercepted decisions, writes Firebase records, and
generates PDF audit reports.

Important: do not claim legal proof, guaranteed causality, "world first", or
automatic fairness correction unless the code has measured evidence for it.

## Absolute No-Fake Rules

- No seeded dashboard data.
- No mock decisions, mock graph edges, mock rules, or invented metrics.
- No assumed fairness improvement after remediation.
- If a score cannot be measured, store and display `null` / "Not measured".
- Use only real Firebase records, uploaded datasets, LiNGAM outputs, observed
  matches, Gemini responses, and generated reports.
- Keep credentials out of the repo. Use `GOOGLE_APPLICATION_CREDENTIALS` pointing
  to a private path outside public source control.

## Model Rules

- Default Vertex AI model: `gemini-3.1-pro-preview`.
- Location: `global`.
- SDK: `google-genai>=1.51.0`.
- Set `GEMINI_THINKING_LEVEL=HIGH` for advanced reasoning tasks.
- Preserve `GEMINI_MODEL` as an environment variable so the project can fall
  back to stable models if preview access is unavailable.

## Agent Pipeline

1. `sentinel` logs the intercepted decision.
2. `cartographer` builds or loads the dataset causal graph.
3. `oracle` measures bias evidence only:
   - DirectLiNGAM protected-attribute edge to the inferred outcome.
   - Nearest observed matches from the uploaded dataset when available.
4. `judge` compares measured evidence with Gemini-parsed constitution rules.
5. `surgeon` produces recommendation-only remediation unless a verified corrected
   model output exists.
6. `scribe` reports measured values only and issues certificates only for passing,
   measured audits above threshold.

## UI Rules

- Google Material style, solid colors only, no gradients.
- Use Google colors: blue `#1A73E8`, red `#EA4335`, yellow `#FBBC04`,
  green `#34A853`.
- Use motion for entry, hover, graph reveal, and chart transitions.
- Empty states must stay empty until real API/Firebase data exists.
- Do not show sample/demo records as live product data.

## Validation Before Final

Run:

```bash
.venv/bin/python -m py_compile backend/main.py backend/agents/*.py backend/services/*.py backend/utils/*.py backend/graph/*.py
cd frontend && npm run build
```

Then verify:

- `/health` returns the configured model and app flags.
- Dashboard starts empty for unknown projects.
- Upload results come only from `/api/v1/upload`.
- Metrics are averaged only from measured decision scores.
