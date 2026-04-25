"""Fairness metrics used across AXIOM."""
from __future__ import annotations

import numpy as np
import pandas as pd


def counterfactual_fairness_score(original_outcome, cf_outcomes) -> float:
    """1.0 when outcome never changes across counterfactuals, 0.0 when always flips."""
    if not cf_outcomes:
        return 1.0
    flips = sum(1 for o in cf_outcomes if o != original_outcome)
    return 1.0 - (flips / len(cf_outcomes))


def demographic_parity_difference(
    df: pd.DataFrame, protected: str, outcome: str
) -> float:
    groups = df.groupby(protected)[outcome].mean()
    if len(groups) < 2:
        return 0.0
    return float(groups.max() - groups.min())


def equalized_odds_difference(
    df: pd.DataFrame, protected: str, outcome: str, prediction: str
) -> float:
    diffs = []
    for truth in (0, 1):
        sub = df[df[outcome] == truth]
        if sub.empty:
            continue
        rates = sub.groupby(protected)[prediction].mean()
        if len(rates) >= 2:
            diffs.append(float(rates.max() - rates.min()))
    return max(diffs) if diffs else 0.0


def causal_effect_size(
    adjacency_matrix: np.ndarray, feature_names: list, protected: str, outcome: str
) -> float:
    if protected not in feature_names or outcome not in feature_names:
        return 0.0
    i = feature_names.index(protected)
    j = feature_names.index(outcome)
    return float(abs(adjacency_matrix[j, i]))


def temporal_drift_rate(scores: list[float], window: int = 1000) -> float:
    if len(scores) < 2:
        return 0.0
    recent = scores[-1]
    past = scores[-min(window, len(scores))]
    return (recent - past) / max(1, min(window, len(scores)))


def summarize(
    df: pd.DataFrame,
    protected: str,
    outcome: str,
    prediction: str | None = None,
    adjacency_matrix: np.ndarray | None = None,
    feature_names: list | None = None,
) -> dict:
    out = {
        "demographic_parity_difference": demographic_parity_difference(
            df, protected, outcome
        ),
    }
    if prediction and prediction in df.columns:
        out["equalized_odds_difference"] = equalized_odds_difference(
            df, protected, outcome, prediction
        )
    if adjacency_matrix is not None and feature_names is not None:
        out["causal_effect_size"] = causal_effect_size(
            adjacency_matrix, feature_names, protected, outcome
        )
    return out
