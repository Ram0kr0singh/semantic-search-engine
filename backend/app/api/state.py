"""Small, dependency-free registry for resources owned by the API."""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock

from backend.app.retrieval.base import Retriever


@dataclass(frozen=True)
class MethodInfo:
    """Public metadata and runtime state for one retrieval method."""

    id: str
    display_name: str
    model_name: str | None = None
    ready: bool = False
    build_command: str | None = None


@dataclass
class SearchRegistry:
    """Resources loaded once for an application instance."""

    records: dict[str, dict[str, object]] = field(default_factory=dict)
    retrievers: dict[str, Retriever] = field(default_factory=dict)
    methods: dict[str, MethodInfo] = field(default_factory=dict)
    embedding_device: str = "cpu"
    sbert_lock: Lock = field(default_factory=Lock)

    @property
    def default_method(self) -> str | None:
        if self.methods.get("sbert-mpnet", MethodInfo("", "")).ready:
            return "sbert-mpnet"
        return next((method.id for method in self.methods.values() if method.ready), None)
