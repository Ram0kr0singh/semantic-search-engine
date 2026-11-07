"""Offline unit tests for reciprocal-rank fusion."""

import pytest

from backend.app.retrieval.base import Retriever, SearchResult
from backend.app.retrieval.hybrid import HybridRetriever
from scripts import evaluate as evaluate_script


class FakeRetriever(Retriever):
    def __init__(self, rankings: dict[str, list[str]]) -> None:
        self.rankings = rankings
        self.index_calls = 0

    def index(self, corpus):
        self.index_calls += 1

    def search(self, query, k):
        return [SearchResult(doc_id=doc_id, score=float(len(self.rankings[query]) - rank), text=doc_id) for rank, doc_id in enumerate(self.rankings[query][:k])]


def test_rrf_scores_include_documents_from_one_component() -> None:
    hybrid = HybridRetriever([FakeRetriever({"q": ["a", "b"]}), FakeRetriever({"q": ["b", "c"]})])
    results = hybrid.search("q", 3)
    assert [item.doc_id for item in results] == ["b", "a", "c"]
    assert results[0].score == pytest.approx(1 / 62 + 1 / 61)
    assert results[1].score == pytest.approx(1 / 61)


def test_rrf_ties_depth_order_and_identical_rankings() -> None:
    tied = HybridRetriever([FakeRetriever({"q": ["b"]}), FakeRetriever({"q": ["a"]})])
    assert [item.doc_id for item in tied.search("q", 2)] == ["a", "b"]
    depth = HybridRetriever([FakeRetriever({"q": ["a", "b"]}), FakeRetriever({"q": ["c", "b"]})], depth=1)
    assert [item.doc_id for item in depth.search("q", 3)] == ["a", "c"]
    same = HybridRetriever([FakeRetriever({"q": ["a", "b", "c"]}), FakeRetriever({"q": ["a", "b", "c"]})])
    assert [item.doc_id for item in same.search("q", 3)] == ["a", "b", "c"]


def test_indexing_and_reuse() -> None:
    first, second = FakeRetriever({"q": []}), FakeRetriever({"q": []})
    HybridRetriever([first, second]).index({"a": {"text": "a"}})
    assert (first.index_calls, second.index_calls) == (1, 1)
    HybridRetriever([first, second], reuse_indexed_components=True).index({"a": {"text": "a"}})
    assert (first.index_calls, second.index_calls) == (1, 1)


def test_evaluate_cli_registers_hybrid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(evaluate_script, "SentenceBertRetriever", lambda **_: FakeRetriever({"q": []}))
    assert isinstance(evaluate_script.build_retriever("hybrid", "sentence-transformers/all-MiniLM-L6-v2"), HybridRetriever)
    assert evaluate_script.result_filename("scifact", "hybrid", "sentence-transformers/all-MiniLM-L6-v2") == "scifact_hybrid_all-minilm-l6-v2.json"
