"""Load the locally-built arXiv demonstration corpus."""

from __future__ import annotations

import json
from pathlib import Path

from .beir import Corpus


def load_arxiv_corpus(path: str | Path) -> tuple[Corpus, dict[str, dict[str, object]]]:
    """Load JSONL corpus records into the retriever-compatible corpus mapping."""
    records: dict[str, dict[str, object]] = {}
    with Path(path).open(encoding="utf-8") as input_file:
        for line in input_file:
            record = json.loads(line)
            document_id = str(record["_id"])
            records[document_id] = record
    corpus: Corpus = {
        document_id: {"title": str(record.get("title", "")), "text": str(record.get("text", ""))}
        for document_id, record in records.items()
    }
    return corpus, records
