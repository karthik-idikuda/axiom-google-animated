"""Firebase wrapper — Realtime DB, Firestore, Cloud Storage.

Graceful degradation: if AXIOM_DISABLE_FIRESTORE=1, all Firestore-shaped data
falls back into RTDB under `/firestore_fallback/{collection}/{doc_id}`.
If AXIOM_DISABLE_STORAGE=1, PDFs are written to config.LOCAL_REPORTS_DIR and
served at `/reports/{filename}` by the FastAPI app.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any, Optional

try:
    import pandas as pd
except ImportError:
    pd = None

import firebase_admin
from firebase_admin import credentials, db

from backend import config

log = logging.getLogger("axiom.firebase")

_initialized = False
_fs = None
_bucket = None
_init_lock = threading.Lock()


def _init() -> None:
    global _initialized, _fs, _bucket
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return
        if not firebase_admin._apps:
            if config.GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(config.GOOGLE_APPLICATION_CREDENTIALS):
                cred = credentials.Certificate(config.GOOGLE_APPLICATION_CREDENTIALS)
            else:
                cred = credentials.ApplicationDefault()
            init_opts: dict = {
                "databaseURL": config.FIREBASE_DATABASE_URL,
                "projectId": config.FIREBASE_PROJECT_ID,
            }
            if config.FIREBASE_STORAGE_BUCKET and not config.DISABLE_STORAGE:
                init_opts["storageBucket"] = config.FIREBASE_STORAGE_BUCKET
            firebase_admin.initialize_app(cred, init_opts)

        # Firestore/Storage clients only if enabled
        if not config.DISABLE_FIRESTORE:
            try:
                from firebase_admin import firestore
                _fs = firestore.client()
            except Exception as e:
                log.warning("Firestore unavailable, falling back to RTDB: %s", e)
        if not config.DISABLE_STORAGE and config.FIREBASE_STORAGE_BUCKET:
            try:
                from firebase_admin import storage
                _bucket = storage.bucket()
            except Exception as e:
                log.warning("Storage unavailable: %s", e)

        os.makedirs(config.LOCAL_REPORTS_DIR, exist_ok=True)
        _initialized = True
        log.info(
            "Firebase initialized for project %s (firestore=%s, storage=%s)",
            config.FIREBASE_PROJECT_ID,
            _fs is not None,
            _bucket is not None,
        )


def _sanitize_key(key: str) -> str:
    """Replace chars illegal in Firebase RTDB keys: . $ # [ ] /"""
    if not isinstance(key, str):
        return str(key)
    for ch in ".#$[]/":
        key = key.replace(ch, "_")
    return key or "_"


def _json_safe(obj: Any) -> Any:
    """Convert numpy / pandas / sets to plain python for Firebase."""
    try:
        import numpy as np
        import pandas as pd
    except ImportError:
        np = None
        pd = None
    if isinstance(obj, dict):
        return {_sanitize_key(k): _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_json_safe(v) for v in obj]
    if np is not None and isinstance(obj, (np.integer,)):
        return int(obj)
    if np is not None and isinstance(obj, (np.floating,)):
        import math
        val = float(obj)
        return None if math.isnan(val) or math.isinf(val) else val
    if isinstance(obj, float):
        import math
        return None if math.isnan(obj) or math.isinf(obj) else obj
    if np is not None and isinstance(obj, np.ndarray):
        return [_json_safe(x) for x in obj.tolist()]
    if pd is not None and isinstance(obj, pd.DataFrame):
        return [_json_safe(x) for x in obj.to_dict(orient="records")]
    if pd is not None and pd.isna(obj):
        return None
    return obj


def _fs_set(collection: str, doc_id: str, data: dict, merge: bool = False) -> None:
    """Firestore write with RTDB fallback."""
    _init()
    safe = _json_safe(data)
    if _fs is not None:
        if merge:
            _fs.collection(collection).document(doc_id).set(safe, merge=True)
        else:
            _fs.collection(collection).document(doc_id).set(safe)
    else:
        ref = db.reference(f"/firestore_fallback/{collection}/{doc_id}")
        if merge:
            ref.update(safe)
        else:
            ref.set(safe)


def _fs_get(collection: str, doc_id: str) -> Optional[dict]:
    _init()
    if _fs is not None:
        snap = _fs.collection(collection).document(doc_id).get()
        return snap.to_dict() if snap.exists else None
    return db.reference(f"/firestore_fallback/{collection}/{doc_id}").get()


def write_decision(uuid: str, data: dict) -> None:
    """Write a decision record to Realtime DB under /decisions/{uuid}."""
    _init()
    ref = db.reference(f"/decisions/{uuid}")
    ref.set(_json_safe(data))
    log.info("decision written: %s", uuid)


def update_decision(uuid: str, patch: dict) -> None:
    _init()
    db.reference(f"/decisions/{uuid}").update(_json_safe(patch))


