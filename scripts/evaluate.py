"""Run a retrieval benchmark against BEIR SciFact."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from backend.app.data.scifact import load_scifact
from backend.app.evaluation.runner import evaluate
from backend.app.retrieval.base import Retriever
from backend.app.retrieval.tfidf import TfidfRetriever


def build_retriever(method: str) -> Retriever:
    """Construct a registered retriever implementation by method name."""
    registry: dict[str, type[Retriever]] = {"tfidf": TfidfRetriever}
    try:
        return registry[method]()
    except KeyError as exc:
        raise ValueError(f"Unknown method '{method}'. Available methods: {', '.join(registry)}") from exc


def main() -> None:
    """Parse CLI arguments, evaluate a retriever, and write a JSON report."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--method", default="tfidf", choices=("tfidf",), help="Retriever to evaluate.")
    parser.add_argument("--data-dir", type=Path, default=Path("data"), help="Dataset cache directory.")
    parser.add_argument("--results-dir", type=Path, default=Path("results"), help="Directory for JSON reports.")
    args = parser.parse_args()

    dataset = load_scifact(args.data_dir)
    report = evaluate(build_retriever(args.method), dataset.corpus, dataset.queries, dataset.qrels)
    print(f"SciFact test set: {len(dataset.corpus):,} documents | {len(dataset.queries):,} queries | {len(dataset.qrels):,} qrels")
    print(f"\n{'Metric':<28}{'Value':>12}")
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

    args.results_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.results_dir / f"scifact_{args.method}.json"
    payload = {"method": args.method, "dataset": "BEIR SciFact", "generated_at": datetime.now(timezone.utc).isoformat(), **report.to_dict()}
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaved JSON report: {output_path}")


if __name__ == "__main__":
    main()
