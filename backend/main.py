"""AXIOM FastAPI entry point."""
from __future__ import annotations

import logging
import os
import tempfile
import uuid

import pandas as pd

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from firebase_admin import db
from pydantic import BaseModel

from backend import config
from backend.agents import cartographer
from backend.graph.axiom_graph import run_axiom_pipeline
from backend.services import firebase_service, gemini_service
from backend.state import AxiomState

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
log = logging.getLogger("axiom.api")

app = FastAPI(title="AXIOM", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local PDF reports when Cloud Storage is disabled
os.makedirs(config.LOCAL_REPORTS_DIR, exist_ok=True)
app.mount(
    "/reports",
    StaticFiles(directory=config.LOCAL_REPORTS_DIR),
    name="reports",
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class ConstitutionPayload(BaseModel):
    project_id: str
    rules_text: str


class InterceptPayload(BaseModel):
    project_id: str
    decision_record: dict
    session_id: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"service": "axiom", "status": "ok"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": config.GEMINI_MODEL,
        "version": "1.0.0",
        "vertexai": config.USE_VERTEXAI,
        "firestore_enabled": not config.DISABLE_FIRESTORE,
        "storage_enabled": not config.DISABLE_STORAGE,
    }


@app.get("/api/v1/decisions/{project_id}")
def list_decisions(project_id: str, limit: int = 100):
    """Return recent decisions for a project, newest first."""
    try:
        items = firebase_service.list_decisions(project_id, limit=limit)
    except Exception as e:
        log.warning("list_decisions failed: %s", e)
        items = []
    return {"project_id": project_id, "decisions": items}


@app.post("/api/v1/upload")
async def upload_dataset(
    project_id: str = Form(...), file: UploadFile = File(...)
):
    """Upload CSV, save to Cloud Storage, run CARTOGRAPHER."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files supported")
    tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False)
    tmp.write(await file.read())
    tmp.close()

    gcs_path = tmp.name  # local fallback
    try:
        gcs_path = firebase_service.upload_dataset(tmp.name, f"{project_id}/{file.filename}")
    except Exception as e:
        log.warning("GCS upload failed, using local path: %s", e)

    state: AxiomState = {"project_id": project_id, "dataset_path": gcs_path}
    state = cartographer.run(state)

    return {
        "project_id": project_id,
        "dataset_path": gcs_path,
        "protected_attributes": state.get("protected_attributes", []),
        "outcome_column": state.get("outcome_column"),
        "num_nodes": state.get("causal_graph").number_of_nodes()
            if state.get("causal_graph") is not None else 0,
        "num_edges": state.get("causal_graph").number_of_edges()
            if state.get("causal_graph") is not None else 0,
    }


@app.post("/api/v1/batch_audit/{project_id}")
async def batch_audit(project_id: str, count: int = 10):
    """Audit the first N rows of a project's dataset to populate the dashboard."""
    try:
        meta = firebase_service.read_causal_graph(project_id)
        if not meta or not meta.get("dataset_path"):
            raise HTTPException(404, "Project dataset not found")
        
        path = meta["dataset_path"]
        df = None
        if path.startswith("gs://"):
            tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False).name
            firebase_service.download_dataset(path, tmp)
            df = pd.read_csv(tmp)
        else:
            df = pd.read_csv(path)
            
        rows = df.head(count).to_dict(orient="records")
        results = []
        for i, row in enumerate(rows):
            session_id = f"batch-{project_id}-{i}"
            # Create a decision intercept
            initial: AxiomState = {
                "session_id": session_id,
                "project_id": project_id,
                "decision_record": row,
            }
            # Run pipeline asynchronously for speed (or just await them)
            res = await run_axiom_pipeline(initial)
            
            # CRITICAL: Save decision to Firebase immediately
            decision_record = {
                "session_id": session_id,
                "timestamp": res.get("timestamp"),
                "verdict": res.get("verdict"),
                "severity_score": res.get("severity_score"),
                "violated_rule_id": res.get("violated_rule_id"),
                "remediated_decision": res.get("remediated_decision"),
                "fairness_score_before": res.get("fairness_score_before"),
                "fairness_score_after": res.get("fairness_score_after"),
            }
            try:
                firebase_service.write_decision(session_id, decision_record)
            except Exception as e:
                log.warning("Failed to save batch decision %s: %s", session_id, e)
            
            results.append({
                "uuid": session_id,
                "verdict": res.get("verdict"),
                "score": res.get("fairness_score_after") or res.get("fairness_score_before")
            })
        
        log.info("Batch audit completed: %d decisions saved to Firebase", len(results))
        return {"project_id": project_id, "processed": len(results), "results": results}
    except Exception as e:
        log.error("Batch audit failed: %s", e)
        raise HTTPException(500, str(e))


