"""Bias DNA — trace which training records contribute most to detected bias."""
from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

from backend.services import gemini_service

log = logging.getLogger("axiom.bias_dna")


def trace_bias_to_source_records(
    df: pd.DataFrame,
    protected_attribute: str,
    outcome_column: str,
    adjacency_matrix: np.ndarray,
    feature_names: list,
    top_k: int = 20,
) -> dict:
    """Return top_k records most responsible for bias, with explanations."""
    if protected_attribute not in df.columns or outcome_column not in df.columns:
        return {"top_biased_records": [], "total_bias_contributors": 0,
                "bias_source_summary": "protected/outcome column missing"}

    # protected group mean outcome
    group_means = df.groupby(protected_attribute)[outcome_column].mean()
    if len(group_means) < 2:
        return {"top_biased_records": [], "total_bias_contributors": 0,
                "bias_source_summary": "only one group present"}

    worst_group = group_means.idxmin()  # group receiving worse outcomes
    best_mean = group_means.max()

    # causal edge weight
    try:
        matrix = np.asarray(adjacency_matrix, dtype=float)
        i = feature_names.index(protected_attribute)
        j = feature_names.index(outcome_column)
        edge_w = float(abs(matrix[j, i]))
    except (ValueError, IndexError):
        edge_w = 0.1

    sub = df[df[protected_attribute] == worst_group].copy()
    sub["_score"] = (best_mean - sub[outcome_column]) * edge_w
    sub = sub.sort_values("_score", ascending=False)

    total_contrib = int((sub["_score"] > 0).sum())
    top = sub.head(top_k)

    records = []
    for idx, row in top.iterrows():
        features = {
            k: (float(v) if isinstance(v, (np.floating, np.integer)) else v)
            for k, v in row.drop("_score").to_dict().items()
        }
        score = float(row["_score"])
        try:
            explanation = gemini_service.explain_biased_record(
                int(idx), features, score
            )
        except Exception as e:
            log.warning("Gemini explanation failed: %s", e)
            explanation = (
                f"Record in worst-treated {protected_attribute} group with outcome "
                f"{features.get(outcome_column)}"
            )
        records.append({
            "index": int(idx),
            "score": score,
            "features": features,
            "explanation": explanation,
        })

    summary = (
        f"{total_contrib} records in the {protected_attribute}={worst_group} "
        f"group drive most of the detected bias in {outcome_column}."
    )
    return {
        "top_biased_records": records,
        "total_bias_contributors": total_contrib,
        "bias_source_summary": summary,
    }
