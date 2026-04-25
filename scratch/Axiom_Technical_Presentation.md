# Axiom Fairness Platform: Technical Presentation

## Slide 1: Title Slide
**Title:** Axiom Fairness Platform
**Subtitle:** Causal AI for Real-Time Bias Auditing & Remediation
**Speaker:** Karthik
**Objective:** Transitioning from correlational metrics to formal causal fairness in production AI systems.

---

## Slide 2: The Core Philosophy
**Correlational vs. Causal Fairness**
- **The Problem:** Traditional ML fairness relies on correlation (e.g., demographic parity). This often fails because it penalizes valid predictors that happen to correlate with sensitive attributes (Simpson's Paradox).
- **The Axiom Solution:** Axiom uses **Causal Inference**. We don't just ask "Are predictions different for group A vs group B?" We ask: *"Does the protected attribute causally force the outcome to change?"*
- **Key Advantage:** We can mathematically isolate the exact edge in the decision tree causing the bias and surgically alter it, rather than blindly adjusting the final score.

---

## Slide 3: System Architecture Overview
**High-Level Tech Stack**
- **Frontend:** React (Vite) + CSS Modules (Custom Design System)
- **Backend:** Python + FastAPI + LangGraph
- **Data Persistence:** Firebase Realtime Database (RTDB) & Firestore (Fallback)
- **LLM Engine:** Gemini AI (for Constitution Parsing & Audit Summaries)
- **Causal Engine:** `lingam` (DirectLiNGAM) & `networkx`

**Architecture Diagram Flow:**
1. User uploads dataset via React UI.
2. FastAPI intercepts data and triggers the 6-Agent LangGraph Pipeline.
3. Graph relationships are calculated and persisted in Firebase.
4. Dashboard continuously polls RTDB for live audited decisions.

---

## Slide 4: The 6-Agent LangGraph Pipeline
Axiom processes every intercepted AI decision through a sequential graph of 6 autonomous agents:

1. **SENTINEL (Interceptor):** Captures incoming decision records and stamps them with unique UUIDs.
2. **CARTOGRAPHER (Mapper):** Builds the causal graph using DirectLiNGAM. Identifies the exact mathematical pathways connecting features to outcomes.
3. **ORACLE (Evidence Gatherer):** Extracts edge weights and computes the direct causal effect of protected attributes on the outcome.
4. **JUDGE (Enforcer):** Compares ORACLE's evidence against the Fairness Constitution. Verdict is "PASS" or "FAIL".
5. **SURGEON (Remediator):** If a decision fails, Surgeon computes the required mathematical perturbation (inverse causal shift) to render the decision fair.
6. **SCRIBE (Auditor):** Generates a final Markdown/PDF audit report detailing the exact fairness scores before and after remediation.

---

## Slide 5: Mathematical Foundations
**DirectLiNGAM (Linear Non-Gaussian Acyclic Model)**
Axiom models the dataset as a system of linear equations:
`x = Bx + e`
Where:
- `x` = Feature vector
- `B` = Adjacency matrix representing causal connection weights
- `e` = Continuous non-Gaussian exogenous noise

**Fairness Scoring Formula**
The fairness score is inversely proportional to the absolute causal effect of the protected attribute on the outcome.
`Fairness_Score = max(0.0, min(100.0, (1.0 - abs(causal_effect)) * 100.0))`
- *Threshold:* By default, Axiom flags a decision if `causal_effect > 0.05`.

---

## Slide 6: The AI Fairness Constitution
**Bridging Legal and Technical Domains**
- Users define organizational ethics in plain English (e.g., *"Gender and race must not influence income predictions"*).
- Axiom utilizes Gemini AI to parse this into a structured JSON schema.
- **Data Schema:**
  - `rule_id`: String
  - `protected_attribute`: Mapped directly to the dataset's exact column name (e.g., "sex").
  - `allowed_causal_influence`: Float (default 0.0)
  - `severity_if_violated`: "CRITICAL", "HIGH", "MEDIUM", "LOW"

---

## Slide 7: Live Interception & Dashboard Monitoring
- **Real-Time Polling:** The React dashboard uses a 5-second asynchronous polling loop to fetch the latest decisions from Firebase RTDB.
- **Deep State Comparison:** Implemented deep-equality checks to prevent unnecessary D3.js causal graph re-renders.
- **Batch Auditing:** When deploying a new dataset, Axiom's `batchAudit` protocol automatically analyzes the first N records to immediately baseline the Fairness Drift graph.
- **Metrics Tracked:** Total Decisions, Flagged Violations, Applied Remediations, and Average Fairness Score.

---

## Slide 8: Real-World Use Cases Verified
Axiom comes pre-configured to detect bias in three critical open-source datasets:
1. **Adult Income (Census):** 32k+ rows. Checks for gender/race bias in income bracket predictions.
2. **COMPAS (Recidivism):** 7k+ rows. Uncovers deep-rooted racial bias in criminal justice risk scores.
3. **German Credit:** 1k+ rows. Prevents sex and age from unfairly impacting loan approvals.

---

## Slide 9: Conclusion & Production Readiness
- **Robustness:** No simulated or "fake" data is used. Every metric, graph edge, and score is derived from actual Pandas dataframe calculations and DirectLiNGAM outputs.
- **Scalability:** The pipeline is structured for serverless deployment via FastAPI. Firebase handles real-time concurrency.
- **Auditability:** Every intercepted decision is backed by a generated PDF report detailing the causal reasoning, bridging the gap between AI black boxes and regulatory compliance.
