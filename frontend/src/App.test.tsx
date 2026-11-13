import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Method } from './api';

const mockMethods: Method[] = [
  {
    id: 'tfidf',
    display_name: 'TF-IDF',
    model_name: null,
    ready: true,
    kind: 'keyword',
    description: 'Matches papers using weighted keyword overlap.',
  },
  {
    id: 'bm25',
    display_name: 'BM25',
    model_name: null,
    ready: true,
    kind: 'keyword',
    description: 'Ranks papers by keyword relevance with BM25.',
  },
  {
    id: 'sbert-mpnet',
    display_name: 'Sentence-BERT MPNet',
    model_name: 'sentence-transformers/all-mpnet-base-v2',
    ready: true,
    kind: 'semantic',
    description: 'Finds papers with similar meaning using sentence embeddings.',
    benchmarks: [
      { dataset: 'scifact', ndcg_at_10: 0.656, recall_at_100: 0.942 },
      { dataset: 'fiqa', ndcg_at_10: 0.500, recall_at_100: 0.820 },
    ],
  },
  {
    id: 'sbert-minilm',
    display_name: 'Sentence-BERT MiniLM',
    model_name: 'sentence-transformers/all-MiniLM-L6-v2',
    ready: false,
    kind: 'semantic',
    description: 'Finds papers with similar meaning using sentence embeddings.',
    unavailable_reason: 'Model weights not downloaded',
    build_command: 'python -m scripts.search_demo --method sbert ...',
  },
  {
    id: 'hybrid-mpnet',
    display_name: 'Hybrid (BM25 + MPNet)',
    model_name: null,
    ready: true,
    kind: 'hybrid',
    description: 'Combines BM25 and MPNet rankings.',
  },
  {
    id: 'rerank-mpnet',
    display_name: 'Rerank (MPNet + cross-encoder)',
    model_name: null,
    ready: true,
    kind: 'reranked',
    description: 'Reranks MPNet results with a cross-encoder.',
  },
];

const mockHealth = {
  status: 'ok',
  document_count: 30000,
  methods: mockMethods,
  embedding_device: 'cuda',
  api_version: '1.0.0',
};

function makeMockSearchResponse(
  method: string,
  paperId: string,
  title: string,
  tookMs = 15.4
) {
  return {
    query: 'BERT',
    method,
    k: 5,
    took_ms: tookMs,
    results: [
      {
        rank: 1,
        score: method === 'tfidf' ? 0.125 : 0.654,
        id: paperId,
        title,
        snippet: `Snippet for ${title}`,
        categories: ['cs.CL', 'cs.AI'],
        year: 2024,
      },
    ],
  };
}

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

