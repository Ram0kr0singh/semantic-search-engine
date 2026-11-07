"""Run retrieval benchmarks against registered BEIR datasets."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import re

from backend.app.data.beir import BeirDataset, dataset_names, load_dataset
from backend.app.evaluation.runner import EvaluationReport, PerQueryMetrics, evaluate, evaluate_with_per_query
from backend.app.retrieval.base import Retriever
from backend.app.retrieval.bm25 import BM25Retriever
from backend.app.retrieval.hybrid import HybridRetriever
from backend.app.retrieval.sbert import SentenceBertRetriever
from backend.app.retrieval.tfidf import TfidfRetriever


def build_retriever(method: str, model_name: str) -> Retriever:
    """Construct a registered retriever implementation by method name."""
    registry: dict[str, type[Retriever]] = {"tfidf": TfidfRetriever, "bm25": BM25Retriever}
    if method == "sbert":
        return SentenceBertRetriever(model_name=model_name)
    if method == "hybrid":
        return HybridRetriever([BM25Retriever(), SentenceBertRetriever(model_name=model_name)])
    try:
        return registry[method]()
    except KeyError as exc:
        methods = (*registry, "sbert", "hybrid")
        raise ValueError(f"Unknown method '{method}'. Available methods: {', '.join(methods)}") from exc


def result_filename(dataset: str, method: str, model_name: str | None = None) -> str:
    """Return a collision-resistant, filesystem-safe JSON report filename."""
    if method in {"sbert", "hybrid"}:
        if not model_name:
            raise ValueError("A dense or hybrid result filename requires a model name.")
        model_slug = re.sub(r"[^A-Za-z0-9._-]+", "-", model_name.rsplit("/", 1)[-1]).strip("-._").lower()
        return f"{dataset}_{method}_{model_slug}.json"
    return f"{dataset}_{method}.json"


def per_query_filename(dataset: str, method: str, model_name: str | None = None) -> str:
    """Return the companion filename used for saved query-level metrics."""
    return f"{Path(result_filename(dataset, method, model_name)).stem}_perquery.json"


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
        choices=("tfidf", "bm25", "sbert", "hybrid", "all"),
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
    parser.add_argument("--save-per-query", action="store_true", help="Also save query-level metrics for statistical analysis.")
    args = parser.parse_args()

    args.results_dir.mkdir(parents=True, exist_ok=True)
    methods = ("tfidf", "bm25", "sbert", "hybrid") if args.method == "all" else (args.method,)
    names = dataset_names() if args.dataset == "all" else (args.dataset,)
    for name in names:
        dataset = load_dataset(name, args.data_dir)
        print_dataset_header(name, dataset)
        # SentenceBertRetriever loads its model during construction, before
        # evaluate starts its index timer. That keeps index timings comparable.
        reports: dict[str, EvaluationReport] = {}
        per_query: dict[str, list[PerQueryMetrics]] = {}
        instances: dict[str, Retriever] = {}
        for method in methods:
            if method == "hybrid" and args.method == "all":
                instances[method] = HybridRetriever(
                    [instances["bm25"], instances["sbert"]], reuse_indexed_components=True
                )
            else:
                instances[method] = build_retriever(method, args.model)
            if args.save_per_query:
                reports[method], per_query[method] = evaluate_with_per_query(
                    instances[method], dataset.corpus, dataset.queries, dataset.qrels,
                    index_build_seconds_override=(reports["bm25"].index_build_seconds + reports["sbert"].index_build_seconds)
                    if method == "hybrid" and args.method == "all" else None,
                )
            else:
                reports[method] = evaluate(
                    instances[method], dataset.corpus, dataset.queries, dataset.qrels,
                    index_build_seconds_override=(reports["bm25"].index_build_seconds + reports["sbert"].index_build_seconds)
                    if method == "hybrid" and args.method == "all" else None,
                )
        if args.method == "all":
            print_comparison(reports)
        else:
            print_report(args.method, reports[args.method])

        for method, report in reports.items():
            output_path = args.results_dir / result_filename(name, method, args.model)
            payload = {
                "method": method,
                "dataset": name,
                "model": args.model if method in {"sbert", "hybrid"} else None,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                **report.to_dict(),
            }
            if method == "hybrid":
                payload["fusion"] = {"method": "rrf", "k_rrf": 60, "depth": 100, "components": ["bm25", "sbert"]}
            output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            print(f"Saved JSON report: {output_path}")
            if args.save_per_query:
                query_output_path = args.results_dir / per_query_filename(name, method, args.model)
                query_payload = {
                    "method": method,
                    "dataset": name,
                    "model": args.model if method in {"sbert", "hybrid"} else None,
                    "generated_at": payload["generated_at"],
                    "query_count": report.query_count,
                    "queries": [item.to_dict() for item in per_query[method]],
                }
                if method == "hybrid":
                    query_payload["fusion"] = payload["fusion"]
                query_output_path.write_text(json.dumps(query_payload, indent=2) + "\n", encoding="utf-8")
                print(f"Saved per-query JSON: {query_output_path}")


if __name__ == "__main__":
    main()
