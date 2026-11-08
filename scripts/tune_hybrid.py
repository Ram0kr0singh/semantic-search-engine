"""Tune a weighted BM25+dense RRF hybrid on a disjoint BEIR development split."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from backend.app.data.beir import BeirDataset, assert_disjoint_queries, dataset_names, load_dataset, load_development_dataset
from backend.app.evaluation.metrics import mean_reciprocal_rank_at_k, ndcg_at_k, recall_at_k
from backend.app.evaluation.runner import EvaluationReport, PerQueryMetrics
from backend.app.retrieval.bm25 import BM25Retriever
from backend.app.retrieval.hybrid import fuse_rankings
from backend.app.retrieval.sbert import SentenceBertRetriever
from scripts.evaluate import per_query_filename, result_filename

GRID = tuple(round(index / 10, 1) for index in range(11))
K_RRF, DEPTH = 60, 100


def select_weight(scores: dict[float, float]) -> float:
    """Select max nDCG, breaking ties toward 0.5 and then lower weight."""
    return min(scores, key=lambda weight: (-scores[weight], round(abs(weight - .5), 12), weight))


def component_rankings(components: list[object], queries: dict[str, str]) -> dict[str, list[list[object]]]:
    return {query_id: [component.search(query, DEPTH) for component in components] for query_id, query in queries.items()}


def evaluate_rankings(dataset: BeirDataset, rankings: dict[str, list[list[object]]], weight: float, index_seconds: float) -> tuple[EvaluationReport, list[PerQueryMetrics]]:
    started = perf_counter()
    fused = {qid: fuse_rankings(rows, k_rrf=K_RRF, weights=(weight, 1 - weight), k=100) for qid, rows in rankings.items()}
    elapsed = perf_counter() - started
    ids = list(dataset.queries)
    per_query: list[PerQueryMetrics] = []
    result_ids: dict[str, list[str]] = {}
    for qid in ids:
        ranking = [item.doc_id for item in fused[qid]]
        result_ids[qid] = ranking
        relevant = dataset.qrels[qid]
        relevant_ids = {doc_id for doc_id, grade in relevant.items() if grade > 0}
        per_query.append(PerQueryMetrics(qid, dataset.queries[qid], len(relevant_ids), ndcg_at_k(ranking, relevant, 10), mean_reciprocal_rank_at_k({qid: ranking}, {qid: relevant}, 10), recall_at_k(ranking, relevant, 10), recall_at_k(ranking, relevant, 100), next((rank for rank, doc_id in enumerate(ranking, 1) if doc_id in relevant_ids), None)))
    report = EvaluationReport(len(ids), *(sum(recall_at_k(result_ids[qid], dataset.qrels[qid], k) for qid in ids) / len(ids) for k in (1, 5, 10, 100)), mean_reciprocal_rank_at_k(result_ids, dataset.qrels, 10), sum(item.ndcg_at_10 for item in per_query) / len(ids), index_seconds, elapsed / len(ids) * 1000)
    return report, per_query


def run(dataset_name: str, model: str, data_dir: Path, results_dir: Path, analysis_dir: Path) -> tuple[Path, Path]:
    development, test = load_development_dataset(dataset_name, data_dir), load_dataset(dataset_name, data_dir)
    assert_disjoint_queries(development, test)
    development_split = "dev (Hugging Face validation)" if dataset_name == "fiqa" else "train"
    print(f"{dataset_name} development split {development_split}: {len(development.queries)} queries | {development.qrel_count} qrels; no test overlap")
    components = [BM25Retriever(), SentenceBertRetriever(model_name=model)]
    index_start = perf_counter()
    for component in components:
        component.index(test.corpus)
    index_seconds = perf_counter() - index_start
    dev_rankings = component_rankings(components, development.queries)
    dev_scores = {weight: evaluate_rankings(development, dev_rankings, weight, index_seconds=0)[0].ndcg_at_10 for weight in GRID}
    selected = select_weight(dev_scores)
    model_slug = model.rsplit("/", 1)[-1].lower()
    analysis_dir.mkdir(parents=True, exist_ok=True)
    tuning_path = analysis_dir / f"tuning_{dataset_name}_{model_slug}.json"
    tuning_path.write_text(json.dumps({"dataset": dataset_name, "model": model, "development_split": development_split, "development_query_count": len(development.queries), "development_qrel_count": development.qrel_count, "k_rrf": K_RRF, "depth": DEPTH, "grid": list(GRID), "dev_ndcg_at_10": {str(weight): score for weight, score in dev_scores.items()}, "selected_w_bm25": selected, "selection_rule": "highest mean nDCG@10; ties: closest to 0.5, then smaller weight"}, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote development tuning artifact before test evaluation: {tuning_path}")
    test_rankings = component_rankings(components, test.queries)
    report, per_query = evaluate_rankings(test, test_rankings, selected, index_seconds)
    equal_report, _ = evaluate_rankings(test, test_rankings, .5, index_seconds)
    existing = results_dir / result_filename(dataset_name, "hybrid", model)
    if existing.exists():
        old = json.loads(existing.read_text(encoding="utf-8"))
        for metric in ("recall_at_1", "recall_at_5", "recall_at_10", "recall_at_100", "mrr_at_10", "ndcg_at_10"):
            if abs(getattr(equal_report, metric) - old[metric]) > 1e-12:
                raise AssertionError(f"w_bm25=0.5 sanity check differs from {existing} on {metric}")
        print("w_bm25=0.5 sanity check matches existing hybrid metrics.")
    else:
        print(f"w_bm25=0.5 sanity check skipped: existing hybrid report not found at {existing}")
    generated = datetime.now(timezone.utc).isoformat()
    fusion = {"method": "weighted-rrf", "k_rrf": K_RRF, "depth": DEPTH, "components": ["bm25", "sbert"], "w_bm25": selected, "grid": list(GRID), "selection_rule": "highest mean nDCG@10; ties: closest to 0.5, then smaller weight", "development_split": development_split, "development_query_count": len(development.queries)}
    payload = {"method": "hybrid-tuned", "dataset": dataset_name, "model": model, "generated_at": generated, **report.to_dict(), "fusion": fusion}
    results_dir.mkdir(parents=True, exist_ok=True)
    report_path = results_dir / result_filename(dataset_name, "hybrid-tuned", model)
    report_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    per_query_path = results_dir / per_query_filename(dataset_name, "hybrid-tuned", model)
    per_query_path.write_text(json.dumps({"method": "hybrid-tuned", "dataset": dataset_name, "model": model, "generated_at": generated, "query_count": report.query_count, "fusion": fusion, "queries": [row.to_dict() for row in per_query]}, indent=2) + "\n", encoding="utf-8")
    return report_path, per_query_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, choices=dataset_names())
    parser.add_argument("--model", required=True)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    parser.add_argument("--analysis-dir", type=Path, default=Path("docs/analysis"))
    args = parser.parse_args()
    report, per_query = run(args.dataset, args.model, args.data_dir, args.results_dir, args.analysis_dir)
    print(f"Saved JSON report: {report}\nSaved per-query JSON: {per_query}")


if __name__ == "__main__":
    main()
