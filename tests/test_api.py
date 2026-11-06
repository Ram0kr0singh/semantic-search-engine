"""Fast, offline coverage for the HTTP API."""

from fastapi.testclient import TestClient
import pytest

from backend.app.api.main import create_app
from backend.app.api.state import MethodInfo, SearchRegistry
from backend.app.retrieval.base import SearchResult


class FakeRetriever:
    def __init__(self, results: list[SearchResult]) -> None:
        self.results = results

    def index(self, corpus):
        pass

    def search(self, query: str, k: int) -> list[SearchResult]:
        return self.results[:k]


@pytest.fixture
def client() -> TestClient:
    records = {
        "first": {"title": "First paper", "text": "A short abstract about model compression.", "categories": ["cs.LG"], "year": 2024},
        "second": {"title": "Second paper", "text": "one two three four five six seven eight nine ten eleven twelve", "categories": ["cs.AI"], "year": 2023},
    }
    results = [SearchResult("first", 0.9, records["first"]["text"]), SearchResult("second", 0.4, records["second"]["text"])]
    registry = SearchRegistry(
        records=records,
        retrievers={"tfidf": FakeRetriever(results)},
        methods={
            "tfidf": MethodInfo("tfidf", "TF-IDF", ready=True),
            "sbert-minilm": MethodInfo("sbert-minilm", "Sentence-BERT MiniLM", "mini", False, "python -m scripts.search_demo ..."),
            "sbert-mpnet": MethodInfo("sbert-mpnet", "Sentence-BERT MPNet", "mpnet", False, "python -m scripts.search_demo ..."),
        },
    )
    return TestClient(create_app(registry))


def test_health_and_methods_shapes(client: TestClient) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["document_count"] == 2
    assert health.json()["api_version"] == "1.0.0"
    methods = client.get("/methods")
    assert methods.status_code == 200
    assert set(methods.json()[0]) == {"id", "display_name", "model_name", "ready"}


def test_root_redirects_to_docs(client: TestClient) -> None:
    response = client.get("/", follow_redirects=False)
    assert 300 <= response.status_code < 400
    assert response.headers["location"].endswith("/docs")


def test_search_returns_descending_results_and_shape(client: TestClient) -> None:
    response = client.post("/search", json={"query": "  compression  ", "method": "tfidf", "k": 2})
    body = response.json()
    assert response.status_code == 200
    assert body["query"] == "compression"
    assert [result["score"] for result in body["results"]] == [0.9, 0.4]
    assert set(body["results"][0]) == {"rank", "score", "id", "title", "snippet", "categories", "year"}


@pytest.mark.parametrize("payload", [{"query": "x", "k": 0}, {"query": "x", "k": 51}, {"query": "   "}, {"query": "x" * 501}])
def test_search_validation_errors(client: TestClient, payload: dict[str, object]) -> None:
    response = client.post("/search", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_unknown_method_is_422(client: TestClient) -> None:
    response = client.post("/search", json={"query": "x", "method": "unknown"})
    assert response.status_code == 422
    assert response.json()["error"]["details"]["valid_methods"] == ["tfidf", "sbert-minilm", "sbert-mpnet"]


def test_unavailable_method_is_503(client: TestClient) -> None:
    response = client.post("/search", json={"query": "x", "method": "sbert-minilm"})
    assert response.status_code == 503
    assert "build_command" in response.json()["error"]["details"]


def test_unknown_document_is_404(client: TestClient) -> None:
    response = client.get("/documents/missing")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "document_not_found"


def test_snippet_ends_at_word_boundary(client: TestClient) -> None:
    from backend.app.api import routers
    assert routers.make_snippet("one two three four", limit=10) == "one two..."


def test_allowed_origin_receives_cors_header(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
