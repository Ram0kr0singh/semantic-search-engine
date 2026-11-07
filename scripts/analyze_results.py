"""Create paired statistical and error analyses from exported per-query runs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Sequence

import numpy as np


PAIRS = (("BM25", "TF-IDF"), ("MiniLM", "BM25"), ("MPNet", "BM25"), ("MPNet", "MiniLM"))
METRICS = ("ndcg_at_10", "recall_at_100")


def method_label(payload: dict[str, Any]) -> str:
    """Map saved run metadata to the stable labels used in reports."""
    if payload["method"] in {"bm25", "tfidf"}:
        return {"bm25": "BM25", "tfidf": "TF-IDF"}[payload["method"]]
    model = str(payload.get("model", "")).lower()
    if "minilm" in model:
        return "MiniLM"
    if "mpnet" in model:
        return "MPNet"
    raise ValueError(f"Unsupported SBERT model in per-query file: {payload.get('model')}")


def paired_bootstrap(differences: Sequence[float], rng: np.random.Generator, resamples: int = 10_000) -> dict[str, float]:
    """Return percentile CI and an add-one centered-bootstrap two-sided p-value."""
    values = np.asarray(differences, dtype=float)
    if not len(values):
        raise ValueError("Paired bootstrap requires at least one query.")
    observed = float(values.mean())
    indices = rng.integers(0, len(values), size=(resamples, len(values)))
    bootstrap_means = values[indices].mean(axis=1)
    ci_low, ci_high = np.percentile(bootstrap_means, [2.5, 97.5])
    # Under H0, center paired differences at zero, then ask how often a sampled
    # mean is at least as extreme as the observed mean.
    null_means = (values - observed)[indices].mean(axis=1)
    count_extreme = int(np.count_nonzero(np.abs(null_means) >= abs(observed)))
    p_value = (count_extreme + 1) / (resamples + 1)
    return {"mean_difference": observed, "ci_low": float(ci_low), "ci_high": float(ci_high), "p_value": p_value}


def holm_adjust(p_values: Sequence[float]) -> list[float]:
    """Apply Holm--Bonferroni adjustment while preserving input order."""
    order = sorted(range(len(p_values)), key=lambda index: p_values[index])
    adjusted = [0.0] * len(p_values)
    running = 0.0
    count = len(p_values)
    for rank, index in enumerate(order):
        running = max(running, (count - rank) * p_values[index])
        adjusted[index] = min(1.0, running)
    return adjusted


def win_loss_tie(differences: Sequence[float]) -> dict[str, int]:
    """Count query-level wins, losses, and exact ties for method A minus B."""
    return {"wins": sum(value > 0 for value in differences), "losses": sum(value < 0 for value in differences), "ties": sum(value == 0 for value in differences)}


def bucket_rows(rows: Sequence[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group rows by word-count tertile and supported relevant-document buckets."""
    ordered = sorted(rows, key=lambda row: (len(row["query"].split()), row["query_id"]))
    length = {"short": [], "medium": [], "long": []}
    for index, row in enumerate(ordered):
        length[("short", "medium", "long")[index * 3 // len(ordered)]].append(row)
    relevance = {"1": [], "2-3": [], "4+": []}
    for row in rows:
        count = row["relevant_document_count"]
        relevance["1" if count == 1 else "2-3" if count <= 3 else "4+"].append(row)
    return {"query_length_tertiles": length, "relevant_documents": relevance}


def breakdown(rows_by_method: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    """Compute nDCG@10 bucket means, omitting buckets below 20 queries."""
    reference = next(iter(rows_by_method.values()))
    buckets = bucket_rows(list(reference.values()))
    result: dict[str, Any] = {"query_length_tertiles": {}, "relevant_documents": {}, "omitted_relevant_document_buckets": {}}
    for dimension, groups in buckets.items():
        for name, rows in groups.items():
            if len(rows) < 20:
                if dimension == "relevant_documents":
                    result["omitted_relevant_document_buckets"][name] = len(rows)
                continue
            ids = [row["query_id"] for row in rows]
            bucket: dict[str, Any] = {
                "query_count": len(ids),
                "mean_ndcg_at_10": {method: float(np.mean([method_rows[qid]["ndcg_at_10"] for qid in ids])) for method, method_rows in rows_by_method.items()},
            }
            if dimension == "query_length_tertiles":
                word_counts = [len(row["query"].split()) for row in rows]
                bucket["word_count_range"] = [min(word_counts), max(word_counts)]
            result[dimension][name] = bucket
    return result


def load_runs(per_query_dir: Path) -> dict[str, dict[str, dict[str, dict[str, Any]]]]:
    """Load all valid-looking exported query files by dataset and method label."""
    runs: dict[str, dict[str, dict[str, dict[str, Any]]]] = {}
    for path in sorted(per_query_dir.glob("*_perquery.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        label = method_label(payload)
        rows = payload.get("queries")
        if not isinstance(rows, list):
            raise ValueError(f"{path} has no queries list; re-export current per-query results.")
        runs.setdefault(payload["dataset"], {})[label] = {row["query_id"]: row for row in rows}
    return runs


def analysis(runs: dict[str, dict[str, dict[str, dict[str, Any]]]]) -> dict[str, Any]:
    """Build all requested comparisons, errors, and query-property breakdowns."""
    output: dict[str, Any] = {"method": {"bootstrap_resamples": 10_000, "seed": 20261107, "confidence_interval": "2.5th and 97.5th percentiles of paired bootstrap means", "p_value": "two-sided centered paired bootstrap with add-one correction: resample differences centered at their observed mean; p = (count_extreme + 1) / (resamples + 1), where count_extreme is the number of null bootstrap means with absolute value at least the observed absolute mean", "holm": "Holm-Bonferroni adjustment across the eight dataset-pair comparisons separately for each metric"}, "datasets": {}}
    pending: dict[str, list[dict[str, Any]]] = {metric: [] for metric in METRICS}
    rng = np.random.default_rng(20261107)
    for dataset, methods in sorted(runs.items()):
        required = {method for pair in PAIRS for method in pair}
        missing = required - methods.keys()
        if missing:
            raise ValueError(f"{dataset} is missing per-query runs for: {', '.join(sorted(missing))}")
        ids = set.intersection(*(set(methods[method]) for method in required))
        if not ids:
            raise ValueError(f"{dataset} has no query IDs shared by all methods.")
        dataset_output: dict[str, Any] = {"query_count": len(ids), "comparisons": {}, "error_analysis": {}, "breakdowns": breakdown({method: {qid: row for qid, row in rows.items() if qid in ids} for method, rows in methods.items()})}
        for metric in METRICS:
            entries = []
            for left, right in PAIRS:
                differences = [methods[left][qid][metric] - methods[right][qid][metric] for qid in sorted(ids)]
                entry = {"method_a": left, "method_b": right, "metric": metric, **paired_bootstrap(differences, rng), **win_loss_tie(differences)}
                entries.append(entry); pending[metric].append(entry)
            dataset_output["comparisons"][metric] = entries
        differences = {qid: methods["BM25"][qid]["ndcg_at_10"] - methods["MPNet"][qid]["ndcg_at_10"] for qid in ids}
        def error_entry(qid: str, margin: float) -> dict[str, Any]:
            bm25, mpnet = methods["BM25"][qid], methods["MPNet"][qid]
            return {"query_id": qid, "query": bm25["query"], "relevant_document_count": bm25["relevant_document_count"], "ndcg_margin": margin, "bm25_first_relevant_rank": bm25["first_relevant_rank"], "mpnet_first_relevant_rank": mpnet["first_relevant_rank"]}
        bm25_wins = sum(margin > 0 for margin in differences.values())
        mpnet_wins = sum(margin < 0 for margin in differences.values())
        error_analysis: dict[str, Any] = {}
        for direction, margins in (
            ("bm25_over_mpnet", {qid: margin for qid, margin in differences.items() if margin > 0}),
            ("mpnet_over_bm25", {qid: -margin for qid, margin in differences.items() if margin < 0}),
        ):
            ranked = sorted(margins.items(), key=lambda item: (-item[1], item[0]))
            max_margin = ranked[0][1] if ranked else None
            error_analysis[direction] = {
                "max_margin": max_margin,
                "queries_at_max_margin": sum(margin == max_margin for margin in margins.values()),
                "bm25_wins": bm25_wins,
                "mpnet_wins": mpnet_wins,
                "examples": [error_entry(qid, margin) for qid, margin in ranked[:10]],
            }
        dataset_output["error_analysis"] = error_analysis
        output["datasets"][dataset] = dataset_output
    for metric, entries in pending.items():
        adjusted = holm_adjust([entry["p_value"] for entry in entries])
        for entry, p_value in zip(entries, adjusted):
            entry["holm_adjusted_p_value"] = p_value
    return output


def markdown(report: dict[str, Any]) -> str:
    lines = ["# Per-query statistical analysis", "", "All values are calculated from the committed per-query snapshots. P-values use a " + report["method"]["p_value"] + ".", ""]
    def format_p_value(value: float) -> str:
        return "< 0.0001" if value < 0.0001 else f"{value:.6f}"
    def format_rank(value: int | None) -> str:
        return str(value) if value is not None else "not in top 100"
    for dataset, data in report["datasets"].items():
        lines += [f"## {dataset}", "", "### Paired comparisons", ""]
        for metric, entries in data["comparisons"].items():
            lines += [f"#### {metric}", "", "| Comparison (A − B) | Mean difference | 95% CI | p-value | Holm p-value | A wins | B wins | Ties |", "| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |"]
            for item in entries:
                lines.append(f"| {item['method_a']} − {item['method_b']} | {item['mean_difference']:.6f} | [{item['ci_low']:.6f}, {item['ci_high']:.6f}] | {format_p_value(item['p_value'])} | {format_p_value(item['holm_adjusted_p_value'])} | {item['wins']} | {item['losses']} | {item['ties']} |")
            lines.append("")
        lines += ["### Error analysis: BM25 vs MPNet", "", "The examples are illustrative, not a random sample. For each direction, the 10 examples with the largest nDCG@10 margins are selected; ties are broken by ascending query ID.", "", "| Direction | Largest margin | Queries at largest margin | BM25 total wins | MPNet total wins |", "| --- | ---: | ---: | ---: | ---: |"]
        for direction in ("bm25_over_mpnet", "mpnet_over_bm25"):
            summary = data["error_analysis"][direction]
            margin = "n/a" if summary["max_margin"] is None else f"{summary['max_margin']:.6f}"
            lines.append(f"| {direction} | {margin} | {summary['queries_at_max_margin']} | {summary['bm25_wins']} | {summary['mpnet_wins']} |")
        lines += ["", "| Direction | Query ID | Query | Relevant docs | nDCG@10 margin | BM25 first relevant rank | MPNet first relevant rank |", "| --- | --- | --- | ---: | ---: | ---: | ---: |"]
        for direction in ("bm25_over_mpnet", "mpnet_over_bm25"):
            for item in data["error_analysis"][direction]["examples"]:
                lines.append(f"| {direction} | {item['query_id']} | {item['query'].replace('|', '\\|')} | {item['relevant_document_count']} | {item['ndcg_margin']:.6f} | {format_rank(item['bm25_first_relevant_rank'])} | {format_rank(item['mpnet_first_relevant_rank'])} |")
        lines += ["", "### nDCG@10 breakdowns", ""]
        for dimension, groups in data["breakdowns"].items():
            if dimension == "omitted_relevant_document_buckets":
                continue
            if groups:
                methods = ("TF-IDF", "BM25", "MiniLM", "MPNet")
                header = ["Bucket", "Queries", *methods]
                separator = ["---", *(["---:"] * (len(header) - 1))]
                lines += [
                    f"#### {dimension}",
                    "",
                    "| " + " | ".join(header) + " |",
                    "| " + " | ".join(separator) + " |",
                ]
            else:
                lines += [f"#### {dimension}", "", "No bucket met the 20-query minimum.", ""]
            for bucket, item in groups.items():
                label = bucket
                if dimension == "query_length_tertiles":
                    lower, upper = item["word_count_range"]
                    label += f" ({lower}–{upper} words)"
                values = [f"{item['mean_ndcg_at_10'][method]:.6f}" for method in methods]
                lines.append("| " + " | ".join([label, str(item["query_count"]), *values]) + " |")
            lines.append("")
        omitted = data["breakdowns"]["omitted_relevant_document_buckets"]
        omitted_summary = ", ".join(f"{name} ({count} queries)" for name, count in sorted(omitted.items())) or "none"
        lines.append(f"Differences whose Holm-adjusted p-value is not below 0.05 are not statistically distinguishable at this bootstrap resolution. Relevant-document buckets with fewer than 20 queries are omitted: {omitted_summary}.")
        if dataset == "scifact" and len(data["breakdowns"]["relevant_documents"]) == 1:
            lines.append("For SciFact, this leaves a single relevant-document bucket.")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-query-dir", type=Path, default=Path("docs/results/per_query"))
    parser.add_argument("--output-dir", type=Path, default=Path("docs/analysis"))
    args = parser.parse_args()
    report = analysis(load_runs(args.per_query_dir))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "analysis.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / "analysis.md").write_text(markdown(report), encoding="utf-8")
    print(f"Wrote: {args.output_dir / 'analysis.json'}")
    print(f"Wrote: {args.output_dir / 'analysis.md'}")


if __name__ == "__main__":
    main()
