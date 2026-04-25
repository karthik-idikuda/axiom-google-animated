"""Agent 1 — SENTINEL: decision interceptor.

Spec responsibilities:
  - Stamp every decision with uuid + timestamp
  - Write /decisions/{uuid} to RTDB
  - Write /project_decisions/{project_id}/{uuid} index (enables fast list_decisions)
  - Set pipeline_status = "running" so dashboard shows in-flight decisions
"""
from __future__ import annotations

import logging
import uuid as _uuid
from datetime import datetime, timezone

from backend.services import firebase_service
from backend.state import AxiomState

log = logging.getLogger("axiom.sentinel")


def run(state: AxiomState) -> AxiomState:
    record = dict(state.get("decision_record") or {})
    record.setdefault("uuid", str(_uuid.uuid4()))
    record["timestamp"] = datetime.now(timezone.utc).isoformat()
    project_id = state.get("project_id") or "default"
    record.setdefault("project_id", project_id)

    session_id = record["uuid"]

    try:
        firebase_service.write_decision(session_id, {
            "raw": record,
            "project_id": project_id,
            "pipeline_status": "running",
        })
    except Exception as e:
        log.warning("firebase write_decision failed (non-fatal): %s", e)

    # Write project-scoped index for fast list_decisions O(1) lookup
    try:
        from firebase_admin import db as _rtdb
        firebase_service._init()
        _rtdb.reference(f"/project_decisions/{project_id}/{session_id}").set(
            record["timestamp"]
        )
    except Exception as e:
        log.warning("project_decisions index write failed (non-fatal): %s", e)

    state["decision_record"] = record
    state["session_id"] = session_id
    state["pipeline_status"] = "running"
    log.info("SENTINEL intercepted decision %s (project=%s)", session_id, project_id)
    return state
