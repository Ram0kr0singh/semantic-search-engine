"""Unit tests for the sparse Okapi BM25 baseline retriever."""

import math

import pytest

from backend.app.retrieval.bm25 import BM25Retriever


def test_bm25_matches_hand_computed_score() -> None:
    retriever = BM25Retriever(stop_words=None)
    retriever.index({"apples": {"text": "apple apple"}, "banana": {"text": "banana"}})

    result = retriever.search("apple", k=1)[0]

    idf = math.log(1 + (2 - 1 + 0.5) / (1 + 0.5))
    expected = idf * (2 * (1.5 + 1) / (2 + 1.5 * (1 - 0.75 + 0.75 * 2 / 1.5)))
    assert result.doc_id == "apples"
    assert result.score == pytest.approx(expected)


def test_bm25_ranks_obvious_match_first() -> None:
    retriever = BM25Retriever()
    retriever.index(
        {
            "cats": {"title": "Cats", "text": "Felines purr and chase mice."},
            "space": {"title": "Space", "text": "Planets orbit distant stars."},
        }
    )

    assert retriever.search("cats purr", k=2)[0].doc_id == "cats"


def test_bm25_length_normalization_can_be_disabled() -> None:
    corpus = {"short": {"text": "apple"}, "long": {"text": "apple pear pear pear"}}
    normalized = BM25Retriever(b=0, stop_words=None)
    length_aware = BM25Retriever(b=0.75, stop_words=None)
    normalized.index(corpus)
    length_aware.index(corpus)

    no_length_penalty = {result.doc_id: result.score for result in normalized.search("apple", k=2)}
    length_penalty = {result.doc_id: result.score for result in length_aware.search("apple", k=2)}

    assert no_length_penalty["short"] == pytest.approx(no_length_penalty["long"])
    assert length_penalty["short"] > length_penalty["long"]


@pytest.mark.parametrize("query", ["unseen", ""])
def test_bm25_returns_zero_scores_for_unmatched_or_empty_queries(query: str) -> None:
    retriever = BM25Retriever()
    retriever.index({"first": {"text": "apple"}, "second": {"text": "banana"}})

    results = retriever.search(query, k=2)

    assert [result.doc_id for result in results] == ["first", "second"]
    assert [result.score for result in results] == [0.0, 0.0]


def test_bm25_search_results_are_descending_by_score() -> None:
    retriever = BM25Retriever(stop_words=None)
    retriever.index(
        {
            "best": {"text": "apple apple apple"},
            "next": {"text": "apple pear"},
            "none": {"text": "pear orange"},
        }
    )

    results = retriever.search("apple", k=3)

    assert [result.score for result in results] == sorted(
        (result.score for result in results), reverse=True
    )
