"""Agent 3 - ORACLE: measured bias evidence only.

ORACLE does not fabricate counterfactual rows. It uses:
  1. DirectLiNGAM edge weights from the uploaded dataset.
  2. Optional nearest observed matches from the real uploaded dataset.

If the data needed for a measurement is unavailable, ORACLE records that fact
in analysis_notes and leaves the corresponding score unset.
"""
from __future__ import annotations

import logging
import tempfile
from typing import Any

import numpy as np
import pandas as pd

from backend.services import firebase_service
from backend.state import AxiomState

log = logging.getLogger("axiom.oracle")

CAUSAL_EFFECT_THRESHOLD = 0.05
MATCHED_DELTA_THRESHOLD = 0.15


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
        log.warning("Unable to load dataset for observed-match analysis: %s", exc)
        return None


def _coerce_outcome(series: pd.Series) -> pd.Series:
    """Convert a target column to numeric values for measured group deltas."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    cleaned = series.astype(str).str.strip()
    lower = cleaned.str.lower()
    positive = lower.isin(("1", "true", "yes", "approved", "approve", "hire", ">50k", "good", "high_risk"))
    negative = lower.isin(("0", "false", "no", "denied", "deny", "reject", "<=50k", "bad", "low_risk"))
    if (positive | negative).any():
        return positive.astype(float).where(positive | negative, np.nan)
    codes, _ = pd.factorize(cleaned)
    return pd.Series(codes, index=series.index, dtype="float64")


def _record_features(record: dict[str, Any]) -> dict[str, Any]:
    if isinstance(record.get("input_features"), dict):
        return dict(record["input_features"])
    ignored = {
        "uuid",
        "timestamp",
        "project_id",
        "model_name",
        "model_version",
        "decision",
        "outcome",
        "model_output",
    }
    return {k: v for k, v in record.items() if k not in ignored}


def _direct_causal_evidence(
    state: AxiomState,
    protected: list[str],
    outcome: str,
) -> tuple[list[dict], float | None]:
    feature_names = state.get("feature_names") or state.get("column_names") or []
    adjacency = state.get("adjacency_matrix")
    evidence: list[dict] = []

    if adjacency is None or not feature_names or not outcome:
        return evidence, None

    matrix = np.asarray(adjacency, dtype=float)
    if outcome not in feature_names:
        return evidence, None

    outcome_idx = feature_names.index(outcome)
    max_effect = 0.0
    for attr in protected:
        if attr not in feature_names:
            continue
        attr_idx = feature_names.index(attr)
        # DirectLiNGAM: matrix[child, parent] = parent -> child.
        effect = float(abs(matrix[outcome_idx, attr_idx]))
        max_effect = max(max_effect, effect)
        evidence.append({
            "type": "direct_lingam_edge",
            "protected_attribute": attr,
            "outcome_column": outcome,
            "causal_effect": round(effect, 6),
            "threshold": CAUSAL_EFFECT_THRESHOLD,
            "bias_signal": effect > CAUSAL_EFFECT_THRESHOLD,
        })

    return evidence, max_effect if evidence else None


def _nearest_observed_matches(
    df: pd.DataFrame,
    record: dict[str, Any],
    protected: list[str],
    outcome: str,
    top_k: int = 5,
) -> tuple[list[dict], float | None]:
    """Find real rows with different protected values and similar other features."""
    if df is None or df.empty or outcome not in df.columns:
        return [], None

    features = _record_features(record)
    usable_features = [
        c for c in df.columns
        if c in features and c != outcome and c not in protected
    ]
    if not usable_features:
        return [], None

    outcome_numeric = _coerce_outcome(df[outcome])
    matches: list[dict] = []
    deltas: list[float] = []

    for attr in protected:
        if attr not in df.columns or attr not in features:
            continue
        original_attr = features[attr]
        base_mask = df[attr].astype(str) == str(original_attr)
        base_outcomes = outcome_numeric[base_mask].dropna()
        if base_outcomes.empty:
            continue
        base_mean = float(base_outcomes.mean())

        alt = df[df[attr].astype(str) != str(original_attr)].copy()
        if alt.empty:
            continue

        distances = pd.Series(0.0, index=alt.index)
        compared = 0
        for col in usable_features:
            row_values = alt[col]
            val = features[col]
            if pd.api.types.is_numeric_dtype(row_values):
                numeric = pd.to_numeric(row_values, errors="coerce")
                try:
                    val_float = float(val)
                except (TypeError, ValueError):
                    continue
                scale = float(numeric.std() or 1.0)
                distances = distances.add((numeric - val_float).abs().fillna(scale) / scale, fill_value=0)
                compared += 1
            else:
                distances = distances.add((row_values.astype(str) != str(val)).astype(float), fill_value=0)
                compared += 1

        if compared == 0:
            continue

        nearest_idx = distances.sort_values().head(top_k).index
        nearest = df.loc[nearest_idx].copy()
        nearest_outcomes = outcome_numeric.loc[nearest_idx].dropna()
        if nearest_outcomes.empty:
            continue
        alt_mean = float(nearest_outcomes.mean())
        delta = abs(alt_mean - base_mean)
        deltas.append(delta)

        for idx in nearest_idx:
            matches.append({
                "type": "nearest_observed_match",
                "changed": attr,
                "from": original_attr,
                "to": df.at[idx, attr],
                "matched_record_index": int(idx),
                "observed_outcome": df.at[idx, outcome],
                "distance": round(float(distances.loc[idx]), 6),
                "group_outcome_delta": round(delta, 6),
            })

    return matches, max(deltas) if deltas else None


def run(state: AxiomState) -> AxiomState:
    record = state.get("decision_record") or {}
    protected = state.get("protected_attributes") or state.get("protected_attrs") or []
    outcome = state.get("outcome_column") or ""
    notes = list(state.get("analysis_notes") or [])

    causal_evidence, max_effect = _direct_causal_evidence(state, protected, outcome)
    cfs: list[dict] = []
    matched_delta: float | None = None

    df = _load_dataset(state.get("dataset_path", ""))
    if df is not None and protected and outcome:
        cfs, matched_delta = _nearest_observed_matches(df, record, protected, outcome)
    else:
        notes.append("Observed-match counterfactuals were not computed because the uploaded dataset or outcome column was unavailable.")

    detected_by_graph = any(e.get("bias_signal") for e in causal_evidence)
    detected_by_matches = matched_delta is not None and matched_delta > MATCHED_DELTA_THRESHOLD
    detected = bool(detected_by_graph or detected_by_matches)

    state["counterfactuals"] = cfs
    state["counterfactual_delta"] = round(matched_delta, 6) if matched_delta is not None else None
    state["bias_evidence"] = causal_evidence
    state["max_protected_causal_effect"] = round(max_effect, 6) if max_effect is not None else None
    state["causal_bias_detected"] = detected
    state["analysis_notes"] = notes

    try:
        firebase_service.update_decision(
            record.get("uuid", state.get("session_id", "")),
            {
                "counterfactuals": cfs,
                "counterfactual_delta": state["counterfactual_delta"],
                "bias_evidence": causal_evidence,
                "max_protected_causal_effect": state["max_protected_causal_effect"],
                "causal_bias_detected": detected,
                "analysis_notes": notes,
            },
        )
    except Exception:
        pass

    log.info(
        "ORACLE measured %d observed matches, bias=%s, max_effect=%s, matched_delta=%s",
        len(cfs),
        detected,
        state["max_protected_causal_effect"],
        state["counterfactual_delta"],
    )
    return state
