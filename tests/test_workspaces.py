from __future__ import annotations

import asyncio
import json
import logging
import re
import threading
import time
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path
from typing import Callable, Generator

import pytest
import numpy as np
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
import starlette.formparsers as formparsers

from backend.app.api.main import create_app
from backend.app.api.state import MethodInfo, SearchRegistry
from backend.app.api.workspaces import (
    Limits,
    MULTIPART_OVERHEAD_BYTES,
    PositiveBM25Retriever,
    WorkspaceManager,
)
from backend.app.retrieval.base import SearchResult
from backend.app.retrieval.hybrid import HybridRetriever
from backend.app.retrieval.sbert import SentenceBertRetriever


class FakeRetriever:
    def __init__(self, results: list[SearchResult], delay: float = 0) -> None:
        self.results = results
        self.delay = delay

    def index(self, corpus) -> None:
        _ = corpus

    def search(self, query: str, k: int) -> list[SearchResult]:
        _ = query
        if self.delay:
            time.sleep(self.delay)
        return self.results[:k]


class ContentLengthOverride:
    def __init__(self, app, value: str | None) -> None:
        self.app = app
        self.value = value

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http" and scope["path"] == "/workspace/documents":
            headers = [
                (key, value)
                for key, value in scope["headers"]
                if key.lower() != b"content-length"
            ]
            if self.value is not None:
                headers.append((b"content-length", self.value.encode("ascii")))
            scope = {**scope, "headers": headers}
        await self.app(scope, receive, send)


@contextmanager
def _client_context(
    *,
    limits: Limits | None = None,
    clock: Callable[[], float] | None = None,
    content_length: str | None = None,
    alter_content_length: bool = False,
    registry: SearchRegistry | None = None,
) -> Generator[TestClient, None, None]:
    manager = WorkspaceManager(limits=limits, clock=clock) if clock else WorkspaceManager(limits=limits)
    app = create_app(registry or SearchRegistry(), workspace_manager=manager)
    if alter_content_length:
        app.add_middleware(ContentLengthOverride, value=content_length)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with _client_context() as test:
        yield test


def workspace_token(client: TestClient) -> str:
    response = client.post("/workspaces")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"workspace_id", "ttl_minutes", "limits"}
    return body["workspace_id"]


def upload(
    client: TestClient,
    token: str,
    name: str,
    data: bytes,
    content_type: str = "text/plain",
) -> object:
    return client.post(
        "/workspace/documents",
        headers={"X-Workspace-Token": token},
        files={"file": (name, data, content_type)},
    )


def make_pdf(pages: list[str], password: str | None = None) -> bytes:
    writer = PdfWriter()
    for text in pages:
        page = writer.add_blank_page(width=612, height=792)
        if text:
            font = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/Helvetica"),
                }
            )
            font_reference = writer._add_object(font)
            resources = DictionaryObject(
                {
                    NameObject("/Font"): DictionaryObject(
                        {NameObject("/F1"): font_reference}
                    )
                }
            )
            page[NameObject("/Resources")] = resources
            stream = DecodedStreamObject()
            escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            stream.set_data(f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode("ascii"))
            page[NameObject("/Contents")] = writer._add_object(stream)
    if password is not None:
        writer.encrypt(password)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def upload_counts(client: TestClient, token: str) -> tuple[int, int, dict[str, int]]:
    manager = client.app.state.workspace_manager
    with manager.lock:
        workspace = manager.workspaces[token]
        return (
            len(workspace.documents),
            sum(len(document.passages) for document in workspace.documents.values()),
            {name: id(retriever) for name, retriever in workspace.retrievers.items()},
        )


def call_asgi(
    client: TestClient,
    path: str,
    headers: list[tuple[bytes, bytes]],
    chunks: list[bytes],
) -> tuple[int, dict[bytes, bytes], bytes, int, int]:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "root_path": "",
        "headers": headers,
        "client": ("testclient", 123),
        "server": ("testserver", 80),
        "state": {},
    }
    position = 0
    consumed = 0
    receive_calls = 0
    sent: list[dict] = []

    async def receive() -> dict:
        nonlocal position, consumed, receive_calls
        receive_calls += 1
        if position == len(chunks):
            return {"type": "http.disconnect"}
        chunk = chunks[position]
        position += 1
        consumed += len(chunk)
        return {
            "type": "http.request",
            "body": chunk,
            "more_body": position < len(chunks),
        }

    async def send(message: dict) -> None:
        sent.append(message)

    asyncio.run(client.app(scope, receive, send))
    start = next(message for message in sent if message["type"] == "http.response.start")
    body = b"".join(
        message.get("body", b"")
        for message in sent
        if message["type"] == "http.response.body"
    )
    return start["status"], dict(start["headers"]), body, consumed, receive_calls


