import { onlyHereIds } from '../comparison';
import { ResultCard } from './ResultCard';
import type { DocumentRecord, Method, SearchResponse } from '../api';

interface ResultColumnProps {
  title: string;
  response: SearchResponse | null;
  error: string | null;
  loading: boolean;
  other: SearchResponse | null;
  showOnlyHere: boolean;
  getDocument: (id: string) => Promise<DocumentRecord>;
  method?: Method;
}

export function ResultColumn({
  title,
  response,
  error,
  loading,
  other,
  showOnlyHere,
  getDocument,
  method,
}: ResultColumnProps) {
  const onlyIds = onlyHereIds(response, other);

  return (
    <section
      className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl shadow-xs overflow-hidden flex flex-col"
      aria-busy={loading}
    >
      {/* Compact Column Header */}
      <header className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-toolbar)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-[var(--text)] truncate">
            {title}
          </h2>
          {method?.kind && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
              {method.kind}
            </span>
          )}
        </div>
        {response && !loading && (
          <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full whitespace-nowrap">
            {response.took_ms.toFixed(1)} ms
          </span>
        )}
      </header>

      {/* Method Information Block (Description, Benchmarks, Rerank Note) in Compare columns */}
      {method && other !== null && (
        <div className="px-4 py-3 text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--surface)]/40 space-y-1.5 leading-relaxed">
          <p>{method.description}</p>
          {method.benchmarks && method.benchmarks.length > 0 && (
            <>
              <p className="font-mono text-[var(--text)]">
                Benchmark nDCG@10:{' '}
                {method.benchmarks
                  .map(
                    (b) =>
                      `${b.dataset === 'scifact' ? 'SciFact' : b.dataset === 'fiqa' ? 'FiQA' : b.dataset} ${b.ndcg_at_10.toFixed(3)}`
                  )
                  .join(', ')}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Benchmark results on SciFact and FiQA, not measured on this arXiv corpus; see Evaluation.
              </p>
            </>
          )}
          {method.kind === 'reranked' && (
            <p className="text-blue-600 dark:text-blue-400 font-medium">
              Includes cross-encoder scoring of 100 candidates per query, so it is slower.
            </p>
          )}
        </div>
      )}

      {/* Column Content */}
      <div className="divide-y divide-[var(--border-subtle)] flex-1">
        {loading && (
          <div className="p-4 space-y-4" aria-label={`Loading ${title} results`}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/30 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 rounded-full skeleton-shimmer" />
                  <div className="h-4 w-16 rounded-full skeleton-shimmer" />
                </div>
                <div className="h-5 w-4/5 rounded-lg skeleton-shimmer" />
                <div className="h-3 w-32 rounded skeleton-shimmer" />
                <div className="space-y-1.5 pt-1">
                  <div className="h-3.5 w-full rounded skeleton-shimmer" />
                  <div className="h-3.5 w-5/6 rounded skeleton-shimmer" />
                </div>
                <div className="flex gap-2 pt-1">
                  <div className="h-4 w-14 rounded-full skeleton-shimmer" />
                  <div className="h-4 w-14 rounded-full skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="p-5 text-center">
            <div
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-left text-sm text-red-600 dark:text-red-300"
              role="alert"
            >
              <p className="font-bold text-red-700 dark:text-red-200">Search Error</p>
              <p className="mt-1 leading-relaxed break-words">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && response && response.results.length === 0 && (
          <div className="p-12 text-center text-[var(--text-muted)] text-sm italic">
            No matching papers found for this query.
          </div>
        )}

        {!loading && !error && !response && (
          <div className="p-12 text-center text-[var(--text-muted)] text-sm italic">
            Enter a research query above to see ranked papers.
          </div>
        )}

        {!loading &&
          !error &&
          response &&
          response.results.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              onlyHere={showOnlyHere && onlyIds.has(item.id)}
              getDocument={getDocument}
            />
          ))}
      </div>
    </section>
  );
}
