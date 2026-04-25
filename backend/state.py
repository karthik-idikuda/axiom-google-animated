"""Shared AxiomState TypedDict used by every LangGraph agent.

Field ownership:
  SENTINEL      → session_id, project_id, decision_record, pipeline_status
  CARTOGRAPHER  → dataset_path, column_names/feature_names, protected_attributes,
                  adjacency_matrix, causal_graph_edges, causal_graph
  ORACLE        → counterfactuals, causal_bias_detected, counterfactual_delta,
                  bias_evidence, max_protected_causal_effect
  JUDGE         → constitution_text, constitution_rules, verdict,
                  violated_rule/violated_rule_id, severity_score
  SURGEON       → bias_dna_records/bias_dna, remediation_method,
                  remediation_recommendation
  SCRIBE        → audit_report/audit_report_md, audit_report_json, pdf_url,
                  fairness_score_before, fairness_score_after, certificate_issued
  ANY           → error_message, pipeline_status
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class AxiomState(TypedDict, total=False):
    # ── Identity (SENTINEL) ────────────────────────────────────────────────────
    session_id: str
    project_id: str
    pipeline_status: str          # "running" | "completed" | "failed"
    error_message: Optional[str]

    # ── Decision Record (SENTINEL) ─────────────────────────────────────────────
    decision_record: Dict         # {decision_id, timestamp, input_features,
                                  #  model_output, model_name, model_version}

    # ── Causal Graph (CARTOGRAPHER) ────────────────────────────────────────────
    dataset_path: str             # GCS path OR local path to training CSV
    outcome_column: str           # inferred target/outcome column from uploaded CSV
    column_names: List[str]       # alias: spec calls this column_names
    feature_names: List[str]      # alias used internally — same as column_names
    protected_attributes: List[str]   # spec: protected_attrs (both accepted)
    protected_attrs: List[str]        # spec alias
    adjacency_matrix: Any         # numpy.ndarray (n_features × n_features)
    causal_graph: Any             # networkx.DiGraph (derived from adjacency_matrix)
    causal_graph_edges: List[Dict]    # [{"source":str, "target":str, "weight":float, "biased_edge":bool}]

    # ── Counterfactuals (ORACLE) ───────────────────────────────────────────────
    counterfactuals: List[Dict]
    causal_bias_detected: bool
    counterfactual_delta: Optional[float]   # measured outcome change across observed matches
    bias_evidence: List[Dict]     # measured protected_attr -> outcome signals
    max_protected_causal_effect: Optional[float]
    analysis_notes: List[str]

    # ── Constitution (JUDGE) ───────────────────────────────────────────────────
    constitution_text: str        # plain English rules
    constitution_rules: List[Dict]    # Gemini-parsed formal rules
    verdict: str                  # "PASS" | "FAIL"
    violated_rule: Optional[str]  # violated_rule_id alias
    violated_rule_id: Optional[str]
    severity_score: float         # 0-100, 100 = most severe

    # ── Remediation (SURGEON) ─────────────────────────────────────────────────
    remediated_decision: Optional[Dict]  # set only when a measured correction exists
    remediation_method: str       # e.g. "recommendation_only"
    remediation_recommendation: Optional[Dict]
    bias_dna: Optional[Dict]      # output of bias_dna.trace_bias_to_source_records()
    bias_dna_records: Optional[List[Dict]]   # spec alias for bias_dna top records
    reweighting: Optional[Dict]   # suggested sample weights for top bias records

    # ── Audit Report (SCRIBE) ─────────────────────────────────────────────────
    audit_report: str             # markdown — alias: audit_report_md
    audit_report_md: str          # spec alias
    audit_report_json: Dict       # structured audit data
    pdf_url: str                  # GCS public URL (or local path in dev mode)
    fairness_score_before: Optional[float]  # measured score before remediation
    fairness_score_after: Optional[float]   # measured score after remediation, if evaluated
    fairness_score_source: Optional[str]
    certificate_issued: bool
