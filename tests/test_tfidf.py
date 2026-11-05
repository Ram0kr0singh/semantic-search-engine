"""Unit tests for the TF-IDF baseline retriever."""

from backend.app.retrieval.tfidf import TfidfRetriever


def test_tfidf_ranks_obvious_match_first() -> None:
    retriever = TfidfRetriever()
    retriever.index(
        {
            "cats": {"title": "Cats", "text": "Felines purr and chase mice."},
            "space": {"title": "Space", "text": "Planets orbit distant stars."},
        }
    )
    results = retriever.search("cats purr", k=2)
    assert results[0].doc_id == "cats"


def test_search_results_are_descending_by_score() -> None:
    retriever = TfidfRetriever()
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
