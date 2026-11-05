"""Sparse TF-IDF baseline retriever."""

from __future__ import annotations

from typing import Mapping

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .base import Retriever, SearchResult


class TfidfRetriever(Retriever):
    """Rank documents using cosine similarity over TF-IDF features."""

    def __init__(self, ngram_range: tuple[int, int] = (1, 2)) -> None:
        """Create a retriever with English stop words and sublinear TF scaling."""
        self.vectorizer = TfidfVectorizer(
            stop_words="english", sublinear_tf=True, ngram_range=ngram_range
        )
        self._document_ids: list[str] = []
        self._document_texts: list[str] = []
        self._matrix = None

    def index(self, corpus: Mapping[str, Mapping[str, str]]) -> None:
        """Vectorize document titles and bodies from ``corpus``."""
        self._document_ids = list(corpus.keys())
        self._document_texts = [self._combine_document(corpus[doc_id]) for doc_id in self._document_ids]
        if not self._document_ids:
            raise ValueError("Cannot index an empty corpus.")
        self._matrix = self.vectorizer.fit_transform(self._document_texts)

    def search(self, query: str, k: int) -> list[SearchResult]:
        """Return the top ``k`` TF-IDF cosine-similar documents for ``query``."""
        if self._matrix is None:
            raise RuntimeError("Call index() before search().")
        if k < 1:
            raise ValueError("k must be at least 1.")

        query_vector = self.vectorizer.transform([query])
        scores = cosine_similarity(query_vector, self._matrix).ravel()
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
