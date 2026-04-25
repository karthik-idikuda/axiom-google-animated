"""Agent 6 - SCRIBE: audit report + PDF.

SCRIBE only reports measured values. If post-remediation evaluation was not
performed, the "after" score is left unset and no certificate is issued for a
failed decision.
"""
from __future__ import annotations

import logging

from backend.services import firebase_service, gemini_service
from backend.state import AxiomState
from backend.utils import pdf_builder

log = logging.getLogger("axiom.scribe")

CERTIFICATE_THRESHOLD = 85.0


def _measured_score(state: AxiomState) -> tuple[float | None, str | None]:
    delta = state.get("counterfactual_delta")
    if isinstance(delta, (int, float)):
        return round(max(0.0, min(100.0, (1.0 - abs(float(delta))) * 100.0)), 2), "observed_match_delta"

    effect = state.get("max_protected_causal_effect")
    if isinstance(effect, (int, float)):
        capped = min(abs(float(effect)), 1.0)
        return round(max(0.0, min(100.0, (1.0 - capped) * 100.0)), 2), "direct_lingam_causal_effect"

    return None, None


def run(state: AxiomState) -> AxiomState:
    session_id = state.get("session_id") or state.get("decision_record", {}).get("uuid", "unknown")

    fairness_score_before, score_source = _measured_score(state)
    fairness_score_after = state.get("post_remediation_fairness_score")
    if not isinstance(fairness_score_after, (int, float)):
        fairness_score_after = None

    verdict = state.get("verdict") or ("FAIL" if state.get("causal_bias_detected") else "PASS")
    certificate_score = fairness_score_after if fairness_score_after is not None else fairness_score_before
    certificate_issued = (
        verdict == "PASS"
        and isinstance(certificate_score, (int, float))
        and certificate_score >= CERTIFICATE_THRESHOLD
    )

    session_data = {
        "session_id": session_id,
        "decision": state.get("decision_record"),
        "dataset_path": state.get("dataset_path"),
        "outcome_column": state.get("outcome_column"),
        "protected_attributes": state.get("protected_attributes") or state.get("protected_attrs"),
        "causal_graph_edges": state.get("causal_graph_edges"),
        "bias_evidence": state.get("bias_evidence"),
        "counterfactuals": state.get("counterfactuals"),
        "causal_bias_detected": state.get("causal_bias_detected"),
        "counterfactual_delta": state.get("counterfactual_delta"),
        "max_protected_causal_effect": state.get("max_protected_causal_effect"),
        "verdict": verdict,
        "violated_rule": state.get("violated_rule") or state.get("violated_rule_id"),
        "violated_rule_id": state.get("violated_rule_id"),
        "severity_score": state.get("severity_score"),
        "constitution_text": state.get("constitution_text"),
        "constitution_rules": state.get("constitution_rules"),
        "remediated_decision": state.get("remediated_decision"),
        "remediation_method": state.get("remediation_method"),
        "remediation_recommendation": state.get("remediation_recommendation"),
        "bias_dna": state.get("bias_dna"),
        "analysis_notes": state.get("analysis_notes"),
        "fairness_score_before": fairness_score_before,
        "fairness_score_after": fairness_score_after,
        "fairness_score_source": score_source,
        "certificate_issued": certificate_issued,
    }

    try:
        report_md = gemini_service.generate_audit_report(session_data)
    except Exception as exc:
        log.warning("Gemini audit report failed: %s", exc)
        report_md = _fallback_report(session_data)

    state["audit_report"] = report_md
    state["audit_report_md"] = report_md
    state["audit_report_json"] = session_data
    state["fairness_score_before"] = fairness_score_before
    state["fairness_score_after"] = fairness_score_after
    state["fairness_score_source"] = score_source
    state["certificate_issued"] = certificate_issued

    pdf_url = ""
    try:
        stamp = "CERTIFIED FAIR" if certificate_issued else "AUDIT REPORT - NO CERTIFICATE"
        pdf_title = f"AXIOM Fairness Audit - {session_id}\n{stamp}"
        pdf_bytes = pdf_builder.build_pdf(pdf_title, report_md)
        pdf_url = firebase_service.upload_pdf(f"{session_id}.pdf", pdf_bytes)
    except Exception as exc:
        log.warning("PDF build/upload failed: %s", exc)
    state["pdf_url"] = pdf_url

    full_payload = {**session_data, "audit_report": report_md, "pdf_url": pdf_url}
    try:
        firebase_service.write_report(session_id, full_payload)
    except Exception as exc:
        log.warning("write_report failed: %s", exc)

    try:
        dashboard_score = fairness_score_after if fairness_score_after is not None else fairness_score_before
        firebase_service.update_decision(
            session_id,
            {
                "verdict": verdict,
                "fairness_score_before": fairness_score_before,
                "fairness_score_after": fairness_score_after,
                "fairness_score_source": score_source,
                "certificate_issued": certificate_issued,
            },
        )
        firebase_service.update_decision_status(
            session_id,
            status="completed",
            fairness_score=dashboard_score,
            certificate_issued=certificate_issued,
            pdf_url=pdf_url,
        )
    except Exception as exc:
        log.warning("update_decision_status failed (non-fatal): %s", exc)

    state["pipeline_status"] = "completed"
    log.info(
        "SCRIBE: session=%s verdict=%s score_before=%s score_after=%s certified=%s",
        session_id,
        verdict,
        fairness_score_before,
        fairness_score_after,
        certificate_issued,
    )
    return state


def _fmt(value) -> str:
    return "Not measured" if value is None else f"{float(value):.2f}%"


def _fallback_report(data: dict) -> str:
    verdict = data.get("verdict", "N/A")
    score_b = data.get("fairness_score_before")
    score_a = data.get("fairness_score_after")
    certificate = "CERTIFIED FAIR" if data.get("certificate_issued") else "NO CERTIFICATE ISSUED"
    recommendation = data.get("remediation_recommendation") or {}
    actions = recommendation.get("actions") or []
    action_lines = "\n".join(f"- {a}" for a in actions) if actions else "- No remediation recommendation was generated."
    notes = data.get("analysis_notes") or []
    note_lines = "\n".join(f"- {n}" for n in notes) if notes else "- No analysis limitations were recorded."
    return (
        "# AXIOM Fairness Audit Report\n\n"
        "## Executive Summary\n"
        f"Verdict: **{verdict}**. Severity: {data.get('severity_score', 0)}. "
        f"Certificate status: **{certificate}**.\n\n"
        "## Measured Evidence\n"
        f"- Protected attributes: {data.get('protected_attributes') or []}\n"
        f"- Outcome column: {data.get('outcome_column') or 'Not available'}\n"
        f"- Max protected causal effect: {data.get('max_protected_causal_effect') if data.get('max_protected_causal_effect') is not None else 'Not measured'}\n"
        f"- Observed-match delta: {data.get('counterfactual_delta') if data.get('counterfactual_delta') is not None else 'Not measured'}\n\n"
        "## Fairness Score\n"
        f"- Before remediation: {_fmt(score_b)}\n"
        f"- After remediation: {_fmt(score_a)}\n"
        f"- Score source: {data.get('fairness_score_source') or 'Not measured'}\n\n"
        "## Constitution Compliance\n"
        f"- Violated rule: {data.get('violated_rule_id') or data.get('violated_rule') or 'None'}\n\n"
        "## Remediation Recommendation\n"
        f"{action_lines}\n\n"
        "## Analysis Notes\n"
        f"{note_lines}\n"
    )