def update_decision_status(
    session_id: str,
    *,
    status: str,
    fairness_score: float | None = None,
    certificate_issued: bool = False,
    pdf_url: str = "",
) -> None:
    """Patch /decisions/{session_id} with final pipeline results.

    Called by SCRIBE after the full pipeline completes so the Dashboard
    Decision Log shows live fairness scores and audit status.
    """
    _init()
    patch = {
        "pipeline_status": status,
        "certificate_issued": certificate_issued,
        "pdf_url": pdf_url,
    }
    if fairness_score is not None:
        patch["fairness_score"] = fairness_score
    patch = _json_safe(patch)
    db.reference(f"/decisions/{session_id}").update(patch)
    log.info("decision status updated: %s -> %s (score=%s)", session_id, status, fairness_score)


def write_report(session_id: str, data: dict) -> None:
    _fs_set("audit_reports", session_id, data)


def read_report(session_id: str) -> Optional[dict]:
    return _fs_get("audit_reports", session_id)


def write_constitution(project_id: str, rules_text: str, parsed: list) -> None:
    _fs_set(
        "constitutions", project_id,
        {"rules_text": rules_text, "parsed": _json_safe(parsed)},
    )


def read_constitution(project_id: str) -> Optional[dict]:
    return _fs_get("constitutions", project_id)


def write_causal_graph(
    project_id: str,
    edges: list,
    protected: list,
    adjacency_matrix=None,
    feature_names=None,
    dataset_path: str | None = None,
    outcome_column: str | None = None,
) -> None:
    payload: dict = {
        "causal_graph": _json_safe(edges),
        "protected_attributes": protected,
    }
    if adjacency_matrix is not None:
        payload["adjacency_matrix"] = _json_safe(adjacency_matrix)
    if feature_names is not None:
        payload["feature_names"] = feature_names
    if dataset_path is not None:
        payload["dataset_path"] = dataset_path
    if outcome_column is not None:
        payload["outcome_column"] = outcome_column
    _fs_set("projects", project_id, payload, merge=True)
    _init()
    db.reference(f"/projects/{project_id}/status").set("graph_ready")


def read_causal_graph(project_id: str) -> Optional[dict]:
    return _fs_get("projects", project_id)


def upload_pdf(filename: str, data: bytes) -> str:
    """Upload PDF to GCS or save locally if storage disabled."""
    _init()
    if _bucket is not None:
        blob = _bucket.blob(f"reports/{filename}")
        blob.upload_from_string(data, content_type="application/pdf")
        try:
            blob.make_public()
            return blob.public_url
        except Exception:
            return f"gs://{config.FIREBASE_STORAGE_BUCKET}/reports/{filename}"
    # local fallback
    os.makedirs(config.LOCAL_REPORTS_DIR, exist_ok=True)
    path = os.path.join(config.LOCAL_REPORTS_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)
    return f"/reports/{filename}"


def upload_dataset(local_path: str, dest_name: str) -> str:
    _init()
    if _bucket is not None:
        blob = _bucket.blob(f"datasets/{dest_name}")
        blob.upload_from_filename(local_path)
        return f"gs://{config.FIREBASE_STORAGE_BUCKET}/datasets/{dest_name}"
    # local fallback — just return the local path
    return local_path


def download_dataset(gcs_path: str, local_path: str) -> str:
    _init()
    if gcs_path.startswith("gs://") and _bucket is not None:
        parts = gcs_path.replace("gs://", "").split("/", 1)
        blob = _bucket.blob(parts[1])
        blob.download_to_filename(local_path)
        return local_path
    # already local
    return gcs_path


def list_decisions(project_id: str, limit: int = 100) -> list:
    """Return last N decisions for a project, newest first.

    Uses /project_decisions/{project_id} index for O(1) lookup instead of
    scanning all decisions — avoids full RTDB read as data grows.
    Falls back to full scan if the project index doesn't exist yet.
    """
    _init()

    # Fast path: project-scoped index written by SENTINEL
    index = db.reference(f"/project_decisions/{project_id}").get()
    if index and isinstance(index, dict):
        items = []
        for sid, ts in index.items():
            rec = db.reference(f"/decisions/{sid}").get()
            if isinstance(rec, dict):
                rec = dict(rec)
                rec["_id"] = sid
                items.append(rec)
        items.sort(
            key=lambda r: (
                r.get("timestamp")
                or (r.get("raw") or {}).get("timestamp")
                or ""
            ),
            reverse=True,
        )
        return items[:limit]

    # Slow fallback: full scan (only on first run before SENTINEL writes the index)
    raw = db.reference("/decisions").get() or {}
    items = []
    for did, rec in raw.items():
        if not isinstance(rec, dict):
            continue
        pid = rec.get("project_id") or (rec.get("raw") or {}).get("project_id")
        if pid != project_id:
            continue
        rec = dict(rec)
        rec["_id"] = did
        items.append(rec)
    items.sort(
        key=lambda r: (
            r.get("timestamp")
            or (r.get("raw") or {}).get("timestamp")
            or ""
        ),
        reverse=True,
    )
    return items[:limit]
