# Semantic Document Search Engine

A university NLP capstone and portfolio project for comparing document retrieval methods. It includes TF-IDF and Sentence-BERT dense retrieval on the [BEIR SciFact](https://github.com/beir-cellar/beir) benchmark; an API, database, and UI are deliberately deferred.

## Setup

Requires Python 3.11 or 3.12.

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Sentence-BERT and CPU FAISS are installed through `requirements.txt`; no additional system installation is needed. Embedding uses the already-configured CUDA-enabled PyTorch installation when a GPU is available and otherwise falls back to CPU. FAISS searches on CPU.

## Run evaluation

From the repository root:

```powershell
.venv\Scripts\python.exe -m scripts.evaluate --method tfidf
```

Run Sentence-BERT with the default `all-MiniLM-L6-v2` model:

```powershell
.venv\Scripts\python.exe -m scripts.evaluate --method sbert
```

Compare all registered retrievers in one table, or use another Sentence-BERT model:

```powershell
.venv\Scripts\python.exe -m scripts.evaluate --method all
.venv\Scripts\python.exe -m scripts.evaluate --method sbert --model sentence-transformers/all-mpnet-base-v2
```

The first run downloads BEIR SciFact into the gitignored `data/` directory. It prints Recall@1/5/10/100, MRR@10, nDCG@10, index build time, and mean query latency, then writes JSON to gitignored `results/`.

## Test

```powershell
.venv\Scripts\python.exe -m pytest
```

To add another retriever, implement `Retriever` in `backend/app/retrieval/` and register it in `scripts/evaluate.py`.
