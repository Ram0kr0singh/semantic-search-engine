import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ApiError,
  api,
  type DocumentRecord,
  type Health,
  type Method,
  type SearchResponse,
} from './api';
import { Header } from './components/Header';
import { OfflineView } from './components/OfflineView';
import { ResultColumn } from './components/ResultColumn';
import { SearchControls } from './components/SearchControls';
import { EvaluationView } from './components/EvaluationView';
import {
  writeUrlState,
  type AppView,
  type ResultCount,
  type SearchMode,
} from './urlState';
import { useTheme } from './theme';

interface SubmittedSearch {
  query: string;
  mode: SearchMode;
  model: string;
  left: string;
  k: ResultCount;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'An unexpected error occurred. Please try again.';
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Always begin with a blank search. This also prevents an old query in a
  // bookmarked or refreshed URL from unexpectedly being submitted again.
  const [query, setQueryState] = useState('');
  const [mode, setModeState] = useState<SearchMode>('search');
  const [model, setModelState] = useState('sbert-mpnet');
  const [left, setLeftState] = useState('tfidf');
  const [k, setKState] = useState<ResultCount>(5);
  const [view, setViewState] = useState<AppView>('search');
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
    const document = await api.document(id);
    documentCache.current.set(id, document);
    return document;
  }, []);

  const executeSearch = useCallback(
    async (
      nextQuery: string,
      nextMode: SearchMode,
      nextModel: string,
      nextLeft: string,
      nextK: ResultCount,
      history: 'push' | 'replace' | 'none' = 'push'
    ) => {
      const trimmed = nextQuery.trim();
      if (!trimmed) return;
      if (nextMode === 'compare' && nextLeft === nextModel) return;

      const state = {
        query: trimmed,
        mode: nextMode,
        model: nextModel,
        left: nextLeft,
        k: nextK,
        view: nextMode,
      };
      if (history !== 'none') writeUrlState(state, history === 'replace');

      const id = ++searchId.current;
      const ids = nextMode === 'compare' ? [nextLeft, nextModel] : [nextModel];
      const controller = api.beginSearch();

      setSubmitted(state);
      setResponses({});
      setErrors({});
      setLoading(Object.fromEntries(ids.map((method) => [method, true])));

      await Promise.all(
        ids.map(async (method) => {
          try {
            const result = await api.search(
              { query: trimmed, method, k: nextK },
              controller
            );
            if (id === searchId.current) {
              setResponses((previous) => ({ ...previous, [method]: result }));
            }
          } catch (cause) {
            if (!controller.signal.aborted && id === searchId.current) {
              setErrors((previous) => ({
                ...previous,
                [method]: formatErrorMessage(cause),
              }));
              setResponses((previous) => ({ ...previous, [method]: null }));
            }
          } finally {
            if (id === searchId.current) {
              setLoading((previous) => ({ ...previous, [method]: false }));
            }
          }
        })
      );
    },
    []
  );

  const replaceUrl = useCallback(
    (changes: Partial<SubmittedSearch>) =>
      writeUrlState(
        { query, mode, model, left, k, view, ...changes },
        true
      ),
    [query, mode, model, left, k, view]
  );

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      replaceUrl({ query: value });
    },
    [replaceUrl]
  );

  const setModel = useCallback(
    (value: string) => {
      setModelState(value);
      replaceUrl({ model: value });
    },
    [replaceUrl]
  );

  const setLeft = useCallback(
    (value: string) => {
      setLeftState(value);
      replaceUrl({ left: value });
    },
    [replaceUrl]
  );

  const setK = useCallback(
    (value: ResultCount) => {
      setKState(value);
      replaceUrl({ k: value });
    },
    [replaceUrl]
  );

  const handleSubmit = useCallback(
    (event?: FormEvent, forcedQuery?: string) => {
      event?.preventDefault();
      void executeSearch(forcedQuery ?? query, mode, model, left, k);
    },
    [executeSearch, query, mode, model, left, k]
  );

  const handleModeChange = useCallback(
    (nextMode: SearchMode, nextModel: string) => {
      setModeState(nextMode);
      setModelState(nextModel);
      if (query.trim()) {
        void executeSearch(query, nextMode, nextModel, left, k, 'replace');
      } else {
        writeUrlState(
          {
            query,
            mode: nextMode,
            model: nextModel,
            left,
            k,
            view: nextMode,
          },
          true
        );
      }
    },
    [executeSearch, query, left, k]
  );

  const handleViewChange = useCallback(
    (nextView: AppView) => {
      setViewState(nextView);
      if (nextView !== 'eval') setModeState(nextView);
      writeUrlState(
        {
          query,
          mode: nextView === 'search' ? 'search' : 'compare',
          model,
          left,
          k,
          view: nextView,
        },
        true
      );
    },
    [query, model, left, k]
  );

  const retryConnection = useCallback(async () => {
    try {
      const [nextHealth, nextMethods] = await Promise.all([
        api.health(),
        api.methods(),
      ]);
      setHealth(nextHealth);
      setMethods(nextMethods);
      setUnreachable(false);
    } catch {
      setUnreachable(true);
    }
  }, []);

  const goHome = useCallback(() => {
    ++searchId.current;
    api.beginSearch();
    setQueryState('');
    setModeState('search');
    setModelState('sbert-mpnet');
    setLeftState('tfidf');
    setKState(5);
    setViewState('search');
    setSubmitted(null);
    setResponses({});
    setErrors({});
    setLoading({});
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const [nextHealth, nextMethods] = await Promise.all([
          api.health(),
          api.methods(),
        ]);
        if (ignore) return;
        setHealth(nextHealth);
        setMethods(nextMethods);
        setUnreachable(false);
        // Remove legacy search parameters once the page has loaded. Search
        // fields deliberately reset on refresh or a fresh visit.
        if (window.location.search) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch {
        if (!ignore) setUnreachable(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      goHome();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [goHome]);

  if (unreachable) {
    return <OfflineView onRetry={() => void retryConnection()} />;
  }

  const displayed = submitted;
  const displayedMode = displayed?.mode ?? mode;
  const displayedModel = displayed?.model ?? model;
  const displayedLeft = displayed?.left ?? left;
  const leftResponse = responses[displayedLeft] ?? null;
  const rightResponse = responses[displayedModel] ?? null;
  const isAnyLoading = Object.values(loading).some(Boolean);
  const hasSharedPaper =
    !!leftResponse &&
    !!rightResponse &&
    leftResponse.results.some((item) =>
      rightResponse.results.some((other) => other.id === item.id)
    );
  const settingsChanged =
    !!displayed &&
    (displayed.model !== model || displayed.left !== left || displayed.k !== k);
  const leftMethod = methods.find((method) => method.id === displayedLeft);
  const rightMethod = methods.find((method) => method.id === displayedModel);

  return (
    <div className="relative min-h-screen bg-[var(--canvas)] text-[var(--text)] overflow-x-hidden selection:bg-blue-500/30">
      {/* Abstract Glowing Gradient Shape Behind Hero & Window */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[560px] overflow-hidden -z-10"
        aria-hidden="true"
      >
        <div
          className="w-full h-full opacity-60 dark:opacity-80 transition-opacity duration-300"
          style={{
            background: `
              radial-gradient(circle at 50% 18%, var(--glow-1) 0%, transparent 60%),
              radial-gradient(circle at 20% 45%, var(--glow-2) 0%, transparent 50%),
              radial-gradient(circle at 80% 45%, var(--glow-3) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        <Header
          health={health}
          view={view}
          onViewChange={handleViewChange}
          onHome={goHome}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {view === 'eval' ? (
          <EvaluationView />
        ) : (
          <SearchControls
            query={query}
            setQuery={setQuery}
            mode={mode}
            onModeChange={handleModeChange}
            model={model}
            setModel={setModel}
            left={left}
            setLeft={setLeft}
            k={k}
            setK={setK}
            methods={methods}
            isSearching={isAnyLoading}
            settingsChanged={settingsChanged}
            onSubmit={handleSubmit}
            health={health}
          >
            {/* Note on scores */}
            {displayedMode === 'compare' && (
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs sm:text-sm text-[var(--text)] leading-relaxed shadow-xs">
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  Note on scores:{' '}
                </span>
                Scores are not comparable across methods, including fused RRF and
                cross-encoder scores.
              </div>
            )}

            {/* Screen Reader Announcement */}
            <div className="sr-only" aria-live="polite" role="status">
              {isAnyLoading
                ? 'Searching arXiv papers...'
                : displayed
                  ? 'Search results updated.'
                  : ''}
            </div>

            {/* Query Summary */}
            {displayed && (
              <p className="text-xs text-[var(--text-muted)]">
                Results for:{' '}
                <span className="font-semibold text-[var(--text)]">
                  {displayed.query}
                </span>
              </p>
            )}

            {/* Results Grid */}
            {displayedMode === 'compare' ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
                  <ResultColumn
                    title={leftMethod?.display_name ?? displayedLeft}
                    method={leftMethod}
                    response={leftResponse}
                    error={errors[displayedLeft] ?? null}
                    loading={!!loading[displayedLeft]}
                    other={rightResponse}
                    showOnlyHere={hasSharedPaper}
                    getDocument={getDocument}
                  />
                  <ResultColumn
                    title={rightMethod?.display_name ?? displayedModel}
                    method={rightMethod}
                    response={rightResponse}
                    error={errors[displayedModel] ?? null}
                    loading={!!loading[displayedModel]}
                    other={leftResponse}
                    showOnlyHere={hasSharedPaper}
                    getDocument={getDocument}
                  />
                </div>
                {leftResponse && rightResponse && !hasSharedPaper && (
                  <p
                    className="text-center text-sm text-[var(--text-muted)] py-2"
                    role="status"
                  >
                    No papers appear in both lists.
                  </p>
                )}
              </>
            ) : (
              <div>
                <ResultColumn
                  title={rightMethod?.display_name ?? 'Search Results'}
                  method={rightMethod}
                  response={responses[displayedModel] ?? null}
                  error={errors[displayedModel] ?? null}
                  loading={!!loading[displayedModel]}
                  other={null}
                  showOnlyHere={false}
                  getDocument={getDocument}
                />
              </div>
            )}
          </SearchControls>
        )}
      </main>
    </div>
  );
}
