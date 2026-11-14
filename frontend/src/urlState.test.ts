import { describe, expect, it } from 'vitest';
import { writeUrlState } from './urlState';

describe('URL state management', () => {
  it('cleans query parameters from browser history', () => {
    window.history.replaceState(null, '', '/?q=previous-search&mode=compare');
    writeUrlState(true);
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');
  });
});
