"""FastAPI application factory and production startup lifecycle."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.encoders import jsonable_encoder

from backend.app.data.arxiv import load_arxiv_corpus
from backend.app.retrieval.sbert import SentenceBertRetriever
from backend.app.retrieval.tfidf import TfidfRetriever

from .routers import router
from .state import MethodInfo, SearchRegistry

logger = logging.getLogger(__name__)


def _setting(name: str, default: str) -> str:
    return os.getenv(name, default)


def _build_command(corpus: Path, index_dir: Path, model_name: str) -> str:
    return f'python -m scripts.search_demo --method sbert --model "{model_name}" --corpus "{corpus}" --index-dir "{index_dir}" --rebuild'


def load_registry() -> SearchRegistry:
    """Load the corpus, sparse index, and any existing persisted dense indexes."""
    corpus_path = Path(_setting("ARXIV_CORPUS_PATH", "data/arxiv_cs_30000.jsonl"))
    corpus, records = load_arxiv_corpus(corpus_path)
    tfidf = TfidfRetriever()
    tfidf.index(corpus)
    registry = SearchRegistry(records=records, retrievers={"tfidf": tfidf}, embedding_device="cuda" if torch.cuda.is_available() else "cpu")
    registry.methods["tfidf"] = MethodInfo("tfidf", "TF-IDF", ready=True)

    configs = (
        ("sbert-minilm", "Sentence-BERT MiniLM", _setting("ARXIV_MINILM_MODEL", "sentence-transformers/all-MiniLM-L6-v2"), Path(_setting("ARXIV_MINILM_INDEX_DIR", "data/arxiv_sbert_index"))),
        ("sbert-mpnet", "Sentence-BERT MPNet", _setting("ARXIV_MPNET_MODEL", "sentence-transformers/all-mpnet-base-v2"), Path(_setting("ARXIV_MPNET_INDEX_DIR", "data/index_mpnet"))),
    )
    for method_id, display_name, model_name, index_dir in configs:
        command = _build_command(corpus_path, index_dir, model_name)
        if not (index_dir / "metadata.json").is_file() or not (index_dir / "index.faiss").is_file():
            registry.methods[method_id] = MethodInfo(method_id, display_name, model_name, False, command)
            logger.warning("%s index is unavailable. Build it with: %s", method_id, command)
            continue
        try:
            retriever = SentenceBertRetriever(model_name=model_name)
            retriever.load(index_dir)
        except Exception as exc:  # Do not prevent sparse search when a local index is unusable.
            logger.warning("%s index is unavailable (%s). Build it with: %s", method_id, exc, command)
            registry.methods[method_id] = MethodInfo(method_id, display_name, model_name, False, command)
        else:
            registry.retrievers[method_id] = retriever
            registry.embedding_device = retriever.device
            registry.methods[method_id] = MethodInfo(method_id, display_name, model_name, True)
    return registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.registry = load_registry()
    yield


def create_app(registry: SearchRegistry | None = None) -> FastAPI:
    """Create an application; tests may supply a preloaded registry."""
    app = FastAPI(title="Semantic Search Engine API", version="1.0.0", lifespan=None if registry else lifespan)
    if registry is not None:
        app.state.registry = registry
    origins = [origin.strip() for origin in _setting("API_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["*"])

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "message": "Invalid request.", "details": jsonable_encoder(exc.errors())}})

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": "http_error", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content={"error": detail})

    @app.exception_handler(Exception)
    async def unhandled_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error")
        return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "message": "An internal server error occurred."}})

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    app.include_router(router)
    return app


app = create_app()
