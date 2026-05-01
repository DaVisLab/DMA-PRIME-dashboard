"""Knowledge-graph recommendation endpoints and scoring helpers."""

from typing import Dict, List, Set

import networkx as nx
from networkx.readwrite import json_graph
from flask import (
    Blueprint,
    current_app,
    request,
)
from flask_login import current_user, login_required

bp = Blueprint("recommendation", __name__, url_prefix="/recommendation")


user_logs = {"user": []}


def _current_user_key():
    return getattr(current_user, "email", "anonymous")


def _visited_node_ids(logs):
    """Normalize stored interaction logs to a set of KG node identifiers."""
    return {log.get("kgId") for log in logs if log.get("kgId")}


@bp.route("/get_predefined_kg", methods=["GET"])
@login_required
def get_predefined_kg():
    return {
        "status": "success",
        "knowledge_graph": json_graph.node_link_data(current_app.predefined_kg),
    }


@bp.route("/save_user_logs", methods=["POST"])
@login_required
def save_user_logs():
    params = request.get_json(silent=True) or {}
    logs_queue = params.get("logs_queue", [])
    if not isinstance(logs_queue, list):
        return {"status": "error", "message": "logs_queue must be a list"}, 400

    user_key = _current_user_key()
    user_logs.setdefault(user_key, [])

    # Later scoring can use repeated interactions as weights; for now the latest
    # event per KG node is enough to prevent duplicate recommendations.
    combined = user_logs[user_key] + logs_queue

    unique = {}
    for item in combined:
        if isinstance(item, dict) and item.get("kgId"):
            unique[item["kgId"]] = item

    user_logs[user_key] = list(unique.values())
    current_app.logger.debug(
        "Saved %s KG interaction logs for %s", len(unique), user_key
    )

    return {"status": "success"}


@bp.route("/get_recommendation", methods=["GET"])
@login_required
def get_recommendation_based_on_user_logs_kg():
    user_key = _current_user_key()
    logs = user_logs.get(user_key, [])
    explored_nodes = _visited_node_ids(logs)
    if not explored_nodes:
        return {"status": "success", "recommendations": []}

    recommendations = []
    seen_ids = set()

    for current_node in explored_nodes:
        recommended_items, _ = recommend_regions(
            current_app.predefined_kg,
            target=current_node,
            visited_set=explored_nodes,
        )
        for item in recommended_items:
            item_id = item["node"]

            if item_id not in seen_ids:
                seen_ids.add(item_id)
                recommendations.append(item)

    return {"status": "success", "recommendations": recommendations}


def get_candidates(
    G: nx.Graph, target: str, relation: str = "SIMILAR_SEASONAL"
) -> List[str]:
    """Return neighbors connected by the relation used for similarity suggestions."""
    if target not in G:
        return []

    candidates = []
    for nbr in G.neighbors(target):
        edge_data = G.get_edge_data(target, nbr)
        if edge_data and edge_data.get("relation") == relation:
            candidates.append(nbr)
    return candidates


def score_similarity(G: nx.Graph, target: str, candidate: str) -> float:
    edge_data = G.get_edge_data(target, candidate)
    if not edge_data:
        return 0.0
    return float(edge_data.get("weight", 0.0))


def score_novelty(
    candidate: str, visited_set: Set[str], popularity: Dict[str, float] = None
) -> float:
    if candidate in visited_set:
        return 0.0

    pop = popularity.get(candidate, 0.0) if popularity else 0.0
    # popularity가 낮을수록 novelty가 높아짐
    return 1.0 / (1.0 + pop)


def score_trend(trend_metrics: Dict[str, Dict[str, float]], candidate: str) -> float:
    """
    trend_metrics[candidate] 예:
    {
        "slope": 0.8,
        "recent_growth": 0.6,
        "volatility": 0.2
    }
    """
    m = trend_metrics.get(candidate, {})
    slope = m.get("slope", 0.0)
    growth = m.get("recent_growth", 0.0)

    return 0.6 * slope + 0.4 * growth


def score_diversity(G: nx.Graph, candidate: str, selected: List[str]) -> float:
    if not selected:
        return 1.0

    sims = []
    for s in selected:
        edge_data = G.get_edge_data(candidate, s)
        if edge_data:
            sims.append(float(edge_data.get("weight", 0.0)))

    if not sims:
        return 1.0

    return 1.0 - max(sims)


def score_serendipity(relevance: float, novelty: float, diversity: float) -> float:
    return 0.5 * relevance + 0.3 * novelty + 0.2 * diversity


def recommend_regions(
    G: nx.Graph,
    target: str,
    visited_set: Set[str],
    popularity: Dict[str, float] = None,
    top_k: int = 10,
):
    candidates = get_candidates(G, target, relation="SIMILAR_SEASONAL")

    pool = []
    selected_so_far = []

    for c in candidates:
        if c in visited_set:
            continue

        relevance = score_similarity(G, target, c)
        novelty = score_novelty(c, visited_set, popularity)

        pool.append(
            {
                "node": c,
                "relevance": relevance,
                "novelty": novelty,
            }
        )

    ranked = []
    while pool and len(ranked) < top_k:
        for item in pool:
            diversity = score_diversity(G, item["node"], selected_so_far)
            serendipity = score_serendipity(
                item["relevance"], item["novelty"], diversity
            )
            item["diversity"] = diversity
            item["serendipity"] = serendipity
            item["score"] = (
                0.4 * item["relevance"]
                + 0.2 * item["novelty"]
                + 0.1 * diversity
                + 0.1 * serendipity
            )

        best_item = max(pool, key=lambda x: x["score"])
        ranked.append(dict(best_item))
        selected_so_far.append(best_item["node"])
        pool.remove(best_item)

    final_list = [item["node"] for item in ranked]

    return ranked, final_list
