"""Tests for deterministic arXiv corpus construction and coverage reports."""

import argparse
import json

import pytest

from scripts.build_corpus import (
    DEFAULT_CATEGORIES,
    DEFAULT_SIZE,
    argument_parser,
    build_corpus,
    corpus_name,
    default_corpus_path,
    normalize_record,
    parse_categories,
    sample_records,
)


def paper(document_id: str, categories: str, year: str = "2024-01-01") -> dict[str, str]:
    return {
        "id": document_id,
        "title": f"Paper {document_id}",
        "abstract": f"Abstract {document_id}",
        "categories": categories,
        "update_date": year,
    }


def test_category_option_defaults_and_parsing() -> None:
    args = argument_parser().parse_args([])
    assert args.size == DEFAULT_SIZE == 60_000
    assert args.categories == DEFAULT_CATEGORIES
    assert "stat.ML" not in args.categories
    assert "stat.CO" not in args.categories
    assert "stat.ME" not in args.categories
    assert argument_parser().parse_args(["--categories", "stat.ML, cs.AI"]).categories == (
        "stat.ML",
        "cs.AI",
    )
    with pytest.raises(argparse.ArgumentTypeError):
        parse_categories("cs.AI,,cs.CL")


def test_membership_includes_a_requested_cross_list_category() -> None:
    assert normalize_record(paper("primary", "cs.AI math.NT"), ("cs.AI",)) is not None
    assert normalize_record(paper("cross-listed", "math.NT cs.AI"), ("cs.AI",)) is not None
    assert normalize_record(paper("not-matching", "math.NT stat.ML"), ("cs.AI",)) is None


def test_sampling_is_repeatable_and_category_list_changes_corpus_name(tmp_path) -> None:
    rows = [paper(f"paper-{index}", "cs.AI cs.CL" if index % 2 else "cs.CL") for index in range(12)]
    first = sample_records(rows, 5, 42, ("cs.AI", "cs.CL"))
    second = sample_records(rows, 5, 42, ("cs.AI", "cs.CL"))
    assert first == second
    assert corpus_name(60_000, ("cs.AI", "cs.CL")) == corpus_name(60_000, ("cs.CL", "cs.AI"))
    assert corpus_name(60_000, ("cs.AI",)) != corpus_name(60_000, ("cs.CL",))
    assert default_corpus_path().name == "arxiv_60000_91cee96f.jsonl"
    assert default_corpus_path().name == f"{corpus_name(DEFAULT_SIZE, DEFAULT_CATEGORIES)}.jsonl"

    path_one = tmp_path / "one" / "corpus.jsonl"
    path_two = tmp_path / "two" / "corpus.jsonl"
    build_corpus(rows, path_one, 5, 42, ("cs.AI", "cs.CL"))
    build_corpus(rows, path_two, 5, 42, ("cs.AI", "cs.CL"))
    assert path_one.read_bytes() == path_two.read_bytes()


def test_stats_report_counts_all_listed_categories_years_and_source_coverage(tmp_path, capsys) -> None:
    rows = [
        paper("one", "cs.AI cs.CL", "2024-02-01"),
        paper("two", "cs.CL cs.AI", "2023-02-01"),
        paper("three", "stat.ML cs.AI", "2024-03-01"),
        paper("four", "cs.AI", "unknown"),
    ]
    output = tmp_path / "arxiv_4_test.jsonl"
    stats = build_corpus(rows, output, 4, 42, ("cs.AI", "stat.ML"))

    assert stats["total"] == 4
    assert stats["source_category_counts"] == {"cs.AI": 4, "stat.ML": 1}
    assert stats["category_counts"] == {"cs.AI": 4, "cs.CL": 2, "stat.ML": 1}
    assert stats["first_listed_category_counts"] == {"cs.AI": 2, "cs.CL": 1, "stat.ML": 1}
    assert stats["year_counts"] == {"2023": 1, "2024": 2, "unknown": 1}
    assert json.loads(output.with_suffix(".stats.json").read_text(encoding="utf-8")) == stats
    assert "requested category stat.ML has 1 source records" in capsys.readouterr().out


def test_builder_refuses_to_overwrite_a_corpus_or_its_stats(tmp_path) -> None:
    output = tmp_path / "corpus.jsonl"
    output.write_text("existing", encoding="utf-8")
    with pytest.raises(FileExistsError, match="Refusing to overwrite"):
        build_corpus([paper("one", "cs.AI")], output, 1, 42, ("cs.AI",))
