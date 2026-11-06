"""Unit tests for the Sentence-BERT retriever."""

import json

import pytest

from backend.app.retrieval.sbert import SentenceBertRetriever


def test_sbert_ranks_semantic_match_without_shared_keywords() -> None:
    retriever = SentenceBertRetriever()
    retriever.index(
        {
            "cloud-costs": {"text": "I need to lower my cloud hosting bill."},
            "garden": {"text": "Tomato plants thrive with sunlight and regular watering."},
            "music": {"text": "The orchestra rehearsed a new symphony for the concert."},
        }
    )

    results = retriever.search("reducing AWS spend", k=3)

    assert results[0].doc_id == "cloud-costs"


def test_sbert_search_results_are_descending_by_score() -> None:
    retriever = SentenceBertRetriever()
    retriever.index(
        {
            "cloud-costs": {"text": "I need to lower my cloud hosting bill."},
            "garden": {"text": "Tomato plants thrive with sunlight and regular watering."},
            "music": {"text": "The orchestra rehearsed a new symphony for the concert."},
        }
    )

    results = retriever.search("reducing AWS spend", k=3)

    assert [result.score for result in results] == sorted(
        (result.score for result in results), reverse=True
    )


def test_sbert_save_load_round_trip(tmp_path) -> None:
    corpus = {
        "cloud-costs": {"title": "Cloud costs", "text": "Lower cloud hosting bills."},
        "garden": {"text": "Tomato plants need water and sunlight."},
    }
    original = SentenceBertRetriever()
    original.index(corpus)
    expected = original.search("reducing AWS spend", k=2)
    original.save(tmp_path / "index")

    loaded = SentenceBertRetriever()
    loaded.load(tmp_path / "index")
    actual = loaded.search("reducing AWS spend", k=2)

    assert [(item.doc_id, item.score) for item in actual] == [
        (item.doc_id, item.score) for item in expected
    ]


def test_sbert_load_rejects_model_mismatch(tmp_path) -> None:
    index_dir = tmp_path / "index"
    index_dir.mkdir()
    (index_dir / "metadata.json").write_text(
        json.dumps({"model_name": "another-model", "document_ids": [], "document_texts": [], "document_count": 0}),
        encoding="utf-8",
    )
    (index_dir / "index.faiss").write_bytes(b"")

    with pytest.raises(ValueError, match="another-model"):
        SentenceBertRetriever().load(index_dir)
