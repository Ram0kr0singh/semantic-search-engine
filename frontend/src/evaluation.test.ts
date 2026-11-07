import { describe, expect, it } from 'vitest';
import type { EvaluationRun } from './api';
import { isBestMetric } from './evaluation';

const runs: EvaluationRun[] = [
  { method: 'tfidf', model: null, dataset: 'fiqa', generated_at: 'now', query_count: 1, recall_at_1: .1, recall_at_5: .1, recall_at_10: .1, recall_at_100: .5, mrr_at_10: .1, ndcg_at_10: .2, index_build_seconds: 1, average_query_latency_ms: 1 },
  { method: 'sbert', model: 'mini', dataset: 'fiqa', generated_at: 'now', query_count: 1, recall_at_1: .2, recall_at_5: .2, recall_at_10: .2, recall_at_100: .5, mrr_at_10: .2, ndcg_at_10: .4, index_build_seconds: 2, average_query_latency_ms: 2 },
];

describe('evaluation metric highlighting', () => {
  it('marks the highest value and includes ties', () => {
    expect(isBestMetric(runs[1], runs, 'ndcg_at_10')).toBe(true);
    expect(isBestMetric(runs[0], runs, 'ndcg_at_10')).toBe(false);
    expect(isBestMetric(runs[0], runs, 'recall_at_100')).toBe(true);
    expect(isBestMetric(runs[1], runs, 'recall_at_100')).toBe(true);
  });
});
