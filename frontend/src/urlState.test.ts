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
      k: 5,
    });
  });

  it('parses explicit query parameters correctly', () => {
    const parsed = parseUrlState('?q=neural+networks&mode=search&model=sbert-minilm&k=20');
    expect(parsed).toEqual({
      query: 'neural networks',
      mode: 'search',
      model: 'sbert-minilm',
      k: 20,
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

  it('serializes state to query string correctly', () => {
    const state: UrlState = {
      query: 'BERT attention',
      mode: 'compare',
      model: 'sbert-mpnet',
      k: 10,
    };
    const serialized = serializeUrlState(state);
    expect(serialized).toContain('q=BERT+attention');
    expect(serialized).toContain('mode=compare');
    expect(serialized).toContain('model=sbert-mpnet');
    expect(serialized).toContain('k=10');
  });

  it('omits query from serialized string if empty', () => {
    const state: UrlState = {
      query: '   ',
      mode: 'search',
      model: 'tfidf',
      k: 5,
    };
    const serialized = serializeUrlState(state);
    expect(serialized).not.toContain('q=');
    expect(serialized).toBe('mode=search&model=tfidf&k=5');
  });

  it('writes URL state to browser history', () => {
    const state: UrlState = {
      query: 'robot demonstration',
      mode: 'compare',
      model: 'sbert-minilm',
      k: 5,
    };
    writeUrlState(state, true);
    expect(window.location.search).toContain('q=robot+demonstration');
    expect(window.location.search).toContain('model=sbert-minilm');
  });
});
