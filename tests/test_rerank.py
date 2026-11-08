"""Offline tests for cross-encoder reranking without model downloads."""

from __future__ import annotations

from backend.app.retrieval.base import Retriever, SearchResult
from backend.app.retrieval.rerank import RerankingRetriever


class FirstStage(Retriever):
    def __init__(self) -> None:
        self.index_calls = 0

    def index(self, corpus):
        self.index_calls += 1

    def search(self, query, k):
        results = [
            SearchResult("b", 3, "second"),
            SearchResult("a", 2, "first"),
            SearchResult("c", 1, "third"),
            SearchResult("a", 0, "duplicate"),
        ]
        return results[:k]


class FakeCrossEncoder:
    def __init__(self, name, max_length, device):
        self.name, self.max_length, self.device = name, max_length, device
        self.calls = []

    def predict(self, pairs, batch_size, show_progress_bar):
        self.calls.append((pairs, batch_size, show_progress_bar))
        return {"second": 1.0, "first": 2.0, "third": 2.0}[pairs[0][1]] if len(pairs) == 1 else [{"second": 1.0, "first": 2.0, "third": 2.0}[text] for _, text in pairs]


def make_retriever(monkeypatch, *, depth=100, reuse=False):
    import backend.app.retrieval.rerank as rerank_module

    monkeypatch.setattr(rerank_module, "CrossEncoder", FakeCrossEncoder)
    return RerankingRetriever(FirstStage(), depth=depth, reuse_indexed_first_stage=reuse)


def test_reranking_order_ties_and_unique_scoring(monkeypatch) -> None:
    retriever = make_retriever(monkeypatch)
    results = retriever.search("query", 3)
    assert [result.doc_id for result in results] == ["a", "c", "b"]
    assert [result.score for result in results] == [2.0, 2.0, 1.0]
    pairs, batch_size, visible = retriever.cross_encoder.calls[0]
    assert pairs == [("query", "second"), ("query", "first"), ("query", "third")]
    assert batch_size == 32 and visible is False


def test_depth_truncation_and_reuse_indexed_first_stage(monkeypatch) -> None:
    retriever = make_retriever(monkeypatch, depth=2, reuse=True)
    retriever.index({"a": {"title": "A", "text": ""}})
    assert retriever.first_stage.index_calls == 0
    assert [result.doc_id for result in retriever.search("query", 100)] == ["a", "b"]
    assert len(retriever.cross_encoder.calls[0][0]) == 2


def test_index_delegates_when_stage_is_not_reused(monkeypatch) -> None:
    retriever = make_retriever(monkeypatch)
    retriever.index({"a": {"title": "A", "text": ""}})
    assert retriever.first_stage.index_calls == 1