def oversized_multipart_body(boundary: bytes, size: int) -> bytes:
    headers = (
        b"--"
        + boundary
        + b'\r\nContent-Disposition: form-data; name="file"; filename="large.txt"'
        + b"\r\nContent-Type: text/plain\r\n\r\n"
    )
    return headers + b"x" * size + b"\r\n--" + boundary + b"--\r\n"


def install_fake_methods(
    client: TestClient,
    token: str,
    method_results: dict[str, list[SearchResult]],
) -> None:
    manager = client.app.state.workspace_manager
    with manager.lock:
        workspace = manager.workspaces[token]
        for method, results in method_results.items():
            workspace.retrievers[method] = FakeRetriever(results)


def test_a_token_is_url_safe_and_never_appears_in_a_url_path(client: TestClient) -> None:
    token = workspace_token(client)
    assert len(token) == 43
    assert re.fullmatch(r"[A-Za-z0-9_-]{43}", token)

    uploaded = upload(client, token, "path-check.txt", b"path checking passage.")
    document_id = uploaded.json()["id"]
    responses = [
        client.get("/workspace", headers={"X-Workspace-Token": token}),
        client.post(
            "/workspace/search",
            headers={"X-Workspace-Token": token},
            json={"query": "path"},
        ),
        client.delete(
            f"/workspace/documents/{document_id}",
            headers={"X-Workspace-Token": token},
        ),
        client.delete("/workspace", headers={"X-Workspace-Token": token}),
    ]
    assert all(response.status_code in {200, 204} for response in responses)
    all_paths = ["/workspaces", uploaded.request.url.path] + [
        response.request.url.path for response in responses
    ]
    assert all(token not in response.request.url.path for response in responses)
    assert all(token not in path for path in all_paths)
    assert all(
        token not in route.path
        for route in client.app.routes
        if hasattr(route, "path")
    )


def test_a_missing_malformed_unknown_expired_and_deleted_tokens_share_404(
    client: TestClient,
) -> None:
    expired_token = workspace_token(client)
    deleted_token = workspace_token(client)
    manager = client.app.state.workspace_manager
    manager.limits = Limits(ttl_minutes=1)
    manager.workspaces[expired_token].touched = manager.clock() - 60
    expired_response = client.get(
        "/workspace", headers={"X-Workspace-Token": expired_token}
    )
    assert (
        client.delete(
            "/workspace", headers={"X-Workspace-Token": deleted_token}
        ).status_code
        == 204
    )

    responses = [
        client.get("/workspace"),
        client.get("/workspace", headers={"X-Workspace-Token": "bad-token"}),
        client.get(
            "/workspace",
            headers={"X-Workspace-Token": "A" * 43},
        ),
        client.get(
            "/workspace",
            headers={"X-Workspace-Token": "Z" * 43},
        ),
        expired_response,
        client.get(
            "/workspace",
            headers={"X-Workspace-Token": deleted_token},
        ),
    ]
    assert {response.status_code for response in responses} == {404}
    assert all(response.json() == responses[0].json() for response in responses)


def test_a_cors_preflight_allows_workspace_token_header(client: TestClient) -> None:
    response = client.options(
        "/workspace/search",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-workspace-token",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "x-workspace-token" in response.headers["access-control-allow-headers"].lower()


def test_b_workspaces_cannot_list_search_or_delete_each_others_documents(
    client: TestClient,
) -> None:
    token_a = workspace_token(client)
    token_b = workspace_token(client)
    doc_a = upload(client, token_a, "private-a.txt", b"alphaunique document passage.")
    doc_b = upload(client, token_b, "private-b.txt", b"betaunique different passage.")
    assert doc_a.status_code == doc_b.status_code == 200
    a_id = doc_a.json()["id"]

    listing = client.get("/workspace", headers={"X-Workspace-Token": token_b}).json()
    assert [document["id"] for document in listing["documents"]] == [doc_b.json()["id"]]
    search_b = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token_b},
        json={"query": "alphaunique"},
    ).json()
    assert search_b["results"] == []
    assert "document_id" not in str(search_b["results"])

    delete = client.delete(
        f"/workspace/documents/{a_id}",
        headers={"X-Workspace-Token": token_b},
    )
    assert delete.status_code == 404
    assert client.get(
        "/workspace", headers={"X-Workspace-Token": token_a}
    ).json()["totals"]["documents"] == 1


