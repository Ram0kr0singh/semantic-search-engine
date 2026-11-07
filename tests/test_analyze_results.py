"""Offline checks for statistical-analysis helpers."""

import json
import re
from pathlib import Path

import numpy as np

from scripts.analyze_results import analysis, breakdown, bucket_rows, holm_adjust, markdown, paired_bootstrap, win_loss_tie


def generated_report() -> tuple[dict, str]:
    report_path = Path(__file__).parents[1] / "docs" / "analysis" / "analysis.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    return report, markdown(report)


def table_cell_count(line: str) -> int:
    return len(re.findall(r"(?<!\\)\|", line)) - 1


def test_paired_bootstrap_identical_and_uniformly_better() -> None:
    identical = paired_bootstrap([0, 0, 0], np.random.default_rng(4), resamples=1000)
    assert identical["mean_difference"] == 0
    assert identical["ci_low"] <= 0 <= identical["ci_high"]
    better = paired_bootstrap([.2, .3, .4], np.random.default_rng(4), resamples=1000)
    assert better["ci_low"] > 0


def test_paired_bootstrap_add_one_correction_when_no_resample_is_extreme() -> None:
    result = paired_bootstrap([1, 1, 1], np.random.default_rng(4), resamples=10_000)
    assert result["p_value"] == 1 / 10_001
    all_extreme = paired_bootstrap([0, 0, 0], np.random.default_rng(4), resamples=10_000)
    assert all_extreme["p_value"] == 1


def test_holm_and_win_loss_tie() -> None:
    assert holm_adjust([.01, .04, .03]) == [.03, .06, .06]
    assert win_loss_tie([1, -1, 0, 2]) == {"wins": 2, "losses": 1, "ties": 1}


def test_error_examples_choose_largest_margin_and_break_ties_by_query_id() -> None:
    query_ids = ["q-c", "q-b", "q-a", "q-d"]
    differences = {"q-a": 1, "q-b": 1, "q-c": -.5, "q-d": 0}
    methods = {}
    for method in ("BM25", "TF-IDF", "MiniLM", "MPNet"):
        methods[method] = {}
        for query_id in query_ids:
            bm25_value = 1 if query_id in {"q-a", "q-b"} else 0 if query_id == "q-c" else .5
            mpnet_value = bm25_value - differences[query_id]
            value = bm25_value if method == "BM25" else mpnet_value if method == "MPNet" else .5
            methods[method][query_id] = {
                "query_id": query_id,
                "query": f"query {query_id}",
                "relevant_document_count": 1,
                "first_relevant_rank": 1,
                "ndcg_at_10": value,
                "recall_at_100": value,
            }

    result = analysis({"test": methods})["datasets"]["test"]["error_analysis"]

    assert [item["query_id"] for item in result["bm25_over_mpnet"]["examples"]] == ["q-a", "q-b"]
    assert result["bm25_over_mpnet"]["queries_at_max_margin"] == 2
    assert result["bm25_over_mpnet"]["bm25_wins"] == 2
    assert result["bm25_over_mpnet"]["mpnet_wins"] == 1
    assert result["mpnet_over_bm25"]["queries_at_max_margin"] == 1


def test_bucket_logic_splits_tertiles_and_relevance_groups() -> None:
    rows = [{"query_id": str(index), "query": "word " * (index + 1), "relevant_document_count": (1, 2, 4)[index % 3]} for index in range(6)]
    buckets = bucket_rows(rows)
    assert [len(buckets["query_length_tertiles"][name]) for name in ("short", "medium", "long")] == [2, 2, 2]
    assert [len(buckets["relevant_documents"][name]) for name in ("1", "2-3", "4+")] == [2, 2, 2]


def test_breakdown_reports_word_ranges_and_omitted_relevance_buckets() -> None:
    rows = [
        {"query_id": str(index), "query": "word " * (index + 1), "relevant_document_count": 1 if index < 40 else 2 if index < 50 else 4, "ndcg_at_10": .5}
        for index in range(60)
    ]
    result = breakdown({"BM25": {row["query_id"]: row for row in rows}})

    assert [result["query_length_tertiles"][name]["word_count_range"] for name in ("short", "medium", "long")] == [[1, 20], [21, 40], [41, 60]]
    assert result["omitted_relevant_document_buckets"] == {"2-3": 10, "4+": 10}


def test_generated_markdown_tables_have_consistent_cell_counts() -> None:
    _, text = generated_report()
    table_lines: list[str] = []
    for line in text.splitlines() + [""]:
        if line.startswith("|"):
            table_lines.append(line)
            continue
        if table_lines:
            header_count = table_cell_count(table_lines[0])
            assert table_cell_count(table_lines[1]) == header_count
            assert all(table_cell_count(row) == header_count for row in table_lines[2:])
            assert all(re.fullmatch(r":?-+:?", cell.strip()) for cell in table_lines[1].strip("|").split("|"))
            table_lines = []


def test_markdown_renders_missing_ranks_as_not_in_top_100() -> None:
    report, text = generated_report()
    missing_rank_exists = any(
        example[field] is None
        for dataset in report["datasets"].values()
        for direction in ("bm25_over_mpnet", "mpnet_over_bm25")
        for example in dataset["error_analysis"][direction]["examples"]
        for field in ("bm25_first_relevant_rank", "mpnet_first_relevant_rank")
    )

    assert missing_rank_exists
    assert "not in top 100" in text
    assert "| None |" not in text
