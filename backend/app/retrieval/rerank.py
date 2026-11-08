"""Cross-encoder reranking on top of an already selected candidate set."""

from __future__ import annotations

from collections.abc import Mapping

import torch
from sentence_transformers import CrossEncoder

from .base import Retriever, SearchResult


class RerankingRetriever(Retriever):
    """Rerank a first-stage retriever with a cross-encoder.

    Returned scores are cross-encoder scores and are not comparable with the
    first-stage retriever's scores.  ``reuse_indexed_first_stage`` allows an
    already-indexed component to be used without calling its ``index`` method.
    """

    def __init__(
        self,
        first_stage: Retriever,
        cross_encoder_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        depth: int = 100,
        batch_size: int = 32,
        *,
        reuse_indexed_first_stage: bool = False,
    ) -> None:
        if depth < 1 or batch_size < 1:
            raise ValueError("depth and batch_size must be positive.")
        self.first_stage = first_stage
        self.cross_encoder_name = cross_encoder_name
        self.depth = depth
        self.batch_size = batch_size
        self.reuse_indexed_first_stage = reuse_indexed_first_stage
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.cross_encoder = CrossEncoder(cross_encoder_name, max_length=512, device=self.device)
        self.component_index_seconds: float | None = None

    def index(self, corpus: Mapping[str, Mapping[str, str]]) -> None:
        """Index the first stage only; cross-encoders do not build an index."""
        if self.reuse_indexed_first_stage:
            self.component_index_seconds = None
            return
        self.first_stage.index(corpus)

    def search(self, query: str, k: int) -> list[SearchResult]:
        """Score each unique first-stage candidate once and return reranked results."""
        if k < 1:
            raise ValueError("k must be at least 1.")
        candidates = self.first_stage.search(query, k=self.depth)
        # A well-formed retriever has unique IDs, but de-duplicate defensively
        # so an accidental duplicate can never be scored twice.
        unique: list[SearchResult] = []
        seen: set[str] = set()
        for candidate in candidates:
            if candidate.doc_id not in seen:
                seen.add(candidate.doc_id)
                unique.append(candidate)
        if not unique:
            return []
        pairs = [(query, candidate.text) for candidate in unique]
        with torch.inference_mode():
            scores = self.cross_encoder.predict(pairs, batch_size=self.batch_size, show_progress_bar=False)
        ranked = sorted(
            enumerate(unique),
            key=lambda item: (-float(scores[item[0]]), item[0], item[1].doc_id),
        )
        return [
            SearchResult(doc_id=candidate.doc_id, score=float(scores[index]), text=candidate.text)
            for index, candidate in ranked[:k]
        ]