@pytest.mark.parametrize("declared_length", [None, "1"])
def test_c_streamed_upload_size_limit_ignores_missing_or_lying_content_length(
    declared_length: str | None,
) -> None:
    with _client_context(
        limits=Limits(max_upload_mb=1),
        content_length=declared_length,
        alter_content_length=True,
    ) as client:
        token = workspace_token(client)
        data = (b"word " * (1024 * 1024 // 5 + 2))[: 1024 * 1024 + 1]
        before = upload_counts(client, token)
        response = upload(client, token, "large.txt", data)
        assert response.status_code == 413
        assert response.json()["error"]["message"] == "The file exceeds the upload size limit."
        assert upload_counts(client, token) == before


def test_c_request_body_cap_rejects_large_content_length_without_reading_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MAX_UPLOAD_MB", "1")
    with _client_context() as client:
        token = workspace_token(client)
        manager = client.app.state.workspace_manager
        workspace = manager.workspaces[token]
        before = upload_counts(client, token)
        touched = workspace.touched
        cap = 1024 * 1024 + MULTIPART_OVERHEAD_BYTES
        status, _, body, consumed, receive_calls = call_asgi(
            client,
            "/workspace/documents",
            [
                (b"content-type", b"multipart/form-data; boundary=large"),
                (b"x-workspace-token", token.encode("ascii")),
                (b"content-length", str(cap + 1).encode("ascii")),
            ],
            [b"body must not be read"],
        )
        assert status == 413
        assert json.loads(body) == {
            "error": {
                "code": "upload_too_large",
                "message": "The file exceeds the upload size limit.",
            }
        }
        assert consumed == 0 and receive_calls == 0
        assert token.encode("ascii") not in body
        assert upload_counts(client, token) == before
        assert workspace.touched == touched


@pytest.mark.parametrize("content_length", [None, b"1"], ids=["no-length", "lying-length"])
def test_c_streamed_request_body_cap_stops_before_spooling_past_cap(
    monkeypatch: pytest.MonkeyPatch,
    content_length: bytes | None,
) -> None:
    with _client_context(limits=Limits(max_upload_mb=1)) as client:
        token = workspace_token(client)
        manager = client.app.state.workspace_manager
        workspace = manager.workspaces[token]
        before = upload_counts(client, token)
        touched = workspace.touched
        cap = 1024 * 1024 + MULTIPART_OVERHEAD_BYTES
        chunk_size = 8192
        boundary = b"streamed-boundary"
        body = oversized_multipart_body(boundary, cap * 2)
        chunks = [
            body[offset : offset + chunk_size]
            for offset in range(0, len(body), chunk_size)
        ]
        spool_writes: list[int] = []
        original_spooled_file = formparsers.SpooledTemporaryFile

        class TrackedSpool:
            def __init__(self, *args, **kwargs) -> None:
                self.file = original_spooled_file(*args, **kwargs)
                self.size = 0

            def write(self, data: bytes) -> int:
                self.size += len(data)
                spool_writes.append(self.size)
                return self.file.write(data)

            def __getattr__(self, name):
                return getattr(self.file, name)

        monkeypatch.setattr(formparsers, "SpooledTemporaryFile", TrackedSpool)
        headers = [
            (
                b"content-type",
                b"multipart/form-data; boundary=" + boundary,
            ),
            (b"x-workspace-token", token.encode("ascii")),
        ]
        if content_length is not None:
            headers.append((b"content-length", content_length))

        status, _, response_body, consumed, _ = call_asgi(
            client, "/workspace/documents", headers, chunks
        )
        assert status == 413
        assert json.loads(response_body)["error"]["message"] == (
            "The file exceeds the upload size limit."
        )
        assert token.encode("ascii") not in response_body
        assert b"x" * 128 not in response_body
        assert cap < consumed <= cap + chunk_size
        assert consumed < len(body)
        assert spool_writes and max(spool_writes) <= cap
        assert upload_counts(client, token) == before
        assert workspace.touched == touched


def test_c_normal_upload_and_arxiv_search_are_unaffected_by_body_cap() -> None:
    record = {
        "title": "Arxiv paper",
        "text": "searchable abstract text",
        "categories": ["cs.IR"],
        "year": 2024,
    }
    registry = SearchRegistry(
        records={"paper": record},
        retrievers={"tfidf": FakeRetriever([SearchResult("paper", 1.0, record["text"])])},
        methods={"tfidf": MethodInfo("tfidf", "TF-IDF", ready=True)},
    )
    with _client_context(
        limits=Limits(max_upload_mb=1), registry=registry
    ) as client:
        token = workspace_token(client)
        uploaded = upload(
            client, token, "normal.txt", b"normal upload contains searchable words."
        )
        assert uploaded.status_code == 200

        search_body = json.dumps(
            {"query": "abstract", "method": "tfidf", "k": 1}
        ).encode("utf-8")
        cap = 1024 * 1024 + MULTIPART_OVERHEAD_BYTES
        status, _, response_body, consumed, _ = call_asgi(
            client,
            "/search",
            [
                (b"content-type", b"application/json"),
                (b"content-length", str(cap + 1).encode("ascii")),
            ],
            [search_body],
        )
        assert status == 200
        assert consumed == len(search_body)
        assert json.loads(response_body)["results"][0]["id"] == "paper"


def test_c_pdf_page_limit_rejects_without_partial_state(client: TestClient) -> None:
    client.app.state.workspace_manager.limits = Limits(max_pdf_pages=1)
    token = workspace_token(client)
    data = make_pdf(["one page text", "second page text"])
    before = upload_counts(client, token)
    response = upload(client, token, "pages.pdf", data, "application/octet-stream")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "pdf_page_limit"
    assert upload_counts(client, token) == before


def test_c_character_limit_rejects_without_partial_state(client: TestClient) -> None:
    client.app.state.workspace_manager.limits = Limits(max_chars=12)
    token = workspace_token(client)
    before = upload_counts(client, token)
    response = upload(client, token, "chars.txt", b"this text is too long")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "document_too_large"
    assert upload_counts(client, token) == before


def test_c_pdf_extracted_character_limit_rejects_without_partial_state(
    client: TestClient,
) -> None:
    client.app.state.workspace_manager.limits = Limits(max_chars=12)
    token = workspace_token(client)
    before = upload_counts(client, token)
    response = upload(client, token, "long.pdf", make_pdf(["extracted text exceeds limit"]))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "document_too_large"
    assert upload_counts(client, token) == before


def test_c_file_and_passage_limits_reject_without_partial_state(client: TestClient) -> None:
    client.app.state.workspace_manager.limits = Limits(max_files=1, max_passages=1)
    token = workspace_token(client)
    first = upload(client, token, "first.txt", b"one two three.")
    assert first.status_code == 200

    before = upload_counts(client, token)
    file_limit = upload(client, token, "second.txt", b"four five six.")
    assert file_limit.status_code == 422
    assert file_limit.json()["error"]["message"] == "This workspace has reached its file limit."
    assert upload_counts(client, token) == before

    client.app.state.workspace_manager.limits = Limits(max_files=5, max_passages=1)
    passage_limit = upload(client, token, "second.txt", b"four five six.")
    assert passage_limit.status_code == 422
    assert passage_limit.json()["error"]["code"] == "passage_limit"
    assert upload_counts(client, token) == before


def test_c_workspace_capacity_limit(client: TestClient) -> None:
    client.app.state.workspace_manager.limits = Limits(max_workspaces=1)
    assert client.post("/workspaces").status_code == 200
    response = client.post("/workspaces")
    assert response.status_code == 429
    assert response.json()["error"]["message"] == (
        "The server is at workspace capacity. Try again later."
    )


def test_c_failed_indexing_keeps_previous_workspace_state(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    token = workspace_token(client)
    assert upload(client, token, "kept.txt", b"previous consistent document.").status_code == 200
    before = upload_counts(client, token)

    def fail_index(workspace, request) -> None:
        workspace.retrievers["partially-built"] = FakeRetriever([])
        _ = request
        raise RuntimeError("index failed")

    monkeypatch.setattr("backend.app.api.workspaces.build", fail_index)
    response = upload(client, token, "rejected.txt", b"candidate document.")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "indexing_failed"
    assert upload_counts(client, token) == before


@pytest.mark.parametrize(
    ("name", "data", "content_type", "code"),
    [
        ("bad.exe", b"not a document", "application/pdf", "unsupported_upload"),
        ("bad.pdf", b"%PDF-not really a pdf", "application/pdf", "invalid_pdf"),
        ("binary.txt", b"\x01\x02\x03\x04", "text/plain", "invalid_text"),
        ("nul.txt", b"good text\x00 more text", "text/plain", "invalid_text"),
        ("empty.txt", b"", "application/octet-stream", "invalid_text"),
        ("invalid-utf8.txt", b"\xff\xfe\xfa", "text/plain", "invalid_text"),
    ],
)
def test_d_hostile_or_invalid_files_are_rejected_without_state_changes(
    client: TestClient,
    name: str,
    data: bytes,
    content_type: str,
    code: str,
) -> None:
    token = workspace_token(client)
    before = upload_counts(client, token)
    response = upload(client, token, name, data, content_type)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code
    assert upload_counts(client, token) == before
    assert "Traceback" not in response.text
    if data:
        visible_content = data[:40].decode("utf-8", errors="ignore")
        if visible_content:
            assert visible_content not in response.text


@pytest.mark.parametrize(
    ("name", "content"),
    [
        ("../../x.pdf", make_pdf(["path sanitized document."])),
        (r"..\..\x.txt", b"windows path sanitized."),
        ("control\x01name.txt", b"control characters sanitized."),
        ("a" * 250 + ".txt", b"long filename sanitized."),
    ],
)
def test_d_uploaded_filenames_are_sanitized_and_workspace_does_not_write_to_cwd(
    client: TestClient, name: str, content: bytes
) -> None:
    token = workspace_token(client)
    before_cwd = set(Path.cwd().iterdir())
    response = upload(client, token, name, content)
    assert response.status_code == 200
    sanitized = response.json()["name"]
    assert "/" not in sanitized and "\\" not in sanitized
    assert len(sanitized) <= 200
    assert set(Path.cwd().iterdir()) == before_cwd


@pytest.mark.parametrize(
    ("name", "data", "code"),
    [
        ("corrupt.pdf", b"%PDF-1.4\nthis is corrupt", "invalid_pdf"),
        ("locked.pdf", make_pdf(["secret document"], password="secret"), "encrypted_pdf"),
        ("blank.pdf", make_pdf([""]), "no_extractable_text"),
    ],
)
def test_d_corrupt_encrypted_and_textless_pdfs_are_rejected(
    client: TestClient, name: str, data: bytes, code: str
) -> None:
    token = workspace_token(client)
    before = upload_counts(client, token)
    response = upload(client, token, name, data, "application/octet-stream")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code
    assert upload_counts(client, token) == before


def test_d_pdf_with_some_empty_pages_keeps_document_and_reports_warning(
    client: TestClient,
) -> None:
    token = workspace_token(client)
    response = upload(client, token, "mixed.pdf", make_pdf(["first page text", "", "third page text"]))
    assert response.status_code == 200
    assert response.json()["warnings"] == [
        "1 pages had no extractable text; scanned images are not supported."
    ]


def test_e_idle_expiry_refreshes_on_use_and_removes_all_workspace_data() -> None:
    now = [100.0]
    with _client_context(limits=Limits(ttl_minutes=1), clock=lambda: now[0]) as client:
        token = workspace_token(client)
        assert upload(client, token, "expiry.txt", b"temporary expiry content.").status_code == 200
        workspace = client.app.state.workspace_manager.workspaces[token]
        original_retrievers = workspace.retrievers
        now[0] += 50
        assert client.get("/workspace", headers={"X-Workspace-Token": token}).status_code == 200
        refreshed = workspace.touched
        assert refreshed == now[0]
        now[0] += 50
        client.app.state.workspace_manager.cleanup()
        assert token in client.app.state.workspace_manager.workspaces
        now[0] += 10
        client.app.state.workspace_manager.cleanup()
        assert token not in client.app.state.workspace_manager.workspaces
        assert all(
            stored is not workspace
            for stored in client.app.state.workspace_manager.workspaces.values()
        )
        assert workspace.retrievers is original_retrievers
        assert client.get(
            "/workspace", headers={"X-Workspace-Token": token}
        ).status_code == 404


def test_e_cleanup_task_starts_and_stops_with_app_lifespan() -> None:
    app = create_app(SearchRegistry())
    with TestClient(app):
        task = app.state.workspace_cleanup_task
        assert task is not None and not task.done()
    assert task.done()
    assert app.state.workspace_cleanup_task is None


def test_f_deleting_one_document_rebuilds_index_and_removes_its_passages(
    client: TestClient,
) -> None:
    token = workspace_token(client)
    first = upload(client, token, "first.txt", b"alphaunique document passage.")
    second = upload(client, token, "second.txt", b"betaunique other passage.")
    first_id = first.json()["id"]
    first_passage = client.app.state.workspace_manager.workspaces[token].documents[
        first_id
    ].passages[0]["id"]

    response = client.delete(
        f"/workspace/documents/{first_id}",
        headers={"X-Workspace-Token": token},
    )
    assert response.status_code == 204
    manager = client.app.state.workspace_manager
    workspace = manager.workspaces[token]
    assert list(workspace.documents) == [second.json()["id"]]
    assert first_passage not in workspace.retrievers["bm25"]._document_ids
    search = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "alphaunique"},
    ).json()
    assert search["results"] == []
    assert search["message"] == "No passages contain these words. Try the meaning-based search."


def test_f_deleting_workspace_removes_its_manager_entry(client: TestClient) -> None:
    token = workspace_token(client)
    assert upload(client, token, "delete.txt", b"delete this workspace.").status_code == 200
    assert client.delete("/workspace", headers={"X-Workspace-Token": token}).status_code == 204
    assert token not in client.app.state.workspace_manager.workspaces


def test_g_search_result_shape_sorting_and_passage_to_document_mapping(
    client: TestClient,
) -> None:
    token = workspace_token(client)
    first = upload(client, token, "first.txt", b"first passage has several words.")
    second = upload(client, token, "second.txt", b"second passage has several words.")
    manager = client.app.state.workspace_manager
    workspace = manager.workspaces[token]
    first_passage = workspace.documents[first.json()["id"]].passages[0]
    second_passage = workspace.documents[second.json()["id"]].passages[0]
    install_fake_methods(
        client,
        token,
        {
            "bm25": [
                SearchResult(first_passage["id"], 0.1, first_passage["text"]),
                SearchResult(second_passage["id"], 0.9, second_passage["text"]),
            ]
        },
    )
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "some query", "k": 2},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["method"] == "bm25" and body["query"] == "some query"
    assert body["k"] == 2 and body["took_ms"] >= 0
    assert [item["score"] for item in body["results"]] == [0.9, 0.1]
    assert body["results"][0]["document_id"] == second.json()["id"]
    assert body["results"][0]["document_name"] == "second.txt"
    assert body["results"][0]["page"] is None
    assert body["results"][0]["passage_index"] == 0
    assert set(body["results"][0]) == {
        "rank",
        "score",
        "document_id",
        "document_name",
        "page",
        "passage_index",
        "text",
        "snippet",
    }


