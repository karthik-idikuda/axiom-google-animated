"""Agent 5 - SURGEON: measured remediation recommendations.

This agent does not rewrite a decision unless AXIOM has a measured corrected
output from an attached model. In the current MVP it produces an auditable
remediation plan from the real bias evidence and, when available, traces source
records using the uploaded dataset.
"""
from __future__ import annotations

import logging
import tempfile

import pandas as pd

from backend.services import firebase_service
from backend.state import AxiomState
from backend.utils import bias_dna

log = logging.getLogger("axiom.surgeon")


def _load_dataset(path: str) -> pd.DataFrame | None:
    if not path:
        return None
    try:
        if path.startswith("gs://"):
            tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False).name
            firebase_service.download_dataset(path, tmp)
            return pd.read_csv(tmp)
        return pd.read_csv(path)
    except Exception as exc:
        log.warning("Unable to load dataset for remediation analysis: %s", exc)
        return None


def _recommendation(state: AxiomState) -> dict:
    evidence = state.get("bias_evidence") or []
    attrs = sorted({
        str(e.get("protected_attribute"))
        for e in evidence
        if e.get("bias_signal")
    })
    outcome = state.get("outcome_column") or "the outcome"
    actions = [
        "Hold this decision for human review before delivery.",
        "Retrain and evaluate the model with the protected attribute and proxy features audited explicitly.",
        "Report demographic parity difference and equalized odds on a held-out validation set before deployment.",
    ]
    if attrs:
        actions.insert(
            1,
            f"Investigate measured causal paths from {', '.join(attrs)} to {outcome}.",
        )
    return {
        "type": "recommendation_only",
        "reason": "AXIOM found measured bias evidence, but no verified corrected model output was available.",
        "protected_attributes": attrs,
        "actions": actions,
    }


def run(state: AxiomState) -> AxiomState:
    record = dict(state.get("decision_record") or {})
    protected = state.get("protected_attributes") or state.get("protected_attrs") or []
    recommendation = _recommendation(state)

    df = _load_dataset(state.get("dataset_path", ""))
    if (
        df is not None
        and protected
        and state.get("outcome_column")
        and state.get("adjacency_matrix") is not None
    ):
        try:
            trace = bias_dna.trace_bias_to_source_records(
                df,
                protected[0],
                state["outcome_column"],
                state["adjacency_matrix"],
                state.get("feature_names") or state.get("column_names") or list(df.columns),
                top_k=10,
            )
            state["bias_dna"] = trace
            state["bias_dna_records"] = trace.get("top_biased_records", [])
        except Exception as exc:
            log.warning("Bias DNA trace failed: %s", exc)

    state["remediated_decision"] = None
    state["remediation_method"] = "recommendation_only"
    state["remediation_recommendation"] = recommendation
    state["reweighting"] = None

    try:
        firebase_service.update_decision(
            record.get("uuid", state.get("session_id", "")),
            {
                "remediated_decision": None,
                "remediation_method": "recommendation_only",
                "remediation_recommendation": recommendation,
                "bias_dna": state.get("bias_dna"),
            },
        )
    except Exception:
        pass

    log.info("SURGEON produced recommendation-only remediation for %s", record.get("uuid"))
    return state
