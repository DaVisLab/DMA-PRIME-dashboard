from typing import List, Dict, Tuple, Set
import pandas as pd
import networkx as nx
from typing import Optional
from flask import (
    Blueprint,
    flash,
    send_file,
    redirect,
    url_for,
    render_template,
    current_app,
    request,
)
import os

bp = Blueprint("recommendation", __name__, url_prefix="/recommendation")


user_logs = {"user":[]
}

@bp.route("/save_user_logs", methods=["POST"])
def save_user_logs():
    
    print(list(current_app.predefined_kg.nodes(data=True))[:5])

    # print("save user logs")
    # global user_logs
    # data = request.get_json()
    # print(data)
    # user_logs.update(data)
    return {"status": "success"}

@bp.route("/get_recommendation", methods=["GET"])
def get_recommendation_based_on_user_logs_kg():
    print("get recommendation")
    target = "state_SC_region_Upstate_county_Abbeville"
    recommended_items=recommend_regions(current_app.predefined_kg, target=target, visited_set=user_logs["user"])
    return {"status": "success", "recommendations": recommended_items}

def get_candidates(G: nx.Graph, target: str, relation: str = "SIMILAR_SEASONAL") -> List[str]:
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

def score_novelty(candidate: str, visited_set: Set[str], popularity: Dict[str, float] = None) -> float:
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

def score_diversity(
    G: nx.Graph,
    candidate: str,
    selected: List[str]
) -> float:
    if not selected:
        return 1.0

    sims = []
    for s in selected:
        edge_data = G.get_edge_data(candidate, s)
        if edge_data:
            sims.append(float(edge_data.get("weight", 0.0)))

    if not sims:
        return 1.0

    # selected와 덜 비슷할수록 diversity 높음
    return 1.0 - max(sims)

def score_serendipity(
    relevance: float,
    novelty: float,
    diversity: float
) -> float:
    return 0.5 * relevance + 0.3 * novelty + 0.2 * diversity


def recommend_regions(
    G: nx.Graph,
    target: str,
    visited_set: Set[str],
    # trend_metrics: Dict[str, Dict[str, float]],
    popularity: Dict[str, float] = None,
    top_k: int = 10,
):
    candidates = get_candidates(G, target, relation="SIMILAR_SEASONAL")

    ranked = []
    selected_so_far = []

    for c in candidates:
        if c in visited_set:
            continue

        relevance = score_similarity(G, target, c)
        novelty = score_novelty(c, visited_set, popularity)
        # trend = score_trend(trend_metrics, c)
        diversity = score_diversity(G, c, selected_so_far)
        serendipity = score_serendipity(relevance, novelty, diversity)

        final_score = (
            0.4 * relevance +
            0.2 * novelty +
            # 0.2 * trend +
            0.1 * diversity +
            0.1 * serendipity
        )

        ranked.append({
            "node": c,
            "score": final_score,
            "relevance": relevance,
            "novelty": novelty,
            # "trend": trend,
            "diversity": diversity,
            "serendipity": serendipity,
        })

    ranked = sorted(ranked, key=lambda x: x["score"], reverse=True)

    # diversity를 더 강하게 적용하고 싶으면 greedy rerank
    final_list = []
    for item in ranked:
        if len(final_list) >= top_k:
            break
        final_list.append(item["node"])

    return ranked[:top_k], final_list