def test_g_pdf_search_result_has_page_attribution(client: TestClient) -> None:
    token = workspace_token(client)
    response = upload(client, token, "pages.pdf", make_pdf(["first page text", "second page text"]))
    assert response.status_code == 200
    workspace = client.app.state.workspace_manager.workspaces[token]
    passage = workspace.documents[response.json()["id"]].passages[1]
    install_fake_methods(
        client,
        token,
        {"semantic": [SearchResult(passage["id"], 0.8, passage["text"])]},
    )
    result = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "meaning", "method": "semantic"},
    ).json()["results"][0]
    assert result["page"] == 2
    assert result["document_id"] == response.json()["id"]


@pytest.mark.parametrize(
    ("payload", "status", "code"),
    [
        ({"query": "  "}, 422, "validation_error"),
        ({"query": "x" * 501}, 422, "validation_error"),
        ({"query": "valid", "k": 0}, 422, "validation_error"),
        ({"query": "valid", "k": 51}, 422, "validation_error"),
        ({"query": "valid", "method": "missing"}, 422, "unknown_method"),
    ],
)
def test_g_workspace_search_validation_matches_search_bounds_and_method_ids(
    client: TestClient, payload: dict, status: int, code: str
) -> None:
    token = workspace_token(client)
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json=payload,
    )
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    if code == "unknown_method":
        assert response.json()["error"]["details"]["valid_methods"] == [
            "bm25",
            "semantic",
            "hybrid",
            "rerank",
        ]


