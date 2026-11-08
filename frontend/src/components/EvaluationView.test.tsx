import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { EvaluationRun } from '../api';
import { EvaluationView } from './EvaluationView';

afterEach(() => vi.restoreAllMocks());

function run(changes: Partial<EvaluationRun>): EvaluationRun {
  return {
    method: 'tfidf',
    model: null,
    dataset: 'scifact',
    generated_at: 'now',
    query_count: 300,
    recall_at_1: .4,
    recall_at_5: .5,
    recall_at_10: .6,
    recall_at_100: .7,
    mrr_at_10: .4,
    ndcg_at_10: .5,
    index_build_seconds: 10.96,
    average_query_latency_ms: 20,
    ...changes,
  };
}

describe('EvaluationView', () => {
  it('renders best values, dataset names, and rows in baseline-first order', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ runs: [
      run({ method: 'sbert', model: 'sentence-transformers/all-mpnet-base-v2', ndcg_at_10: .9, index_build_seconds: 40, average_query_latency_ms: 30 }),
      run({ method: 'sbert', model: 'sentence-transformers/all-MiniLM-L6-v2', ndcg_at_10: .8, index_build_seconds: 20, average_query_latency_ms: 15.48 }),
      run({ method: 'hybrid', model: 'sentence-transformers/all-mpnet-base-v2', ndcg_at_10: .7 }),
      run({ method: 'hybrid', model: 'sentence-transformers/all-MiniLM-L6-v2', ndcg_at_10: .6 }),
      run({ method: 'hybrid-tuned', model: 'sentence-transformers/all-mpnet-base-v2', fusion: { w_bm25: 0 }, ndcg_at_10: .75 }),
      run({ method: 'hybrid-tuned', model: 'sentence-transformers/all-MiniLM-L6-v2', fusion: { w_bm25: .7 }, ndcg_at_10: .65 }),
      run({ method: 'zeta', model: null, index_build_seconds: 30, average_query_latency_ms: 40 }),
      run({ method: 'bm25', model: null, index_build_seconds: 15, average_query_latency_ms: 18 }),
      run({ method: 'alpha', model: null, index_build_seconds: 30, average_query_latency_ms: 40 }),
      run({ method: 'tfidf', model: null, ndcg_at_10: .4, index_build_seconds: 10.96, average_query_latency_ms: 25 }),
      run({ dataset: 'fiqa' }),
      run({ dataset: 'custom-dataset' }),
    ], hardware_note: 'test laptop', generated_at: 'now' })))));
    render(<EvaluationView />);

    expect(await screen.findByRole('heading', { name: 'SciFact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FiQA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'custom-dataset' })).toBeInTheDocument();
    expect(screen.getByText(/test laptop/)).toBeInTheDocument();
    expect(screen.getByText('Stars mark the highest raw value in a column. They do not indicate a statistically significant difference; see docs/analysis/analysis.md.')).toBeInTheDocument();
    expect(screen.getByText('Lower is better for index build time and query latency. TF-IDF runs on the CPU; Sentence-BERT query time includes embedding the query on the GPU.')).toBeInTheDocument();

    const scifactSection = screen.getByRole('heading', { name: 'SciFact' }).closest('section');
    if (!scifactSection) throw new Error('SciFact section was not rendered.');
    const rows = within(scifactSection).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.querySelector('.evaluation-name')?.textContent)).toEqual([
      'TF-IDF',
      'BM25',
      'MiniLM',
      'MPNet',
      'Hybrid (MiniLM)',
      'Hybrid (MPNet)',
      'Hybrid-tuned (MiniLM)',
      'Hybrid-tuned (MPNet)',
      'alpha',
      'zeta',
    ]);
    expect(within(scifactSection).getAllByText('w = 0.7')).toHaveLength(2);
    expect(within(scifactSection).getAllByText('w = 0')).toHaveLength(2);
    expect(within(scifactSection).getByText('The dev-selected BM25 weight for Hybrid-tuned (MPNet) is 0, so it is identical to the dense retriever.')).toBeInTheDocument();
    const [tfidfRow, , miniLmRow, mpnetRow] = rows;
    expect(tfidfRow?.querySelectorAll('td')[5]?.querySelector('[aria-label="Best value"]')).not.toBeNull();
    expect(miniLmRow?.querySelectorAll('td')[6]?.querySelector('[aria-label="Best value"]')).not.toBeNull();
    expect(mpnetRow?.querySelectorAll('td')[0]?.querySelector('[aria-label="Best value"]')).not.toBeNull();
    expect(tfidfRow?.querySelectorAll('td')[0]?.querySelector('[aria-label="Best value"]')).toBeNull();
    expect(mpnetRow?.querySelectorAll('td')[5]?.querySelector('[aria-label="Best value"]')).toBeNull();
    expect(within(scifactSection).getAllByTitle('sentence-transformers/all-MiniLM-L6-v2')).toHaveLength(6);
    expect(within(scifactSection).getAllByTitle('sentence-transformers/all-mpnet-base-v2')).toHaveLength(6);
    const chart = within(scifactSection).getByRole('img');
    expect(Array.from(chart.querySelectorAll('.font-medium')).map((element) => element.textContent)).toEqual([
      'TF-IDF',
      'BM25',
      'MiniLM',
      'MPNet',
      'Hybrid (MiniLM)',
      'Hybrid (MPNet)',
      'Hybrid-tuned (MiniLM)w = 0.7',
      'Hybrid-tuned (MPNet)w = 0',
      'alpha',
      'zeta',
    ]);
  });

  it('shows the export command for a missing snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: { code: 'evaluation_snapshot_missing', message: 'Evaluation snapshot is not available.', details: { build_command: 'python -m scripts.export_results' } } }), { status: 404 }))));
    render(<EvaluationView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('python -m scripts.export_results');
  });
});
