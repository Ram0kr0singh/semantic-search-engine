"""Metric calculation and benchmark execution."""

from .metrics import mean_reciprocal_rank_at_k, ndcg_at_k, recall_at_k

__all__ = ["mean_reciprocal_rank_at_k", "ndcg_at_k", "recall_at_k"]
