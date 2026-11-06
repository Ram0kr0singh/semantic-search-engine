"""Registry and loaders for BEIR datasets published on the Hugging Face Hub."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


Document = dict[str, str]
Corpus = dict[str, Document]
Qrels = dict[str, dict[str, int]]


@dataclass(frozen=True)
class BeirDataset:
    """A BEIR corpus, its test queries, and test relevance judgments."""

    corpus: Corpus
    queries: dict[str, str]
    qrels: Qrels

    @property
    def qrel_count(self) -> int:
        """Return the number of individual query-document relevance judgments."""
        return sum(len(relevant) for relevant in self.qrels.values())


@dataclass(frozen=True)
class DatasetDefinition:
    """Hugging Face repositories for a BEIR-format evaluation collection."""

    name: str
    corpus_dataset: str
    qrels_dataset: str


DATASET_REGISTRY: dict[str, DatasetDefinition] = {
    "scifact": DatasetDefinition("scifact", "BeIR/scifact", "BeIR/scifact-qrels"),
    "fiqa": DatasetDefinition("fiqa", "BeIR/fiqa", "BeIR/fiqa-qrels"),
}


def dataset_names() -> tuple[str, ...]:
    """Return registered dataset names in stable CLI order."""
    return tuple(DATASET_REGISTRY)


def load_dataset(name: str, data_dir: str | Path = "data") -> BeirDataset:
    """Download (when needed) and load a registered BEIR-format test split."""
    try:
        definition = DATASET_REGISTRY[name]
    except KeyError as exc:
        raise ValueError(f"Unknown dataset '{name}'. Available datasets: {', '.join(dataset_names())}") from exc

    cache_root = Path(data_dir)
    os.environ.setdefault("HF_HOME", str(cache_root / "huggingface-home"))
    try:
        from datasets import load_dataset as hf_load_dataset
    except ImportError as exc:  # pragma: no cover - only exercised in misconfiguration
        raise RuntimeError(
            "datasets is required to load BEIR benchmarks. Install dependencies with "
            "`pip install -r requirements.txt`."
        ) from exc

    cache_dir = str(cache_root / "huggingface")
    corpus_rows = hf_load_dataset(definition.corpus_dataset, "corpus", split="corpus", cache_dir=cache_dir)
    query_rows = hf_load_dataset(definition.corpus_dataset, "queries", split="queries", cache_dir=cache_dir)
    qrel_rows = hf_load_dataset(definition.qrels_dataset, split="test", cache_dir=cache_dir)

    return _build_dataset(corpus_rows, query_rows, qrel_rows)


def _build_dataset(
    corpus_rows: object, query_rows: object, qrel_rows: object
) -> BeirDataset:
    """Normalize BEIR rows; kept separate to make loader behavior testable offline."""
    corpus: Corpus = {
        str(row["_id"]): {"title": row.get("title") or "", "text": row.get("text") or ""}
        for row in corpus_rows
    }
    qrels: Qrels = {}
    for row in qrel_rows:
        query_id = str(row["query-id"])
        qrels.setdefault(query_id, {})[str(row["corpus-id"])] = int(row["score"])
    queries = {str(row["_id"]): str(row["text"]) for row in query_rows if str(row["_id"]) in qrels}
    return BeirDataset(corpus=corpus, queries=queries, qrels=qrels)
