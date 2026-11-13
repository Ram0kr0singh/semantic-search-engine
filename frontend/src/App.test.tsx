import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Method } from './api';

const mockMethods: Method[] = [
  { id: 'tfidf', display_name: 'TF-IDF', model_name: null, ready: true, kind: 'keyword', description: 'Matches papers using weighted keyword overlap.' },
  { id: 'bm25', display_name: 'BM25', model_name: null, ready: true, kind: 'keyword', description: 'Ranks papers by keyword relevance with BM25.' },
  { id: 'sbert-mpnet', display_name: 'Sentence-BERT MPNet', model_name: 'sentence-transformers/all-mpnet-base-v2', ready: true, kind: 'semantic', description: 'Finds papers with similar meaning using sentence embeddings.', benchmarks: [{ dataset: 'scifact', ndcg_at_10: 0.656, recall_at_100: 0.942 }] },
  { id: 'sbert-minilm', display_name: 'Sentence-BERT MiniLM', model_name: 'sentence-transformers/all-MiniLM-L6-v2', ready: false, kind: 'semantic', description: 'Unavailable', unavailable_reason: 'Model weights not downloaded' },
  { id: 'hybrid-mpnet', display_name: 'Hybrid (BM25 + MPNet)', model_name: null, ready: true, kind: 'hybrid', description: 'Combines BM25 and MPNet rankings.' },
  { id: 'rerank-mpnet', display_name: 'Rerank (MPNet + cross-encoder)', model_name: null, ready: true, kind: 'reranked', description: 'Reranks MPNet results with a cross-encoder.' },
];
const mockHealth = { status: 'ok', document_count: 30000, methods: mockMethods, embedding_device: 'cuda', api_version: '1.0.0' };

function response(method: string, id: string, title: string, took_ms = 15.4) {
  return { query: 'query', method, k: 5, took_ms, results: [{ rank: 1, score: 0.5, id, title, snippet: `Snippet for ${title}`, categories: ['cs.AI'], year: 2024 }] };
}
function json(data: unknown, status = 200) { return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })); }
function installApi(search = (method: string) => json(response(method, `${method}-paper`, `${method} paper`))) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/health')) return json(mockHealth);
    if (url.endsWith('/methods')) return json(mockMethods);
    if (url.endsWith('/evaluation')) return json({ runs: [], hardware_note: 'test', generated_at: 'now' });
    if (url.endsWith('/search')) return search(JSON.parse(String(init?.body)).method);
    return json({});
  });
  vi.stubGlobal('fetch', fetchMock); return fetchMock;
}
async function ready() { await screen.findByText(/Online · 30,000 papers · CUDA/i); }
async function search(query = 'neural retrieval') {
  const input = await screen.findByRole('textbox', { name: /search 30,000/i });
  fireEvent.change(input, { target: { value: query } });
  fireEvent.click(within(input.closest('form')!).getByRole('button', { name: 'Search' }));
}
async function compare() { fireEvent.click(await screen.findByRole('tab', { name: 'Compare approaches' })); }

