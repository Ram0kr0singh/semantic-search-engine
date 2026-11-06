export type SearchMode = 'compare' | 'search';

export type ResultCount = 5 | 10 | 20;

export interface UrlState {
  query: string;
  mode: SearchMode;
  model: string;
  k: ResultCount;
}

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const rawQuery = params.get('q') ?? '';
  const rawMode = params.get('mode');
  const rawModel = params.get('model');
  const rawK = Number(params.get('k'));

  const mode: SearchMode = rawMode === 'search' ? 'search' : 'compare';
  const model = rawModel && rawModel.trim() ? rawModel.trim() : 'sbert-mpnet';
  const k: ResultCount = rawK === 10 || rawK === 20 ? rawK : 5;

  return {
    query: rawQuery,
    mode,
    model,
    k,
  };
}

export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) {
    params.set('q', state.query.trim());
  }
  params.set('mode', state.mode);
  params.set('model', state.model);
  params.set('k', String(state.k));
  return params.toString();
}

export function writeUrlState(state: UrlState, replace = false): void {
  const queryStr = serializeUrlState(state);
  const newUrl = `${window.location.pathname}${queryStr ? `?${queryStr}` : ''}`;
  if (replace) {
    window.history.replaceState(null, '', newUrl);
  } else {
    window.history.pushState(null, '', newUrl);
  }
}
