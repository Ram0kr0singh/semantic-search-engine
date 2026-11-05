"""Unit tests for ranking metrics."""

import math

import pytest

from backend.app.evaluation.metrics import (
    mean_reciprocal_rank_at_k,
    ndcg_at_k,
    recall_at_k,
    reciprocal_rank_at_k,
)


def test_recall_at_k_handles_multiple_relevant_documents() -> None:
    assert recall_at_k(["a", "b", "c"], {"a": 1, "d": 1}, 2) == 0.5


def test_reciprocal_rank_at_k_uses_first_relevant_result() -> None:
    assert reciprocal_rank_at_k(["x", "b", "a"], {"a": 1, "b": 1}, 10) == 0.5


def test_ndcg_at_k_uses_graded_relevance() -> None:
    score = ndcg_at_k(["a", "b"], {"a": 1, "b": 3}, 2)
    expected = (1 + 7 / math.log2(3)) / (7 + 1 / math.log2(3))
    assert score == pytest.approx(expected)


def test_mrr_at_k_averages_queries() -> None:
    rankings = {"q1": ["a"], "q2": ["x", "b"]}
    qrels = {"q1": {"a": 1}, "q2": {"b": 1}}
    assert mean_reciprocal_rank_at_k(rankings, qrels, 10) == 0.75
