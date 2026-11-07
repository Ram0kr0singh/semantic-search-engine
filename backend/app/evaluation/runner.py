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


@dataclass(frozen=True)
class PerQueryMetrics:
    """Metrics for one judged query, calculated from its retrieved ranking."""

    query_id: str
    query: str
    relevant_document_count: int
    ndcg_at_10: float
    mrr_at_10: float
    recall_at_10: float
    recall_at_100: float
    first_relevant_rank: int | None

    def to_dict(self) -> dict[str, str | int | float | None]:
        """Return a JSON-serializable representation."""
        return asdict(self)


def evaluate(
    retriever: Retriever,
    corpus: Mapping[str, Mapping[str, str]],
    queries: Mapping[str, str],
    qrels: Mapping[str, Mapping[str, int]],
) -> EvaluationReport:
    """Index ``corpus``, execute queries, and aggregate standard retrieval metrics."""
    report, _ = _evaluate(retriever, corpus, queries, qrels, collect_per_query=False)
    return report


def evaluate_with_per_query(
    retriever: Retriever,
    corpus: Mapping[str, Mapping[str, str]],
    queries: Mapping[str, str],
    qrels: Mapping[str, Mapping[str, int]],
) -> tuple[EvaluationReport, list[PerQueryMetrics]]:
    """Evaluate once and return the aggregate report and its component query scores."""
    report, per_query = _evaluate(retriever, corpus, queries, qrels, collect_per_query=True)
    assert per_query is not None
    # Keep the report and saved query values inseparable: any future metric change
    # that makes them diverge must fail loudly rather than write misleading output.
    mean_ndcg = sum(item.ndcg_at_10 for item in per_query) / len(per_query)
    assert abs(mean_ndcg - report.ndcg_at_10) <= 1e-9
    return report, per_query


def _evaluate(
    retriever: Retriever,
    corpus: Mapping[str, Mapping[str, str]],
    queries: Mapping[str, str],
    qrels: Mapping[str, Mapping[str, int]],
    *,
    collect_per_query: bool,
) -> tuple[EvaluationReport, list[PerQueryMetrics] | None]:
    """Shared implementation for aggregate-only and query-level evaluation."""
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
    report = EvaluationReport(
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
    if not collect_per_query:
        return report, None

    per_query = []
    for query_id in evaluated_ids:
        relevant = qrels[query_id]
        relevant_ids = {doc_id for doc_id, grade in relevant.items() if grade > 0}
        first_relevant_rank = next(
            (rank for rank, doc_id in enumerate(rankings[query_id][:100], start=1) if doc_id in relevant_ids),
            None,
        )
        per_query.append(
            PerQueryMetrics(
                query_id=query_id,
                query=queries[query_id],
                relevant_document_count=len(relevant_ids),
                ndcg_at_10=ndcg_at_k(rankings[query_id], relevant, 10),
                mrr_at_10=mean_reciprocal_rank_at_k({query_id: rankings[query_id]}, {query_id: relevant}, 10),
                recall_at_10=recall_at_k(rankings[query_id], relevant, 10),
                recall_at_100=recall_at_k(rankings[query_id], relevant, 100),
                first_relevant_rank=first_relevant_rank,
            )
        )
    return report, per_query
