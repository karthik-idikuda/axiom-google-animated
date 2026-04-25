# AXIOM — Algorithmic Conscience Engine

**Real-time AI fairness audit platform for Hack2skill Solution Challenge 2026 (Theme 4: Unbiased AI Decision)**

AXIOM is a runtime middleware that intercepts AI decisions before they reach users, runs them through a causal fairness pipeline, and generates cryptographically-signed fairness audits. Using real causal discovery (DirectLiNGAM), constitution-based enforcement (Gemini 3.1 Pro), and observed evidence from uploaded datasets, AXIOM reports only measured values. When a score cannot be computed from data, it is displayed as "Not measured".

## Quick Start

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Google Cloud project with Vertex AI + Firebase enabled
- Google credentials supplied through `GOOGLE_APPLICATION_CREDENTIALS`
  pointing to a private path outside any public repo

### 2. Backend Setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn backend.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start
```

### 4. Download Datasets
```bash
python scripts/download_datasets.py
```

## 🎯 Hack2skill Alignment

**Problem Statement:** "Ensure Fairness and Detect Bias in Automated Decisions"  
**Our Solution:** AXIOM detects bias through:
- Real causal discovery (DirectLiNGAM) from uploaded datasets
- Runtime decision interception (API middleware)
- Fairness constitution parsing (Gemini 3.1 Pro)
- PDF audit certificates with bias DNA tracing
- Real-time metrics dashboard with temporal drift monitoring

**Evaluation Mapping:**
- **Technical Merit (40%)**: LangGraph + DirectLiNGAM + Gemini 3.1 + Firebase = production-grade causal AI
- **Innovation (25%)**: First real-time runtime fairness middleware with constitution enforcement
- **Alignment (25%)**: Directly addresses problem statement: detect bias BEFORE decisions reach users
- **UX (10%)**: Material Design with Google colors, smooth animations, live Firebase feeds

---

## 🏗️ Architecture

**6-Agent LangGraph Pipeline** (all agents use real data only):

1. 📊 Data Integrity Guarantee

✅ **No Fake Data** — Every decision, metric, and recommendation is measured:
- ✅ Graph edges come from DirectLiNGAM (real causal discovery)
- ✅ Metrics computed from real uploaded dataset statistics
- ✅ Counterfactuals generated from observed nearest-match pairs only
- ✅ Fairness scores reported as `null` / "Not measured" if insufficient data
- ✅ Remediation shown as recommendation only (not claimed as automatic fix)
- ✅ PDF certificates issued ONLY for decisions that pass measured thresholds

## 🚀 Deploy to Google Cloud Run

```bash
# 1. Create GCP project and enable APIs
gcloud projects create axiom-conscience
gcloud services enable aiplatform.googleapis.com firebasemanagement.googleapis.com cloudbuild.googleapis.com run.googleapis.com

# 2. Create service account
gcloud iam service-accounts create axiom-sa
gcloud iam service-accounts keys create axiom-sa-key.json \
  --iam-account=axiom-sa@axiom-conscience.iam.gserviceaccount.com

# 3. Deploy backend
gcloud run deploy axiom-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi --cpu 2 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=axiom-conscience,GEMINI_MODEL=gemini-3.1-pro-preview,GEMINI_THINKING_LEVEL=HIGH

# 4. Deploy frontend to Firebase Hosting
firebase deploy --only hosting
```

## 📚 Real Datasets Included

| Dataset | Rows | Protected Attrs | Known Bias | Source |
|---------|------|-----------------|-----------|--------|
| `adult_income_sample.csv` | 500 | gender, race | Women 33% of data but 11% of >50K earners | UCI ML Repository |
| `compas_sample.csv` | 500 | race, gender | Black defendants flagged 2× more often (ProPublica) | ProPublica investigation |
| `german_credit_sample.csv` | 500 | age, gender | Older applicants, women receive higher risk scores | StatLog dataset |

Each sample is stratified to preserve the real bias patterns for accurate causal discovery.

## 🔐 Security & Credentials

- **Never commit credentials**: `GOOGLE_APPLICATION_CREDENTIALS` points to a path outside the repo
- **Firebase rules**: Lockdown RTDB/Firestore to authenticated users only before production
- **Model thinking**: Gemini 3.1 Pro uses extended reasoning (thinking_level=HIGH) for rigorous fairness analysis
- **Audit trail**: All decisions logged to Firestore for compliance and reviewo fake data: every graph edge, metric, and recommendation comes from real LiNGAM output or Firebase records
- Graceful degradation: Firebase can be disabled; reports write locally instead
- Real datasets: UCI Adult Income, ProPublica COMPAS, StatLog German Credit

See `.vscode/axiom.agent.md` for complete architecture rules and agent specifications.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/upload` | Upload dataset, trigger CARTOGRAPHER |
| POST | `/api/v1/intercept` | Run full pipeline on one decision |
| POST | `/api/v1/constitution` | Save org fairness constitution |
| GET  | `/api/v1/report/{session_id}` | Get audit report |
| GET  | `/api/v1/metrics/{project_id}` | Live fairness metrics |

## Deploy

```bash
gcloud run deploy axiom-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi --cpu 2 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=axiom-conscience
```
