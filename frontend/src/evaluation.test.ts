import { describe, expect, it } from 'vitest';
import type { EvaluationRun } from './api';
import { evaluationLabel, evaluationMethodOrder, isBestMetric, selectedBm25Weight } from './evaluation';

const runs: EvaluationRun[] = [
  { method: 'tfidf', model: null, dataset: 'fiqa', generated_at: 'now', query_count: 1, recall_at_1: .1, recall_at_5: .1, recall_at_10: .1, recall_at_100: .5, mrr_at_10: .1, ndcg_at_10: .2, index_build_seconds: 1, average_query_latency_ms: 1 },
  { method: 'sbert', model: 'mini', dataset: 'fiqa', generated_at: 'now', query_count: 1, recall_at_1: .2, recall_at_5: .2, recall_at_10: .2, recall_at_100: .5, mrr_at_10: .2, ndcg_at_10: .4, index_build_seconds: 2, average_query_latency_ms: 2 },
];

describe('evaluation metric highlighting', () => {
  it('labels tuned hybrid runs and places them after equal-weight hybrids', () => {
    const miniLm = { method: 'hybrid-tuned', model: 'sentence-transformers/all-MiniLM-L6-v2' };
    const mpnet = { method: 'hybrid-tuned', model: 'sentence-transformers/all-mpnet-base-v2' };
    expect(evaluationLabel(miniLm)).toBe('Hybrid-tuned (MiniLM)');
    expect(evaluationLabel(mpnet)).toBe('Hybrid-tuned (MPNet)');
    expect(evaluationMethodOrder({ method: 'hybrid', model: 'sentence-transformers/all-mpnet-base-v2' })).toBeLessThan(evaluationMethodOrder(mpnet));
    expect(evaluationMethodOrder({ method: 'hybrid', model: 'sentence-transformers/all-MiniLM-L6-v2' })).toBeLessThan(evaluationMethodOrder(miniLm));
    expect(selectedBm25Weight({ method: 'hybrid-tuned', fusion: { w_bm25: .7 } })).toBe(.7);
    expect(selectedBm25Weight({ method: 'hybrid-tuned', fusion: { w_bm25: 0 } })).toBe(0);
    expect(selectedBm25Weight({ method: 'hybrid', fusion: { w_bm25: .7 } })).toBeNull();
  });

  it('marks the highest value for higher-is-better metrics', () => {
    expect(isBestMetric(runs[1], runs, 'ndcg_at_10', 'higher')).toBe(true);
    expect(isBestMetric(runs[0], runs, 'ndcg_at_10', 'higher')).toBe(false);
  });

  it('marks the lowest value for lower-is-better metrics', () => {
    expect(isBestMetric(runs[0], runs, 'index_build_seconds', 'lower')).toBe(true);
    expect(isBestMetric(runs[1], runs, 'index_build_seconds', 'lower')).toBe(false);
  });

  it('marks all ties for higher-is-better metrics', () => {
    expect(isBestMetric(runs[0], runs, 'recall_at_100', 'higher')).toBe(true);
    expect(isBestMetric(runs[1], runs, 'recall_at_100', 'higher')).toBe(true);
  });

  it('marks all ties for lower-is-better metrics', () => {
    const tiedRuns = runs.map((run) => ({ ...run, average_query_latency_ms: 1 }));
    expect(isBestMetric(tiedRuns[0], tiedRuns, 'average_query_latency_ms', 'lower')).toBe(true);
    expect(isBestMetric(tiedRuns[1], tiedRuns, 'average_query_latency_ms', 'lower')).toBe(true);
  });

  it('marks a single numeric row as best', () => {
    expect(isBestMetric(runs[0], [runs[0]], 'ndcg_at_10', 'higher')).toBe(true);
  });

  it('ignores missing metric values', () => {
    const missingValue = { ...runs[0], average_query_latency_ms: undefined };
    expect(isBestMetric(missingValue, [missingValue, runs[1]], 'average_query_latency_ms', 'lower')).toBe(false);
    expect(isBestMetric(runs[1], [missingValue, runs[1]], 'average_query_latency_ms', 'lower')).toBe(true);
  });
});
