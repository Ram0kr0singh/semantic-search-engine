import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type {
  CreateWorkspaceResponse,
  WorkspaceDocSummary,
  WorkspaceLimits,
  WorkspaceSearchResponse,
  WorkspaceStatusResponse,
} from '../api';
import { clearWorkspaceSession, setStoredWorkspaceLimits, setStoredWorkspaceToken } from '../workspaceStorage';

const mockMethods = [
  { id: 'tfidf', display_name: 'TF-IDF', model_name: null, ready: true, kind: 'keyword' as const, description: 'Matches papers.' },
  { id: 'bm25', display_name: 'BM25', model_name: null, ready: true, kind: 'keyword' as const, description: 'Ranks papers.' },
  { id: 'sbert-mpnet', display_name: 'Sentence-BERT MPNet', model_name: 'model', ready: true, kind: 'semantic' as const, description: 'Finds papers.' },
];

const mockHealth = {
  status: 'ok',
  document_count: 30000,
  methods: mockMethods,
  embedding_device: 'cuda',
  api_version: '1.0.0',
};

const defaultLimits: WorkspaceLimits = {
  max_upload_mb: 10,
  max_files_per_workspace: 10,
  max_pdf_pages: 200,
  max_chars_per_document: 1000000,
  max_passages_per_workspace: 3000,
};

const mockCreateResponse: CreateWorkspaceResponse = {
  workspace_id: 'WORKSPACE_TOKEN_SECRET_XYZ123456789012345',
  ttl_minutes: 60,
  limits: defaultLimits,
};

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function empty204() {
  return Promise.resolve(new Response(null, { status: 204 }));
}

function makeDoc(id: string, name: string, kind = 'pdf', pages: number | null = 5, passages = 8, warnings: string[] = []): WorkspaceDocSummary {
  return {
    id,
    name,
    kind,
    pages,
    character_count: 1500,
    passage_count: passages,
    warnings,
  };
}

