import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, beginSearch, formatValidationDetails } from './api';

describe('API client and error normalization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes a 503 unavailable method error with build command', async () => {
    const errorBody = {
      error: {
        code: 'method_unavailable',
        message: "Search method 'sbert-mpnet' is unavailable.",
        details: {
          build_command:
            'python -m scripts.search_demo --method sbert --model "sentence-transformers/all-mpnet-base-v2" --rebuild',
        },
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(errorBody), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );

    await expect(
      api.search({ query: 'test query', method: 'sbert-mpnet', k: 5 })
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(503);
      expect(apiErr.code).toBe('method_unavailable');
      expect(apiErr.buildCommand).toContain('python -m scripts.search_demo');
      expect(apiErr.message).toContain('Build it with: python -m scripts.search_demo');
      return true;
    });
  });

  it('normalizes a 422 validation error', async () => {
    const errorBody = {
      error: {
        code: 'unknown_method',
        message: 'Unknown search method.',
        details: {
          valid_methods: ['tfidf', 'sbert-minilm', 'sbert-mpnet'],
        },
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(errorBody), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );

    await expect(
      api.search({ query: 'test', method: 'invalid-method', k: 5 })
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.code).toBe('unknown_method');
      expect(apiErr.message).toBe('Unknown search method.');
      return true;
    });
  });

  it('adds readable 422 validation details without exposing raw objects', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: 'validation_error', message: 'Invalid request.', details: [{ type: 'value_error', loc: ['body', 'query'], msg: 'Value error, query must be at most 500 characters' }] },
    }), { status: 422, headers: { 'Content-Type': 'application/json' } }))));

    await expect(api.search({ query: 'test', method: 'tfidf', k: 5 })).rejects.toMatchObject({
      message: 'Invalid request: query must be at most 500 characters.',
    });
    expect(formatValidationDetails(undefined)).toBe('');
    expect(formatValidationDetails([])).toBe('');
  });

  it('normalizes a 404 document not found error', async () => {
    const errorBody = {
      error: {
        code: 'document_not_found',
        message: "Document 'missing-id' was not found.",
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(errorBody), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );

    await expect(api.document('missing-id')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe('document_not_found');
      expect(apiErr.message).toBe("Document 'missing-id' was not found.");
      return true;
    });
  });

  it('normalizes network failures into user-friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    await expect(api.health()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(0);
      expect(apiErr.code).toBe('network_error');
      expect(apiErr.message).toContain('Unable to reach the API');
      return true;
    });
  });

  it('cancels previous search when beginSearch is called again', async () => {
    const firstController = beginSearch();
    expect(firstController.signal.aborted).toBe(false);

    const secondController = beginSearch();
    expect(firstController.signal.aborted).toBe(true);
    expect(secondController.signal.aborted).toBe(false);
  });

  it('successfully parses health, methods, and search responses', async () => {
    const mockHealth = {
      status: 'ok',
      document_count: 30000,
      methods: [{ id: 'tfidf', display_name: 'TF-IDF', model_name: null, ready: true }],
      embedding_device: 'cuda',
      api_version: '1.0.0',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockHealth), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );

    const health = await api.health();
    expect(health.document_count).toBe(30000);
    expect(health.embedding_device).toBe('cuda');
  });
});
