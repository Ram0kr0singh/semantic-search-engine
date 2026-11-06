export type SearchMode = 'compare' | 'search'
export type UrlState = { query:string; mode:SearchMode; model:string; k:5|10|20 }
export function parseUrlState(search: string): UrlState { const params = new URLSearchParams(search); const rawK = Number(params.get('k')); return { query:params.get('q') ?? '', mode:params.get('mode') === 'search' ? 'search' : 'compare', model:params.get('model') ?? 'sbert-mpnet', k: rawK === 10 || rawK === 20 ? rawK : 5 } }
export function writeUrlState(state: UrlState) { const params = new URLSearchParams({ q:state.query, mode:state.mode, model:state.model, k:String(state.k) }); history.pushState(null, '', `${location.pathname}?${params}`) }
