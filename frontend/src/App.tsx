import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api, type DocumentRecord, type Health, type Method, type SearchResponse } from './api';
import { Header } from './components/Header';
import { OfflineView } from './components/OfflineView';
import { ResultColumn } from './components/ResultColumn';
import { SearchControls } from './components/SearchControls';
import { EvaluationView } from './components/EvaluationView';
import { parseUrlState, writeUrlState, type AppView, type ResultCount, type SearchMode } from './urlState';

interface SubmittedSearch { query: string; mode: SearchMode; model: string; k: ResultCount; }
function formatErrorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
}

export default function App() {
  const initial = parseUrlState(window.location.search);
  const [query, setQueryState] = useState(initial.query);
  const [mode, setModeState] = useState<SearchMode>(initial.mode);
  const [model, setModelState] = useState(initial.model);
  const [k, setKState] = useState<ResultCount>(initial.k);
  const [view, setViewState] = useState<AppView>(initial.view ?? initial.mode);
  const [health, setHealth] = useState<Health | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedSearch | null>(null);
  const [responses, setResponses] = useState<Record<string, SearchResponse | null>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const documentCache = useRef(new Map<string, DocumentRecord>());
  const searchId = useRef(0);

  const getDocument = useCallback(async (id: string) => {
    const cached = documentCache.current.get(id);
    if (cached) return cached;
    const document = await api.document(id); documentCache.current.set(id, document); return document;
  }, []);

  const executeSearch = useCallback(async (nextQuery: string, nextMode: SearchMode, nextModel: string, nextK: ResultCount, history: 'push' | 'replace' | 'none' = 'push') => {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    const state = { query: trimmed, mode: nextMode, model: nextModel, k: nextK, view: nextMode };
    if (history !== 'none') writeUrlState(state, history === 'replace');
    const id = ++searchId.current;
    const ids = nextMode === 'compare' ? ['tfidf', nextModel] : [nextModel];
    const controller = api.beginSearch();
    setSubmitted(state); setResponses({}); setErrors({}); setLoading(Object.fromEntries(ids.map((method) => [method, true])));
    await Promise.all(ids.map(async (method) => {
      try {
        const result = await api.search({ query: trimmed, method, k: nextK }, controller);
        if (id === searchId.current) setResponses((previous) => ({ ...previous, [method]: result }));
      } catch (cause) {
        if (!controller.signal.aborted && id === searchId.current) {
          setErrors((previous) => ({ ...previous, [method]: formatErrorMessage(cause) }));
          setResponses((previous) => ({ ...previous, [method]: null }));
        }
      } finally { if (id === searchId.current) setLoading((previous) => ({ ...previous, [method]: false })); }
    }));
  }, []);

  const replaceUrl = useCallback((changes: Partial<SubmittedSearch>) => writeUrlState({ query, mode, model, k, view, ...changes }, true), [query, mode, model, k, view]);
  const setQuery = useCallback((value: string) => { setQueryState(value); replaceUrl({ query: value }); }, [replaceUrl]);
  const setModel = useCallback((value: string) => { setModelState(value); replaceUrl({ model: value }); }, [replaceUrl]);
  const setK = useCallback((value: ResultCount) => { setKState(value); replaceUrl({ k: value }); }, [replaceUrl]);
  const handleSubmit = useCallback((event?: FormEvent, forcedQuery?: string) => { event?.preventDefault(); void executeSearch(forcedQuery ?? query, mode, model, k); }, [executeSearch, query, mode, model, k]);
  const handleModeChange = useCallback((nextMode: SearchMode, nextModel: string) => {
    setModeState(nextMode); setModelState(nextModel);
    if (query.trim()) void executeSearch(query, nextMode, nextModel, k, 'replace');
    else writeUrlState({ query, mode: nextMode, model: nextModel, k, view: nextMode }, true);
  }, [executeSearch, query, k]);
  const handleViewChange = useCallback((nextView: AppView) => {
    setViewState(nextView);
    if (nextView !== 'eval') setModeState(nextView);
    writeUrlState({ query, mode: nextView === 'search' ? 'search' : 'compare', model, k, view: nextView }, true);
  }, [query, model, k]);
  const retryConnection = useCallback(async () => {
    try { const [nextHealth, nextMethods] = await Promise.all([api.health(), api.methods()]); setHealth(nextHealth); setMethods(nextMethods); setUnreachable(false); }
    catch { setUnreachable(true); }
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const [nextHealth, nextMethods] = await Promise.all([api.health(), api.methods()]);
        if (ignore) return;
        setHealth(nextHealth); setMethods(nextMethods); setUnreachable(false);
        const url = parseUrlState(window.location.search);
        if (url.query.trim() && url.view !== 'eval') void executeSearch(url.query, url.mode, url.model, url.k, 'none');
      } catch { if (!ignore) setUnreachable(true); }
    })();
    return () => { ignore = true; };
  }, [executeSearch]);
  useEffect(() => {
    const onPopState = () => {
      const url = parseUrlState(window.location.search);
      setQueryState(url.query); setModeState(url.mode); setModelState(url.model); setKState(url.k); setViewState(url.view ?? url.mode);
      if (url.query.trim() && url.view !== 'eval') void executeSearch(url.query, url.mode, url.model, url.k, 'none');
      else { ++searchId.current; api.beginSearch(); setSubmitted(null); setResponses({}); setErrors({}); setLoading({}); }
    };
    window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState);
  }, [executeSearch]);

  if (unreachable) return <OfflineView onRetry={() => void retryConnection()} />;
  const displayed = submitted; const displayedMode = displayed?.mode ?? mode; const displayedModel = displayed?.model ?? model;
  const tfidf = responses.tfidf ?? null; const sbert = responses[displayedModel] ?? null;
  const isAnyLoading = Object.values(loading).some(Boolean);
  const hasSharedPaper = !!tfidf && !!sbert && tfidf.results.some((item) => sbert.results.some((other) => other.id === item.id));
  const settingsChanged = !!displayed && (displayed.model !== model || displayed.k !== k);
  const sbertName = methods.find((method) => method.id === displayedModel)?.display_name ?? 'Sentence-BERT';
  return <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
    <Header health={health} view={view} onViewChange={handleViewChange} />
    {view === 'eval' ? <EvaluationView /> : <><SearchControls query={query} setQuery={setQuery} mode={mode} onModeChange={handleModeChange} model={model} setModel={setModel} k={k} setK={setK} methods={methods} isSearching={isAnyLoading} settingsChanged={settingsChanged} onSubmit={handleSubmit} />
    {displayedMode === 'compare' && <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs sm:text-sm text-amber-900 leading-relaxed"><span className="font-semibold text-amber-950">Note on scores: </span>Scores are not comparable across methods. TF-IDF uses sparse term frequencies, while Sentence-BERT measures dense cosine embedding similarity.</div>}
    <div className="sr-only" aria-live="polite" role="status">{isAnyLoading ? 'Searching arXiv papers...' : displayed ? 'Search results updated.' : ''}</div>
    {displayed && <p className="text-xs text-slate-500">Results for: <span className="font-medium text-slate-700">{displayed.query}</span></p>}
    {displayedMode === 'compare' ? <><div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <ResultColumn title="TF-IDF" response={tfidf} error={errors.tfidf ?? null} loading={!!loading.tfidf} other={sbert} showOnlyHere={hasSharedPaper} getDocument={getDocument} />
      <ResultColumn title={sbertName} response={sbert} error={errors[displayedModel] ?? null} loading={!!loading[displayedModel]} other={tfidf} showOnlyHere={hasSharedPaper} getDocument={getDocument} />
    </div>{tfidf && sbert && !hasSharedPaper && <p className="text-center text-sm text-slate-500" role="status">No papers appear in both lists.</p>}</> : <div>
      <ResultColumn title={methods.find((method) => method.id === displayedModel)?.display_name ?? 'Search Results'} response={responses[displayedModel] ?? null} error={errors[displayedModel] ?? null} loading={!!loading[displayedModel]} other={null} showOnlyHere={false} getDocument={getDocument} />
    </div>}</>}
  </main>;
}
