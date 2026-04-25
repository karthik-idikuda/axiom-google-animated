# AXIOM Demo Datasets

Three real, public-domain datasets used by AXIOM for end-to-end demos.

| File | Source | Rows | Target | Protected attrs | Known bias |
|---|---|---|---|---|---|
| `adult_income_sample.csv` | UCI Adult Income, full at `archive.ics.uci.edu/static/public/2/adult.zip` | 500 (sampled, stratified by sex × income) | `income` (`>50K`/`<=50K` → 1/0) | `sex`, `race` | Women = 33% of dataset, only 11% of `>50K` earners |
| `compas_sample.csv` | ProPublica COMPAS, full at `github.com/propublica/compas-analysis/raw/master/compas-scores-two-years.csv` | 500 (sampled, stratified by race × is_recid) | `is_recid` (0/1) | `race`, `sex` | Black defendants flagged at ~2× rate of white (ProPublica, 2016) |
| `german_credit_sample.csv` | UCI Statlog German Credit, full at `archive.ics.uci.edu/static/public/144/statlog+german+credit+data.zip` | 1000 (full) | `credit_risk` (1=good, recoded) | `age`, `personal_status_sex` | Older / female applicants score higher risk |

## Re-download / regenerate

```bash
# Re-download raw datasets
python scripts/download_datasets.py        # writes to datasets/

# Regenerate the three demo samples (run from project root in the .venv):
source .venv/bin/activate
python -c "import pandas as pd, os; ..."   # see scripts in repo history
```

## Demo narratives for the judges

- **Adult Income** — “Real US Census data. AXIOM detects `sex` causally
  influences income prediction with CES ≈ 0.6 and auto-remediates.”
- **COMPAS** — “The exact dataset ProPublica used in 2016. AXIOM flags
  `race` CES ≈ 0.7 → CRITICAL violation of the constitution.”
- **German Credit** — “EU-style credit scoring. AXIOM finds `age` and
  `sex` paths to `credit_risk` and issues a remediation plan.”

## Upload via dashboard

1. Open `http://localhost:3000/upload`
2. Drop one of the three sample CSVs
3. Backend runs CARTOGRAPHER → graph appears under
   `Dashboard → Causal Graph` and Firebase RTDB at
   `/firestore_fallback/projects/{project_id}` (free-tier mode).