describe('App Component', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/'); localStorage.clear(); vi.restoreAllMocks(); });
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('shows the offline screen when health checks fail', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network failure')))); render(<App />);
    expect(await screen.findByText('Semantic Search is offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument();
  });

  it('starts blank, cleans legacy URL state, and never submits a previous search', async () => {
    window.history.replaceState(null, '', '/?q=old&mode=compare&model=tfidf'); const fetchMock = installApi(); render(<App />); await ready();
    expect(screen.getByRole('textbox', { name: /search 30,000/i })).toHaveValue(''); expect(window.location.search).toBe('');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/search'))).toHaveLength(0);
  });

  it('runs a single-method search from user selections and renders its result', async () => {
    const fetchMock = installApi((method) => json(response(method, 'bm25-1', 'BM25 Result', 7.2))); render(<App />); await ready();
    fireEvent.change(screen.getByLabelText('Search approach:'), { target: { value: 'bm25' } }); await search('ranking');
    expect(await screen.findByRole('heading', { name: 'BM25' })).toBeInTheDocument(); expect(screen.getByText('BM25 Result')).toBeInTheDocument(); expect(screen.getByText('7.2 ms')).toBeInTheDocument();
    const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/search'))![1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ query: 'ranking', method: 'bm25', k: 5 });
  });

  it('compares two selected methods and shows disjoint-list feedback', async () => {
    installApi((method) => json(method === 'bm25' ? response(method, 'bm25-only', 'BM25 Unique', 7.2) : response(method, 'hybrid-only', 'Hybrid Unique', 34.8))); render(<App />); await ready(); await compare();
    fireEvent.change(screen.getByLabelText('First approach:'), { target: { value: 'bm25' } }); fireEvent.change(screen.getByLabelText('Second approach:'), { target: { value: 'hybrid-mpnet' } }); await search('neural');
    expect(await screen.findByText('BM25 Unique')).toBeInTheDocument(); expect(screen.getByText('Hybrid Unique')).toBeInTheDocument(); expect(screen.getByText('No papers appear in both lists.')).toBeInTheDocument();
  });

  it('shows only-here badges for selected comparison results that partially overlap', async () => {
    installApi((method) => json({ query: 'overlap', method, k: 5, took_ms: 1, results: (method === 'tfidf' ? ['shared', 'sparse-only'] : ['shared', 'dense-only']).map((id, index) => ({ rank: index + 1, score: .5, id, title: id, snippet: id, categories: [], year: 2024 })) })); render(<App />); await ready(); await compare(); await search('overlap');
    expect(await screen.findAllByText('Only here')).toHaveLength(2); expect(screen.queryByText('No papers appear in both lists.')).not.toBeInTheDocument();
  });

  it('keeps the successful comparison column when the other selected method fails', async () => {
    installApi((method) => method === 'tfidf' ? json(response(method, 'success', 'Sparse Success')) : json({ error: { message: 'Method is unavailable.', details: { build_command: 'python -m rebuild' } } }, 503)); render(<App />); await ready(); await compare(); await search('transformers');
    expect(await screen.findByText('Sparse Success')).toBeInTheDocument(); expect(await screen.findByText(/Method is unavailable.*python -m rebuild/i)).toBeInTheDocument();
  });

  it('loads a full abstract once and serves later expansions from the cache', async () => {
    const documentFetch = vi.fn(() => json({ id: 'doc-1', title: 'Cached Paper', abstract: 'The complete abstract.', categories: [], year: 2024 }));
    const fetchMock = installApi((method) => json(response(method, 'doc-1', 'Cached Paper')));
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => String(input).includes('/documents/doc-1') ? documentFetch() : fetchMock(input, init)));
    render(<App />); await ready(); await search(); const button = await screen.findByRole('button', { name: /show full abstract/i });
    fireEvent.click(button); expect(await screen.findByText('The complete abstract.')).toBeInTheDocument(); fireEvent.click(button); fireEvent.click(button); expect(documentFetch).toHaveBeenCalledTimes(1);
  });

  it('uses beginner-friendly method labels and explanations and disables unavailable choices', async () => {
    installApi(); render(<App />); await ready(); expect(screen.getByText(/Choose how the search should understand your words/i)).toBeInTheDocument(); expect(screen.getByText(/similar meaning.*good default/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Search approach:')).getByRole('option', { name: /Meaning match \(faster\).*Model weights/i })).toBeDisabled(); fireEvent.change(screen.getByLabelText('Search approach:'), { target: { value: 'rerank-mpnet' } }); expect(screen.getByText(/takes longer because it reviews the top 100/i)).toBeInTheDocument();
  });

  it('blocks equal comparison methods and preserves submitted results until Search is clicked again', async () => {
    installApi(); render(<App />); await ready(); await compare(); await search(); expect(await screen.findByText('tfidf paper')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('First approach:'), { target: { value: 'sbert-mpnet' } }); expect(screen.getByText('Choose two different methods to compare.')).toBeInTheDocument(); expect(within(screen.getByRole('textbox', { name: /search 30,000/i }).closest('form')!).getByRole('button', { name: 'Search' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('First approach:'), { target: { value: 'bm25' } }); expect(screen.getByText('tfidf paper')).toBeInTheDocument(); expect(screen.getByText('Choices changed — select Search to update the results.')).toBeInTheDocument();
  });

  it('uses the lower Compare approaches and One approach controls, rerunning an entered query', async () => {
    const methods: string[] = []; installApi((method) => { methods.push(method); return json(response(method, method, `${method} result`)); }); render(<App />); await ready(); await search('switching'); await screen.findByText('sbert-mpnet result'); await compare();
    await waitFor(() => expect(methods).toEqual(['sbert-mpnet', 'tfidf', 'sbert-mpnet'])); fireEvent.click(screen.getByRole('tab', { name: 'One approach' })); await waitFor(() => expect(methods).toHaveLength(4));
  });

  it('provides Search and Evaluation header navigation and switches theme', async () => {
    installApi(); render(<App />); await ready(); expect(screen.getByRole('navigation', { name: 'Application views' })).toHaveTextContent('Search'); fireEvent.click(screen.getByRole('button', { name: 'Evaluation' })); expect(await screen.findByText('No evaluation runs are available.')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const toggle = screen.getByRole('button', { name: /switch to light theme/i }); fireEvent.click(toggle); expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('starts a new blank search when navigating back or reopening the home page', async () => {
    installApi(); render(<App />); await ready(); await search('history'); expect(await screen.findByText('sbert-mpnet paper')).toBeInTheDocument(); window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search 30,000/i })).toHaveValue('')); expect(screen.queryByText('sbert-mpnet paper')).not.toBeInTheDocument();
  });
});
