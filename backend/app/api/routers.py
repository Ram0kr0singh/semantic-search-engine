"""Route handlers for the semantic search API."""

from __future__ import annotations

from time import perf_counter

from fastapi import APIRouter, HTTPException, Request

from .schemas import SearchItem, SearchRequest, SearchResponse
from .state import SearchRegistry

router = APIRouter()


def get_registry(request: Request) -> SearchRegistry:
    return request.app.state.registry


def error(status_code: int, code: str, message: str, details: object | None = None) -> HTTPException:
    payload: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return HTTPException(status_code=status_code, detail=payload)


def make_snippet(text: str, limit: int = 300) -> str:
    """Create a compact abstract preview without splitting a word."""
    normalized = " ".join(text.split())
    if len(normalized) <= limit:
        return normalized
    cut = normalized.rfind(" ", 0, limit + 1)
    return normalized[: cut if cut > 0 else limit].rstrip() + "..."


@router.get("/health")
def health(request: Request) -> dict[str, object]:
    registry = get_registry(request)
    return {
        "status": "ok" if registry.default_method else "degraded",
        "document_count": len(registry.records),
        "methods": [method.__dict__ for method in registry.methods.values()],
        "embedding_device": registry.embedding_device,
        "api_version": "1.0.0",
    }


@router.get("/methods")
def methods(request: Request) -> list[dict[str, object]]:
    registry = get_registry(request)
    return [
        {"id": method.id, "display_name": method.display_name, "model_name": method.model_name, "ready": method.ready}
        for method in registry.methods.values()
    ]


@router.post("/search", response_model=SearchResponse)
def search(payload: SearchRequest, request: Request) -> SearchResponse:
    registry = get_registry(request)
    method_id = payload.method or registry.default_method
    if method_id not in registry.methods:
        raise error(422, "unknown_method", "Unknown search method.", {"valid_methods": list(registry.methods)})
    method = registry.methods[method_id]
    if not method.ready:
        raise error(503, "method_unavailable", f"Search method '{method_id}' is unavailable.", {"build_command": method.build_command})

    start = perf_counter()
    retriever = registry.retrievers[method_id]
    if method_id.startswith("sbert-"):
        with registry.sbert_lock:
            results = retriever.search(payload.query, payload.k)
    else:
        results = retriever.search(payload.query, payload.k)
    took_ms = (perf_counter() - start) * 1000
    items: list[SearchItem] = []
    for rank, result in enumerate(results, start=1):
        record = registry.records.get(result.doc_id, {})
        abstract = str(record.get("text", result.text))
        raw_categories = record.get("categories", [])
        categories = [str(category) for category in raw_categories] if isinstance(raw_categories, list) else []
        raw_year = record.get("year")
        year = raw_year if isinstance(raw_year, int) else None
        items.append(SearchItem(rank=rank, score=result.score, id=result.doc_id, title=str(record.get("title", "")), snippet=make_snippet(abstract), categories=categories, year=year))
    return SearchResponse(query=payload.query, method=method_id, k=payload.k, took_ms=took_ms, results=items)


@router.get("/documents/{document_id}")
def document(document_id: str, request: Request) -> dict[str, object]:
    record = get_registry(request).records.get(document_id)
    if record is None:
        raise error(404, "document_not_found", f"Document '{document_id}' was not found.")
    raw_categories = record.get("categories", [])
    return {
        "id": document_id,
        "title": str(record.get("title", "")),
        "abstract": str(record.get("text", "")),
        "categories": [str(category) for category in raw_categories] if isinstance(raw_categories, list) else [],
        "year": record.get("year") if isinstance(record.get("year"), int) else None,
    }
