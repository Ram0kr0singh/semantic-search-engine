"""Rank fusion retriever built from any two or more component retrievers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from time import perf_counter

from .base import Retriever, SearchResult


def fuse_rankings(
    rankings: Sequence[Sequence[SearchResult]],
    *,
    k_rrf: int = 60,
    weights: Sequence[float] | None = None,
    k: int,
) -> list[SearchResult]:
    """Fuse already-truncated rankings with deterministic weighted RRF.

    ``weights=None`` preserves the original (one contribution per component)
    RRF scores.  Explicit weights are useful for the two-component tuning
    protocol; equal explicit weights preserve the same ordering.
    """
    if k < 1 or k_rrf <= 0:
        raise ValueError("k and k_rrf must be positive.")
    if weights is None:
        component_weights = (1.0,) * len(rankings)
    else:
        if len(weights) != len(rankings) or any(weight < 0 for weight in weights):
            raise ValueError("weights must be non-negative and match the component count.")
        component_weights = tuple(float(weight) for weight in weights)
    scores: dict[str, float] = {}
    best_ranks: dict[str, int] = {}
    texts: dict[str, str] = {}
    for weight, ranking in zip(component_weights, rankings):
        for rank, result in enumerate(ranking, start=1):
            scores[result.doc_id] = scores.get(result.doc_id, 0.0) + weight / (k_rrf + rank)
            best_ranks[result.doc_id] = min(best_ranks.get(result.doc_id, rank), rank)
            texts.setdefault(result.doc_id, result.text)
    ranked_ids = sorted(scores, key=lambda doc_id: (-scores[doc_id], best_ranks[doc_id], doc_id))[:k]
    return [SearchResult(doc_id=doc_id, score=scores[doc_id], text=texts[doc_id]) for doc_id in ranked_ids]


class HybridRetriever(Retriever):
    """Fuse component rankings with RRF; fused scores are not comparable to component scores.

    Cormack, Clarke, and Buettcher (SIGIR 2009, doi:10.1145/1571941.1572114)
    define RRF as ``sum(1 / (k + rank))`` and use ``k = 60``.  This
    implementation deliberately uses that fixed constant and one-based ranks.
    """

    def __init__(
        self,
        components: Sequence[Retriever],
        k_rrf: int = 60,
        depth: int = 100,
        *,
        weights: Sequence[float] | None = None,
        reuse_indexed_components: bool = False,
    ) -> None:
        if len(components) < 2:
            raise ValueError("HybridRetriever requires at least two component retrievers.")
        if k_rrf <= 0 or depth <= 0:
            raise ValueError("k_rrf and depth must be positive.")
        self.components = list(components)
        self.k_rrf = k_rrf
        self.depth = depth
        if weights is not None and len(weights) != len(components):
            raise ValueError("weights must match the component count.")
        self.weights = tuple(weights) if weights is not None else None
        self.reuse_indexed_components = reuse_indexed_components
        self.component_index_seconds: float | None = None

    def index(self, corpus: Mapping[str, Mapping[str, str]]) -> None:
        """Index components unless the caller has explicitly supplied indexed ones."""
        if self.reuse_indexed_components:
            self.component_index_seconds = None
            return
        elapsed = 0.0
        for component in self.components:
            start = perf_counter()
            component.index(corpus)
            elapsed += perf_counter() - start
        self.component_index_seconds = elapsed

    def search(self, query: str, k: int) -> list[SearchResult]:
        """Return fused top results, breaking ties by best rank then document ID."""
        if k < 1:
            raise ValueError("k must be at least 1.")
        rankings = [component.search(query, k=self.depth) for component in self.components]
        return fuse_rankings(rankings, k_rrf=self.k_rrf, weights=self.weights, k=k)
