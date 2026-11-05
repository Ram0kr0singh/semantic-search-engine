"""Evaluation harness for a retriever and a BEIR-style test split."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from time import perf_counter
from typing import Mapping

from backend.app.retrieval.base import Retriever

from .metrics import mean_reciprocal_rank_at_k, ndcg_at_k, recall_at_k


@dataclass(frozen=True)
class EvaluationReport:
    """Aggregate benchmark metrics and timing information."""

    query_count: int
    recall_at_1: float
    recall_at_5: float
    recall_at_10: float
    recall_at_100: float
    mrr_at_10: float
    ndcg_at_10: float
    index_build_seconds: float
    average_query_latency_ms: float

    def to_dict(self) -> dict[str, float | int]:
        """Return this report as JSON-serializable primitives."""
        return asdict(self)


def evaluate(
    retriever: Retriever,
    corpus: Mapping[str, Mapping[str, str]],
    queries: Mapping[str, str],
    qrels: Mapping[str, Mapping[str, int]],
) -> EvaluationReport:
    """Index ``corpus``, execute queries, and aggregate standard retrieval metrics."""
    index_start = perf_counter()
    retriever.index(corpus)
    index_build_seconds = perf_counter() - index_start

    rankings: dict[str, list[str]] = {}
    query_durations: list[float] = []
    for query_id, query in queries.items():
        start = perf_counter()
        results = retriever.search(query, k=100)
        query_durations.append(perf_counter() - start)
        rankings[query_id] = [result.doc_id for result in results]

    evaluated_ids = [query_id for query_id in queries if query_id in qrels]
    if not evaluated_ids:
        raise ValueError("No query IDs overlap with qrels.")

    def average_recall(k: int) -> float:
        return sum(recall_at_k(rankings[query_id], qrels[query_id], k) for query_id in evaluated_ids) / len(evaluated_ids)

    average_ndcg = sum(ndcg_at_k(rankings[query_id], qrels[query_id], 10) for query_id in evaluated_ids) / len(evaluated_ids)
    matching_qrels = {query_id: qrels[query_id] for query_id in evaluated_ids}
    return EvaluationReport(
        query_count=len(evaluated_ids),
        recall_at_1=average_recall(1),
        recall_at_5=average_recall(5),
        recall_at_10=average_recall(10),
        recall_at_100=average_recall(100),
        mrr_at_10=mean_reciprocal_rank_at_k(rankings, matching_qrels, 10),
        ndcg_at_10=average_ndcg,
        index_build_seconds=index_build_seconds,
        average_query_latency_ms=(sum(query_durations) / len(query_durations) * 1000),
    )
