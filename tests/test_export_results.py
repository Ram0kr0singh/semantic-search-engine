import json
from pathlib import Path

import pytest

from scripts.export_results import export_results


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
