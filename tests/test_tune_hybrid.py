"""Offline tests for the fixed weighted-RRF tuning protocol."""

import json
from pathlib import Path

from backend.app.data.beir import BeirDataset
from backend.app.retrieval.base import SearchResult
from scripts import tune_hybrid


def test_selection_rule_prefers_half_then_smaller_weight() -> None:
    assert tune_hybrid.select_weight({.4: .5, .5: .5, .6: .5}) == .5
    assert tune_hybrid.select_weight({.3: .5, .7: .5}) == .3


def test_tuning_artifact_precedes_test_search(tmp_path: Path, monkeypatch) -> None:
    corpus = {"d1": {"text": "one"}, "d2": {"text": "two"}}
    development = BeirDataset(corpus, {"dev": "dev"}, {"dev": {"d1": 1}})
    test = BeirDataset(corpus, {"test": "test"}, {"test": {"d1": 1}})
    events: list[str] = []

    class Fake:
        def __init__(self, *args, **kwargs): pass
        def index(self, corpus): events.append("index")
        def search(self, query, k):
            events.append(f"search:{query}")
            return [SearchResult("d1", 1, "one"), SearchResult("d2", 0, "two")]

    monkeypatch.setattr(tune_hybrid, "load_development_dataset", lambda *args: development)
    monkeypatch.setattr(tune_hybrid, "load_dataset", lambda *args: test)
    monkeypatch.setattr(tune_hybrid, "BM25Retriever", Fake)
    monkeypatch.setattr(tune_hybrid, "SentenceBertRetriever", Fake)
    original_write = Path.write_text

    def recording_write(path, *args, **kwargs):
        if path.name.startswith("tuning_"):
            events.append("tuning-write")
        return original_write(path, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text", recording_write)
    tune_hybrid.run("fiqa", "sentence-transformers/all-MiniLM-L6-v2", tmp_path, tmp_path / "results", tmp_path / "analysis")
    assert events.index("tuning-write") < events.index("search:test")
    payload = json.loads(next((tmp_path / "analysis").glob("tuning_*.json")).read_text())
    assert payload["selected_w_bm25"] == .5
