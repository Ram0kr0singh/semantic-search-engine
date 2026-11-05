"""Dense Sentence-BERT retriever backed by a FAISS similarity index."""

from __future__ import annotations

from typing import Mapping

import faiss
import numpy as np
import torch
from sentence_transformers import SentenceTransformer

from .base import Retriever, SearchResult


class SentenceBertRetriever(Retriever):
    """Rank documents by cosine similarity between Sentence-BERT embeddings."""

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        batch_size: int = 32,
    ) -> None:
        """Load ``model_name`` on CUDA when available, otherwise on CPU."""
        self.model_name = model_name
        self.batch_size = batch_size
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = SentenceTransformer(model_name, device=self.device)
        self._document_ids: list[str] = []
        self._document_texts: list[str] = []
        self._index: faiss.Index | None = None

    def index(self, corpus: Mapping[str, Mapping[str, str]]) -> None:
        """Encode document titles and bodies, then build a cosine-similarity index."""
        self._document_ids = list(corpus.keys())
        self._document_texts = [self._combine_document(corpus[doc_id]) for doc_id in self._document_ids]
        if not self._document_ids:
            raise ValueError("Cannot index an empty corpus.")

        embeddings = self._encode(self._document_texts)
        self._index = faiss.IndexFlatIP(embeddings.shape[1])
        self._index.add(embeddings)

    def search(self, query: str, k: int) -> list[SearchResult]:
        """Return the top ``k`` cosine-similar documents for ``query``."""
        if self._index is None:
            raise RuntimeError("Call index() before search().")
        if k < 1:
            raise ValueError("k must be at least 1.")

        scores, indices = self._index.search(self._encode([query]), min(k, len(self._document_ids)))
        return [
            SearchResult(
                doc_id=self._document_ids[index],
                score=float(score),
                text=self._document_texts[index],
            )
            for score, index in zip(scores[0], indices[0])
            if index >= 0
        ]

    def _encode(self, texts: list[str]) -> np.ndarray:
        """Return normalized, FAISS-compatible embeddings for ``texts``."""
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return np.ascontiguousarray(embeddings, dtype=np.float32)

    @staticmethod
    def _combine_document(document: Mapping[str, str]) -> str:
        """Combine optional title and text fields into one indexable document."""
        return " ".join(
            value.strip() for value in (document.get("title", ""), document.get("text", "")) if value
        )