def test_g_empty_workspace_has_friendly_422_before_method_availability(
    client: TestClient,
) -> None:
    token = workspace_token(client)
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "anything", "method": "semantic"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "empty_workspace"
    assert response.json()["error"]["message"] == "Upload at least one document first."


@pytest.mark.parametrize("method", ["bm25", "semantic", "hybrid", "rerank"])
def test_g_every_workspace_search_method_works_with_fakes(
    client: TestClient, method: str
) -> None:
    token = workspace_token(client)
    uploaded = upload(client, token, "fake-method.txt", b"fake result passage text.")
    passage = client.app.state.workspace_manager.workspaces[token].documents[
        uploaded.json()["id"]
    ].passages[0]
    install_fake_methods(
        client,
        token,
        {method: [SearchResult(passage["id"], 0.75, passage["text"])]},
    )
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "fake", "method": method},
    )
    assert response.status_code == 200
    assert response.json()["method"] == method
    assert len(response.json()["results"]) == 1


def test_g_unavailable_workspace_component_returns_503(client: TestClient) -> None:
    token = workspace_token(client)
    assert upload(client, token, "available.txt", b"some available document words.").status_code == 200
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "available", "method": "semantic"},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "method_unavailable"


def test_g_took_ms_includes_retrieval_and_result_mapping(client: TestClient) -> None:
    token = workspace_token(client)
    uploaded = upload(client, token, "delay.txt", b"timed retrieval passage.")
    passage = client.app.state.workspace_manager.workspaces[token].documents[
        uploaded.json()["id"]
    ].passages[0]
    install_fake_methods(
        client,
        token,
        {"bm25": [SearchResult(passage["id"], 1.0, passage["text"])]},
    )
    client.app.state.workspace_manager.workspaces[token].retrievers["bm25"] = FakeRetriever(
        [SearchResult(passage["id"], 1.0, passage["text"])], delay=0.04
    )
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "timed"},
    )
    assert response.status_code == 200
    assert response.json()["took_ms"] >= 35


