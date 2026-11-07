"""Export validated local evaluation reports as a committed UI snapshot."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

METRICS = ("recall_at_1", "recall_at_5", "recall_at_10", "recall_at_100", "mrr_at_10", "ndcg_at_10")
TIMINGS = ("index_build_seconds", "average_query_latency_ms")
REQUIRED = ("method", "dataset", "generated_at", "query_count", *METRICS, *TIMINGS)


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
    # TF-IDF deliberately has a null model; every dense report needs its concrete model name.
    if payload["method"] == "sbert" and (not isinstance(payload.get("model"), str) or not payload["model"].strip()):
        return None, "stale SBERT report without a model identity"
    for field in ("query_count", *METRICS, *TIMINGS):
        value = payload[field]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None, f"{field} is not numeric"
        if field in METRICS and not 0 <= value <= 1:
            return None, f"{field} must be in [0, 1]"
        if field in TIMINGS and value < 0:
            return None, f"{field} must be non-negative"
    if payload["query_count"] < 0:
        return None, "query_count must be non-negative"
    return payload, None


def export_results(results_dir: Path, output_dir: Path, hardware_note: str) -> tuple[list[Path], list[tuple[Path, str]], dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    runs: list[tuple[Path, dict[str, Any]]] = []
    skipped: list[tuple[Path, str]] = []
    for source in sorted(results_dir.glob("*.json")):
        try:
            payload = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            skipped.append((source, f"invalid JSON: {exc}")); continue
        run, reason = validate_run(payload, source.name)
        if reason:
            skipped.append((source, reason)); continue
        runs.append((source, run))
    runs.sort(key=lambda item: (str(item[1]["dataset"]), str(item[1]["method"]), str(item[1].get("model") or "")))
    exported = []
    for source, _ in runs:
        destination = output_dir / source.name
        shutil.copyfile(source, destination)
        exported.append(destination)
    summary = {"runs": [run for _, run in runs], "hardware_note": hardware_note, "generated_at": max((str(run["generated_at"]) for _, run in runs), default="")}
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return exported, skipped, summary


def markdown(summary: dict[str, Any]) -> str:
    lines = ["| Dataset | Method / model | nDCG@10 | MRR@10 | Recall@1 | Recall@10 | Recall@100 | Index build (s) | Query latency (ms) |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for run in summary["runs"]:
        label = "TF-IDF" if run["method"] == "tfidf" else str(run.get("model", run["method"]))
        lines.append(f"| {run['dataset']} | {label} | {run['ndcg_at_10']:.4f} | {run['mrr_at_10']:.4f} | {run['recall_at_1']:.4f} | {run['recall_at_10']:.4f} | {run['recall_at_100']:.4f} | {run['index_build_seconds']:.2f} | {run['average_query_latency_ms']:.2f} |")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    parser.add_argument("--output-dir", type=Path, default=Path("docs/results"))
    parser.add_argument("--hardware-note", default="")
    parser.add_argument("--markdown", action="store_true", help="Print a Markdown metrics table after exporting.")
    args = parser.parse_args()
    exported, skipped, summary = export_results(args.results_dir, args.output_dir, args.hardware_note)
    for path in exported: print(f"Exported: {path}")
    for path, reason in skipped: print(f"Skipped: {path} ({reason})")
    print(f"Wrote: {args.output_dir / 'summary.json'}")
    if args.markdown: print(markdown(summary))


if __name__ == "__main__":
    main()