@app.post("/api/v1/intercept")
async def intercept(payload: InterceptPayload):
    session_id = payload.session_id or str(uuid.uuid4())
    decision_record = dict(payload.decision_record or {})
    # Keep a stable session/report id across the full pipeline.
    decision_record.setdefault("uuid", session_id)
    initial: AxiomState = {
        "session_id": session_id,
        "project_id": payload.project_id,
        "decision_record": decision_record,
    }
    final = await run_axiom_pipeline(initial)

    # Strip non-JSON-safe fields (networkx graph, numpy arrays) for HTTP response
    safe = {
        "session_id": session_id,
        "timestamp": final.get("timestamp"),
        "pipeline_status": final.get("pipeline_status"),
        "verdict": final.get("verdict"),
        "violated_rule": final.get("violated_rule"),
        "violated_rule_id": final.get("violated_rule_id"),
        "severity_score": final.get("severity_score"),
        "protected_attributes": final.get("protected_attributes"),
        "causal_bias_detected": final.get("causal_bias_detected"),
        "counterfactual_delta": final.get("counterfactual_delta"),
        "bias_evidence": final.get("bias_evidence"),
        "max_protected_causal_effect": final.get("max_protected_causal_effect"),
        "analysis_notes": final.get("analysis_notes"),
        "counterfactuals": final.get("counterfactuals"),
        "remediated_decision": final.get("remediated_decision"),
        "remediation_method": final.get("remediation_method"),
        "remediation_recommendation": final.get("remediation_recommendation"),
        "fairness_score_before": final.get("fairness_score_before"),
        "fairness_score_after": final.get("fairness_score_after"),
        "fairness_score_source": final.get("fairness_score_source"),
        "certificate_issued": final.get("certificate_issued"),
        "audit_report": final.get("audit_report"),
        "pdf_url": final.get("pdf_url"),
    }
    safe = firebase_service._json_safe(safe)
    
    # CRITICAL: Save decision to Firebase before returning
    try:
        firebase_service.write_decision(session_id, safe)
        log.info("Decision saved to Firebase: %s", session_id)
    except Exception as e:
        log.error("Failed to save decision to Firebase: %s", e)
    
    return safe


@app.post("/api/v1/constitution")
def save_constitution(payload: ConstitutionPayload):
    if not payload.rules_text.strip():
        raise HTTPException(400, "Rules text cannot be empty")
    
    try:
        # Try to get existing columns to help Gemini map rule attributes
        project_meta = firebase_service.read_causal_graph(payload.project_id)
        cols = project_meta.get("feature_names") if project_meta else None
        
        parsed = gemini_service.parse_constitution(payload.rules_text, column_names=cols)
        if not parsed or not isinstance(parsed, list):
            log.warning("Gemini returned empty or invalid rules for: %s", payload.rules_text)
            parsed = gemini_service.parse_constitution_fallback(payload.rules_text, column_names=cols)
    except Exception as e:
        log.warning("parse_constitution failed: %s; using fallback", e)
        parsed = gemini_service.parse_constitution_fallback(payload.rules_text, column_names=cols)

    try:
        firebase_service.write_constitution(payload.project_id, payload.rules_text, parsed)
    except Exception as e:
        log.error("Firebase write failed: %s", e)
        raise HTTPException(500, f"Firebase write failed: {e}")
    
    return {"project_id": payload.project_id, "parsed": parsed}


@app.get("/api/v1/constitution/{project_id}")
def get_constitution(project_id: str):
    doc = firebase_service.read_constitution(project_id)
    if not doc:
        # Return default constitution instead of 404 to support offline/demo UX
        default_text = getattr(config, "DEFAULT_CONSTITUTION", "Protected attributes must not causally influence final decisions.")
        return {
            "rules_text": default_text,
            "parsed": [],
            "parsed_rules": [],
            "updated_at": None,
        }
    return doc


@app.get("/api/v1/report/{session_id}")
def get_report(session_id: str):
    try:
        doc = firebase_service.read_report(session_id)
    except Exception as e:
        log.warning("read_report failed for %s, falling back to decision: %s", session_id, e)
        doc = None
    if doc:
        return doc

    # Fallback: if a standalone audit report doc is missing, return
    # the decision snapshot so report page still renders instead of 404.
    decision = firebase_service.read_decision(session_id)
    if decision:
        safe = firebase_service._json_safe(dict(decision))
        safe.setdefault("session_id", session_id)
        safe.setdefault("audit_report", "Report snapshot loaded from decision log.")
        safe.setdefault("bias_evidence", safe.get("bias_evidence") or [])
        safe.setdefault("counterfactuals", safe.get("counterfactuals") or [])
        safe.setdefault(
            "remediation_recommendation",
            safe.get("remediation_recommendation") or {"actions": []},
        )
        return safe

    raise HTTPException(404, "Report not found")


