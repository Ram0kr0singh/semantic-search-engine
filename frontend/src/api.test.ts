import { describe, expect, it, vi } from 'vitest'
import { api } from './api'
describe('API client', () => { it('normalizes a 503 build command', async () => { vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: { code: 'method_unavailable', message: 'Unavailable', details: { build_command: 'python build.py' } } }), { status: 503 })))); await expect(api.search({ query: 'test', method: 'tfidf', k: 5 }, api.beginSearch())).rejects.toMatchObject({ status: 503, message: 'Unavailable Build it with: python build.py' }) }) })
