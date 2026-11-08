"""Export validated local evaluation reports as a committed UI snapshot."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

METRICS = ("recall_at_1", "recall_at_5", "recall_at_10", "recall_at_100", "mrr_at_10", "ndcg_at_10")
TIMINGS = ("index_build_seconds", "average_query_latency_ms")
REQUIRED = ("method", "dataset", "generated_at", "query_count", *METRICS, *TIMINGS)
PER_QUERY_FIELDS = (
    "query_id", "query", "relevant_document_count", "ndcg_at_10", "mrr_at_10",
    "recall_at_10", "recall_at_100", "first_relevant_rank",
)
TUNED_FUSION_FIELDS = ("method", "k_rrf", "depth", "components", "w_bm25", "grid", "selection_rule", "development_split", "development_query_count")
RERANK_FIELDS = ("first_stage", "dense_model", "cross_encoder", "depth", "batch_size")


def valid_tuned_fusion(fusion: object) -> bool:
    """Validate the protocol fields that identify a weighted-RRF run."""
    return (
        isinstance(fusion, dict)
        and all(field in fusion for field in TUNED_FUSION_FIELDS)
        and fusion["method"] == "weighted-rrf"
        and fusion["k_rrf"] == 60
        and fusion["depth"] == 100
        and fusion["components"] == ["bm25", "sbert"]
        and isinstance(fusion["w_bm25"], (int, float)) and not isinstance(fusion["w_bm25"], bool)
        and 0 <= fusion["w_bm25"] <= 1
        and fusion["grid"] == [index / 10 for index in range(11)]
        and isinstance(fusion["selection_rule"], str)
        and isinstance(fusion["development_split"], str)
        and isinstance(fusion["development_query_count"], int)
    )


def valid_reranking(reranking: object) -> bool:
    """Validate the fixed cross-encoder reranking protocol metadata."""
    return isinstance(reranking, dict) and all(field in reranking for field in RERANK_FIELDS) and reranking["first_stage"] in {"bm25", "sbert", "hybrid"} and reranking["cross_encoder"] == "cross-encoder/ms-marco-MiniLM-L-6-v2" and reranking["depth"] == 100 and reranking["batch_size"] == 32 and (reranking["first_stage"] == "bm25" or isinstance(reranking["dense_model"], str))


def validate_run(payload: object, filename: str) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(payload, dict):
        return None, "JSON root is not an object"
    missing = [field for field in REQUIRED if field not in payload]
    if missing:
        return None, f"missing required fields: {', '.join(missing)}"
    if not isinstance(payload["method"], str) or not payload["method"].strip():
        return None, "missing method identity"
    if not isinstance(payload["dataset"], str) or not payload["dataset"].strip() or payload["dataset"].startswith("BEIR "):
        return None, "missing or stale dataset identity"
    # TF-IDF deliberately has a null model; dense and hybrid reports identify their model.
    if payload["method"] in {"sbert", "hybrid", "hybrid-tuned"} and (not isinstance(payload.get("model"), str) or not payload["model"].strip()):
        return None, "stale SBERT report without a model identity"
    if payload["method"] == "hybrid" and payload.get("fusion") != {"method": "rrf", "k_rrf": 60, "depth": 100, "components": ["bm25", "sbert"]}:
        return None, "hybrid report has missing or unsupported fusion settings"
    if payload["method"] == "hybrid-tuned" and not valid_tuned_fusion(payload.get("fusion")):
        return None, "tuned hybrid report has missing fusion settings"
    if payload["method"] == "rerank" and not valid_reranking(payload.get("reranking")):
        return None, "rerank report has missing or unsupported settings"
    for field in ("query_count", *METRICS, "index_build_seconds", "average_query_latency_ms"):
        value = payload[field]
        if field == "average_query_latency_ms" and value is None and payload["method"] == "hybrid-tuned":
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None, f"{field} is not numeric"
        if field in METRICS and not 0 <= value <= 1:
            return None, f"{field} must be in [0, 1]"
        if field in TIMINGS and value < 0:
            return None, f"{field} must be non-negative"
    if payload["query_count"] < 0:
        return None, "query_count must be non-negative"
    return payload, None


def exported_run(run: dict[str, Any]) -> dict[str, Any]:
    """Return a UI-safe snapshot without changing the raw benchmark report."""
    exported = dict(run)
    if exported["method"] == "hybrid-tuned":
        latency = exported["average_query_latency_ms"]
        if isinstance(latency, (int, float)) and not isinstance(latency, bool):
            exported["fusion_only_latency_ms"] = latency
        exported["average_query_latency_ms"] = None
        exported["latency_note"] = "fusion of saved component rankings only; not an end-to-end query time"
    return exported


def validate_per_query_run(payload: object, filename: str) -> tuple[dict[str, Any] | None, str | None]:
    """Validate a saved query-level run before committing it as a snapshot."""
    if not isinstance(payload, dict):
        return None, "JSON root is not an object"
    for field in ("method", "dataset", "generated_at", "query_count", "queries"):
        if field not in payload:
            return None, f"missing required fields: {field}"
    if not isinstance(payload["method"], str) or not payload["method"].strip():
        return None, "missing method identity"
    if not isinstance(payload["dataset"], str) or not payload["dataset"].strip() or payload["dataset"].startswith("BEIR "):
        return None, "missing or stale dataset identity"
    if payload["method"] in {"sbert", "hybrid", "hybrid-tuned"} and (not isinstance(payload.get("model"), str) or not payload["model"].strip()):
        return None, "stale SBERT report without a model identity"
    if payload["method"] == "hybrid" and payload.get("fusion") != {"method": "rrf", "k_rrf": 60, "depth": 100, "components": ["bm25", "sbert"]}:
        return None, "hybrid report has missing or unsupported fusion settings"
    if payload["method"] == "hybrid-tuned" and not valid_tuned_fusion(payload.get("fusion")):
        return None, "tuned hybrid report has missing fusion settings"
    if payload["method"] == "rerank" and not valid_reranking(payload.get("reranking")):
        return None, "rerank report has missing or unsupported settings"
    if isinstance(payload["query_count"], bool) or not isinstance(payload["query_count"], int) or payload["query_count"] < 0:
        return None, "query_count must be a non-negative integer"
    queries = payload["queries"]
    if not isinstance(queries, list) or len(queries) != payload["query_count"]:
        return None, "queries must be a list matching query_count"
    seen_ids: set[str] = set()
    for item in queries:
        if not isinstance(item, dict):
            return None, "query entry is not an object"
        missing = [field for field in PER_QUERY_FIELDS if field not in item]
        if missing:
            return None, f"query entry missing required fields: {', '.join(missing)}"
        if not isinstance(item["query_id"], str) or not item["query_id"] or item["query_id"] in seen_ids:
            return None, "query entry has a missing or duplicate query_id"
        seen_ids.add(item["query_id"])
        if not isinstance(item["query"], str):
            return None, "query entry has non-string query"
        count = item["relevant_document_count"]
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            return None, "relevant_document_count must be a non-negative integer"
        for field in ("ndcg_at_10", "mrr_at_10", "recall_at_10", "recall_at_100"):
            value = item[field]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 1:
                return None, f"{field} must be numeric and in [0, 1]"
        rank = item["first_relevant_rank"]
        if rank is not None and (isinstance(rank, bool) or not isinstance(rank, int) or not 1 <= rank <= 100):
            return None, "first_relevant_rank must be null or an integer in [1, 100]"
    return payload, None


def export_results(results_dir: Path, output_dir: Path, hardware_note: str) -> tuple[list[Path], list[tuple[Path, str]], dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    runs: list[tuple[Path, dict[str, Any]]] = []
    skipped: list[tuple[Path, str]] = []
    for source in sorted(results_dir.glob("*.json")):
        if source.name.endswith("_perquery.json"):
            continue
        try:
            payload = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            skipped.append((source, f"invalid JSON: {exc}")); continue
        run, reason = validate_run(payload, source.name)
        if reason:
            skipped.append((source, reason)); continue
        runs.append((source, run))
    runs.sort(key=lambda item: (str(item[1]["dataset"]), str(item[1]["method"]), str(item[1].get("model") or "")))
    destinations: list[Path] = []
    exported_runs: list[dict[str, Any]] = []
    for source, run in runs:
        destination = output_dir / source.name
        snapshot_run = exported_run(run)
        destination.write_text(json.dumps(snapshot_run, indent=2) + "\n", encoding="utf-8")
        destinations.append(destination)
        exported_runs.append(snapshot_run)
    summary = {"runs": exported_runs, "hardware_note": hardware_note, "generated_at": max((str(run["generated_at"]) for _, run in runs), default="")}
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return destinations, skipped, summary


def export_per_query_results(results_dir: Path, output_dir: Path) -> tuple[list[Path], list[tuple[Path, str]]]:
    """Copy only validated current per-query files into the committed snapshot."""
    destination_dir = output_dir / "per_query"
    destination_dir.mkdir(parents=True, exist_ok=True)
    exported: list[Path] = []
    skipped: list[tuple[Path, str]] = []
    for source in sorted(results_dir.glob("*_perquery.json")):
        try:
            payload = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            skipped.append((source, f"invalid JSON: {exc}")); continue
        _, reason = validate_per_query_run(payload, source.name)
        if reason:
            skipped.append((source, reason)); continue
        destination = destination_dir / source.name
        destination.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
        exported.append(destination)
    return exported, skipped


def markdown(summary: dict[str, Any]) -> str:
    lines = ["| Dataset | Method / model | nDCG@10 | MRR@10 | Recall@1 | Recall@10 | Recall@100 | Index build (s) | Query latency (ms) |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for run in summary["runs"]:
        label = {"tfidf": "TF-IDF", "bm25": "BM25"}.get(run["method"], run.get("model") or run["method"])
        if run["method"] == "rerank":
            label = f"Rerank ({run['reranking']['first_stage']})"
        latency = "—" if run["average_query_latency_ms"] is None else f"{run['average_query_latency_ms']:.2f}"
        lines.append(f"| {run['dataset']} | {label} | {run['ndcg_at_10']:.4f} | {run['mrr_at_10']:.4f} | {run['recall_at_1']:.4f} | {run['recall_at_10']:.4f} | {run['recall_at_100']:.4f} | {run['index_build_seconds']:.2f} | {latency} |")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    parser.add_argument("--output-dir", type=Path, default=Path("docs/results"))
    parser.add_argument("--hardware-note", default="")
    parser.add_argument("--markdown", action="store_true", help="Print a Markdown metrics table after exporting.")
    args = parser.parse_args()
    exported, skipped, summary = export_results(args.results_dir, args.output_dir, args.hardware_note)
    per_query_exported, per_query_skipped = export_per_query_results(args.results_dir, args.output_dir)
    for path in exported: print(f"Exported: {path}")
    for path, reason in skipped: print(f"Skipped: {path} ({reason})")
    for path in per_query_exported: print(f"Exported per-query: {path}")
    for path, reason in per_query_skipped: print(f"Skipped per-query: {path} ({reason})")
    print(f"Wrote: {args.output_dir / 'summary.json'}")
    if args.markdown: print(markdown(summary))


if __name__ == "__main__":
    main()
