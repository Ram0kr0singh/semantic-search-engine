"""Search the locally built arXiv abstract corpus from a terminal."""

from __future__ import annotations

import argparse
from pathlib import Path
from time import perf_counter

from backend.app.data.arxiv import load_arxiv_corpus
from backend.app.retrieval.sbert import SentenceBertRetriever
from backend.app.retrieval.tfidf import TfidfRetriever
from scripts.build_corpus import default_corpus_path


def print_results(query: str, results: list[object], records: dict[str, dict[str, object]]) -> None:
    """Print a compact, readable result list."""
    print(f"\nQuery: {query}\n")
    for rank, result in enumerate(results, start=1):
        record = records[result.doc_id]
        snippet = " ".join(str(record["text"]).split())[:280]
        if len(str(record["text"])) > len(snippet):
            snippet += "..."
        print(f"{rank}. [{result.score:.4f}] {result.doc_id} — {record.get('title', '')}")
        print(f"   {snippet}\n")


def main() -> None:
    """Load or build an index, then execute one query or an interactive session."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--method", choices=("tfidf", "sbert"), default="sbert")
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2")
    parser.add_argument("--corpus", type=Path, default=default_corpus_path())
    parser.add_argument("--index-dir", type=Path, help="Saved index directory (defaults to a model-specific folder for this corpus).")
    parser.add_argument("--rebuild", action="store_true", help="Ignore any saved SBERT index.")
    parser.add_argument("--query", help="Run one query without entering the prompt.")
    args = parser.parse_args()
    if not args.corpus.is_file():
        parser.error(f"Corpus not found: {args.corpus}. Run `python -m scripts.build_corpus` first.")
    if args.index_dir is None:
        model_folder = "mpnet" if "mpnet" in args.model.lower() else "minilm"
        args.index_dir = Path("data") / f"index_{model_folder}_{args.corpus.stem}"

    corpus, records = load_arxiv_corpus(args.corpus)
    start = perf_counter()
    if args.method == "sbert":
        retriever = SentenceBertRetriever(model_name=args.model)
        if not args.rebuild and (args.index_dir / "metadata.json").is_file():
            retriever.load(args.index_dir, corpus)
            action = "Loaded"
        else:
            retriever.index(corpus)
            retriever.save(args.index_dir)
            action = "Built and saved"
    else:
        retriever = TfidfRetriever()
        retriever.index(corpus)
        action = "Built"
    print(f"{action} {args.method} index for {len(corpus):,} papers in {perf_counter() - start:.2f}s.")

    def run(query: str) -> None:
        query_start = perf_counter()
        results = retriever.search(query, k=5)
        print_results(query, results, records)
        print(f"Search time: {(perf_counter() - query_start) * 1000:.1f} ms")

    if args.query:
        run(args.query)
        return
    while True:
        try:
            query = input("\nSearch arXiv (blank or 'quit' exits): ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not query or query.lower() in {"quit", "exit"}:
            return
        run(query)


if __name__ == "__main__":
    main()
