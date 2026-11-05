# Semantic Document Search Engine

A university NLP capstone and portfolio project for comparing document retrieval methods. This first milestone provides a reproducible TF-IDF baseline on the [BEIR SciFact](https://github.com/beir-cellar/beir) benchmark; semantic embeddings, FAISS, an API, database, and UI are deliberately deferred.

## Setup

Requires Python 3.11 or 3.12.

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Run the TF-IDF baseline

From the repository root:

```powershell
.venv\Scripts\python.exe -m scripts.evaluate --method tfidf
```

The first run downloads BEIR SciFact into the gitignored `data/` directory. It prints Recall@1/5/10/100, MRR@10, nDCG@10, index build time, and mean query latency, then writes JSON to gitignored `results/`.

## Test

```powershell
.venv\Scripts\python.exe -m pytest
```

To add another retriever, implement `Retriever` in `backend/app/retrieval/` and register it in `scripts/evaluate.py`.