describe('App Component', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows the unreachable-API offline screen with command and retry button when /health fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network failure'))));

    render(<App />);

    expect(await screen.findByText('Semantic Search is offline')).toBeInTheDocument();
    expect(
      screen.getByText('python -m uvicorn backend.app.api.main:app --port 8000')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry connection/i })
    ).toBeInTheDocument();
  });

  it('renders Compare mode with both columns, takes_ms, and only-here badges', async () => {
    window.history.replaceState(null, '', '/?q=BERT&mode=compare');

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { method: string };
          if (body.method === 'tfidf') {
            return jsonResponse(
              makeMockSearchResponse('tfidf', '2101.0001', 'TF-IDF Paper Unique', 12.3)
            );
          }
          if (body.method === 'sbert-mpnet') {
            return jsonResponse(
              makeMockSearchResponse(
                'sbert-mpnet',
                '2101.0002',
                'MPNet Paper Unique',
                45.6
              )
            );
          }
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    // Topbar header
    expect(await screen.findByText(/Online · 30,000 papers · CUDA/i)).toBeInTheDocument();

    // Verify both columns exist with display names
    expect(screen.getByRole('heading', { name: 'TF-IDF' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sentence-BERT MPNet' })
    ).toBeInTheDocument();

    // Check papers rendered
    expect(await screen.findByText('TF-IDF Paper Unique')).toBeInTheDocument();
    expect(screen.getByText('MPNet Paper Unique')).toBeInTheDocument();

    // Took_ms pills displayed per column
    expect(screen.getByText('12.3 ms')).toBeInTheDocument();
    expect(screen.getByText('45.6 ms')).toBeInTheDocument();

    // Completely disjoint lists get one shared note instead of noisy badges.
    expect(await screen.findByText('No papers appear in both lists.')).toBeInTheDocument();
    expect(screen.queryByText('Only here')).not.toBeInTheDocument();

    // Score incomparability note should be visible
    expect(
      screen.getByText(/Scores are calculated differently|Scores are not comparable/i)
    ).toBeInTheDocument();
  });

  it('renders arbitrary method pairs in Compare mode (BM25 vs Hybrid) with display names and individual took_ms', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=neural&mode=compare&left=bm25&model=hybrid-mpnet'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { method: string };
          if (body.method === 'bm25') {
            return jsonResponse(
              makeMockSearchResponse('bm25', 'doc-bm25', 'BM25 Ranked Paper', 7.2)
            );
          }
          if (body.method === 'hybrid-mpnet') {
            return jsonResponse(
              makeMockSearchResponse(
                'hybrid-mpnet',
                'doc-hybrid',
                'Hybrid Ranked Paper',
                34.8
              )
            );
          }
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    // Columns should have display names
    expect(await screen.findByRole('heading', { name: 'BM25' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Hybrid (BM25 + MPNet)' })
    ).toBeInTheDocument();

    // Respective took_ms pills
    expect(screen.getByText('7.2 ms')).toBeInTheDocument();
    expect(screen.getByText('34.8 ms')).toBeInTheDocument();

    expect(screen.getByText('BM25 Ranked Paper')).toBeInTheDocument();
    expect(screen.getByText('Hybrid Ranked Paper')).toBeInTheDocument();
  });

  it('renders arbitrary method pairs in Compare mode (MPNet vs Rerank)', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=attention&mode=compare&left=sbert-mpnet&model=rerank-mpnet'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { method: string };
          if (body.method === 'sbert-mpnet') {
            return jsonResponse(
              makeMockSearchResponse(
                'sbert-mpnet',
                'doc-sbert',
                'SBERT Dense Result',
                22.1
              )
            );
          }
          if (body.method === 'rerank-mpnet') {
            return jsonResponse(
              makeMockSearchResponse(
                'rerank-mpnet',
                'doc-rerank',
                'Reranked Top Result',
                185.0
              )
            );
          }
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Sentence-BERT MPNet' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Rerank (MPNet + cross-encoder)' })
    ).toBeInTheDocument();

    expect(screen.getByText('22.1 ms')).toBeInTheDocument();
    expect(screen.getByText('185.0 ms')).toBeInTheDocument();
  });

  it('keeps defaults unchanged as left=tfidf and right=sbert-mpnet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        return jsonResponse({});
      })
    );

    render(<App />);

    const leftSelect = (await screen.findByLabelText(
      /left method:/i
    )) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(/right method:/i) as HTMLSelectElement;

    expect(leftSelect.value).toBe('tfidf');
    expect(rightSelect.value).toBe('sbert-mpnet');
  });

  it('shows an inline message and disables Search when left and right selections are equal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        return jsonResponse({});
      })
    );

    render(<App />);

    const searchInput = (await screen.findByRole('textbox', {
      name: /search 30,000 computer science research papers/i,
    })) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'neural search' } });

    const searchForm = searchInput.closest('form');
    if (!searchForm) throw new Error('Search form not found');
    const searchButton = within(searchForm).getByRole('button', { name: 'Search' });
    expect(searchButton).toBeEnabled();

    // Change left select to match right select (sbert-mpnet)
    const leftSelect = screen.getByLabelText(/left method:/i);
    fireEvent.change(leftSelect, { target: { value: 'sbert-mpnet' } });

    // Warning message should appear
    expect(
      screen.getByText('Choose two different methods to compare.')
    ).toBeInTheDocument();

    // Search button must now be disabled
    expect(searchButton).toBeDisabled();
  });

  it('restores legacy link carrying only model by defaulting left to tfidf at App level', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=BERT&mode=compare&model=hybrid-mpnet&k=5'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { method: string };
          return jsonResponse(
            makeMockSearchResponse(body.method, `${body.method}-1`, `Legacy ${body.method}`)
          );
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    // Left should default to TF-IDF
    expect(await screen.findByRole('heading', { name: 'TF-IDF' })).toBeInTheDocument();
    // Right should be hybrid-mpnet
    expect(
      screen.getByRole('heading', { name: 'Hybrid (BM25 + MPNet)' })
    ).toBeInTheDocument();
  });

  it('renders method info block with benchmarks and caption, and slower-method note for rerank', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=information&mode=search&model=sbert-mpnet'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { method: string };
          return jsonResponse(
            makeMockSearchResponse(body.method, 'doc-bench', 'Benchmarked Paper')
          );
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    // SBERT MPNet description
    expect(
      await screen.findByText(
        'Finds papers with similar meaning using sentence embeddings.'
      )
    ).toBeInTheDocument();

    // Benchmark line and caption
    expect(
      screen.getByText(/Benchmark nDCG@10: SciFact 0\.656, FiQA 0\.500/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Benchmark results on SciFact and FiQA, not measured on this arXiv corpus; see Evaluation.'
      )
    ).toBeInTheDocument();

    // Switch to rerank-mpnet
    const methodSelect = screen.getByLabelText(/retrieval method:/i);
    fireEvent.change(methodSelect, { target: { value: 'rerank-mpnet' } });

    // Should display the slower-method note
    expect(
      await screen.findByText(
        'Includes cross-encoder scoring of 100 candidates per query, so it is slower.'
      )
    ).toBeInTheDocument();

    // Switch to BM25 (no benchmarks defined in our mock)
    fireEvent.change(methodSelect, { target: { value: 'bm25' } });
    expect(
      screen.queryByText(/Benchmark results on SciFact and FiQA/i)
    ).not.toBeInTheDocument();
  });

  it('disables unavailable methods in the selector with their reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        return jsonResponse({});
      })
    );

    render(<App />);

    const rightSelect = (await screen.findByLabelText(
      /right method:/i
    )) as HTMLSelectElement;

    const disabledOption = within(rightSelect).getByRole('option', {
      name: /Sentence-BERT MiniLM \(Model weights not downloaded\)/i,
    }) as HTMLOptionElement;

    expect(disabledOption).toBeDisabled();
  });

  it('theme toggle in header reflects current theme and toggles data-theme', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        return jsonResponse({});
      })
    );

    render(<App />);

    // Default theme is dark
    const toggleButton = await screen.findByRole('button', {
      name: /switch to light theme/i,
    });
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Click toggle to switch to light
    fireEvent.click(toggleButton);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(
      screen.getByRole('button', { name: /switch to dark theme/i })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('keeps the successful column visible when the other column fails', async () => {
    window.history.replaceState(null, '', '/?q=transformers&mode=compare');

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { method: string };
          if (body.method === 'tfidf') {
            return jsonResponse(
              makeMockSearchResponse('tfidf', '2201.0001', 'Sparse Success Paper')
            );
          }
          if (body.method === 'sbert-mpnet') {
            return jsonResponse(
              {
                error: {
                  code: 'method_unavailable',
                  message: "Search method 'sbert-mpnet' is unavailable.",
                  details: {
                    build_command: 'python -m scripts.search_demo --rebuild',
                  },
                },
              },
              503
            );
          }
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    // TF-IDF column succeeded
    expect(await screen.findByText('Sparse Success Paper')).toBeInTheDocument();

    // MPNet column shows error with build command
    expect(
      await screen.findByText(
        /Search method 'sbert-mpnet' is unavailable\. Build it with: python -m scripts\.search_demo --rebuild/i
      )
    ).toBeInTheDocument();
  });

  it('fetches and caches document full abstract on expand', async () => {
    window.history.replaceState(null, '', '/?q=compression&mode=search&model=tfidf');

    const documentFetchMock = vi.fn((_url: string) =>
      jsonResponse({
        id: '2001.0001',
        title: 'Compression Paper',
        abstract: 'This is the complete and uncompressed abstract text.',
        categories: ['cs.LG'],
        year: 2024,
      })
    );

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.includes('/documents/2001.0001')) {
          return documentFetchMock(url);
        }
        if (url.endsWith('/search') && init?.body) {
          return jsonResponse(
            makeMockSearchResponse('tfidf', '2001.0001', 'Compression Paper')
          );
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    expect(await screen.findByText('Compression Paper')).toBeInTheDocument();

    const expandButton = screen.getByRole('button', { name: /show full abstract/i });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open abstract
    fireEvent.click(expandButton);

    expect(
      await screen.findByText('This is the complete and uncompressed abstract text.')
    ).toBeInTheDocument();
    expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    expect(documentFetchMock).toHaveBeenCalledTimes(1);

    // Toggle close
    fireEvent.click(expandButton);
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    // Toggle open again - should use cached document without second network request
    fireEvent.click(expandButton);
    expect(
      screen.getByText('This is the complete and uncompressed abstract text.')
    ).toBeInTheDocument();
    expect(documentFetchMock).toHaveBeenCalledTimes(1);
  });

  it('clicking an example query triggers search and populates input', async () => {
    let searchedQuery = '';

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { query: string; method: string };
          searchedQuery = body.query;
          return jsonResponse(
            makeMockSearchResponse(body.method, '2301.0001', `Results for ${body.query}`)
          );
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('BERT')).toBeInTheDocument();
    });

    const exampleButton = screen.getByRole('button', { name: 'BERT' });
    fireEvent.click(exampleButton);

    await waitFor(() => {
      expect(searchedQuery).toBe('BERT');
    });

    const input = screen.getByRole('textbox', {
      name: /search 30,000 computer science research papers/i,
    }) as HTMLInputElement;
    expect(input.value).toBe('BERT');
  });

  it('supports switching between Compare and Search mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        return jsonResponse({});
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Compare' })).toBeInTheDocument();
    });

    const searchTab = screen.getByRole('tab', { name: 'Search' });
    fireEvent.click(searchTab);

    // Single column heading should now be present
    expect(
      screen.getByRole('heading', { name: 'Sentence-BERT MPNet' })
    ).toBeInTheDocument();
    // Compare TF-IDF column should not be rendered
    expect(screen.queryByRole('heading', { name: 'TF-IDF' })).not.toBeInTheDocument();
  });

  it('switches to Evaluation and mirrors it in the URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/evaluation')) {
          return jsonResponse({
            runs: [],
            hardware_note: 'test',
            generated_at: 'now',
          });
        }
        return jsonResponse({});
      })
    );
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Evaluation' }));
    expect(
      await screen.findByText('No evaluation runs are available.')
    ).toBeInTheDocument();
    expect(window.location.search).toContain('view=eval');
  });

  it('keeps submitted results visible when k changes and shows an update hint', async () => {
    window.history.replaceState(null, '', '/?q=BERT&mode=search&model=tfidf');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          return jsonResponse(
            makeMockSearchResponse('tfidf', 'k-paper', 'Kept Result')
          );
        }
        return jsonResponse({});
      })
    );
    render(<App />);
    expect(await screen.findByText('Kept Result')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Results (k):'), {
      target: { value: '10' },
    });
    expect(screen.getByText('Kept Result')).toBeInTheDocument();
    expect(
      screen.getByText('Settings changed, press Search to update.')
    ).toBeInTheDocument();
  });

  it('restores URL state on popstate and runs only the requested search', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=first&mode=compare&model=sbert-mpnet&k=5'
    );
    const searches: Array<{ query: string; method: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as {
            query: string;
            method: string;
          };
          searches.push(body);
          return jsonResponse(
            makeMockSearchResponse(
              body.method,
              `${body.query}-${body.method}`,
              `${body.query} result`
            )
          );
        }
        return jsonResponse({});
      })
    );
    render(<App />);
    await screen.findAllByText('first result');
    expect(searches).toHaveLength(2);
    window.history.replaceState(
      null,
      '',
      '/?q=second&mode=search&model=tfidf&k=10'
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByText('second result')).toBeInTheDocument();
    expect(searches).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('automatically reruns a non-empty query while switching modes', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=switching&mode=search&model=tfidf&k=5'
    );
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          const body = JSON.parse(String(init.body)) as { method: string };
          methods.push(body.method);
          return jsonResponse(
            makeMockSearchResponse(
              body.method,
              `${body.method}-paper`,
              `${body.method} result`
            )
          );
        }
        return jsonResponse({});
      })
    );
    render(<App />);
    await screen.findByText('tfidf result');
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
    await screen.findByText('sbert-mpnet result');
    expect(methods).toEqual(['tfidf', 'tfidf', 'sbert-mpnet']);
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    await waitFor(() => expect(methods).toHaveLength(4));
  });

  it('shows the character counter only above 400 characters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        return jsonResponse({});
      })
    );
    render(<App />);
    const input = await screen.findByRole('textbox', {
      name: /search 30,000 computer science research papers/i,
    });
    fireEvent.change(input, { target: { value: 'a'.repeat(400) } });
    expect(screen.queryByText('400/500 characters')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'a'.repeat(401) } });
    expect(screen.getByText('401/500 characters')).toBeInTheDocument();
  });

  it('puts both columns into loading and ignores late responses from an older search', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=older&mode=compare&model=sbert-mpnet&k=5'
    );
    const resolvers: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        if (url.endsWith('/search') && init?.body) {
          return new Promise<Response>((resolve) => resolvers.push(resolve));
        }
        return jsonResponse({});
      })
    );
    render(<App />);
    expect(
      await screen.findByLabelText('Loading TF-IDF results')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Loading Sentence-BERT MPNet results')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'BERT' }));
    await waitFor(() => expect(resolvers).toHaveLength(4));
    resolvers[2](
      await jsonResponse(
        makeMockSearchResponse('tfidf', 'new-tfidf', 'New TF-IDF')
      )
    );
    resolvers[3](
      await jsonResponse(
        makeMockSearchResponse('sbert-mpnet', 'new-sbert', 'New SBERT')
      )
    );
    expect(await screen.findByText('New TF-IDF')).toBeInTheDocument();
    resolvers[0](
      await jsonResponse(
        makeMockSearchResponse('tfidf', 'old-tfidf', 'Old TF-IDF')
      )
    );
    resolvers[1](
      await jsonResponse(
        makeMockSearchResponse('sbert-mpnet', 'old-sbert', 'Old SBERT')
      )
    );
    await waitFor(() =>
      expect(screen.queryByText('Old TF-IDF')).not.toBeInTheDocument()
    );
    expect(screen.getByText('New SBERT')).toBeInTheDocument();
  });

  it('keeps only-here badges for partially overlapping compare results', async () => {
    window.history.replaceState(null, '', '/?q=overlap&mode=compare');
    const response = (method: string, ids: string[]) => ({
      query: 'overlap',
      method,
      k: 5,
      took_ms: 1,
      results: ids.map((id, index) => ({
        rank: index + 1,
        score: 0.5,
        id,
        title: id,
        snippet: id,
        categories: [],
        year: 2024,
      })),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse(mockHealth);
        if (url.endsWith('/methods')) return jsonResponse(mockMethods);
        const method = JSON.parse(String(init?.body ?? '{}')).method;
        if (url.endsWith('/search')) {
          return jsonResponse(
            method === 'tfidf'
              ? response(method, ['shared', 'sparse-only'])
              : response(method, ['shared', 'dense-only'])
          );
        }
        return jsonResponse({});
      })
    );
    render(<App />);
    expect(await screen.findAllByText('Only here')).toHaveLength(2);
    expect(
      screen.queryByText('No papers appear in both lists.')
    ).not.toBeInTheDocument();
  });
});
