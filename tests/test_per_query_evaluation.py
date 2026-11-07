"""Tests for saved query metrics without downloading benchmark data."""

import json
import sys
from pathlib import Path

import pytest

from backend.app.data.beir import BeirDataset
from backend.app.evaluation.runner import evaluate_with_per_query
from backend.app.retrieval.base import Retriever, SearchResult
from scripts import evaluate as evaluate_script


class FixedRetriever(Retriever):
    def index(self, corpus):
        self.corpus = corpus

    def search(self, query, k):
        return [SearchResult(doc_id=value, score=1.0, text="") for value in {"one": ["a", "b"], "two": ["b", "a"]}[query]][:k]


def fixture_dataset() -> BeirDataset:
    return BeirDataset(corpus={"a": {"title": "A", "text": ""}, "b": {"title": "B", "text": ""}}, queries={"q1": "one", "q2": "two"}, qrels={"q1": {"a": 1}, "q2": {"a": 1}})


def test_per_query_ndcg_mean_matches_aggregate() -> None:
    dataset = fixture_dataset()
    report, rows = evaluate_with_per_query(FixedRetriever(), dataset.corpus, dataset.queries, dataset.qrels)
    assert sum(row.ndcg_at_10 for row in rows) / len(rows) == pytest.approx(report.ndcg_at_10, abs=1e-9)
    assert rows[0].first_relevant_rank == 1
    assert rows[1].first_relevant_rank == 2


def test_save_per_query_flag_leaves_default_outputs_unchanged(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    dataset = fixture_dataset()
    monkeypatch.setattr(evaluate_script, "load_dataset", lambda *_: dataset)
    monkeypatch.setattr(evaluate_script, "build_retriever", lambda *_: FixedRetriever())
    results = tmp_path / "results"
    monkeypatch.setattr(sys, "argv", ["evaluate", "--dataset", "scifact", "--method", "tfidf", "--results-dir", str(results)])
    evaluate_script.main()
    assert [path.name for path in results.iterdir()] == ["scifact_tfidf.json"]
    before = json.loads((results / "scifact_tfidf.json").read_text())

    monkeypatch.setattr(sys, "argv", ["evaluate", "--dataset", "scifact", "--method", "tfidf", "--results-dir", str(results), "--save-per-query"])
    evaluate_script.main()
    after = json.loads((results / "scifact_tfidf.json").read_text())
    for field in ("method", "dataset", "model", "query_count", "recall_at_1", "recall_at_5", "recall_at_10", "recall_at_100", "mrr_at_10", "ndcg_at_10"):
        assert after[field] == before[field]
    per_query = json.loads((results / "scifact_tfidf_perquery.json").read_text())
    assert len(per_query["queries"]) == 2
