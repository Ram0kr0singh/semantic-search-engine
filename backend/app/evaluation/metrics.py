"""Small, dependency-light ranking metrics for relevance evaluation."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence


def recall_at_k(ranked_doc_ids: Sequence[str], relevant: Mapping[str, int], k: int) -> float:
    """Compute Recall@k for one query, treating positive qrels as relevant."""
    relevant_ids = {doc_id for doc_id, grade in relevant.items() if grade > 0}
    if not relevant_ids:
        return 0.0
    return len(set(ranked_doc_ids[:k]) & relevant_ids) / len(relevant_ids)


def reciprocal_rank_at_k(ranked_doc_ids: Sequence[str], relevant: Mapping[str, int], k: int) -> float:
    """Compute reciprocal rank through rank ``k`` for one query."""
    relevant_ids = {doc_id for doc_id, grade in relevant.items() if grade > 0}
    for rank, doc_id in enumerate(ranked_doc_ids[:k], start=1):
        if doc_id in relevant_ids:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(ranked_doc_ids: Sequence[str], relevant: Mapping[str, int], k: int) -> float:
    """Compute graded normalized discounted cumulative gain through rank ``k``."""
    dcg = sum(
        (2**relevant.get(doc_id, 0) - 1) / math.log2(rank + 1)
        for rank, doc_id in enumerate(ranked_doc_ids[:k], start=1)
    )
    ideal_grades = sorted((grade for grade in relevant.values() if grade > 0), reverse=True)[:k]
    ideal_dcg = sum(
        (2**grade - 1) / math.log2(rank + 1)
        for rank, grade in enumerate(ideal_grades, start=1)
    )
    return dcg / ideal_dcg if ideal_dcg else 0.0


def mean_reciprocal_rank_at_k(
    rankings: Mapping[str, Sequence[str]], qrels: Mapping[str, Mapping[str, int]], k: int
) -> float:
    """Compute MRR@k across queries that have relevance judgments."""
    judged_query_ids = [query_id for query_id, relevant in qrels.items() if any(v > 0 for v in relevant.values())]
    if not judged_query_ids:
        return 0.0
    return sum(reciprocal_rank_at_k(rankings.get(query_id, []), qrels[query_id], k) for query_id in judged_query_ids) / len(judged_query_ids)
