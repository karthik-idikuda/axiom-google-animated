"""AXIOM LangGraph pipeline wiring all 6 agents together."""
from __future__ import annotations

import logging

from langgraph.graph import END, StateGraph

from backend.agents import cartographer, judge, oracle, scribe, sentinel, surgeon
from backend.state import AxiomState

log = logging.getLogger("axiom.graph")


def _route_after_oracle(state: AxiomState) -> str:
    return "judge" if state.get("causal_bias_detected") else "scribe"


def _route_after_judge(state: AxiomState) -> str:
    return "surgeon" if state.get("verdict") == "FAIL" else "scribe"


def _build() -> "StateGraph":
    workflow = StateGraph(AxiomState)
    workflow.add_node("sentinel", sentinel.run)
    workflow.add_node("cartographer", cartographer.run)
    workflow.add_node("oracle", oracle.run)
    workflow.add_node("judge", judge.run)
    workflow.add_node("surgeon", surgeon.run)
    workflow.add_node("scribe", scribe.run)

    workflow.set_entry_point("sentinel")
    workflow.add_edge("sentinel", "cartographer")
    workflow.add_edge("cartographer", "oracle")
    workflow.add_conditional_edges(
        "oracle", _route_after_oracle, {"judge": "judge", "scribe": "scribe"}
    )
    workflow.add_conditional_edges(
        "judge", _route_after_judge, {"surgeon": "surgeon", "scribe": "scribe"}
    )
    workflow.add_edge("surgeon", "scribe")
    workflow.add_edge("scribe", END)
    return workflow.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = _build()
    return _graph


async def run_axiom_pipeline(initial_state: AxiomState) -> AxiomState:
    g = get_graph()
    return await g.ainvoke(initial_state)
