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
import {
  parseUrlState,
  writeUrlState,
  type ResultCount,
  type SearchMode,
} from './urlState';

function formatErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

export default function App() {
  const [query, setQuery] = useState(() => parseUrlState(window.location.search).query);
  const [mode, setMode] = useState<SearchMode>(() => parseUrlState(window.location.search).mode);
  const [model, setModel] = useState(() => parseUrlState(window.location.search).model);
  const [k, setK] = useState<ResultCount>(() => parseUrlState(window.location.search).k);

  const [health, setHealth] = useState<Health | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [unreachable, setUnreachable] = useState(false);

  const [responses, setResponses] = useState<Record<string, SearchResponse | null>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const documentCache = useRef(new Map<string, DocumentRecord>());

  const getDocument = useCallback(async (id: string): Promise<DocumentRecord> => {
    const cached = documentCache.current.get(id);
    if (cached) return cached;
    const doc = await api.document(id);
    documentCache.current.set(id, doc);
    return doc;
  }, []);

  const executeSearch = useCallback(
    async (
      searchQuery: string,
      searchMode: SearchMode,
      activeModel: string,
      limit: ResultCount
    ) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      writeUrlState({
        query: trimmed,
        mode: searchMode,
        model: activeModel,
        k: limit,
      });

      const methodIds = searchMode === 'compare' ? ['tfidf', activeModel] : [activeModel];
      const controller = api.beginSearch();

      setLoading((prev) => ({
        ...prev,
        ...Object.fromEntries(methodIds.map((id) => [id, true])),
      }));
      setErrors((prev) => ({
        ...prev,
        ...Object.fromEntries(methodIds.map((id) => [id, null])),
      }));

      await Promise.all(
        methodIds.map(async (id) => {
          try {
            const result = await api.search(
              { query: trimmed, method: id, k: limit },
              controller
            );
            setResponses((prev) => ({ ...prev, [id]: result }));
          } catch (cause) {
            if (controller.signal.aborted) {
              return;
            }
            setErrors((prev) => ({ ...prev, [id]: formatErrorMessage(cause) }));
            setResponses((prev) => ({ ...prev, [id]: null }));
          } finally {
            setLoading((prev) => ({ ...prev, [id]: false }));
          }
        })
      );
    },
    []
  );

  const handleSubmit = useCallback(
    (event?: FormEvent, forcedQuery?: string) => {
      event?.preventDefault();
      const targetQuery = forcedQuery !== undefined ? forcedQuery : query;
      void executeSearch(targetQuery, mode, model, k);
    },
    [executeSearch, query, mode, model, k]
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

  useEffect(() => {
    let ignore = false;

    async function initialize() {
      try {
        const [nextHealth, nextMethods] = await Promise.all([
          api.health(),
          api.methods(),
        ]);
        if (ignore) return;

        setHealth(nextHealth);
        setMethods(nextMethods);
        setUnreachable(false);

        const currentUrl = parseUrlState(window.location.search);
        let activeModel = currentUrl.model;
        const isTargetReady = nextMethods.find((m) => m.id === activeModel && m.ready);
        if (!isTargetReady) {
          activeModel =
            nextMethods.find((m) => m.id === 'sbert-mpnet' && m.ready)?.id ??
            nextMethods.find((m) => m.id.startsWith('sbert-') && m.ready)?.id ??
            'sbert-mpnet';
          setModel(activeModel);
        }

        if (currentUrl.query.trim()) {
          void executeSearch(
            currentUrl.query.trim(),
            currentUrl.mode,
            activeModel,
            currentUrl.k
          );
        }
      } catch {
        if (!ignore) {
          setUnreachable(true);
        }
      }
    }

    void initialize();

    return () => {
      ignore = true;
    };
  }, [executeSearch]);

  if (unreachable) {
    return <OfflineView onRetry={() => void retryConnection()} />;
  }

  const sbertDisplayName =
    methods.find((m) => m.id === model)?.display_name ?? 'Sentence-BERT';

  const isAnyLoading = Object.values(loading).some(Boolean);

  const tfidfResponse = responses['tfidf'] ?? null;
  const sbertResponse = responses[model] ?? null;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <Header health={health} />

      <SearchControls
        query={query}
        setQuery={setQuery}
        mode={mode}
        setMode={setMode}
        model={model}
        setModel={setModel}
        k={k}
        setK={setK}
        methods={methods}
        isSearching={isAnyLoading}
        onSubmit={handleSubmit}
      />

      {mode === 'compare' && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs sm:text-sm text-amber-900 leading-relaxed">
          <span className="font-semibold text-amber-950">Note on scores: </span>
          Scores are not comparable across methods. TF-IDF uses sparse term frequencies (typically 0.05–0.2), while Sentence-BERT measures dense cosine embedding similarity (typically 0.4–0.7).
        </div>
      )}

      {/* Screen reader live updates */}
      <div className="sr-only" aria-live="polite" role="status">
        {isAnyLoading
          ? 'Searching arXiv papers...'
          : Object.values(responses).filter(Boolean).length > 0
          ? 'Search results updated.'
          : ''}
      </div>

      {mode === 'compare' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <ResultColumn
            title="TF-IDF"
            response={tfidfResponse}
            error={errors['tfidf'] ?? null}
            loading={!!loading['tfidf']}
            other={sbertResponse}
            getDocument={getDocument}
          />

          <ResultColumn
            title={sbertDisplayName}
            response={sbertResponse}
            error={errors[model] ?? null}
            loading={!!loading[model]}
            other={tfidfResponse}
            getDocument={getDocument}
          />
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <ResultColumn
            title={methods.find((m) => m.id === model)?.display_name ?? 'Search Results'}
            response={responses[model] ?? null}
            error={errors[model] ?? null}
            loading={!!loading[model]}
            other={null}
            getDocument={getDocument}
          />
        </div>
      )}
    </main>
  );
}
