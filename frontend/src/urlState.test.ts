import { describe, expect, it } from 'vitest';
import {
  parseUrlState,
  serializeUrlState,
  writeUrlState,
  type UrlState,
} from './urlState';

describe('URL state management', () => {
  it('parses safe defaults when query string is empty', () => {
    const parsed = parseUrlState('');
    expect(parsed).toEqual({
      query: '',
      mode: 'compare',
      model: 'sbert-mpnet',
      left: 'tfidf',
      k: 5,
      view: 'compare',
    });
  });

  it('parses explicit query parameters correctly', () => {
    const parsed = parseUrlState('?q=neural+networks&mode=search&model=sbert-minilm&left=bm25&k=20');
    expect(parsed).toEqual({
      query: 'neural networks',
      mode: 'search',
      model: 'sbert-minilm',
      left: 'bm25',
      k: 20,
      view: 'search',
    });
  });

  it('falls back to k=5 when k is invalid or not in allowed set (5, 10, 20)', () => {
    expect(parseUrlState('?k=50').k).toBe(5);
    expect(parseUrlState('?k=0').k).toBe(5);
    expect(parseUrlState('?k=invalid').k).toBe(5);
  });

  it('falls back to mode=compare when mode is invalid', () => {
    expect(parseUrlState('?mode=invalid').mode).toBe('compare');
    expect(parseUrlState('?mode=other').mode).toBe('compare');
  });

  it('parses the Evaluation view from the URL', () => {
    expect(parseUrlState('?view=eval').view).toBe('eval');
  });

  it('serializes state to query string correctly', () => {
    const state: UrlState = {
      query: 'BERT attention',
      mode: 'compare',
      model: 'sbert-mpnet',
      left: 'tfidf',
      k: 10,
    };
    const serialized = serializeUrlState(state);
    expect(serialized).toContain('q=BERT+attention');
    expect(serialized).toContain('mode=compare');
    expect(serialized).toContain('model=sbert-mpnet');
    expect(serialized).toContain('left=tfidf');
    expect(serialized).toContain('k=10');
  });

  it('omits query from serialized string if empty', () => {
    const state: UrlState = {
      query: '   ',
      mode: 'search',
      model: 'tfidf',
      left: 'bm25',
      k: 5,
    };
    const serialized = serializeUrlState(state);
    expect(serialized).not.toContain('q=');
    expect(serialized).toBe('mode=search&model=tfidf&left=bm25&k=5');
  });

  it('writes URL state to browser history', () => {
    const state: UrlState = {
      query: 'robot demonstration',
      mode: 'compare',
      model: 'sbert-minilm',
      left: 'tfidf',
      k: 5,
    };
    writeUrlState(state, true);
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');
  });

  it('preserves the left parameter across a round trip', () => {
    const initialQuery = '?q=transformers&mode=compare&model=hybrid-mpnet&left=bm25&k=10';
    const parsed = parseUrlState(initialQuery);
    expect(parsed.left).toBe('bm25');
    expect(parsed.model).toBe('hybrid-mpnet');
    const serialized = serializeUrlState(parsed);
    const roundTripped = parseUrlState(`?${serialized}`);
    expect(roundTripped.left).toBe('bm25');
    expect(roundTripped.model).toBe('hybrid-mpnet');
    expect(roundTripped.query).toBe('transformers');
    expect(roundTripped.k).toBe(10);
  });

  it('handles legacy links that only carry model by falling back left to tfidf', () => {
    const legacyUrl = '?q=BERT&mode=compare&model=sbert-minilm&k=5';
    const parsed = parseUrlState(legacyUrl);
    expect(parsed.left).toBe('tfidf');
    expect(parsed.model).toBe('sbert-minilm');
    expect(parsed.mode).toBe('compare');
  });

  it('falls back unknown left or model parameter values to defaults', () => {
    const parsed = parseUrlState('?left=unknown-method&model=invalid-model');
    expect(parsed.left).toBe('tfidf');
    expect(parsed.model).toBe('sbert-mpnet');
  });
});
