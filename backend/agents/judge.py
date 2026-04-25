"""Agent 4 — JUDGE: moral constitution enforcer."""
from __future__ import annotations

import logging

from backend.services import firebase_service, gemini_service
from backend.state import AxiomState

log = logging.getLogger("axiom.judge")

SEVERITY_WEIGHTS = {"CRITICAL": 100, "HIGH": 75, "MEDIUM": 50, "LOW": 25}

DEFAULT_CONSTITUTION = (
    "Protected attributes (race, sex, gender, age, nationality) must never "
    "causally influence the final decision outcome."
)


def run(state: AxiomState) -> AxiomState:
    project_id = state.get("project_id") or "default"

    # 1. load rules
    rules_doc = None
    try:
        rules_doc = firebase_service.read_constitution(project_id)
    except Exception as e:
        log.warning("read_constitution failed: %s", e)

    if rules_doc and rules_doc.get("parsed"):
        rules = rules_doc["parsed"]
        rules_text = (rules_doc or {}).get("rules_text") or DEFAULT_CONSTITUTION
    else:
        rules_text = (rules_doc or {}).get("rules_text") or DEFAULT_CONSTITUTION
        try:
            rules = gemini_service.parse_constitution(rules_text)
        except Exception as e:
            log.warning("parse_constitution failed, using default rule: %s", e)
            rules = [{
                "rule_id": "RULE_DEFAULT",
                "protected_attribute": "any",
                "allowed_causal_influence": 0.0,
                "severity_if_violated": "CRITICAL",
            }]

    # Populate spec fields consumed by SCRIBE
    state["constitution_text"] = rules_text
    state["constitution_rules"] = rules

    # 2. check measured violations. No violation is claimed without measured
    # evidence from ORACLE.
    bias_detected = bool(state.get("causal_bias_detected"))
    protected = [p.lower() for p in (state.get("protected_attributes") or [])]
    evidence = state.get("bias_evidence") or []
    violated_rule = None
    severity = 0.0

    if bias_detected:
        for rule in rules:
            pa = str(rule.get("protected_attribute", "")).lower()
            allowed = float(
                rule.get("allowed_causal_influence",
                         rule.get("threshold", 0.0))
            )
            matching = [
                e for e in evidence
                if (
                    pa in ("any", "*")
                    or pa == str(e.get("protected_attribute", "")).lower()
                    or pa in protected
                )
                and float(e.get("causal_effect", 0.0)) > allowed
            ]
            if matching:
                violated_rule = rule.get("rule_id")
                sev_label = rule.get("severity_if_violated", rule.get("severity", "HIGH"))
                severity = max(severity, SEVERITY_WEIGHTS.get(sev_label, 50))
                break

    verdict = "FAIL" if violated_rule else "PASS"

    state["verdict"] = verdict
    state["violated_rule"] = violated_rule      # internal alias
    state["violated_rule_id"] = violated_rule   # spec field
    state["severity_score"] = float(severity)

    try:
        firebase_service.update_decision(
            state.get("decision_record", {}).get("uuid", state.get("session_id", "")),
            {"verdict": verdict, "violated_rule": violated_rule,
             "violated_rule_id": violated_rule,
             "severity_score": severity},
        )
    except Exception:
        pass

    log.info("JUDGE verdict=%s severity=%.1f rule=%s", verdict, severity, violated_rule)
    return state
