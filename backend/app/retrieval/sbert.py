"""Dense Sentence-BERT retriever backed by a FAISS similarity index."""

from __future__ import annotations

import json
from pathlib import Path
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
        batch_size: int = 64,
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

        embeddings = self._encode(self._document_texts, show_progress_bar=True)
        self._index = faiss.IndexFlatIP(embeddings.shape[1])
        self._index.add(embeddings)

    def save(self, path: str | Path) -> None:
        """Persist the FAISS index and the document data needed to query it."""
        if self._index is None:
            raise RuntimeError("Call index() before save().")

        output_dir = Path(path)
        output_dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self._index, str(output_dir / "index.faiss"))
        metadata = {
            "model_name": self.model_name,
            "document_ids": self._document_ids,
            "document_texts": self._document_texts,
            "document_count": len(self._document_ids),
        }
        (output_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")

    def load(self, path: str | Path) -> None:
        """Load a persisted index, rejecting data built with another model."""
        input_dir = Path(path)
        metadata_path = input_dir / "metadata.json"
        index_path = input_dir / "index.faiss"
        if not metadata_path.is_file() or not index_path.is_file():
            raise FileNotFoundError(f"No saved SBERT index found in '{input_dir}'.")

        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        saved_model = metadata.get("model_name")
        if saved_model != self.model_name:
            raise ValueError(
                f"Saved index uses model '{saved_model}', but requested model is '{self.model_name}'."
            )
        document_ids = metadata.get("document_ids")
        document_texts = metadata.get("document_texts")
        document_count = metadata.get("document_count")
        if (
            not isinstance(document_ids, list)
            or not isinstance(document_texts, list)
            or document_count != len(document_ids)
            or len(document_ids) != len(document_texts)
        ):
            raise ValueError(f"Saved SBERT metadata in '{metadata_path}' is invalid.")

        index = faiss.read_index(str(index_path))
        if index.ntotal != document_count:
            raise ValueError("Saved SBERT index count does not match its metadata.")
        self._document_ids = [str(doc_id) for doc_id in document_ids]
        self._document_texts = [str(text) for text in document_texts]
        self._index = index

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

    def _encode(self, texts: list[str], show_progress_bar: bool = False) -> np.ndarray:
        """Return normalized, FAISS-compatible embeddings for ``texts``."""
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=show_progress_bar,
        )
        return np.ascontiguousarray(embeddings, dtype=np.float32)

    @staticmethod
    def _combine_document(document: Mapping[str, str]) -> str:
        """Combine optional title and text fields into one indexable document."""
        return " ".join(
            value.strip() for value in (document.get("title", ""), document.get("text", "")) if value
        )
