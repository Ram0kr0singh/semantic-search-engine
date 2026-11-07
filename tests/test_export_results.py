import json
from pathlib import Path

from scripts.export_results import export_results


def report(**changes):
    value = {"method": "tfidf", "dataset": "fiqa", "model": None, "generated_at": "2026-01-01T00:00:00+00:00", "query_count": 1, "recall_at_1": .1, "recall_at_5": .2, "recall_at_10": .3, "recall_at_100": .4, "mrr_at_10": .2, "ndcg_at_10": .3, "index_build_seconds": 1, "average_query_latency_ms": 2}
    value.update(changes); return value


def test_exports_valid_reports_and_skips_invalid_cases(tmp_path: Path):
    source, output = tmp_path / "results", tmp_path / "docs/results"; source.mkdir(parents=True)
    (source / "valid.json").write_text(json.dumps(report()))
    (source / "missing.json").write_text(json.dumps({"method": "tfidf"}))
    (source / "range.json").write_text(json.dumps(report(ndcg_at_10=2)))
    (source / "stale.json").write_text(json.dumps(report(method="sbert", dataset="BEIR SciFact", model=None)))
    exported, skipped, summary = export_results(source, output, "test hardware")
    assert [path.name for path in exported] == ["valid.json"]
    assert {path.name for path, _ in skipped} == {"missing.json", "range.json", "stale.json"}
    assert summary["hardware_note"] == "test hardware"
    assert json.loads((output / "summary.json").read_text())["runs"] == [report()]
