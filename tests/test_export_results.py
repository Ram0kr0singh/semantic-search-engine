import json
from pathlib import Path

import pytest

from scripts.export_results import export_per_query_results, export_results


def report(**changes):
    value = {"method": "tfidf", "dataset": "fiqa", "model": None, "generated_at": "2026-01-01T00:00:00+00:00", "query_count": 1, "recall_at_1": .1, "recall_at_5": .2, "recall_at_10": .3, "recall_at_100": .4, "mrr_at_10": .2, "ndcg_at_10": .3, "index_build_seconds": 1, "average_query_latency_ms": 2}
    value.update(changes); return value


@pytest.mark.parametrize(
    ("changes", "missing_field", "reason"),
    [
        ({}, "recall_at_1", "missing required fields: recall_at_1"),
        ({"ndcg_at_10": 1.5}, None, "ndcg_at_10 must be in [0, 1]"),
        ({"average_query_latency_ms": -1}, None, "average_query_latency_ms must be non-negative"),
        ({"method": "sbert", "model": None}, None, "stale SBERT report without a model identity"),
    ],
)
def test_skips_invalid_reports(tmp_path: Path, changes: dict, missing_field: str | None, reason: str) -> None:
    source, output = tmp_path / "results", tmp_path / "docs" / "results"
    source.mkdir(parents=True)
    payload = report(**changes)
    if missing_field:
        del payload[missing_field]
    (source / "invalid.json").write_text(json.dumps(payload))

    exported, skipped, _ = export_results(source, output, "test hardware")

    assert exported == []
    assert skipped == [(source / "invalid.json", reason)]


def test_exports_valid_report(tmp_path: Path) -> None:
    source, output = tmp_path / "results", tmp_path / "docs" / "results"
    source.mkdir(parents=True)
    (source / "valid.json").write_text(json.dumps(report()))
    exported, skipped, summary = export_results(source, output, "test hardware")

    assert [path.name for path in exported] == ["valid.json"]
    assert skipped == []
    assert summary["hardware_note"] == "test hardware"
    assert json.loads((output / "summary.json").read_text())["runs"] == [report()]


def test_exports_valid_per_query_report(tmp_path: Path) -> None:
    source, output = tmp_path / "results", tmp_path / "docs" / "results"
    source.mkdir(parents=True)
    per_query = {"method": "tfidf", "dataset": "fiqa", "model": None, "generated_at": "2026-01-01T00:00:00+00:00", "query_count": 1, "queries": [{"query_id": "q", "query": "test", "relevant_document_count": 1, "ndcg_at_10": .3, "mrr_at_10": .2, "recall_at_10": .3, "recall_at_100": .4, "first_relevant_rank": 2}]}
    (source / "fiqa_tfidf_perquery.json").write_text(json.dumps(per_query))
    exported, skipped = export_per_query_results(source, output)
    assert [path.name for path in exported] == ["fiqa_tfidf_perquery.json"]
    assert skipped == []


def test_exports_valid_tuned_hybrid_and_per_query_reports(tmp_path: Path) -> None:
    source, output = tmp_path / "results", tmp_path / "docs" / "results"
    source.mkdir(parents=True)
    fusion = {"method": "weighted-rrf", "k_rrf": 60, "depth": 100, "components": ["bm25", "sbert"], "w_bm25": .3, "grid": [index / 10 for index in range(11)], "selection_rule": "highest nDCG", "development_split": "validation", "development_query_count": 2}
    tuned = report(method="hybrid-tuned", model="sentence-transformers/all-MiniLM-L6-v2", fusion=fusion)
    per_query = {"method": "hybrid-tuned", "dataset": "fiqa", "model": tuned["model"], "generated_at": tuned["generated_at"], "query_count": 1, "fusion": fusion, "queries": [{"query_id": "q", "query": "test", "relevant_document_count": 1, "ndcg_at_10": .3, "mrr_at_10": .2, "recall_at_10": .3, "recall_at_100": .4, "first_relevant_rank": 2}]}
    (source / "fiqa_hybrid-tuned_all-minilm-l6-v2.json").write_text(json.dumps(tuned))
    (source / "fiqa_hybrid-tuned_all-minilm-l6-v2_perquery.json").write_text(json.dumps(per_query))
    exported, skipped, _ = export_results(source, output, "test")
    per_exported, per_skipped = export_per_query_results(source, output)
    assert [path.name for path in exported] == ["fiqa_hybrid-tuned_all-minilm-l6-v2.json"]
    assert skipped == []
    assert [path.name for path in per_exported] == ["fiqa_hybrid-tuned_all-minilm-l6-v2_perquery.json"]
    assert per_skipped == []


