"""Build a deterministic, filtered arXiv metadata corpus from Hugging Face."""

from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path
from typing import Iterable, Mapping

from tqdm import tqdm


DATASET_NAME = "yacud1/arxiv-bge-base-818k"
TARGET_CATEGORIES = frozenset({"cs.CL", "cs.AI", "cs.LG", "cs.IR", "cs.CV"})


def normalize_record(row: Mapping[str, object]) -> dict[str, object] | None:
    """Return one retriever-compatible record when it matches the CS filters."""
    document_id = str(row.get("id", "")).strip()
    abstract = " ".join(str(row.get("abstract", "")).split())
    categories_value = row.get("categories", "")
    categories = categories_value.split() if isinstance(categories_value, str) else list(categories_value or [])
    categories = [str(category) for category in categories]
    if not document_id or not abstract or not TARGET_CATEGORIES.intersection(categories):
        return None
    date = str(row.get("update_date", ""))
    year_match = re.match(r"(\d{4})", date)
    return {
        "_id": document_id,
        "title": " ".join(str(row.get("title", "")).split()),
        "text": abstract,
        "categories": categories,
        "year": int(year_match.group(1)) if year_match else None,
    }


def sample_records(rows: Iterable[Mapping[str, object]], size: int, seed: int) -> list[dict[str, object]]:
    """Deduplicate and reservoir-sample matching rows without retaining the source."""
    if size < 1:
        raise ValueError("size must be at least 1.")
    rng = random.Random(seed)
    sample: list[dict[str, object]] = []
    seen_ids: set[str] = set()
    for row in tqdm(rows, desc="Filtering arXiv metadata", unit="papers", mininterval=10):
        record = normalize_record(row)
        if record is None or record["_id"] in seen_ids:
            continue
        seen_ids.add(str(record["_id"]))
        if len(sample) < size:
            sample.append(record)
        else:
            replacement = rng.randrange(len(seen_ids))
            if replacement < size:
                sample[replacement] = record
    if len(sample) < size:
        raise ValueError(f"Only found {len(sample):,} matching arXiv papers; requested {size:,}.")
    return sorted(sample, key=lambda record: str(record["_id"]))


def main() -> None:
    """Stream the public metadata set and write the selected corpus as JSONL."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--size", type=int, default=30_000, help="Number of papers to save.")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic sampling seed.")
    parser.add_argument("--output", type=Path, default=Path("data/arxiv_cs_30000.jsonl"))
    args = parser.parse_args()
    from datasets import load_dataset

    dataset = load_dataset(DATASET_NAME, data_files="metadata.parquet", split="train", streaming=True)
    records = sample_records(dataset, args.size, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as output_file:
        for record in records:
            output_file.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Wrote {len(records):,} papers to {args.output} ({args.output.stat().st_size / 1024 / 1024:.1f} MiB).")


if __name__ == "__main__":
    main()
