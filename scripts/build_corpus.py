"""Build a deterministic, category-filtered arXiv metadata corpus from Hugging Face."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
from pathlib import Path
from typing import Iterable, Mapping

from tqdm import tqdm


DATASET_NAME = "yacud1/arxiv-bge-base-818k"
DEFAULT_SIZE = 60_000
DEFAULT_CATEGORIES = (
    "cs.AI",
    "cs.CL",
    "cs.LG",
    "cs.IR",
    "cs.CV",
    "cs.RO",
    "cs.CR",
    "cs.SE",
    "cs.DB",
    "cs.DC",
    "cs.HC",
    "cs.NI",
    "cs.NE",
)


def parse_categories(value: str) -> tuple[str, ...]:
    """Parse a comma-separated list while preserving its display order."""
    categories = tuple(dict.fromkeys(category.strip() for category in value.split(",")))
    if not categories or any(not category for category in categories):
        raise argparse.ArgumentTypeError("categories must be a non-empty comma-separated list.")
    return categories


def corpus_name(size: int, categories: Iterable[str]) -> str:
    """Return a size-and-category-specific, stable corpus filename stem."""
    category_list = ",".join(sorted(set(categories)))
    digest = hashlib.sha256(category_list.encode("utf-8")).hexdigest()[:8]
    return f"arxiv_{size}_{digest}"


def default_corpus_path(size: int = DEFAULT_SIZE, categories: Iterable[str] = DEFAULT_CATEGORIES) -> Path:
    return Path("data") / f"{corpus_name(size, categories)}.jsonl"


def _categories_for_row(row: Mapping[str, object]) -> list[str]:
    categories_value = row.get("categories", "")
    categories = categories_value.split() if isinstance(categories_value, str) else list(categories_value or [])
    return [str(category) for category in categories]


def normalize_record(
    row: Mapping[str, object],
    categories: Iterable[str] = DEFAULT_CATEGORIES,
) -> dict[str, object] | None:
    """Return one retriever-compatible record matching any listed category."""
    document_id = str(row.get("id", "")).strip()
    abstract = " ".join(str(row.get("abstract", "")).split())
    record_categories = _categories_for_row(row)
    if not document_id or not abstract or not set(categories).intersection(record_categories):
        return None
    date = str(row.get("update_date", ""))
    year_match = re.match(r"(\d{4})", date)
    return {
        "_id": document_id,
        "title": " ".join(str(row.get("title", "")).split()),
        "text": abstract,
        "categories": record_categories,
        "year": int(year_match.group(1)) if year_match else None,
    }


def sample_records(
    rows: Iterable[Mapping[str, object]],
    size: int,
    seed: int,
    categories: Iterable[str] = DEFAULT_CATEGORIES,
    *,
    source_category_counts: dict[str, int] | None = None,
) -> list[dict[str, object]]:
    """Deduplicate and reservoir-sample matching rows without retaining the source."""
    if size < 1:
        raise ValueError("size must be at least 1.")
    category_list = tuple(categories)
    target_categories = set(category_list)
    rng = random.Random(seed)
    sample: list[dict[str, object]] = []
    seen_ids: set[str] = set()
    for row in tqdm(rows, desc="Filtering arXiv metadata", unit="papers", mininterval=10):
        document_id = str(row.get("id", "")).strip()
        row_categories = _categories_for_row(row)
        if source_category_counts is not None and document_id:
            for category in target_categories.intersection(row_categories):
                source_category_counts[category] += 1
        record = normalize_record(row, category_list)
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


def corpus_statistics(
    records: list[dict[str, object]],
    categories: Iterable[str],
    source_category_counts: Mapping[str, int],
    *,
    size: int,
    seed: int,
) -> dict[str, object]:
    """Summarize sampled coverage and full-source counts for requested categories."""
    category_counts: dict[str, int] = {}
    first_listed_category_counts: dict[str, int] = {}
    year_counts: dict[str, int] = {}
    for record in records:
        record_categories = [str(category) for category in record["categories"]]
        for category in record_categories:
            category_counts[category] = category_counts.get(category, 0) + 1
        if record_categories:
            first = record_categories[0]
            first_listed_category_counts[first] = first_listed_category_counts.get(first, 0) + 1
        year = record.get("year")
        year_key = str(year) if isinstance(year, int) else "unknown"
        year_counts[year_key] = year_counts.get(year_key, 0) + 1
    return {
        "dataset": DATASET_NAME,
        "sampling": {
            "size_requested": size,
            "seed": seed,
            "rule": "Reservoir sample after filtering; include a paper if any listed category matches; deduplicate by arXiv ID.",
        },
        "requested_categories": list(categories),
        "source_category_counts": {
            category: source_category_counts[category] for category in categories
        },
        "total": len(records),
        "category_counts": dict(sorted(category_counts.items())),
        "first_listed_category_counts": dict(sorted(first_listed_category_counts.items())),
        "year_counts": dict(sorted(year_counts.items())),
    }


def build_corpus(
    rows: Iterable[Mapping[str, object]],
    output_path: Path,
    size: int,
    seed: int,
    categories: Iterable[str],
) -> dict[str, object]:
    """Write JSONL and its adjacent statistics report without replacing files."""
    output_path = Path(output_path)
    stats_path = output_path.with_suffix(".stats.json")
    if output_path.exists() or stats_path.exists():
        raise FileExistsError(
            f"Refusing to overwrite an existing corpus or statistics file: '{output_path}' or '{stats_path}'."
        )
    category_list = tuple(categories)
    source_category_counts = dict.fromkeys(category_list, 0)
    records = sample_records(
        rows,
        size,
        seed,
        category_list,
        source_category_counts=source_category_counts,
    )
    stats = corpus_statistics(
        records, category_list, source_category_counts, size=size, seed=seed
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as output_file:
        for record in records:
            output_file.write(json.dumps(record, ensure_ascii=False) + "\n")
    stats_path.write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(stats, indent=2))
    for category in category_list:
        count = source_category_counts[category]
        if count < 200:
            print(
                f"WARNING: requested category {category} has {count} source records "
                "(fewer than 200)."
            )
    print(
        f"Wrote {len(records):,} papers to {output_path} "
        f"({output_path.stat().st_size / 1024 / 1024:.1f} MiB)."
    )
    print(f"Saved coverage report to {stats_path}.")
    return stats


def argument_parser() -> argparse.ArgumentParser:
    """Create the command-line parser for corpus builds."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE, help="Number of papers to save.")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic sampling seed.")
    parser.add_argument(
        "--categories",
        type=parse_categories,
        default=DEFAULT_CATEGORIES,
        help="Comma-separated categories; a cross-listed paper matches if any category is included.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output JSONL path (default: data/<size-and-category-hash>.jsonl).",
    )
    return parser


def main() -> None:
    """Stream the public metadata set and write the selected corpus as JSONL."""
    parser = argument_parser()
    args = parser.parse_args()
    if args.size < 1:
        parser.error("--size must be at least 1.")
    output_path = args.output or default_corpus_path(args.size, args.categories)
    if output_path.exists() or output_path.with_suffix(".stats.json").exists():
        parser.error(
            f"Refusing to overwrite an existing corpus or statistics file for '{output_path}'."
        )
    from datasets import load_dataset

    dataset = load_dataset(DATASET_NAME, data_files="metadata.parquet", split="train", streaming=True)
    build_corpus(dataset, output_path, args.size, args.seed, args.categories)


if __name__ == "__main__":
    main()
