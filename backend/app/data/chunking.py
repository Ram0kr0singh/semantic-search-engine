"""Utilities for splitting uploaded text into overlapping sentence passages."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Passage:
    """A passage and the document location from which it was created."""

    text: str
    source_document_id: str
    passage_index: int


def chunk_text(
    text: str,
    source_document_id: str,
    max_words: int = 150,
    overlap_words: int = 30,
) -> list[Passage]:
    """Split text into sentence-aware, word-overlapping passages.

    A sentence longer than ``max_words`` is split by words so every resulting
    passage respects the configured size limit.
    """
    if max_words < 1:
        raise ValueError("max_words must be at least 1.")
    if not 0 <= overlap_words < max_words:
        raise ValueError("overlap_words must be non-negative and smaller than max_words.")
    normalized = " ".join(text.split())
    if not normalized:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", normalized)
    units: list[list[str]] = []
    for sentence in sentences:
        words = sentence.split()
        if len(words) <= max_words:
            units.append(words)
            continue
        step = max_words - overlap_words
        for start in range(0, len(words), step):
            chunk = words[start : start + max_words]
            if not chunk:
                break
            units.append(chunk)
            if start + max_words >= len(words):
                break

    passages: list[list[str]] = []
    current: list[str] = []
    for unit in units:
        if current and len(current) + len(unit) > max_words:
            passages.append(current)
            current = current[-overlap_words:] if overlap_words else []
        if len(current) + len(unit) > max_words:
            # This is only reachable after a split unit and overlap together
            # exceed the limit; keep the newest words for a valid passage.
            available = max_words - len(unit)
            current = current[-available:] if available else []
        current.extend(unit)
    if current:
        passages.append(current)

    return [
        Passage(text=" ".join(words), source_document_id=source_document_id, passage_index=index)
        for index, words in enumerate(passages)
    ]
