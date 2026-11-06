# Semantic Document Search Engine

A university NLP capstone and portfolio project for comparing document retrieval methods. It includes TF-IDF and Sentence-BERT dense retrieval on registered [BEIR](https://github.com/beir-cellar/beir) benchmarks and a FastAPI search API.

## Setup

Requires Python 3.11 or 3.12.

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Sentence-BERT and CPU FAISS are installed through `requirements.txt`; no additional system installation is needed. Embedding uses the already-configured CUDA-enabled PyTorch installation when a GPU is available and otherwise falls back to CPU. FAISS searches on CPU.

## Run the API

Build the arXiv corpus and at least one saved SBERT index as described below, then start the server from the repository root. Do not use `--reload`: it creates another process and reloads the models.

```powershell
.venv\Scripts\python.exe -m uvicorn backend.app.api.main:app --port 8000
```

Swagger UI is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). The API loads the corpus and builds TF-IDF once at startup, then loads only SBERT indexes already present on disk. A missing SBERT index leaves its method unavailable; the server log prints the command to create it.

## Frontend

The React/Vite frontend provides single-method search and side-by-side TF-IDF/Sentence-BERT comparison. It reads `VITE_API_BASE_URL` (default: `http://127.0.0.1:8000`); copy `frontend/.env.example` to `frontend/.env` only when a different API URL is needed.

Run the API from the repository root in one terminal:

```powershell
.venv\Scripts\python.exe -m uvicorn backend.app.api.main:app --port 8000
```

Then run the UI in another:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL (normally `http://127.0.0.1:5173`). Use `npm test` for frontend tests and `npm run build` for a strict TypeScript production build.

Endpoints:

- `GET /health` reports readiness, document count, methods, device, and API version.
- `GET /methods` lists stable method IDs: `tfidf`, `sbert-minilm`, and `sbert-mpnet`.
- `POST /search` accepts `query`, optional `method`, and optional `k` (1–50; default 10). It defaults to MPNet when available.
- `GET /documents/{id}` returns a complete corpus record.

```powershell
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/search -H "Content-Type: application/json" -d '{"query":"making models smaller without losing accuracy","method":"sbert-mpnet","k":5}'
curl http://127.0.0.1:8000/documents/0704.2083
```

Configuration is supplied through environment variables; paths below are relative to the working directory by default.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ARXIV_CORPUS_PATH` | `data/arxiv_cs_30000.jsonl` | JSONL corpus path |
| `ARXIV_MINILM_INDEX_DIR` | `data/arxiv_sbert_index` | MiniLM saved-index directory |
| `ARXIV_MPNET_INDEX_DIR` | `data/index_mpnet` | MPNet saved-index directory |
| `ARXIV_MINILM_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | MiniLM model name |
| `ARXIV_MPNET_MODEL` | `sentence-transformers/all-mpnet-base-v2` | MPNet model name |
| `API_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed browser origins |

## arXiv terminal demo

Build the demo corpus once (the loader streams rather than downloading the 341 MB source metadata file locally):

```powershell
.venv\Scripts\python.exe -m scripts.build_corpus
```

This uses [`yacud1/arxiv-bge-base-818k`](https://huggingface.co/datasets/yacud1/arxiv-bge-base-818k), a public no-auth Hugging Face dataset. Its card lists the arXiv metadata and abstracts as **CC0-1.0** and exposes the `id`, `title`, `abstract`, `categories`, and `update_date` fields used by the builder. The command filters cross-listed or primary papers in `cs.CL`, `cs.AI`, `cs.LG`, `cs.IR`, and `cs.CV`, removes blank abstracts, deduplicates arXiv IDs, cleans whitespace, and deterministically reservoir-samples 30,000 records (use `--size` and `--seed` to change this). It writes `data/arxiv_cs_30000.jsonl`; `data/` is intentionally gitignored.

Run a single semantic query. The first run creates and saves the FAISS index; later runs load it without re-embedding:

```powershell
.venv\Scripts\python.exe -m scripts.search_demo --query "how can neural networks understand human language?"
.venv\Scripts\python.exe -m scripts.search_demo --method tfidf --query "image recognition with transformers"
```

Run without `--query` for an interactive prompt. Use `--rebuild` to recreate the saved SBERT index, `--model` to select another Sentence-BERT model, and `--index-dir` or `--corpus` to change local paths. The index includes its model name, document IDs, document texts, and count; loading with a different `--model` fails clearly instead of returning incompatible embeddings.

Observed build time, index size, corpus size, and cold/warm timings will be recorded here after running the commands in the target environment.

## Run evaluation

From the repository root:

```powershell
.venv\Scripts\python.exe -m scripts.evaluate --dataset scifact --method tfidf
```

Run Sentence-BERT with the default `all-MiniLM-L6-v2` model:

```powershell
.venv\Scripts\python.exe -m scripts.evaluate --dataset fiqa --method sbert
```

Compare all registered retrievers in one table, or use another Sentence-BERT model:

```powershell
.venv\Scripts\python.exe -m scripts.evaluate --dataset scifact --method all
.venv\Scripts\python.exe -m scripts.evaluate --dataset fiqa --method sbert --model sentence-transformers/all-mpnet-base-v2
.venv\Scripts\python.exe -m scripts.evaluate --dataset all --method all
```

`--dataset` defaults to `scifact`; the current registry contains `scifact` and `fiqa`. `--dataset all` evaluates the selected method(s) against each registered dataset. The first run downloads the selected BEIR collection into the gitignored `data/` directory. It prints Recall@1/5/10/100, MRR@10, nDCG@10, index build time, and mean query latency, then writes JSON to gitignored `results/`. SBERT filenames include the model slug, such as `results/fiqa_sbert_all-mpnet-base-v2.json`, so model runs do not overwrite each other.

To add another BEIR-format dataset published on Hugging Face, add one `DatasetDefinition` entry to `DATASET_REGISTRY` in `backend/app/data/beir.py`, naming its corpus/query repository and qrels repository. No new loader code is needed when it follows the same BEIR `corpus`, `queries`, and test-qrels layout.

## Results

Measured with the commands above on the configured RTX 4060 environment. Index build time excludes Sentence-BERT model load/download time.

| Dataset | Method | Model | nDCG@10 | Index build seconds |
| --- | --- | --- | --- | --- |
| SciFact | TF-IDF | — | 0.6418 | 1.6801 |
| SciFact | SBERT | all-MiniLM-L6-v2 | 0.6451 | 8.5948 |
| SciFact | SBERT | all-mpnet-base-v2 | 0.6557 | 69.8689 |
| FiQA | TF-IDF | — | 0.1488 | 11.2276 |
| FiQA | SBERT | all-MiniLM-L6-v2 | 0.3687 | 63.8386 |
| FiQA | SBERT | all-mpnet-base-v2 | 0.4996 | 468.8733 |

## Test

```powershell
.venv\Scripts\python.exe -m pytest
```

To add another retriever, implement `Retriever` in `backend/app/retrieval/` and register it in `scripts/evaluate.py`.