def test_g_dense_index_preparation_and_faiss_work_stay_outside_inference_lock() -> None:
    class TrackingLock:
        held = False

        def __enter__(self) -> None:
            assert not self.held
            self.held = True

        def __exit__(self, exc_type, exc_value, traceback) -> None:
            _ = exc_type, exc_value, traceback
            self.held = False

    lock = TrackingLock()

    class CheckedCorpus(dict):
        def __getitem__(self, key):
            assert not lock.held
            return super().__getitem__(key)

    class FakeModel:
        def encode(self, texts: list[str], **kwargs) -> np.ndarray:
            assert lock.held
            assert kwargs["show_progress_bar"] is True
            return np.array([[1.0, 0.0] for _ in texts], dtype=np.float32)

    retriever = SentenceBertRetriever(model_name="fake", model=FakeModel())
    retriever.index(
        CheckedCorpus({"passage": {"title": "", "text": "fake passage"}}),
        inference_lock=lock,
    )
    assert not lock.held
    assert retriever._index is not None


def test_g_bm25_keyword_miss_returns_empty_with_friendly_message(client: TestClient) -> None:
    token = workspace_token(client)
    assert upload(client, token, "keywords.txt", b"ordinary matching document words.").status_code == 200
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "no_such_keyword_93"},
    )
    assert response.status_code == 200
    assert response.json()["results"] == []
    assert response.json()["message"] == (
        "No passages contain these words. Try the meaning-based search."
    )
    matched = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "ordinary"},
    ).json()
    assert matched["results"]
    assert "message" not in matched