describe('Your documents workspace view', () => {
  let requestedUrls: string[] = [];
  let requestedHeaders: Array<Record<string, string>> = [];

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    sessionStorage.clear();
    clearWorkspaceSession();
    requestedUrls = [];
    requestedHeaders = [];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    clearWorkspaceSession();
    vi.restoreAllMocks();
  });

  function setupWorkspaceFetch(options?: {
    createResponse?: CreateWorkspaceResponse;
    initialStatus?: WorkspaceStatusResponse;
    uploadHandler?: (file: File) => Promise<Response>;
    searchHandler?: (query: string, method: string, k: number) => Promise<Response>;
    deleteDocHandler?: (docId: string) => Promise<Response>;
    deleteWorkspaceHandler?: () => Promise<Response>;
  }) {
    let currentDocs: WorkspaceDocSummary[] = options?.initialStatus?.documents ?? [];

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requestedUrls.push(url);

      const headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((val, key) => {
            headers[key] = val;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => {
            headers[k] = v;
          });
        } else {
          Object.assign(headers, init.headers);
        }
      }
      requestedHeaders.push(headers);

      if (url.endsWith('/health')) return json(mockHealth);
      if (url.endsWith('/methods')) return json(mockMethods);
      if (url.endsWith('/evaluation')) return json({ runs: [], hardware_note: 'test', generated_at: 'now' });

      if (url.endsWith('/workspaces') && init?.method === 'POST') {
        return json(options?.createResponse ?? mockCreateResponse);
      }

      if (url.endsWith('/workspace') && (!init?.method || init.method === 'GET')) {
        const token = headers['X-Workspace-Token'] || headers['x-workspace-token'];
        if (!token) {
          return json({ error: { code: 'workspace_not_found', message: 'Workspace was not found.' } }, 404);
        }
        return json({
          documents: currentDocs,
          totals: {
            documents: currentDocs.length,
            passages: currentDocs.reduce((acc, d) => acc + d.passage_count, 0),
          },
          seconds_until_expiry: 3600,
        });
      }

      if (url.endsWith('/workspace/documents') && init?.method === 'POST') {
        const formData = init.body as FormData;
        const file = (formData?.get('file') as File) || new File(['sample'], 'doc.pdf');
        if (options?.uploadHandler) {
          return options.uploadHandler(file).then((res) => {
            if (res.ok) {
              res
                .clone()
                .json()
                .then((doc) => {
                  currentDocs = [...currentDocs.filter((d) => d.id !== doc.id), doc];
                })
                .catch(() => {});
            }
            return res;
          });
        }
        const newDoc = makeDoc(`doc-${Date.now()}`, file.name, file.name.endsWith('.txt') ? 'txt' : 'pdf');
        currentDocs = [...currentDocs, newDoc];
        return json(newDoc);
      }

      if (url.includes('/workspace/documents/') && init?.method === 'DELETE') {
        const docId = decodeURIComponent(url.split('/workspace/documents/')[1]);
        currentDocs = currentDocs.filter((d) => d.id !== docId);
        if (options?.deleteDocHandler) return options.deleteDocHandler(docId);
        return empty204();
      }

      if (url.endsWith('/workspace') && init?.method === 'DELETE') {
        currentDocs = [];
        if (options?.deleteWorkspaceHandler) return options.deleteWorkspaceHandler();
        return empty204();
      }

      if (url.endsWith('/workspace/search') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        if (options?.searchHandler) {
          return options.searchHandler(body.query, body.method, body.k);
        }
        const mockSearchRes: WorkspaceSearchResponse = {
          query: body.query,
          method: body.method,
          k: body.k,
          took_ms: 12.5,
          results: [
            {
              rank: 1,
              score: 0.892,
              document_id: 'doc-1',
              document_name: 'research_notes.pdf',
              page: 2,
              passage_index: 0,
              text: 'Deep neural networks enable high accuracy semantic search across documents.',
              snippet: 'Deep neural networks enable high accuracy...',
            },
          ],
        };
        return json(mockSearchRes);
      }

      return json({});
    });

    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  async function goToYourDocuments() {
    render(<App />);
    await screen.findByText(/Online · 30,000 papers · CUDA/i);
    const navBtn = screen.getByRole('button', { name: 'Your documents' });
    fireEvent.click(navBtn);
    expect(await screen.findByRole('heading', { name: 'Search your own documents' })).toBeInTheDocument();
  }

  it('navigates to Your documents and keeps the address bar clean', async () => {
    setupWorkspaceFetch();
    await goToYourDocuments();

    // Check button state
    const docsBtn = screen.getByRole('button', { name: 'Your documents' });
    expect(docsBtn).toHaveAttribute('aria-current', 'page');

    // Clean address bar: no query params, no hash, no tokens
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');

    // Token was NOT created lazily on page visit
    expect(requestedUrls.filter((u) => u.endsWith('/workspaces'))).toHaveLength(0);
  });

  it('creates workspace lazily on first upload and renders uploaded documents with warnings', async () => {
    setupWorkspaceFetch({
      uploadHandler: (file) =>
        json(makeDoc('doc-101', file.name, 'pdf', 3, 6, ['1 page had no extractable text; scanned images are not supported.'])),
    });
    await goToYourDocuments();

    // No workspace created yet
    expect(requestedUrls.filter((u) => u.endsWith('/workspaces'))).toHaveLength(0);

    // Select a file
    const file = new File(['%PDF-1.4 test'], 'paper.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('workspace-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Workspace should now be created and document uploaded
    expect(await screen.findByText('paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('3 pages')).toBeInTheDocument();
    expect(screen.getByText('6 passages')).toBeInTheDocument();
    expect(screen.getAllByText(/1 page had no extractable text/).length).toBeGreaterThan(0);

    // Verify POST /workspaces was called exactly once
    expect(requestedUrls.filter((u) => u.endsWith('/workspaces'))).toHaveLength(1);
    expect(requestedUrls.filter((u) => u.endsWith('/workspace/documents'))).toHaveLength(1);
  });

  it('displays limits dynamically from the API response instead of hardcoding', async () => {
    const customLimits: WorkspaceLimits = {
      max_upload_mb: 25,
      max_files_per_workspace: 15,
      max_pdf_pages: 500,
      max_chars_per_document: 2000000,
      max_passages_per_workspace: 6000,
    };
    setupWorkspaceFetch({
      createResponse: {
        workspace_id: 'CUSTOM_WORKSPACE_TOKEN_123456789012345678',
        ttl_minutes: 60,
        limits: customLimits,
      },
    });
    await goToYourDocuments();

    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.getElementById('workspace-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('Up to 25 MB per file')).toBeInTheDocument();
    expect(screen.getByText('Up to 15 files')).toBeInTheDocument();
    expect(screen.getByText('Up to 500 pages per PDF')).toBeInTheDocument();
    expect(screen.getByText('Up to 6,000 passages')).toBeInTheDocument();
  });

  it('handles sequential queued uploads with intermediate states', async () => {
    let uploadCount = 0;
    setupWorkspaceFetch({
      uploadHandler: async (file) => {
        uploadCount++;
        return json(makeDoc(`doc-${uploadCount}`, file.name, 'pdf'));
      },
    });
    await goToYourDocuments();

    const file1 = new File(['file 1'], 'first.pdf', { type: 'application/pdf' });
    const file2 = new File(['file 2'], 'second.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('workspace-file-input') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getAllByText('first.pdf').length).toBeGreaterThan(0);
      expect(screen.getAllByText('second.pdf').length).toBeGreaterThan(0);
    });
    expect(uploadCount).toBe(2);
  });

  it('maps API upload error codes to beginner-friendly messages', async () => {
    setupWorkspaceFetch({
      uploadHandler: () =>
        json(
          {
            error: {
              code: 'encrypted_pdf',
              message: 'Encrypted PDFs are not supported.',
            },
          },
          422
        ),
    });
    await goToYourDocuments();

    const file = new File(['encrypted'], 'locked.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('workspace-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(
      await screen.findByText('This PDF is password-protected or encrypted. Please provide an unencrypted PDF.')
    ).toBeInTheDocument();
  });

  it('removes an individual document when requested', async () => {
    const existingDoc = makeDoc('doc-remove-1', 'remove_me.pdf');
    setupWorkspaceFetch({
      initialStatus: {
        documents: [existingDoc],
        totals: { documents: 1, passages: 8 },
        seconds_until_expiry: 3600,
      },
    });
    setStoredWorkspaceToken('EXISTING_WORKSPACE_TOKEN_ABCDEFGHIJKLMN12');
    setStoredWorkspaceLimits(defaultLimits);

    await goToYourDocuments();
    expect(await screen.findByText('remove_me.pdf')).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: 'Remove remove_me.pdf' });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('remove_me.pdf')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/No documents uploaded yet/)).toBeInTheDocument();
  });

  it('deletes everything with confirmation step and focus management', async () => {
    const existingDoc = makeDoc('doc-delete-all', 'dataset.pdf');
    setupWorkspaceFetch({
      initialStatus: {
        documents: [existingDoc],
        totals: { documents: 1, passages: 8 },
        seconds_until_expiry: 3600,
      },
    });
    setStoredWorkspaceToken('EXISTING_WORKSPACE_TOKEN_ABCDEFGHIJKLMN12');
    setStoredWorkspaceLimits(defaultLimits);

    await goToYourDocuments();
    expect(await screen.findByText('dataset.pdf')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: 'Delete everything' });
    fireEvent.click(deleteBtn);

    // Confirmation dialog appears
    const confirmBtn = await screen.findByRole('button', { name: 'Yes, delete' });
    expect(confirmBtn).toHaveFocus();

    // Cancel first to test focus restoration
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(screen.getByRole('button', { name: 'Delete everything' })).toHaveFocus();

    // Click Delete again and confirm
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => {
      expect(screen.queryByText('dataset.pdf')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/No documents uploaded yet/)).toBeInTheDocument();
  });

  it('resets the view and notifies user on a 404 expired workspace error', async () => {
    setupWorkspaceFetch({
      initialStatus: {
        documents: [],
        totals: { documents: 0, passages: 0 },
        seconds_until_expiry: 0,
      },
    });
    // Set an expired token in storage
    setStoredWorkspaceToken('EXPIRED_WORKSPACE_TOKEN_1234567890123456');

    // Override fetch for /workspace to return 404
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/health')) return json(mockHealth);
        if (url.endsWith('/methods')) return json(mockMethods);
        if (url.endsWith('/workspace')) {
          return json({ error: { code: 'workspace_not_found', message: 'Workspace was not found.' } }, 404);
        }
        return json({});
      })
    );

    await goToYourDocuments();

    expect(
      await screen.findByText(/Your session expired after inactivity\. Upload files below to start a new private workspace\./i)
    ).toBeInTheDocument();
  });

  it('persists workspace in sessionStorage across page loads while search starts blank', async () => {
    const existingDoc = makeDoc('doc-persist-1', 'persisted.pdf');
    setupWorkspaceFetch({
      initialStatus: {
        documents: [existingDoc],
        totals: { documents: 1, passages: 8 },
        seconds_until_expiry: 3600,
      },
    });
    setStoredWorkspaceToken('EXISTING_WORKSPACE_TOKEN_ABCDEFGHIJKLMN12');
    setStoredWorkspaceLimits(defaultLimits);

    await goToYourDocuments();

    // Document is restored
    expect(await screen.findByText('persisted.pdf')).toBeInTheDocument();

    // Search input is clean and empty
    const searchInput = screen.getByPlaceholderText(/Enter a question or words/i);
    expect(searchInput).toHaveValue('');
    expect(screen.queryByText(/Results for:/)).not.toBeInTheDocument();
  });

  it('searches inside documents, highlights query words, and supports Show more/less toggle', async () => {
    const existingDoc = makeDoc('doc-search-1', 'ai_survey.pdf');
    const longPassage =
      'Deep neural architectures have revolutionized natural language processing and semantic understanding across diverse domains. ' +
      'By mapping documents and queries into high-dimensional vector representations, vector retrieval captures semantic similarity ' +
      'even when there is zero lexical overlap between the question and the target document. Furthermore, cross-encoders allow reranking ' +
      'at test time to improve precision and relevance scoring significantly.';

    setupWorkspaceFetch({
      initialStatus: {
        documents: [existingDoc],
        totals: { documents: 1, passages: 8 },
        seconds_until_expiry: 3600,
      },
      searchHandler: (query, method, k) =>
        json({
          query,
          method,
          k,
          took_ms: 18.2,
          results: [
            {
              rank: 1,
              score: 0.945,
              document_id: 'doc-search-1',
              document_name: 'ai_survey.pdf',
              page: 4,
              passage_index: 2,
              text: longPassage,
              snippet: longPassage.slice(0, 100),
            },
          ],
        }),
    });
    setStoredWorkspaceToken('EXISTING_WORKSPACE_TOKEN_ABCDEFGHIJKLMN12');
    setStoredWorkspaceLimits(defaultLimits);

    await goToYourDocuments();
    expect(await screen.findByText('ai_survey.pdf')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Enter a question or words/i);
    fireEvent.change(searchInput, { target: { value: 'neural semantic' } });

    const submitBtn = within(searchInput.closest('form')!).getByRole('button', { name: 'Search' });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/18\.2 ms/)).toBeInTheDocument();
    expect(screen.getByText('Score 0.945')).toBeInTheDocument();
    expect(screen.getByText('Page 4')).toBeInTheDocument();

    // Query highlighting check
    const highlightedNeural = screen.getAllByText('neural');
    expect(highlightedNeural[0]).toHaveClass('bg-amber-300/35');

    // Show more / Show less toggle
    const toggleBtn = screen.getByRole('button', { name: /Show more/i });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Show less/i })).toBeInTheDocument();
  });

  it('shows empty-workspace message when no documents exist', async () => {
    setupWorkspaceFetch();
    await goToYourDocuments();
    expect(screen.getByText('Upload at least one document first to search.')).toBeInTheDocument();
  });

  it('shows friendly callout when search results are empty with a message', async () => {
    const existingDoc = makeDoc('doc-bm25-empty', 'words.txt', 'txt', null);
    setupWorkspaceFetch({
      initialStatus: {
        documents: [existingDoc],
        totals: { documents: 1, passages: 4 },
        seconds_until_expiry: 3600,
      },
      searchHandler: (query, method, k) =>
        json({
          query,
          method,
          k,
          took_ms: 2.1,
          results: [],
          message: 'No passages contain these words. Try the meaning-based search.',
        }),
    });
    setStoredWorkspaceToken('EXISTING_WORKSPACE_TOKEN_ABCDEFGHIJKLMN12');
    setStoredWorkspaceLimits(defaultLimits);

    await goToYourDocuments();

    const searchInput = await screen.findByPlaceholderText(/Enter a question or words/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistentterm' } });
    fireEvent.submit(searchInput.closest('form')!);

    expect(
      await screen.findAllByText('No passages contain these words. Try the meaning-based search.')
    ).toHaveLength(2);
  });

  it('enforces the stale-response guard and ignores superseded search requests', async () => {
    type Resolver = (res: Response) => void;
    const pendingSearches: Array<{ query: string; resolve: Resolver }> = [];

    setupWorkspaceFetch({
      initialStatus: {
        documents: [makeDoc('doc-stale', 'stale.pdf')],
        totals: { documents: 1, passages: 2 },
        seconds_until_expiry: 3600,
      },
      searchHandler: (query) =>
        new Promise<Response>((resolve) => {
          pendingSearches.push({ query, resolve });
        }),
    });
    setStoredWorkspaceToken('EXISTING_WORKSPACE_TOKEN_ABCDEFGHIJKLMN12');
    setStoredWorkspaceLimits(defaultLimits);

    await goToYourDocuments();

    const searchInput = screen.getByPlaceholderText(/Enter a question or words/i);
    const form = searchInput.closest('form')!;

    // Search 1: "first"
    fireEvent.change(searchInput, { target: { value: 'first' } });
    fireEvent.submit(form);

    // Search 2: "second"
    fireEvent.change(searchInput, { target: { value: 'second' } });
    fireEvent.submit(form);

    await waitFor(() => expect(pendingSearches).toHaveLength(2));

    // Resolve search 2 first
    pendingSearches[1].resolve(
      new Response(
        JSON.stringify({
          query: 'second',
          method: 'semantic',
          k: 5,
          took_ms: 10,
          results: [
            {
              rank: 1,
              score: 0.9,
              document_id: 'doc-stale',
              document_name: 'stale.pdf',
              page: 1,
              passage_index: 0,
              text: 'Second search results here.',
              snippet: 'Second snippet',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    expect(await screen.findByText('Second')).toBeInTheDocument();
    expect(screen.getByText('search results here.', { exact: false })).toBeInTheDocument();

    // Resolve search 1 later — should be discarded
    pendingSearches[0].resolve(
      new Response(
        JSON.stringify({
          query: 'first',
          method: 'semantic',
          k: 5,
          took_ms: 10,
          results: [
            {
              rank: 1,
              score: 0.8,
              document_id: 'doc-stale',
              document_name: 'stale.pdf',
              page: 1,
              passage_index: 0,
              text: 'Old stale first results.',
              snippet: 'Old snippet',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await waitFor(() => {
      expect(screen.queryByText('Old stale first results.')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('sends the workspace token ONLY in the X-Workspace-Token header and NEVER in any URL', async () => {
    const token = 'SECRET_WORKSPACE_TOKEN_123456789012345678';
    setupWorkspaceFetch({
      createResponse: {
        workspace_id: token,
        ttl_minutes: 60,
        limits: defaultLimits,
      },
    });

    await goToYourDocuments();

    // Upload a file to trigger create and upload
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('workspace-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText('test.pdf')).toBeInTheDocument();

    // Perform a search
    const searchInput = screen.getByPlaceholderText(/Enter a question or words/i);
    fireEvent.change(searchInput, { target: { value: 'testing token' } });
    fireEvent.click(within(searchInput.closest('form')!).getByRole('button', { name: 'Search' }));
    await screen.findByText(/12\.5 ms/);

    // Delete document
    const removeBtn = screen.getByRole('button', { name: 'Remove test.pdf' });
    fireEvent.click(removeBtn);
    await screen.findByText(/No documents uploaded yet/);

    // Assert across EVERY fetch call:
    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url).not.toContain(token);
    }

    // Assert that workspace operations send the token in the header
    const workspaceCalls = requestedHeaders.filter((h) => h['X-Workspace-Token'] || h['x-workspace-token']);
    expect(workspaceCalls.length).toBeGreaterThan(0);
    for (const h of workspaceCalls) {
      const sentToken = h['X-Workspace-Token'] || h['x-workspace-token'];
      expect(sentToken).toBe(token);
    }
  });

  it('allows previewing an uploaded file on the same page by clicking the file name or preview icon', async () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost:3000/mock-pdf-blob');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    setupWorkspaceFetch();
    await goToYourDocuments();

    const file = new File(['%PDF-1.4 sample content'], 'my_notes.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('workspace-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText('my_notes.pdf')).toBeInTheDocument();

    // Click the file preview button
    const previewBtn = screen.getByRole('button', { name: 'Preview my_notes.pdf' });
    fireEvent.click(previewBtn);

    // Modal dialog opens on the same page
    const dialog = await screen.findByRole('dialog', { name: /Preview of my_notes\.pdf/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTitle('Preview of my_notes.pdf')).toBeInTheDocument();

    // Verify open in new tab and maximize/restore buttons
    const newTabLink = screen.getByRole('link', { name: 'Open in new tab' });
    expect(newTabLink).toHaveAttribute('href', 'blob:http://localhost:3000/mock-pdf-blob');
    expect(newTabLink).toHaveAttribute('target', '_blank');

    const fillScreenBtn = screen.getByRole('button', { name: 'Fill screen' });
    fireEvent.click(fillScreenBtn);
    expect(screen.getByRole('button', { name: 'Restore size' })).toBeInTheDocument();

    // Close preview via Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
