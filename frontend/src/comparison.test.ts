import { describe, expect, it } from 'vitest';
import { onlyHereIds } from './comparison';
import type { SearchResponse } from './api';

function makeResponse(method: string, ids: string[]): SearchResponse {
  return {
    query: 'test query',
    method,
    k: ids.length,
    took_ms: 12.5,
    results: ids.map((id, index) => ({
      rank: index + 1,
      score: 0.8 - index * 0.1,
      id,
      title: `Paper ${id}`,
      snippet: `Abstract snippet for ${id}`,
      categories: ['cs.AI'],
      year: 2024,
    })),
  };
}

describe('onlyHereIds pure function', () => {
  it('returns empty Set when either column response is null or undefined', () => {
    const resA = makeResponse('tfidf', ['doc1', 'doc2']);
    expect(onlyHereIds(null, null)).toEqual(new Set());
    expect(onlyHereIds(resA, null)).toEqual(new Set());
    expect(onlyHereIds(null, resA)).toEqual(new Set());
    expect(onlyHereIds(undefined, undefined)).toEqual(new Set());
  });

  it('returns empty Set when both result lists are identical', () => {
    const resA = makeResponse('tfidf', ['doc1', 'doc2', 'doc3']);
    const resB = makeResponse('sbert-mpnet', ['doc1', 'doc2', 'doc3']);
    expect(onlyHereIds(resA, resB)).toEqual(new Set());
    expect(onlyHereIds(resB, resA)).toEqual(new Set());
  });

  it('identifies items unique to the current column when results partially overlap', () => {
    const resA = makeResponse('tfidf', ['doc1', 'doc2', 'doc3']);
    const resB = makeResponse('sbert-mpnet', ['doc2', 'doc3', 'doc4']);

    expect(onlyHereIds(resA, resB)).toEqual(new Set(['doc1']));
    expect(onlyHereIds(resB, resA)).toEqual(new Set(['doc4']));
  });

  it('marks all items when results are completely disjoint', () => {
    const resA = makeResponse('tfidf', ['doc1', 'doc2']);
    const resB = makeResponse('sbert-mpnet', ['doc3', 'doc4']);

    expect(onlyHereIds(resA, resB)).toEqual(new Set(['doc1', 'doc2']));
    expect(onlyHereIds(resB, resA)).toEqual(new Set(['doc3', 'doc4']));
  });

  it('handles empty results lists without throwing', () => {
    const emptyA = makeResponse('tfidf', []);
    const resB = makeResponse('sbert-mpnet', ['doc1']);

    expect(onlyHereIds(emptyA, resB)).toEqual(new Set());
    expect(onlyHereIds(resB, emptyA)).toEqual(new Set(['doc1']));
  });
});
