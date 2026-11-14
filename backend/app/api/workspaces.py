"""Ephemeral, in-memory document workspaces."""

from __future__ import annotations

import io
import os
import re
import secrets
import time
import unicodedata
from dataclasses import dataclass, field
from threading import RLock
from typing import Callable, Mapping

from fastapi import APIRouter, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pypdf import PdfReader

from backend.app.data.chunking import chunk_text
from backend.app.retrieval.base import Retriever, SearchResult
from backend.app.retrieval.bm25 import BM25Retriever
from backend.app.retrieval.hybrid import HybridRetriever
from backend.app.retrieval.rerank import RerankingRetriever
from backend.app.retrieval.sbert import SentenceBertRetriever
from .routers import error, make_snippet

router = APIRouter(tags=["workspaces"])
_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")
_SEARCH_METHODS = ("bm25", "semantic", "hybrid", "rerank")
MULTIPART_OVERHEAD_BYTES = 64 * 1024
_UPLOAD_SIZE_ERROR = {
    "code": "upload_too_large",
    "message": "The file exceeds the upload size limit.",
}


class WorkspaceUploadBodyLimitMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or scope["path"] != "/workspace/documents"
        ):
            await self.app(scope, receive, send)
            return

        application = scope["app"]
        upload_limit = application.state.workspace_manager.limits.max_upload_mb * 1024 * 1024
        request_cap = upload_limit + MULTIPART_OVERHEAD_BYTES
        for header_name, header_value in scope.get("headers", []):
            if header_name.lower() != b"content-length":
                continue
            try:
                declared_length = int(header_value)
            except ValueError:
                continue
            if declared_length > request_cap:
                await self._respond_too_large(scope, receive, send)
                return

        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > request_cap:
                    raise error(
                        413,
                        _UPLOAD_SIZE_ERROR["code"],
                        _UPLOAD_SIZE_ERROR["message"],
                    )
            return message

        await self.app(scope, limited_receive, send)

    @staticmethod
    async def _respond_too_large(scope, receive, send) -> None:
        response = JSONResponse(
            status_code=413,
            content={"error": _UPLOAD_SIZE_ERROR},
        )
        await response(scope, receive, send)


@dataclass(frozen=True)
class Limits:
    ttl_minutes: int = 60
    max_workspaces: int = 20
    max_upload_mb: int = 10
    max_files: int = 10
    max_pdf_pages: int = 200
    max_chars: int = 1_000_000
    max_passages: int = 3000

    @classmethod
    def environment(cls) -> Limits:
        def number(key: str, default: int) -> int:
            try:
                return max(1, int(os.getenv(key, str(default))))
            except ValueError:
                return default

        return cls(
            ttl_minutes=number("WORKSPACE_TTL_MINUTES", 60),
            max_workspaces=number("MAX_WORKSPACES", 20),
            max_upload_mb=number("MAX_UPLOAD_MB", 10),
            max_files=number("MAX_FILES_PER_WORKSPACE", 10),
            max_pdf_pages=number("MAX_PDF_PAGES", 200),
            max_chars=number("MAX_CHARS_PER_DOCUMENT", 1_000_000),
            max_passages=number("MAX_PASSAGES_PER_WORKSPACE", 3000),
        )

    def public(self) -> dict[str, int]:
        return {
            "max_upload_mb": self.max_upload_mb,
            "max_files_per_workspace": self.max_files,
            "max_pdf_pages": self.max_pdf_pages,
            "max_chars_per_document": self.max_chars,
            "max_passages_per_workspace": self.max_passages,
        }


@dataclass
class Doc:
    id: str
    name: str
    kind: str
    pages: int | None
    text: str
    passages: list[dict]
    warnings: list[str] = field(default_factory=list)


@dataclass
class Workspace:
    id: str
    touched: float
    documents: dict[str, Doc] = field(default_factory=dict)
    retrievers: dict[str, Retriever] = field(default_factory=dict)


