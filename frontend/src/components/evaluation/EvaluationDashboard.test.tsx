import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { EvaluationRun } from '../../api';
import { EvaluationView } from '../EvaluationView';

afterEach(() => vi.restoreAllMocks());

function mockRun(changes: Partial<EvaluationRun>): EvaluationRun {
  return {
    method: 'tfidf',
    model: null,
    dataset: 'scifact',
    generated_at: 'now',
    query_count: 300,
    recall_at_1: 0.4,
    recall_at_5: 0.5,
    recall_at_10: 0.6,
    recall_at_100: 0.7,
    mrr_at_10: 0.4,
    ndcg_at_10: 0.5,
    index_build_seconds: 10.96,
    average_query_latency_ms: 20,
    ...changes,
  };
}

const mockPayload = {
  runs: [
    mockRun({
      method: 'sbert',
      model: 'sentence-transformers/all-mpnet-base-v2',
      ndcg_at_10: 0.9,
      recall_at_100: 0.95,
      index_build_seconds: 40,
      average_query_latency_ms: 30,
    }),
    mockRun({
      method: 'bm25',
      model: null,
      ndcg_at_10: 0.6,
      recall_at_100: 0.8,
      index_build_seconds: 15,
      average_query_latency_ms: 5,
    }),
    mockRun({
      method: 'tfidf',
      model: null,
      ndcg_at_10: 0.4,
      recall_at_100: 0.6,
      index_build_seconds: 10,
      average_query_latency_ms: 25,
    }),
    mockRun({
      dataset: 'fiqa',
      method: 'sbert',
      model: 'sentence-transformers/all-mpnet-base-v2',
      ndcg_at_10: 0.55,
      recall_at_100: 0.82,
      average_query_latency_ms: 12,
    }),
  ],
  hardware_note: 'RTX 4060 Laptop GPU',
  generated_at: 'now',
};

describe('EvaluationDashboard Refinement', () => {
  it('renders KPI tiles with best values and method labels', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockPayload)))));
    render(<EvaluationView />);

    expect(await screen.findByRole('heading', { name: 'SciFact' })).toBeInTheDocument();

    // Check KPI titles
    expect(screen.getAllByText('Best nDCG@10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Best Recall@100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fastest Latency').length).toBeGreaterThan(0);

    // Check SciFact values: Best nDCG@10 is 0.9000, Best Recall@100 is 0.9500, Fastest is 5.00 ms
    expect(screen.getAllByText('0.9000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.9500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.00 ms').length).toBeGreaterThan(0);
  });

  it('filters by dataset when clicking segmented control pills', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockPayload)))));
    render(<EvaluationView />);

    expect(await screen.findByRole('heading', { name: 'SciFact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FiQA' })).toBeInTheDocument();

    // Filter to SciFact only
    const scifactBtn = screen.getByRole('button', { name: 'SciFact' });
    fireEvent.click(scifactBtn);

    expect(screen.getByRole('heading', { name: 'SciFact' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'FiQA' })).not.toBeInTheDocument();

    // Reset to All Datasets
    const allBtn = screen.getByRole('button', { name: 'All Datasets' });
    fireEvent.click(allBtn);

    expect(screen.getByRole('heading', { name: 'SciFact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FiQA' })).toBeInTheDocument();
  });

  it('supports sorting table columns on click', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockPayload)))));
    render(<EvaluationView />);

    const scifactHeading = await screen.findByRole('heading', { name: 'SciFact' });
    const scifactSection = scifactHeading.closest('section');
    if (!scifactSection) throw new Error('SciFact section missing');

    const table = within(scifactSection).getByRole('table');
    const thead = table.querySelector('thead');
    if (!thead) throw new Error('thead missing');
    const ndcgHeader = within(thead).getByText('nDCG@10');

    // Click once: sorts descending (highest nDCG first: MPNet 0.9, then BM25 0.6, then TF-IDF 0.4)
    fireEvent.click(ndcgHeader);

    let rows = within(scifactSection).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('.evaluation-name')?.textContent)).toEqual([
      'MPNet',
      'BM25',
      'TF-IDF',
    ]);

    // Click again: sorts ascending (lowest nDCG first: TF-IDF 0.4, BM25 0.6, MPNet 0.9)
    fireEvent.click(ndcgHeader);
    rows = within(scifactSection).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('.evaluation-name')?.textContent)).toEqual([
      'TF-IDF',
      'BM25',
      'MPNet',
    ]);
  });

  it('renders RecallLineChart with SVG paths and legend items', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockPayload)))));
    render(<EvaluationView />);

    expect(await screen.findByRole('heading', { name: 'SciFact' })).toBeInTheDocument();

    // Check SVG chart aria label
    const charts = screen.getAllByLabelText('Recall Progression Chart across models');
    expect(charts.length).toBeGreaterThan(0);

    // Check legend items
    expect(screen.getAllByText('Recall Progression Curves').length).toBeGreaterThan(0);
  });
});
