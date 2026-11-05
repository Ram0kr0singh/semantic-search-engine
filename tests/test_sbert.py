"""Unit tests for the Sentence-BERT retriever."""

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