@app.get("/api/v1/metrics/{project_id}")
def get_metrics(project_id: str):
    """Compute live metrics from real decisions in RTDB. No synthetic data."""
    items = []
    try:
        items = firebase_service.list_decisions(project_id, limit=500)
    except Exception as e:
        log.warning("metrics list_decisions failed: %s", e)

    total = len(items)
    if total == 0:
        return {
            "project_id": project_id,
            "total_decisions": 0,
            "flagged": 0,
            "remediated": 0,
            "recommendations": 0,
            "average_fairness_score": 0,
            "drift_data": [],
        }

    def _v(rec, key):
        return rec.get(key) if rec.get(key) is not None else (rec.get("raw") or {}).get(key)

    flagged = sum(1 for r in items if _v(r, "verdict") == "FAIL")
    remediated = sum(1 for r in items if _v(r, "remediated_decision"))
    recommendations = sum(1 for r in items if _v(r, "remediation_recommendation"))

    scores = []
    for r in items:
        score = _v(r, "fairness_score_after")
        if score is None:
            score = _v(r, "fairness_score_before")
        if score is None:
            score = _v(r, "fairness_score")
        
        if isinstance(score, (int, float)):
            scores.append(float(score))
        elif _v(r, "verdict") == "PASS":
            # If it passed but has no score, it's 100% fair
            scores.append(100.0)
        elif _v(r, "verdict") == "FAIL":
            # If it failed but has no score, it's 0% fair
            scores.append(0.0)
            
    avg_fairness = (sum(scores) / len(scores)) if scores else 0.0

    # drift = rolling fairness over time (oldest → newest), bucket of 10
    chrono = list(reversed(items))  # list_decisions returns newest-first
    bucket_size = max(1, len(chrono) // 10)
    drift = []
    for i in range(0, len(chrono), bucket_size):
        bucket = chrono[i:i + bucket_size]
        bucket_scores = []
        for r in bucket:
            score = _v(r, "fairness_score_after")
            if score is None:
                score = _v(r, "fairness_score_before")
            if score is None:
                score = _v(r, "fairness_score")
            
            if isinstance(score, (int, float)):
                bucket_scores.append(float(score))
            elif _v(r, "verdict") == "PASS":
                bucket_scores.append(100.0)
            elif _v(r, "verdict") == "FAIL":
                bucket_scores.append(0.0)
        if bucket_scores:
            drift.append({
                "batch": len(drift) + 1,
                "score": round(sum(bucket_scores) / len(bucket_scores), 2),
            })

    return {
        "project_id": project_id,
        "total_decisions": total,
        "flagged": flagged,
        "remediated": remediated,
        "recommendations": recommendations,
        "average_fairness_score": round(avg_fairness, 2),
        "drift_data": drift,
    }


@app.delete("/api/v1/project/{project_id}")
def wipe_project(project_id: str):
    """Delete every stored record in RTDB belonging to a project."""
    deleted = {"decisions": 0, "reports": 0, "constitution": 0, "causal_graph": 0}
    try:
        firebase_service._init()
        # decisions
        all_dec = db.reference("/decisions").get() or {}
        for did, rec in list(all_dec.items()):
            if not isinstance(rec, dict):
                continue
            pid = rec.get("project_id") or (rec.get("raw") or {}).get("project_id")
            if pid == project_id:
                db.reference(f"/decisions/{did}").delete()
                deleted["decisions"] += 1
                # try matching report
                sid = rec.get("session_id") or (rec.get("raw") or {}).get("session_id")
                if sid:
                    db.reference(f"/firestore_fallback/audit_reports/{sid}").delete()
                    deleted["reports"] += 1
        # constitution + project doc
        if db.reference(f"/firestore_fallback/constitutions/{project_id}").get():
            db.reference(f"/firestore_fallback/constitutions/{project_id}").delete()
            deleted["constitution"] = 1
        if db.reference(f"/firestore_fallback/projects/{project_id}").get():
            db.reference(f"/firestore_fallback/projects/{project_id}").delete()
            deleted["causal_graph"] = 1
    except Exception as e:
        raise HTTPException(500, f"Wipe failed: {e}")
    return {"project_id": project_id, "deleted": deleted}


@app.get("/api/v1/causal_graph/{project_id}")
def causal_graph(project_id: str):
    doc = firebase_service.read_causal_graph(project_id)
    if not doc:
        raise HTTPException(404, "No graph built yet")
    return doc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=config.API_PORT, reload=True)
