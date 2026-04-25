# AXIOM — Deploy & Usage Guide

## 0. What is this?

**AXIOM Conscience Engine** is a real-time fairness layer for AI decisions. You point any AI/ML system at it via one HTTP call (`POST /api/v1/intercept`), and AXIOM:

1. Discovers the **causal graph** of your dataset (DirectLiNGAM)
2. Generates **counterfactuals** to detect causal bias
3. Checks each decision against your **plain-English fairness constitution** (parsed by the configured Gemini model; default `gemini-3.1-pro-preview` on the global Vertex AI endpoint)
4. Produces measured **remediation recommendations** and emits a **PDF audit report**
5. Streams everything to a **live Material 3 dashboard**

**Stack:** Gemini · Firebase Realtime DB · Cloud Run · Firebase Hosting · Cloud Build · Material 3.

---

## 1. Local development

### Quick start (recommended)

```bash
cd axiom
./run.sh               # installs deps + starts backend + frontend
```

Or step-by-step:

```bash
# one-time
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..

# run
source .venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload   # backend
cd frontend && PORT=3000 npm start                               # frontend
```

Open http://localhost:3000.

---

## 2. How to use the app (5-minute walkthrough)

### Step 1 — Pick a project ID
Top-right of the appbar there is a **project picker** (folder icon). Type any name, e.g. `compas-recidivism`. This name is shared across all pages and persisted in `localStorage`.

### Step 2 — Upload a dataset
Go to **Upload Dataset** → drop a CSV → click **Analyze Dataset**.
AXIOM runs DirectLiNGAM, asks Gemini to identify protected attributes (race, sex, age, etc.), and stores the causal graph.

Sample datasets are provided in `datasets/`:
- `compas_sample.csv` (criminal-justice recidivism)
- `adult_income_sample.csv` (income prediction)
- `german_credit_sample.csv` (loan approval)

### Step 3 — Write a fairness constitution
Go to **Constitution** → write rules in plain English, e.g.:

> Race must have zero causal influence on recidivism predictions.
> Age cannot be the sole driver of HIGH_RISK classifications.

Click **Save Constitution** → Gemini converts each line into a structured causal constraint with severity (CRITICAL / HIGH / MEDIUM / LOW).

### Step 4 — Intercept decisions
Send your model's decisions to AXIOM:

```bash
curl -X POST http://localhost:8000/api/v1/intercept \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "compas-recidivism",
    "decision_record": {
      "applicant_id": "A001",
      "race": "African-American",
      "sex": "Male",
      "age": 25,
      "priors_count": 2,
      "decile_score": 7,
      "decision": "HIGH_RISK"
    }
  }'
```

The response contains `verdict` (PASS/FAIL), `severity_score`, measured `bias_evidence`, observed-match evidence when available, `remediation_recommendation`, and a link to the PDF audit report.

### Step 5 — Watch the dashboard
The **Dashboard** auto-refreshes every 5 s. It shows real metrics computed from your decisions:
- Total / Flagged / Remediated counts
- Fairness Score = average of measured decision scores only. AXIOM does not derive fairness from severity.
- Drift chart (rolling fairness over time, bucketed)
- Causal graph (red dashed edges = biased causal paths)
- Decision log (click any row -> PDF audit report)

### Step 6 — Wipe project data
Dashboard -> **Clear Data** removes stored decisions, reports, constitution, and causal graph for the current project from Firebase.

---

## 3. Deploy to Google Cloud

> **Note:** Cloud Run requires **billing enabled** on the GCP project (your usage will stay in the always-free tier: 2 M requests/month, 360 K GB-s/month, 180 K vCPU-s/month). Firebase Hosting is free.

### One-time setup

```bash
gcloud auth login
gcloud config set project gen-lang-client-0976545577
firebase login

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebasehosting.googleapis.com
```

### Deploy everything

```bash
./run.sh deploy          # backend + frontend
```

Or manually:

```bash
./run.sh backend         # start backend only (local)
./run.sh frontend        # start frontend only (local)
./run.sh test            # run full smoke test
```

The script:
1. Builds the Docker image with **Cloud Build** → pushes to GCR
2. Deploys to **Cloud Run** (`us-central1`, 2 GiB / 2 vCPU, scale-to-zero) with all env vars set
3. Builds the React app with `REACT_APP_API_URL` pointing to your Cloud Run URL
4. Deploys to **Firebase Hosting**

URLs after deploy:
- Backend: `https://axiom-backend-<hash>-uc.a.run.app`
- Frontend: `https://gen-lang-client-0976545577.web.app`

### Manual alternative

```bash
# backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/axiom-backend -f docker/Dockerfile.backend .
gcloud run deploy axiom-backend --image gcr.io/$PROJECT_ID/axiom-backend \
  --region us-central1 --allow-unauthenticated --memory 2Gi --cpu 2

# frontend
cd frontend && REACT_APP_API_URL=<cloud-run-url> npm run build && cd ..
firebase deploy --only hosting
```

---

## 4. API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health + config introspection |
| POST | `/api/v1/upload` (multipart) | Upload CSV → causal graph |
| POST | `/api/v1/constitution` | Save plain-English fairness rules |
| GET | `/api/v1/constitution/{project_id}` | Read constitution |
| POST | `/api/v1/intercept` | Run a decision through the AXIOM pipeline |
| GET | `/api/v1/decisions/{project_id}` | List decisions (newest first) |
| GET | `/api/v1/metrics/{project_id}` | Live metrics computed from real decisions |
| GET | `/api/v1/causal_graph/{project_id}` | Get causal graph + protected attributes |
| GET | `/api/v1/report/{session_id}` | Get full audit report |
| **DELETE** | `/api/v1/project/{project_id}` | **Wipe all data for a project** |

---

## 5. Free-tier feature flags

These env vars in `.env` keep the project on the **fully free tier** (no billing, no Firestore, no GCS):

```ini
AXIOM_DISABLE_FIRESTORE=1   # falls back to RTDB under /firestore_fallback/*
AXIOM_DISABLE_STORAGE=1     # PDFs saved to ./reports, served at /reports/*
GOOGLE_GENAI_USE_VERTEXAI=False  # use AI Studio API key instead of Vertex
```

For production, flip them to `0` and set `FIREBASE_STORAGE_BUCKET` + `GOOGLE_GENAI_USE_VERTEXAI=True`.
