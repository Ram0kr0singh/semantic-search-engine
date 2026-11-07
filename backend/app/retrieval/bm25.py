"""Sparse Okapi BM25 keyword retriever."""

from __future__ import annotations

from typing import Mapping

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import CountVectorizer

from .base import Retriever, SearchResult


class BM25Retriever(Retriever):
    """Rank documents with precomputed Okapi BM25 term weights."""

    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75,
        stop_words: str | list[str] | None = "english",
    ) -> None:
        """Create a BM25 retriever with configurable term-frequency normalization."""
        if k1 <= 0:
            raise ValueError("k1 must be greater than 0.")
        if not 0 <= b <= 1:
            raise ValueError("b must be between 0 and 1.")
        self.k1 = k1
        self.b = b
        self.vectorizer = CountVectorizer(stop_words=stop_words)
        self._document_ids: list[str] = []
        self._document_texts: list[str] = []
        self._matrix: sparse.csr_matrix | None = None

    def index(self, corpus: Mapping[str, Mapping[str, str]]) -> None:
        """Precompute BM25 weights for document titles and bodies from ``corpus``."""
        self._document_ids = list(corpus.keys())
        self._document_texts = [self._combine_document(corpus[doc_id]) for doc_id in self._document_ids]
        if not self._document_ids:
            raise ValueError("Cannot index an empty corpus.")

        counts = self.vectorizer.fit_transform(self._document_texts).astype(np.float64).tocsr()
        document_lengths = np.asarray(counts.sum(axis=1)).ravel()
        average_length = document_lengths.mean()
        document_frequencies = np.asarray(counts.getnnz(axis=0)).ravel()
        document_count = counts.shape[0]
        # This Robertson IDF variant adds one inside the logarithm, keeping all
        # term weights non-negative even when a term occurs in every document.
        inverse_document_frequencies = np.log(
            1 + (document_count - document_frequencies + 0.5) / (document_frequencies + 0.5)
        )

        weights = counts.copy()
        row_indices = np.repeat(np.arange(document_count), np.diff(counts.indptr))
        normalization = self.k1 * (1 - self.b + self.b * document_lengths[row_indices] / average_length)
        weights.data = inverse_document_frequencies[weights.indices] * (
            weights.data * (self.k1 + 1) / (weights.data + normalization)
        )
        self._matrix = weights

    def search(self, query: str, k: int) -> list[SearchResult]:
        """Return up to ``k`` BM25-ranked documents for ``query``."""
        if self._matrix is None:
            raise RuntimeError("Call index() before search().")
        if k < 1:
            raise ValueError("k must be at least 1.")

        query_vector = self.vectorizer.transform([query])
        scores = np.asarray(self._matrix[:, query_vector.indices].sum(axis=1)).ravel()
        limit = min(k, len(self._document_ids))
        ranked_indices = np.argsort(-scores, kind="stable")[:limit]
        return [
            SearchResult(
                doc_id=self._document_ids[index],
                score=float(scores[index]),
                text=self._document_texts[index],
            )
            for index in ranked_indices
        ]

    @staticmethod
    def _combine_document(document: Mapping[str, str]) -> str:
        """Combine optional title and text fields into one indexable document."""
        return " ".join(
            value.strip() for value in (document.get("title", ""), document.get("text", "")) if value
        )
