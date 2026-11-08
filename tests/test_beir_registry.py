"""Fast, offline tests for BEIR registry helpers and result naming."""

import pytest

from backend.app.data.beir import DATASET_REGISTRY, BeirDataset, _build_dataset, assert_disjoint_queries, dataset_names
from scripts.evaluate import result_filename


def test_registry_has_scifact_and_fiqa() -> None:
    assert dataset_names() == ("scifact", "fiqa")
    assert DATASET_REGISTRY["fiqa"].corpus_dataset == "BeIR/fiqa"
    assert DATASET_REGISTRY["fiqa"].qrels_dataset == "BeIR/fiqa-qrels"


def test_dataset_fixture_counts_individual_qrels() -> None:
    dataset = BeirDataset(
        corpus={"1": {"title": "", "text": "example"}},
        queries={"q": "question"},
        qrels={"q": {"1": 2, "2": 0}},
    )
    assert dataset.qrel_count == 2


def test_registry_loader_normalizes_fixture_ids_and_filters_to_test_qrels() -> None:
    dataset = _build_dataset(
        [{"_id": 1, "title": None, "text": "body"}],
        [{"_id": 10, "text": "kept"}, {"_id": 20, "text": "other split"}],
        [{"query-id": 10, "corpus-id": 1, "score": 2}],
    )
    assert dataset.corpus == {"1": {"title": "", "text": "body"}}
    assert dataset.queries == {"10": "kept"}
    assert dataset.qrels == {"10": {"1": 2}}


def test_sbert_result_filename_includes_safe_model_slug() -> None:
    assert result_filename("fiqa", "sbert", "sentence-transformers/all-mpnet-base-v2") == (
        "fiqa_sbert_all-mpnet-base-v2.json"
    )
    assert result_filename("scifact", "tfidf") == "scifact_tfidf.json"
    assert result_filename("fiqa", "sbert", "sentence-transformers/all-MiniLM-L6-v2") != result_filename(
        "fiqa", "sbert", "sentence-transformers/all-mpnet-base-v2"
    )


def test_development_and_test_queries_must_be_disjoint() -> None:
    development = BeirDataset({}, {"dev": "question"}, {"dev": {"1": 1}})
    test = BeirDataset({}, {"test": "question"}, {"test": {"1": 1}})
    assert_disjoint_queries(development, test)
    with pytest.raises(ValueError, match="overlap"):
        assert_disjoint_queries(development, BeirDataset({}, {"dev": "question"}, {"dev": {"1": 1}}))
