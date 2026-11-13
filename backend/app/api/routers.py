"""Route handlers for the semantic search API."""

from __future__ import annotations

import json
import os
from pathlib import Path
from time import perf_counter

from fastapi import APIRouter, HTTPException, Request

from .schemas import EvaluationResponse, SearchItem, SearchRequest, SearchResponse
from .state import SearchRegistry

router = APIRouter()


def evaluation_snapshot_path() -> Path:
    configured = os.getenv("EVALUATION_SNAPSHOT_PATH")
    return Path(configured) if configured else Path(__file__).resolve().parents[3] / "docs" / "results" / "summary.json"


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
    benchmarks = _method_benchmarks()
    return [
        {**{"id": method.id, "display_name": method.display_name, "model_name": method.model_name,
             "kind": method.kind, "description": method.description, "ready": method.ready,
             "build_command": method.build_command, "unavailable_reason": method.unavailable_reason},
         **({"benchmarks": benchmarks[method.id]} if method.id in benchmarks else {})}
        for method in registry.methods.values()
    ]


def _method_benchmarks() -> dict[str, list[dict[str, object]]]:
    """Read benchmark values opportunistically; the live API never depends on them."""
    try:
        payload = json.loads(evaluation_snapshot_path().read_text(encoding="utf-8"))
        runs = payload.get("runs", [])
        if not isinstance(runs, list):
            return {}
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return {}
    mpnet = "sentence-transformers/all-mpnet-base-v2"
    def matches(method_id: str, run: object) -> bool:
        if not isinstance(run, dict): return False
        if method_id in {"tfidf", "bm25"}: return run.get("method") == method_id
        if method_id == "sbert-minilm": return run.get("method") == "sbert" and run.get("model") == "sentence-transformers/all-MiniLM-L6-v2"
        if method_id == "sbert-mpnet": return run.get("method") == "sbert" and run.get("model") == mpnet
        if method_id == "hybrid-mpnet": return run.get("method") == "hybrid" and run.get("model") == mpnet
        reranking = run.get("reranking")
        return method_id == "rerank-mpnet" and run.get("method") == "rerank" and run.get("model") == mpnet and isinstance(reranking, dict) and reranking.get("first_stage") == "sbert"
    mapped: dict[str, list[dict[str, object]]] = {}
    for method_id in ("tfidf", "bm25", "sbert-minilm", "sbert-mpnet", "hybrid-mpnet", "rerank-mpnet"):
        values = [{"dataset": run["dataset"], "ndcg_at_10": run["ndcg_at_10"], "recall_at_100": run["recall_at_100"]}
                  for run in runs if matches(method_id, run) and all(key in run for key in ("dataset", "ndcg_at_10", "recall_at_100"))]
        if values: mapped[method_id] = values
    return mapped


@router.get("/evaluation", response_model=EvaluationResponse)
def evaluation() -> EvaluationResponse:
    path = evaluation_snapshot_path()
    if not path.is_file():
        raise error(404, "evaluation_snapshot_missing", "Evaluation snapshot is not available.", {"build_command": "python -m scripts.export_results"})
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return EvaluationResponse.model_validate(payload)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise error(500, "evaluation_snapshot_invalid", "Evaluation snapshot is invalid.") from exc


@router.post("/search", response_model=SearchResponse)
def search(payload: SearchRequest, request: Request) -> SearchResponse:
    registry = get_registry(request)
    method_id = payload.method or registry.default_method
    if method_id not in registry.methods:
        raise error(422, "unknown_method", "Unknown search method.", {"valid_methods": list(registry.methods)})
    method = registry.methods[method_id]
    if not method.ready:
        details = {"build_command": method.build_command, "reason": method.unavailable_reason}
        raise error(503, "method_unavailable", method.unavailable_reason or f"Search method '{method_id}' is unavailable.", details)

    start = perf_counter()
    retriever = registry.retrievers[method_id]
    if method_id in {"sbert-minilm", "sbert-mpnet", "hybrid-mpnet", "rerank-mpnet"}:
        with registry.inference_lock:
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
