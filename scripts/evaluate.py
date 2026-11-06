"""Run retrieval benchmarks against registered BEIR datasets."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import re

from backend.app.data.beir import BeirDataset, dataset_names, load_dataset
from backend.app.evaluation.runner import EvaluationReport, evaluate
from backend.app.retrieval.base import Retriever
from backend.app.retrieval.sbert import SentenceBertRetriever
from backend.app.retrieval.tfidf import TfidfRetriever


def build_retriever(method: str, model_name: str) -> Retriever:
    """Construct a registered retriever implementation by method name."""
    registry: dict[str, type[Retriever]] = {"tfidf": TfidfRetriever}
    if method == "sbert":
        return SentenceBertRetriever(model_name=model_name)
    try:
        return registry[method]()
    except KeyError as exc:
        methods = (*registry, "sbert")
        raise ValueError(f"Unknown method '{method}'. Available methods: {', '.join(methods)}") from exc


def result_filename(dataset: str, method: str, model_name: str | None = None) -> str:
    """Return a collision-resistant, filesystem-safe JSON report filename."""
    if method == "sbert":
        if not model_name:
            raise ValueError("A Sentence-BERT result filename requires a model name.")
        model_slug = re.sub(r"[^A-Za-z0-9._-]+", "-", model_name.rsplit("/", 1)[-1]).strip("-._").lower()
        return f"{dataset}_{method}_{model_slug}.json"
    return f"{dataset}_{method}.json"


def print_report(method: str, report: EvaluationReport) -> None:
    """Print a single-retriever metrics table."""
    print(f"\n{method.upper()} results")
    print(f"{'Metric':<28}{'Value':>12}")
    print("-" * 40)
    for label, value in (
        ("Recall@1", report.recall_at_1),
        ("Recall@5", report.recall_at_5),
        ("Recall@10", report.recall_at_10),
        ("Recall@100", report.recall_at_100),
        ("MRR@10", report.mrr_at_10),
        ("nDCG@10", report.ndcg_at_10),
        ("Index build time (s)", report.index_build_seconds),
        ("Average query latency (ms)", report.average_query_latency_ms),
    ):
        print(f"{label:<28}{value:>12.4f}")


def print_comparison(reports: dict[str, EvaluationReport]) -> None:
    """Print a compact comparison table for several retrievers."""
    headers = (
        "Method",
        "Recall@1",
        "Recall@5",
        "Recall@10",
        "Recall@100",
        "MRR@10",
        "nDCG@10",
        "Index s",
        "Query ms",
    )
    print("\n" + "  ".join(f"{header:<10}" for header in headers))
    print("-" * 108)
    for method, report in reports.items():
        values = (
            method,
            report.recall_at_1,
            report.recall_at_5,
            report.recall_at_10,
            report.recall_at_100,
            report.mrr_at_10,
            report.ndcg_at_10,
            report.index_build_seconds,
            report.average_query_latency_ms,
        )
        print(f"{values[0]:<10}" + "".join(f"  {value:>10.4f}" for value in values[1:]))


def print_dataset_header(name: str, dataset: BeirDataset) -> None:
    """Print the loaded test-set identity and exact collection counts."""
    print(
        f"{name} test set: {len(dataset.corpus):,} documents | "
        f"{len(dataset.queries):,} queries | {dataset.qrel_count:,} qrels"
    )


def main() -> None:
    """Parse CLI arguments, evaluate a retriever, and write a JSON report."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--method",
        default="tfidf",
        choices=("tfidf", "sbert", "all"),
        help="Retriever to evaluate, or all registered retrievers.",
    )
    parser.add_argument(
        "--dataset",
        default="scifact",
        choices=(*dataset_names(), "all"),
        help="BEIR dataset to evaluate, or all registered datasets.",
    )
    parser.add_argument(
        "--model",
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="Sentence-BERT model name used when --method is sbert or all.",
    )
    parser.add_argument("--data-dir", type=Path, default=Path("data"), help="Dataset cache directory.")
    parser.add_argument("--results-dir", type=Path, default=Path("results"), help="Directory for JSON reports.")
    args = parser.parse_args()

    args.results_dir.mkdir(parents=True, exist_ok=True)
    methods = ("tfidf", "sbert") if args.method == "all" else (args.method,)
    names = dataset_names() if args.dataset == "all" else (args.dataset,)
    for name in names:
        dataset = load_dataset(name, args.data_dir)
        print_dataset_header(name, dataset)
        # SentenceBertRetriever loads its model during construction, before
        # evaluate starts its index timer. That keeps index timings comparable.
        reports = {
            method: evaluate(build_retriever(method, args.model), dataset.corpus, dataset.queries, dataset.qrels)
            for method in methods
        }
        if args.method == "all":
            print_comparison(reports)
        else:
            print_report(args.method, reports[args.method])

        for method, report in reports.items():
            output_path = args.results_dir / result_filename(name, method, args.model)
            payload = {
                "method": method,
                "dataset": name,
                "model": args.model if method == "sbert" else None,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                **report.to_dict(),
            }
            output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            print(f"Saved JSON report: {output_path}")


if __name__ == "__main__":
    main()