class WorkspaceManager:
    def __init__(
        self,
        limits: Limits | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limits = limits or Limits.environment()
        self.clock = clock
        self.workspaces: dict[str, Workspace] = {}
        self.lock = RLock()

    def cleanup(self) -> None:
        with self.lock:
            now = self.clock()
            timeout = self.limits.ttl_minutes * 60
            for ident, workspace in list(self.workspaces.items()):
                if now - workspace.touched >= timeout:
                    del self.workspaces[ident]

    def create(self) -> Workspace:
        with self.lock:
            self.cleanup()
            if len(self.workspaces) >= self.limits.max_workspaces:
                raise error(
                    429,
                    "workspace_capacity",
                    "The server is at workspace capacity. Try again later.",
                )
            ident = secrets.token_urlsafe(32)
            workspace = Workspace(ident, self.clock())
            self.workspaces[ident] = workspace
            return workspace

    def get(self, ident: str | None) -> Workspace:
        with self.lock:
            self.cleanup()
            if not isinstance(ident, str) or not _TOKEN_PATTERN.fullmatch(ident):
                raise error(404, "workspace_not_found", "Workspace was not found.")
            workspace = self.workspaces.get(ident)
            if workspace is None:
                raise error(404, "workspace_not_found", "Workspace was not found.")
            workspace.touched = self.clock()
            return workspace

    def delete(self, ident: str | None) -> None:
        with self.lock:
            workspace = self.get(ident)
            del self.workspaces[workspace.id]


def enabled() -> bool:
    return os.getenv("WORKSPACES_ENABLED", "true").lower() in {"1", "true", "yes", "on"}


def manager(request: Request) -> WorkspaceManager:
    if not enabled():
        raise error(404, "workspace_disabled", "Document workspaces are disabled.")
    return request.app.state.workspace_manager


def safe_name(value: str | None) -> str:
    name = (value or "upload").replace("\\", "/").split("/")[-1]
    name = "".join(c for c in name if unicodedata.category(c)[0] != "C").strip()
    if len(name) > 200:
        stem, separator, extension = name.rpartition(".")
        if separator and len(extension) < 198:
            name = f"{stem[: 199 - len(extension)]}.{extension}"
        else:
            name = name[:200]
    return name or "upload"


def normalize(text: str) -> list[str]:
    cleaned = "".join(
        "" if unicodedata.category(char)[0] == "C" and char not in "\n\t" else char
        for char in text
    )
    return cleaned.split()


def text_valid(raw: bytes) -> bool:
    if not raw or b"\0" in raw:
        return False
    try:
        raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return False
    sample = raw[:8192]
    printable = sum((32 <= byte < 127) or byte in b"\n\r\t" or byte >= 128 for byte in sample)
    return printable / max(1, len(sample)) > 0.85


async def read_limited(file: UploadFile, maximum: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(65536):
        total += len(chunk)
        if total > maximum:
            raise error(
                413,
                _UPLOAD_SIZE_ERROR["code"],
                _UPLOAD_SIZE_ERROR["message"],
            )
        chunks.append(chunk)
    return b"".join(chunks)


def parse_pdf(raw: bytes, limits: Limits) -> tuple[list[str], list[str]]:
    if not raw.startswith(b"%PDF-"):
        raise error(422, "invalid_upload", "This .pdf file does not contain a PDF.")
    try:
        reader = PdfReader(io.BytesIO(raw))
        if reader.is_encrypted and reader.decrypt("") == 0:
            raise error(422, "encrypted_pdf", "Encrypted PDFs are not supported.")
        if len(reader.pages) > limits.max_pdf_pages:
            raise error(422, "pdf_page_limit", "The PDF exceeds the page limit.")
        pages: list[str] = []
        warnings: list[str] = []
        char_count = 0
        empty_pages = 0
        for page in reader.pages:
            extracted = page.extract_text() or ""
            char_count += len(extracted)
            if char_count > limits.max_chars:
                raise error(
                    422,
                    "document_too_large",
                    "Extracted text exceeds the character limit.",
                )
            text = " ".join(normalize(extracted))
            if not text:
                empty_pages += 1
            pages.append(text)
        if empty_pages:
            warnings.append(
                f"{empty_pages} pages had no extractable text; scanned images are not supported."
            )
        if not any(pages):
            raise error(
                422,
                "no_extractable_text",
                "The PDF contains no extractable text; scanned images are not supported.",
            )
        return pages, warnings
    except HTTPException:
        raise
    except Exception as exc:
        raise error(422, "invalid_pdf", "The PDF could not be read.") from exc


def parse_upload(raw: bytes, name: str, limits: Limits) -> tuple[str, list[str], list[str]]:
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in {"pdf", "txt", "md"}:
        raise error(422, "unsupported_upload", "Only PDF, TXT, and Markdown files are accepted.")
    if extension == "pdf":
        pages, warnings = parse_pdf(raw, limits)
        return "pdf", pages, warnings
    if not text_valid(raw):
        raise error(422, "invalid_text", "Text files must be non-empty UTF-8 text without NUL bytes.")
    text = raw.decode("utf-8-sig")
    if len(text) > limits.max_chars:
        raise error(422, "document_too_large", "Document exceeds the character limit.")
    normalized = " ".join(normalize(text))
    if not normalized:
        raise error(422, "invalid_text", "The uploaded file contains no text.")
    return extension, [normalized], []


def build(workspace: Workspace, request: Request) -> None:
    corpus = {
        passage["id"]: {"title": "", "text": passage["text"]}
        for document in workspace.documents.values()
        for passage in document.passages
    }
    if not corpus:
        workspace.retrievers = {}
        return

    bm25 = BM25Retriever(stop_words=None)
    bm25.index(corpus)
    retrievers: dict[str, Retriever] = {"bm25": bm25}
    registry = request.app.state.registry
    dense_info = registry.methods.get("sbert-mpnet")
    dense_base = registry.retrievers.get("sbert-mpnet")
    if dense_info and dense_info.ready and dense_base and hasattr(dense_base, "model"):
        dense = SentenceBertRetriever(
            model_name=getattr(
                dense_base, "model_name", "sentence-transformers/all-mpnet-base-v2"
            ),
            model=dense_base.model,
        )
        dense.index(corpus, inference_lock=registry.inference_lock)
        retrievers["semantic"] = dense
        retrievers["hybrid"] = HybridRetriever(
            [PositiveBM25Retriever(bm25), dense],
            k_rrf=60,
            depth=100,
            reuse_indexed_components=True,
        )
        rerank_info = registry.methods.get("rerank-mpnet")
        rerank_base = registry.retrievers.get("rerank-mpnet")
        if (
            rerank_info
            and rerank_info.ready
            and rerank_base
            and hasattr(rerank_base, "cross_encoder")
        ):
            retrievers["rerank"] = RerankingRetriever(
                dense,
                depth=100,
                reuse_indexed_first_stage=True,
                cross_encoder=rerank_base.cross_encoder,
            )
    workspace.retrievers = retrievers


class PositiveBM25Retriever(Retriever):
    def __init__(self, retriever: Retriever) -> None:
        self.retriever = retriever

    def index(self, corpus: Mapping[str, Mapping[str, str]]) -> None:
        self.retriever.index(corpus)

    def search(self, query: str, k: int) -> list[SearchResult]:
        return [result for result in self.retriever.search(query, k) if result.score > 0]


def doc_summary(document: Doc) -> dict[str, object]:
    return {
        "id": document.id,
        "name": document.name,
        "kind": document.kind,
        "pages": document.pages,
        "character_count": len(document.text),
        "passage_count": len(document.passages),
        "warnings": document.warnings,
    }


def _authorized_manager(request: Request, workspace_token: str | None) -> tuple[WorkspaceManager, Workspace]:
    current_manager = manager(request)
    return current_manager, current_manager.get(workspace_token)


def _make_document(
    name: str,
    kind: str,
    pages: list[str],
    warnings: list[str],
) -> Doc:
    ident = secrets.token_urlsafe(16)
    passages: list[dict] = []
    for page_number, text in enumerate(pages, start=1):
        for passage in chunk_text(text, ident):
            if len(passage.text.split()) >= 2:
                passages.append(
                    {
                        "id": f"{ident}#{len(passages)}",
                        "text": passage.text,
                        "page": page_number if kind == "pdf" else None,
                        "passage_index": len(passages),
                    }
                )
    if not passages:
        raise error(422, "no_passages", "The document contains too little text to search.")
    return Doc(
        ident,
        name,
        kind,
        len(pages) if kind == "pdf" else None,
        " ".join(pages),
        passages,
        warnings,
    )


@router.post("/workspaces")
def create(request: Request) -> dict[str, object]:
    current_manager = manager(request)
    workspace = current_manager.create()
    return {
        "workspace_id": workspace.id,
        "ttl_minutes": current_manager.limits.ttl_minutes,
        "limits": current_manager.limits.public(),
    }


@router.get("/workspace")
def status(
    request: Request,
    workspace_token: str | None = Header(default=None, alias="X-Workspace-Token"),
) -> dict[str, object]:
    current_manager, workspace = _authorized_manager(request, workspace_token)
    with current_manager.lock:
        documents = [doc_summary(document) for document in workspace.documents.values()]
        return {
            "documents": documents,
            "totals": {
                "documents": len(documents),
                "passages": sum(document["passage_count"] for document in documents),
            },
            "seconds_until_expiry": current_manager.limits.ttl_minutes * 60,
        }


@router.post("/workspace/documents")
async def upload(
    request: Request,
    file: UploadFile = File(...),
    workspace_token: str | None = Header(default=None, alias="X-Workspace-Token"),
) -> dict[str, object]:
    current_manager, workspace = _authorized_manager(request, workspace_token)
    with current_manager.lock:
        if len(workspace.documents) >= current_manager.limits.max_files:
            raise error(422, "file_limit", "This workspace has reached its file limit.")

    maximum = current_manager.limits.max_upload_mb * 1024 * 1024
    name = safe_name(file.filename)
    raw = await read_limited(file, maximum)
    kind, pages, warnings = parse_upload(raw, name, current_manager.limits)
    document = _make_document(name, kind, pages, warnings)

    with current_manager.lock:
        workspace = current_manager.get(workspace_token)
        if len(workspace.documents) >= current_manager.limits.max_files:
            raise error(422, "file_limit", "This workspace has reached its file limit.")
        passage_count = sum(len(existing.passages) for existing in workspace.documents.values())
        if passage_count + len(document.passages) > current_manager.limits.max_passages:
            raise error(
                422,
                "passage_limit",
                "Adding this file would exceed the workspace passage limit.",
            )

        candidate = Workspace(
            workspace.id,
            workspace.touched,
            {**workspace.documents, document.id: document},
            dict(workspace.retrievers),
        )
        try:
            build(candidate, request)
        except HTTPException:
            raise
        except Exception as exc:
            raise error(422, "indexing_failed", "The document could not be indexed.") from exc
        workspace.documents = candidate.documents
        workspace.retrievers = candidate.retrievers
    return doc_summary(document)


@router.delete("/workspace/documents/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    request: Request,
    workspace_token: str | None = Header(default=None, alias="X-Workspace-Token"),
) -> None:
    current_manager, workspace = _authorized_manager(request, workspace_token)
    with current_manager.lock:
        if document_id not in workspace.documents:
            raise error(404, "document_not_found", "Document was not found.")
        candidate = Workspace(
            workspace.id,
            workspace.touched,
            {key: value for key, value in workspace.documents.items() if key != document_id},
            dict(workspace.retrievers),
        )
        try:
            build(candidate, request)
        except HTTPException:
            raise
        except Exception as exc:
            raise error(422, "indexing_failed", "The document could not be removed.") from exc
        workspace.documents = candidate.documents
        workspace.retrievers = candidate.retrievers


@router.delete("/workspace", status_code=204)
def delete_workspace(
    request: Request,
    workspace_token: str | None = Header(default=None, alias="X-Workspace-Token"),
) -> None:
    current_manager = manager(request)
    current_manager.delete(workspace_token)


@router.post("/workspace/search")
def search(
    payload: dict,
    request: Request,
    workspace_token: str | None = Header(default=None, alias="X-Workspace-Token"),
) -> dict[str, object]:
    current_manager, workspace = _authorized_manager(request, workspace_token)
    query_value = payload.get("query", "")
    method = payload.get("method", "bm25")
    k = payload.get("k", 10)
    if (
        not isinstance(query_value, str)
        or not query_value.strip()
        or len(query_value.strip()) > 500
        or isinstance(k, bool)
        or not isinstance(k, int)
        or not 1 <= k <= 50
    ):
        raise error(422, "validation_error", "Invalid request.")
    query = query_value.strip()
    if not isinstance(method, str) or method not in _SEARCH_METHODS:
        raise error(
            422,
            "unknown_method",
            "Unknown search method.",
            {"valid_methods": list(_SEARCH_METHODS)},
        )

    start = time.perf_counter()
    with current_manager.lock:
        if not workspace.documents:
            raise error(422, "empty_workspace", "Upload at least one document first.")
        retriever = workspace.retrievers.get(method)
        if retriever is None:
            registry = request.app.state.registry
            source = {
                "semantic": "sbert-mpnet",
                "hybrid": "hybrid-mpnet",
                "rerank": "rerank-mpnet",
            }.get(method)
            method_info = registry.methods.get(source) if source else None
            reason = (
                method_info.unavailable_reason
                if method_info
                else "The requested method is unavailable."
            )
            raise error(503, "method_unavailable", reason or "The requested method is unavailable.")

        if method in {"semantic", "hybrid", "rerank"}:
            with request.app.state.registry.inference_lock:
                results = retriever.search(query, k)
        else:
                results = retriever.search(query, k)
        if method == "bm25":
            results = [result for result in results if result.score > 0]
        results = sorted(results, key=lambda result: result.score, reverse=True)

        passages = {
            passage["id"]: (document, passage)
            for document in workspace.documents.values()
            for passage in document.passages
        }
        items = []
        for rank, result in enumerate(results, start=1):
            document, passage = passages[result.doc_id]
            items.append(
                {
                    "rank": rank,
                    "score": result.score,
                    "document_id": document.id,
                    "document_name": document.name,
                    "page": passage["page"],
                    "passage_index": passage["passage_index"],
                    "text": passage["text"],
                    "snippet": make_snippet(passage["text"]),
                }
            )
    response: dict[str, object] = {
        "query": query,
        "method": method,
        "k": k,
        "took_ms": 0.0,
        "results": items,
    }
    if method == "bm25" and not items:
        response["message"] = "No passages contain these words. Try the meaning-based search."
    response["took_ms"] = (time.perf_counter() - start) * 1000
    return response
