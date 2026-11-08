import type { EvaluationRun } from './api';

export type MetricDirection = 'higher' | 'lower';

function modelShortName(model: string | null): string | null {
  const normalized = model?.toLowerCase() ?? '';
  if (normalized.includes('minilm')) return 'MiniLM';
  if (normalized.includes('mpnet')) return 'MPNet';
  return null;
}

export function evaluationLabel(run: Pick<EvaluationRun, 'method' | 'model' | 'reranking'>): string {
  if (run.method === 'tfidf') return 'TF-IDF';
  if (run.method === 'bm25') return 'BM25';

  const model = modelShortName(run.model);
  if (run.method === 'sbert' && model) return model;
  if (run.method === 'hybrid' && model) return `Hybrid (${model})`;
  if (run.method === 'hybrid-tuned' && model) return `Hybrid-tuned (${model})`;
  if (run.method === 'rerank') {
    if (run.reranking?.first_stage === 'bm25') return 'Rerank (BM25)';
    if (run.reranking?.first_stage === 'sbert' && model === 'MPNet') return 'Rerank (MPNet)';
    if (run.reranking?.first_stage === 'hybrid' && model === 'MPNet') return 'Rerank (Hybrid MPNet)';
  }
  return run.model ?? run.method;
}

export function selectedBm25Weight(run: Pick<EvaluationRun, 'method' | 'fusion'>): number | null {
  const weight = run.method === 'hybrid-tuned' ? run.fusion?.w_bm25 : undefined;
  return typeof weight === 'number' && Number.isFinite(weight) ? weight : null;
}

export function evaluationMethodOrder(run: Pick<EvaluationRun, 'method' | 'model' | 'reranking'>): number {
  if (run.method === 'tfidf') return 0;
  if (run.method === 'bm25') return 1;

  const model = modelShortName(run.model);
  if (run.method === 'sbert' && model === 'MiniLM') return 2;
  if (run.method === 'sbert' && model === 'MPNet') return 3;
  if (run.method === 'hybrid' && model === 'MiniLM') return 4;
  if (run.method === 'hybrid' && model === 'MPNet') return 5;
  if (run.method === 'hybrid-tuned' && model === 'MiniLM') return 6;
  if (run.method === 'hybrid-tuned' && model === 'MPNet') return 7;
  if (run.method === 'rerank' && run.reranking?.first_stage === 'bm25') return 8;
  if (run.method === 'rerank' && run.reranking?.first_stage === 'sbert' && model === 'MPNet') return 9;
  if (run.method === 'rerank' && run.reranking?.first_stage === 'hybrid' && model === 'MPNet') return 10;
  return 11;
}

export function isBestMetric(
  run: Partial<EvaluationRun>,
  runs: Array<Partial<EvaluationRun>>,
  key: keyof EvaluationRun,
  direction: MetricDirection,
): boolean {
  const value = run[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;

  const values = runs
    .map((item) => item[key])
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (values.length === 0) return false;

  const best = direction === 'higher' ? Math.max(...values) : Math.min(...values);
  return value === best;
}