def test_g_hybrid_drops_zero_score_bm25_candidates_before_fusion(
    client: TestClient,
) -> None:
    token = workspace_token(client)
    first = upload(client, token, "hybrid-first.txt", b"first meaning candidate passage.")
    second = upload(client, token, "hybrid-second.txt", b"second meaning candidate passage.")
    workspace = client.app.state.workspace_manager.workspaces[token]
    passages = [
        workspace.documents[first.json()["id"]].passages[0],
        workspace.documents[second.json()["id"]].passages[0],
    ]
    semantic = FakeRetriever(
        [
            SearchResult(passages[1]["id"], 0.9, passages[1]["text"]),
            SearchResult(passages[0]["id"], 0.8, passages[0]["text"]),
        ]
    )
    keyword = PositiveBM25Retriever(
        FakeRetriever(
            [SearchResult(passage["id"], 0.0, passage["text"]) for passage in passages]
        )
    )
    manager = client.app.state.workspace_manager
    manager.workspaces[token].retrievers["hybrid"] = HybridRetriever(
        [keyword, semantic], depth=100, reuse_indexed_components=True
    )
    response = client.post(
        "/workspace/search",
        headers={"X-Workspace-Token": token},
        json={"query": "unmatched term", "method": "hybrid"},
    )
    assert response.status_code == 200
    assert [item["document_id"] for item in response.json()["results"]] == [
        second.json()["id"],
        first.json()["id"],
    ]