def test_exports_real_shape_tuned_run_with_null_end_to_end_latency(tmp_path: Path) -> None:
    source, output = tmp_path / "results", tmp_path / "docs" / "results"
    source.mkdir(parents=True)
    fusion = {"method": "weighted-rrf", "k_rrf": 60, "depth": 100, "components": ["bm25", "sbert"], "w_bm25": .7, "grid": [index / 10 for index in range(11)], "selection_rule": "highest mean nDCG@10; ties: closest to 0.5, then smaller weight", "development_split": "train", "development_query_count": 809}
    # Copied from the SciFact MiniLM hybrid-tuned entry in summary.json.
    tuned = report(method="hybrid-tuned", dataset="scifact", model="sentence-transformers/all-MiniLM-L6-v2", average_query_latency_ms=.12751733336093216, fusion=fusion)
    (source / "scifact_hybrid-tuned_all-minilm-l6-v2.json").write_text(json.dumps(tuned))
    exported, skipped, summary = export_results(source, output, "test")
    assert [path.name for path in exported] == ["scifact_hybrid-tuned_all-minilm-l6-v2.json"]
    assert skipped == []
    snapshot = summary["runs"][0]
    assert snapshot["average_query_latency_ms"] is None
    assert snapshot["fusion_only_latency_ms"] == .12751733336093216
    assert snapshot["latency_note"] == "fusion of saved component rankings only; not an end-to-end query time"
    assert json.loads((source / "scifact_hybrid-tuned_all-minilm-l6-v2.json").read_text())["average_query_latency_ms"] == .12751733336093216


def test_rejects_null_latency_for_non_tuned_runs(tmp_path: Path) -> None:
    source, output = tmp_path / "results", tmp_path / "docs" / "results"
    source.mkdir(parents=True)
    (source / "invalid.json").write_text(json.dumps(report(average_query_latency_ms=None)))
    exported, skipped, _ = export_results(source, output, "test")
    assert exported == []
    assert skipped == [(source / "invalid.json", "average_query_latency_ms is not numeric")]


def test_exports_valid_rerank_reports(tmp_path: Path) -> None:
    source, output = tmp_path / "results", tmp_path / "docs" / "results"
    source.mkdir(parents=True)
    reranking = {"first_stage": "bm25", "dense_model": None, "cross_encoder": "cross-encoder/ms-marco-MiniLM-L-6-v2", "depth": 100, "batch_size": 32}
    run = report(method="rerank", reranking=reranking)
    query = {"method": "rerank", "dataset": "fiqa", "model": None, "generated_at": run["generated_at"], "query_count": 1, "reranking": reranking, "queries": [{"query_id": "q", "query": "test", "relevant_document_count": 1, "ndcg_at_10": .3, "mrr_at_10": .2, "recall_at_10": .3, "recall_at_100": .4, "first_relevant_rank": 2}]}
    (source / "fiqa_rerank-bm25.json").write_text(json.dumps(run))
    (source / "fiqa_rerank-bm25_perquery.json").write_text(json.dumps(query))
    exported, skipped, _ = export_results(source, output, "test")
    per_exported, per_skipped = export_per_query_results(source, output)
    assert [path.name for path in exported] == ["fiqa_rerank-bm25.json"]
    assert skipped == []
    assert [path.name for path in per_exported] == ["fiqa_rerank-bm25_perquery.json"]
    assert per_skipped == []
