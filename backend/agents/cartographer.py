"""Agent 2 — CARTOGRAPHER: build causal graph with DirectLiNGAM."""
from __future__ import annotations

import logging
import tempfile

import networkx as nx
import pandas as pd

from backend.services import causal_service, firebase_service, gemini_service
from backend.state import AxiomState
from backend.utils import data_preprocessor

log = logging.getLogger("axiom.cartographer")


def _load_dataset(path: str) -> pd.DataFrame:
    if path.startswith("gs://"):
        tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False).name
        firebase_service.download_dataset(path, tmp)
        return pd.read_csv(tmp)
    return pd.read_csv(path)


def run(state: AxiomState) -> AxiomState:
    path = state.get("dataset_path")
    project_id = state.get("project_id") or "default"

    # If caller already supplied a graph (e.g. single-decision intercept), skip.
    if state.get("causal_graph") is not None and not path:
        return state

    if not path:
        cached = firebase_service.read_causal_graph(project_id)
        if cached and cached.get("causal_graph"):
            state["protected_attributes"] = cached.get("protected_attributes", [])
            state["protected_attrs"] = cached.get("protected_attributes", [])
            state["causal_graph_edges"] = cached.get("causal_graph", [])
            state["adjacency_matrix"] = cached.get("adjacency_matrix")
            state["feature_names"] = cached.get("feature_names", [])
            state["column_names"] = cached.get("feature_names", [])
            state["dataset_path"] = cached.get("dataset_path", "")
            state["outcome_column"] = cached.get("outcome_column", "")
            G = nx.DiGraph()
            for e in cached["causal_graph"]:
                G.add_edge(e["source"], e["target"], weight=e.get("weight", 0.0))
            state["causal_graph"] = G
            return state
        log.warning("No dataset_path and no cached graph — skipping CARTOGRAPHER")
        return state

    df = _load_dataset(path)
    outcome_column = causal_service.infer_outcome_column(df)
    protected = gemini_service.detect_protected_attributes(df.columns.tolist())
    adj, G, cols = causal_service.discover_causal_graph(df)

    # Build spec-compliant causal_graph_edges list (used by JUDGE, SCRIBE, frontend)
    edges = data_preprocessor.adjacency_to_edges(
        adj, cols, protected, weight_threshold=0.10
    )

    try:
        firebase_service.write_causal_graph(
            project_id, edges, protected,
            adjacency_matrix=adj,
            feature_names=cols,
            dataset_path=path,
            outcome_column=outcome_column,
        )
    except Exception as e:
        log.warning("Firebase write causal graph failed: %s", e)

    state["causal_graph"] = G
    state["causal_graph_edges"] = edges          # spec field — edge list for frontend
    state["protected_attributes"] = protected
    state["protected_attrs"] = protected          # spec alias
    state["adjacency_matrix"] = adj
    state["feature_names"] = cols
    state["column_names"] = cols                  # spec alias
    state["outcome_column"] = outcome_column
    log.info(
        "CARTOGRAPHER: %d nodes, %d edges, protected=%s",
        G.number_of_nodes(), G.number_of_edges(), protected,
    )
    return state
