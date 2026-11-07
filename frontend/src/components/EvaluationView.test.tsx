import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluationView } from './EvaluationView';

afterEach(() => vi.restoreAllMocks());

describe('EvaluationView', () => {
  it('renders tables and highlights best values from a summary', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ runs: [
      { method: 'tfidf', model: null, dataset: 'scifact', generated_at: 'now', query_count: 300, recall_at_1: .4, recall_at_5: .5, recall_at_10: .6, recall_at_100: .7, mrr_at_10: .4, ndcg_at_10: .5, index_build_seconds: 1, average_query_latency_ms: 2 },
      { method: 'sbert', model: 'MiniLM', dataset: 'fiqa', generated_at: 'now', query_count: 648, recall_at_1: .5, recall_at_5: .6, recall_at_10: .7, recall_at_100: .8, mrr_at_10: .5, ndcg_at_10: .6, index_build_seconds: 2, average_query_latency_ms: 3 },
    ], hardware_note: 'test laptop', generated_at: 'now' })))));
    render(<EvaluationView />);
    expect(await screen.findByRole('heading', { name: 'scifact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'fiqa' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Best value').length).toBeGreaterThan(0);
    expect(screen.getByText(/test laptop/)).toBeInTheDocument();
  });

  it('shows the export command for a missing snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: { code: 'evaluation_snapshot_missing', message: 'Evaluation snapshot is not available.', details: { build_command: 'python -m scripts.export_results' } } }), { status: 404 }))));
    render(<EvaluationView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('python -m scripts.export_results');
  });
});