def test_h_concurrent_uploads_and_searches_are_safe_for_same_and_different_workspaces(
    client: TestClient,
) -> None:
    token_a = workspace_token(client)
    token_b = workspace_token(client)
    assert upload(client, token_a, "seed-a.txt", b"seedtoken alpha passage.").status_code == 200
    assert upload(client, token_b, "seed-b.txt", b"seedtoken beta passage.").status_code == 200
    barrier = threading.Barrier(8)

    def operation(index: int) -> tuple[str, int]:
        token = token_a if index % 2 == 0 else token_b
        barrier.wait(timeout=5)
        if index < 4:
            response = upload(
                client,
                token,
                f"concurrent-{index}.txt",
                f"concurrent document {index} has words.".encode(),
            )
            return "upload", response.status_code
        response = client.post(
            "/workspace/search",
            headers={"X-Workspace-Token": token},
            json={"query": "seedtoken"},
        )
        return "search", response.status_code

    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(operation, range(8)))
    assert all(status == 200 for _, status in results)
    manager = client.app.state.workspace_manager
    assert len(manager.workspaces[token_a].documents) == 3
    assert len(manager.workspaces[token_b].documents) == 3
    assert all(
        len(document.passages) > 0
        for token in (token_a, token_b)
        for document in manager.workspaces[token].documents.values()
    )


def test_i_disabling_workspaces_does_not_change_arxiv_endpoints(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WORKSPACES_ENABLED", "false")
    record = {"title": "Arxiv record", "text": "searchable abstract", "categories": [], "year": 2024}
    registry = SearchRegistry(
        records={"paper": record},
        retrievers={"tfidf": FakeRetriever([SearchResult("paper", 1.0, record["text"])])},
        methods={"tfidf": MethodInfo("tfidf", "TF-IDF", ready=True)},
    )
    with _client_context(registry=registry) as client:
        token = "A" * 43
        responses = [
            client.post("/workspaces"),
            client.get("/workspace"),
            client.delete("/workspace", headers={"X-Workspace-Token": token}),
            client.post(
                "/workspace/documents",
                headers={"X-Workspace-Token": token},
                files={"file": ("file.txt", b"some words", "text/plain")},
            ),
            client.delete(
                "/workspace/documents/missing",
                headers={"X-Workspace-Token": token},
            ),
            client.post(
                "/workspace/search",
                headers={"X-Workspace-Token": token},
                json={"query": "some"},
            ),
        ]
        assert all(response.status_code == 404 for response in responses)
        assert all(
            response.json()["error"]["code"] == "workspace_disabled"
            for response in responses
        )
        assert client.get("/health").status_code == 200
        arxiv_search = client.post(
            "/search", json={"query": "abstract", "method": "tfidf"}
        )
        assert arxiv_search.status_code == 200
        assert arxiv_search.json()["results"][0]["id"] == "paper"


def test_j_application_logs_never_include_token_file_content_or_query(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    token = workspace_token(client)
    file_content = "SECRET_FILE_CONTENT_63a9"
    query = "SECRET_QUERY_8f10"
    with caplog.at_level(logging.DEBUG):
        uploaded = upload(
            client,
            token,
            "private.txt",
            f"{file_content} ordinary passage text".encode(),
        )
        assert uploaded.status_code == 200
        searched = client.post(
            "/workspace/search",
            headers={"X-Workspace-Token": token},
            json={"query": query},
        )
        assert searched.status_code == 200
        invalid_query = query * 51
        invalid_search = client.post(
            "/workspace/search",
            headers={"X-Workspace-Token": token},
            json={"query": invalid_query},
        )
        assert invalid_search.status_code == 422
        for secret in (token, file_content, invalid_query):
            assert secret not in invalid_search.text

    messages = [
        f"{record.getMessage()} {record.__dict__!r}"
        for record in caplog.records
    ]
    for secret in (token, file_content, query):
        assert all(secret not in message for message in messages)
    assert all("request body" not in message.lower() for message in messages)