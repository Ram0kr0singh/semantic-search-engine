"""Abstract interfaces shared by document retrievers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class SearchResult:
    """One ranked document returned by a retriever.

    Attributes:
        doc_id: Stable identifier for the corpus document.
        score: Retrieval score, ordered from highest to lowest.
        text: Displayable document text or snippet.
    """

    doc_id: str
    score: float
    text: str


class Retriever(ABC):
    """Contract for retrievers that index a corpus and rank documents."""

    @abstractmethod
    def index(self, corpus: Mapping[str, Mapping[str, str]]) -> None:
        """Build an index for a corpus keyed by document identifier."""

    @abstractmethod
    def search(self, query: str, k: int) -> list[SearchResult]:
        """Return up to ``k`` results for ``query`` in descending score order."""
