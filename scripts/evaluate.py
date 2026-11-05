"""Run a retrieval benchmark against BEIR SciFact."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from backend.app.data.scifact import load_scifact
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
        "--model",
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="Sentence-BERT model name used when --method is sbert or all.",
    )
    parser.add_argument("--data-dir", type=Path, default=Path("data"), help="Dataset cache directory.")
    parser.add_argument("--results-dir", type=Path, default=Path("results"), help="Directory for JSON reports.")
    args = parser.parse_args()

    dataset = load_scifact(args.data_dir)
    print(f"SciFact test set: {len(dataset.corpus):,} documents | {len(dataset.queries):,} queries | {len(dataset.qrels):,} qrels")

    args.results_dir.mkdir(parents=True, exist_ok=True)
    methods = ("tfidf", "sbert") if args.method == "all" else (args.method,)
    reports = {
        method: evaluate(build_retriever(method, args.model), dataset.corpus, dataset.queries, dataset.qrels)
        for method in methods
    }
    if args.method == "all":
        print_comparison(reports)
    else:
        print_report(args.method, reports[args.method])

    for method, report in reports.items():
        output_path = args.results_dir / f"scifact_{method}.json"
        payload = {
            "method": method,
            "dataset": "BEIR SciFact",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            **report.to_dict(),
        }
        output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Saved JSON report: {output_path}")


if __name__ == "__main__":
    main()
