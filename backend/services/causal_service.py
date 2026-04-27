"""DoWhy + LiNGAM wrappers used by CARTOGRAPHER and SURGEON."""
from __future__ import annotations

import logging
from typing import Tuple

import networkx as nx
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
from sklearn.preprocessing import LabelEncoder

log = logging.getLogger("axiom.causal")

OUTCOME_CANDIDATES = (
    "outcome",
    "target",
    "label",
    "decision",
    "income",
    "two_year_recid",
    "is_recid",
    "credit_risk",
    "class",
)


def infer_outcome_column(df: pd.DataFrame) -> str:
    """Pick a target column from known benchmark names, then fall back to last col."""
    lower_to_original = {c.lower(): c for c in df.columns}
    for candidate in OUTCOME_CANDIDATES:
        if candidate in lower_to_original:
            return lower_to_original[candidate]
    return str(df.columns[-1])


def encode_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """Label-encode all non-numeric columns. Return (numeric_df, encoders)."""
    df = df.copy()
    encoders: dict = {}
    for col in df.columns:
        # Handles pandas extension dtypes (e.g. StringDtype) safely.
        if not is_numeric_dtype(df[col]):
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
    df = df.fillna(df.median(numeric_only=True))
    return df, encoders


def discover_causal_graph(
    df: pd.DataFrame, threshold: float = 0.1
) -> Tuple[np.ndarray, nx.DiGraph, list]:
    """Run DirectLiNGAM and return (adjacency_matrix, NetworkX DiGraph, cols)."""
    from lingam import DirectLiNGAM

    if len(df) < 100:
        raise ValueError(
            "Dataset too small for causal discovery. Minimum 100 rows required."
        )
    numeric_df, _ = encode_dataframe(df)
    # Drop columns that are still NaN (all-missing) or constant, then fill any residual NaN.
    numeric_df = numeric_df.dropna(axis=1, how="all")
    numeric_df = numeric_df.loc[:, numeric_df.nunique(dropna=True) > 1]
    numeric_df = numeric_df.fillna(0.0)
    if numeric_df.shape[1] < 2:
        raise ValueError("Not enough usable numeric columns after cleaning.")
    # Cap rows for performance on large datasets
    if len(numeric_df) > 5000:
        numeric_df = numeric_df.sample(n=5000, random_state=42).reset_index(drop=True)
    model = DirectLiNGAM()
    model.fit(numeric_df.values)
    adj = model.adjacency_matrix_

    cols = list(numeric_df.columns)
    G = nx.DiGraph()
    for c in cols:
        G.add_node(c)
    for i, src in enumerate(cols):
        for j, dst in enumerate(cols):
            w = adj[j, i]  # DirectLiNGAM convention: B[i,j] = j -> i
            if abs(w) > threshold and i != j:
                G.add_edge(src, dst, weight=float(w))
    return adj, G, cols


def estimate_causal_effect(
    df: pd.DataFrame,
    treatment: str,
    outcome: str,
    graph: nx.DiGraph,
) -> float:
    """Use DoWhy to estimate treatment->outcome ATE via backdoor linear regression."""
    try:
        from dowhy import CausalModel

        # DoWhy accepts a DOT-like string
        dot = "digraph { " + "; ".join(
            f"{u} -> {v}" for u, v in graph.edges()
        ) + " }"
        model = CausalModel(data=df, treatment=treatment, outcome=outcome, graph=dot)
        identified = model.identify_effect(proceed_when_unidentifiable=True)
        estimate = model.estimate_effect(
            identified, method_name="backdoor.linear_regression"
        )
        return float(estimate.value)
    except Exception as e:
        log.warning("DoWhy estimation failed: %s", e)
        return 0.0
